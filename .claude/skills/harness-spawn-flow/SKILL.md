---
name: harness-spawn-flow
description: Issue 着手の必須 spawn フロー。worktree 作成・shard_total 判定・role 判別をすべて scripts/skills/spawn-prepare.sh に委譲し、orchestrator は JSON を読んで 4 体セット spawn するだけ。
triggers:
  - "harness-spawn-flow"

  - "harness-spawn-flow"
  - "Issue #"
  - "着手"
  - "次やって"
  - "対応して"
  - "issue spawn"
---

# orchestrator 必須 spawn フロー（4 体セット固定）

Issue 着手のたびに必ず呼ぶ。**例外なし**。

## ステップ

### 1. 前準備（1 コマンドで完結）

```bash
bash scripts/skills/spawn-prepare.sh <issue-number> <kebab-case-desc>
```

スクリプトが以下を自動で行う:

- worktree 作成（既存ならスキップ、`scripts/create-worktree.sh` 内部で `direnv allow` + `pnpm install`）
  - **branch 戦略 (#1138)**: worktree は `origin/stage` を base に作成（`BASE_REF=origin/stage`。stage branch 未存在時は `origin/main` にフォールバック）
- `shard_total` 判定（disk 30GB 以上 → 4、未満 → 2、CI 環境 → 4）
- Issue body / labels から `impl_role` / `reviewer_role` を推定（coder|infra-engineer|ui-designer / reviewer|infra-reviewer|ui-reviewer）

出力 JSON 例:

```json
{
  "issue": 1234,
  "worktree": "/Users/foo/tech_clip/issue-1234",
  "shard_total": 4,
  "impl_role": "coder",
  "reviewer_role": "reviewer",
  "agents": [
    {"role": "analyst",      "name": "analyst-1234"},
    {"role": "coder",        "name": "coder-1234"},
    {"role": "e2e-reviewer", "name": "e2e-reviewer-1234"},
    {"role": "reviewer",     "name": "reviewer-1234"}
  ]
}
```

### 2. TeamCreate（初回のみ）

`active-issues` チームが存在しなければ作成（既存なら skip）:

```text
TeamCreate("active-issues")
```

### 3. 4 体セット spawn（同一メッセージで全員 background）

JSON の `agents` をそのまま展開して 4 体 spawn:

```text
[同一メッセージで全員 background spawn]
Agent(analyst,
      name="analyst-{N}",
      team_name="active-issues", run_in_background=true, mode="acceptEdits",
      prompt="Issue #{N} の設計担当。worktree: {worktree}")

Agent({impl_role},
      name="{impl_role}-{N}",
      team_name="active-issues", run_in_background=true, mode="acceptEdits",
      prompt="Issue #{N} 実装担当。worktree: {worktree}。impl-ready は必ず e2e-reviewer に送る。")

Agent(e2e-reviewer,
      name="e2e-reviewer-{N}",
      team_name="active-issues", run_in_background=true, mode="acceptEdits",
      prompt="Issue #{N} E2E レビュー担当。worktree: {worktree}。shard_total={shard_total}。expected_e2e_lanes=1。フェーズ 0 で evaluate-paths.sh 実行 → 影響なしなら短絡、ありなら shard 実行。")

Agent({reviewer_role},
      name="{reviewer_role}-{N}",
      team_name="active-issues", run_in_background=true, mode="acceptEdits",
      prompt="Issue #{N} レビュー担当。worktree: {worktree}。e2e-reviewer から e2e-approved を待機。")
```

### 4. 事後報告

ユーザーへ「Issue #{N} に着手しました（4 体 spawn）」と簡潔に報告。

### 5. 完了通知の受信

reviewer から `APPROVED: issue-{N}` を受信したら:
- `pending_count--`、ユーザーへ進捗報告
- `pending_count == 0` → `harness-proactive-issue-triage` を呼んで次バッチを判定（チェーン処理）

### 6. ユーザーが「チームを片付けて」と指示したとき

```text
TeamDelete("active-issues")
```

自動 TeamDelete はしない。

## 禁止事項

- `mode="acceptEdits"` 指定漏れ
- spawn 後にポーリング（reviewer が APPROVED を能動通知する）
- TeamDelete の自動実行（ユーザー指示時のみ）
- analyst の spawn 省略（「軽微」等の自己判断は禁止 → `harness-orchestrator-self-audit`）
- e2e-reviewer の spawn 省略（4 体セット固定）
- 実装系から reviewer に直接 `impl-ready` 送信（必ず e2e-reviewer 経由）
- spawn プロンプトに spec 保存先を書く（保存先は analyst 定義に委ねる）

## 関連 skill / script

- `scripts/skills/spawn-prepare.sh` — 前準備の単一エントリポイント
- `scripts/skills/decide-shard-total.sh` — shard_total 判定（spawn-prepare 内部で呼ばれる）
- `scripts/create-worktree.sh` — worktree 作成（spawn-prepare 内部で呼ばれる）
- `harness-proactive-issue-triage` — APPROVED 後のチェーン処理
- `harness-orchestrator-self-audit` — spawn 前のセルフ監査
- `harness-multi-lane-parallel` — 1 Issue 大規模並列
- `harness-agent-cleanup` — APPROVED 後の cleanup
