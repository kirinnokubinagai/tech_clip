#!/usr/bin/env bash
# main-commit-guard.sh
# main ブランチへの git commit を Claude Code レベルでブロックする
#
# PreToolUse (Bash) フックとして呼び出される
# ARGUMENTS 環境変数: {"command": "..."}

set -uo pipefail

command -v jq >/dev/null 2>&1 || exit 0

command_str=$(printf '%s' "${ARGUMENTS:-}" | jq -r '.command // ""' 2>/dev/null || true)
[[ -n "${command_str}" ]] || exit 0

# git commit を含むコマンドのみ対象
printf '%s\n' "${command_str}" | grep -qE '(^|&&[[:space:]]*|;[[:space:]]*)git[[:space:]]+commit' || exit 0

# コマンド内に "cd <別パス>" があれば、そのパスのブランチを確認
# なければ CWD のブランチを確認
target_dir=""
if printf '%s\n' "${command_str}" | grep -qE '^cd [^&;[:space:]]'; then
  raw_path=$(printf '%s\n' "${command_str}" | sed -E 's|^cd ([^[:space:]&;]+).*|\1|' | head -1)
  raw_path="${raw_path//\'/}"
  raw_path="${raw_path//\"/}"
  if [[ -d "${raw_path}" ]]; then
    target_dir="${raw_path}"
  fi
fi

if [[ -n "${target_dir}" ]]; then
  current_branch=$(git -C "${target_dir}" rev-parse --abbrev-ref HEAD 2>/dev/null || true)
else
  current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)
fi

[[ "${current_branch}" == "main" ]] || exit 0

printf '{"decision":"block","reason":"main ブランチへの直接コミットは禁止されています。bash scripts/create-worktree.sh <issue-number> <description> で worktree を作成してください。"}\n'
