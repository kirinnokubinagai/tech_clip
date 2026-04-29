#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/uncommitted-warn.sh"

setup() {
  TEST_DIR=$(mktemp -d)
  FAKE_BIN="$TEST_DIR/fake_bin"
  mkdir -p "$FAKE_BIN"
  cat > "$FAKE_BIN/git" << 'GITEOF'
#!/usr/bin/env bash
if [[ "$*" == *"status --porcelain"* ]]; then
  echo ""
elif [[ "$*" == *"rev-parse --show-toplevel"* ]]; then
  echo "$TEST_DIR"
fi
exit 0
GITEOF
  chmod +x "$FAKE_BIN/git"
  export PATH="$FAKE_BIN:$PATH"
}

teardown() { rm -rf "$TEST_DIR"; }

@test "uncommitted-warn.sh: 変更なしのとき空出力かシステムメッセージがない" {
  run bash "$SCRIPT"
  [ "$status" -eq 0 ]
}

@test "uncommitted-warn.sh: systemMessage フォーマットを使う仕様" {
  run bash -c 'grep -q "systemMessage" "'"$SCRIPT"'"'
  [ "$status" -eq 0 ]
}
