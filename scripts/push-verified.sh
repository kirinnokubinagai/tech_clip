#!/usr/bin/env bash
# push-verified.sh
# 現在のブランチを push し、ローカルとリモートの SHA / marker SHA が一致することを検証する。
# オプションで polling-watcher.sh を同期的に走らせ、PR の verdict が確定するまで wait する。
#
# 使い方:
#   bash scripts/push-verified.sh
#       → push + remote SHA 検証のみ
#   bash scripts/push-verified.sh --pr <PR> --issue <ISSUE> --agent <REVIEWER_AGENT>
#       → push + remote SHA 検証 + polling state 作成 + polling-watcher 同期実行
#       polling-watcher の最終 VERDICT 行を stdout に出力して exit する
#
# 後方互換:
#   bash scripts/push-verified.sh --create-polling-state PR ISSUE AGENT
#       → 上記と同等（polling-watcher も実行する）
set -euo pipefail

PR_NUMBER=""
ISSUE_NUMBER=""
REVIEWER_AGENT=""
RUN_POLLING=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --pr)     PR_NUMBER="$2";       shift 2 ;;
    --issue)  ISSUE_NUMBER="$2";    shift 2 ;;
    --agent)  REVIEWER_AGENT="$2";  shift 2 ;;
    --create-polling-state)
      # 後方互換: 位置引数 PR ISSUE AGENT
      PR_NUMBER="${2:-}"
      ISSUE_NUMBER="${3:-}"
      REVIEWER_AGENT="${4:-}"
      if [ -z "$PR_NUMBER" ] || [ -z "$ISSUE_NUMBER" ] || [ -z "$REVIEWER_AGENT" ]; then
        echo "usage: push-verified.sh --create-polling-state PR_NUMBER ISSUE_NUMBER REVIEWER_AGENT" >&2
        exit 1
      fi
      shift 4
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [ -n "$PR_NUMBER" ] && [ -n "$ISSUE_NUMBER" ] && [ -n "$REVIEWER_AGENT" ]; then
  RUN_POLLING=true
elif [ -n "$PR_NUMBER" ] || [ -n "$ISSUE_NUMBER" ] || [ -n "$REVIEWER_AGENT" ]; then
  echo "ERROR: --pr / --issue / --agent はすべて指定するかすべて省略してください" >&2
  exit 1
fi

WORKTREE_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
REVIEW_MARKER="${WORKTREE_ROOT}/.claude/.review-passed"

# --- フェイルセーフ: marker の検証（HEAD SHA 1 行形式） ---
if [ ! -f "$REVIEW_MARKER" ]; then
  echo "エラー: ローカルレビューが完了していません。push を中止します。" >&2
  echo "  bash scripts/gate/create-review-marker.sh --agent <name> を実行してください。" >&2
  echo "  マーカーファイル: ${REVIEW_MARKER}" >&2
  exit 1
fi

MARKER_SHA=$(tr -d '[:space:]' < "$REVIEW_MARKER")
if ! echo "$MARKER_SHA" | grep -qE '^[a-f0-9]{40}$'; then
  echo "エラー: review-passed マーカーの形式が不正です。HEAD SHA (40 文字 hex) のみが期待されています。" >&2
  echo "  内容: '${MARKER_SHA:0:80}'" >&2
  echo "  bash scripts/gate/create-review-marker.sh --agent <name> で再生成してください。" >&2
  exit 1
fi

CURRENT_SHA=$(git rev-parse HEAD)
if [ "$MARKER_SHA" != "$CURRENT_SHA" ]; then
  echo "エラー: review-passed マーカー (${MARKER_SHA:0:12}) は現在の HEAD (${CURRENT_SHA:0:12}) と一致しません。" >&2
  echo "  レビュー以降に新しい commit があります。再レビューしてください。" >&2
  exit 1
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "${BRANCH}" = "HEAD" ]; then
  echo "エラー: detached HEAD 状態です。ブランチをチェックアウトしてから実行してください。" >&2
  exit 1
fi

# --- push ---
echo "ブランチを push 中: ${BRANCH} (${CURRENT_SHA})"
git push origin HEAD

# --- remote SHA 検証 ---
git fetch origin "${BRANCH}"
REMOTE_SHA=$(git rev-parse "origin/${BRANCH}")

if [ "${CURRENT_SHA}" != "${REMOTE_SHA}" ]; then
  echo "push 検証失敗 (local != remote)" >&2
  echo "  ローカル:  ${CURRENT_SHA}" >&2
  echo "  リモート: ${REMOTE_SHA}" >&2
  exit 1
fi

# marker == remote の三方一致チェック (paranoid)
if [ "$MARKER_SHA" != "$REMOTE_SHA" ]; then
  echo "STUCK: review-passed マーカー (${MARKER_SHA:0:12}) と remote HEAD (${REMOTE_SHA:0:12}) が一致しません。" >&2
  echo "  レビュー対象 commit が remote に届いていません。" >&2
  exit 1
fi

echo "push 検証成功: ${CURRENT_SHA}"

# --- polling 不要なら終了 ---
if [ "$RUN_POLLING" = "false" ]; then
  exit 0
fi

# --- polling state 作成 ---
POLLING_DIR="${WORKTREE_ROOT}/.claude/polling"
mkdir -p "$POLLING_DIR"
STATE_FILE="${POLLING_DIR}/pr-${PR_NUMBER}.json"
jq -n \
  --argjson pr "$PR_NUMBER" \
  --arg sha "$CURRENT_SHA" \
  --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg agent "$REVIEWER_AGENT" \
  --argjson issue "$ISSUE_NUMBER" \
  '{
    pr_number: $pr,
    push_sha: $sha,
    issue_number: $issue,
    agent_name: $agent,
    started_at: $now
  }' > "$STATE_FILE"
echo "polling state 作成: $STATE_FILE"

# --- polling-watcher を同期実行 (still_pending なら 1 回だけ自動再実行) ---
WATCHER="${WORKTREE_ROOT}/scripts/polling-watcher.sh"
if [ ! -x "$WATCHER" ] && [ ! -f "$WATCHER" ]; then
  echo "WARN: polling-watcher.sh が見つかりません: $WATCHER" >&2
  echo "polling state は作成済み。reviewer が後続処理で polling-watcher を呼んでください。" >&2
  exit 0
fi

# loop: still_pending なら最大 6 回 (= 約 54 分) まで再呼び出し。
# それ以外の VERDICT で break。
MAX_ITERATIONS=6
ITERATION=0
LAST_VERDICT=""

while [ "$ITERATION" -lt "$MAX_ITERATIONS" ]; do
  ITERATION=$((ITERATION + 1))
  echo "--- polling iteration ${ITERATION}/${MAX_ITERATIONS} ---" >&2

  WATCHER_OUTPUT=$(bash "$WATCHER" "$PR_NUMBER" "$WORKTREE_ROOT" 2>&1 || true)
  echo "$WATCHER_OUTPUT" >&2

  LAST_VERDICT=$(echo "$WATCHER_OUTPUT" | grep -E '^VERDICT:' | tail -1)
  if [ -z "$LAST_VERDICT" ]; then
    echo "VERDICT: error no_verdict_from_watcher PR #${PR_NUMBER}"
    exit 1
  fi

  case "$LAST_VERDICT" in
    *still_pending*)
      echo "$LAST_VERDICT — 再 polling します" >&2
      continue
      ;;
    *)
      break
      ;;
  esac
done

# 最終 VERDICT を stdout に流す (reviewer はこれを read)
echo "$LAST_VERDICT"

# 終了コード: terminal verdict は 0 (reviewer が VERDICT 内容で分岐)
# still_pending のまま max iter を超えた場合は 1
case "$LAST_VERDICT" in
  *still_pending*) exit 1 ;;
  *error*)         exit 1 ;;
  *)               exit 0 ;;
esac
