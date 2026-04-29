#!/usr/bin/env bats
# aggregate-e2e-shards.sh のテスト（N shard XML 集約モード）

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/gate/aggregate-e2e-shards.sh"

setup() {
  TMPDIR=$(mktemp -d)
  REPO_DIR="$TMPDIR/repo"
  mkdir -p "$REPO_DIR/.claude"
  git -C "$REPO_DIR" init -b main >/dev/null 2>&1
  git -C "$REPO_DIR" config user.email "test@test.com"
  git -C "$REPO_DIR" config user.name "Test"
  echo "init" > "$REPO_DIR/README.md"
  git -C "$REPO_DIR" add . && git -C "$REPO_DIR" commit -m "init" >/dev/null 2>&1
}

teardown() {
  rm -rf "$TMPDIR"
}

# ヘルパー: 最小限の JUnit XML を生成
_make_junit_xml() {
  local path="$1" tests="${2:-1}" failures="${3:-0}" name="${4:-shard}"
  cat > "$path" << XML
<?xml version="1.0" encoding="UTF-8"?>
<testsuites tests="$tests" failures="$failures">
  <testsuite name="$name" tests="$tests" failures="$failures">
    <testcase name="flow1" time="1.0"/>
  </testsuite>
</testsuites>
XML
}

@test "--shard-xmls と --output-xml を受け付ける" {
  local xml1="$TMPDIR/s0.xml" xml2="$TMPDIR/s1.xml" out="$TMPDIR/out.xml"
  _make_junit_xml "$xml1" 2 0 "shard0"
  _make_junit_xml "$xml2" 3 0 "shard1"
  run bash "$SCRIPT" \
    --agent "test-agent" \
    --base-ref "HEAD" \
    --shard-xmls "${xml1},${xml2}" \
    --output-xml "$out"
  [ "$status" -eq 0 ]
  [ -f "$out" ]
}

@test "全 shard PASS → output-xml に集約 XML を生成する" {
  local xml1="$TMPDIR/s0.xml" xml2="$TMPDIR/s1.xml" out="$TMPDIR/out.xml"
  _make_junit_xml "$xml1" 2 0 "shard0"
  _make_junit_xml "$xml2" 3 0 "shard1"
  run bash "$SCRIPT" \
    --agent "test-agent" \
    --base-ref "HEAD" \
    --shard-xmls "${xml1},${xml2}" \
    --output-xml "$out"
  [ "$status" -eq 0 ]
  [ -f "$out" ]
  # output XML は testsuite を含む
  grep -q "testsuite" "$out"
}

@test "shard XML に failures があれば exit 1 を返す" {
  local xml1="$TMPDIR/s0.xml" xml2="$TMPDIR/s1.xml" out="$TMPDIR/out.xml"
  _make_junit_xml "$xml1" 2 0 "shard0"
  _make_junit_xml "$xml2" 3 1 "shard1"  # 1 failure
  run bash "$SCRIPT" \
    --agent "test-agent" \
    --base-ref "HEAD" \
    --shard-xmls "${xml1},${xml2}" \
    --output-xml "$out"
  [ "$status" -ne 0 ]
  [ -f "$out" ]
}

@test "shard XML ファイルが存在しない場合は exit 1 を返す" {
  local out="$TMPDIR/out.xml"
  run bash "$SCRIPT" \
    --agent "test-agent" \
    --base-ref "HEAD" \
    --shard-xmls "/nonexistent/s0.xml,/nonexistent/s1.xml" \
    --output-xml "$out"
  [ "$status" -ne 0 ]
}

@test "3 shard XML を全て PASS で集約できる" {
  local xml1="$TMPDIR/s0.xml" xml2="$TMPDIR/s1.xml" xml3="$TMPDIR/s2.xml" out="$TMPDIR/out.xml"
  _make_junit_xml "$xml1" 3 0 "shard0"
  _make_junit_xml "$xml2" 2 0 "shard1"
  _make_junit_xml "$xml3" 2 0 "shard2"
  run bash "$SCRIPT" \
    --agent "test-agent" \
    --base-ref "HEAD" \
    --shard-xmls "${xml1},${xml2},${xml3}" \
    --output-xml "$out"
  [ "$status" -eq 0 ]
  [ -f "$out" ]
}

@test "--shard-xmls なしで --shard-total を指定する従来モードも動作する（後方互換）" {
  # --shard-total モードは .e2e-shard-NofTOTAL.json が存在しないと失敗するが、
  # 少なくとも引数解析で Unknown arg エラーが出ないことを確認
  run bash "$SCRIPT" \
    --agent "test-agent" \
    --shard-total "2" 2>&1
  # --shard-total モードでは shard JSON 不在で exit 1 になるが、
  # "Unknown arg" ではなく "shard 結果ファイル不在" のエラーになる
  echo "$output" | grep -q -v "Unknown arg"
}
