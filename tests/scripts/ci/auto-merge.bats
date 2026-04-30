#!/usr/bin/env bats
# Tests for scripts/ci/auto-merge.sh

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/ci/auto-merge.sh"
STUB_SRC="$(dirname "$BATS_TEST_FILENAME")/fixtures/gh-stub.sh"

setup() {
  export GH_CALLS_LOG="$BATS_TEST_TMPDIR/gh-calls.log"
  export GH_FIXTURE_FILE="$BATS_TEST_TMPDIR/gh-fixture"
  : > "$GH_CALLS_LOG"
  STUB_DIR="$BATS_TEST_TMPDIR/bin"
  mkdir -p "$STUB_DIR"
  cp "$STUB_SRC" "$STUB_DIR/gh"
  chmod +x "$STUB_DIR/gh"
  export PATH="$STUB_DIR:$PATH"
  export GH_TOKEN=dummy
  export PR_NUMBER=1234
  export REPO=owner/repo
}

# T1: mergeStateStatus=CLEAN → direct merge を 1 回呼ぶ、exit 0
@test "T1: mergeStateStatus が CLEAN のとき direct merge を 1 回呼んで exit 0 になること" {
  # Arrange
  echo '{"state":"OPEN","mergeStateStatus":"CLEAN","autoMergeRequest":null,"isDraft":false}' \
    > "${GH_FIXTURE_FILE}.view"
  # direct merge succeeds: exit 0 (default)

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  merge_count=$(cat "${GH_FIXTURE_FILE}.merge.count" 2>/dev/null || echo 0)
  [ "$merge_count" -eq 1 ]
  # --auto should NOT be in the merge call
  ! grep -q -- "--auto" "$GH_CALLS_LOG"
}

# T2: mergeStateStatus=UNKNOWN → auto オプション試行 → enable 確認、exit 0
@test "T2: mergeStateStatus が UNKNOWN のとき auto enable を試行して exit 0 になること" {
  # Arrange
  echo '{"state":"OPEN","mergeStateStatus":"UNKNOWN","autoMergeRequest":null,"isDraft":false}' \
    > "${GH_FIXTURE_FILE}.view"
  # After first merge attempt (auto enable), view returns autoMergeRequest set
  echo '{"state":"OPEN","mergeStateStatus":"UNKNOWN","autoMergeRequest":{"enabledAt":"2024-01-01"},"isDraft":false}' \
    > "${GH_FIXTURE_FILE}.view.after_merge_1"

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  grep -q -- "--auto" "$GH_CALLS_LOG"
}

# T3: mergeStateStatus=BLOCKED → auto オプション試行 → enable 確認、exit 0
@test "T3: mergeStateStatus が BLOCKED のとき auto enable を試行して exit 0 になること" {
  # Arrange
  echo '{"state":"OPEN","mergeStateStatus":"BLOCKED","autoMergeRequest":null,"isDraft":false}' \
    > "${GH_FIXTURE_FILE}.view"
  # After first merge attempt, autoMergeRequest is set
  echo '{"state":"OPEN","mergeStateStatus":"BLOCKED","autoMergeRequest":{"enabledAt":"2024-01-01"},"isDraft":false}' \
    > "${GH_FIXTURE_FILE}.view.after_merge_1"

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  grep -q -- "--auto" "$GH_CALLS_LOG"
}

# T4: autoMergeRequest already set → skip (既に enable 済み)、exit 0
@test "T4: autoMergeRequest が既に設定済みのとき skip して exit 0 になること" {
  # Arrange
  echo '{"state":"OPEN","mergeStateStatus":"UNKNOWN","autoMergeRequest":{"enabledAt":"2024-01-01"},"isDraft":false}' \
    > "${GH_FIXTURE_FILE}.view"

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  merge_count=$(cat "${GH_FIXTURE_FILE}.merge.count" 2>/dev/null || echo 0)
  [ "$merge_count" -eq 0 ]
}

# T5: state=MERGED → skip (既に merged)、exit 0
@test "T5: state が MERGED のとき skip して exit 0 になること" {
  # Arrange
  echo '{"state":"MERGED","mergeStateStatus":"MERGED","autoMergeRequest":null,"isDraft":false}' \
    > "${GH_FIXTURE_FILE}.view"

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  merge_count=$(cat "${GH_FIXTURE_FILE}.merge.count" 2>/dev/null || echo 0)
  [ "$merge_count" -eq 0 ]
}

# T6: state=CLOSED → skip、exit 0
@test "T6: state が CLOSED のとき skip して exit 0 になること" {
  # Arrange
  echo '{"state":"CLOSED","mergeStateStatus":"","autoMergeRequest":null,"isDraft":false}' \
    > "${GH_FIXTURE_FILE}.view"

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  merge_count=$(cat "${GH_FIXTURE_FILE}.merge.count" 2>/dev/null || echo 0)
  [ "$merge_count" -eq 0 ]
}

# T7: isDraft=true → skip (draft)、exit 0
@test "T7: isDraft が true のとき skip して exit 0 になること" {
  # Arrange
  echo '{"state":"OPEN","mergeStateStatus":"UNKNOWN","autoMergeRequest":null,"isDraft":true}' \
    > "${GH_FIXTURE_FILE}.view"

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  merge_count=$(cat "${GH_FIXTURE_FILE}.merge.count" 2>/dev/null || echo 0)
  [ "$merge_count" -eq 0 ]
}

# T8: enable を 3 回試行しても autoMerge=null → exit 1
@test "T8: 3 回 retry しても auto-merge enable 失敗のとき exit 1 になること" {
  # Arrange: view always returns autoMergeRequest=null
  echo '{"state":"OPEN","mergeStateStatus":"UNKNOWN","autoMergeRequest":null,"isDraft":false}' \
    > "${GH_FIXTURE_FILE}.view"
  # Override RETRY_DELAY_SECONDS for speed
  export AUTO_MERGE_RETRY_DELAY_BASE=0

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 1 ]
  merge_count=$(cat "${GH_FIXTURE_FILE}.merge.count" 2>/dev/null || echo 0)
  [ "$merge_count" -eq 3 ]
}

# T9: direct merge 失敗 → fallback で auto オプション試行、最終的に enable 成功なら exit 0
@test "T9: direct merge が失敗したとき fallback で auto enable を試行して exit 0 になること" {
  # Arrange
  echo '{"state":"OPEN","mergeStateStatus":"CLEAN","autoMergeRequest":null,"isDraft":false}' \
    > "${GH_FIXTURE_FILE}.view"
  # direct merge fails (exit 1)
  echo "1" > "${GH_FIXTURE_FILE}.merge.1.exit"
  # fallback auto enable succeeds: after 2nd merge call, autoMergeRequest is set
  echo '{"state":"OPEN","mergeStateStatus":"CLEAN","autoMergeRequest":{"enabledAt":"2024-01-01"},"isDraft":false}' \
    > "${GH_FIXTURE_FILE}.view.after_merge_2"

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  # Both direct and auto merge should have been attempted
  merge_count=$(cat "${GH_FIXTURE_FILE}.merge.count" 2>/dev/null || echo 0)
  [ "$merge_count" -ge 2 ]
  grep -q -- "--auto" "$GH_CALLS_LOG"
}
