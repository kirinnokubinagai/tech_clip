# Codex ハーネス

Codex はまずこの [`AGENTS.md`](./AGENTS.md) を読み、その上で [`CLAUDE.md`](./CLAUDE.md) と `.claude/` 配下のルールに従うこと。
Codex 向けの運用ルールはこのファイルを正とする。
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
3. `TeamCreate` でチームを作る
4. エージェントを順序通りに起動する
5. PR URL をユーザーに報告する
6. PR レビューをポーリングし、修正ループを回す

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

### Step 2: TeamCreate でチームを作成

```text
TeamCreate("issue-<N>-team")
```

TeamCreate はユーザー向けテキストで進捗報告をせずに実行する。

オーケストレーターはチームの **team-lead** として振る舞う。エージェントからの SendMessage はすべて team-lead 宛てに届く。

---

### Step 3: タスクを登録

以下のタスクを `TaskCreate` で作成する:

- `要件整理: requirements-analyst が Issue を分析`
- `実装: coder が TDD で実装`
- `レビュー: code-reviewer + security-reviewer が並列レビュー`
- `PR 作成`

---

### Step 4: エージェントを順序通りに起動

#### 機能実装・バグ修正の場合

```text
① requirements-analyst
   - Issue の内容を整理し、実装方針を決定する
   - worktree パスと Issue 番号を渡す

② coder（①完了後に Task ツールで spawn）
   - TDD で実装する（Red → Green → Refactor）
   - pnpm turbo check で lint をクリアする
   - lint エラー 0 件になったらコミットする
   - worktree パスと Issue 番号を渡す
   - coder への修正依頼も SendMessage で行う（修正のたびに新しい spawn はしない）

③ code-reviewer + security-reviewer（②完了後に Task ツールで並列 spawn）
   - 初回のみ Task ツールで teammate を spawn する（以降は SendMessage で再利用）
   - それぞれ独立した視点でレビューする
   - 指摘がある場合: SendMessage(to: "team-lead", ...) でオーケストレーターに報告
     → オーケストレーターが SendMessage(to: "coder", ...) で修正依頼
   - coder 修正完了後: SendMessage(to: "code-reviewer") / SendMessage(to: "security-reviewer") で再レビューを依頼
   - 絶対に再レビューのために新しい Task ツールで spawn しない
   - code-reviewer と security-reviewer の両方が PASS した後に code-reviewer がマーカーファイルを作成する:
     touch "$(git rev-parse --show-toplevel)/.claude/.review-passed"
   - マーカーなしでは push がブロックされる
   - 全件 PASS 確認後、オーケストレーターは code-reviewer と security-reviewer に
     shutdown_request を送ってから TeamDelete する

④ git push → gh pr create（マーカー確認後）
```

#### インフラ・CI/CD 変更の場合

```text
① infra-engineer（実装）
② infra-reviewer + security-reviewer（並列レビュー）
   - 機能実装フローと同じ SendMessage ベースの再レビューループを適用
③ PR 作成
```

#### フロントエンド・UI 変更の場合

```text
① requirements-analyst → ui-designer（実装）
② ui-reviewer + code-reviewer（並列レビュー）
   - 機能実装フローと同じ SendMessage ベースの再レビューループを適用
③ PR 作成
```

---

### Step 5: PR 報告

PR URL をユーザーに提示する。

---

### Step 6: PR レビューポーリングと自動修正

PR 作成後、以下のコマンドでレビュー結果をポーリングする:

```bash
bash scripts/poll-pr-review.sh <pr-number>
```

**結果に応じたアクション:**

| 出力 | アクション |
|------|-----------|
| `APPROVED` | 完了。ユーザーに報告 |
| `CHANGES_REQUESTED` | レビュー内容を読み、coder に修正依頼 → 修正完了後に再プッシュ → Step 6 に戻る |
| `TIMEOUT` | タイムアウト。ユーザーに手動確認を依頼 |

**修正ループの流れ:**

```text
poll-pr-review.sh → CHANGES_REQUESTED
  → SendMessage(to: "coder", ...) で修正依頼
  → coder が修正・コミット・プッシュ
  → poll-pr-review.sh を再実行
  → APPROVED になるまで繰り返す
```

---

## 複数 Issue の並列処理

複数の Issue は別々のチームで並列処理できる。

| 項目 | 詳細 |
|---|---|
| チーム名 | `issue-<N>-team`（Issue ごとに別々） |
| Worktree | `../issue-<N>`（Issue ごとに別々） |
| 完了後 | `TeamDelete` でチームを削除する |

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

### TeamCreate を使ったチーム編成

複数エージェントを並列・直列で協調させる場合は `TeamCreate` を使用する。

**注意点:**
- 実装は必ず `coder` エージェント経由で行う
- レビュー系エージェントは並列実行可能
- 各エージェントは Issue に紐づく worktree 内で動作させる

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
- **オーケストレーターは直接ファイルを編集しない**（すべてエージェントに委譲する）
- **レビューの再依頼は SendMessage で行う**（新しい Task ツールで spawn しない）

---

## 話し方ルール

- ツール呼び出し前の予告を禁止する（「〜を読む」「〜を確認する」「〜をプッシュする」等）
- 作業ステップの実況を禁止する（「まず〜を確認してから〜する」等）
- 完了報告は最小限のみ許可する（完了した内容の詳細列挙は禁止）
- ツール呼び出しは予告なしに直接実行する

---

## 目的

[`.codex/`](./.codex) 配下のファイルは、Claude 用に既に存在する hook とルールを Codex からも同じように使えるようにするための薄いラッパーです。ルール本体を二重管理しないことを優先します。
