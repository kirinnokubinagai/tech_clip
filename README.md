# TechClip

技術記事・動画を AI で要約・翻訳し、モバイルで快適に閲覧できるキュレーションアプリ。

Zenn、Qiita、dev.to、YouTube などの技術コンテンツを保存するだけで、AI が日本語要約と翻訳を自動生成。通勤中やスキマ時間に効率よく技術情報をキャッチアップできる。

## 主な機能

- 記事 URL を貼るだけで自動取得・保存
- 他アプリの共有ボタンから直接保存（Share Intent 対応）
- AI による要約生成（長文記事を数行に凝縮、デバイス言語に自動対応）
- AI による翻訳（任意の言語間で翻訳可能）
- 19 ソース対応（`other` を含む。対応定義は `apps/mobile/src/lib/sources.ts` に集約）
- オフライン閲覧（バックグラウンド同期実装済み）
- タグ・お気に入りで整理
- プレミアムプラン（RevenueCat によるサブスクリプション）
- 多言語 UI 対応（日本語 / 英語）

## 対応ソース

> 対応ソースは `apps/mobile/src/lib/sources.ts` を source-of-truth として README / onboarding / UI と同期している。
> URL からソース種別を判定し、対応するパーサーへディスパッチする実装は接続済み。個別パーサーが失敗した場合のみ汎用パーサーへフォールバックする。

| ソース | 種別 | 状態 |
|--------|------|------|
| Zenn | 記事 / 本 | 対応済み |
| Qiita | 記事 | 対応済み |
| note | 記事 | 対応済み |
| はてなブログ | 記事 | 対応済み |
| dev.to | 記事 | 対応済み |
| Medium | 記事 | 対応済み |
| Hacker News | 記事 | 対応済み |
| Hashnode | 記事 | 対応済み |
| GitHub | README / Issue / Discussion | 対応済み |
| StackOverflow | Q&A | 対応済み |
| Reddit | 投稿 / コメント | 対応済み |
| Speaker Deck | スライド | 対応済み |
| freeCodeCamp | 記事 | 対応済み |
| LogRocket | 記事 | 対応済み |
| CSS-Tricks | 記事 | 対応済み |
| Smashing Magazine | 記事 | 対応済み |
| YouTube | 動画 (字幕要約) | 対応済み (字幕なし動画は 422) |
| Twitter / X | ツイート / スレッド | 対応済み (oEmbed API 経由) |
| その他 URL | 汎用パーサー | 対応済み |

## Tech Stack

| カテゴリ | 技術 | バージョン |
|----------|------|-----------|
| 言語 | TypeScript | 5.x |
| パッケージマネージャー | pnpm | 10.x |
| モノレポ | Turborepo | 2.x |
| モバイル | React Native + Expo | SDK 55 |
| UI フレームワーク | React | 19.x |
| スタイリング | NativeWind (Tailwind CSS) | v4 |
| 状態管理 | Zustand + TanStack Query | - |
| API サーバー | Cloudflare Workers + Hono | Hono 4.x |
| データベース | Turso (libSQL) + Drizzle ORM | Drizzle 0.40.x |
| 認証 | Better Auth (Email / Google / Apple / GitHub) | 1.x |
| AI 推論 | Cloudflare Workers AI (Gemma) | - |
| 課金 | RevenueCat | - |
| 広告 | Google AdMob | - |
| Lint / Format | Biome | 1.x |
| テスト (API) | Vitest | 2.x |
| テスト (Mobile) | Jest + @testing-library/react-native | v14 |
| E2E テスト | Maestro | - |
| セキュリティスキャン | OWASP ZAP (Nix ネイティブ) | 2.17.0 |
| 開発環境 | Nix (flake.nix) | - |
| CI/CD | GitHub Actions + EAS Build | - |

## アーキテクチャ

```
                  +-------------------+
                  |   Mobile App      |
                  |   (Expo / RN)     |
                  +--------+----------+
                           |
                    REST API (HTTPS)
                           |
                  +--------v----------+
                  |   API Server      |
                  |   (CF Workers +   |
                  |    Hono)          |
                  +---+----------+----+
                      |          |
              +-------v--+  +---v---------+
              |  Turso   |  |  Workers AI |
              |  (SQLite)|  |   (Gemma)   |
              +----------+  +-------------+
```

## プロジェクト構成

```
tech_clip/
├── apps/
│   ├── mobile/              # React Native + Expo モバイルアプリ
│   │   ├── app/             #   Expo Router ファイルベースルーティング
│   │   ├── src/
│   │   │   ├── components/  #   UI コンポーネント（テストは同ディレクトリに併置）
│   │   │   ├── hooks/       #   カスタムフック
│   │   │   ├── stores/      #   Zustand ストア（テストは同ディレクトリに併置）
│   │   │   └── lib/         #   ユーティリティ（テストは同ディレクトリに併置）
│   └── api/                 # Cloudflare Workers + Hono API サーバー
│       ├── src/
│       │   ├── routes/      #   API ルート定義
│       │   ├── db/          #   Drizzle スキーマ・マイグレーション
│       │   └── services/    #   ビジネスロジック
│       └── drizzle/         #   マイグレーション SQL
├── tests/
│   ├── api/                 # API の unit / integration テスト
│   └── mobile/              # モバイルの画面・ロジックテスト
├── packages/
│   └── types/               # モバイル・API 共有型定義
├── scripts/                 # 運用スクリプト
├── docs/                    # 設計ドキュメント・法的文書
├── .github/workflows/       # CI/CD ワークフロー
├── .zap/                    # OWASP ZAP セキュリティスキャン設定
├── flake.nix                # Nix 開発環境定義
├── turbo.json               # Turborepo 設定
├── biome.json               # Biome (lint + format) 設定
└── pnpm-workspace.yaml      # pnpm ワークスペース定義
```

## セットアップ

### 前提条件

- [Nix](https://nixos.org/download/) がインストールされていること（Flakes 有効）

Nix 以外のツール（Node.js, pnpm, Biome, OWASP ZAP など）は全て `nix develop` で自動インストールされる。Docker は不要。

### クイックスタート

```bash
# 1. リポジトリをクローン
git clone https://github.com/kirinnokubinagai/tech_clip.git
cd tech_clip

# 2. Nix 開発環境に入る（全ツールが自動で揃う）
nix develop

# 3. 依存パッケージのインストール（初回は自動実行される）
pnpm install

# 4. 環境変数の設定
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/mobile/.env.example apps/mobile/.env
# 各ファイルを編集して必要な値を入力（詳細は下記「環境変数」を参照）

# 5. DB マイグレーション
cd apps/api && pnpm db:migrate && cd ../..

# 6. 開発サーバー起動
pnpm dev:api     # API サーバー (http://localhost:8787)
pnpm dev:mobile  # Expo 開発サーバー
```

### Nix が提供するツール

`nix develop` で以下が全て自動インストールされる:

| ツール | 用途 |
|--------|------|
| Node.js 22 | JavaScript ランタイム |
| pnpm | パッケージマネージャー |
| Turborepo | モノレポビルド |
| Biome | Lint / Format |
| Wrangler | Cloudflare Workers CLI |
| OWASP ZAP 2.17.0 | セキュリティスキャン |
| gh | GitHub CLI |
| jq | JSON 処理 |
| curl | HTTP クライアント |

## コマンド一覧

### 開発

```bash
pnpm dev:mobile          # Expo 開発サーバー起動
pnpm dev:api             # API サーバー起動 (localhost:8787)
```

### テスト

```bash
pnpm test                # 全テスト実行
pnpm test --filter @tech-clip/mobile   # モバイルテストのみ
pnpm test --filter @tech-clip/api      # API テストのみ
```

### コード品質

```bash
pnpm lint                # Biome lint チェック
pnpm lint:fix            # Biome lint 自動修正
pnpm typecheck           # TypeScript 型チェック
```

### データベース

```bash
cd apps/api
pnpm db:generate --name <変更内容>  # マイグレーション生成
pnpm db:migrate                      # マイグレーション適用
pnpm db:studio                       # Drizzle Studio (DB ブラウザ)
pnpm db:seed                         # シードデータ投入
```

### ビルド・デプロイ

```bash
pnpm build                           # 全ビルド
pnpm deploy:staging                  # API を Staging にデプロイ
pnpm deploy:production               # API を Production にデプロイ
eas build --platform ios              # iOS ビルド (EAS)
eas build --platform android          # Android ビルド (EAS)
```

## 環境変数

### API サーバー (`apps/api/.dev.vars`)

| 変数名 | 説明 | 取得元 |
|--------|------|--------|
| `ENVIRONMENT` | 実行環境 (`development` / `staging` / `production`) | - |
| `TURSO_DATABASE_URL` | Turso DB 接続 URL | [Turso Dashboard](https://app.turso.tech) |
| `TURSO_AUTH_TOKEN` | Turso 認証トークン | [Turso Dashboard](https://app.turso.tech) |
| `BETTER_AUTH_SECRET` | セッション署名シークレット (32文字以上) | `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` / `SECRET` | Google OAuth | [Google Cloud Console](https://console.cloud.google.com) |
| `APPLE_CLIENT_ID` / `SECRET` | Apple Sign In | [Apple Developer](https://developer.apple.com) |
| `GITHUB_CLIENT_ID` / `SECRET` | GitHub OAuth | [GitHub Developer Settings](https://github.com/settings/developers) |

### モバイルアプリ (`apps/mobile/.env`)

| 変数名 | 説明 | 取得元 |
|--------|------|--------|
| `EXPO_PUBLIC_API_URL` | API 接続先 URL | ローカル: `http://localhost:8787` |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | RevenueCat iOS キー | [RevenueCat](https://app.revenuecat.com) |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | RevenueCat Android キー | [RevenueCat](https://app.revenuecat.com) |
| `EXPO_PUBLIC_ADMOB_BANNER_ID` | AdMob バナー広告 ID | [Google AdMob](https://admob.google.com) |

詳細な取得手順は `docs/SECRETS.md` を参照。

## CI/CD

GitHub Actions で以下のワークフローが自動実行される:

| ワークフロー | トリガー | 内容 |
|-------------|---------|------|
| `ci.yml` | PR / push | Lint, Typecheck, Test, Audit |
| `e2e.yml` | EAS Build 完了後 | Maestro E2E テスト (`tests/e2e/maestro/`) |
| `eas-build.yml` | main push | EAS iOS / Android ビルド |
| `eas-submit.yml` | 手動 / workflow_dispatch | EAS で App Store / Google Play へ提出 |
| `deploy.yml` | main push | API を Cloudflare Workers にデプロイ |
| `pr-comment-review.yml` | PR コメント | コメントトリガーで追加レビュー実行 |
| `verify-uncached.yml` | 手動 / 定期実行 | キャッシュを使わず CI を再実行して整合性を検証 |

## セキュリティ

pre-push フックで以下が自動実行される:

1. **Biome Lint** - コード品質チェック
2. **TypeScript 型チェック** - 型安全性の検証
3. **テスト** - 全テストスイート実行
4. **OWASP ZAP スキャン** - API に対するセキュリティスキャン

ZAP は Nix でネイティブインストールされるため、Docker は不要。`nix develop` 環境内で `git push` すると自動的に ZAP デーモンが起動し、OpenAPI 定義に基づいてアクティブスキャンを実行する。

## デプロイ

### API (Cloudflare Workers)

```bash
# Staging
pnpm deploy:staging

# Production
pnpm deploy:production
```

Wrangler の設定は `apps/api/wrangler.toml` を参照。

### モバイルアプリ (EAS Build)

```bash
# 開発用ビルド
eas build --profile development --platform all

# 本番ビルド
eas build --profile production --platform all

# ストア提出
eas submit --platform ios
eas submit --platform android
```

EAS の設定は `apps/mobile/eas.json` を参照。ストア申請の詳細は以下を参照:

- `docs/APP_STORE_IOS.md` - iOS App Store 申請手順
- `docs/PLAY_STORE_ANDROID.md` - Google Play 申請手順
- `docs/RELEASE_CHECKLIST.md` - リリース前チェックリスト

## ドキュメント

| ファイル | 内容 |
|---------|------|
| `docs/CONTRIBUTING.md` | コントリビューションガイド・ドキュメント同期ルール |
| `docs/ROADMAP.md` | 開発ロードマップ・Phase 管理 |
| `docs/SECRETS.md` | 環境変数・シークレットの取得手順 |
| `docs/RELEASE_CHECKLIST.md` | リリース前チェックリスト |
| `docs/DB_BACKUP.md` | データベースバックアップ手順 |
| `docs/DB_MIGRATION_ROLLBACK.md` | マイグレーションロールバック手順 |
| `docs/OTA_UPDATES.md` | OTA アップデート手順 |
| `docs/CUSTOM_DOMAIN.md` | カスタムドメイン設定 |
| `docs/VERSIONING.md` | バージョニングポリシー |
| `docs/DEEP_LINKS.md` | ディープリンク設定 |
| `docs/APP_STORE_IOS.md` | iOS App Store 申請手順 |
| `docs/PLAY_STORE_ANDROID.md` | Google Play 申請手順 |
| `docs/legal/privacy-policy.md` | プライバシーポリシー |
| `docs/legal/terms-of-service.md` | 利用規約 |

## 運用スクリプト

| スクリプト | 用途 |
|-----------|------|
| `scripts/db-backup.sh` | Turso データベースバックアップ |
| `scripts/db-restore.sh` | データベースリストア |
| `scripts/bump-version.sh` | バージョンバンプ |
| `scripts/generate-rollback.sh` | ロールバックスクリプト生成 |

## ドキュメント更新ルール

README・ROADMAP と実装の乖離を防ぐため、PR をマージする前に以下を確認する。

| 変更内容 | 更新すべきドキュメント |
|---------|---------------------|
| ソース追加・削除 | `README.md` の対応ソース表、`apps/mobile/src/lib/sources.ts`（source-of-truth） |
| 機能追加・削除 | `README.md` の「主な機能」 |
| Issue クローズ | `docs/ROADMAP.md` の状態を `🔲` → `✅` |
| 環境変数追加 | `README.md` の環境変数表、`.dev.vars.example` / `.env.example` |
| ライブラリ更新 | `README.md` の Tech Stack 表（メジャーバージョン変更時） |

**表記基準:**
- `対応済み` — 実装が完了し PR がマージされている
- `一部対応` — 実装が存在するが機能が制限されている
- `予定 (#N)` — 対応する GitHub Issue が存在し未マージ

未実装のものに `対応済み` と書かないこと。乖離を発見したら Issue を作成して記録すること。

詳細ルールは [`docs/CONTRIBUTING.md`](./docs/CONTRIBUTING.md) を参照。

## ライセンス

Private
