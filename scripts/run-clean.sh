#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/run-clean.sh [--tail N] -- <command> [args...]

Examples:
  scripts/run-clean.sh -- pnpm test
  scripts/run-clean.sh --tail 50 -- pnpm test
EOF
}

tail_lines=0

while (($# > 0)); do
  case "$1" in
    --tail)
      if (($# < 2)); then
        usage >&2
        exit 1
      fi
      tail_lines="$2"
      shift 2
      ;;
    --)
      shift
      break
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 1
      ;;
  esac
done

if (($# == 0)); then
  usage >&2
  exit 1
fi

tmp_log="$(mktemp "${TMPDIR:-/tmp}/run-clean.XXXXXX.log")"
status=0

if ! "$@" >"$tmp_log" 2>&1; then
  status=$?
fi

if ((tail_lines > 0)); then
  tail -n "$tail_lines" "$tmp_log"
else
  cat "$tmp_log"
fi

rm -f "$tmp_log"

exit "$status"
