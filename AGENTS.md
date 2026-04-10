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
| `code-reviewer` | コードレビュー |
| `ui-reviewer` | UI/UX レビュー |
| `security-reviewer` | セキュリティレビュー |
| `infra-reviewer` | インフラレビュー |
| `requirements-reviewer` | 要件定義レビュー |

### TeamCreate を使ったチーム編成

複数エージェントを並列・直列で協調させる場合は `TeamCreate` を使用する。

**典型的なフロー（機能実装）**

```
requirements-analyst（要件整理）
  ↓
coder（実装）
  ↓（並列）
code-reviewer + security-reviewer + ui-reviewer
  ↓
PR 作成
```

**典型的なフロー（インフラ変更）**

```
infra-engineer（実装）
  ↓
infra-reviewer + security-reviewer（並列レビュー）
  ↓
PR 作成
```

**注意点**
- 実装は必ず `coder` エージェント経由で行う（オーケストレーター直接編集禁止）
- レビュー系エージェントは並列実行可能
- 各エージェントは Issue に紐づく worktree 内で動作させる

## 絶対ルール

- GitHub Issue がない状態で作業を始めない
- Issue ごとに専用 worktree を使う
- `main` で直接編集しない
- Git 操作は `cd <worktree>` または `git -C <worktree-path> ...` だけを使う
- `pnpm` / `node` / `biome` / `turbo` は原則 `cd <worktree> && direnv exec <worktree> ...` で実行する
- `git --git-dir=...`、`GIT_DIR`、`GIT_WORK_TREE` を使わない
- `git config core.bare` と `git config core.worktree` を変更しない
- 可能な限り TDD で進める
- Lint / Format は Biome を使う
- 破壊的な Git コマンドを使わない
- レビューが通る前にマージ提案をしない

## 目的

[`.codex/`](./.codex) 配下のファイルは、Claude 用に既に存在する hook とルールを Codex からも同じように使えるようにするための薄いラッパーです。ルール本体を二重管理しないことを優先します。
