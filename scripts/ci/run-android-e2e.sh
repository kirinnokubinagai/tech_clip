#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail

export NODE_OPTIONS="${NODE_OPTIONS:---no-experimental-strip-types}"

mkdir -p screenshots test-results

# Reset DB and seed e2e data before building the app
echo "[e2e] DB リセット + migrate + seed を実行中..."
nix develop --command bash -c 'cd apps/api && export TURSO_DATABASE_URL="${TURSO_DATABASE_URL:-http://127.0.0.1:8888}" && export TURSO_AUTH_TOKEN="${TURSO_AUTH_TOKEN:-dummy}" && pnpm reset:e2e'
echo "[e2e] DB セットアップ完了"

# Build and install development build
nix develop --command bash -c "cd apps/mobile && pnpm expo run:android --variant debug" &
EXPO_PID=$!

# Wait for app to be installed and running
# 360 iterations × 5s = 30 min (native modules like react-native-webview extend build time)
readonly MAX_WAIT_ITERATIONS=360
readonly WAIT_INTERVAL_SECONDS=5

for _ in $(seq 1 "$MAX_WAIT_ITERATIONS"); do
  # expo run:android プロセスが先に死んだら fail-fast（ビルド失敗の可能性）
  if ! kill -0 "$EXPO_PID" 2>/dev/null; then
    echo "ERROR: expo run:android process died before app started"
    echo "1" > test-results/maestro-exit-code.txt
    exit 1
  fi
  if adb shell pidof com.techclip.app > /dev/null 2>&1; then
    echo "App is running"
    break
  fi
  sleep "$WAIT_INTERVAL_SECONDS"
done

if ! adb shell pidof com.techclip.app > /dev/null 2>&1; then
  echo "ERROR: App failed to start within 30 minutes"
  pkill -P "$EXPO_PID" 2>/dev/null || true
  kill "$EXPO_PID" 2>/dev/null || true
  echo "1" > test-results/maestro-exit-code.txt
  exit 1
fi

# Run Maestro tests (continue on failure to upload artifacts)
set +e
nix develop --command maestro test tests/e2e/maestro/ \
  --format junit \
  --output test-results/junit.xml \
  --debug-output screenshots/debug \
  --env TEST_EMAIL="${TEST_EMAIL:-test+maestro@techclip.app}" \
  --env TEST_PASSWORD="${TEST_PASSWORD:-TestPassword123!}" \
  --env TEST_NAME="${TEST_NAME:-Maestro Test User}" \
  --env TIMESTAMP="${TIMESTAMP:-$(date +%s)}"
MAESTRO_EXIT=$?
set -e

pkill -P "$EXPO_PID" 2>/dev/null || true
kill "$EXPO_PID" 2>/dev/null || true

echo "$MAESTRO_EXIT" > test-results/maestro-exit-code.txt
exit 0
