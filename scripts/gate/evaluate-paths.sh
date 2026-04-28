#!/usr/bin/env bash
# evaluate-paths.sh: gate-rules.json に基づきパス分類と gate 判定を行う
#
# 使い方: bash scripts/gate/evaluate-paths.sh [base_ref]
#   base_ref: 比較ベース (default: origin/main)
#
# stdout: JSON 出力
#   {
#     "head_sha": "...",
#     "base_ref": "...",
#     "changed_files": [...],
#     "review_gate": {"required": true, "auto_pass": false},
#     "e2e_gate": {"required": false, "auto_skip": true, "skip_reason": "..."},
#     "ci_jobs_needed": ["api_test", "lint", ...]
#   }
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# REPO_ROOT env var override allows tests to point to a temp repo
REPO_ROOT="${REPO_ROOT:-$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)}"

# base_ref 解決: 引数 > 環境変数 > PR ターゲット自動検出 > ブランチ名推定
if [ -n "${1:-}" ]; then
  BASE_REF="$1"
elif [ -n "${BASE_REF:-}" ]; then
  : # 環境変数をそのまま使う
else
  CURRENT_BRANCH=$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  # PR が存在すればそのターゲットブランチを使う（CI と判定を一致させる）
  PR_BASE=""
  if command -v gh &>/dev/null; then
    PR_BASE=$(gh pr view "$CURRENT_BRANCH" --json baseRefName --jq '.baseRefName' 2>/dev/null || true)
  fi
  if [ -n "$PR_BASE" ]; then
    BASE_REF="origin/${PR_BASE}"
  elif [ "$CURRENT_BRANCH" = "stage" ]; then
    BASE_REF="origin/main"
  elif git -C "$REPO_ROOT" rev-parse --verify origin/stage >/dev/null 2>&1; then
    BASE_REF="origin/stage"
  else
    BASE_REF="origin/main"
  fi
fi
RULES_FILE="${REPO_ROOT}/.claude/gate-rules.json"

if [ ! -f "$RULES_FILE" ]; then
  echo "ERROR: gate-rules.json not found: $RULES_FILE" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required" >&2
  exit 1
fi

HEAD_SHA=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null)

# diff 取得（base_ref が存在しない場合は HEAD~1 フォールバック）
CHANGED_FILES=""
if git -C "$REPO_ROOT" rev-parse "$BASE_REF" &>/dev/null; then
  CHANGED_FILES=$(git -C "$REPO_ROOT" diff "${BASE_REF}...HEAD" --name-only 2>/dev/null || true)
fi
if [ -z "$CHANGED_FILES" ]; then
  CHANGED_FILES=$(git -C "$REPO_ROOT" diff HEAD~1...HEAD --name-only 2>/dev/null || true)
fi

# ファイルパスのグロブパターンマッチ (bash fnmatch 相当)
# 引数: pattern file
_match_pattern() {
  local pattern="$1"
  local file="$2"
  # ** を含むパターンは fnmatch で処理できないため特別扱い
  if [[ "$pattern" == *"**"* ]]; then
    # ** をワイルドカード展開に変換して case 文で一致確認
    local regex
    regex=$(echo "$pattern" | sed \
      -e 's/\./\\./g' \
      -e 's/\*\*/DOUBLESTAR/g' \
      -e 's/\*/[^\/]*/g' \
      -e 's/DOUBLESTAR/.*/g')
    echo "$file" | grep -qE "^${regex}$" 2>/dev/null && return 0 || return 1
  else
    # 単純 fnmatch (case 文で評価) — グロブとして展開するため SC2254 は意図的
    # shellcheck disable=SC2254
    case "$file" in
      $pattern) return 0 ;;
      *) return 1 ;;
    esac
  fi
}

# ファイルリストに対してパターン配列をマッチさせる
# 引数: jq_array_key files...
_any_match_patterns() {
  local patterns_json="$1"
  local file="$2"
  local count
  count=$(echo "$patterns_json" | jq -r 'length')
  local i=0
  while [ "$i" -lt "$count" ]; do
    local pat
    pat=$(echo "$patterns_json" | jq -r ".[$i]")
    if _match_pattern "$pat" "$file"; then
      return 0
    fi
    i=$((i + 1))
  done
  return 1
}

# gate-rules.json から各セクションを読み込む
REVIEW_REQUIRED_PATTERNS=$(jq -c '.review_gate.required_paths' "$RULES_FILE")
REVIEW_AUTOPASS_PATTERNS=$(jq -c '.review_gate.auto_pass_paths' "$RULES_FILE")
E2E_REQUIRED_PATTERNS=$(jq -c '.e2e_gate.always_required_paths' "$RULES_FILE")
E2E_AUTOSKIP_PATTERNS=$(jq -c '.e2e_gate.auto_skip_paths' "$RULES_FILE")
E2E_CONTENT_PATTERN=$(jq -r '.e2e_gate.content_pattern_check.pattern' "$RULES_FILE")
E2E_CONTENT_APPLIES=$(jq -c '.e2e_gate.content_pattern_check.applies_to' "$RULES_FILE")

# review_gate 判定
review_required=false
review_auto_pass=false
all_auto_pass=true

if [ -z "$CHANGED_FILES" ]; then
  review_required=false
  review_auto_pass=true
  all_auto_pass=true
else
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if _any_match_patterns "$REVIEW_REQUIRED_PATTERNS" "$f"; then
      review_required=true
      if ! _any_match_patterns "$REVIEW_AUTOPASS_PATTERNS" "$f"; then
        all_auto_pass=false
      fi
    fi
  done <<< "$CHANGED_FILES"
  if $review_required && $all_auto_pass; then
    review_auto_pass=true
  fi
fi

# e2e_gate 判定
e2e_required=false
e2e_auto_skip=true
e2e_skip_reason="no_e2e_affecting_paths"
e2e_skip_paths_matched="[]"

if [ -n "$CHANGED_FILES" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if _any_match_patterns "$E2E_REQUIRED_PATTERNS" "$f"; then
      e2e_required=true
      break
    fi
    # content_pattern_check: testID を含む .tsx/.jsx
    if _any_match_patterns "$E2E_CONTENT_APPLIES" "$f"; then
      full_path="${REPO_ROOT}/${f}"
      if [ -f "$full_path" ] && grep -q "$E2E_CONTENT_PATTERN" "$full_path" 2>/dev/null; then
        e2e_required=true
        break
      fi
    fi
  done <<< "$CHANGED_FILES"
fi

if $e2e_required; then
  # auto_skip 判定: 全 changed_files が auto_skip_paths にマッチし testID がない場合
  matched_skip_paths="[]"
  all_skip=true
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if _any_match_patterns "$E2E_AUTOSKIP_PATTERNS" "$f"; then
      matched_skip_paths=$(echo "$matched_skip_paths" | jq --arg p "$f" '. += [$p]')
    else
      all_skip=false
    fi
  done <<< "$CHANGED_FILES"

  if $all_skip; then
    e2e_auto_skip=true
    e2e_skip_reason="test_only_diff_or_infra_only"
    e2e_skip_paths_matched="$matched_skip_paths"
  else
    e2e_auto_skip=false
    e2e_skip_reason=""
    e2e_skip_paths_matched="[]"
  fi
else
  e2e_auto_skip=true
  e2e_skip_reason="no_e2e_affecting_paths"
  e2e_skip_paths_matched="[]"
fi

# ci_jobs_needed 判定
CI_FILTERS=$(jq -c '.ci_path_filters' "$RULES_FILE")
ci_jobs="[]"
CI_JOB_KEYS=$(echo "$CI_FILTERS" | jq -r 'keys[]')
while IFS= read -r job; do
  patterns=$(echo "$CI_FILTERS" | jq -c --arg j "$job" '.[$j]')
  matched=false
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    if _any_match_patterns "$patterns" "$f"; then
      matched=true
      break
    fi
  done <<< "$CHANGED_FILES"
  if $matched; then
    ci_jobs=$(echo "$ci_jobs" | jq --arg j "$job" '. += [$j]')
  fi
done <<< "$CI_JOB_KEYS"

# changed_files を JSON 配列に変換
CHANGED_JSON="[]"
while IFS= read -r f; do
  [ -z "$f" ] && continue
  CHANGED_JSON=$(echo "$CHANGED_JSON" | jq --arg p "$f" '. += [$p]')
done <<< "$CHANGED_FILES"

# 出力
jq -n \
  --arg head_sha "$HEAD_SHA" \
  --arg base_ref "$BASE_REF" \
  --argjson changed_files "$CHANGED_JSON" \
  --argjson review_required "$review_required" \
  --argjson review_auto_pass "$review_auto_pass" \
  --argjson e2e_required "$e2e_required" \
  --argjson e2e_auto_skip "$e2e_auto_skip" \
  --arg e2e_skip_reason "$e2e_skip_reason" \
  --argjson e2e_skip_paths "$e2e_skip_paths_matched" \
  --argjson ci_jobs "$ci_jobs" \
  '{
    head_sha: $head_sha,
    base_ref: $base_ref,
    changed_files: $changed_files,
    review_gate: {required: $review_required, auto_pass: $review_auto_pass},
    e2e_gate: {required: $e2e_required, auto_skip: $e2e_auto_skip, skip_reason: $e2e_skip_reason, skip_paths_matched: $e2e_skip_paths},
    ci_jobs_needed: $ci_jobs
  }'
