#!/usr/bin/env bash
# レビュー前事前チェック（lint/typecheck/test）
# 使用方法: WORKTREE=<path> bash scripts/skills/pre-check.sh
# 終了コード: 0=全件PASS, 1=lint失敗, 2=typecheck失敗, 3=test失敗
# 失敗時はエラー内容を stdout に出力する
set -uo pipefail

WORKTREE="${WORKTREE:?WORKTREE is required}"

echo "=== lint ==="
if ! LINT_OUT=$(cd "$WORKTREE" && direnv exec "$WORKTREE" pnpm lint 2>&1); then
  echo "FAIL:lint"
  echo "$LINT_OUT"
  exit 1
fi
if echo "$LINT_OUT" | grep -qE 'error|✘'; then
  echo "FAIL:lint"
  echo "$LINT_OUT"
  exit 1
fi
echo "PASS:lint"

echo "=== typecheck ==="
if ! TC_OUT=$(cd "$WORKTREE" && direnv exec "$WORKTREE" pnpm typecheck 2>&1); then
  echo "FAIL:typecheck"
  echo "$TC_OUT"
  exit 2
fi
if echo "$TC_OUT" | grep -qiE 'error TS|error:'; then
  echo "FAIL:typecheck"
  echo "$TC_OUT"
  exit 2
fi
echo "PASS:typecheck"

echo "=== test ==="
if ! TEST_OUT=$(cd "$WORKTREE" && direnv exec "$WORKTREE" pnpm test 2>&1); then
  echo "FAIL:test"
  echo "$TEST_OUT"
  exit 3
fi
echo "PASS:test"

echo "OK:all_passed"
exit 0
