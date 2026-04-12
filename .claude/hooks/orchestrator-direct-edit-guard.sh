#!/usr/bin/env bash
# PreToolUse:Edit/Write hook: mainブランチおよび detached HEAD 上での直接編集をブロック
#
# ブロックロジックの優先順位:
#   1. blocked_file チェック（ブランチ問わず DENY）
#      - .claude/.review-passed: レビュープロセスのみが作成可能
#      - .omc/state/**:          実行フロー状態ファイル
#   2. meta_file チェック（main 上でも ALLOW）
#      - .claude-user/**: メモリファイル（gitignore済み）
#      - .omc/**:         実行状態ファイル（gitignore済み）
#   3. main ブランチチェック（main なら全 DENY）
#      ファイル種類（apps/, packages/, tests/, scripts/, .claude/** 等）に関係なく全てブロック
#   4. orchestration_file チェック（main 以外なら ALLOW）
#      - .claude/**, CLAUDE.md, AGENTS.md, flake.nix 等
#   5. それ以外 ALLOW（worktree 内バックグラウンドエージェントの動作を許可）

TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [ -z "$TOOL_INPUT" ]; then
  exit 0
fi

if command -v jq &> /dev/null; then
  FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.file_path // empty' 2>/dev/null)
else
  echo "DENY: jq コマンドが必要です。nix develop で環境に入ってから実行してください。" >&2
  exit 2  # jq がない環境ではブロック方向に倒す
fi

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 相対パスは安全でないとして拒否
if [[ "$FILE_PATH" != /* ]]; then
  echo "DENY: 相対パスは安全でないため拒否します: $FILE_PATH" >&2
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
    local top
    top=$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null)
    if [ -n "$top" ]; then
      echo "$top"
      return 0
    fi
    dir=$(dirname "$dir")
  done
  return 1
}

REPO_ROOT=$(_find_repo_root "$FILE_PATH")
if [ -z "$REPO_ROOT" ]; then
  echo "DENY: git リポジトリルートが特定できませんでした: $FILE_PATH" >&2
  exit 2
fi
REPO_ROOT=$(realpath -m "$REPO_ROOT" 2>/dev/null)
if [ -z "$REPO_ROOT" ]; then
  echo "DENY: REPO_ROOT のパス正規化に失敗しました" >&2
  exit 2
fi

# orchestratorが直接編集できないファイル（明示的ブロック対象・ブランチ問わず）
is_blocked_file() {
  local path="$1"
  local lower_path="${path,,}"
  local lower_root="${REPO_ROOT,,}"
  local matched=1
  # .review-passed は Edit/Write 経由での作成を防止し、マーカー作成は Bash touch に限定する（レビュー完了後の orchestrator による明示的な touch を強制）
  [[ "$lower_path" == "$lower_root/.claude/.review-passed" ]] && matched=0
  # .omc/state/ は実行フロー状態ファイル（直接編集による動作操作を防止）
  [[ "$lower_path" == "$lower_root/.omc/state" ]] && matched=0
  [[ "$lower_path" == "$lower_root/.omc/state/"* ]] && matched=0
  return $matched
}

# gitignore 済みメタファイル（main 上でも書き込みを許可）
# .claude-user/**: メモリファイル（gitignore済み、コミットされない）
# .omc/**:         実行状態ファイル（gitignore済み、コミットされない）
#   ただし .omc/state/** は is_blocked_file で先にブロック済みのためここには到達しない
is_meta_file() {
  local path="$1"
  local lower_path="${path,,}"
  local lower_root="${REPO_ROOT,,}"
  [[ "$lower_path" == "$lower_root/.claude-user/"* ]] && return 0
  [[ "$lower_path" == "$lower_root/.omc/"* ]] && return 0
  return 1
}

# orchestration/config ファイルかどうかを判定する（main 以外のブランチでのみ許可）
is_orchestration_file() {
  local path="$1"
  local lower_path="${path,,}"
  local lower_root="${REPO_ROOT,,}"
  local matched=1
  [[ "$lower_path" == "$lower_root/.claude/"* ]] && matched=0
  [[ "$lower_path" == "$lower_root/claude.md" ]] && matched=0
  [[ "$lower_path" == "$lower_root/agents.md" ]] && matched=0
  [[ "$lower_path" == "$lower_root/flake.nix" ]] && matched=0
  [[ "$lower_path" == "$lower_root/.gitignore" ]] && matched=0
  [[ "$lower_path" == "$lower_root/.env.example" ]] && matched=0
  [[ "$lower_path" == "$lower_root/turbo.json" ]] && matched=0
  [[ "$lower_path" == "$lower_root/package.json" ]] && matched=0
  [[ "$lower_path" == "$lower_root/pnpm-workspace.yaml" ]] && matched=0
  return $matched
}

# 1. 明示ブロック対象を先に評価（最優先 DENY）
if is_blocked_file "$FILE_PATH"; then
  echo "DENY: このファイルはorchestratorによる直接編集が禁止されています。" >&2
  echo "  対象ファイル: $FILE_PATH" >&2
  if [[ "${FILE_PATH,,}" == *"/.review-passed" ]]; then
    echo "  理由: Edit/Write 経由では作成できません。レビュー PASS 後に \`touch\` で作成してください。" >&2
  else
    echo "  理由: 実行フロー状態ファイルです（直接編集による動作操作を防止）。" >&2
  fi
  exit 2
fi

# 2. gitignore 済みメタファイルは main 上でも許可
if is_meta_file "$FILE_PATH"; then
  exit 0
fi

# 3. main ブランチ（または detached HEAD）上では全 Edit/Write をブロック
#    apps/, packages/, tests/, scripts/, .claude/** 等ファイル種類に関係なく全て対象
# symbolic-ref 失敗時（detached HEAD / .git 破損等）は空文字となり、安全側に倒してブロックする
CURRENT_BRANCH=$(git -C "$REPO_ROOT" symbolic-ref --short HEAD 2>/dev/null || true)
if [ "$CURRENT_BRANCH" = "main" ] || [ -z "$CURRENT_BRANCH" ]; then
  echo "DENY: orchestratorによる main ブランチ上での直接編集は禁止されています。" >&2
  echo "  対象ファイル: $FILE_PATH" >&2
  echo "" >&2
  echo "  ⚠️  必須フロー（CLAUDE.md「Issue 対応の完全フロー」に厳密に従うこと）:" >&2
  echo "  1. gh issue view <N> または gh issue create で Issue を確認/作成する" >&2
  echo "  2. bash scripts/create-worktree.sh <N> <kebab-case-desc> で Worktree を作成する" >&2
  echo "  3. Agent(requirements-analyst, mode=\"acceptEdits\") で要件を整理する" >&2
  echo "  4. Agent(coder, mode=\"acceptEdits\") で実装する" >&2
  echo "" >&2
  echo "  ❌ main ブランチで直接編集することも、Agent(coder) を直接呼び出すことも禁止です。" >&2
  exit 2
fi

# 4. main 以外のブランチ（worktree）: orchestration ファイルは自由に編集可
if is_orchestration_file "$FILE_PATH"; then
  exit 0
fi

# 5. それ以外（worktree 内ソースファイル等）は許可
exit 0
