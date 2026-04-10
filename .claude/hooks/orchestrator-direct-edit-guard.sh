#!/usr/bin/env bash
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
  exit 2  # jq がない環境ではブロック方向に倒す
fi

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# .claude/ 配下の設定ファイルはスキップ（早期 exit でコストを下げる）
if echo "$FILE_PATH" | grep -qE "(^|/)\.claude/"; then
  exit 0
fi

# 相対パスは安全でないとして拒否
if [[ "$FILE_PATH" != /* ]]; then
  exit 2
fi

# シンボリックリンクや .. を正規化（ファイルが存在しなくても動作）
# realpath -m が失敗した場合はブロック方向に倒す（未正規化パスを使わない）
FILE_PATH=$(realpath -m "$FILE_PATH" 2>/dev/null)
[ -z "$FILE_PATH" ] && exit 2

# repo_root を正規化済み絶対パスから上方向に探索して取得する
# パス自体が存在しない場合でも親ディレクトリを遡って git root を見つける
_find_repo_root() {
  local path="$1"
  local dir
  dir=$(dirname "$path")
  while [ "$dir" != "/" ]; do
    if git -C "$dir" rev-parse --show-toplevel &>/dev/null; then
      git -C "$dir" rev-parse --show-toplevel 2>/dev/null
      return 0
    fi
    dir=$(dirname "$dir")
  done
  return 1
}

REPO_ROOT=$(_find_repo_root "$FILE_PATH")
if [ -z "$REPO_ROOT" ]; then
  exit 2
fi

# orchestratorが直接編集できないファイル（明示的ブロック対象）
is_blocked_file() {
  local path="$1"

  # macOS case-insensitive FS 対策
  shopt -s nocasematch
  local matched=1
  # .review-passed はレビュープロセスのみが作成する（orchestratorの迂回を防止）
  [[ "$path" == "$REPO_ROOT/.claude/.review-passed" ]] && matched=0
  # .omc/state/ は実行フロー状態ファイル（直接編集による動作操作を防止）
  [[ "$path" == "$REPO_ROOT/.omc/state" ]] && matched=0
  [[ "$path" == "$REPO_ROOT/.omc/state/"* ]] && matched=0
  shopt -u nocasematch
  return $matched
}

# orchestration/config ファイルかどうかを判定する（repo_root 直下のみ許可）
is_orchestration_file() {
  local path="$1"

  # macOS case-insensitive FS 対策
  shopt -s nocasematch
  local matched=1
  [[ "$path" == "$REPO_ROOT/.claude/"* ]] && matched=0
  [[ "$path" == "$REPO_ROOT/.omc/"* ]] && matched=0
  [[ "$path" == "$REPO_ROOT/CLAUDE.md" ]] && matched=0
  [[ "$path" == "$REPO_ROOT/AGENTS.md" ]] && matched=0
  [[ "$path" == "$REPO_ROOT/flake.nix" ]] && matched=0
  [[ "$path" == "$REPO_ROOT/.gitignore" ]] && matched=0
  [[ "$path" == "$REPO_ROOT/.env.example" ]] && matched=0
  [[ "$path" == "$REPO_ROOT/turbo.json" ]] && matched=0
  [[ "$path" == "$REPO_ROOT/package.json" ]] && matched=0
  [[ "$path" == "$REPO_ROOT/pnpm-workspace.yaml" ]] && matched=0
  shopt -u nocasematch
  return $matched
}

# ソースファイルかどうかを判定する（ブロック対象）
# apps/, packages/, tests/ 配下のファイルは coder agent 経由を強制
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
  shopt -s nocasematch
  if [[ "$FILE_PATH" == *"/.review-passed" ]]; then
    echo "  理由: レビュープロセスのみが作成可能なファイルです。" >&2
  else
    echo "  理由: 実行フロー状態ファイルです（直接編集による動作操作を防止）。" >&2
  fi
  shopt -u nocasematch
  exit 2
fi

if is_orchestration_file "$FILE_PATH"; then
  exit 0
fi

# mainブランチ上でのソースファイル直接編集をブロック
# orchestration/config ファイルはmainブランチでも許可済みのためここには到達しない
if is_source_file "$FILE_PATH"; then
  _branch=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null)
  # detached HEAD の場合も含め、mainブランチと判定する
  if [ "$_branch" = "main" ] || [ -z "$_branch" ]; then
    echo "DENY: orchestratorによるソースファイルの直接編集は禁止されています。" >&2
    echo "  対象ファイル: $FILE_PATH" >&2
    echo "" >&2
    echo "  ⚠️  必須フロー（CLAUDE.md「Issue 対応の完全フロー」に厳密に従うこと）:" >&2
    echo "  1. gh issue view <N> または gh issue create で Issue を確認/作成する" >&2
    echo "  2. bash scripts/create-worktree.sh <N> <kebab-case-desc> で Worktree を作成する" >&2
    echo "  3. Agent(requirements-analyst, mode=\"acceptEdits\") で要件を整理する" >&2
    echo "  4. Agent(coder, mode=\"acceptEdits\") で実装する" >&2
    echo "" >&2
    echo "  ❌ main ブランチで直接 Agent(coder) を呼び出すことも禁止です。Issue + Worktree が先です。" >&2
    exit 2
  fi
fi

exit 0
