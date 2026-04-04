#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
command_text="${1:-}"

if [[ -z "$command_text" ]]; then
  echo "usage: ./.codex/run-pre-command.sh '<command>'" >&2
  exit 1
fi

bash "$repo_root/.claude/hooks/secret-guard.sh" "$command_text"
bash "$repo_root/.claude/hooks/dangerous-command-guard.sh" "$command_text"
