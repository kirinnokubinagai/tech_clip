#!/usr/bin/env bash
# E2E 用 dev サービス起動（冪等、既に起動しているものは skip）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_DIR="/tmp/techclip-dev"
mkdir -p "$LOG_DIR"

export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

check_port() { lsof -i:"$1" 2>/dev/null | grep -q LISTEN; }

wait_port() {
  local port="$1" name="$2"
  for _ in $(seq 1 30); do
    if check_port "$port"; then
      echo "  ✓ $name ready on :$port"
      return 0
    fi
    sleep 1
  done
  echo "  ✗ $name failed to start (see $LOG_DIR/$name.log)"
  return 1
}

start_service() {
  local name="$1" port="$2" cmd="$3"
  if check_port "$port"; then
    echo "[skip] $name already running on :$port"
    return 0
  fi
  echo "[start] $name on :$port"
  (cd "$REPO_ROOT" && nohup bash -c "$cmd" >"$LOG_DIR/$name.log" 2>&1 &)
  wait_port "$port" "$name"
}

# 1. turso dev (local libsql server)
start_service turso 8888 \
  "turso dev --db-file $REPO_ROOT/local.db --port 8888"

# 2. API (wrangler dev)
start_service api 18787 \
  "cd apps/api && pnpm wrangler dev --port 18787 --ip 0.0.0.0"

# 3. mailpit
start_service mailpit 8025 \
  "mailpit --smtp 127.0.0.1:1025 --listen 127.0.0.1:8025"

# 4. Metro
start_service metro 8081 \
  "cd apps/mobile && NODE_OPTIONS=--no-experimental-strip-types pnpm expo start --dev-client --port 8081"

# 5. Android emulator
if adb devices 2>/dev/null | grep -q "emulator.*device$"; then
  echo "[skip] emulator already running"
else
  AVD="${AVD_NAME:-Pixel_9}"
  echo "[start] emulator $AVD"
  nohup bash -c "emulator -avd $AVD -no-snapshot-save -no-boot-anim -no-audio" \
    >"$LOG_DIR/emulator.log" 2>&1 &
  for _ in $(seq 1 60); do
    if adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r' | grep -q 1; then
      echo "  ✓ emulator booted"
      break
    fi
    sleep 3
  done
fi

cat <<SUMMARY

=== All services ready ===
  turso:   http://localhost:8888
  API:     http://localhost:18787
  mailpit: http://localhost:8025  (SMTP: 1025)
  Metro:   http://localhost:8081
  logs:    $LOG_DIR/

Next steps:
  pnpm dev:e2e:seed     # migrate + seed (static test users)
  pnpm test:e2e:android # maestro 実行
  pnpm dev:e2e:down     # 全停止
SUMMARY
