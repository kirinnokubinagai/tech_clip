#!/usr/bin/env bats
# direnv-allow-guard.sh のテスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/direnv-allow-guard.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/direnv-allow-guard.sh"

setup() {
    unset GIT_DIR GIT_WORK_TREE
    TMPDIR="$BATS_TEST_TMPDIR"
    REPO_DIR="$TMPDIR/repo"
    FAKE_BIN="$TMPDIR/bin"

    mkdir -p "$REPO_DIR" "$FAKE_BIN"
    git -C "$REPO_DIR" init -b main >/dev/null
    git -C "$REPO_DIR" config user.email "test@example.com"
    git -C "$REPO_DIR" config user.name "Test User"
    echo "use flake" > "$REPO_DIR/.envrc"
    echo "initial" > "$REPO_DIR/file.txt"
    git -C "$REPO_DIR" add .
    git -C "$REPO_DIR" commit -m "initial commit" >/dev/null

    cat > "$FAKE_BIN/direnv" <<'EOF'
#!/bin/bash
if [ "$1" = "exec" ]; then
  if [ -f "${DIR_ENV_TEST_ALLOW_FILE}" ]; then
    exit 0
  fi
  echo "direnv: error .envrc is blocked" >&2
  exit 1
fi
if [ "$1" = "allow" ]; then
  touch "${DIR_ENV_TEST_ALLOW_FILE}"
  exit 0
fi
exit 0
EOF
    chmod +x "$FAKE_BIN/direnv"

    ALLOW_FILE="$TMPDIR/allow-ok"
}

# stdin でフックを実行するヘルパー
run_hook() {
    local cmd="$1"
    (
      export PATH="$FAKE_BIN:$PATH"
      export DIR_ENV_TEST_ALLOW_FILE="$ALLOW_FILE"
      cd "$REPO_DIR"
      echo "{\"tool_input\":{\"command\":\"$cmd\"}}" | bash "$SCRIPT"
    )
}

@test "blocked な .envrc で pnpm を実行しようとすると拒否する" {
    run run_hook "pnpm test"
    [ "$status" -eq 2 ]
    [[ "$output" == *"direnv allow"* ]]
}

@test "blocked な .envrc で direnv exec を実行しようとすると拒否する" {
    run run_hook "direnv exec . pnpm test"
    [ "$status" -eq 2 ]
    [[ "$output" == *"direnv allow"* ]]
}

@test "direnv allow 自体は拒否しない" {
    run run_hook "direnv allow ."
    [ "$status" -eq 0 ]
}

@test "git status のような env 非依存コマンドは拒否しない" {
    run run_hook "git status --short"
    [ "$status" -eq 0 ]
}

@test "allow 済みなら pnpm 実行を拒否しない" {
    touch "$ALLOW_FILE"
    run run_hook "pnpm test"
    [ "$status" -eq 0 ]
}

@test "stdin が空の場合はスキップされること" {
    run bash -c "(export PATH='$FAKE_BIN:$PATH' DIR_ENV_TEST_ALLOW_FILE='$ALLOW_FILE'; echo '' | bash '$SCRIPT')"
    [ "$status" -eq 0 ]
}

@test "stdinにJSONを渡すとblocked .envrc でブロックされること（stdin ルーティング確認）" {
    # Act: stdin に tool_input.command を含む正しい JSON を渡す（$ARGUMENTS が空でも機能する）
    run bash -c "(export PATH='$FAKE_BIN:$PATH' DIR_ENV_TEST_ALLOW_FILE='$ALLOW_FILE'; echo '{\"tool_input\":{\"command\":\"pnpm test\"}}' | (cd '$REPO_DIR' && bash '$SCRIPT'))"

    # Assert: direnv allow 未完了でブロックされること
    [ "$status" -eq 2 ]
    [[ "$output" == *"direnv allow"* ]]
}
