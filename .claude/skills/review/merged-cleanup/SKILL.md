---
name: merged-cleanup
description: フェーズ 7: PR マージ検知 → Issue クローズ → worktree 削除 → APPROVED 通知。reviewer/infra-reviewer/ui-reviewer 共通。
triggers:
  - "review/merged-cleanup"
  - "マージ後片付け"
---

# マージ後クリーンアップスキル

polling-watcher から `VERDICT: external_merged PR #N` を受信した後、または PR が MERGED 状態になったことを確認した後に実行する。

このスキルを呼び出す前に以下がコンテキストに存在すること:
- `{worktree}`: worktree の絶対パス
- `{issue_number}`: Issue 番号
- `{PR_NUMBER}`: PR 番号
- `{impl_agent_name}`: 実装エージェント名

## 手順

### 1. 実装エージェントに shutdown を通知

```
SendMessage(to: "{impl_agent_name}", {"type": "shutdown_request"})
```

### 2. クリーンアップ実行

```
WORKTREE={worktree} ISSUE_NUMBER={issue_number} PR_NUMBER={PR_NUMBER} bash scripts/skills/merged-cleanup.sh
```

### 出力に応じた処理

- `OK:cleanup_done:issue=N` → 正常完了。ステップ 3 へ進む
- `WORKTREE_REMOVE_FAILED:path=<path>` → worktree 削除失敗。ステップ 3 を実行後、orchestrator に通知:
  ```
  SendMessage(to: "orchestrator", "WORKTREE_REMOVE_FAILED: {worktree} の手動削除が必要です")
  ```

### 3. orchestrator に APPROVED 通知

```
SendMessage(to: "orchestrator", "APPROVED: issue-{issue_number}")
```

その後このエージェントは終了する。
