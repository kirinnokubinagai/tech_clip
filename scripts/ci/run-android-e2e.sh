#!/usr/bin/env bash
# shellcheck shell=bash
set -euo pipefail

export NODE_OPTIONS="${NODE_OPTIONS:---no-experimental-strip-types}"

mkdir -p screenshots test-results

# Build and install development build
nix develop --command bash -c "cd apps/mobile && pnpm expo run:android --variant debug" &
EXPO_PID=$!

# Wait for app to be installed and running
# 180 iterations × 5s = 15 min (native modules like react-native-webview extend build time)
for _ in $(seq 1 180); do
  if adb shell pidof com.techclip.app > /dev/null 2>&1; then
    echo "App is running"
    break
  fi
  sleep 5
done

if ! adb shell pidof com.techclip.app > /dev/null 2>&1; then
  echo "ERROR: App failed to start within 15 minutes"
  pkill -P $EXPO_PID 2>/dev/null || true
  kill $EXPO_PID 2>/dev/null || true
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
  --env TEST_PASSWORD="${TEST_PASSWORD:-TestPassword123}" \
  --env TEST_NAME="${TEST_NAME:-Maestro Test User}" \
  --env TIMESTAMP="${TIMESTAMP:-$(date +%s)}"
MAESTRO_EXIT=$?
set -e

pkill -P $EXPO_PID 2>/dev/null || true
kill $EXPO_PID 2>/dev/null || true

echo "$MAESTRO_EXIT" > test-results/maestro-exit-code.txt
exit 0
