---
name: review-polling-wait
description: フェーズ 6: polling state ファイル作成 → polling-watcher を同期呼び出しして VERDICT を取得するループ。approve/request_changes/conflict/behind 自動追従を処理。reviewer/infra-reviewer/ui-reviewer 共通。
triggers:
  - "review-polling-wait"

  - "review-polling-wait"
  - "polling待機"
---

# polling 待機スキル

push 完了後に polling state ファイルを作成し、`polling-watcher` を同期的に呼び出して VERDICT を取得する。

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

### 2. polling-watcher を同期呼び出し（Fix F: 連続ポーリング）

**重要**: `polling-watcher.sh` は MERGED / APPROVED / TIMEOUT になるまで内部ループで回り続ける。
Bash ツール呼び出しは **1 回** のみ実行する（agent-side ループ不要）。
Bash ツール呼び出しには `timeout: 600000`（10 分）を指定すること（タイムアウトは config の `polling_timeout_minutes` で制御）。

```bash
OUTPUT=$(bash scripts/polling-watcher.sh "{PR_NUMBER}" "{worktree}")
VERDICT_LINE=$(echo "$OUTPUT" | grep -E '^VERDICT: ' | tail -1)
```

`VERDICT_LINE` の値に応じて以下のアクションを取る。

| VERDICT | アクション |
|---|---|
| `VERDICT: approve PR #N` | → ステップ 3（BEHIND 追従チェック）へ |
| `VERDICT: request_changes PR #N` | → ステップ 4 へ |
| `VERDICT: external_merged PR #N` | → フェーズ 7 へ |
| `VERDICT: closed PR #N` | → `{impl_agent_name}` に `CLOSED_WITHOUT_MERGE` 通知 → フェーズ 0 |
| `VERDICT: timeout PR #N elapsed=Xs` | → ステップ 5 へ |
| `VERDICT: conflict PR #N` | → ステップ 6 へ |
| `VERDICT: error ...` | → ステップ 5 として扱い orchestrator に報告 |

**冪等性・再開について:**
- reviewer が再 spawn された場合、state ファイルが残っていれば `bash scripts/polling-watcher.sh <PR_NUMBER>` を呼び直すだけで polling を再開できる
- state ファイルが無ければ push がまだ起きていないことを示すので、フェーズ 0 から再開する

### 3. approve 後 — BEHIND 自動追従チェック

```
WORKTREE={worktree} ISSUE_NUMBER={issue_number} PR_NUMBER={PR_NUMBER} AGENT_NAME="issue-{issue_number}-reviewer" bash scripts/skills/behind-followup.sh
```

- 終了コード `0`（`OK:behind_resolved`）→ ステップ 1 に戻る（state ファイル再作成 → polling 再開）
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

### 5. timeout / error 受信時

orchestrator に通知して終了する:

```
SendMessage(to: "orchestrator",
  "POLLING_TIMEOUT: issue-{issue_number} は 60 分以内に解決しませんでした。PR: {PR_URL}")
```

### 進捗通知（orchestrator への STATE_UPDATE、必須）

polling-watcher を呼んで verdict / state を取得するたびに、**orchestrator (team-lead) にも必ず以下を送信** すること:

```
SendMessage(to: "team-lead",
  "STATE_UPDATE: PR #{PR_NUMBER} verdict=<approve|request_changes|still_pending|conflict|timeout|...> failed=[<failed checks>] success=[<succeeded checks>] in_progress=[<in_progress checks>]")
```

- still_pending で再 polling する場合も、**前回 iteration から状態に変化があれば** 毎回送信する
- 全 check が COMPLETED かつ全 SUCCESS で initial approve に至ったら、その旨も明記
- failed のみならず success / in_progress も含めて通知する（orchestrator が CI 進捗を可視化できるよう）

**意図**: skill 設計上 reviewer → coder のみに verdict が伝わる構造を、orchestrator にも見えるようにするため。本暫定運用は将来 polling-watcher の snapshot mode が完成したら自動化される予定。

### 6. conflict 受信時

analyst に通知する（polling state ファイルはそのまま残す）:

```
SendMessage(to: "issue-{issue_number}-analyst",
  "CONFLICT_INVESTIGATE: polling-watcher が PR #{PR_NUMBER} の mergeStateStatus=DIRTY を検知しました。{impl_agent_name} に両立解消方針を渡してください。")
```

→ フェーズ 0 に戻り `CONFLICT_RESOLVED` を待つ
