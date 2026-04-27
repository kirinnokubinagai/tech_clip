#!/usr/bin/env bash
# push-verified.sh
# 現在のブランチを push し、ローカルとリモートの SHA が一致することを検証する
#
# 使い方:
#   bash scripts/push-verified.sh [--create-polling-state PR_NUMBER ISSUE_NUMBER REVIEWER_AGENT]
set -euo pipefail

CREATE_POLLING=false
POLLING_PR_NUMBER=""
POLLING_ISSUE_NUMBER=""
POLLING_REVIEWER_AGENT=""

if [ "${1:-}" = "--create-polling-state" ]; then
  CREATE_POLLING=true
  POLLING_PR_NUMBER="${2:-}"
  POLLING_ISSUE_NUMBER="${3:-}"
  POLLING_REVIEWER_AGENT="${4:-}"
  if [ -z "$POLLING_PR_NUMBER" ] || [ -z "$POLLING_ISSUE_NUMBER" ] || [ -z "$POLLING_REVIEWER_AGENT" ]; then
    echo "usage: push-verified.sh --create-polling-state PR_NUMBER ISSUE_NUMBER REVIEWER_AGENT" >&2
    exit 1
  fi
fi

# フェイルセーフ: .claude/.review-passed マーカーの存在と HEAD SHA の一致を確認する
# pre-push-review-guard.sh が hook で動作しているが、何らかの理由で bypass された場合のセーフティネット
WORKTREE_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
REVIEW_MARKER="${WORKTREE_ROOT}/.claude/.review-passed"

if [ ! -f "$REVIEW_MARKER" ]; then
  echo "エラー: ローカルレビューが完了していません。push を中止します。" >&2
  echo "  bash scripts/gate/create-review-marker.sh --agent <name> を実行してください。" >&2
  echo "  マーカーファイル: ${REVIEW_MARKER}" >&2
  exit 1
fi

CURRENT_SHA=$(git rev-parse HEAD)

# JSON マーカー形式（schema_version を持つ object）と旧 SHA-only 文字列の両方に対応
if command -v jq &>/dev/null && jq -e 'type == "object"' "$REVIEW_MARKER" &>/dev/null 2>&1; then
  MARKER_SHA=$(jq -r '.head_sha // empty' "$REVIEW_MARKER" 2>/dev/null || true)
  LINT_STATUS=$(jq -r '.lint_status // "UNKNOWN"' "$REVIEW_MARKER" 2>/dev/null || echo "UNKNOWN")
  TYPECHECK_STATUS=$(jq -r '.typecheck_status // "UNKNOWN"' "$REVIEW_MARKER" 2>/dev/null || echo "UNKNOWN")
  if [ "$LINT_STATUS" != "PASS" ]; then
    echo "エラー: review marker の lint_status が PASS ではありません: $LINT_STATUS" >&2
    exit 1
  fi
  if [ "$TYPECHECK_STATUS" != "PASS" ]; then
    echo "エラー: review marker の typecheck_status が PASS ではありません: $TYPECHECK_STATUS" >&2
    exit 1
  fi
else
  MARKER_SHA=$(tr -d '[:space:]' < "$REVIEW_MARKER")
fi

if [ "$MARKER_SHA" != "$CURRENT_SHA" ]; then
  echo "エラー: review-passed マーカー ($MARKER_SHA) は現在の HEAD ($CURRENT_SHA) と一致しません。" >&2
  echo "  レビュー以降に新しい commit があります。再レビューしてください。" >&2
  exit 1
fi

LOCAL_SHA="$CURRENT_SHA"
BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "${BRANCH}" = "HEAD" ]; then
  echo "エラー: detached HEAD 状態です。ブランチをチェックアウトしてから実行してください。" >&2
  exit 1
fi

echo "ブランチを push 中: ${BRANCH} (${LOCAL_SHA})"

git push origin HEAD

git fetch origin "${BRANCH}"
REMOTE_SHA=$(git rev-parse "origin/${BRANCH}")

if [ "${LOCAL_SHA}" = "${REMOTE_SHA}" ]; then
  echo "push 検証成功: ${LOCAL_SHA}"
else
  echo "push 検証失敗" >&2
  echo "  ローカル:  ${LOCAL_SHA}" >&2
  echo "  リモート: ${REMOTE_SHA}" >&2
  exit 1
fi

if [ "$CREATE_POLLING" = "true" ]; then
  POLLING_DIR="$(git rev-parse --show-toplevel)/.claude/polling"
  mkdir -p "$POLLING_DIR"
  STATE_FILE="${POLLING_DIR}/pr-${POLLING_PR_NUMBER}.json"
  jq -n \
    --argjson pr "$POLLING_PR_NUMBER" \
    --arg sha "$LOCAL_SHA" \
    --arg now "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    --arg agent "$POLLING_REVIEWER_AGENT" \
    --argjson issue "$POLLING_ISSUE_NUMBER" \
    '{
      pr_number: $pr,
      push_sha: $sha,
      issue_number: $issue,
      agent_name: $agent,
      started_at: $now
    }' > "$STATE_FILE"
  echo "polling state 作成: $STATE_FILE"
fi
