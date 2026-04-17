# Polling アーキテクチャ

## 概要

TechClip エージェントシステムでは、PR のマージ判定を **orchestrator 主導の定期実行** で行う。
reviewer エージェントが直接ポーリングするのではなく、`scripts/polling-watcher.sh` が CronCreate で
2 分毎に実行されて PR 状態を評価し、結果を SendMessage で reviewer に通知する。

---

## アーキテクチャ図

```
reviewer ──(push 後)──> .claude/polling/pr-<N>.json 作成
                                  │
CronCreate (*/2 * * * *)           │
    └── polling-watcher.sh ────> state file 読み込み
            │                          │
            ├── gh pr view ──────> state チェック（MERGED/CLOSED）
            ├── gh api (runs) ──> 条件1: CI workflow completed
            ├── gh api (jobs) ──> 条件2: claude-review job completed
            └── gh pr view ──────> 条件3: ラベル + 判定コメント
                    │
                    ├── VERDICT: approve ──> reviewer へ SendMessage
                    ├── VERDICT: request_changes ──> reviewer へ SendMessage
                    ├── VERDICT: external_merged ──> reviewer へ SendMessage
                    ├── VERDICT: closed ──> reviewer へ SendMessage
                    └── POLLING_TIMEOUT: ──> orchestrator へ SendMessage
```

---

## 各コンポーネントの役割

### 1. reviewer エージェント

push 完了後に `.claude/polling/pr-<N>.json` を作成する。

```json
{
  "pr_number": 1050,
  "push_sha": "abc12345...",
  "push_at": "2026-04-17T00:00:00Z",
  "reviewer_agent": "issue-1031-reviewer",
  "issue_number": 1031,
  "mode": "auto",
  "attempts": 0,
  "last_check": null,
  "last_verdict": null
}
```

その後 `VERDICT: ...` SendMessage を待機する。
verdct 受信後は後処理（worktree 削除・orchestrator 通知）を実行して終了する。

### 2. scripts/polling-watcher.sh

CronCreate で 2 分毎に実行される。`.claude/polling/` 内の全 state file を処理する。

- 外部 merge / close チェック → 即座に reviewer へ通知
- 3 条件 AND 判定（`scripts/lib/evaluate-verdict.sh` を source）
- `pending` → attempts カウントアップ、timeout 判定
- `approve` / `request_changes` → state file 削除 + reviewer へ VERDICT 送信

### 3. scripts/lib/evaluate-verdict.sh

共通関数ライブラリ。`evaluate_verdict <PR_NUMBER> <PUSH_SHA> [CONFIG]` を提供する。

戻り値：
- `approve` — 3 条件すべてクリア、Approve 相当
- `request_changes` — Request Changes 相当
- `pending` — いずれかの条件未達（再試行が必要）

### 4. CronCreate 登録

orchestrator が SessionStart 時に登録する。
`.claude/hooks/session-start-cron-register.sh` が SessionStart hook として
`CRON_REGISTER: please call CronCreate(...)` メッセージを出力し、
orchestrator がそのメッセージを受けて CronCreate を呼び出す。

CronCreate は `durable=true`（7 日で自動失効）で登録する。

---

## 3 条件 AND 判定ロジック

| 条件 | チェック内容 | API |
|---|---|---|
| 条件1 | CI workflow run が completed（cancelled 除く） | `gh api repos/.../actions/runs?head_sha=$SHA` |
| 条件2 | claude-review job が terminated（success または failure） | `gh api .../actions/runs/$RUN_ID/jobs` |
| 条件3-a | AI Review ラベル付与 | `gh pr view --json labels` |
| 条件3-b | claude-review 完了後の判定コメント存在 | `gh pr view --json comments` |

**なぜ 3 条件 AND か**:

- CI workflow の completed だけでは claude-review が完了していない可能性がある
- ラベル付与だけでは最終判定コメントがまだ書かれていない可能性がある
- 3 条件すべて揃ったことで「判定が確定した」と言える

---

## state file のライフサイクル

```
reviewer push 完了
    → .claude/polling/pr-<N>.json 作成
    → 待機（VERDICT SendMessage 待ち）

polling-watcher 実行（2 分毎）
    → pending: attempts++ → timeout なら POLLING_TIMEOUT 送信 + ファイル削除
    → approve/request_changes: VERDICT 送信 + ファイル削除
    → MERGED/CLOSED: 対応 VERDICT 送信 + ファイル削除

reviewer が VERDICT 受信
    → 後処理（worktree 削除 / orchestrator 通知 / CHANGES_REQUESTED 転送）
    → 終了
```

`.claude/polling/` は `.gitignore` 済みのため PR に混入しない。

---

## timeout 設定

`.claude/config.json` の `polling_timeout_minutes`（デフォルト 60）で設定。
`attempts * 2 min = elapsed_min` が timeout を超えると `POLLING_TIMEOUT:` を送信して state file を削除する。

---

## 手動モード

Part A（適用外 PR 事前検知）により、以下の PR は reviewer が「手動レビューモード」に自動遷移する：

- `.github/workflows/` 変更を含む PR（claude-review が動かない）
- stacked PR（base != main）

手動モードでは reviewer は polling-watcher を使わず、人間レビュアーの判定を直接待つ。

---

## SendMessage プロトコル

| メッセージ | 送信者 | 受信者 | 意味 |
|---|---|---|---|
| `VERDICT: approve` | polling-watcher | reviewer | 判定確定（PASS） |
| `VERDICT: request_changes` | polling-watcher | reviewer | 判定確定（NEEDS WORK） |
| `VERDICT: external_merged` | polling-watcher | reviewer | 外部マージ検知 |
| `VERDICT: closed` | polling-watcher | reviewer | PR close 検知 |
| `POLLING_TIMEOUT: issue-{N}` | polling-watcher / reviewer | orchestrator | 60 分超過 |

---

## 実装ファイル

| ファイル | 役割 |
|---|---|
| `scripts/polling-watcher.sh` | メインスクリプト（CronCreate で 2 分毎実行） |
| `scripts/lib/evaluate-verdict.sh` | 3 条件 AND 判定関数ライブラリ |
| `scripts/next-issue-auto-spawn.sh` | APPROVED 後の次 Issue 自動 spawn スクリプト |
| `.claude/hooks/session-start-cron-register.sh` | SessionStart hook（CronCreate 登録通知） |
| `.claude/polling/pr-<N>.json` | PR ごとの polling state file（gitignore 済み） |
| `.claude/config.json` | polling_timeout_minutes 等の設定 |
| `tests/scripts/evaluate-verdict.test.sh` | evaluate-verdict.sh の unit test |
| `tests/hooks/orchestrator-flow-guard.bats` | orchestrator-flow-guard.sh の bats テスト |
