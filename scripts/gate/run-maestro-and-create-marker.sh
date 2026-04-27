#!/usr/bin/env bash
# run-maestro-and-create-marker.sh: Maestro E2E 実行 → create-e2e-marker.sh 呼び出し
#
# 使い方: bash scripts/gate/run-maestro-and-create-marker.sh --agent <name> [--base-ref <ref>]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)"

AGENT_NAME=""
BASE_REF="origin/main"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent)    AGENT_NAME="$2"; shift 2 ;;
    --base-ref) BASE_REF="$2";   shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$AGENT_NAME" ]; then
  echo "ERROR: --agent <name> is required" >&2
  exit 1
fi

HEAD_SHA=$(git -C "$REPO_ROOT" rev-parse HEAD)
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
RESULT_XML="/tmp/maestro-result-${HEAD_SHA:0:8}-${TIMESTAMP}.xml"

# emulator 確認
if ! command -v maestro &>/dev/null; then
  echo "ERROR: maestro command not found. Install maestro or run via direnv." >&2
  exit 1
fi

MAESTRO_DIR="${REPO_ROOT}/tests/e2e/maestro"
if [ ! -d "$MAESTRO_DIR" ]; then
  echo "ERROR: maestro test directory not found: $MAESTRO_DIR" >&2
  exit 1
fi

# helpers/ は standalone 実行対象外（runFlow: でのみ参照）
YAML_FILES=()
while IFS= read -r -d '' f; do
  if [[ "$f" != *"/helpers/"* ]]; then
    YAML_FILES+=("$f")
  fi
done < <(find "$MAESTRO_DIR" -maxdepth 1 -name "*.yaml" -print0 2>/dev/null)

if [ "${#YAML_FILES[@]}" -eq 0 ]; then
  echo "WARNING: no maestro yaml files found (excluding helpers/)" >&2
  # E2E ファイルなし → skip marker
  bash "${SCRIPT_DIR}/create-e2e-marker.sh" --agent "$AGENT_NAME" --base-ref "$BASE_REF"
  exit 0
fi

echo "Running maestro tests: ${#YAML_FILES[@]} flows" >&2

(cd "$REPO_ROOT" && direnv exec "$REPO_ROOT" maestro test \
  --format junit \
  --output "$RESULT_XML" \
  "${YAML_FILES[@]}" 2>&1) || true  # exit code は XML の内容で判定するため無視

if [ ! -f "$RESULT_XML" ]; then
  echo "ERROR: maestro did not produce result XML: $RESULT_XML" >&2
  exit 1
fi

bash "${SCRIPT_DIR}/create-e2e-marker.sh" \
  --agent "$AGENT_NAME" \
  --maestro-result "$RESULT_XML" \
  --base-ref "$BASE_REF"
