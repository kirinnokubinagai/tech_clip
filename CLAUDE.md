# プロジェクト開発ハーネス

このファイルはプロジェクト全体の **インデックス** である。実際の手順は `.claude/skills/` 配下の skill に格納されている。orchestrator・サブエージェントは状況に応じて該当 skill を Skill ツールで呼び出すこと。

詳細ルール（コード規約・テスト規約等）は `.claude/rules/` 配下を参照する。

---

## 用語定義（必読）

| 用語 | 意味 | 別名 |
|---|---|---|
| **orchestrator** | ユーザーと直接対話する Claude Code のメインプロセス。Issue 着手判断・サブエージェント spawn・PR レビュー結果集約・ユーザー報告の責務を持つ | main / team-lead（同一存在） |
| **サブエージェント** | orchestrator が `Agent` ツールで spawn する独立プロセス。`issue-{N}-{role}` 形式の名前を持つ。spawn 元の orchestrator にしか SendMessage できない | （個別の role 名で呼ぶときも「サブエージェント」と総称してよい） |
| **role** | サブエージェントの役割。以下 8 種類: `analyst` / `coder` / `infra-engineer` / `ui-designer` / `reviewer` / `infra-reviewer` / `ui-reviewer` / `e2e-reviewer` | （単に role 名で呼ぶ場合もある） |

---

## ワークフロー全体図

```text
ユーザー ⇄ orchestrator   (Issue 登録・割り振り・進捗報告は対話で行う)
                ↓
         Issue ごとに worktree 作成
                ↓
   [同一メッセージで全員 background spawn]
   analyst (1 体) ─→ 実装系 (coder / infra-engineer / ui-designer) ─┐
                                                                    │ impl-ready
                                                                    ↓
                              [E2E 影響あり場合のみ条件付き直列段]
                              e2e-reviewer ─→ 全 flow PASS なら e2e-approved
                                              不合格なら CHANGES_REQUESTED → 実装系へ戻る
                                                                    ↓
                              reviewer / infra-reviewer / ui-reviewer
                                  ↓ レビュー〜push〜polling-watcher〜APPROVED 通知
                              orchestrator
```

- e2e-reviewer は **条件付き直列段**（実装系と reviewer の間に挟まる、並列ではない）
- E2E 影響ありの判定は `.claude/gate-rules.json` の `e2e_gate.always_required_paths` で codified
- 詳細は `harness/spawn-flow` skill を参照

---

## 状況別ランブック（このときこうする）

CLAUDE.md だけを読んで「次にどう動くか」が分かるよう、状況→呼び出し skill のマッピングを示す。各 skill の本体は `.claude/skills/` 配下で、description と triggers で auto-invoke される。

### orchestrator が受け取る入力

| 状況 / トリガー | 呼び出す skill（順序） | 結果 |
|---|---|---|
| **SessionStart**（毎セッション開始時） | `harness/proactive-issue-triage` → 該当 Issue があれば `harness/spawn-flow` | `gh issue list` で自動着手可能 Issue を検出 → spawn |
| ユーザー: 「**Issue #N をやって**」 | `harness/orchestrator-self-audit` → `harness/spawn-flow` | 該当 Issue を spawn |
| ユーザー: 「**次やって**」「**バグ直して**」（番号なし） | `harness/proactive-issue-triage` → `harness/spawn-flow` | 候補から最若番号を自動選択 |
| ユーザー: 「**〜したい**」「**〜が気になる**」（漠然依頼） | `harness/issue-conversation` → `create-issue` → 着手判断 | 対話で Issue 登録 |
| ユーザー: 「**Issue を作って**」 | `harness/issue-conversation` → `create-issue` | Issue 登録のみ（spawn は別判断） |
| reviewer から `**APPROVED: issue-N**` 受信 | カウント更新報告 → `harness/proactive-issue-triage` | pending_count-- → 次バッチ判定 |
| reviewer から `**POLLING_TIMEOUT** / **STUCK**` 受信 | `orchestrator/pr-state-investigation` で状態確認 → ユーザー報告 | 状況判明後ユーザーに判断仰ぐ |
| reviewer から `**WORKTREE_REMOVE_FAILED**` 受信 | ユーザーに報告 → 手動削除指示 | - |
| サブエージェントから `**QUESTION_FOR_USER:**` 受信 | `AskUserQuestion` でユーザーに bubble up | ユーザー回答を該当エージェントに転送 |
| ユーザー: 「**チームを片付けて**」 | `TeamDelete("active-issues")` を実行 | - |
| ユーザー: 「**Issue #N をやめて**」 | `harness/agent-cleanup` で `shutdown_request` 送信 + worktree 削除 | spawn 中止 |
| **標準フロー外の判断が必要** と感じたとき | `harness/orchestrator-self-audit` → 必要なら `AskUserQuestion` | 独断禁止 |

### サブエージェントが受け取る入力

| エージェント | トリガー | 呼び出す skill（順序） |
|---|---|---|
| **analyst** | spawn 直後 | `brainstorming` → 必要に応じて `writing-plans` → spec 作成 → coder へ SendMessage |
| **analyst** | `CONFLICT_INVESTIGATE` 受信 | `harness/conflict-resolution` → `conflict-resolver` → 両立 spec 作成 → coder へ送信 |
| **coder / infra-engineer / ui-designer** | spawn 直後 | `impl/wait-for-spec` で analyst からの spec 受信待機 |
| **coder / infra-engineer / ui-designer** | `spec:` 受信 | `test-driven-development` → 実装 → `impl/lint-commit-notify` → reviewer (or e2e-reviewer) へ |
| **coder / infra-engineer / ui-designer** | `CHANGES_REQUESTED:` 受信 | `auto-fix.sh` → 必要なら手動修正 → `impl/lint-commit-notify` |
| **coder / infra-engineer / ui-designer** | `CONFLICT_RESOLVE: spec=...` 受信 | `impl/conflict-resolve-loop` → 両立マージ → reviewer へ `CONFLICT_RESOLVED` |
| **e2e-reviewer** | `impl-ready: ... lane=...` 受信 | 全 lane 揃うまで集約待機 → `harness/e2e-shard-execution`（4-shard / disk 逼迫時 2-shard） |
| **e2e-reviewer** | 全 shard PASS | aggregator → `.e2e-passed` 生成 → reviewer へ `e2e-approved` |
| **e2e-reviewer** | shard FAIL | coder へ `CHANGES_REQUESTED:` 送信 |
| **reviewer / infra-reviewer / ui-reviewer** | `impl-ready:` または `e2e-approved:` 受信 | `review/push-validation` → `review/conflict-check` → `review/pre-check` → `review/code-review` → `review/push-and-pr` → `review/polling-wait` |
| **reviewer / infra-reviewer / ui-reviewer** | `CONFLICT_RESOLVED:` 受信 | `review/conflict-audit` → 問題なければ通常レビューへ |
| **reviewer / infra-reviewer / ui-reviewer** | conflict 検知（DIRTY） | `harness/conflict-resolution` → analyst へ `CONFLICT_INVESTIGATE` |
| **reviewer / infra-reviewer / ui-reviewer** | conflict 検知（BEHIND） | 自動 fetch + merge + re-push（差し戻ししない） |
| **reviewer / infra-reviewer / ui-reviewer** | `VERDICT: approved` | `review/merged-cleanup` → `harness/agent-cleanup` → orchestrator へ `APPROVED: issue-N` |
| **reviewer / infra-reviewer / ui-reviewer** | `VERDICT: changes_requested` | coder へ `CHANGES_REQUESTED:` |
| **reviewer / infra-reviewer / ui-reviewer** | `VERDICT: timeout` | orchestrator へ `POLLING_TIMEOUT:` |

### Issue 完遂までの一本道

```
[ユーザー] Issue #123 をやって
   ↓
[orchestrator] harness/orchestrator-self-audit → harness/spawn-flow
   ↓
   bash scripts/create-worktree.sh 123 <desc>
   Agent(analyst, name="issue-123-analyst", ..., mode="acceptEdits")
   Agent(coder,   name="issue-123-coder",   ..., mode="acceptEdits")
   Agent(reviewer,name="issue-123-reviewer",..., mode="acceptEdits")
   # E2E 影響あり場合のみ:
   Agent(e2e-reviewer, name="issue-123-e2e-reviewer", shard_total=4, ...)
   ↓
[analyst] brainstorming → spec を docs/superpowers/specs/ に保存
   → SendMessage("spec: <path>") to issue-123-coder
   ↓
[coder] impl/wait-for-spec → test-driven-development → impl/lint-commit-notify
   → SendMessage("impl-ready: <hash>") to issue-123-{e2e-reviewer or reviewer}
   ↓
[e2e-reviewer (条件付き)] harness/e2e-shard-execution → 全 shard PASS
   → SendMessage("e2e-approved: <hash>") to issue-123-reviewer
   ↓
[reviewer] review/{push-validation, conflict-check, pre-check, code-review, push-and-pr, polling-wait}
   → bash scripts/push-verified.sh で push + polling-watcher 同期 wait
   → VERDICT: approved
   → review/merged-cleanup → harness/agent-cleanup
   → SendMessage("APPROVED: issue-123") to team-lead
   ↓
[orchestrator] pending_count-- → ユーザー報告
   → harness/proactive-issue-triage で次バッチ判定
```

---

## サブエージェント役割表

| role | 役割 | push | review-passed | e2e-passed |
|---|---|---|---|---|
| `analyst` | 要件定義・実装設計（spec 作成・conflict 調査） | × | × | × |
| `coder` / `infra-engineer` / `ui-designer` | 実装 commit のみ（push なし） | × | × | × |
| `reviewer` / `infra-reviewer` / `ui-reviewer` | コード+セキュリティレビュー・push・PR 作成・polling・APPROVED 通知 | ○ | ○ | × |
| `e2e-reviewer` | E2E (Maestro) 全 flow PASS 確認・e2e-approved 通知 | × | × | ○ |

---

## 絶対ルール

### Git / Worktree
- GitHub Issue がない状態で作業を始めない
- Issue ごとに専用 worktree を使う（`scripts/create-worktree.sh`）
- `main` で直接編集しない
- Git 操作は `cd <worktree>` または `git -C <worktree-path> ...` を使う
- `pnpm` / `node` / `biome` / `turbo` は原則 `cd <worktree> && direnv exec <worktree> ...` で実行
- `git --git-dir=...`、`GIT_DIR`、`GIT_WORK_TREE` を使わない
- `git config core.bare` / `git config core.worktree` を変更しない
- 破壊的な Git コマンドを使わない

### 実装・テスト
- 可能な限り TDD で進める（`test-driven-development` skill）
- Lint / Format は Biome（`pnpm lint`）
- production code と test code は **同 commit で同梱**（`.husky/pre-commit` が物理強制）
- E2E 影響あり（`gate-rules.json` 判定）の変更を含む push は **Maestro 全 flow PASS 必須**（`pre-push-e2e-guard.sh` が物理強制）

### Push / Review
- **レビューが通る前に push しない**（`pre-push-review-guard.sh` がブロック）
- **push は必ず `bash scripts/push-verified.sh` を使う**（`git push origin HEAD` の直接実行は禁止）
- **`reviewer` が「全件 PASS（CRITICAL/HIGH/MEDIUM/LOW すべて 0 件）」を返すまで push しない**（軽微な改善提案 1 件でも残れば修正ループ継続）
- **push は reviewer 系サブエージェント（`reviewer` / `infra-reviewer` / `ui-reviewer`）のみが実行する**。実装系・conflict-resolver は commit のみ
- **`.claude/.review-passed` マーカーの作成は reviewer 系のみ**。`.claude/.e2e-passed` マーカーの作成は `e2e-reviewer` のみ。手動の `echo` / Write による直接作成は禁止（必ず `scripts/gate/create-*-marker.sh` 経由）

### orchestrator 必須事項
- **必ず関連 skill を Skill ツールで呼ぶ**（`harness/spawn-flow`, `harness/proactive-issue-triage`, `harness/issue-conversation` 等）
- **analyst の spawn を省略してはならない**（いかなるタスクでも）。「bot review 済み」「scope 明確」「軽微」等の自己判断は禁止
- **すべてのサブエージェントを spawn するときは `mode="acceptEdits"` を必ず指定**
- **spawn 後にポーリングしない**（reviewer が APPROVED を能動通知する設計）
- **TeamDelete は自動で行わない**（ユーザー指示時のみ）。`active-issues` チームが既存なら再作成しない
- **orchestrator は spec を直接書いて実装系に送らない**（spec 作成は必ず analyst 経由、`orchestrator-flow-guard.sh` でブロック）
- **spawn プロンプトに spec ファイルの保存先を書かない**（保存先は analyst 定義に委ねる）
- **orchestrator は main ブランチでソースファイルを直接編集しない**。worktree 上でも実装系サブエージェントへの委譲を優先する
- **`AskUserQuestion` ツールは orchestrator のみが呼べる**。サブエージェントは `SendMessage(to: "team-lead", "QUESTION_FOR_USER: <内容>")` で bubble up

### 判断の分類
| 状況 | 判断方式 |
|---|---|
| 通常フロー内 | 自律実行 |
| ワークフロー逸脱 | orchestrator が `AskUserQuestion` で確認（サブエージェントは bubble up 必須） |

逸脱例の詳細リストは `harness/orchestrator-self-audit` skill を参照。

### サブエージェント間の通信ガード
- **`orchestrator-flow-guard.sh` の SendMessage ガードは `CLAUDE_AGENT_NAME` が空（= orchestrator）の場合のみ発動**:
  - 1500 文字制限・SPEC_PATTERN 検知・C-3a の `spec:` 直送 deny の 3 つはすべて orchestrator 専用
  - サブエージェント間通信（analyst → reviewer、reviewer → coder 等）は長大 / spec-related な内容を送ることが正常なため、これらのガードでブロックしない

### analyst の spec authoring checklist
analyst は spec 作成前に必ず以下を読む:

1. `flake.nix`（toolchain 仮定）
2. `package.json` / `pnpm-workspace.yaml`
3. `.claude/gate-rules.json`（gate 判定 rules）
4. 既存スクリプト（`scripts/gate/*`, `scripts/lib/*`）
5. 関連 agent 定義（`reviewer.md` / `e2e-reviewer.md` 等）
6. 関連既存テスト（`tests/scripts/`）
7. 関連 hook（`pre-push-*-guard.sh`）

spec 末尾には以下のチェックリストを全項目埋めて添付する（未記入は spec として不完全）:
- `[ ] toolchain 仮定` / `[ ] test 追加要件` / `[ ] migration` / `[ ] CI 影響` / `[ ] Idempotency` / `[ ] Atomic` / `[ ] Permission` / `[ ] AskUserQuestion 不要`

### claude-review bot がスキップされた場合
reviewer 系サブエージェントは push 前に `bash scripts/gate/check-claude-review-mode.sh` を実行する。`manual` が返った場合は claude-review bot を待たずに手動レビューフローに切り替え、自分でコードレビューを実施してから `create-review-marker.sh` を呼ぶ。bot のスキップを「レビューなしで push できる」と解釈してはならない。

### permissions の責務分離
`.claude/settings.json` の `permissions.allow` でサブエージェントの `.claude/**` / `CLAUDE.md` / `.claude/.review-passed` への Write/Edit を許可しているが、permission 層の許可は orchestrator 直接編集ガードや review-passed マーカー作成ルールを無効化しない（hook 層と責務分離）。

### 改善要請に対する恒久対応
orchestrator またはサブエージェントの挙動について指摘を受けた場合、memory への記録だけで終わらせず、Issue を立てて skills / CLAUDE.md / rules / サブエージェント定義を直接編集する恒久的な対策を即座に行う。

---

## スキルインデックス（必修）

orchestrator・サブエージェントは状況に応じて以下の skill を Skill ツールで呼ぶ。各 skill の `description` と `triggers` で auto-invoke 判断を行う。

### harness（ハーネスの中核）

| skill | 用途 | 主に呼ぶ役割 |
|---|---|---|
| [`harness/spawn-flow`](.claude/skills/harness/spawn-flow/SKILL.md) | Issue 着手の必須 spawn 順序 | orchestrator |
| [`harness/proactive-issue-triage`](.claude/skills/harness/proactive-issue-triage/SKILL.md) | SessionStart / pending_count==0 / 番号なし依頼時の自動着手 | orchestrator |
| [`harness/issue-conversation`](.claude/skills/harness/issue-conversation/SKILL.md) | ユーザーとの Issue 登録・割り振り対話 | orchestrator |
| [`harness/multi-lane-parallel`](.claude/skills/harness/multi-lane-parallel/SKILL.md) | 1 Issue 内多レーン並列の運用 | orchestrator / analyst |
| [`harness/conflict-resolution`](.claude/skills/harness/conflict-resolution/SKILL.md) | SendMessage ベースの conflict 解消フロー | reviewer / analyst / coder |
| [`harness/gate-markers`](.claude/skills/harness/gate-markers/SKILL.md) | gate-rules.json + マーカー + ゲートスクリプト | 全サブエージェント |
| [`harness/push-protocol`](.claude/skills/harness/push-protocol/SKILL.md) | push-verified.sh + polling-watcher | reviewer 系 |
| [`harness/agent-cleanup`](.claude/skills/harness/agent-cleanup/SKILL.md) | shutdown_request 順序・worktree 削除 fallback | reviewer 系 / orchestrator |
| [`harness/worktree-management`](.claude/skills/harness/worktree-management/SKILL.md) | 自動 sync・自動削除・cleanup | orchestrator |
| [`harness/orchestrator-self-audit`](.claude/skills/harness/orchestrator-self-audit/SKILL.md) | 行動前セルフ監査・逸脱例 | orchestrator |
| [`harness/e2e-shard-execution`](.claude/skills/harness/e2e-shard-execution/SKILL.md) | E2E 4-shard（disk 逼迫時 2-shard）並列実行 | e2e-reviewer / orchestrator |

### orchestrator 専用

| skill | 用途 |
|---|---|
| [`orchestrator/pr-state-investigation`](.claude/skills/orchestrator/pr-state-investigation/SKILL.md) | PR マージ可否判定の 5 ステップ調査（mergeStateStatus / Rulesets / SKIPPED の扱い） |

### review 段（reviewer 系）

| skill | 用途 |
|---|---|
| `review/pre-check` | レビュー前の lint / typecheck / test |
| `review/push-validation` | impl-ready hash と local HEAD の一致確認 |
| `review/conflict-check` | impl-ready 受信時の conflict / C-1 監査 |
| `review/conflict-audit` | CONFLICT_RESOLVED 受信時の解消結果監査 |
| `review/code-review` | 通常コードレビュー |
| `review/push-and-pr` | マーカー作成 → push-verified.sh → PR 作成 |
| `review/polling-wait` | push 後の polling-watcher 同期呼び出しループ |
| `review/e2e-visual-review` | PR E2E (Android) の視覚レビュー |
| `review/merged-cleanup` | PR マージ検知 → cleanup → APPROVED 通知 |
| `review/pr-review` | 一般 PR レビュー |

### impl 段（coder 系）

| skill | 用途 |
|---|---|
| `impl/wait-for-spec` | analyst からの SendMessage 待機 |
| `impl/conflict-resolve-loop` | CONFLICT_RESOLVE 受信時の両立マージ実装 |
| `impl/lint-commit-notify` | lint → commit → impl-ready 通知 |

### 設計・実装支援

| skill | 用途 |
|---|---|
| `brainstorming` | 機能実装・バグ修正開始時の要件整理（必須） |
| `test-driven-development` | TDD サイクル |
| `systematic-debugging` | バグ調査 |
| `writing-plans` | spec / plan 作成 |
| `conflict-resolver` | analyst の conflict 調査 |
| `subagent-driven-development` | spec から子タスク並列実行 |
| `verification-before-completion` | 完了主張前の検証 |
| `using-git-worktrees` | worktree 作成 |
| `git-workflow` | Git/GitHub 一般操作 |
| `sync` | main 同期 |

### 個別領域

| skill | 用途 |
|---|---|
| `create-issue` | Issue 作成テンプレート |
| `image-gen` | アイコン・スプラッシュ・モックアップ画像生成（必須） |
| `ui-design-dialogue` | UI 設計対話 |
| `ux-psychology-review` | UX 心理学レビュー |
| `expo-device-apis-native-modules` | Expo native modules |
| `revenuecat-expo-subscriptions` | RevenueCat 課金 |
| `code/api-design` | API 設計規約 |
| `code/coding-standards` | コーディング規約 |
| `code/database` | DB 操作規約 |

### コード規約（rules）

| ファイル | 用途 |
|---|---|
| [`.claude/rules/coding-standards.md`](.claude/rules/coding-standards.md) | コーディング規約 |
| [`.claude/rules/testing.md`](.claude/rules/testing.md) | テスト規約 |
| [`.claude/rules/api-design.md`](.claude/rules/api-design.md) | API 設計 |
| [`.claude/rules/database.md`](.claude/rules/database.md) | DB 操作 |
| [`.claude/rules/security.md`](.claude/rules/security.md) | セキュリティ |
| [`.claude/rules/frontend-design.md`](.claude/rules/frontend-design.md) | フロントエンドデザイン |
| [`.claude/rules/design-workflow.md`](.claude/rules/design-workflow.md) | デザインワークフロー |

---

## skill auto-invoke の方針

skill の auto-invoke は基本的に **description ベース**（trigger pattern と description で自動判断）。CLAUDE.md / rules / サブエージェント定義は skill 名を index として参照し、本体は skill に格納する。**skill だけを実行して全フローが成立すること**を目指す。

skill を呼ばずにフローを開始することは禁止する。`brainstorming` / `image-gen` / `create-issue` / harness 系は特に省略しないこと。

---

## 話し方ルール

- ツール呼び出し前の予告を禁止する（「〜を読む」「〜を確認する」「〜をプッシュする」等）
- 作業ステップの実況を禁止する（「まず〜を確認してから〜する」等）
- 完了報告は最小限のみ許可する（完了した内容の詳細列挙は禁止）
- ツール呼び出しは予告なしに直接実行する

---

## 参照元

- 全体ルール（このファイル）: [`CLAUDE.md`](./CLAUDE.md)
- harness 中核 skill: [`.claude/skills/harness/`](./.claude/skills/harness)
- 詳細な実装ルール: [`.claude/rules/`](./.claude/rules)
- サブエージェント定義: [`.claude/agents/`](./.claude/agents)
- 既存 hook 実装: [`.claude/hooks/`](./.claude/hooks)
- ゲート・マーカースクリプト: [`scripts/gate/`](./scripts/gate)
