#!/bin/bash
# PreToolUse:Bash hook: git push前にE2E通過を強制
#
# .claude/.e2e-passed (HEAD SHA 1行) を読み:
#   - ファイル形式 = 40 文字 hex のみ (空行・JSON・余計な文字は不正)
#   - 内容 == git HEAD
# marker 不在 → evaluate-paths.sh で再判定 (no_e2e_affecting_paths / auto_skip なら通過)
# 不一致 / 不正形式 → exit 2

INPUT=$(cat)

if [ -z "$INPUT" ]; then
  exit 0
fi

if command -v jq &> /dev/null; then
  COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)
fi

if [ -z "$COMMAND" ]; then
  COMMAND=$(echo "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
fi

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

# branch 戦略 (#1138): marker 必須は stage → main の経路のみ
# feature/* / issue/* 等の通常開発 branch は CI gate に委譲 → push hook を緩める
CURRENT_BRANCH=$(git -C "$WORKTREE_PATH" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ "$CURRENT_BRANCH" != "stage" ] && [ "$CURRENT_BRANCH" != "main" ]; then
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
      AUTO_SKIP=$(echo "$EVAL_JSON" | jq -r '.e2e_gate.auto_skip')
      SKIP_REASON=$(echo "$EVAL_JSON" | jq -r '.e2e_gate.skip_reason')
      if [ "$E2E_REQUIRED" = "false" ] || [ "$AUTO_SKIP" = "true" ] || [ "$SKIP_REASON" = "no_e2e_affecting_paths" ]; then
        # E2E 影響なし or auto_skip → 通過
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

# marker の内容を取得 (空白・改行を除去)
MARKER_CONTENT=$(tr -d '[:space:]' < "$MARKER")

# 形式検証: 40 文字 hex のみ
if ! echo "$MARKER_CONTENT" | grep -qE '^[a-f0-9]{40}$'; then
  echo "DENY: .e2e-passed マーカーの形式が不正です。" >&2
  echo "  HEAD SHA (40文字 hex) のみを含むファイルが期待されています。" >&2
  echo "  内容: '${MARKER_CONTENT:0:80}...'" >&2
  echo "  bash scripts/gate/run-maestro-and-create-marker.sh --agent <name> で再生成してください。" >&2
  exit 2
fi

if [ "$MARKER_CONTENT" != "$CURRENT_SHA" ]; then
  echo "DENY: .e2e-passed マーカー (${MARKER_CONTENT:0:12}) は現在の HEAD (${CURRENT_SHA:0:12}) と一致しません。" >&2
  echo "  E2E 確認後に新しい commit があります。再度 e2e-reviewer に impl-ready を送ってください。" >&2
  exit 2
fi

exit 0
