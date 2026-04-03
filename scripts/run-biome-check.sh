#!/bin/bash
set -euo pipefail

targets=()
for dir in apps packages tests scripts; do
  if [ -e "$dir" ]; then
    targets+=("$dir")
  fi
done

if [ "${#targets[@]}" -eq 0 ]; then
  echo "Biomeチェック対象ディレクトリが見つかりません。"
  exit 1
fi

pnpm exec biome check "$@" "${targets[@]}"
