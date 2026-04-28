---
name: review-conflict-check
description: impl-ready 受信時のコンフリクトチェック。analyst 存在確認、C-1 監査、origin/main との merge テスト。コンフリクトあり時は analyst に CONFLICT_INVESTIGATE を送信。reviewer/infra-reviewer/ui-reviewer 共通。
triggers:
  - "review-conflict-check"

  - "review-conflict-check"
  - "コンフリクトチェック"
---

# コンフリクトチェックスキル

`impl-ready:` を受信した場合のみ実行する（`CONFLICT_RESOLVED:` 受信時はスキップ）。

このスキルを呼び出す前に以下がコンテキストに存在すること:
- `{worktree}`: worktree の絶対パス
- `{impl_agent_name}`: 実装エージェント名（例: `issue-1056-coder`）
- `{issue_number}`: Issue 番号

## 手順

```sh
WORKTREE={worktree} \
ISSUE_NUMBER={issue_number} \
bash scripts/skills/conflict-check.sh
```

### 出力に応じた処理

- `WARNING:analyst_missing:...` → orchestrator に以下を送信（作業は止めない）:
  ```
  SendMessage(to: "orchestrator", "WARNING: issue-{issue_number}-analyst が team 内に存在しません。")
  ```

- `WARNING:multiple_impl:...` → orchestrator に以下を送信（作業は止めない）:
  ```
  SendMessage(to: "orchestrator", "WARNING: issue-{issue_number} に実装系エージェントが複数存在します。")
  ```

- 終了コード `1`（`CONFLICT:files=...`）→ analyst に CONFLICT_INVESTIGATE を送信してフェーズ 0 に戻る:
  ```
  SendMessage(to: "issue-{issue_number}-analyst",
    "CONFLICT_INVESTIGATE: origin/main との間に conflict が発生しました。両側の変更意図を調査して {impl_agent_name} に両立方針を渡してください。ファイル: <files>")
  ```
  > **⚠️ analyst デッドロック対策**: SendMessage が `no agent found` になる場合は orchestrator に送信してフェーズ 0 で待機:
  > `STUCK: issue-{issue_number} analyst が終了済みのため conflict 解消できません。PR: {PR_URL}`

- 終了コード `0`（`OK:no_conflict`）→ 次フェーズへ進む
