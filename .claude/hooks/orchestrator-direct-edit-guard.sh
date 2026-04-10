#!/bin/bash
# PreToolUse:Edit/Write hook: orchestratorによるソースファイルの直接編集をブロック
#
# orchestration/config ファイル（.claude/**, .omc/**, CLAUDE.md, AGENTS.md,
# flake.nix, .gitignore 等）は許可する（確認スキップ）。
# ただし以下は明示的にブロック:
#   - .claude/.review-passed: レビュープロセスのみが作成可能
#   - .omc/state/**:          実行フロー状態ファイル（直接編集によるフロー操作を防止）
# ソースファイル（apps/, packages/, tests/ 配下）は coder agent 経由を強制する。

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [ -z "$TOOL_INPUT" ]; then
  exit 0
fi

if command -v jq &> /dev/null; then
  FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty' 2>/dev/null)
else
  FILE_PATH=$(echo "$TOOL_INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"file_path"[[:space:]]*:[[:space:]]*"//' | sed 's/"$//')
fi

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# シンボリックリンクや .. を正規化（ファイルが存在しなくても動作）
# realpath -m が失敗した場合はブロック方向に倒す（未正規化パスを使わない）
if [[ "$FILE_PATH" = /* ]]; then
  FILE_PATH=$(realpath -m "$FILE_PATH" 2>/dev/null)
  [ -z "$FILE_PATH" ] && exit 2
else
  FILE_PATH=$(realpath -m "$(pwd)/$FILE_PATH" 2>/dev/null)
  [ -z "$FILE_PATH" ] && exit 2
fi

# orchestratorが直接編集できないファイル（明示的ブロック対象）
is_blocked_file() {
  local path="$1"

  # .review-passed はレビュープロセスのみが作成する（orchestratorの迂回を防止）
  # case-insensitive: macOS の大文字小文字を区別しないFSでの迂回を防止
  echo "$path" | grep -iqE "(^|/)\.claude/\.review-passed$" && return 0
  # .omc/state/ は実行フロー状態ファイル（直接編集による動作操作を防止）
  echo "$path" | grep -iqE "(^|/)\.omc/state/" && return 0

  return 1
}

# orchestration/config ファイルかどうかを判定する
is_orchestration_file() {
  local path="$1"

  echo "$path" | grep -qE "(^|/)\.claude/" && return 0
  echo "$path" | grep -qE "(^|/)\.omc/" && return 0
  echo "$path" | grep -qE "(^|/)CLAUDE\.md$" && return 0
  echo "$path" | grep -qE "(^|/)AGENTS\.md$" && return 0
  echo "$path" | grep -qE "(^|/)flake\.nix$" && return 0
  echo "$path" | grep -qE "(^|/)\.gitignore$" && return 0
  echo "$path" | grep -qE "(^|/)\.env\.example$" && return 0
  echo "$path" | grep -qE "(^|/)turbo\.json$" && return 0
  # ルートの package.json のみ許可（apps/api/package.json 等のサブパッケージは除外）
  # realpath -m で絶対パスに正規化されるため、git root との比較で判定する
  local repo_root
  repo_root=$(git -C "$(pwd)" rev-parse --show-toplevel 2>/dev/null || echo "")
  [ -n "$repo_root" ] && [ "$path" = "$repo_root/package.json" ] && return 0
  echo "$path" | grep -qE "(^|/)pnpm-workspace\.yaml$" && return 0

  return 1
}

# ソースファイルかどうかを判定する（ブロック対象）
is_source_file() {
  local path="$1"

  echo "$path" | grep -qE "(^|/)apps/" && return 0
  echo "$path" | grep -qE "(^|/)packages/" && return 0
  echo "$path" | grep -qE "(^|/)tests/" && return 0

  return 1
}

# 明示ブロック対象を先に評価（orchestration 許可より優先）
if is_blocked_file "$FILE_PATH"; then
  echo "DENY: このファイルはorchestratorによる直接編集が禁止されています。" >&2
  echo "  対象ファイル: $FILE_PATH" >&2
  exit 2
fi

if is_orchestration_file "$FILE_PATH"; then
  exit 0
fi

if is_source_file "$FILE_PATH"; then
  echo "DENY: orchestratorによるソースファイルの直接編集は禁止されています。" >&2
  echo "  対象ファイル: $FILE_PATH" >&2
  echo "  coder agent を使って編集してください。" >&2
  echo "  例: Agent(coder) でタスクを委譲する" >&2
  exit 2
fi

exit 0
