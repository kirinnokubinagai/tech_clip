# TechClip 開発ルール

## 必須ワークフロー（絶対厳守）

すべての開発作業は以下のフローに従うこと。違反した成果物はすべてやり直し。

### 1. GitHub Issue を取得する
### 2. Git Worktree を作成する
- ブランチ名: `issue/<issue番号>/<短い説明>`
- コマンド: `git worktree add ../tech_clip-issue-N -b issue/N/short-desc`
### 3. Worktree 内で TDD 実装
- テストを先に書く → 失敗確認 → 実装 → テスト通す → リファクタ
### 4. コミット & プッシュ
- Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`
- コミットメッセージに Issue 番号を含める (例: `feat: initialize monorepo #1`)
### 5. PR を作成し、ユーザーレビューを待つ
- PR 本文に `Closes #<issue番号>` を含める
- **全PRはユーザーレビュー必須**（セルフマージ禁止）
### 6. マージ後、Worktree をクリーンアップ

---

## .gitignore 管理ルール
- 新しいツール・フレームワーク・依存を追加した場合、必ず `.gitignore` も更新すること
- 対象: ビルド成果物、キャッシュ、環境変数ファイル、IDE設定、OS固有ファイル等
- `.gitignore` の更新は、そのツール導入issueに含めて対応する（別issueは不要）

---

## 禁止事項
- Issue なしでの作業開始
- Worktree を使わずにメインブランチで直接コード変更
- セルフマージ（ユーザーレビュー前のマージ）
- ESLint / Prettier の使用（Biome を使用すること）

## Tech Stack
- pnpm (パッケージマネージャー)
- Turborepo (monorepo)
- React Native + Expo (モバイル)
- Cloudflare Workers + Hono (API)
- Turso + Drizzle ORM (DB) ※ローカル開発は SQLite
- Better Auth (認証)
- Claude API (AI要約・翻訳)
- Nativewind v4 (スタイリング)
- Biome (lint + formatter)
- Nix (開発環境)

## 実装順序
詳細は `docs/ROADMAP.md` を参照（#117 で作成予定）
