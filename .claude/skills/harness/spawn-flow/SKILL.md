---
name: harness-spawn-flow
description: orchestrator の必須 spawn 順序。Issue 着手・worktree 作成・analyst+実装系+e2e-reviewer+reviewer 系の 4 体セット background spawn を 1 メッセージで行う一連の手順。Issue #N をやって/着手/次やって/対応してなど、Issue に紐づく作業開始判断のたびに必ず使用する。
triggers:
  - "harness/spawn-flow"
  - "Issue #"
  - "着手"
  - "次やって"
  - "対応して"
  - "issue spawn"
---

# orchestrator 必須 spawn フロー（4 体セット固定）

このスキルは Issue 着手のたびに必ず呼ぶ。**例外なし**（1 行修正・docs 変更・設定追記でも省略禁止）。

## 技術的制約

- サブエージェントは他のサブエージェントを spawn できない
- orchestrator が analyst・実装系・e2e-reviewer・レビュー系をすべて直接 spawn する
- analyst が内部で coder を spawn する等のパターンは試みない

## 必須 spawn 順序（4 体セット固定）

```text
0. [active-issues チームが存在しない場合のみ1回]
   TeamCreate("active-issues")

1. 各 Issue N:
   bash scripts/create-worktree.sh N <kebab-case-desc>

2. [同一メッセージで全員 background spawn — 常に 4 体セット]
   Agent(analyst,         name="issue-N-analyst",         team_name="active-issues", run_in_background=true, mode="acceptEdits")
   Agent(<実装系 role>,    name="issue-N-<role>",          team_name="active-issues", run_in_background=true, mode="acceptEdits")
   Agent(e2e-reviewer,    name="issue-N-e2e-reviewer",    team_name="active-issues", run_in_background=true, mode="acceptEdits")
   Agent(<レビュワー role>, name="issue-N-<reviewer-role>", team_name="active-issues", run_in_background=true, mode="acceptEdits")

3. 複数 Issue は Step 1-2 を繰り返す（チームは同じ "active-issues"）

4. reviewer から "APPROVED: issue-N" を受信:
   - ユーザーへ「Issue #N が APPROVED されました（残り pending_count 件）」と報告
   - pending_count--
   - pending_count == 0 → harness/proactive-issue-triage を呼んで次バッチを決定

5. ユーザーが「チームを片付けて」と指示したとき → TeamDelete("active-issues")
```

## 変更種別ごとのサブエージェント選択

| 変更種別 | 実装サブエージェント | レビュワー（必須） | e2e-reviewer |
|---|---|---|---|
| 機能実装・バグ修正・docs 変更 | `coder` | `reviewer` | **常に spawn** |
| インフラ・CI/CD・設定ファイル | `infra-engineer` | `infra-reviewer` | **常に spawn** |
| フロントエンド・UI コンポーネント | `ui-designer` | `ui-reviewer` | **常に spawn** |
| 変更種別不明 | analyst に判断委譲 | analyst に判断委譲 | **常に spawn** |

**e2e-reviewer は常時 spawn**（条件付きではない）。E2E 影響なしの判定は e2e-reviewer 自身が `evaluate-paths.sh` で行い、影響なしなら **短絡して即 reviewer に `e2e-approved` 転送 + shutdown**（maestro 起動なし）。

これにより orchestrator 側の判定ロジックが消え、`evaluate-paths.sh` という単一の真実源で判定が一元化される。

## E2E 段の流れ（4 体セット固定）

```text
analyst → coder/infra-engineer/ui-designer
                ↓ impl-ready: <hash>
        e2e-reviewer（常に存在）
                ├─ E2E 影響なし（evaluate-paths.sh 判定）
                │     → 即 e2e-approved 転送 + shutdown（maestro なし）
                └─ E2E 影響あり
                      → shard 実行 → aggregator → e2e-approved
                                      不合格なら CHANGES_REQUESTED → 実装系に戻る
                ↓ e2e-approved: <hash>
        reviewer / infra-reviewer / ui-reviewer
                ↓ APPROVED: issue-N
        orchestrator
```

### 重要なルール

- 実装系（coder / infra-engineer / ui-designer）は **必ず e2e-reviewer に impl-ready を送る**（reviewer に直接送らない）
- e2e-reviewer がフェーズ 0 で `evaluate-paths.sh` を実行し、E2E 必要性を判定
- E2E 影響なしの場合は短絡: `SendMessage(to: "issue-N-reviewer", "e2e-approved: <hash>")` + shutdown
- E2E 影響ありの場合は通常の shard 実行（`harness/e2e-shard-execution`）
- reviewer は常に **`e2e-approved`** を待つ（実装系から直接 `impl-ready` を受け取ることはない）
- E2E 必要性判定の真の正解は `.claude/gate-rules.json` の `e2e_gate.always_required_paths` / `auto_skip_paths`

## spawn プロンプトのテンプレート

### 機能実装・バグ修正の例（4 体セット）

```text
[同一メッセージで全員 background spawn]
Agent(analyst,
      name="issue-{N}-analyst",
      team_name="active-issues",
      run_in_background=true,
      mode="acceptEdits",
      prompt="Issue #{N} の設計を担当する。worktree: ../issue-{N}。設計完了後、SendMessage で coder に spec パスを通知する。")

Agent(coder,
      name="issue-{N}-coder",
      team_name="active-issues",
      run_in_background=true,
      mode="acceptEdits",
      prompt="Issue #{N} の実装を担当する。worktree: ../issue-{N}。analyst からの SendMessage を待機してから実装を開始すること。impl-ready は必ず e2e-reviewer に送ること（reviewer ではない）。")

Agent(e2e-reviewer,
      name="issue-{N}-e2e-reviewer",
      team_name="active-issues",
      run_in_background=true,
      mode="acceptEdits",
      prompt="Issue #{N} の E2E レビューを担当する。worktree: ../issue-{N}。expected_e2e_lanes=1。shard_total=4（disk 逼迫時 2）。フェーズ 0 で evaluate-paths.sh を実行し、E2E 影響なしなら即 e2e-approved を reviewer に転送して shutdown する。詳細は harness/e2e-shard-execution skill 参照。")

Agent(reviewer,
      name="issue-{N}-reviewer",
      team_name="active-issues",
      run_in_background=true,
      mode="acceptEdits",
      prompt="Issue #{N} のレビュー〜PR作成を担当する。worktree: ../issue-{N}。e2e-reviewer からの e2e-approved を待機してからレビューを開始すること。")
```

infra / UI 系も同パターン（`coder`→`infra-engineer`/`ui-designer`、`reviewer`→`infra-reviewer`/`ui-reviewer`）。e2e-reviewer は常に `e2e-reviewer` のまま。

## 禁止事項

- spawn プロンプトに spec ファイルの保存先を書く（`.claude/spec-N.md` 等）→ 保存先は analyst 定義に委ねる
- `mode="acceptEdits"` の指定漏れ
- spawn 後にポーリングする（reviewer が APPROVED を能動通知する設計）
- TeamDelete を自動実行する（ユーザー指示時のみ）
- analyst の spawn を省略する（「bot review 済み」「scope 明確」「軽微」等の自己判断は禁止）
- **e2e-reviewer の spawn を省略する**（「E2E 影響なさそう」と orchestrator が独断判断するのは禁止。判定は e2e-reviewer 自身が `evaluate-paths.sh` で行う）
- 実装系から reviewer に直接 `impl-ready` を送る（必ず e2e-reviewer 経由）

詳細な spawn 後の動作・cleanup は以下の関連 skill を参照:

- 多レーン並列: `harness/multi-lane-parallel`
- 自律的な Issue 着手: `harness/proactive-issue-triage`
- spawn 前のセルフ監査: `harness/orchestrator-self-audit`
- E2E shard 4 並列: `harness/e2e-shard-execution`
- conflict 解消: `harness/conflict-resolution`
- agent / worktree cleanup: `harness/agent-cleanup`
