---
name: review-merged-cleanup
description: フェーズ 7: PR マージ検知 → Issue クローズ → worktree 削除 → APPROVED 通知。reviewer/infra-reviewer/ui-reviewer 共通。
triggers:
  - "review-merged-cleanup"
  - "review/merged-cleanup"
  - "マージ後片付け"
---

# マージ後クリーンアップスキル

polling-watcher の stdout から `VERDICT: external_merged PR #N` を取得した後、または PR が MERGED 状態になったことを確認した後に実行する。

このスキルを呼び出す前に以下がコンテキストに存在すること:
- `{worktree}`: worktree の絶対パス
- `{issue_number}`: Issue 番号
- `{PR_NUMBER}`: PR 番号
- `{impl_agent_name}`: 実装エージェント名

## 手順

### 1. 関連エージェントに shutdown を通知

PR がマージされた後、Issue に紐づく以下 3 体のサブエージェントに必ず shutdown_request を送る:

```
SendMessage(to: "{impl_agent_name}",                     {"type": "shutdown_request"})
SendMessage(to: "issue-{issue_number}-analyst",          {"type": "shutdown_request"})
SendMessage(to: "issue-{issue_number}-e2e-reviewer",     {"type": "shutdown_request"})
```

順序は問わないが 3 体すべてに送ることを保証する。受信側がすでに終了している場合は配送に失敗してもこのフローは継続する（best-effort）。

**例外**: 複数 lane の場合、`{impl_agent_name}` は spawn 時の lane 付き名（例: `issue-1234-coder-flatten`, `issue-1234-coder-lifecycle`）の **全 lane 分** に送る。受信した issue の coder 系 lane を `gh` / spawn 履歴 / 受信した impl-ready 元から把握できない場合は、`{impl_agent_name}` 単一名で代用してよい（best-effort）。

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
