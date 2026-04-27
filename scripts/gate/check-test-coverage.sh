#!/usr/bin/env bash
# check-test-coverage.sh: 変更ファイルに対応する test ファイルの存在を確認する
#
# 使い方: bash scripts/gate/check-test-coverage.sh [base_ref]
#   base_ref: 比較ベース (default: origin/main)
#
# stdout (PASS 時):
#   { "covered": true, "checked_files": N, "exempt_files": M }
#
# exit 0: 全件カバー済み
# exit 1: 不足している test ファイルがある場合 (stderr に詳細)
set -euo pipefail

BASE_REF="${1:-origin/main}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)"
RULES_FILE="${REPO_ROOT}/.claude/gate-rules.json"

if [ ! -f "$RULES_FILE" ]; then
  echo "ERROR: gate-rules.json not found: $RULES_FILE" >&2
  exit 1
fi

if ! command -v jq &>/dev/null; then
  echo "ERROR: jq is required" >&2
  exit 1
fi

# gate-rules.json から test_coverage_gate セクションを読み込む
TEST_REQUIRED_PATTERNS=$(jq -c '.test_coverage_gate.test_required_paths' "$RULES_FILE")
TEST_PATH_MAPPING=$(jq -c '.test_coverage_gate.test_path_mapping' "$RULES_FILE")
EXEMPT_PATTERNS=$(jq -c '.test_coverage_gate.exempt_paths' "$RULES_FILE")

# diff 取得（base_ref が存在しない場合は HEAD~1 フォールバック）
CHANGED_FILES=""
if git -C "$REPO_ROOT" rev-parse "$BASE_REF" &>/dev/null; then
  CHANGED_FILES=$(git -C "$REPO_ROOT" diff "${BASE_REF}...HEAD" --name-only 2>/dev/null || true)
fi
if [ -z "$CHANGED_FILES" ]; then
  CHANGED_FILES=$(git -C "$REPO_ROOT" diff HEAD~1...HEAD --name-only 2>/dev/null || true)
fi

# glob パターンマッチ (** 対応)
_match_glob() {
  local pattern="$1"
  local file="$2"
  if [[ "$pattern" == *"**"* ]]; then
    local regex
    regex=$(echo "$pattern" | sed \
      -e 's/\./\\./g' \
      -e 's/\*\*/DOUBLESTAR/g' \
      -e 's/\*/[^\/]*/g' \
      -e 's/DOUBLESTAR/.*/g')
    echo "$file" | grep -qE "^${regex}$" 2>/dev/null && return 0 || return 1
  else
    # shellcheck disable=SC2254
    case "$file" in
      $pattern) return 0 ;;
      *) return 1 ;;
    esac
  fi
}

# パターン配列のいずれかにマッチするか
_any_match() {
  local patterns_json="$1"
  local file="$2"
  local count i pat
  count=$(echo "$patterns_json" | jq -r 'length')
  i=0
  while [ "$i" -lt "$count" ]; do
    pat=$(echo "$patterns_json" | jq -r ".[$i]")
    if _match_glob "$pat" "$file"; then
      return 0
    fi
    i=$((i + 1))
  done
  return 1
}

# regex-based source→test パス変換 (jq の test_path_mapping を使用)
# 引数: source_file
# stdout: expected test path (空文字 = mapping なし)
_compute_test_path() {
  local source_file="$1"
  local count i source_pat test_pat result

  count=$(echo "$TEST_PATH_MAPPING" | jq -r 'length')
  i=0
  while [ "$i" -lt "$count" ]; do
    source_pat=$(echo "$TEST_PATH_MAPPING" | jq -r ".[$i].source")
    test_pat=$(echo "$TEST_PATH_MAPPING" | jq -r ".[$i].test")

    # bash の =~ で regex マッチ
    if [[ "$source_file" =~ ^${source_pat}$ ]]; then
      # BASH_REMATCH[1] (とその後) を使って $1/$2 を置換
      result="$test_pat"
      # $1 → BASH_REMATCH[1], $2 → BASH_REMATCH[2]
      if [[ -n "${BASH_REMATCH[1]:-}" ]]; then
        result="${result/\$1/${BASH_REMATCH[1]}}"
      fi
      if [[ -n "${BASH_REMATCH[2]:-}" ]]; then
        result="${result/\$2/${BASH_REMATCH[2]}}"
      fi
      echo "$result"
      return 0
    fi
    i=$((i + 1))
  done
  echo ""
}

# 新規ファイル判定: base_ref に存在しない = 新規
_is_new_file() {
  local file="$1"
  if git -C "$REPO_ROOT" show "${BASE_REF}:${file}" &>/dev/null 2>&1; then
    return 1  # 既存
  fi
  return 0  # 新規
}

# diff 内に含まれているか
_in_diff() {
  local file="$1"
  echo "$CHANGED_FILES" | grep -qxF "$file" 2>/dev/null && return 0 || return 1
}

CHECKED=0
EXEMPT=0
MISSING=()

if [ -n "$CHANGED_FILES" ]; then
  while IFS= read -r f; do
    [ -z "$f" ] && continue

    # exempt チェック
    if _any_match "$EXEMPT_PATTERNS" "$f"; then
      EXEMPT=$((EXEMPT + 1))
      continue
    fi

    # test_required_paths に該当するか
    if ! _any_match "$TEST_REQUIRED_PATTERNS" "$f"; then
      continue
    fi

    CHECKED=$((CHECKED + 1))

    # expected test path を計算
    expected_test=$(_compute_test_path "$f")
    if [ -z "$expected_test" ]; then
      # mapping 定義なし → skip (設計上 test_required_paths に含まれるなら mapping があるはず)
      continue
    fi

    if _is_new_file "$f"; then
      # 新規ソースファイル: 対応 test が diff に含まれていること
      if ! _in_diff "$expected_test"; then
        MISSING+=("$f -> $expected_test (新規ファイルに test が必要)")
      fi
    else
      # 既存ソースファイルの変更: test ファイルがディスク上に存在すること (diff 内不要)
      if [ ! -f "${REPO_ROOT}/${expected_test}" ]; then
        MISSING+=("$f -> $expected_test (既存ファイル変更に test ファイルが存在しない)")
      fi
    fi
  done <<< "$CHANGED_FILES"
fi

if [ "${#MISSING[@]}" -gt 0 ]; then
  echo "ERROR: 以下の変更に対応する test ファイルが不足しています:" >&2
  for m in "${MISSING[@]}"; do
    echo "  - $m" >&2
  done
  echo "" >&2
  echo "修正方法: 対応する test ファイルを追加または更新して git add してください。" >&2
  exit 1
fi

jq -n \
  --argjson covered true \
  --argjson checked_files "$CHECKED" \
  --argjson exempt_files "$EXEMPT" \
  '{ covered: $covered, checked_files: $checked_files, exempt_files: $exempt_files }'
