# CI アーキテクチャ

## Job 構成

```
claude-review ──┐
changes ────────┼──> checks ────┐
                │    hooks-test ─┼──> ci-gate ──> auto-merge
                └──> zap ───────┘
```

`checks` / `hooks-test` / `zap` はいずれも `needs: [claude-review, changes]` を持つため、
`claude-review` → `checks` の依存関係が図に反映されています。

| Job | トリガー | 役割 |
|---|---|---|
| `claude-review` | PR のみ | AI コードレビュー・ラベル付与 |
| `changes` | 常時 | 変更ファイル検出（code/hooks フラグ出力） |
| `checks` | code 変更時 + needs_work=false | lint/typecheck/test/audit |
| `hooks-test` | hooks 変更時 + needs_work=false | bats テスト |
| `zap` | PR + code 変更時 + needs_work=false | ZAP セキュリティスキャン |
| `ci-gate` | 常時（`if: always()`） | 全 job 合否集約・required status check |
| `auto-merge` | ci-gate success + PR + non-dependabot | PR 自動マージ |

## ci-gate と auto-merge の分離（Issue #998）

### 解消した問題

従来の `auto-merge` は required status check とマージアクションを兼ねていた。
`claude-review` が改善提案を出すと `needs_work=true` → `auto-merge` が SKIPPED になり、
SKIPPED が required check の fail 扱いとなって PR が BLOCKED になる循環が発生した。

### 解決策

- `ci-gate` job を新設（`if: always()` で必ず実行、SUCCESS/FAILURE を明示出力）
- `auto-merge` は `ci-gate` 成功時のみ動作する単純なマージ操作に縮小
- ruleset の required check を `CI / auto-merge` から `CI / ci-gate` に変更

`ci-gate` は自身が SUCCESS/FAILURE を返すため SKIPPED にならず、required check として安定する。

## required status check

ruleset `main-protection-with-admin-bypass`（id: 14698666）の required:

```
CI / ci-gate
```

変更手順（順序厳守）:
1. この PR をマージ（`CI / ci-gate` が CI 上に存在する状態にする）
2. `bash scripts/update-main-ruleset.sh` を手動実行

⚠️ 逆順で実行すると `CI / ci-gate` が存在しない状態で required になり全 PR が BLOCKED になる。

## ロールバック / 緊急復旧

`CI / ci-gate` が存在しない、または誤った context が required になって全 PR が BLOCKED になった場合の手順:

### required status check を旧 context に戻す

```bash
REQUIRED_CHECK="CI / auto-merge" bash scripts/update-main-ruleset.sh
```

### required status check を一時的に無効化する

```bash
RULESET_ID=14698666
REPO=kirinnokubinagai/tech_clip
current=$(gh api "repos/${REPO}/rulesets/${RULESET_ID}")
payload=$(echo "$current" | jq '
  . + {
    rules: [.rules[] | select(.type != "required_status_checks")]
  }
')
echo "$payload" | gh api --method PUT "repos/${REPO}/rulesets/${RULESET_ID}" --input -
```

無効化後に正しい context で `scripts/update-main-ruleset.sh` を再実行すること。

## イベント別動作

| イベント | claude-review | ci-gate | auto-merge |
|---|---|---|---|
| PR（PASS） | success | success | 実行 |
| PR（needs_work=true） | success | failure | スキップ |
| PR（path-skip） | success | success（checks/zap=skipped 許容） | 実行 |
| push to main | skipped | success（skipped 許容） | スキップ（PR でないため） |
| dependabot PR | success | success | スキップ（actor チェック） |

## スクリプト

- `scripts/update-main-ruleset.sh` — ruleset の `required_status_checks` タイプのみを `CI / ci-gate` に差し替える冪等スクリプト。他の rule type (pull_request / non_fast_forward / deletion 等) は保持する。環境変数 `REPO` / `RULESET_ID` / `REQUIRED_CHECK` で上書き可能。
