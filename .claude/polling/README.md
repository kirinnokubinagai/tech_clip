# .claude/polling/

orchestrator ポーリング用 state ディレクトリ。

## ファイル形式

`pr-<PR_NUMBER>.json`:
```json
{
  "pr_number": 123,
  "push_sha": "abc1234",
  "issue_number": 1052,
  "agent_name": "issue-1052-reviewer",
  "started_at": "2025-01-01T00:00:00Z"
}
```

## 動作

- `scripts/polling-watcher.sh` が定期実行し、各 PR の verdict を評価する
- verdict 確定時: `watcher-results.log` に記録し、state ファイルを削除する
- タイムアウト時: `polling_timeout_minutes`（config.json）経過後に state ファイルを削除する

## 登録タイミング

reviewer agent が push 直後に `pr-<PR_NUMBER>.json` を作成する。

## watcher-results.log 形式

```
POLLING_WATCHER_APPROVE: issue-1052 PR #123 at=2025-01-01T00:05:00Z
POLLING_WATCHER_CHANGES: issue-1052 PR #456 at=2025-01-01T00:10:00Z
TIMEOUT: issue-1052 PR #789 elapsed=3601s at=2025-01-01T01:00:00Z
```
