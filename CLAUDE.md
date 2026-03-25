# TechClip 開発ルール

## 必須ワークフロー（絶対厳守）

すべての開発作業は以下のフローに従うこと。違反した成果物はすべてやり直し。

### 1. GitHub Issue を作成する
- 作業を始める前に必ず GitHub Issue を作成する
- Issue には目的、タスク一覧、完了条件を記載する

### 2. Git Worktree を作成する
- Issue ごとに専用の git worktree を切る
- ブランチ名: `issue/<issue番号>/<短い説明>` (例: `issue/1/monorepo-setup`)
- コマンド例:
  ```bash
  git worktree add ../tech_clip-issue-1 -b issue/1/monorepo-setup
  ```

### 3. Worktree 内で作業する
- 作業は必ず worktree ディレクトリ内で行う
- メインのワーキングツリーでは直接コード変更しない

### 4. コミット & プッシュ
- worktree 内でコミット・プッシュする
- コミットメッセージに Issue 番号を含める (例: `feat: initialize monorepo #1`)

### 5. PR を作成する
- worktree のブランチから PR を作成する
- PR の本文に `Closes #<issue番号>` を含める

### 6. Worktree をクリーンアップする
- PR マージ後、worktree を削除する
  ```bash
  git worktree remove ../tech_clip-issue-1
  ```

---

## 禁止事項
- Issue なしでの作業開始
- Worktree を使わずにメインブランチで直接コード変更
- 上記フローを省略すること

## Tech Stack
- pnpm (パッケージマネージャー)
- Turborepo (monorepo)
- React Native + Expo (モバイル)
- Cloudflare Workers + Hono (API)
- Turso + Drizzle ORM (DB)
- Better Auth (認証)
- Claude API (AI要約・翻訳)
- Nativewind v4 (スタイリング)
