# TechClip 開発ルール

TechClipは、技術記事・動画をAIで要約・翻訳してモバイルで快適に閲覧できるキュレーションアプリです。

---

## プロジェクト概要

| 項目 | 内容 |
|------|------|
| アプリ種別 | モバイルアプリ（iOS / Android） |
| 主機能 | 技術コンテンツのAI要約・翻訳・キュレーション |
| ターゲット | 技術者・エンジニア |

---

## Tech Stack（バージョン付き）

| カテゴリ | 技術 | バージョン |
|----------|------|-----------|
| パッケージマネージャー | pnpm | 9.x |
| モノレポ | Turborepo | 2.x |
| モバイル | React Native + Expo | SDK 52 |
| スタイリング | Nativewind | v4 |
| API サーバー | Cloudflare Workers + Hono | Hono 4.x |
| DB | Turso (libSQL) + Drizzle ORM | Drizzle 0.40.x |
| 認証 | Better Auth | 1.x |
| AI 推論 | RunPod + Qwen2.5 9B | - |
| Lint / Format | Biome | 1.x |
| テスト | Vitest | 2.x |
| 開発環境 | Nix (flake.nix) | - |
| 言語 | TypeScript | 5.x |

> ローカル開発のDBはSQLite（Tursoクライアントがローカルファイルを利用）

---

## 環境セットアップ

```bash
# 1. Nix 開発環境に入る（Node, pnpm, wrangler など自動で入る）
nix develop

# 2. 依存パッケージのインストール
pnpm install

# 3. 環境変数の設定
cp .env.example .env
# .env を編集して必要な値を入力

# 4. DBマイグレーション（初回）
pnpm drizzle-kit migrate

# 5. 開発サーバー起動
pnpm dev
```

### パッケージ追加時の注意

```bash
# ✅ 正しい: workspace指定
pnpm add <pkg> --filter @tech-clip/api

# ❌ 禁止: ルートに直接追加
pnpm add <pkg>
```

---

## 必須ワークフロー（絶対厳守）

すべての開発作業は以下のフローに従うこと。違反した成果物はすべてやり直し。

### 1. GitHub Issue を取得する（なければ作成する）
- 既存のIssueがある場合: `gh issue view <番号>` で内容を確認
- 既存のIssueがない場合: `gh issue create` でIssueを先に作成してから着手
- **Issue番号がない状態での作業開始は禁止**

### 2. Git Worktree を作成する
- ブランチ名: `issue/<issue番号>/<短い説明>`
- コマンド: `git worktree add .worktrees/issue-N -b issue/N/short-desc`

### 3. Worktree 内で TDD 実装
- **RED**: テストを先に書く（失敗することを確認）
- **GREEN**: テストを通す最小限のコードを書く
- **REFACTOR**: テストが通る状態を維持しつつリファクタ
- カバレッジ目標: 80%以上

### 4. コミット & プッシュ
- Conventional Commits 形式でコミット（詳細は下記参照）
- コミットメッセージに Issue 番号を含める

### 5. PR を作成し、ユーザーレビューを待つ
- PR 本文に `Closes #<issue番号>` を含める
- **全PRはユーザーレビュー必須**（セルフマージ禁止）

### 6. マージ後、Worktree をクリーンアップ

```bash
git worktree remove .worktrees/issue-N
git branch -d issue/N/short-desc
```

---

## ブランチ命名規則

```
issue/<issue番号>/<短い説明（kebab-case）>

例:
  issue/17/init-monorepo
  issue/49/nix-flake-setup
  issue/86/better-auth-integration
```

- メインブランチ: `main`
- 作業ブランチはすべて上記形式
- `main` への直接コミット禁止

---

## Conventional Commits

```
<type>: <summary> #<issue番号>

types:
  feat     新機能
  fix      バグ修正
  docs     ドキュメントのみの変更
  test     テストの追加・修正
  refactor リファクタリング（機能変更なし）
  chore    ビルド・ツール・設定の変更
  perf     パフォーマンス改善
  style    フォーマットのみの変更（ロジック変更なし）
  ci       CIの変更

例:
  feat: add user authentication with Better Auth #86
  fix: resolve SQLite connection leak on worker restart #92
  docs: complete CLAUDE.md with full development rules #118
  test: add integration tests for article parser #103
```

### コミットの粒度

- 1コミット = 1つの論理的変更
- テストと実装は同一コミットに含めてよい
- 大きな変更は複数コミットに分割する

---

## PR テンプレート

PRを作成する際は以下の形式を使用する:

```markdown
## 概要

<!-- このPRで何をしたか1〜3行で説明 -->

## 変更内容

-
-

## テスト

- [ ] Unit テスト追加・更新済み
- [ ] Integration テスト追加・更新済み
- [ ] カバレッジ 80% 以上を確認済み
- [ ] `pnpm test` がすべてパスすること
- [ ] `pnpm lint` がエラーなしで通ること

## 関連Issue

Closes #<issue番号>
```

---

## コーディング規約

詳細は `.claude/rules/` を参照:

| ファイル | 内容 |
|---------|------|
| `.claude/rules/coding-standards.md` | TypeScript規約（any禁止、早期リターン、JSDoc等） |
| `.claude/rules/testing.md` | テスト規約（AAAパターン、命名規則等） |
| `.claude/rules/api-design.md` | RESTful API設計、レスポンス形式 |
| `.claude/rules/database.md` | Drizzle ORM、マイグレーション規則 |
| `.claude/rules/security.md` | セキュリティ要件（認証、XSS、SQLi等） |
| `.claude/rules/frontend-design.md` | UIデザイン規約（Lucide Icons、カラーシステム等） |

### 重要ルールの要約

- `any` 型禁止 → `unknown` + 型ガード
- `else` 文禁止 → 早期リターン
- `console.log` 禁止 → logger 使用
- Biome のみ使用（ESLint / Prettier 禁止）
- エラーメッセージは日本語
- ハードコード禁止（環境変数 or 定数化）

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
- `drizzle-kit push` の使用（**`drizzle-kit migrate` のみ許可**。push はスキーマ差分を直接適用し、マイグレーション履歴が残らないため本番運用で危険）
- テストを書かずに実装コードを書くこと（TDDサイクル厳守）
- テストカバレッジ80%未満でのPR作成

---

## TDD ルール

### TDDサイクル

1. **RED** - 失敗するテストを書く。実装より先にテストを作成し、テストが意図通りに失敗することを確認する
2. **GREEN** - テストを通す最小限のコードを書く。動作すれば十分。綺麗さより動作優先
3. **REFACTOR** - テストが通った状態を維持しつつ、コードの品質を向上させる

### テスト種別の使い分け

| 種別 | 対象 | ツール |
|------|------|--------|
| Unit | 関数・クラス単体のロジック | Vitest |
| Integration | 複数モジュール間の連携、APIエンドポイント | Vitest + Hono testclient |
| E2E | ユーザー操作を模したシナリオ | （別途定義） |

### カバレッジ目標

- **80%以上**を目標とする（line / statement カバレッジ）
- PRレビュー時にカバレッジレポートを添付すること

### TDD対象外

以下のissueはコード実装を伴わないため、TDD対象外とする。
- デザインモックアップ・UI仕様の作成
- ドキュメント更新のみのissue
- 環境設定・インフラ構成のみの変更

---

## 実装順序（必読）

**実装順序の違反は禁止。依存Issueが未完了の状態で着手しないこと。**

詳細は `docs/ROADMAP.md` を参照。

### Phase 順序

1. **Phase 0**: セットアップ → 現在着手中
2. **Phase 1**: DB + 認証 → Phase 0 完了後
3. **Phase 2**: パーサー → Phase 1 完了後
4. **Phase 3**: API → Phase 1, 2 完了後
5. **Phase 4**: モバイル → Phase 3 完了後
6. **Phase 5-9**: 課金、ソーシャル、オフライン、テスト、リリース

### 依存関係チェック

- セッション開始時に `implementation-order-guard.sh` が自動実行
- 依存Issueが未完了の場合、警告が表示される
- 詳細な依存関係は `docs/ROADMAP.md` を参照
- ROADMAP更新時は `scripts/sync-roadmap.sh` で GitHub Issue との整合性を検証すること

### 次に着手すべきIssue（Phase 0）

| Issue | タイトル | 依存 |
|-------|---------|------|
| #17 | pnpm workspace + Turborepo 初期化 | - |
| #49 | Nix 開発環境 (flake.nix) セットアップ | - |

これら2つは並行作業可能。#17 完了後に #19, #18, #36 へ進める。

---

## コンフリクト防止ルール

### 並列実装時の分類ルール

1. **Backend issues** (apps/api/): 別ファイルなら並列マージOK
2. **Mobile issues** (apps/mobile/):
   - パッケージ追加あり → 1つずつ直列マージ（pnpm-lock.yaml衝突防止）
   - 同じ画面/storeを変更 → 1つずつ直列マージ
   - 新規ファイルのみ → 並列マージOK
3. **Docs issues**: 並列マージOK
4. **wrangler.toml を変更するissue**: 直列マージ

### マージ手順

- `scripts/safe-merge.sh <PR番号> [worktree_path]` を使用
- コンフリクト時は自動rebaseを試みる
- 自動rebase失敗時のみ手動介入

```bash
# 使用例
bash scripts/safe-merge.sh 123
bash scripts/safe-merge.sh 123 .worktrees/issue-123
```

---

## プロダクション完遂ルール

**TechClipはプロダクション用アプリケーションである。全Issueを最後まで作り切ること。**

- Open Issue が残っている限り、作業を止めない
- 1セッションで可能な限り多くのIssueを並列処理し、効率的に消化する
- 実装 → レビュー → マージ → 次のIssue のサイクルを高速に回す
- Worktree を活用した並列開発で、独立したIssueは同時に進める
- ブロッカーがない限り、セッション終了時に「次に着手すべきIssue」を提示する

---

## マージフロー（必須）

PRマージは以下の手順に従うこと。レビューなしでのマージは禁止。

### 自動化されたフロー

1. 実装エージェントがPR作成（**マージはしない**）
2. code-review エージェントがPRをレビュー
3. 重大な問題があれば修正してから再レビュー
4. `scripts/review-and-merge.sh <PR番号>` でマージ

```bash
# 使用例
bash scripts/review-and-merge.sh 123
```

### 実装エージェントへの指示テンプレート

実装エージェント（executor）に以下を含めること:

```
PR作成後、以下の手順でレビュー→マージまで自律的に完了させること:
1. PR作成（/finish スキル準拠）
2. Agent(subagent_type="code-reviewer") を起動し、PR diffをレビュー
3. 重大な指摘があれば修正→再push
4. scripts/safe-merge.sh <PR番号> でマージ
```

### 禁止事項

- レビューなしでのマージ
- `gh pr merge` を直接呼ぶこと（必ず `scripts/safe-merge.sh` 経由）
- CI失敗・コンフリクト状態でのマージ

---

## エージェント構成

### 許可エージェント（settings.json で制御）

| エージェント | 用途 | 対応スキル |
|-------------|------|-----------|
| `executor` | 実装・修正・リファクタ | `/new-feature`, `/finish` |
| `code-reviewer` | コードレビュー | `/review/code-review` |
| `Explore` | コードベース探索 | - |
| `Plan` | 設計・計画 | - |
| `general-purpose` | 汎用タスク | - |

上記以外のエージェントタイプは settings.json の allow リストにないため起動不可。

### 実装→レビュー→マージフロー

```
executor (実装)
  ├── TDD実装（/new-feature スキル）
  ├── biome check
  ├── コミット・push・PR作成（/finish スキル）
  ├── Agent(code-reviewer) を起動（/review/code-review スキル）
  │     └── レビュー結果を返す
  ├── HIGH以上の指摘 → 修正→再push→再レビュー
  └── scripts/safe-merge.sh <PR番号> でマージ
```

### 並列実装時のルール

- 各 executor は独立した worktree で作業
- マージ順序はコンフリクト防止ルール（下記）に従う
- executor 同士は互いのファイルを変更しない
