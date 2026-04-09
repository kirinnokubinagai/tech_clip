#!/usr/bin/env bash
# 追跡対象のシェルスクリプトが executable bit を持つことを確認する

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${REPO_ROOT}"

FAILED=0

while read -r MODE _OBJECT _STAGE PATHNAME; do
  if [[ -z "${PATHNAME:-}" ]]; then
    continue
  fi

  if [[ "${MODE}" != "100755" ]]; then
    echo "❌ executable bit が不足しています: ${PATHNAME}"
    echo "  修正: chmod +x \"${PATHNAME}\" && git add \"${PATHNAME}\""
    FAILED=1
  fi
done < <(git ls-files --stage -- '*.sh')

if [[ "${FAILED}" -ne 0 ]]; then
  exit 1
fi

echo "✅ tracked shell scripts have executable bits"
