#!/usr/bin/env bats
# Tests for scripts/ci/check-claude-review-needs-work.sh

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/ci/check-claude-review-needs-work.sh"

setup() {
  export GH_CALLS_LOG="$BATS_TEST_TMPDIR/gh-calls.log"
  : > "$GH_CALLS_LOG"

  STUB_DIR="$BATS_TEST_TMPDIR/bin"
  mkdir -p "$STUB_DIR"

  # Write gh stub that reads labels from a file (avoids word-splitting on spaces)
  cat > "$STUB_DIR/gh" << 'GHSTUB'
#!/usr/bin/env bash
echo "gh $*" >> "${GH_CALLS_LOG:-/dev/null}"
if [[ "${1:-}" == "pr" && "${2:-}" == "view" ]]; then
  exit_code="${GH_STUB_EXIT_CODE:-0}"
  if [ "$exit_code" != "0" ]; then
    exit "$exit_code"
  fi
  # Read labels from file (one per line) to preserve spaces
  labels_file="${GH_STUB_LABELS_FILE:-}"
  if [ -n "$labels_file" ] && [ -f "$labels_file" ]; then
    cat "$labels_file"
  fi
  exit 0
fi
echo "stub: unknown: gh $*" >&2
exit 1
GHSTUB
  chmod +x "$STUB_DIR/gh"
  export PATH="$STUB_DIR:$PATH"

  export GH_TOKEN=dummy
  export PR_NUMBER=42
  export REPO=owner/repo
  export GITHUB_OUTPUT="$BATS_TEST_TMPDIR/github_output"
  : > "$GITHUB_OUTPUT"
  export GH_STUB_LABELS_FILE="$BATS_TEST_TMPDIR/labels.txt"
  : > "$GH_STUB_LABELS_FILE"

  # defaults: pull_request event, review success
  export EVENT_NAME=pull_request
  export REVIEW_OUTCOME=success
  unset GH_STUB_EXIT_CODE
}

# ── T1: push イベントは needs_work=false ──────────────────────────────────────
@test "push イベントは needs_work=false (既存挙動)" {
  # Arrange
  export EVENT_NAME=push
  export REVIEW_OUTCOME=skipped

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "needs_work=false"
  grep -q "needs_work=false" "$GITHUB_OUTPUT"
}

# ── T2: PR + review success + PASS ラベル → needs_work=false ─────────────────
@test "PR + review success + AI Review: PASS ラベル → needs_work=false" {
  # Arrange
  echo "AI Review: PASS" > "$GH_STUB_LABELS_FILE"

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "needs_work=false"
  grep -q "needs_work=false" "$GITHUB_OUTPUT"
}

# ── T3: PR + review success + NEEDS WORK ラベル → needs_work=true ────────────
@test "PR + review success + AI Review: NEEDS WORK ラベル → needs_work=true" {
  # Arrange
  echo "AI Review: NEEDS WORK" > "$GH_STUB_LABELS_FILE"

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "needs_work=true"
  grep -q "needs_work=true" "$GITHUB_OUTPUT"
}

# ── T4: PR + review failure → needs_work=true (fail-closed) ──────────────────
@test "PR + review failure → needs_work=true (fail-closed)" {
  # Arrange
  export REVIEW_OUTCOME=failure

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "needs_work=true"
  grep -q "needs_work=true" "$GITHUB_OUTPUT"
}

# ── T5: PR + review cancelled → needs_work=true (fail-closed) ────────────────
@test "PR + review cancelled → needs_work=true (fail-closed)" {
  # Arrange
  export REVIEW_OUTCOME=cancelled

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "needs_work=true"
  grep -q "needs_work=true" "$GITHUB_OUTPUT"
}

# ── T6: PR + review skipped → needs_work=true (fail-closed) ──────────────────
@test "PR + review skipped → needs_work=true (fail-closed)" {
  # Arrange
  export REVIEW_OUTCOME=skipped

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "needs_work=true"
  grep -q "needs_work=true" "$GITHUB_OUTPUT"
}

# ── T7: PR + review success + ラベルなし → needs_work=true (guard 強化) ───────
@test "PR + review success + ラベルなし → needs_work=true (fail-closed, guard 強化)" {
  # Arrange: labels file is empty (no labels)

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "needs_work=true"
  grep -q "needs_work=true" "$GITHUB_OUTPUT"
}

# ── T8: PR + review success + 両方のラベル → needs_work=true (NEEDS WORK 優先) ─
@test "PR + review success + 両方のラベルが付いている → needs_work=true (NEEDS WORK 優先)" {
  # Arrange: both labels present
  printf 'AI Review: PASS\nAI Review: NEEDS WORK\n' > "$GH_STUB_LABELS_FILE"

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "needs_work=true"
  grep -q "needs_work=true" "$GITHUB_OUTPUT"
}

# ── T9: PR + review success + gh pr view 失敗 → needs_work=true (fail-closed) ─
@test "PR + review success + gh pr view が失敗 → needs_work=true (fail-closed)" {
  # Arrange
  export GH_STUB_EXIT_CODE=1

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "needs_work=true"
  grep -q "needs_work=true" "$GITHUB_OUTPUT"
}

# ── T10: GITHUB_OUTPUT 未設定でも stdout に出力する ──────────────────────────
@test "GITHUB_OUTPUT 未設定でも stdout に出力する" {
  # Arrange
  unset GITHUB_OUTPUT
  echo "AI Review: PASS" > "$GH_STUB_LABELS_FILE"

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "needs_work=false"
}

# ── T11: GITHUB_OUTPUT 指定時、ファイルに append される ──────────────────────
@test "GITHUB_OUTPUT 指定時、ファイルに append される" {
  # Arrange: pre-existing content in GITHUB_OUTPUT
  echo "other_var=existing" >> "$GITHUB_OUTPUT"
  echo "AI Review: PASS" > "$GH_STUB_LABELS_FILE"

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  grep -q "other_var=existing" "$GITHUB_OUTPUT"
  grep -q "needs_work=false" "$GITHUB_OUTPUT"
}

# ── T12: REVIEW_OUTCOME が未設定の場合も fail-closed になること ───────────────
@test "REVIEW_OUTCOME が未設定の場合も fail-closed になること" {
  # Arrange
  unset REVIEW_OUTCOME

  # Act
  run bash "$SCRIPT"

  # Assert
  [ "$status" -eq 0 ]
  echo "$output" | grep -q "needs_work=true"
  grep -q "needs_work=true" "$GITHUB_OUTPUT"
}
