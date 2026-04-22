#!/usr/bin/env bash
# SessionStart hook: CronCreate 登録メッセージを出力する
#
# orchestrator が SessionStart notification を受けたら、
# polling-watcher.sh を config.json の polling_interval_minutes 毎に実行する CronCreate を登録する。
# CronCreate は durable=true で登録し、7 日自動削除後も毎回再登録する。

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${SCRIPT_DIR}/../config.json"

# config.json から polling_interval_minutes を読み込む（デフォルト: 2）
INTERVAL_MINUTES=$(jq -r '.polling_interval_minutes // 2' "$CONFIG" 2>/dev/null || echo "2")

# 1分の場合は毎分、それ以外は */N 形式のcron式を生成する
if [ "$INTERVAL_MINUTES" = "1" ]; then
  CRON_EXPR="* * * * *"
else
  CRON_EXPR="*/${INTERVAL_MINUTES} * * * *"
fi

POLLING_DIR="${SCRIPT_DIR}/../polling"
ACTIVE_POLLS=$(find "$POLLING_DIR" -name "pr-*.json" 2>/dev/null | wc -l | tr -d ' ')

if [ "${ACTIVE_POLLS}" -gt 0 ]; then
  echo "CRON_REGISTER: please call CronCreate(cron=\'${CRON_EXPR}\', durable=true, prompt=\'bash scripts/polling-watcher.sh\')"
fi
