#!/usr/bin/env bash
# decide-shard-total.sh: orchestrator が e2e-reviewer spawn 時に渡す shard_total を決定する
#
# 判定基準:
# - HOME のディスク空き 30GB 以上 + emulator 4 起動可能 → 4
# - HOME のディスク空き 30GB 未満 → 2
# - emulator が単一しかない（CI 等）→ 1
#
# 使い方:
#   bash scripts/skills/decide-shard-total.sh
#   出力: 数字 1 行（4 / 2 / 1）

set -euo pipefail

# CI 環境では 4 を返す（GitHub Actions のリソースは潤沢）
if [ -n "${CI:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ]; then
  echo "4"
  exit 0
fi

# disk 空き判定（GB 単位、HOME のあるパーティション）
AVAIL_GB=$(df -g "$HOME" 2>/dev/null | awk 'NR==2 {print $4}' || echo "0")

if [ "$AVAIL_GB" -lt 30 ]; then
  echo "2"
  exit 0
fi

# 30GB 以上 → 4
echo "4"
