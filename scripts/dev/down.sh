#!/usr/bin/env bash
# E2E 用 dev サービス全停止
set -euo pipefail

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

kill_port() {
  local port="$1" name="$2"
  local pids
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo "[stop] $name (:$port)"
    kill $pids 2>/dev/null || true
    sleep 1
    kill -9 $pids 2>/dev/null || true
  else
    echo "[skip] $name not running"
  fi
}

kill_port 8888  turso
kill_port 18787 api
kill_port 8025  mailpit-ui
kill_port 1025  mailpit-smtp
kill_port 8081  metro

if adb devices 2>/dev/null | grep -q "emulator.*device$"; then
  echo "[stop] emulator"
  adb emu kill 2>/dev/null || true
else
  echo "[skip] emulator not running"
fi

echo "=== All services stopped ==="
