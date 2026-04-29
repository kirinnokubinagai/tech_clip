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

# CI emulator は x86_64 のみ。全 ABI ビルドは OOM の原因。
export ORG_GRADLE_PROJECT_reactNativeArchitectures=x86_64

# Build and install development build.
# Hybrid approach:
#  1. Start expo run:android in background (Metro + build)
#  2. Poll pidof to detect app startup
#  3. Wait for "Bundled" log (Metro bundle delivery complete)
#  4. Start Maestro tests
EXPO_LOG="/tmp/expo-run-android-$$.log"
nix develop --command bash -c "cd apps/mobile && pnpm expo run:android --variant debug" 2>&1 | tee "$EXPO_LOG" &
EXPO_PID=$!

# Wait for Metro to finish bundling (single combined loop)
# "Bundled" in the log is a strictly stronger signal than pidof:
# it implies the app is already running AND has received the JS bundle.
echo "[e2e] ビルド完了・Metro バンドル配信を待機中..."
MAX_WAIT=600  # 10 minutes — enough for cold Gradle build + Metro bundle
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
  # If the build process crashed, exit early instead of waiting 600s
  if ! kill -0 "$EXPO_PID" 2>/dev/null; then
    echo "ERROR: Expo build process exited unexpectedly"
    echo "[e2e] 最終 20 行のログ:"
    tail -20 "$EXPO_LOG" || true
    echo "1" > "test-results/maestro-exit-code${SHARD_SUFFIX}.txt"
    rm -f "$EXPO_LOG"
    exit 1
  fi
  if grep -q "Bundled" "$EXPO_LOG" 2>/dev/null; then
    echo "[e2e] Metro バンドル配信完了"
    break
  fi
  sleep 1
  WAITED=$((WAITED + 1))
done

if [ $WAITED -ge $MAX_WAIT ]; then
  echo "ERROR: App process did not start within ${MAX_WAIT}s"
  echo "[e2e] 最終 20 行のログ:"
  tail -20 "$EXPO_LOG" || true
  echo "1" > "test-results/maestro-exit-code${SHARD_SUFFIX}.txt"
  kill "$EXPO_PID" 2>/dev/null || true
  rm -f "$EXPO_LOG"
  exit 1
fi

rm -f "$EXPO_LOG"

# Verify the app process is still running
if ! adb shell pidof com.techclip.app > /dev/null 2>&1; then
  echo "ERROR: App process exited unexpectedly"
  echo "1" > "test-results/maestro-exit-code${SHARD_SUFFIX}.txt"
  kill "$EXPO_PID" 2>/dev/null || true
  exit 1
fi
echo "App is running and Metro bundling complete"

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
