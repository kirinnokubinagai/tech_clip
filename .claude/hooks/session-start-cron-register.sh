#!/usr/bin/env bash
# SessionStart hook: CronCreate 登録メッセージを出力する
#
# orchestrator が SessionStart notification を受けたら、
# polling-watcher.sh を 2 分毎に実行する CronCreate を登録する。
# CronCreate は durable=true で登録し、7 日自動削除後も毎回再登録する。

set -euo pipefail

echo "CRON_REGISTER: please call CronCreate(cron='*/2 * * * *', durable=true, prompt='bash scripts/polling-watcher.sh')"
