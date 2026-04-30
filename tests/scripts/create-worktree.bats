#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/create-worktree.sh"

@test "create-worktree.sh: 引数なしでエラー終了する" {
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "create-worktree.sh: issue-number が数値でないとエラー終了する" {
  run bash "$SCRIPT" "abc" "desc"
  [ "$status" -ne 0 ]
}

@test "create-worktree.sh: usage メッセージを持つ仕様" {
  run bash "$SCRIPT"
  [[ "$output" == *"usage"* ]] || [[ "$output" == *"Usage"* ]] || [[ "$output" == *"issue-number"* ]]
}

@test "create-worktree.sh: origin/stage が存在するときは origin/stage を base にすること" {
  FAKE_BIN="$BATS_TEST_TMPDIR/fake_bin_stage"
  mkdir -p "$FAKE_BIN"
  mkdir -p "$BATS_TEST_TMPDIR/fake_repo/.git"

  cat > "$FAKE_BIN/git" << 'EOF'
#!/usr/bin/env bash
if [[ "$*" == *"ls-remote"*"stage"* ]]; then
  echo "abc123	refs/heads/stage"
  exit 0
fi
if [[ "$*" == *"rev-parse --git-common-dir"* ]]; then
  printf '%s' "${BATS_TEST_TMPDIR}/fake_repo/.git"
  exit 0
fi
if [[ "$*" == *"worktree add"* ]]; then
  echo "$@" >> "${BATS_TEST_TMPDIR}/git_worktree_args.txt"
  exit 0
fi
exit 0
EOF
  chmod +x "$FAKE_BIN/git"

  cat > "$FAKE_BIN/pnpm" << 'EOF'
#!/usr/bin/env bash
exit 0
EOF
  chmod +x "$FAKE_BIN/pnpm"

  PATH="$FAKE_BIN:$PATH" run bash "$SCRIPT" "9999" "test-stage-base"

  [ -f "$BATS_TEST_TMPDIR/git_worktree_args.txt" ]
  grep -q "origin/stage" "$BATS_TEST_TMPDIR/git_worktree_args.txt"
}

@test "create-worktree.sh: origin/stage が存在しないときは origin/main にフォールバックすること" {
  FAKE_BIN="$BATS_TEST_TMPDIR/fake_bin_main"
  mkdir -p "$FAKE_BIN"
  mkdir -p "$BATS_TEST_TMPDIR/fake_repo2/.git"

  cat > "$FAKE_BIN/git" << 'EOF'
#!/usr/bin/env bash
if [[ "$*" == *"ls-remote"*"stage"* ]]; then
  exit 1
fi
if [[ "$*" == *"rev-parse --git-common-dir"* ]]; then
  printf '%s' "${BATS_TEST_TMPDIR}/fake_repo2/.git"
  exit 0
fi
if [[ "$*" == *"worktree add"* ]]; then
  echo "$@" >> "${BATS_TEST_TMPDIR}/git_worktree_args2.txt"
  exit 0
fi
exit 0
EOF
  chmod +x "$FAKE_BIN/git"

  cat > "$FAKE_BIN/pnpm" << 'EOF'
#!/usr/bin/env bash
exit 0
EOF
  chmod +x "$FAKE_BIN/pnpm"

  PATH="$FAKE_BIN:$PATH" run bash "$SCRIPT" "9998" "test-main-fallback"

  [ -f "$BATS_TEST_TMPDIR/git_worktree_args2.txt" ]
  grep -q "origin/main" "$BATS_TEST_TMPDIR/git_worktree_args2.txt"
}
