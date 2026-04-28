---
name: harness-agent-cleanup
description: PR MERGED 後のサブエージェント終了順序、worktree 削除 fallback、team config エントリ除去、orchestrator への APPROVED 通知の手順。reviewer が完遂する責務。orchestrator は通常これを実行しない（マージ済 Issue の agent が残った場合のセーフティネットのみ）。
triggers:
  - "harness/agent-cleanup"
  - "shutdown_request"
  - "APPROVED"
  - "worktree削除"
  - "agent終了"
  - "merged-cleanup"
---

# Issue ごとのサブエージェント終了順序

PR がマージされて Issue がクローズされたら、その Issue に紐づく全サブエージェントを終了させ、worktree を削除し、team config からエントリを除去する。**通常は reviewer 系サブエージェントが完遂する**。orchestrator が手を出すのはセーフティネット時のみ。

## 通常フロー（reviewer が完遂）

1. reviewer → PR MERGED を検知する（polling-watcher の VERDICT: approved）
2. reviewer → analyst / 実装系サブエージェント（coder / infra-engineer / ui-designer）に `shutdown_request` 送信（冪等: 既に終了していても no-op）
3. reviewer → e2e-reviewer が存在する場合はそれにも `shutdown_request` 送信
4. reviewer → worktree を削除する（fallback 付き、後述）
5. reviewer → team config から当該 Issue のサブエージェントエントリを除去する
6. reviewer → orchestrator に `SendMessage("APPROVED: issue-{N}")` → reviewer 終了
7. orchestrator → ユーザーに「Issue #N が APPROVED されました（残り pending_count 件）」と報告 → 次バッチ判定（`harness/proactive-issue-triage`）

## worktree 削除の fallback

reviewer は以下を順に試す:

1. `git worktree remove --force {worktree}` で強制削除
2. 失敗 → `git worktree prune` を実行後、再度 `git worktree remove --force` を試みる
3. 失敗 → `rm -rf` でディレクトリを強制削除し `worktree prune` を実行する（**`issue-<N>` 形式の絶対パスのみ対象**、安全のため）
4. それでも残存 → orchestrator に `WORKTREE_REMOVE_FAILED` を通知

## shutdown_request の形式

`shutdown_request` はプロトコル応答扱いのため、構造化された JSON オブジェクトを渡す（他の `SendMessage` 例のような平文文字列ではない）:

```text
SendMessage(to: "issue-{N}-analyst",  { type: "shutdown_request" })
SendMessage(to: "issue-{N}-coder",    { type: "shutdown_request" })
SendMessage(to: "issue-{N}-e2e-reviewer", { type: "shutdown_request" })
```

受信側は `type` フィールドで判別し、`shutdown_response` (`approve: true`) を返してから即終了する。

## orchestrator のセーフティネット

reviewer の APPROVED フローが何らかの理由で完了しなかった場合のみ、orchestrator が以下を行う:

1. `gh pr view <N> --json state` で `MERGED` または `CLOSED` を確認
2. 該当 Issue の team config エントリ（`issue-{N}-*`）を列挙
3. 各エントリに `shutdown_request` を送信
4. worktree が残っていれば手動削除
5. team config から該当エントリを除去

なお SessionStart 時には `clean-stale-team-members.sh` hook が PR マージ済み / クローズ済み Issue のメンバーを team config から自動除去する。orchestrator はその出力を確認し、想定外の残存があればユーザーに報告する。

## 既存メンバーの再 spawn 判定

team config に `issue-{N}-{role}` が残っている → そのまま継続稼働中とみなす。同名 spawn は禁止（重複の原因）。

該当 Issue に新たな指示（CHANGES_REQUESTED / impl-ready 等）を送るときは、既存 agent に SendMessage で通知する。

既存 agent が本当に死んでいる疑いがあるとき（user 報告 / `gh pr view` で push が長時間止まっている等）は、`AskUserQuestion` でユーザーに再 spawn の可否を確認する。**独断での再 spawn は禁止**。

## 関連 skill

- 既存マージ後 cleanup: `review/merged-cleanup`
- worktree 自動管理: `harness/worktree-management`
- 次 Issue spawn: `harness/proactive-issue-triage`
