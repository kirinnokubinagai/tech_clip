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
3. analyst を spawn して設計を行わせる（完了を待つ）
4. 実装者とレビュワーを background spawn する
5. `/tmp/tech-clip-issue-{N}/pr-url` をポーリングし PR URL を取得する
6. `gh pr view --json reviews` をポーリングし、修正ループを回す

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
① mkdir -p /tmp/tech-clip-issue-{N}/

② Agent(analyst, mode="acceptEdits")   ← 完了を待つ
   - brainstorming skill で要件・設計を決定する
   - docs/superpowers/specs/ に spec doc が保存される（gitignore 済み）
   - worktree パスと Issue 番号を渡す

③ [並列 background spawn]
   Agent(coder,    run_in_background=true, mode="acceptEdits")
   Agent(reviewer, run_in_background=true, mode="acceptEdits")
   - 両エージェントに worktree パス・issue 番号を渡す
   - coder は spec を読んで実装 → /tmp/tech-clip-issue-{N}/impl-ready に書く
   - reviewer は impl-ready を待ってレビュー → /tmp/tech-clip-issue-{N}/review-result.json に書く
   - PASS になったら reviewer が push + PR 作成 → /tmp/tech-clip-issue-{N}/pr-url に書く

④ /tmp/tech-clip-issue-{N}/pr-url をポーリング（短い Bash 呼び出しを繰り返す）
   PR URL 取得 → ⑤へ

── GitHub レビュー待機ループ ──
⑤ gh pr view {PR番号} --json reviews,state | jq で確認（短い Bash 呼び出しを繰り返す）
   - PENDING          → 再ポーリング
   - APPROVED         → ユーザーに完了報告 → 終了
   - CHANGES_REQUESTED →
       レビューコメントを読む
       /tmp/tech-clip-issue-{N}/impl-ready と review-result.json を削除（リセット）
       Agent(coder,    run_in_background=true, mode="acceptEdits")（feedback を prompt に含める）
       Agent(reviewer, run_in_background=true, mode="acceptEdits")（pr_number を渡す）
       /tmp/tech-clip-issue-{N}/pr-url をポーリング → ⑤に戻る
```

#### インフラ・CI/CD 変更の場合

```text
① mkdir -p /tmp/tech-clip-issue-{N}/

② Agent(analyst, mode="acceptEdits")   ← 完了を待つ

③ [並列 background spawn]
   Agent(infra-engineer, run_in_background=true, mode="acceptEdits")
   Agent(infra-reviewer, run_in_background=true, mode="acceptEdits")
   - 両エージェントに worktree パス・issue 番号を渡す
   - infra-engineer は実装 → /tmp/tech-clip-issue-{N}/impl-ready に書く
   - infra-reviewer は impl-ready を待ってレビュー → /tmp/tech-clip-issue-{N}/review-result.json に書く
   - PASS になったら infra-reviewer が push + PR 作成 → /tmp/tech-clip-issue-{N}/pr-url に書く

④ /tmp/tech-clip-issue-{N}/pr-url をポーリング（短い Bash 呼び出しを繰り返す）
   PR URL 取得 → ⑤へ

── GitHub レビュー待機ループ ──
⑤ gh pr view {PR番号} --json reviews,state | jq で確認（短い Bash 呼び出しを繰り返す）
   - PENDING          → 再ポーリング
   - APPROVED         → ユーザーに完了報告 → 終了
   - CHANGES_REQUESTED →
       レビューコメントを読む
       /tmp/tech-clip-issue-{N}/impl-ready と review-result.json を削除（リセット）
       Agent(infra-engineer, run_in_background=true, mode="acceptEdits")（feedback を prompt に含める）
       Agent(infra-reviewer, run_in_background=true, mode="acceptEdits")（pr_number を渡す）
       /tmp/tech-clip-issue-{N}/pr-url をポーリング → ⑤に戻る
```

#### フロントエンド・UI 変更の場合

```text
① mkdir -p /tmp/tech-clip-issue-{N}/

② Agent(analyst, mode="acceptEdits")   ← 完了を待つ

③ [並列 background spawn]
   Agent(ui-designer, run_in_background=true, mode="acceptEdits")
   Agent(ui-reviewer,  run_in_background=true, mode="acceptEdits")
   - 両エージェントに worktree パス・issue 番号を渡す
   - ui-designer は実装 → /tmp/tech-clip-issue-{N}/impl-ready に書く
   - ui-reviewer は impl-ready を待ってレビュー → /tmp/tech-clip-issue-{N}/review-result.json に書く
   - PASS になったら ui-reviewer が push + PR 作成 → /tmp/tech-clip-issue-{N}/pr-url に書く

④ /tmp/tech-clip-issue-{N}/pr-url をポーリング（短い Bash 呼び出しを繰り返す）
   PR URL 取得 → ⑤へ

── GitHub レビュー待機ループ ──
⑤ gh pr view {PR番号} --json reviews,state | jq で確認（短い Bash 呼び出しを繰り返す）
   - PENDING          → 再ポーリング
   - APPROVED         → ユーザーに完了報告 → 終了
   - CHANGES_REQUESTED →
       レビューコメントを読む
       /tmp/tech-clip-issue-{N}/impl-ready と review-result.json を削除（リセット）
       Agent(ui-designer, run_in_background=true, mode="acceptEdits")（feedback を prompt に含める）
       Agent(ui-reviewer,  run_in_background=true, mode="acceptEdits")（pr_number を渡す）
       /tmp/tech-clip-issue-{N}/pr-url をポーリング → ⑤に戻る
```

---

### Step 3: PR 報告

`/tmp/tech-clip-issue-{N}/pr-url` から PR URL を取得してユーザーに提示する。

---

### Step 4: PR レビューポーリングと自動修正

Step 2 の GitHub レビュー待機ループ（⑤）でポーリングして処理する。

**結果に応じたアクション:**

| 状態 | アクション |
|------|-----------|
| `APPROVED` | 完了。ユーザーに報告 |
| `CHANGES_REQUESTED` | レビューコメントを読む → /tmp/ リセット → 実装者 + レビュワーを background spawn → pr-url をポーリング → ⑤ に戻る |
| `PENDING` | 再ポーリング（短い Bash 呼び出しを繰り返す） |

> **注意**: `pre-push-review-guard.sh` により、`.claude/.review-passed` マーカーがない状態での push はブロックされる。各レビュワーエージェントがマーカー作成・push・PR 作成を担当する。

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
# 2. 各 Issue に対して analyst を sequential spawn、coder/reviewer を background spawn
Agent(analyst, mode="acceptEdits",
  prompt="Issue #<N> の設計を担当する。worktree: /path/to/issue-<N>")

Agent(coder,    run_in_background=true, mode="acceptEdits",
  prompt="Issue #<N> の実装を担当する。worktree: /path/to/issue-<N>")
Agent(reviewer, run_in_background=true, mode="acceptEdits",
  prompt="Issue #<N> のレビュー〜PR作成を担当する。worktree: /path/to/issue-<N>")
```

各バックグラウンドエージェントは analyst による設計完了後に spawn する。coder・reviewer は `/tmp/tech-clip-issue-{N}/` 経由で直接通信し、reviewer が push・PR 作成まで完結する。オーケストレーターは `/tmp/pr-url` のポーリングと GitHub レビューループのみを担当する。

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
| `analyst` | 要件定義・実装設計（brainstorming skill 使用） |
| `coder` | コーディング・機能実装（TDD、reviewer とファイル通信） |
| `reviewer` | コード+セキュリティレビュー・push・PR 作成 |
| `ui-designer` | UI コンポーネント実装 |
| `infra-engineer` | インフラ・CI/CD 設定 |
| `ui-reviewer` | UI/UX レビュー・push・PR 作成 |
| `infra-reviewer` | インフラレビュー・push・PR 作成 |

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
- **push は必ず `bash scripts/push-verified.sh` を使う**（`git push origin HEAD` の直接実行は禁止）
- **`reviewer` が「全件 PASS（0件）」を返すまで push しない**（インフラは `infra-reviewer`、UI は `ui-reviewer`）（CRITICAL / HIGH / MEDIUM / LOW 問わず指摘が 1 件でも残れば修正ループを続ける）
- **オーケストレーターは main ブランチ上でソースファイルを直接編集しない。worktree 上でもエージェントへの委譲を優先する**
- **TeamCreate / TaskCreate / SendMessage は使用しない**（Agent ツールで直接 spawn する）
- **再レビューは新しい Agent を spawn する**（同じエージェントを再利用しない）
- **すべてのエージェントを spawn するときは必ず `mode="acceptEdits"` を指定する**（実装系・レビュー系を問わず）
- **レビュー PASS 後のマーカー作成・push・PR 作成は各レビュワーエージェントが担当する**（オーケストレーターは行わない）
- **機能実装では必ず analyst → coder + reviewer の順で spawn する**（analyst の設計完了を待ってから coder/reviewer を background spawn する）

---

## 話し方ルール

- ツール呼び出し前の予告を禁止する（「〜を読む」「〜を確認する」「〜をプッシュする」等）
- 作業ステップの実況を禁止する（「まず〜を確認してから〜する」等）
- 完了報告は最小限のみ許可する（完了した内容の詳細列挙は禁止）
- ツール呼び出しは予告なしに直接実行する

---

## 目的

[`.codex/`](./.codex) 配下のファイルは、Claude 用に既に存在する hook とルールを Codex からも同じように使えるようにするための薄いラッパーです。ルール本体を二重管理しないことを優先します。
