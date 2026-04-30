---
name: harness-push-protocol
description: reviewer 系サブエージェントが push するときの公式手順。push-verified.sh が lint/typecheck/test → marker 検証 → push → polling-watcher 起動を 1 コマンドで完遂し、reviewer は VERDICT 受信まで同期 wait する。orchestrator は ping を送らない。
triggers:
  - "harness-push-protocol"

  - "harness-push-protocol"
  - "push-verified"
  - "polling-watcher"
  - "push手順"
---

# push-verified.sh と reviewer 自己 polling

reviewer / infra-reviewer / ui-reviewer の push は **必ず `bash scripts/push-verified.sh` を経由** する。`git push origin HEAD` の直接実行は禁止。

## marker 必須範囲 (#1138 branch 戦略)

- feature/* / issue/* → stage の PR: marker 不要 (CI gate が check)
- stage → main の PR: `.review-passed` + `.e2e-passed` 必須 (reviewer 系のみ作成可)

`pre-push-review-guard.sh` / `pre-push-e2e-guard.sh` は `stage` / `main` branch 以外からの push を自動 skip する。

## push-verified.sh の動作（1 コマンド完遂）

1. lint / typecheck / test を実行
2. marker (`.claude/.review-passed`) の SHA == HEAD SHA を検証
3. `git push origin HEAD` を実行
4. push 完了直後に `polling-watcher.sh <PR_NUMBER>` をバックグラウンド起動（reviewer プロセス内で `&` 起動 + PID 管理）
5. polling-watcher が VERDICT を `.claude/polling/pr-<PR>.verdict` に書き出すまで同期的に wait
6. VERDICT を stdout に流して exit

これにより reviewer は push 直後にそのまま polling 待機に入り、orchestrator からの ping や CronCreate を一切必要としない。

## polling-watcher の VERDICT

`scripts/polling-watcher.sh <PR_NUMBER>` は内部で最大 9 分間、INTERVAL 秒毎に PR 状態を評価し、最終的に以下のいずれかを出力して exit する:

- `VERDICT: approved PR #<N>` → reviewer は cleanup フェーズへ（`harness-agent-cleanup`）
- `VERDICT: changes_requested PR #<N>` → reviewer は coder に CHANGES_REQUESTED を送る
- `VERDICT: timeout PR #<N>` → reviewer は orchestrator に `POLLING_TIMEOUT` を送る
- `VERDICT: still_pending PR #<N>` → reviewer は再度 `polling-watcher.sh` を呼び直す

## orchestrator はサブエージェントへ生存確認を送らない

reviewer は push まで進んだ時点で polling-watcher が同期的に走り続けるため、必ず VERDICT 受信時点で何らかのメッセージ（APPROVED / CHANGES_REQUESTED / POLLING_TIMEOUT / STUCK）を orchestrator に返す。orchestrator は能動的にサブエージェントへ問い合わせる必要がない。

サブエージェントが本当に死んだ場合の検知は、ユーザーが「なんか止まってない？」と聞いたときに `gh pr view <N>` と team config を手動確認する運用で十分。

## APPROVED 受信後の next-issue-candidates.sh 実行

`APPROVED: issue-{N}` を受信したら、orchestrator は以下を必ず実行する:

1. `pending_count--`
2. `bash scripts/next-issue-candidates.sh` を実行して候補 Issue を確認（spawn は orchestrator の責任）
3. `harness-proactive-issue-triage` skill を呼び、自動割り当て可能 Issue があればすべて即座に spawn する
4. 要人間確認 Issue のみ一覧提示

## orchestrator が受け取るメッセージ

| メッセージ | 送信者 | アクション |
|---|---|---|
| `APPROVED: issue-{N}` | reviewer | 完了通知、next-issue-candidates 実行 |
| `POLLING_TIMEOUT: issue-{N}` | reviewer | タイムアウト通知、ユーザーに報告 |
| `STUCK: issue-{N}` | reviewer | 障害通知、ユーザーに報告 |
| `WORKTREE_REMOVE_FAILED` | reviewer | worktree 削除失敗通知 |
| `QUESTION_FOR_USER: <内容>` | サブエージェント | `AskUserQuestion` でユーザーに bubble up |

## 関連 skill

- マーカー: `harness-gate-markers`
- 既存の事前チェック: `review-pre-check`
- 既存の push 前検証: `review-push-validation`
- 既存の push+PR 作成: `review-push-and-pr`
- 既存の polling: `review-polling-wait`
