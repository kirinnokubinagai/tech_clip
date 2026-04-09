#!/usr/bin/env bash
# 追跡対象の shell shebang ファイルが executable bit を持つことを確認する

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null | sed -n '1p')"
if [[ -z "${REPO_ROOT}" ]]; then
  REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi
cd "${REPO_ROOT}"

FAILED=0

is_shell_shebang_file() {
  local pathname="$1"
  local first_line

  first_line=$(head -n 1 "${pathname}" 2>/dev/null || true)

  [[ "${first_line}" =~ ^#!.*(ba|z)?sh([[:space:]]|$) ]]
}

while read -r MODE _OBJECT _STAGE PATHNAME; do
  if [[ -z "${PATHNAME:-}" ]]; then
    continue
  fi

  if ! is_shell_shebang_file "${PATHNAME}"; then
    continue
  fi

  if [[ "${MODE}" != "100755" ]]; then
    echo "❌ executable bit が不足しています: ${PATHNAME}"
    echo "  修正: chmod +x \"${PATHNAME}\" && git add \"${PATHNAME}\""
    FAILED=1
  fi
done < <(git ls-files --stage)

if [[ "${FAILED}" -ne 0 ]]; then
  exit 1
fi

echo "✅ tracked shell entrypoints have executable bits"
