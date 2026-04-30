#!/usr/bin/env bash
# aggregate-e2e-shards.sh: 多シャード E2E 結果を集約する
#
# モード 1（新: XML 直接集約）:
#   bash scripts/gate/aggregate-e2e-shards.sh --agent <name> \
#     --shard-xmls <xml1,xml2,...> --output-xml <out.xml> [--base-ref <ref>]
#
# モード 2（従来: .e2e-shard-NofTOTAL.json 集約）:
#   bash scripts/gate/aggregate-e2e-shards.sh --agent <name> --shard-total <TOTAL> [--base-ref <ref>]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)"

AGENT_NAME=""
SHARD_TOTAL=""
BASE_REF="origin/main"
SHARD_XMLS=""
OUTPUT_XML=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --agent)       AGENT_NAME="$2";    shift 2 ;;
    --shard-total) SHARD_TOTAL="$2";   shift 2 ;;
    --base-ref)    BASE_REF="$2";      shift 2 ;;
    --shard-xmls)  SHARD_XMLS="$2";    shift 2 ;;
    --output-xml)  OUTPUT_XML="$2";    shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

if [ -z "$AGENT_NAME" ]; then
  echo "ERROR: --agent <name> is required" >&2
  exit 1
fi

# ── モード 1: XML 直接集約 ──────────────────────────────────────────────────
if [ -n "$SHARD_XMLS" ] || [ -n "$OUTPUT_XML" ]; then
  if [ -z "$SHARD_XMLS" ] || [ -z "$OUTPUT_XML" ]; then
    echo "ERROR: --shard-xmls and --output-xml must be used together" >&2
    exit 1
  fi

  IFS=',' read -ra XML_LIST <<< "$SHARD_XMLS"
  MISSING=()
  for xml in "${XML_LIST[@]}"; do
    if [ ! -f "$xml" ]; then
      MISSING+=("$xml")
    fi
  done
  if [ "${#MISSING[@]}" -gt 0 ]; then
    echo "ERROR: shard XML files not found:" >&2
    for m in "${MISSING[@]}"; do
      echo "  - $m" >&2
    done
    exit 1
  fi

  TMP_OUT="${OUTPUT_XML}.tmp.$$"
  PY_EXIT=0
  python3 - "$TMP_OUT" "${XML_LIST[@]}" <<'XMLPY' || PY_EXIT=$?
import sys
try:
    import xml.etree.ElementTree as ET
except ImportError:
    print("ERROR: python3 xml.etree.ElementTree not available", file=sys.stderr)
    sys.exit(1)

out_path = sys.argv[1]
xml_files = sys.argv[2:]
root = ET.Element("testsuites")
total_tests = 0
total_failures = 0

for xml_path in xml_files:
    try:
        tree = ET.parse(xml_path)
        src = tree.getroot()
    except Exception as e:
        print(f"ERROR parsing {xml_path}: {e}", file=sys.stderr)
        sys.exit(1)
    if src.tag == "testsuites":
        for ts in src:
            total_tests += int(ts.get("tests", 0))
            total_failures += int(ts.get("failures", 0))
            root.append(ts)
    elif src.tag == "testsuite":
        total_tests += int(src.get("tests", 0))
        total_failures += int(src.get("failures", 0))
        root.append(src)

root.set("tests", str(total_tests))
root.set("failures", str(total_failures))
tree_out = ET.ElementTree(root)
try:
    ET.indent(tree_out, space="  ")
except AttributeError:
    pass

with open(out_path, "wb") as f:
    f.write(b'<?xml version="1.0" encoding="UTF-8"?>\n')
    tree_out.write(f, encoding="utf-8", xml_declaration=False)

sys.exit(1 if total_failures > 0 else 0)
XMLPY
  if [ -f "$TMP_OUT" ]; then
    mv "$TMP_OUT" "$OUTPUT_XML"
  fi
  if [ "$PY_EXIT" -ne 0 ]; then
    echo "ERROR: shard XML aggregation found failures (see $OUTPUT_XML)" >&2
    exit 1
  fi
  echo "aggregate-e2e-shards: merged ${#XML_LIST[@]} XML files -> $OUTPUT_XML" >&2
  exit 0
fi

# ── モード 2: .e2e-shard-NofTOTAL.json 集約（従来互換） ────────────────────
if [ -z "$SHARD_TOTAL" ]; then
  echo "ERROR: --agent <name> and --shard-total <N> are required (or use --shard-xmls / --output-xml)" >&2
  exit 1
fi

if ! echo "$SHARD_TOTAL" | grep -qE '^[1-9][0-9]*$'; then
  echo "ERROR: invalid --shard-total: $SHARD_TOTAL" >&2
  exit 1
fi

HEAD_SHA=$(git -C "$REPO_ROOT" rev-parse HEAD)
MARKER="${REPO_ROOT}/.claude/.e2e-passed"
TMP_MARKER="${MARKER}.tmp.$$"
LOG="${REPO_ROOT}/.claude/last-e2e.log"
CLAUDE_DIR="${REPO_ROOT}/.claude"
COMPLETED_AT=$(date -u +%FT%TZ)

mkdir -p "$CLAUDE_DIR"

TOTAL_FLOWS=0
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_ERRORS=0
FAILURES=()

for i in $(seq 1 "$SHARD_TOTAL"); do
  SHARD_JSON="${CLAUDE_DIR}/.e2e-shard-${i}of${SHARD_TOTAL}.json"
  if [ ! -f "$SHARD_JSON" ]; then
    FAILURES+=("shard ${i}/${SHARD_TOTAL}: 結果ファイル不在 (${SHARD_JSON})")
    continue
  fi

  SHARD_HEAD=$(jq -r '.head_sha // empty' "$SHARD_JSON" 2>/dev/null || echo "")
  if [ "$SHARD_HEAD" != "$HEAD_SHA" ]; then
    FAILURES+=("shard ${i}/${SHARD_TOTAL}: HEAD SHA 不一致 (shard=${SHARD_HEAD:0:12}, current=${HEAD_SHA:0:12})")
    continue
  fi

  STATUS=$(jq -r '.status // "UNKNOWN"' "$SHARD_JSON" 2>/dev/null || echo "UNKNOWN")
  PASSED=$(jq -r '.flows_passed // 0' "$SHARD_JSON" 2>/dev/null || echo 0)
  TOTAL=$(jq -r '.flows_total // 0' "$SHARD_JSON" 2>/dev/null || echo 0)
  FAILED=$(jq -r '.flows_failed // 0' "$SHARD_JSON" 2>/dev/null || echo 0)
  ERRORS=$(jq -r '.flows_errors // 0' "$SHARD_JSON" 2>/dev/null || echo 0)

  TOTAL_FLOWS=$((TOTAL_FLOWS + TOTAL))
  TOTAL_PASSED=$((TOTAL_PASSED + PASSED))
  TOTAL_FAILED=$((TOTAL_FAILED + FAILED))
  TOTAL_ERRORS=$((TOTAL_ERRORS + ERRORS))

  if [ "$STATUS" != "PASS" ]; then
    FAILURES+=("shard ${i}/${SHARD_TOTAL}: status=${STATUS} flows=${PASSED}/${TOTAL}")
  fi
done

if [ "${#FAILURES[@]}" -gt 0 ]; then
  echo "ERROR: e2e shards aggregation failed:" >&2
  for f in "${FAILURES[@]}"; do
    echo "  - $f" >&2
  done
  if command -v jq &>/dev/null; then
    jq -nc \
      --arg head_sha "$HEAD_SHA" \
      --arg agent "$AGENT_NAME" \
      --arg completed_at "$COMPLETED_AT" \
      --argjson shard_total "$SHARD_TOTAL" \
      --argjson flows_passed "$TOTAL_PASSED" \
      --argjson flows_total "$TOTAL_FLOWS" \
      '{kind: "e2e", head_sha: $head_sha, agent: $agent, completed_at: $completed_at, status: "FAIL", aggregated: true, shard_total: $shard_total, flows_passed: $flows_passed, flows_total: $flows_total}' \
      >> "$LOG" 2>/dev/null || true
  fi
  exit 1
fi

printf '%s\n' "$HEAD_SHA" > "$TMP_MARKER"
mv "$TMP_MARKER" "$MARKER"
echo "e2e marker created: $MARKER (sha=$HEAD_SHA shards=$SHARD_TOTAL flows=$TOTAL_PASSED/$TOTAL_FLOWS)" >&2

for i in $(seq 1 "$SHARD_TOTAL"); do
  rm -f "${CLAUDE_DIR}/.e2e-shard-${i}of${SHARD_TOTAL}.json"
done

if command -v jq &>/dev/null; then
  jq -nc \
    --arg head_sha "$HEAD_SHA" \
    --arg agent "$AGENT_NAME" \
    --arg completed_at "$COMPLETED_AT" \
    --argjson shard_total "$SHARD_TOTAL" \
    --argjson flows_passed "$TOTAL_PASSED" \
    --argjson flows_total "$TOTAL_FLOWS" \
    '{kind: "e2e", head_sha: $head_sha, agent: $agent, completed_at: $completed_at, status: "PASS", aggregated: true, shard_total: $shard_total, flows_passed: $flows_passed, flows_total: $flows_total}' \
    >> "$LOG"
fi
