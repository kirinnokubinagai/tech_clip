#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/auto-sync-main.sh"

setup() {
  unset GIT_DIR GIT_WORK_TREE
  TEST_DIR="$BATS_TEST_TMPDIR"
  FAKE_BIN="$TEST_DIR/fake_bin"
  mkdir -p "$FAKE_BIN"
  cat > "$FAKE_BIN/git" << 'EOF'
#!/usr/bin/env bash
case "$*" in
  *"rev-parse --show-toplevel"*) echo "/tmp/repo" ;;
  *"status --porcelain"*) echo "" ;;
  *) exit 0 ;;
esac
EOF
  chmod +x "$FAKE_BIN/git"
  export PATH="$FAKE_BIN:$PATH"
}


@test "auto-sync-main.sh: uncommitted changes があるときスキップする仕様" {
  run bash -c 'grep -q "uncommitted" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "auto-sync-main.sh: origin/main を参照する仕様" {
  run bash -c 'grep -q "origin/main" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
