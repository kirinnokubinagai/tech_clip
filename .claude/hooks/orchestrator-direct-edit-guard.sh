#!/usr/bin/env bash
# PreToolUse:Edit/Write hook: orchestrator の main ブランチ上での直接編集をブロック
#
# ブロックロジックの優先順位:
#   1. blocked_file チェック（ブランチ問わず DENY）
#      - .omc/state/**:          実行フロー状態ファイル（直接編集によるフロー操作を防止）
#   2. meta_file チェック（main 上でも ALLOW）
#      - .claude-user/**: メモリファイル（gitignore済み）
#      - .omc/**:         実行状態ファイル（gitignore済み）
#   3. クロスworktreeチェック（セッションが main で、ファイルが兄弟 worktree 内なら DENY）
#      worktree-isolation-guard.sh の .claude/ 例外を補完する
#      team active 時も DENY（main セッションから兄弟 worktree を編集するのは設計上あり得ない）
#   4. main ブランチチェック（ファイルのリポジトリが main なら全 DENY）
#      ファイル種類（apps/, packages/, tests/, scripts/, .claude/** 等）に関係なく全てブロック
#   5. orchestration_file チェック（main 以外なら ALLOW）
#      - .claude/**, CLAUDE.md, flake.nix 等
#   6. team active チェック（worktree ブランチ上での sub-agent 編集を許可）
#      CLAUDE_AGENT_NAME / process tree への依存を除去した代替判定。
#      team config が存在 = sub-agent が spawn されている = worktree 上での edit は sub-agent によるもの。
#      ※ main ブランチ経由は step 4 で先にブロック済みのため到達しない
#   7. それ以外 DENY（orchestrator はソースファイルを直接編集できない。実装系に委譲）

TOOL_INPUT=$(cat)

if [ -z "$TOOL_INPUT" ]; then
  # stdin が空のとき(= hook 呼び出し経路が想定外)は安全側で exit 0 のままにする
  # → そうしないと通常操作が全部ブロックされ使い物にならなくなる
  exit 0
fi

if command -v jq &> /dev/null; then
  FILE_PATH=$(echo "$TOOL_INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
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
# GNU realpath -m を優先し、macOS realpath にフォールバックする
_normalize_path() {
  local p="$1"
  if realpath -m "$p" 2>/dev/null; then
    return 0
  fi
  if [ -e "$p" ]; then
    realpath "$p" 2>/dev/null && return 0
  fi
  python3 -c "import os,sys; print(os.path.normpath(os.path.abspath(sys.argv[1])))" "$p" 2>/dev/null
}
FILE_PATH=$(_normalize_path "$FILE_PATH")
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
REPO_ROOT=$(_normalize_path "$REPO_ROOT")
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
  # 設計上の注記: .review-passed は意図的にここでブロックしない。
  # Bash touch コマンドは元々ブロックされていないため、coder エージェント等が
  # touch でマーカーを作成することは常に技術的に可能だった。
  # 最終防衛は pre-push-review-guard.sh（マーカー未存在時の push ブロック）が担う。
  # Write ツールによる作成も同等に扱い、不要な制限を除去している。
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

# team active 判定: active-issues team config が存在すれば sub-agent が稼働中
_has_active_team() {
  local config_path="${REPO_ROOT}/.claude-user/teams/active-issues/config.json"
  [ -f "$config_path" ]
}

# 1. 明示ブロック対象を先に評価（最優先 DENY）
if is_blocked_file "$FILE_PATH"; then
  echo "DENY: このファイルはorchestratorによる直接編集が禁止されています。" >&2
  echo "  対象ファイル: $FILE_PATH" >&2
  echo "  理由: 実行フロー状態ファイルです（直接編集による動作操作を防止）。" >&2
  exit 2
fi

# 2. gitignore 済みメタファイルは main 上でも許可
if is_meta_file "$FILE_PATH"; then
  exit 0
fi

# 3. クロスworktreeチェック: セッションが main のときに兄弟 worktree 内のファイルを直接編集するのをブロック
#    worktree-isolation-guard.sh と同じロジック（.claude/ 例外を持たないため、hook ファイルも含め全てカバー）
#    team active 時も DENY: main セッションから兄弟 worktree を編集するのは設計上あり得ない
SESSION_BRANCH=$(git branch --show-current 2>/dev/null || true)
if [[ "$SESSION_BRANCH" == "main" || "$SESSION_BRANCH" == "master" ]]; then
  _GIT_COMMON_DIR=$(git rev-parse --git-common-dir 2>/dev/null || true)
  if [[ -n "$_GIT_COMMON_DIR" ]]; then
    _MAIN_REPO_ROOT=$(cd "$_GIT_COMMON_DIR/.." && pwd -P 2>/dev/null || true)
    _MAIN_REPO_ROOT=$(_normalize_path "$_MAIN_REPO_ROOT" 2>/dev/null || echo "")
    _WORKTREE_BASE=$(dirname "$_MAIN_REPO_ROOT")
    if [[ -n "$_MAIN_REPO_ROOT" && "$FILE_PATH" == "${_WORKTREE_BASE}/"* && "$FILE_PATH" != "${_MAIN_REPO_ROOT}/"* ]]; then
      echo "DENY: mainブランチのオーケストレーターは兄弟worktreeのファイルを直接編集できません。" >&2
      echo "  対象ファイル: $FILE_PATH" >&2
      echo "" >&2
      echo "  ❌ 「修正が小さいから直接編集する」は禁止です。必ず以下のフローに従うこと:" >&2
      echo "  → Agent(coder, mode=\"acceptEdits\") でworktree内の修正を委譲してください。" >&2
      exit 2
    fi
  fi
fi

# 4. main ブランチ（または detached HEAD）上では全 Edit/Write をブロック
#    apps/, packages/, tests/, scripts/, .claude/** 等ファイル種類に関係なく全て対象
# symbolic-ref 失敗時（detached HEAD / .git 破損等）は空文字となり、安全側に倒してブロックする
CURRENT_BRANCH=$(git -C "$REPO_ROOT" symbolic-ref --short HEAD 2>/dev/null || true)
if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ] || [ -z "$CURRENT_BRANCH" ]; then
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

# 5. main 以外のブランチ（worktree）: orchestration ファイルは自由に編集可
if is_orchestration_file "$FILE_PATH"; then
  exit 0
fi

# 6. worktree 上でも orchestrator はソースファイルを直接編集できない
#    ただし team active 時は sub-agent による編集の可能性があるため許可
#    実装系サブエージェント（coder / infra-engineer / ui-designer）に委譲すること
if _has_active_team; then
  exit 0
fi
echo "DENY: orchestrator は worktree 上でもソースファイルを直接編集できません。" >&2
echo "  対象ファイル: $FILE_PATH" >&2
echo "" >&2
echo "  ❌ 「修正が小さいから直接編集する」は禁止です。必ず以下のフローに従うこと:" >&2
echo "  → Agent(coder, mode=\"acceptEdits\") で実装系サブエージェントに委譲してください。" >&2
exit 2
