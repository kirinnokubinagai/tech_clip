#!/usr/bin/env bash
# cleanup-e2e-artifacts.sh: E2E 実行で生成される一時ファイルを削除する
set -euo pipefail

REPO_ROOT="$(git -C "$(dirname "${BASH_SOURCE[0]}")" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)"

CLEAN_TMP=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --tmp) CLEAN_TMP=1; shift ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

removed=0
for f in \
  "${REPO_ROOT}/.claude/.e2e-debug.json" \
  "${REPO_ROOT}/.claude/.e2e-progress.json" \
  "${REPO_ROOT}/.claude/.e2e-debug-shard"*.json \
; do
  if [ -f "$f" ]; then
    rm -f "$f"
    removed=$((removed + 1))
  fi
done
echo "[cleanup] removed $removed e2e artifact(s) from .claude/" >&2

if [ "$CLEAN_TMP" -eq 1 ]; then
  tmp_removed=0
  for pattern in "/tmp/maestro-log-"* "/tmp/maestro-result-"* "/tmp/maestro-debug-"*; do
    for f in $pattern; do
      [ -e "$f" ] || continue
      rm -rf "$f"
      tmp_removed=$((tmp_removed + 1))
    done
  done
  echo "[cleanup] removed $tmp_removed maestro temp file(s) from /tmp/" >&2
fi
