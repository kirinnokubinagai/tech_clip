#!/usr/bin/env bash
# check-nix-hermetic.sh
# nix devShell 内で全 tool が /nix/store から来ていることを検証する。
# 用途: pnpm check:nix-hermetic / CI での hermetic 検証

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=./lib/nix.sh
source "${SCRIPT_DIR}/lib/nix.sh"
ensure_nix_shell "${REPO_ROOT}" "$@"

FAIL=0

sanitize_nix_tool_path

# 検証対象コマンド一覧
CMDS=(turso sqld adb sqlite3 maestro zap turbo biome node pnpm)

for cmd in "${CMDS[@]}"; do
  path="$(resolve_preferred_command "$cmd" || echo "NOT_FOUND")"
  printf "%-12s %s\n" "$cmd:" "$path"
  case "$path" in
    /nix/store/*) ;;
    NOT_FOUND)
      # maestro は platform によっては optional
      if [ "$cmd" = "maestro" ]; then
        printf "  [SKIP] maestro は optional\n"
      else
        printf "  [FAIL] コマンドが見つかりません\n"
        FAIL=1
      fi
      ;;
    *)
      printf "  [FAIL] expected /nix/store/*, got %s\n" "$path"
      FAIL=1
      ;;
  esac
done

echo ""
if [ "$FAIL" = "0" ]; then
  echo "All hermetic OK"
else
  echo "NOT hermetic - 上記の [FAIL] を修正してください"
  exit 1
fi
