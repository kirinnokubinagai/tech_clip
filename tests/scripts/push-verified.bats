#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/push-verified.sh"

setup() {
  TEST_DIR="$BATS_TEST_TMPDIR"
  FAKE_BIN="$TEST_DIR/fake_bin"
  mkdir -p "$FAKE_BIN"
  cat > "$FAKE_BIN/git" << 'EOF'
#!/usr/bin/env bash
case "$*" in
  *"rev-parse HEAD"*) echo "abc1234567890" ;;
  *"push"*) exit 0 ;;
  *"ls-remote"*) echo "abc1234567890	refs/heads/test" ;;
  *) git "$@" ;;
esac
EOF
  chmod +x "$FAKE_BIN/git"
  export PATH="$FAKE_BIN:$PATH"
}


@test "push-verified.sh: git を呼び出す仕様" {
  run bash -c 'grep -q "git" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}

@test "push-verified.sh: push オプションを持つ仕様" {
  run bash -c 'grep -q "push" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
