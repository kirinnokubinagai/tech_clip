# TechClip 開発ルール

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
- Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`
- コミットメッセージに Issue 番号を含める (例: `feat: initialize monorepo #1`)
### 5. PR を作成し、コードレビュー → マージ
- PR 本文に `Closes #<issue番号>` を含める
- code-review エージェントでレビューを実施し、問題なければ `gh pr merge` でマージ
- 重大な問題が検出された場合は修正してから再レビュー → マージ
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
- レビューなしでのマージ（code-review エージェントによるレビュー必須）
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

## プロダクション完遂ルール

**TechClipはプロダクション用アプリケーションである。全Issueを最後まで作り切ること。**

- Open Issue が残っている限り、作業を止めない
- 1セッションで可能な限り多くのIssueを並列処理し、効率的に消化する
- 実装 → レビュー → マージ → 次のIssue のサイクルを高速に回す
- Worktree を活用した並列開発で、独立したIssueは同時に進める
- ブロッカーがない限り、セッション終了時に「次に着手すべきIssue」を提示する

---

## Tech Stack
- pnpm (パッケージマネージャー)
- Turborepo (monorepo)
- React Native + Expo (モバイル)
- Cloudflare Workers + Hono (API)
- Turso + Drizzle ORM (DB) ※ローカル開発は SQLite
- Better Auth (認証)
- RunPod + Qwen3.5 9B (AI要約・翻訳)
- Nativewind v4 (スタイリング)
- Biome (lint + formatter)
- Nix (開発環境)

## 実装順序（必読）

**実装順序の違反は禁止。依存Issueが未完了の状態で着手しないこと。**

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
