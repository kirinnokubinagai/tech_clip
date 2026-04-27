---
name: lint-commit-notify
description: フェーズ 3-5: lint → commit → reviewer に impl-ready 通知。coder/infra-engineer/ui-designer 共通。
triggers:
  - "impl/lint-commit-notify"
  - "lint-commit通知"
---

# lint・commit・通知スキル

実装完了後、lint を通してコミットし、reviewer に impl-ready を通知する。

このスキルを呼び出す前に以下がコンテキストに存在すること:
- `{worktree}`: worktree の絶対パス
- `{reviewer_agent_name}`: レビュワーエージェント名（`issue-{N}-reviewer` 等）

## 手順

### 1. lint チェック

```
WORKTREE={worktree} bash scripts/skills/lint-commit-notify.sh
```

### 出力に応じた処理

- `ERROR:lint_failed` → lint エラー内容を読み修正する。修正後このスキルを再実行
- `ERROR:uncommitted_changes:...` → ファイルが commit されていない。`git add` して commit してから再実行
- `OK:hash=<hash>` → ステップ 2 へ進む

### 2. reviewer に impl-ready 通知

```
SendMessage(to: "{reviewer_agent_name}", "impl-ready: <hash>")
```

### 3. CHANGES_REQUESTED 待機

reviewer からの応答を待機する:

| 受信メッセージ | アクション |
|---|---|
| `CHANGES_REQUESTED: <内容>` | 指摘内容を修正 → このスキルを再実行 |
| `CONFLICT_RESOLVE: spec=<path>` | `impl/conflict-resolve-loop` スキルへ進む |
| `shutdown_request` | 終了する |
