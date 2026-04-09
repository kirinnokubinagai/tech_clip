#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -eq 0 ]; then
  echo "usage: $0 <command> [args...]" >&2
  exit 1
fi

stderr_file="$(mktemp)"
filtered_stderr_file="$(mktemp)"
cleanup() {
  rm -f "$stderr_file"
  rm -f "$filtered_stderr_file"
}
trap cleanup EXIT

"$@" 2>"$stderr_file" || command_exit_code=$?
: "${command_exit_code:=0}"

if [ -s "$stderr_file" ]; then
  cat "$stderr_file" >&2
fi

grep -vE \
  '^\(node:[0-9]+\) \[DEP0169\] DeprecationWarning:' \
  "$stderr_file" \
  | grep -vE '^\(Use .*trace-deprecation.*' \
  >"$filtered_stderr_file" || true

if [ "$command_exit_code" -ne 0 ]; then
  exit "$command_exit_code"
fi

if [ -s "$filtered_stderr_file" ]; then
  if [ "${TECH_CLIP_ALLOW_TEST_STDERR:-0}" = "1" ]; then
    echo "stderr が検出されたが TECH_CLIP_ALLOW_TEST_STDERR=1 のため続行します。" >&2
    exit 0
  fi

  echo "stderr が検出されたため失敗扱いにします。" >&2
  echo "内容を確認して問題ない場合は TECH_CLIP_ALLOW_TEST_STDERR=1 を付けて再実行してください。" >&2
  exit 1
fi
