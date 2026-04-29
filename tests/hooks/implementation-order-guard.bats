#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/implementation-order-guard.sh"

setup() {
  TEST_DIR=$(mktemp -d)
  FAKE_BIN="$TEST_DIR/fake_bin"
  mkdir -p "$FAKE_BIN"
  cat > "$FAKE_BIN/git" << 'EOF'
#!/usr/bin/env bash
if [[ "$*" == *"branch --show-current"* ]]; then
  echo "main"
fi
EOF
  chmod +x "$FAKE_BIN/git"
  export PATH="$FAKE_BIN:$PATH"
}

teardown() { rm -rf "$TEST_DIR"; }

@test "implementation-order-guard.sh: Issue 番号のないブランチではスキップする仕様" {
  run bash "$SCRIPT"
  [ "$status" -eq 0 ]
}

@test "implementation-order-guard.sh: PHASE 定義を持つ仕様" {
  run bash -c 'grep -q "PHASE" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
