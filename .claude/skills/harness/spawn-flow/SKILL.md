---
name: harness-spawn-flow
description: orchestrator の必須 spawn 順序。Issue 着手・worktree 作成・analyst+実装系+レビュー系の background spawn を 1 メッセージで行う一連の手順。Issue #N をやって/着手/次やって/対応してなど、Issue に紐づく作業開始判断のたびに必ず使用する。
triggers:
  - "harness/spawn-flow"
  - "Issue #"
  - "着手"
  - "次やって"
  - "対応して"
  - "issue spawn"
---

# orchestrator 必須 spawn フロー

このスキルは Issue 着手のたびに必ず呼ぶ。**例外なし**（1 行修正・docs 変更・設定追記でも省略禁止）。

## 技術的制約

- サブエージェントは他のサブエージェントを spawn できない
- orchestrator が analyst・実装系・レビュー系をすべて直接 spawn する
- analyst が内部で coder を spawn する等のパターンは試みない

## 必須 spawn 順序

```text
0. [active-issues チームが存在しない場合のみ1回]
   TeamCreate("active-issues")

1. 各 Issue N:
   bash scripts/create-worktree.sh N <kebab-case-desc>

2. [同一メッセージで全員 background spawn]
   Agent(analyst,           name="issue-N-analyst",          team_name="active-issues", run_in_background=true, mode="acceptEdits")
   Agent(<実装系 role>,      name="issue-N-<role>",           team_name="active-issues", run_in_background=true, mode="acceptEdits")
   Agent(<レビュワー role>, name="issue-N-<reviewer-role>",  team_name="active-issues", run_in_background=true, mode="acceptEdits")
   # E2E 影響あり場合のみ追加（条件は後述）:
   Agent(e2e-reviewer,      name="issue-N-e2e-reviewer",     team_name="active-issues", run_in_background=true, mode="acceptEdits")

3. 複数 Issue は Step 1-2 を繰り返す（チームは同じ "active-issues"）

4. reviewer から "APPROVED: issue-N" を受信:
   - ユーザーへ「Issue #N が APPROVED されました（残り pending_count 件）」と報告
   - pending_count--
   - pending_count == 0 → harness/proactive-issue-triage を呼んで次バッチを決定

5. ユーザーが「チームを片付けて」と指示したとき → TeamDelete("active-issues")
```

## 変更種別ごとのサブエージェント選択

| 変更種別 | 実装サブエージェント | レビュワー（必須） | e2e-reviewer 追加？ |
|---|---|---|---|
| 機能実装・バグ修正・docs 変更 | `coder` | `reviewer` | E2E 影響ありなら追加 |
| インフラ・CI/CD・設定ファイル | `infra-engineer` | `infra-reviewer` | 通常不要 |
| フロントエンド・UI コンポーネント | `ui-designer` | `ui-reviewer` | E2E 影響ありなら追加 |
| 変更種別不明 | analyst に判断委譲 | analyst に判断委譲 | analyst に判断委譲 |

## E2E 影響ありの判定 → e2e-reviewer 追加 spawn

以下のパス変更を含む場合は **e2e-reviewer を追加 spawn**:

- `tests/e2e/maestro/**`
- `apps/mobile/app/**/*.tsx` / `apps/mobile/src/**/*.tsx`（testID 追加含む）
- `apps/mobile/app.json` / `apps/mobile/metro.config.js`
- `apps/mobile/src/locales/**`
- `apps/mobile/src/components/**` / `apps/mobile/src/screens/**` / `apps/mobile/src/hooks/**` / `apps/mobile/src/lib/**`

判定の真の正解は `.claude/gate-rules.json` の `e2e_gate.always_required_paths`。

### E2E 段の流れ（重要）

```text
analyst → coder/infra-engineer/ui-designer
                ↓ impl-ready: <hash>
        e2e-reviewer (条件付き、E2E 影響ありのときのみ)
                ↓ 全 flow PASS なら e2e-approved: <hash>
                ↓ 不合格なら CHANGES_REQUESTED → 実装系に戻る
        reviewer (常に存在)
                ↓ APPROVED: issue-N
        orchestrator
```

- **e2e-reviewer は条件付き直列段**（reviewer の前に挟む）。並列ではない
- E2E 影響ありの場合: 実装系 → `e2e-reviewer` へ `impl-ready`
- E2E 影響なしの場合: 実装系 → `reviewer` へ直接 `impl-ready`
- E2E 影響あり判定は `.claude/gate-rules.json` で codified

## spawn プロンプトのテンプレート

### 機能実装・バグ修正の例

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
      prompt="Issue #{N} の実装を担当する。worktree: ../issue-{N}。analyst からの SendMessage を待機してから実装を開始すること。")

Agent(reviewer,
      name="issue-{N}-reviewer",
      team_name="active-issues",
      run_in_background=true,
      mode="acceptEdits",
      prompt="Issue #{N} のレビュー〜PR作成を担当する。worktree: ../issue-{N}。{coder/e2e-reviewer} からの SendMessage を待機してからレビューを開始すること。")

# E2E 影響あり場合のみ追加 spawn:
Agent(e2e-reviewer,
      name="issue-{N}-e2e-reviewer",
      team_name="active-issues",
      run_in_background=true,
      mode="acceptEdits",
      prompt="Issue #{N} の E2E レビューを担当する。worktree: ../issue-{N}。expected_e2e_lanes={1 or 2 or 4}。shard_total={1 or 2 or 4}。詳細は harness/e2e-shard-execution skill 参照。")
```

infra / UI 系も同パターン（`coder`→`infra-engineer`/`ui-designer`、`reviewer`→`infra-reviewer`/`ui-reviewer`）。

## 禁止事項

- spawn プロンプトに spec ファイルの保存先を書く（`.claude/spec-N.md` 等）→ 保存先は analyst 定義に委ねる
- `mode="acceptEdits"` の指定漏れ
- spawn 後にポーリングする（reviewer が APPROVED を能動通知する設計）
- TeamDelete を自動実行する（ユーザー指示時のみ）
- analyst の spawn を省略する（「bot review 済み」「scope 明確」「軽微」等の自己判断は禁止）

詳細な spawn 後の動作・cleanup は以下の関連 skill を参照:

- 多レーン並列: `harness/multi-lane-parallel`
- 自律的な Issue 着手: `harness/proactive-issue-triage`
- spawn 前のセルフ監査: `harness/orchestrator-self-audit`
- E2E shard 4 並列: `harness/e2e-shard-execution`
- conflict 解消: `harness/conflict-resolution`
- agent / worktree cleanup: `harness/agent-cleanup`
