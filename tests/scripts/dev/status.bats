#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/dev/status.sh"

setup() {
  TEST_DIR="$BATS_TEST_TMPDIR"
  FAKE_BIN="$TEST_DIR/fake_bin"
  mkdir -p "$FAKE_BIN"
  cat > "$FAKE_BIN/lsof" << 'EOF'
#!/usr/bin/env bash
exit 1
EOF
  chmod +x "$FAKE_BIN/lsof"
  export PATH="$FAKE_BIN:$PATH"
}


@test "status.sh: サービス状態を出力する仕様" {
  run bash "$SCRIPT"
  [ "$status" -eq 0 ]
  [[ "$output" == *"turso"* ]] || [[ "$output" == *"Service"* ]]
}
