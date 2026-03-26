# TechClip 開発ルール

## 必須ワークフロー（絶対厳守）

すべての開発作業は以下のフローに従うこと。違反した成果物はすべてやり直し。

### 1. GitHub Issue を取得する
### 2. Git Worktree を作成する
- ブランチ名: `issue/<issue番号>/<短い説明>`
- コマンド: `git worktree add .worktrees/issue-N -b issue/N/short-desc`
### 3. Worktree 内で TDD 実装
- **RED**: テストを先に書く（失敗することを確認）
- **GREEN**: テストを通す最小限のコードを書く
- **REFACTOR**: テストが通る状態を維持しつつリファクタ
- カバレッジ目標: 80%以上
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
- `drizzle-kit push` の使用（**`drizzle-kit migrate` のみ許可**。push はスキーマ差分を直接適用し、マイグレーション履歴が残らないため本番運用で危険）
- テストを書かずに実装コードを書くこと（TDDサイクル厳守）
- テストカバレッジ80%未満でのPR作成

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

---

## Agent Teams 構成

### 有効化
settings.jsonで `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` を設定済み。

### チーム構成

#### 1. TDDチーム（新機能開発）
```
Test Agent ──→ Impl Agent
```
| Agent | 担当 | Worktree |
|-------|------|----------|
| Test | テスト作成 → コミット（RED確定） | .worktrees/test |
| Impl | 実装 + 独立検証（GREEN + REFACTOR） | .worktrees/impl |

**ルール**:
- テストを先にコミットしてからImplに渡す（テスト改ざん防止）
- Implは独立検証で過適合を防ぐ

#### 2. コードレビューチーム
```
Bug Hunter + Verifier + Ranker → 統合レポート
```
| Agent | 担当 |
|-------|------|
| Bug Hunter | バグ・問題検出（並列） |
| Verifier | 検出結果の検証（偽陽性除去） |
| Ranker | 重要度判定・優先順位付け |

**出力**: PRに1つのサマリーコメント + インラインコメント

#### 3. セキュリティ監査チーム
```
Security + Performance + Coverage → 統合レポート
```
| Agent | 担当 |
|-------|------|
| Security | 脆弱性検出（OWASP Top 10） |
| Performance | ボトルネック検出 |
| Coverage | テストギャップ検出 |

**出力**: 単一セキュリティレポート

### チーム運用ルール
- **小さく保つ**: 2-3エージェントで狭いスコープが最適
- **Plan-first**: 計画なしでコードに飛び込まない
- **コンテキスト共有**: チームメイトは会話履歴を継承しないため、spawn時に必要な情報を渡す
