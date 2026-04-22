#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=./lib/nix.sh
source "${SCRIPT_DIR}/lib/nix.sh"
ensure_nix_shell "${REPO_ROOT}" "$@"
sanitize_nix_tool_path

if [ "${#}" -eq 0 ]; then
  echo "Usage: bash scripts/run-hermetic.sh <command> [args...]" >&2
  exit 2
fi

exec "$@"
