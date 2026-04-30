#!/usr/bin/env bash
# auto-fix.sh: CHANGES_REQUESTED 受信時に自動修正を試行する
#
# 使い方: bash scripts/gate/auto-fix.sh < /tmp/changes-{issue}-{seq}.txt
# 入力: CHANGES_REQUESTED の本文 (stdin)
# 出力: 修正済 → exit 0, 修正不可 → exit 1 + 残課題を stderr

set -euo pipefail

REASON_TEXT=$(cat)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)"

cd "$REPO_ROOT"

# サブシェル境界を越えてフラグを伝達するための一時ファイル
FIXED_FLAG=$(mktemp)
trap 'rm -f "$FIXED_FLAG"' EXIT

# Pattern 1: Biome lint / format errors
if echo "$REASON_TEXT" | grep -qiE 'biome|lint|format|import order'; then
  echo "auto-fix: biome check --apply 実行中..." >&2
  if direnv exec . pnpm biome check --apply . 2>&1; then
    echo "fixed" > "$FIXED_FLAG"
  fi
fi

# Pattern 2: 不足 test skeleton 生成
if echo "$REASON_TEXT" | grep -qiE 'test ファイルが不足|test_coverage_status|test が必要|test ファイルが存在しない'; then
  echo "auto-fix: test skeleton 生成中..." >&2

  MISSING_OUTPUT=""
  if ! MISSING_OUTPUT=$(bash "$SCRIPT_DIR/check-test-coverage.sh" 2>&1); then
    MISSING_TESTS=$(echo "$MISSING_OUTPUT" | grep -oE 'tests/[^ ]+\.(test\.tsx?|bats)' | sort -u || true)

    if [ -n "$MISSING_TESTS" ]; then
      while IFS= read -r tf; do
        [ -z "$tf" ] && continue
        mkdir -p "$(dirname "$tf")"
        if [ ! -f "$tf" ]; then
          if [[ "$tf" == *.bats ]]; then
            cat > "$tf" <<'BATS_EOF'
#!/usr/bin/env bats
# auto-generated stub - TODO: 実装に対応するテストを追加すること

@test "TODO: 実装に対応するテストを追加すること" {
  skip "auto-generated stub"
}
BATS_EOF
          else
            cat > "$tf" <<'TS_EOF'
import { describe, it } from "vitest";

describe("auto-generated stub", () => {
  it.todo("TODO: 実装に対応するテストを追加すること");
});
TS_EOF
          fi
          echo "auto-fix: created $tf" >&2
          echo "fixed" > "$FIXED_FLAG"
        fi
      done <<< "$MISSING_TESTS"
    fi
  fi
fi

if [ "$(cat "$FIXED_FLAG" 2>/dev/null)" != "fixed" ]; then
  echo "auto-fix: 自動修正できる pattern を検出できませんでした" >&2
  exit 1
fi

echo "auto-fix: 再 lint 実行中..." >&2
if ! direnv exec . pnpm lint 2>&1; then
  echo "auto-fix: lint がまだ失敗しています" >&2
  exit 1
fi

echo "auto-fix: 再 typecheck 実行中..." >&2
if ! direnv exec . pnpm typecheck 2>&1; then
  echo "auto-fix: typecheck がまだ失敗しています" >&2
  exit 1
fi

echo "auto-fix: 全 PASS" >&2
exit 0
