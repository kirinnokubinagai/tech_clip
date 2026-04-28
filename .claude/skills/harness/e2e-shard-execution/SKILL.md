---
name: harness-e2e-shard-execution
description: E2E (Maestro) を 4 shard 並列実行する手順。disk 空き容量が逼迫している場合は 2 shard に自動 fallback する。各 shard は別 emulator で flow 集合を実行し、代表 e2e-reviewer が aggregator スクリプトで `.e2e-passed` を生成する。
triggers:
  - "harness/e2e-shard-execution"
  - "shard"
  - "shard-flows"
  - "run-maestro-and-create-marker"
  - "aggregate-e2e-shards"
  - "e2e shard"
---

# E2E shard 並列実行（4 shard デフォルト・disk 逼迫時 2 shard）

E2E (Maestro) を flow shard 単位で並列実行することで、フィードバックを高速化する。

## デフォルト shard 数

- **shard_total = 4**（標準）
- disk 空き容量が逼迫している場合は **shard_total = 2** に fallback
- 単一 emulator しかない場合は **shard_total = 1**（aggregator 不要、従来動作）

shard_total の決定は orchestrator が spawn 時に行う（spawn プロンプトの `shard_total: N` で渡す）。判定基準は次のとおり:

```bash
# disk 空き判定の参考（df 系コマンドで $HOME を確認）
AVAIL_GB=$(df -g "$HOME" | awk 'NR==2 {print $4}')
if [ "$AVAIL_GB" -lt 30 ]; then
  echo "shard_total=2"  # 30GB 未満は 2 shard
else
  echo "shard_total=4"  # 30GB 以上は 4 shard
fi
```

## CI 側（`.github/workflows/pr-e2e-android.yml`）

`pr-e2e-android.yml` は matrix 戦略で N shard を並列実行する:

- `SHARD_INDEX/SHARD_TOTAL` 環境変数を `scripts/ci/run-android-e2e.sh` に渡す
- shard 分配は `scripts/ci/shard-flows.sh` がラウンドロビンで決定
- 各 shard は `test-results/junit-shard{N}of{TOTAL}.xml` を出力
- `e2e-aggregate` ジョブが集約 junit + 失敗判定を行う

GitHub Actions 上のリソースは潤沢なため、CI では基本 4 shard を使用する。

## ローカル側

orchestrator は利用可能 emulator 数 + disk 空きを確認した上で、必要なら `Agent` で `issue-{N}-e2e-reviewer-shard1`, `-shard2`, `-shard3`, `-shard4` を spawn する。

各 e2e-reviewer は次のコマンドを実行する:

```bash
bash scripts/gate/run-maestro-and-create-marker.sh --agent <name> --shard <N>/<TOTAL>
```

shard 単位の結果は `.claude/.e2e-shard-{N}of{TOTAL}.json` に書き出される。

## 集約処理（代表 e2e-reviewer = shard1）

全 shard 完了後、代表 e2e-reviewer (shard1) が aggregator を実行する:

```bash
bash scripts/gate/aggregate-e2e-shards.sh --agent <name> --shard-total <TOTAL>
```

- 全 shard PASS かつ HEAD SHA 一致時に `.claude/.e2e-passed`（HEAD SHA 1 行）を生成
- その後 reviewer へ `e2e-approved: <hash>` を送信
- 1 shard でも FAIL なら aggregator が exit 1 → 代表 e2e-reviewer が CHANGES_REQUESTED を coder に返す

## shard_total = 1 の場合

`--shard` を省略 = `1/1` 扱い。aggregator は不要で、`run-maestro-and-create-marker.sh` 内で直接 `.e2e-passed` を生成する。従来動作と同じ。

## 関連 skill

- マーカー: `harness/gate-markers`
- 多レーン並列: `harness/multi-lane-parallel`
- spawn フロー: `harness/spawn-flow`
