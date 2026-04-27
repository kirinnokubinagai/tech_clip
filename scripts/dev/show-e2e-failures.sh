#!/usr/bin/env bash
# show-e2e-failures.sh: maestro 失敗 flow を一覧表示する triage CLI
#
# 使い方:
#   bash scripts/dev/show-e2e-failures.sh [--format markdown|text|json] [--out <file>]
#
# 動作:
#   .claude/.e2e-debug-shard{N}of{TOTAL}.json (run-maestro-and-create-marker.sh が生成)
#   または最新の /tmp/maestro-result-*.xml + debug-output dir を読み込み、各 flow の:
#     - PASS / FAIL ステータス
#     - 失敗時の assertion 内容 (junit 内 <failure message="..." />)
#     - debug-output の screenshot dir path
#   を構造化して出力する。
#
#   --format markdown (default): docs/e2e-triage.md 形式 (人間可読 + agent 指示用)
#   --format text:               シンプル一覧
#   --format json:               agent 連携用
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || pwd)"

FORMAT="markdown"
OUT_FILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --format) FORMAT="$2"; shift 2 ;;
    --out)    OUT_FILE="$2"; shift 2 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# debug-index 群を集める (run-maestro-and-create-marker.sh が書き出す)
DEBUG_INDICES=()
while IFS= read -r f; do
  [ -n "$f" ] && DEBUG_INDICES+=("$f")
done < <(find "${REPO_ROOT}/.claude" -maxdepth 1 -name '.e2e-debug-shard*.json' 2>/dev/null | sort)

# fallback: 最新の /tmp/maestro-result-*.xml を直接読む
if [ "${#DEBUG_INDICES[@]}" -eq 0 ]; then
  LATEST_XML=$(ls -t /tmp/maestro-result-*.xml 2>/dev/null | head -1 || echo "")
  if [ -n "$LATEST_XML" ]; then
    LATEST_DEBUG=$(ls -td /tmp/maestro-debug-* 2>/dev/null | head -1 || echo "")
    DEBUG_INDICES+=("/tmp/.fallback-debug-index.json")
    jq -n \
      --arg result_xml "$LATEST_XML" \
      --arg debug_dir "$LATEST_DEBUG" \
      '{result_xml: $result_xml, debug_dir: $debug_dir, shard_index: 1, shard_total: 1}' \
      > /tmp/.fallback-debug-index.json
  fi
fi

if [ "${#DEBUG_INDICES[@]}" -eq 0 ]; then
  echo "ERROR: maestro 結果ファイルが見つかりません。" >&2
  echo "       先に bash scripts/gate/run-maestro-and-create-marker.sh を実行してください。" >&2
  exit 1
fi

# 各 flow の failure 情報を JSON 配列として集める
ALL_FAILURES_JSON='[]'
ALL_PASSES_JSON='[]'

for index_file in "${DEBUG_INDICES[@]}"; do
  RESULT_XML=$(jq -r '.result_xml' "$index_file")
  DEBUG_DIR=$(jq -r '.debug_dir' "$index_file")
  SHARD_INDEX=$(jq -r '.shard_index' "$index_file")
  SHARD_TOTAL=$(jq -r '.shard_total' "$index_file")

  if [ ! -f "$RESULT_XML" ]; then
    echo "WARN: $RESULT_XML が見つかりません (skip)" >&2
    continue
  fi

  # junit XML から testcase ごとの情報を抽出
  # <testcase name="01-onboarding" classname="..." time="...">
  #   <failure message="Assertion is false: ..." type="...">stack</failure> (失敗時のみ)
  # </testcase>
  while IFS=$'\t' read -r flow_name status failure_msg failure_type; do
    [ -z "$flow_name" ] && continue
    # debug dir 内の screenshot path を推定 (maestro は flow 名のディレクトリを掘る)
    SCREENSHOT_DIR=""
    if [ -n "$DEBUG_DIR" ] && [ -d "$DEBUG_DIR" ]; then
      candidate=$(find "$DEBUG_DIR" -maxdepth 2 -type d -name "${flow_name}*" 2>/dev/null | head -1 || true)
      [ -n "$candidate" ] && SCREENSHOT_DIR="$candidate"
    fi
    if [ "$status" = "FAIL" ]; then
      entry=$(jq -nc \
        --arg flow "$flow_name" \
        --arg msg "$failure_msg" \
        --arg type "$failure_type" \
        --arg shard "${SHARD_INDEX}/${SHARD_TOTAL}" \
        --arg screenshot "$SCREENSHOT_DIR" \
        '{flow: $flow, shard: $shard, message: $msg, type: $type, screenshot_dir: $screenshot}')
      ALL_FAILURES_JSON=$(echo "$ALL_FAILURES_JSON" | jq -c ". + [$entry]")
    else
      entry=$(jq -nc \
        --arg flow "$flow_name" \
        --arg shard "${SHARD_INDEX}/${SHARD_TOTAL}" \
        '{flow: $flow, shard: $shard}')
      ALL_PASSES_JSON=$(echo "$ALL_PASSES_JSON" | jq -c ". + [$entry]")
    fi
  # Maestro junit format:
  #   <testcase name="..." status="ERROR" ...>
  #     <failure>Assertion is false: "..." is visible</failure>  (text content, not attribute)
  #   </testcase>
  done < <(awk '
    BEGIN { name=""; failmsg=""; failtype=""; status="PASS" }
    /<testcase[^>]+name="/ {
      if (match($0, /name="[^"]*"/)) name=substr($0, RSTART+6, RLENGTH-7)
      if (match($0, /status="[^"]*"/)) status=substr($0, RSTART+8, RLENGTH-9)
      else status="PASS"
      failmsg=""; failtype=""
    }
    # 1 行内に <failure>...</failure> がある場合
    /<failure[^>]*>[^<]+<\/failure>/ {
      status="FAIL"
      if (match($0, /<failure[^>]*>[^<]+<\/failure>/)) {
        chunk=substr($0, RSTART, RLENGTH)
        sub(/<failure[^>]*>/, "", chunk)
        sub(/<\/failure>/, "", chunk)
        failmsg=chunk
      }
      if (match($0, /type="[^"]*"/)) failtype=substr($0, RSTART+6, RLENGTH-7)
    }
    # <failure> が改行を跨ぐ場合 (複数行) — 開始タグだけマッチ
    /<failure[^\/]*>$/ { in_failure=1; status="FAIL"; next }
    in_failure && /<\/failure>/ { in_failure=0; next }
    in_failure { failmsg = (failmsg ? failmsg " " : "") $0; next }
    /<\/testcase>/ {
      if (name != "") {
        if (status == "ERROR") status="FAIL"
        printf "%s\t%s\t%s\t%s\n", name, status, failmsg, failtype
      }
      name=""; in_failure=0
    }
  ' "$RESULT_XML")
done

FAIL_COUNT=$(echo "$ALL_FAILURES_JSON" | jq 'length')
PASS_COUNT=$(echo "$ALL_PASSES_JSON" | jq 'length')
TOTAL=$((FAIL_COUNT + PASS_COUNT))

emit_text() {
  echo "===== Maestro E2E 結果 ====="
  echo "  PASS: ${PASS_COUNT}/${TOTAL}"
  echo "  FAIL: ${FAIL_COUNT}/${TOTAL}"
  echo
  if [ "$FAIL_COUNT" -gt 0 ]; then
    echo "--- 失敗 flow ---"
    echo "$ALL_FAILURES_JSON" | jq -r '.[] | "[\(.shard)] \(.flow)\n  msg: \(.message)\n  screenshot: \(.screenshot_dir // "(none)")\n"'
  fi
  if [ "$PASS_COUNT" -gt 0 ]; then
    echo "--- 成功 flow ---"
    echo "$ALL_PASSES_JSON" | jq -r '.[] | "[\(.shard)] \(.flow)"'
  fi
}

emit_markdown() {
  echo "# Maestro E2E Triage"
  echo
  echo "- Total: ${TOTAL}"
  echo "- Pass: ${PASS_COUNT}"
  echo "- Fail: ${FAIL_COUNT}"
  echo
  if [ "$FAIL_COUNT" -gt 0 ]; then
    echo "## 失敗 flow"
    echo
    echo "$ALL_FAILURES_JSON" | jq -r '.[] | "### \(.flow) (shard \(.shard))\n\n- **失敗 assertion**: \(.message)\n- **type**: \(.type)\n- **screenshot dir**: `\(.screenshot_dir // "(none)")`\n"'
  fi
  if [ "$PASS_COUNT" -gt 0 ]; then
    echo "## 成功 flow"
    echo
    echo "$ALL_PASSES_JSON" | jq -r '.[] | "- \(.flow) (shard \(.shard))"'
  fi
}

emit_json() {
  jq -n \
    --argjson failures "$ALL_FAILURES_JSON" \
    --argjson passes "$ALL_PASSES_JSON" \
    --argjson total "$TOTAL" \
    '{total: $total, fail_count: ($failures | length), pass_count: ($passes | length), failures: $failures, passes: $passes}'
}

case "$FORMAT" in
  text)     OUTPUT=$(emit_text) ;;
  markdown) OUTPUT=$(emit_markdown) ;;
  json)     OUTPUT=$(emit_json) ;;
  *) echo "ERROR: invalid --format: $FORMAT" >&2; exit 1 ;;
esac

if [ -n "$OUT_FILE" ]; then
  printf '%s\n' "$OUTPUT" > "$OUT_FILE"
  echo "[show-e2e-failures] saved to $OUT_FILE" >&2
else
  printf '%s\n' "$OUTPUT"
fi

# exit code: 失敗があれば 1
[ "$FAIL_COUNT" -eq 0 ]
