# .claude/polling/

reviewer 自己 polling 用 state ディレクトリ。

## ファイル形式

`pr-<PR_NUMBER>.json`:
```json
{
  "pr_number": 123,
  "push_sha": "abc1234",
  "issue_number": 1052,
  "agent_name": "reviewer-1052",
  "started_at": "2025-01-01T00:00:00Z"
}
```

## 動作

- reviewer agent が push 直後に `pr-<PR_NUMBER>.json` を作成する
- reviewer agent が `bash scripts/polling-watcher.sh <PR_NUMBER>` を呼び、watcher が同期的に判定を返す
- verdict 確定時: `watcher-results.log` に記録し、state ファイルを削除する
- タイムアウト時: `polling_timeout_minutes`（config.json）経過後に state ファイルを削除し `VERDICT: timeout` を返す
- `VERDICT: still_pending` 時: state ファイルは残し、reviewer は再度 watcher を呼び出す
- `VERDICT: conflict` 時: state ファイルは残し（conflict 解消後 reviewer が再呼び出し）

## watcher-results.log 形式

```
POLLING_WATCHER_APPROVE: issue-1052 PR #123 at=2025-01-01T00:05:00Z
POLLING_WATCHER_CHANGES: issue-1052 PR #456 at=2025-01-01T00:10:00Z
TIMEOUT: issue-1052 PR #789 elapsed=3601s at=2025-01-01T01:00:00Z
EXTERNAL_MERGED: issue-1052 PR #123 at=2025-01-01T00:05:00Z
CONFLICT: issue-1052 PR #456 mergeState=DIRTY at=2025-01-01T00:10:00Z
```
