#!/usr/bin/env bash
# PreToolUse:Edit/Write hook: mainブランチ上でのソースファイル直接編集をブロック
#
# orchestration/config ファイル（.claude/**, .omc/**, CLAUDE.md, AGENTS.md,
# flake.nix, .gitignore 等）は mainブランチ上でも許可する。
# ただし以下は明示的にブロック（ブランチ問わず）:
#   - .claude/.review-passed: レビュープロセスのみが作成可能
#   - .omc/state/**:          実行フロー状態ファイル（直接編集によるフロー操作を防止）
# mainブランチ上のソースファイル（apps/, packages/, tests/ 配下）は worktree 経由を強制する。
# worktree（main以外のブランチ）では素通し（バックグラウンドエージェントの動作を許可するため）。

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [ -z "$TOOL_INPUT" ]; then
  exit 0
fi

if command -v jq &> /dev/null; then
  FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty' 2>/dev/null)
else
  echo "DENY: jq コマンドが必要です。flake.nix に jq が含まれているか確認してください。" >&2
  exit 2  # jq がない環境ではブロック方向に倒す
fi

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 相対パスは安全でないとして拒否
if [[ "$FILE_PATH" != /* ]]; then
  exit 2
fi

# シンボリックリンクや .. を正規化（ファイルが存在しなくても動作）
# realpath -m が失敗した場合はブロック方向に倒す（未正規化パスを使わない）
FILE_PATH=$(realpath -m "$FILE_PATH" 2>/dev/null)
if [ -z "$FILE_PATH" ]; then
  echo "DENY: パスの正規化に失敗しました（GNU coreutils の realpath が必要です）" >&2
  exit 2
fi

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
  # .review-passed は Edit/Write 経由での作成を防止し、マーカー作成は Bash touch に限定する（レビュー完了後の orchestrator による明示的な touch を強制）
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
    echo "  理由: Edit/Write 経由では作成できません。レビュー PASS 後に \`touch\` で作成してください。" >&2
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
  # symbolic-ref を使用: detached HEAD 時は空文字となり、mainと同様にブロック
  CURRENT_BRANCH=$(git -C "$REPO_ROOT" symbolic-ref --short HEAD 2>/dev/null)
  if [ "$CURRENT_BRANCH" = "main" ] || [ -z "$CURRENT_BRANCH" ]; then
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
