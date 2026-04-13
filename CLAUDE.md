# エージェントハーネス

このファイルはプロジェクト全体の開発ルールを定義する。Claude Code・Codex いずれのエージェントもこのファイルのルールに従うこと。
特に `.claude/rules/` 配下は必要なものを必ず読み、実装とレビューに反映すること。

## 必須の起動手順

コーディング作業を始める前に、必ず以下を実行します。

```bash
bash ./.codex/run-session-start.sh
```

ファイルを編集する前に、必ず以下を実行します。

```bash
bash ./.codex/run-pre-edit.sh
```

リポジトリを変更しうるシェルコマンドを実行する前に、必ず以下を実行します。

```bash
bash ./.codex/run-pre-command.sh '<command>'
```

作業終了時には、必要に応じて以下を実行します。

```bash
bash ./.codex/run-stop.sh
```

## 参照元

- 全体ルール: [`CLAUDE.md`](./CLAUDE.md)
- 詳細な実装ルール: [`.claude/rules/`](./.claude/rules)
- 既存 hook 実装: [`.claude/hooks/`](./.claude/hooks)

---

## オーケストレーター（Claude Code）の役割

Claude Code はオーケストレーターとして機能する。具体的な仕事は以下のみ:

1. Issue を読む
2. Worktree を作る
3. エージェントを順序通りに spawn する（レビュー PASS 後にマーカー作成・push・PR 作成を行い、PR URL をユーザーに報告する）
4. PR レビューをポーリングし、修正ループを回す

---

## Issue 対応の完全フロー

### Step 0: Issue の確認と分割判断

```bash
gh issue view <N>
```

Issue の内容を読み、**重い Issue かどうか**を判断する。

**重い Issue の判断基準:**
- 実装ファイルが 5 つ以上になりそう
- 独立した機能が複数含まれている

**重い場合は子 Issue に分割する:**

```bash
gh issue create \
  --title "子Issueのタイトル" \
  --body "親 Issue: #N

具体的な作業内容..." \
  --label "..."
```

子 Issue から先に実装・マージし、すべての子 Issue が完了したら親 Issue をクローズする。

---

### Step 1: Worktree 作成

```bash
bash scripts/create-worktree.sh <issue-number> <kebab-case-description>
# 例: bash scripts/create-worktree.sh 744 fix-hook-exit2-messages
```

これで `../issue-<N>` に worktree が作成され、`direnv allow` と `pnpm install` まで完了する。

---

### Step 2: エージェントを順序通りに spawn

**TeamCreate / TaskCreate / SendMessage は使用しない。** Agent ツールで直接 spawn する。

#### 機能実装・バグ修正の場合

```text
① Agent(requirements-analyst, mode="acceptEdits")
   - Issue の内容を整理し、実装方針を決定する
   - worktree パスと Issue 番号を渡す
   - 完了を待ってから②へ

② Agent(coder, mode="acceptEdits")（①完了後）
   - TDD で実装する（Red → Green → Refactor）
   - pnpm lint で lint をクリアする
   - lint エラー 0 件になったらコミットする
   - worktree パスと Issue 番号を渡す
   - 完了を待ってからレビューループへ

--- レビューループ（両方 PASS になるまで繰り返す） ---

③ [並列 spawn] Agent(code-reviewer, mode="acceptEdits")
               Agent(security-reviewer, mode="acceptEdits")
   - 両エージェントの結果を待つ

④ オーケストレーターがレビュー結果を評価する:

   if code_reviewer == "全件 PASS（0件）" and security_reviewer == "全件 PASS（0件）":
       # ループ脱出 → push へ
       Bash: touch <worktree>/.claude/.review-passed
       Bash: cd <worktree> && git push origin HEAD
       Bash: gh pr create → PR URL をユーザーに報告
   else:
       # 全指摘（CRITICAL / HIGH / MEDIUM / LOW すべて）を coder に渡す
       Agent(coder, mode="acceptEdits") で修正依頼
       # 修正完了後 → ③に戻る（新しい Agent を spawn する）

--- ループここまで ---
```

#### インフラ・CI/CD 変更の場合

```text
① Agent(infra-engineer, mode="acceptEdits")（実装）

--- レビューループ ---
② [並列 spawn] Agent(infra-reviewer, mode="acceptEdits")
               Agent(security-reviewer, mode="acceptEdits")
   両方 PASS → ループ脱出 → マーカー作成 → push → PR 作成
   指摘あり  → Agent(infra-engineer) で修正 → ②へ戻る
```

#### フロントエンド・UI 変更の場合

```text
① Agent(requirements-analyst, mode="acceptEdits") → Agent(ui-designer, mode="acceptEdits")（実装）

--- レビューループ ---
② [並列 spawn] Agent(ui-reviewer, mode="acceptEdits")
               Agent(code-reviewer, mode="acceptEdits")
   両方 PASS → ループ脱出 → マーカー作成 → push → PR 作成
   指摘あり  → Agent(ui-designer, mode="acceptEdits") で修正 → ②へ戻る
```

---

### Step 3: PR 報告

PR URL をユーザーに提示する。

---

### Step 4: PR レビューポーリングと自動修正

PR 作成後、以下のコマンドでレビュー結果をポーリングする:

```bash
bash scripts/poll-pr-review.sh <pr-number>
```

**結果に応じたアクション:**

| 出力 | アクション |
|------|-----------|
| `APPROVED` | 完了。ユーザーに報告 |
| `CHANGES_REQUESTED` | レビュー内容を読み、coder に修正依頼 → code-reviewer/security-reviewer で再レビュー → マーカー再作成 → 再プッシュ → Step 4 に戻る |
| `TIMEOUT` | タイムアウト。ユーザーに手動確認を依頼 |

**修正ループの流れ:**

```text
poll-pr-review.sh → CHANGES_REQUESTED
  → Agent(coder, mode="acceptEdits") で修正依頼（変更内容を渡す）
  → Agent(code-reviewer, mode="acceptEdits") + Agent(security-reviewer, mode="acceptEdits") で再レビュー
  → 両方 PASS → マーカー再作成 → git push → poll-pr-review.sh を再実行
  → APPROVED になるまで繰り返す
```

> **注意**: `pre-push-review-guard.sh` により、`.claude/.review-passed` マーカーがない状態での push はブロックされる。

---

## 複数 Issue の並列処理（バックグラウンドエージェント スワーム）

複数の Issue を並列処理する場合は、TeamCreate ではなく**バックグラウンドエージェント**を使う。
TeamCreate は 1 オーケストレーターにつき 1 チームしか管理できないため。

### 手順

```bash
# 1. 各 Issue に worktree を作成する
bash scripts/create-worktree.sh <N1> <desc1>
bash scripts/create-worktree.sh <N2> <desc2>
```

※ 以下は疑似コード。実際は Claude Code の Agent ツールで `run_in_background=true` と `prompt` を指定する

```text
# 2. 各 Issue に対してバックグラウンドエージェントを並列 spawn する
Agent(
  run_in_background=true,
  mode="acceptEdits",
  prompt="Issue #<N> の実装のみを担当する。
          worktree: /path/to/issue-<N>
          Issue内容: <issue内容を貼り付け>
          requirements-analyst で要件整理、coder で実装・コミットまで完了させたら終了する。
          レビュー・マーカー作成・push・PR作成はオーケストレーターが担当する。"
)
```

各バックグラウンドエージェントは**実装のみ**を担当する。完了後、オーケストレーターが各 Issue に対してレビュー・マーカー作成・push・PR 作成を順に処理する。

### バックグラウンドエージェントの制約

worktree-isolation-guard.sh により以下の制限がある（mainブランチのオーケストレーターから兄弟 worktree への Edit/Write/Read/Grep/Glob がブロックされる。worktree 内で動作するバックグラウンドエージェントは影響を受けない）:

| ツール | 制約 |
|---|---|
| Edit / Write | mainブランチから兄弟 worktree へのアクセスはブロックされる |
| Read / Grep / Glob | mainブランチから兄弟 worktree へのアクセスはブロックされる |
| Bash（`cat`, `touch` 等） | worktree-isolation-guard の対象外（ただし他 hook による制約は受ける） |

**main ブランチ上での Edit/Write は全ファイルに対して禁止**（`.claude-user/` と `.omc/` を除く gitignore 済みファイルのみ許可）。
`.claude/**` や `scripts/` であっても必ず worktree 経由で変更すること。

なお `.omc/state/**` は worktree 上でも Edit/Write がブロックされる（is_blocked_file による）。
`.claude/.review-passed` は Write ツールまたは `touch`/`cat >` 等の Bash コマンドで作成・変更可能（例: `touch <worktree>/.claude/.review-passed`）。

| 項目 | 詳細 |
|---|---|
| Worktree | `../issue-<N>`（Issue ごとに別々） |
| 完了後 | 各エージェントが PR URL を報告して終了 |

---

## Worktree の自動管理

- `check-worktrees.sh`（SessionStart hook）がマージ済み worktree を自動削除する
- クローズされた（マージなし）Issue の worktree は手動で削除する:

```bash
git worktree remove ../issue-<N>
```

---

## エージェント使用ルール

エージェントを使う場合は `.claude/agents/` 配下で定義されたもののみを使用する。
oh-my-claudecode やその他のプラグイン由来のエージェントは使用しない。

### 利用可能なエージェント一覧

| エージェント | 役割 |
|---|---|
| `coder` | コーディング・機能実装（TDD） |
| `ui-designer` | UI コンポーネント実装 |
| `requirements-analyst` | 要件定義・仕様策定 |
| `security-engineer` | セキュリティ実装 |
| `infra-engineer` | インフラ・CI/CD 設定 |
| `code-reviewer` | コードレビュー（全指摘 0 件になるまで繰り返す） |
| `ui-reviewer` | UI/UX レビュー |
| `security-reviewer` | セキュリティレビュー |
| `infra-reviewer` | インフラレビュー |
| `requirements-reviewer` | 要件定義レビュー |

### エージェント連携パターン

**TeamCreate / TaskCreate / SendMessage は使用しない。** Agent ツールで直接 spawn する。

- 実装は必ず `coder` エージェント経由で行う
- レビュー系エージェントは同一メッセージで並列 spawn 可能
- 各エージェントは Issue に紐づく worktree 内で動作させる
- 複数 Issue の場合は「複数 Issue の並列処理」セクションを参照

---

## 絶対ルール

- GitHub Issue がない状態で作業を始めない
- Issue ごとに専用 worktree を使う（`scripts/create-worktree.sh` を使う）
- `main` で直接編集しない
- Git 操作は `cd <worktree>` または `git -C <worktree-path> ...` だけを使う
- `pnpm` / `node` / `biome` / `turbo` は原則 `cd <worktree> && direnv exec <worktree> ...` で実行する
- `git --git-dir=...`、`GIT_DIR`、`GIT_WORK_TREE` を使わない
- `git config core.bare` と `git config core.worktree` を変更しない
- 可能な限り TDD で進める
- Lint / Format は Biome を使う
- 破壊的な Git コマンドを使わない
- **レビューが通る前に push しない**（pre-push-review-guard.sh がブロックする）
- **code-reviewer と security-reviewer の両方が「全件 PASS（0件）」を返すまで push しない**（🔴/🟡/💡 問わず指摘が 1 件でも残れば修正ループを続ける）
  - **注意**: 「全件 PASS（0件）」とは 🔴/🟡/💡 のいずれも 0 件であることを意味する。💡（改善提案）が 1 件でも残っている場合は PASS ではない
- **オーケストレーターは main ブランチ上でソースファイルを直接編集しない。worktree 上でもエージェントへの委譲を優先する**
- **TeamCreate / TaskCreate / SendMessage は使用しない**（Agent ツールで直接 spawn する）
- **再レビューは新しい Agent を spawn する**（同じエージェントを再利用しない）
- **すべてのエージェントを spawn するときは必ず `mode="acceptEdits"` を指定する**（実装系・レビュー系を問わず）
- **レビュー PASS 後のマーカー作成・push・PR 作成はオーケストレーターが Bash で行う**

---

## 話し方ルール

- ツール呼び出し前の予告を禁止する（「〜を読む」「〜を確認する」「〜をプッシュする」等）
- 作業ステップの実況を禁止する（「まず〜を確認してから〜する」等）
- 完了報告は最小限のみ許可する（完了した内容の詳細列挙は禁止）
- ツール呼び出しは予告なしに直接実行する

---

## 目的

[`.codex/`](./.codex) 配下のファイルは、Claude 用に既に存在する hook とルールを Codex からも同じように使えるようにするための薄いラッパーです。ルール本体を二重管理しないことを優先します。
