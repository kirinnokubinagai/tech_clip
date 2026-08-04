#!/usr/bin/env bats

ROOT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)"
UNCACHED_WORKFLOW="$ROOT/.github/workflows/verify-uncached.yml"
CI_WORKFLOW="$ROOT/.github/workflows/ci.yml"
PRE_PUSH="$ROOT/.husky/pre-push"
HTTP_TEST="$ROOT/tests/api/integration/search-http-local-turso.test.ts"
FTS_TEST="$ROOT/tests/api/integration/search-fts-local-turso.test.ts"

@test "Verify uncached: local Turso を検証より先に起動する" {
  run bash -c '
    start=$(grep -n -m 1 "scripts/ci/start-turso.sh" "$1" | cut -d: -f1)
    verify=$(grep -n -m 1 "pnpm verify:uncached" "$1" | cut -d: -f1)
    [ -n "$start" ] && [ -n "$verify" ] && [ "$start" -lt "$verify" ]
  ' _ "$UNCACHED_WORKFLOW"
  [ "$status" -eq 0 ]
}

@test "Verify uncached: local Turso を必須化して silent skip を禁止する" {
  run grep -q 'TECH_CLIP_REQUIRE_LOCAL_TURSO: "1"' "$UNCACHED_WORKFLOW"
  [ "$status" -eq 0 ]

  run grep -q "TECH_CLIP_REQUIRE_LOCAL_TURSO" "$HTTP_TEST"
  [ "$status" -eq 0 ]
  run grep -q 'if (REQUIRE_LOCAL_TURSO)' "$HTTP_TEST"
  [ "$status" -eq 0 ]

  run grep -q "TECH_CLIP_REQUIRE_LOCAL_TURSO" "$FTS_TEST"
  [ "$status" -eq 0 ]
  run grep -q 'if (REQUIRE_LOCAL_TURSO)' "$FTS_TEST"
  [ "$status" -eq 0 ]
}

@test "通常 CI: local Turso をテストより先に起動する" {
  run bash -c '
    start=$(grep -n -m 1 "scripts/ci/start-turso.sh" "$1" | cut -d: -f1)
    test_step=$(grep -n -m 1 "pnpm test" "$1" | cut -d: -f1)
    [ -n "$start" ] && [ -n "$test_step" ] && [ "$start" -lt "$test_step" ]
  ' _ "$CI_WORKFLOW"
  [ "$status" -eq 0 ]
}

@test "通常 CI: テスト終了コードを使い stderr の有無では判定しない" {
  run grep -q "run-and-fail-on-stderr" "$CI_WORKFLOW"
  [ "$status" -ne 0 ]

  run grep -q "run-and-fail-on-stderr" "$PRE_PUSH"
  [ "$status" -ne 0 ]

  run grep -q 'TECH_CLIP_REQUIRE_LOCAL_TURSO: "1"' "$CI_WORKFLOW"
  [ "$status" -eq 0 ]
}
