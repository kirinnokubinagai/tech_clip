#!/usr/bin/env bash
# main-commit-guard.sh
# main ブランチへの git commit を Claude Code レベルでブロックする
#
# PreToolUse (Bash) フックとして呼び出される
# ARGUMENTS 環境変数: {"command": "..."}

set -uo pipefail

if ! command -v jq >/dev/null 2>&1; then
  printf '{"decision":"block","reason":"main ブランチへのコミット guard: jq が必要です。nix develop で環境に入ってから実行してください。"}\n'
  exit 0
fi

command_str=$(printf '%s' "${ARGUMENTS:-}" | jq -r '.command // ""' 2>/dev/null || true)
[[ -n "${command_str}" ]] || exit 0

# git commit を含むコマンドのみ対象（||, &, サブシェル、git フラグ等も考慮）
if ! printf '%s\n' "${command_str}" | grep -qE '\bgit\b.*\bcommit\b'; then
  exit 0
fi

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

# git -C <path> 形式も検出してターゲットディレクトリを上書き
if printf '%s\n' "${command_str}" | grep -qE 'git[[:space:]]+-C[[:space:]]+[^[:space:]]'; then
  git_c_path=$(printf '%s\n' "${command_str}" | grep -oE 'git[[:space:]]+-C[[:space:]]+[^[:space:]&;]+' | head -1 | sed -E 's/git[[:space:]]+-C[[:space:]]+//')
  git_c_path="${git_c_path//\'/}"
  git_c_path="${git_c_path//\"/}"
  if [[ -d "${git_c_path}" ]]; then
    target_dir="${git_c_path}"
  fi
fi

# ターゲットディレクトリのブランチを取得
# symbolic-ref を使い、detached HEAD の場合は main コミットと比較する
if [[ -n "${target_dir}" ]]; then
  current_branch=$(git -C "${target_dir}" symbolic-ref --short HEAD 2>/dev/null || true)
  if [[ -z "${current_branch}" ]]; then
    head_sha=$(git -C "${target_dir}" rev-parse HEAD 2>/dev/null || true)
    main_sha=$(git -C "${target_dir}" rev-parse refs/heads/main 2>/dev/null || true)
    if [[ -n "${head_sha}" && "${head_sha}" == "${main_sha}" ]]; then
      current_branch="main"
    fi
  fi
else
  current_branch=$(git symbolic-ref --short HEAD 2>/dev/null || true)
  if [[ -z "${current_branch}" ]]; then
    head_sha=$(git rev-parse HEAD 2>/dev/null || true)
    main_sha=$(git rev-parse refs/heads/main 2>/dev/null || true)
    if [[ -n "${head_sha}" && "${head_sha}" == "${main_sha}" ]]; then
      current_branch="main"
    fi
  fi
fi

[[ "${current_branch}" == "main" ]] || exit 0

printf '{"decision":"block","reason":"main ブランチへの直接コミットは禁止されています。bash scripts/create-worktree.sh <issue-number> <description> で worktree を作成してください。"}\n'
