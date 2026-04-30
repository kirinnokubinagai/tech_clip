#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/ci/verify-branch-protection.sh"

setup() {
  FAKE_BIN="$BATS_TEST_TMPDIR/fake_bin"
  mkdir -p "$FAKE_BIN"

  # fake gh repo view
  cat > "$FAKE_BIN/gh" << 'EOF'
#!/usr/bin/env bash
echo "${GH_MOCK_OUTPUT:-[]}"
exit "${GH_MOCK_EXIT:-0}"
EOF
  chmod +x "$FAKE_BIN/gh"

  export PATH="$FAKE_BIN:$PATH"
  export GITHUB_REPOSITORY="owner/test-repo"
}

@test "verify-branch-protection.sh: main と stage 両方に ruleset があるとき OK を返すこと" {
  export GH_MOCK_OUTPUT='[{"name":"main-protection","conditions":{"ref_name":{"include":["refs/heads/main"]}}},{"name":"stage-protection","conditions":{"ref_name":{"include":["refs/heads/stage"]}}}]'

  run bash "$SCRIPT"

  [ "$status" -eq 0 ]
  [[ "$output" == *"OK: main and stage rulesets present"* ]]
}

@test "verify-branch-protection.sh: stage の ruleset が欠落しているとき ERROR を返すこと" {
  export GH_MOCK_OUTPUT='[{"name":"main-protection","conditions":{"ref_name":{"include":["refs/heads/main"]}}}]'

  run bash "$SCRIPT"

  [ "$status" -ne 0 ]
  [[ "$output" == *"ERROR"*"stage"* ]]
}

@test "verify-branch-protection.sh: main と stage 両方の ruleset が欠落しているとき ERROR を返すこと" {
  export GH_MOCK_OUTPUT='[]'

  run bash "$SCRIPT"

  [ "$status" -ne 0 ]
  [[ "$output" == *"ERROR"* ]]
}
