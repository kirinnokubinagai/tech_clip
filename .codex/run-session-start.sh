#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"

bash "$repo_root/.claude/hooks/session-start.sh"
bash "$repo_root/.claude/hooks/check-worktrees.sh"
bash "$repo_root/.claude/hooks/implementation-order-guard.sh"
