#!/usr/bin/env bash
# Run EAS through the CLI installed by expo/expo-github-action.
# Never run this through nix develop: the Nix eas-cli package only exposes
# topic help in CI and can exit 0 without starting a build or submit.
set -euo pipefail

if (($# == 0)); then
  echo "usage: $0 <eas-command> [args...]" >&2
  exit 2
fi

if [[ -z "${EXPO_TOKEN:-}" || -z "${EXPO_TOKEN//[[:space:]]/}" ]]; then
  echo "::error::EXPO_TOKEN is required; refusing to run EAS without authentication." >&2
  exit 1
fi

EAS_BIN="$(command -v eas || true)"
if [[ -z "$EAS_BIN" ]]; then
  echo "::error::EAS CLI is not on PATH. expo/expo-github-action must run before this script." >&2
  exit 1
fi

if [[ "$EAS_BIN" == /nix/store/* ]]; then
  echo "::error::Refusing the Nix eas-cli wrapper at $EAS_BIN; use expo-github-action's CLI." >&2
  exit 1
fi

if ! "$EAS_BIN" build --help 2>&1 | grep -q -- "--platform"; then
  echo "::error::The selected EAS CLI does not expose the build command." >&2
  exit 1
fi

if ! "$EAS_BIN" submit --help 2>&1 | grep -q -- "--latest"; then
  echo "::error::The selected EAS CLI does not expose the submit command." >&2
  exit 1
fi

if ! "$EAS_BIN" whoami >/dev/null 2>&1; then
  echo "::error::EAS authentication failed; refusing to continue." >&2
  exit 1
fi

exec "$EAS_BIN" "$@"
