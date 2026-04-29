#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/worktree-isolation-guard.sh"

setup() {
  TEST_DIR=$(mktemp -d)
  FAKE_BIN="$TEST_DIR/fake_bin"
  mkdir -p "$FAKE_BIN"
  cat > "$FAKE_BIN/git" << 'EOF'
#!/usr/bin/env bash
if [[ "$*" == *"branch --show-current"* ]]; then
  echo "feature/test"
fi
exit 0
EOF
  chmod +x "$FAKE_BIN/git"
  export PATH="$FAKE_BIN:$PATH"
}

teardown() { rm -rf "$TEST_DIR"; }

@test "worktree-isolation-guard.sh: main 以外のブランチでは exit 0" {
  run bash "$SCRIPT" <<< '{}'
  [ "$status" -eq 0 ]
}

@test "worktree-isolation-guard.sh: main ブランチを参照する仕様" {
  run bash -c 'grep -q "main" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
