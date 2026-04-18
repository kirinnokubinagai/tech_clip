#!/usr/bin/env bash
# 各サービスの状態表示
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/platform-tools:$PATH"

check() {
  if lsof -i:"$1" 2>/dev/null | grep -q LISTEN; then
    printf "  ✓ %-10s (:%s)\n" "$2" "$1"
  else
    printf "  ✗ %-10s (:%s)\n" "$2" "$1"
  fi
}
echo "=== Service status ==="
check 8888  turso
check 18787 api
check 8025  mailpit
check 8081  metro
if adb devices 2>/dev/null | grep -q "emulator.*device$"; then
  echo "  ✓ emulator"
else
  echo "  ✗ emulator"
fi
