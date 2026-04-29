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

# Build and install development build.
# Two-phase approach:
#  1. Wait for Gradle build to complete + app to be installed
#     (detect via Gradle "BUILD SUCCESSFUL" or pidof verification)
#  2. Wait for Metro to deliver the JS bundle (log "Bundled")
#  3. Start Maestro tests
echo "[e2e] Gradle ビルド + アプリインストール + Metro バンドルを待機中..."
EXPO_LOG="/tmp/expo-run-android-$$.log"
nix develop --command bash -c "cd apps/mobile && ORG_GRADLE_PROJECT_reactNativeArchitectures=x86_64 pnpm expo run:android --variant debug" 2>&1 | tee "$EXPO_LOG" &
EXPO_PID=$!

# Phase 1: Wait for Gradle build to complete (watch for "BUILD SUCCESSFUL" in log)
echo "[e2e] Phase 1: Gradle ビルド完了を待機中..."
MAX_GRADLE_WAIT=1200  # 20 minutes for cold Gradle build + CMake compilation
GRADLE_WAITED=0
while [ $GRADLE_WAITED -lt $MAX_GRADLE_WAIT ]; do
  # Check if build process is still running
  if ! kill -0 "$EXPO_PID" 2>/dev/null; then
    echo "ERROR: Expo build process exited unexpectedly during Gradle build"
    echo "[e2e] 最終 30 行のログ:"
    tail -30 "$EXPO_LOG" || true
    echo "1" > "test-results/maestro-exit-code${SHARD_SUFFIX}.txt"
    rm -f "$EXPO_LOG"
    exit 1
  fi
  # Check for Gradle build completion markers
  if grep -qE "BUILD SUCCESSFUL|Bundled" "$EXPO_LOG" 2>/dev/null; then
    echo "[e2e] Phase 1: Gradle ビルド + Metro バンドル完了"
    break
  fi
  sleep 1
  GRADLE_WAITED=$((GRADLE_WAITED + 1))
done

if [ $GRADLE_WAITED -ge $MAX_GRADLE_WAIT ]; then
  echo "ERROR: Gradle build did not complete within ${MAX_GRADLE_WAIT}s"
  echo "[e2e] 最終 30 行のログ:"
  tail -30 "$EXPO_LOG" || true
  echo "1" > "test-results/maestro-exit-code${SHARD_SUFFIX}.txt"
  kill "$EXPO_PID" 2>/dev/null || true
  rm -f "$EXPO_LOG"
  exit 1
fi

# Phase 2: Verify app is running (pidof check with shorter timeout)
echo "[e2e] Phase 2: アプリプロセス確認..."
MAX_PIDOF_WAIT=60  # Should be quick now that build is done
PIDOF_WAITED=0
while [ $PIDOF_WAITED -lt $MAX_PIDOF_WAIT ]; do
  if adb shell pidof com.techclip.app > /dev/null 2>&1; then
    echo "[e2e] Phase 2: アプリプロセス確認完了"
    break
  fi
  sleep 1
  PIDOF_WAITED=$((PIDOF_WAITED + 1))
done

if [ $PIDOF_WAITED -ge $MAX_PIDOF_WAIT ]; then
  echo "ERROR: App process not found within ${MAX_PIDOF_WAIT}s after build completed"
  echo "[e2e] 最終 30 行のログ:"
  tail -30 "$EXPO_LOG" || true
  echo "1" > "test-results/maestro-exit-code${SHARD_SUFFIX}.txt"
  kill "$EXPO_PID" 2>/dev/null || true
  rm -f "$EXPO_LOG"
  exit 1
fi

rm -f "$EXPO_LOG"

# Verify app is still running
if ! adb shell pidof com.techclip.app > /dev/null 2>&1; then
  echo "ERROR: App process exited unexpectedly"
  echo "1" > "test-results/maestro-exit-code${SHARD_SUFFIX}.txt"
  kill "$EXPO_PID" 2>/dev/null || true
  exit 1
fi

echo "[e2e] ビルド・インストール・Metro バンドル配信完了"
echo "App is running, ready to start Maestro tests"

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
