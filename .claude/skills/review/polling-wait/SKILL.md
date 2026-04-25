---
name: polling-wait
description: フェーズ 6: polling state ファイル作成 → VERDICT 待機ループ。approve/request_changes/CONFLICT_DETECTED/BEHIND 自動追従を処理。reviewer/infra-reviewer/ui-reviewer 共通。
triggers:
  - "review/polling-wait"
  - "polling待機"
---

# polling 待機スキル

push 完了後に polling state ファイルを作成し、`polling-watcher` からの VERDICT を待機する。

このスキルを呼び出す前に以下がコンテキストに存在すること:
- `{worktree}`: worktree の絶対パス
- `{issue_number}`: Issue 番号
- `{impl_agent_name}`: 実装エージェント名
- `{PR_NUMBER}`: フェーズ 5 で確定した PR 番号

## 手順

### 1. polling state ファイル作成

```
WORKTREE={worktree} ISSUE_NUMBER={issue_number} PR_NUMBER={PR_NUMBER} AGENT_NAME="issue-{issue_number}-reviewer" bash scripts/skills/polling-state-create.sh
```

### 2. VERDICT 待機

`polling-watcher`（CronCreate で 2 分毎起動）から SendMessage を待機する。

| メッセージ | アクション |
|---|---|
| `VERDICT: approve PR #N passed` | → ステップ 3（BEHIND 追従チェック）へ |
| `VERDICT: request_changes PR #N` | → ステップ 4 へ |
| `VERDICT: external_merged PR #N` | → フェーズ 7 へ |
| `VERDICT: closed PR #N` | → `{impl_agent_name}` に `CLOSED_WITHOUT_MERGE` 通知 → フェーズ 0 |
| `POLLING_TIMEOUT: PR #N` | → ステップ 5 へ |
| `CONFLICT_DETECTED: PR #N ...` | → ステップ 6 へ |

### 3. approve 後 — BEHIND 自動追従チェック

```
WORKTREE={worktree} ISSUE_NUMBER={issue_number} PR_NUMBER={PR_NUMBER} AGENT_NAME="issue-{issue_number}-reviewer" bash scripts/skills/behind-followup.sh
```

- 終了コード `0`（`OK:behind_resolved`）→ VERDICT 再待機（ステップ 2 に戻る）
- 終了コード `1`（`CONFLICT`）→ analyst に `CONFLICT_INVESTIGATE` 送信、polling state 削除 → フェーズ 0
- 終了コード `2`（`OK:state=CLEAN` 等）→ フェーズ 6.5 へ進む

### 4. request_changes 受信時

bot レビューコメントを取得する:

```
PR_NUMBER={PR_NUMBER} bash scripts/skills/get-bot-comment.sh
```

出力をそのまま以下に渡す:

```
SendMessage(to: "{impl_agent_name}", "CHANGES_REQUESTED: <スクリプト出力内容>")
```

polling state ファイルを削除して → フェーズ 0 に戻る

### 5. POLLING_TIMEOUT 受信時

orchestrator に通知して終了する:

```
SendMessage(to: "orchestrator",
  "POLLING_TIMEOUT: issue-{issue_number} は 60 分以内に解決しませんでした。PR: {PR_URL}")
```

### 6. CONFLICT_DETECTED 受信時

analyst に通知する（polling state ファイルはそのまま残す）:

```
SendMessage(to: "issue-{issue_number}-analyst",
  "CONFLICT_INVESTIGATE: polling-watcher が PR #{PR_NUMBER} の mergeStateStatus=DIRTY を検知しました。{impl_agent_name} に両立解消方針を渡してください。")
```

→ フェーズ 0 に戻り `CONFLICT_RESOLVED` を待つ
