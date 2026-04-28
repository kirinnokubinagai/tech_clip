---
name: lint-commit-notify
description: 実装完了後の lint → commit → e2e-reviewer に impl-ready 通知。coder/infra-engineer/ui-designer 共通。新設計では送信先は常に e2e-reviewer（reviewer 直送はしない）。
triggers:
  - "impl/lint-commit-notify"
  - "lint-commit通知"
---

# lint・commit・通知スキル

実装完了後、lint を通してコミットし、**e2e-reviewer に** impl-ready を通知する。

このスキルを呼び出す前に以下がコンテキストに存在すること:
- `{worktree}`: worktree の絶対パス
- `{issue_number}`: Issue 番号（送信先 `issue-{N}-e2e-reviewer` を組み立てるため）

## 手順

### 1. lint チェック + commit + self-check

```
WORKTREE={worktree} bash scripts/skills/lint-commit-notify.sh
```

出力に応じた処理:

- `ERROR:lint_failed` → lint エラー内容を読み修正 → 再実行
- `ERROR:uncommitted_changes:...` → `git add` して commit → 再実行
- `OK:hash=<hash>` → ステップ 2 へ

### 2. e2e-reviewer に impl-ready 通知

```
SendMessage(to: "issue-{issue_number}-e2e-reviewer", "impl-ready: <hash>")
```

レーン並列モードの場合は lane 情報を付ける:

```
SendMessage(to: "issue-{issue_number}-e2e-reviewer", "impl-ready: <hash> lane={lane-name}")
```

**reviewer / infra-reviewer / ui-reviewer に直送してはならない**。e2e-reviewer がフェーズ 0 で `evaluate-paths.sh` を実行し、E2E 影響なしなら自動的に reviewer 系へ `e2e-approved` を転送する。

### 3. 返答待機

`impl/await-feedback` skill に進む（CHANGES_REQUESTED / CONFLICT_RESOLVE / shutdown_request の待機ループ）。
