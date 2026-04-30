#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/ci/shard-flows.sh"

setup() {
  TEST_DIR="$BATS_TEST_TMPDIR"
  FAKE_BIN="$TEST_DIR/fake_bin"
  mkdir -p "$FAKE_BIN"
  cat > "$FAKE_BIN/git" << 'EOF'
#!/usr/bin/env bash
if [[ "$*" == *"rev-parse"* ]]; then
  echo "/tmp/repo-root"
fi
EOF
  chmod +x "$FAKE_BIN/git"
  export PATH="$FAKE_BIN:$PATH"
}


@test "shard-flows.sh: 引数なしでエラー終了する" {
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "shard-flows.sh: --shard オプションを持つ仕様" {
  run bash -c 'grep -q "\-\-shard" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
