#!/bin/bash
# PreToolUse:Bash hook: git push前にE2E通過を強制
#
# .claude/.e2e-passed を JSON として読み:
#   - head_sha == git HEAD
#   - skipped == true: skip_reason が allowed list にある
#   - skipped == false: run_id 必須, completed_at < 24h, flows_passed == flows_total
# 不在 → evaluate-paths.sh で再判定 (no_e2e_affecting_paths なら自動 skip)

extract_command_from_arguments() {
  local arguments="$1"
  local command=""

  if command -v jq &> /dev/null; then
    command=$(echo "$arguments" | jq -r '.command // empty' 2>/dev/null)
  fi

  if [ -z "$command" ]; then
    command=$(echo "$arguments" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
  fi

  echo "$command"
}

COMMAND=$(extract_command_from_arguments "${ARGUMENTS:-}")

if [ -z "$COMMAND" ]; then
  exit 0
fi

if ! echo "$COMMAND" | grep -q "git push"; then
  exit 0
fi

extract_branch_from_push() {
  local cmd="$1"
  local args
  args=$(echo "$cmd" | sed 's/.*git push[[:space:]]*//')
  args=$(echo "$args" | sed 's/ -[^ ]*//g; s/ --[^ ]*//g')
  echo "$args" | awk '{print $NF}'
}

find_worktree_for_branch() {
  local branch="$1"
  git worktree list --porcelain 2>/dev/null | awk -v b="$branch" '
    /^worktree / { wt = substr($0, 10) }
    /^branch / { br = substr($0, 8); gsub(/^refs\/heads\//, "", br); if (br == b) { print wt; exit } }
  '
}

BRANCH=$(extract_branch_from_push "$COMMAND")

WORKTREE_PATH=""
if [ -n "$BRANCH" ]; then
  WORKTREE_PATH=$(find_worktree_for_branch "$BRANCH")
fi

if [ -z "$WORKTREE_PATH" ]; then
  WORKTREE_PATH=$(git rev-parse --show-toplevel 2>/dev/null || echo "")
fi

if [ -z "$WORKTREE_PATH" ]; then
  exit 0
fi

CURRENT_SHA=$(git -C "$WORKTREE_PATH" rev-parse HEAD 2>/dev/null || echo "")
if [ -z "$CURRENT_SHA" ]; then
  exit 0
fi

MARKER="${WORKTREE_PATH}/.claude/.e2e-passed"
GATE_SCRIPT="${WORKTREE_PATH}/scripts/gate/evaluate-paths.sh"

# マーカーが存在しない場合 → evaluate-paths.sh で再判定
if [ ! -f "$MARKER" ]; then
  if [ -f "$GATE_SCRIPT" ] && command -v jq &>/dev/null; then
    EVAL_JSON=$(bash "$GATE_SCRIPT" 2>/dev/null || echo "")
    if [ -n "$EVAL_JSON" ]; then
      E2E_REQUIRED=$(echo "$EVAL_JSON" | jq -r '.e2e_gate.required')
      SKIP_REASON=$(echo "$EVAL_JSON" | jq -r '.e2e_gate.skip_reason')
      if [ "$E2E_REQUIRED" = "false" ] || [ "$SKIP_REASON" = "no_e2e_affecting_paths" ]; then
        # E2E 影響なし → 通過
        exit 0
      fi
    fi
  fi
  echo "DENY: E2E 未確認のため push できません。" >&2
  echo "  このブランチには E2E 影響あり（mobile components / maestro yaml / testID / locales）の変更が含まれています。" >&2
  echo "  e2e-reviewer に impl-ready を送るか、bash scripts/gate/run-maestro-and-create-marker.sh --agent <name> を実行してください。" >&2
  echo "  マーカーファイル: ${MARKER}" >&2
  exit 2
fi

if ! command -v jq &>/dev/null; then
  # jq なし → 旧形式 SHA 文字列チェック
  MARKER_SHA=$(cat "$MARKER" | tr -d '[:space:]')
  if [ "$MARKER_SHA" != "$CURRENT_SHA" ]; then
    echo "DENY: .e2e-passed マーカー ($MARKER_SHA) は現在の HEAD ($CURRENT_SHA) と一致しません。" >&2
    exit 2
  fi
  exit 0
fi

MARKER_TYPE=$(jq -r 'type' "$MARKER" 2>/dev/null || echo "string")

if [ "$MARKER_TYPE" = "object" ]; then
  MARKER_SHA=$(jq -r '.head_sha // empty' "$MARKER" 2>/dev/null || echo "")
  SKIPPED=$(jq -r '.skipped // "false"' "$MARKER" 2>/dev/null || echo "false")
  SKIP_REASON=$(jq -r '.skip_reason // ""' "$MARKER" 2>/dev/null || echo "")
  RUN_ID=$(jq -r '.run_id // ""' "$MARKER" 2>/dev/null || echo "")
  FLOWS_PASSED=$(jq -r '.flows_passed // 0' "$MARKER" 2>/dev/null || echo 0)
  FLOWS_TOTAL=$(jq -r '.flows_total // 0' "$MARKER" 2>/dev/null || echo 0)
  COMPLETED_AT=$(jq -r '.completed_at // ""' "$MARKER" 2>/dev/null || echo "")
else
  # 旧形式 SHA のみ
  MARKER_SHA=$(cat "$MARKER" | tr -d '[:space:]')
  SKIPPED="true"
  SKIP_REASON="legacy_sha_marker"
fi

if [ "$MARKER_SHA" != "$CURRENT_SHA" ]; then
  echo "DENY: .e2e-passed マーカー ($MARKER_SHA) は現在の HEAD ($CURRENT_SHA) と一致しません。" >&2
  echo "  E2E 確認後に新しい commit があります。再度 e2e-reviewer に impl-ready を送ってください。" >&2
  exit 2
fi

if [ "$SKIPPED" = "true" ]; then
  # allowed skip reasons
  case "$SKIP_REASON" in
    no_e2e_affecting_paths|test_only_diff_or_infra_only|legacy_sha_marker)
      exit 0
      ;;
    *)
      echo "DENY: .e2e-passed マーカーの skip_reason が不明です: $SKIP_REASON" >&2
      exit 2
      ;;
  esac
fi

# skipped == false: run_id 必須、completed_at < 24h、flows_passed == flows_total
if [ -z "$RUN_ID" ]; then
  echo "DENY: .e2e-passed マーカーに run_id がありません。" >&2
  exit 2
fi

if [ "$FLOWS_PASSED" != "$FLOWS_TOTAL" ] || [ "$FLOWS_TOTAL" = "0" ]; then
  echo "DENY: E2E テストが全件 PASS していません (passed=$FLOWS_PASSED total=$FLOWS_TOTAL)。" >&2
  exit 2
fi

# completed_at < 24h チェック (nix flake 環境 = GNU coreutils 前提)
if [ -n "$COMPLETED_AT" ]; then
  NOW_EPOCH=$(date +%s)
  COMPLETED_EPOCH=$(date -d "$COMPLETED_AT" +%s 2>/dev/null || echo 0)
  if [ "$COMPLETED_EPOCH" -gt 0 ]; then
    ELAPSED=$((NOW_EPOCH - COMPLETED_EPOCH))
    MAX_AGE=$((24 * 3600))
    if [ "$ELAPSED" -gt "$MAX_AGE" ]; then
      echo "DENY: .e2e-passed マーカーが 24 時間以上前のものです (completed_at=$COMPLETED_AT)。" >&2
      echo "  再度 E2E テストを実行してください。" >&2
      exit 2
    fi
  fi
fi

exit 0
