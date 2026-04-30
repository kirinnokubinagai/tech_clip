---
name: harness-e2e-shard-execution
description: E2E (Maestro) を自前並列方式で実行し、per-flow 進捗を監視ループで報告する。--shard-split は使用しない（gRPC UNAVAILABLE 回避）。round-robin でフローを device ごとに分割し独立 maestro test プロセスを起動する。
triggers:
  - "harness-e2e-shard-execution"
  - "e2e shard"
  - "run-maestro-and-create-marker"
  - "e2e execution"
  - "maestro run"
---

# E2E Maestro 実行 + per-flow 進捗監視

自前並列方式（`--device` 個別起動 + round-robin flow 分割）で E2E を実行し、ログファイルから per-flow 完了を検出して STATE_UPDATE を送信する。`--shard-split` は使用しない（Maestro の gRPC UNAVAILABLE バグ回避）。

## 前提パラメータ（呼び出し元が提供）

- `{worktree}`: worktree の絶対パス
- `{issue_number}`: Issue 番号
- `{agent_name}`: 自分の名前（`e2e-reviewer-{N}`）
- `{reviewer_role}`: reviewer / infra-reviewer / ui-reviewer
- `{coder_role}`: coder / infra-engineer / ui-designer

## 手順

### 1. emulator 検出

```bash
adb devices 2>/dev/null | grep -E '^emulator-[0-9]+\s+device' | awk '{print $1}'
```

カンマ区切りに変換して `DEVICE_LIST` とする。0 台ならエラー報告。

### 2. STATE_UPDATE 送信（開始）

```
SendMessage(to: "team-lead", "STATE_UPDATE: {agent_name} — starting E2E (N devices, M flows)")
```

### 3. Maestro バックグラウンド起動

```bash
# run_in_background=true で起動（ブロッキングしない）
cd {worktree} && bash scripts/gate/run-maestro-and-create-marker.sh \
  --agent {agent_name} --device "$DEVICE_LIST"
```

**重要:**
- `run_in_background=true` で起動する。ブロッキング実行すると SendMessage が送れない
- `--device` にカンマ区切りで全 emulator を渡す。`run-maestro-and-create-marker.sh` がラウンドロビンで flow を分割し、各 device に独立した `maestro test` プロセスを背景起動する
- `--shard-split` は使用しない（gRPC UNAVAILABLE バグ回避のため）
- 旧形式の `--shard INDEX/TOTAL` は廃止済み。使わないこと
- ポート管理・driver 起動は Maestro が内部で自動処理する。`adb forward` は不要

### 4. 監視ループ（per-flow 進捗報告）

スクリプトが `.claude/.e2e-progress.json` を作成する:
```json
{
  "log_file": "/tmp/maestro-log-<sha8>-<ts>-shard0.log",
  "result_xml": "/tmp/maestro-result-<sha8>-<ts>.xml",
  "device_count": 2,
  "flow_count": 8,
  "status": "running",
  "per_shard_logs": [
    {"device": "emulator-5556", "log_file": "/tmp/...shard0.log", "result_xml": "/tmp/...shard0.xml"},
    {"device": "emulator-5558", "log_file": "/tmp/...shard1.log", "result_xml": "/tmp/...shard1.xml"}
  ]
}
```

`per_shard_logs` が存在する場合は配列の各エントリを読む。存在しない場合は従来の `log_file` を読む（後方互換）。

**agent 制御フローでループする（Bash の while/until は禁止）:**

```
reported_lines = 0

for i in 1..60:
  1. Read({worktree}/.claude/.e2e-progress.json)
     → log_file, result_xml, status を取得
  
  2. Read(<log_file>)
     → ログ全文を取得
  
  3. reported_lines 以降の新しい行を走査:
     - YAML ファイル名を含む行に以下のパターンがあれば flow 完了と判定:
       ✅ / ❌ / PASSED / FAILED / passed / failed
     - 検出した flow ごとに:
       SendMessage(to: "team-lead",
         "STATE_UPDATE: {agent_name} — flow <flow_name> PASS/FAIL")
     - reported_lines を更新
  
  4. status == "completed" → ステップ 5 へ
  
  5. Bash(`sleep 30`, run_in_background=false) で 30 秒待機
     ※ 必ず単発コマンド。SendMessage は skill ループ側で発行する
  
  6. 次 iteration へ

60 iteration でも完了しない場合:
  SendMessage(to: "team-lead", "STATE_UPDATE: {agent_name} — TIMEOUT (30 min)")
  → 失敗扱いで CHANGES_REQUESTED へ
```

### 5. 完了処理

```
1. Read(<result_xml>) で JUnit XML を確認
   - tests="N" failures="N" errors="N" を抽出

2. 全 flow PASS (failures=0, errors=0):
   → SendMessage(to: "team-lead",
       "STATE_UPDATE: {agent_name} — E2E done, result=PASS (passed=P/total=T)")
   → SendMessage(to: "issue-{issue_number}-{reviewer_role}",
       "e2e-approved: <hash>")
   → shutdown

3. FAIL あり:
   → SendMessage(to: "team-lead",
       "STATE_UPDATE: {agent_name} — E2E done, result=FAIL (passed=P/total=T)")
   → 失敗した flow 名と failure message を RESULT_XML から抽出
   → SendMessage(to: "issue-{issue_number}-{coder_role}",
       "CHANGES_REQUESTED: E2E failures:\n- <flow_name>: <failure_message>\n...")
   → impl-ready 再待機
```

## 監視ループの実装制約

- **Bash の `until` / `while` ループ内に監視ロジックを書かない** — Bash がブロッキングのため SendMessage が打てなくなる
- **agent は監視ループ 1 iteration ごとに skill ツールに戻り**、Read + SendMessage を発行する
- **`sleep 30` は単発 Bash コマンド** として呼ぶ。sleep 中に他のツール呼び出しをしない

## 自前並列方式のしくみ

- `run-maestro-and-create-marker.sh` が YAML ファイルを round-robin で分割し、device ごとに `maestro test --device <single_device> <flows...>` を背景起動
- `--shard-split` は使用しない（Maestro の gRPC UNAVAILABLE バグ回避）
- 各 shard は独立した JUnit XML `/tmp/maestro-result-<sha8>-<ts>-shard${N}.xml` に出力
- `aggregate-e2e-shards.sh --shard-xmls ... --output-xml ...` で shard XML を結合して単一 RESULT_XML を生成
- ログ（stdout）は各 shard ごとに `/tmp/maestro-log-<sha8>-<ts>-shard${N}.log` に出力

## CI 側（参考）

`.github/workflows/pr-e2e-android.yml` は matrix 戦略で N shard を並列実行:
- `SHARD_INDEX/SHARD_TOTAL` 環境変数を `scripts/ci/run-android-e2e.sh` に渡す
- CI 側は GitHub Actions runner 上の単一 emulator 実行のため、ローカルの native parallel とは別のしくみ
