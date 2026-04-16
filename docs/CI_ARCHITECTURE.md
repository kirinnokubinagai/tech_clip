# CI アーキテクチャ

## Job 構成

```
claude-review ──┐
changes ────────┼──> checks ────┐
                │    hooks-test ─┼──> ci-gate ──> auto-merge
                └──> zap ───────┘
```

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

## イベント別動作

| イベント | claude-review | ci-gate | auto-merge |
|---|---|---|---|
| PR（PASS） | success | success | 実行 |
| PR（needs_work=true） | success | failure | スキップ |
| PR（path-skip） | success | success（checks/zap=skipped 許容） | 実行 |
| push to main | skipped | success（skipped 許容） | スキップ（PR でないため） |
| dependabot PR | success | success | スキップ（actor チェック） |

## スクリプト

- `scripts/update-main-ruleset.sh` — ruleset required check を `CI / ci-gate` に差し替える冪等スクリプト。環境変数 `REPO` / `RULESET_ID` / `REQUIRED_CHECK` で上書き可能。
