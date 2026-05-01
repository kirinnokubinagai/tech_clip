#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/skills/push-and-pr.sh"

setup() {
  FAKE_BIN="$BATS_TEST_TMPDIR/fake_bin"
  mkdir -p "$FAKE_BIN"

  # fake git: rev-parse HEAD returns dummy sha, rev-parse --abbrev-ref HEAD を制御
  cat > "$FAKE_BIN/git" << 'EOF'
#!/usr/bin/env bash
if [[ "$*" == *"rev-parse HEAD"* ]]; then
  echo "deadbeef1234567890"
  exit 0
fi
if [[ "$*" == *"rev-parse --abbrev-ref HEAD"* ]]; then
  echo "${FAKE_BRANCH:-issue/9999/test-feature}"
  exit 0
fi
exit 0
EOF
  chmod +x "$FAKE_BIN/git"

  # fake gh: pr list returns empty (= new PR), pr create records args, pr view returns sha
  cat > "$FAKE_BIN/gh" << 'EOF'
#!/usr/bin/env bash
if [[ "$*" == *"pr list"* ]]; then
  echo ""
  exit 0
fi
if [[ "$*" == *"pr create"* ]]; then
  echo "$@" >> "${BATS_TEST_TMPDIR}/gh_pr_create_args.txt"
  echo "https://github.com/owner/repo/pull/1"
  exit 0
fi
if [[ "$*" == *"pr view"* && "$*" == *"number"* ]]; then
  echo "1"
  exit 0
fi
if [[ "$*" == *"pr view"* && "$*" == *"headRefOid"* ]]; then
  echo "deadbeef1234567890"
  exit 0
fi
if [[ "$*" == *"issue view"* ]]; then
  echo "fix: test issue"
  exit 0
fi
exit 0
EOF
  chmod +x "$FAKE_BIN/gh"

  # fake push-verified.sh: always succeed
  mkdir -p "$BATS_TEST_TMPDIR/worktree/scripts"
  cat > "$BATS_TEST_TMPDIR/worktree/scripts/push-verified.sh" << 'EOF'
#!/usr/bin/env bash
exit 0
EOF
  chmod +x "$BATS_TEST_TMPDIR/worktree/scripts/push-verified.sh"

  export PATH="$FAKE_BIN:$PATH"
  export WORKTREE="$BATS_TEST_TMPDIR/worktree"
  export ISSUE_NUMBER="9999"
  export PR_TITLE="test PR title"
}

@test "push-and-pr.sh: issue/* branch のとき --base stage が gh pr create に渡ること" {
  export FAKE_BRANCH="issue/9999/test-feature"

  run bash "$SCRIPT"

  [ -f "$BATS_TEST_TMPDIR/gh_pr_create_args.txt" ]
  grep -q -- "--base stage" "$BATS_TEST_TMPDIR/gh_pr_create_args.txt"
}

@test "push-and-pr.sh: stage branch のとき --base main が gh pr create に渡ること" {
  export FAKE_BRANCH="stage"
  # 別の記録ファイルを使う
  rm -f "$BATS_TEST_TMPDIR/gh_pr_create_args.txt"

  run bash "$SCRIPT"

  [ -f "$BATS_TEST_TMPDIR/gh_pr_create_args.txt" ]
  grep -q -- "--base main" "$BATS_TEST_TMPDIR/gh_pr_create_args.txt"
}
