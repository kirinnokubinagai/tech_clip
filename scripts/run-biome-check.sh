#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=./lib/nix.sh
source "${SCRIPT_DIR}/lib/nix.sh"
ensure_nix_shell "${REPO_ROOT}" "$@"
sanitize_nix_tool_path

targets=()
for dir in apps packages tests scripts; do
  if [ -e "$dir" ]; then
    targets+=("$dir")
  fi
done

if [ "${#targets[@]}" -eq 0 ]; then
  echo "Biomeチェック対象ディレクトリが見つかりません。"
  exit 1
fi

biome check "$@" "${targets[@]}"
