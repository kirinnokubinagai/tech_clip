#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail

export NODE_OPTIONS="${NODE_OPTIONS:---no-experimental-strip-types}"

# Sharding (CI matrix で複数 runner に flow を分散させる)
SHARD_INDEX="${SHARD_INDEX:-1}"
SHARD_TOTAL="${SHARD_TOTAL:-1}"
SHARD_SUFFIX=""
if [ "$SHARD_TOTAL" -gt 1 ]; then
  SHARD_SUFFIX="-shard${SHARD_INDEX}of${SHARD_TOTAL}"
fi

mkdir -p screenshots test-results

# Start the API server (Wrangler dev) so the mobile app can reach it at 10.0.2.2:18787
bash scripts/ci/start-api.sh

# Reset DB and seed e2e data before building the app
echo "[e2e] DB リセット + migrate + seed を実行中..."
nix develop --command bash -c 'cd apps/api && export TURSO_DATABASE_URL="${TURSO_DATABASE_URL:-http://127.0.0.1:8888}" && export TURSO_AUTH_TOKEN="${TURSO_AUTH_TOKEN:-dummy}" && pnpm reset:e2e'
echo "[e2e] DB セットアップ完了"

# Expo public env vars must be embedded into the JS bundle at build time.
# Set placeholder key so revenueCat.ts skips initialization in __DEV__ mode
# (value starting with "your-" triggers the skip path in requireEnvKey).
# EXPO_PUBLIC_API_URL_ANDROID must point to the CI API server port (18787).
# The Android emulator reaches the host machine at 10.0.2.2; without this
# the app.config.ts default of :8787 mismatches the wrangler dev port.
export EXPO_PUBLIC_E2E_MODE="1"
export EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY="your-revenuecat-android-api-key"
export EXPO_PUBLIC_API_URL_ANDROID="http://10.0.2.2:${API_CI_PORT:-18787}"

# Build and install development build
nix develop --command bash -c "cd apps/mobile && pnpm expo run:android --variant debug" &
EXPO_PID=$!

# Wait for expo run:android to COMPLETE (build + install + Metro start).
# Rationale: `pidof com.techclip.app` becomes true as soon as the native process
# is created, but the JS bundle has not yet been delivered by Metro at that point.
# Starting Maestro against a blank/loading screen causes 100% flow failures.
# Waiting for the expo process to exit guarantees the full build pipeline is done.
echo "[e2e] expo run:android の完了を待機中..."
EXPO_EXIT_CODE=0
wait "$EXPO_PID" || EXPO_EXIT_CODE=$?

if [ "$EXPO_EXIT_CODE" -ne 0 ]; then
  echo "ERROR: expo run:android failed with exit code $EXPO_EXIT_CODE"
  echo "1" > "test-results/maestro-exit-code${SHARD_SUFFIX}.txt"
  exit 1
fi
echo "[e2e] expo run:android 完了 (exit code 0)"

# Verify the app process is running after expo finished.
# If not running, attempt to launch it explicitly.
if ! adb shell pidof com.techclip.app > /dev/null 2>&1; then
  echo "[e2e] app process not found after expo exit, attempting explicit launch..."
  adb shell am start -n com.techclip.app/.MainActivity > /dev/null 2>&1 || true
  sleep 5
fi

if ! adb shell pidof com.techclip.app > /dev/null 2>&1; then
  echo "ERROR: App is not running after expo build completed"
  echo "1" > "test-results/maestro-exit-code${SHARD_SUFFIX}.txt"
  exit 1
fi
echo "App is running"

# Determine which flows to run for this shard
SHARD_FLOWS=()
while IFS= read -r f; do
  [ -n "$f" ] && SHARD_FLOWS+=("$f")
done < <(bash scripts/ci/shard-flows.sh --shard "${SHARD_INDEX}/${SHARD_TOTAL}" --dir tests/e2e/maestro)

if [ "${#SHARD_FLOWS[@]}" -eq 0 ]; then
  echo "WARNING: no maestro flows for shard ${SHARD_INDEX}/${SHARD_TOTAL}; skipping" >&2
  echo "0" > "test-results/maestro-exit-code${SHARD_SUFFIX}.txt"
  pkill -P "$EXPO_PID" 2>/dev/null || true
  kill "$EXPO_PID" 2>/dev/null || true
  exit 0
fi

echo "[e2e] shard ${SHARD_INDEX}/${SHARD_TOTAL}: ${#SHARD_FLOWS[@]} flows"
for f in "${SHARD_FLOWS[@]}"; do
  echo "  - $f"
done

# Run Maestro tests (continue on failure to upload artifacts)
set +e
nix develop --command maestro test "${SHARD_FLOWS[@]}" \
  --format junit \
  --output "test-results/junit${SHARD_SUFFIX}.xml" \
  --debug-output "screenshots/debug${SHARD_SUFFIX}" \
  --env TEST_EMAIL="${TEST_EMAIL:-test+maestro@techclip.app}" \
  --env TEST_PASSWORD="${TEST_PASSWORD:-TestPassword123!}" \
  --env TEST_NAME="${TEST_NAME:-Maestro Test User}" \
  --env API_BASE_URL="${API_BASE_URL:-http://10.0.2.2:${API_CI_PORT:-18787}}" \
  --env FOLLOWER_EMAIL="${FOLLOWER_EMAIL:-follower+maestro@techclip.app}" \
  --env FOLLOWER_PASSWORD="${FOLLOWER_PASSWORD:-TestPassword123!}" \
  --env FOLLOWEE_EMAIL="${FOLLOWEE_EMAIL:-followee+maestro@techclip.app}" \
  --env FOLLOWEE_PASSWORD="${FOLLOWEE_PASSWORD:-TestPassword123!}" \
  --env PREMIUM_EMAIL="${PREMIUM_EMAIL:-premium+maestro@techclip.app}" \
  --env PREMIUM_PASSWORD="${PREMIUM_PASSWORD:-TestPassword123!}" \
  --env CHANGEPASS_EMAIL="${CHANGEPASS_EMAIL:-changepass+maestro@techclip.app}" \
  --env CHANGEPASS_PASSWORD="${CHANGEPASS_PASSWORD:-TestPassword123!}" \
  --env TIMESTAMP="${TIMESTAMP:-$(date +%s)}"
MAESTRO_EXIT=$?
set -e

pkill -P "$EXPO_PID" 2>/dev/null || true
kill "$EXPO_PID" 2>/dev/null || true

echo "$MAESTRO_EXIT" > "test-results/maestro-exit-code${SHARD_SUFFIX}.txt"
exit 0
