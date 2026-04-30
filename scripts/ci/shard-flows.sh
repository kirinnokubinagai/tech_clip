#!/usr/bin/env bash
# shard-flows.sh: maestro flow yaml ファイルを N シャードに分配する
#
# 使い方:
#   bash scripts/ci/shard-flows.sh --shard <INDEX>/<TOTAL> [--dir <flows_dir>]
#
# 例: 18 個の flow を 2 シャードに分配し shard 1 (1-9 番目) を出力
#   bash scripts/ci/shard-flows.sh --shard 1/2
#
# 出力: 該当 shard が担当する yaml ファイルパスを 1 行ずつ stdout に出す
#
# 分配方式: ファイル名でソートしてラウンドロビン（負荷均等化のため）
#   shard 1/2: 1, 3, 5, 7, ... 番目
#   shard 2/2: 2, 4, 6, 8, ... 番目
#
# helpers/ ディレクトリと config.yaml は除外する（top-level yaml のみ対象）
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)"

SHARD_SPEC=""
FLOWS_DIR="${REPO_ROOT}/tests/e2e/maestro"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --shard) SHARD_SPEC="$2"; shift 2 ;;
    --dir)   FLOWS_DIR="$2";  shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$SHARD_SPEC" ]; then
  echo "ERROR: --shard <INDEX>/<TOTAL> is required" >&2
  exit 1
fi

if ! echo "$SHARD_SPEC" | grep -qE '^[1-9][0-9]*/[1-9][0-9]*$'; then
  echo "ERROR: invalid shard spec: $SHARD_SPEC (expected: <INDEX>/<TOTAL>)" >&2
  exit 1
fi

SHARD_INDEX="${SHARD_SPEC%/*}"
SHARD_TOTAL="${SHARD_SPEC#*/}"

if [ "$SHARD_INDEX" -gt "$SHARD_TOTAL" ] || [ "$SHARD_INDEX" -lt 1 ]; then
  echo "ERROR: shard index $SHARD_INDEX out of range 1..$SHARD_TOTAL" >&2
  exit 1
fi

if [ ! -d "$FLOWS_DIR" ]; then
  echo "ERROR: flows directory not found: $FLOWS_DIR" >&2
  exit 1
fi

# top-level yaml のみ取得 (helpers/ は除外、config.yaml は除外)
ALL_FLOWS=()
while IFS= read -r -d '' f; do
  base="$(basename "$f")"
  if [ "$base" = "config.yaml" ]; then
    continue
  fi
  ALL_FLOWS+=("$f")
done < <(find "$FLOWS_DIR" -maxdepth 1 -name "*.yaml" -print0 2>/dev/null | sort -z)

if [ "${#ALL_FLOWS[@]}" -eq 0 ]; then
  exit 0
fi

# ラウンドロビン分配: index i (1-based) を shard ((i-1) % TOTAL) + 1 に割り当てる
i=0
for flow in "${ALL_FLOWS[@]}"; do
  shard=$(( i % SHARD_TOTAL + 1 ))
  if [ "$shard" -eq "$SHARD_INDEX" ]; then
    echo "$flow"
  fi
  i=$((i + 1))
done
