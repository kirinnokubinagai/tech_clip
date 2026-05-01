---
name: harness-proactive-issue-triage
description: SessionStart 時 / pending_count==0 時 / Issue 番号なしの作業依頼時に、自動着手可能 Issue を即 spawn する。判定は `scripts/next-issue-candidates.sh` が完結させる。
triggers:
  - "harness-proactive-issue-triage"

  - "harness-proactive-issue-triage"
  - "次やって"
  - "次のissue"
  - "open issue"
  - "issue triage"
  - "セッション開始"
---

# プロアクティブ Issue 自律処理

## チェックタイミング

1. **SessionStart 時** — `clean-stale-team-members.sh` 後
2. **APPROVED で pending_count == 0** になった直後
3. **ユーザーから Issue 番号なしの作業依頼**（「次やって」「バグ直して」等）

## 判定 + 候補取得（1 コマンド）

```bash
bash scripts/next-issue-candidates.sh --json
```

出力形式:

```json
{
  "auto_assignable": [
    {"number": 1055, "title": "...", "zones": ["api-auth"], "blocked_by_active": false},
    {"number": 1083, "title": "OAuth ...", "zones": ["api-auth", "api-migration"], "blocked_by_active": true, "blocking_zones": ["api-migration"]}
  ],
  "requires_human": [{"number": 1057, "title": "[release] v2.0.0..."}, ...],
  "active_zones": ["api-migration"],
  "active_issues": [1085]
}
```

判定ルール（スクリプト内に codified、`.claude/config.json` で調整可）:

- **要人間確認**（`requires_human`）: `release` / `requires-human` ラベル、または title に `go-no-go` / `store` / `production` / `smoke test` / `本番` を含む
- **自動着手可能**（`auto_assignable`）: 上記以外
- **zone 衝突**（`blocked_by_active: true`）: 現在 active な Issue と同じ zone を触る Issue は spawn 保留

zone 定義は `.claude/config.json` の `conflict_zones` キーで管理。active zone の検出は `git worktree list --porcelain` で `issue/N/...` パターンを抽出（`scripts/skills/list-active-zones.sh`）。

## 動作

1. `bash scripts/next-issue-candidates.sh --json` を実行して候補を取得
2. `auto_assignable.filter(i => !i.blocked_by_active)` を全件、`harness-spawn-flow` で **確認なしで即 spawn**
3. `auto_assignable.filter(i => i.blocked_by_active)` は **spawn 保留**。ユーザーへ「Issue #N (zone: ...) は #M がマージされるまで待機」と表示
4. `requires_human` のみユーザーに一覧提示（着手しない）
5. 既に処理中の Issue から `APPROVED: issue-N` 受信時は再度 step 1 から実行（マージ済みになった zone が解放されるため queued 候補が unblock される）

## 着手禁止条件（独断回避）

以下のときは spawn 前に `harness-orchestrator-self-audit` を通す:

- 既に `issue-{N}-*` サブエージェントが team config に存在 → 二重 spawn 禁止
- ユーザーが「Issue #N をやめて」と明示的に指示 → `harness-agent-cleanup` を実行
- `spawn-prepare.sh` が exit 1 (zone conflict) を返した Issue → 強行 spawn 禁止（`harness-orchestrator-self-audit` に委ねる）

## 関連 skill

- spawn 自体: `harness-spawn-flow`
- 完了後 cleanup: `harness-agent-cleanup`
- 標準フロー外判断: `harness-orchestrator-self-audit`
