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
- ruleset の required check を `auto-merge` から `ci-gate` に変更

`ci-gate` は自身が SUCCESS/FAILURE を返すため SKIPPED にならず、required check として安定する。

## required status check

ruleset `main-protection-with-admin-bypass`（id: 14698666）の required:

```
ci-gate
```

GitHub の required status check context は `<job name>` 形式で、この ruleset では `ci-gate`。
ワークフローの表示名は `CI` だが、workflow 名・matrix・event trigger type は required context に含まれない。
GitHub API の check-runs でも PR #1172・#1174 の name は `ci-gate` と確認できる。

`ci-gate` 以外の文字列を required にすると実在する check run と一致せず、green の PR も BLOCKED になる。

変更手順（順序厳守）:
1. 対象 PR の check-runs に name=`ci-gate` が存在することを確認
2. この PR をマージ
3. `bash scripts/update-main-ruleset.sh` を手動実行

⚠️ `REQUIRED_CHECK` を上書きする場合も、check-runs API が返す完全一致の job 名だけを指定する。

## イベント別動作

| イベント | claude-review | ci-gate | auto-merge |
|---|---|---|---|
| PR（PASS） | success | success | 実行 |
| PR（needs_work=true） | success | failure | スキップ |
| PR（path-skip） | success | success（checks/zap=skipped 許容） | 実行 |
| push to main | skipped | success（skipped 許容） | スキップ（PR でないため） |
| dependabot PR | success | success | スキップ（actor チェック） |

## スクリプト

- `scripts/update-main-ruleset.sh` — ruleset required check を `ci-gate` に差し替える冪等スクリプト。環境変数 `REPO` / `RULESET_ID` / `REQUIRED_CHECK` で上書き可能。

## stacked PR（base != main）対応

### 背景

`.github/workflows/ci.yml` は `pull_request.branches: [main, 'issue/**']` を trigger としている。
これは「base branch が `main` もしくは `issue/**` にマッチする PR でのみ CI を発火させる」という指定。

従来は `branches: [main]` のみだったため、base=`issue/<N>` の stacked PR では CI ワークフローが発火せず、
reviewer エージェントが claude-review 結果を待ち続けて 30 分 timeout で STUCK するインシデントが発生した（Issue #1040）。

### 挙動

| PR の base | CI 発火 | claude-review | 備考 |
|---|---|---|---|
| `main` | ✅ 発火 | ✅ 実行 | 従来通り |
| `issue/<N>` / `issue/<N>/<desc>` | ✅ 発火 | ✅ 実行 | stacked PR 対応（Issue #1040） |
| その他（例: `release/**`） | ❌ 発火しない | ❌ スキップ | 必要になった時点で branches パターンを追加 |

### 将来の拡張

`release/**` / `hotfix/**` 等の新 prefix を導入する場合は `branches:` にパターンを追加する。
`branches:` を省略して全 PR を対象にする案もあるが、想定外の base branch への PR で
claude-review の OAuth トークンが消費されるリスクがあるため採用しない。

## polling-watcher による verdict 判定（Issue #1052）

### 変更内容

reviewer エージェントが直接 CI をポーリングするのではなく、`scripts/polling-watcher.sh` が
CronCreate で 2 分毎に実行されて判定する新アーキテクチャに移行した（Issue #1052）。

詳細は `docs/POLLING_ARCHITECTURE.md` を参照。

### 適用外 PR の手動レビューモード（Part A）

以下の PR は claude-review が動かないため、reviewer が「手動レビューモード」に自動遷移する：

| PR の種類 | 理由 | 検知方法 |
|---|---|---|
| `.github/workflows/` 変更 PR | GitHub Actions の workflow validation で bot レビューがスキップされる | `gh pr diff --name-only` でパス検知 |
| stacked PR（base != main） | `.claude/config.json` の `stacked_pr_base_excludes` で定義 | PR の base branch チェック |

手動モードでは reviewer は人間レビュアーの判定を直接確認して処理を続行する。

### verdict 判定の 3 条件 AND ロジック

| 条件 | 内容 |
|---|---|
| 条件1 | CI workflow run が completed（cancelled 除く） |
| 条件2 | claude-review job が terminated（success または failure） |
| 条件3 | AI Review ラベル付与 AND claude-review 完了後の判定コメント存在 |

全条件が揃った時点で `approve` または `request_changes` を verdict として確定する。
