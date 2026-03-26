# TechClip プロジェクトロードマップ

## プロジェクト概要

TechClipは、複数の技術系ニュースソースから記事を収集し、AIによる要約・翻訳機能を提供するモバイルアプリケーションです。

### 主要機能
- 技術系ニュースソースからの記事収集
- Qwen3.5 9B (RunPod) によるAI要約・翻訳
- オフライン読書対応
- ブックマーク・既読管理
- カスタムフィード設定

---

## Tech Stack

| カテゴリ | 技術 |
|---------|------|
| パッケージマネージャー | pnpm |
| モノレポ管理 | Turborepo |
| モバイル | React Native + Expo |
| API | Cloudflare Workers + Hono |
| データベース | Turso + Drizzle ORM |
| 認証 | Better Auth |
| AI | RunPod + Qwen3.5 9B |
| スタイリング | Nativewind v4 |
| Lint/Format | Biome |
| 開発環境 | Nix |

---

## 実装フェーズ

<!--
  ⚠️ このファイルのIssue番号・タイトル・状態は GitHub Issue と一致している必要があります。
  乖離を防ぐため、更新時は scripts/sync-roadmap.sh を実行して検証してください。
-->

### Phase 0: プロジェクトセットアップ
**目標**: 開発環境とモノレポ構造の確立

| Issue | タイトル | 状態 | 依存 |
|-------|---------|------|------|
| #15 | .gitignore 作成 | ✅ | - |
| #16 | CLAUDE.md 開発ワークフロー定義の完成 | ✅ | - |
| #17 | pnpm workspace + Turborepo 初期化 | 🔲 | - |
| #49 | Nix 開発環境 (flake.nix) セットアップ | 🔲 | - |
| #36 | Biome 導入 (lint + formatter 統合) | 🔲 | #17 |
| #19 | Cloudflare Workers + Hono API プロジェクト初期化 | 🔲 | #17 |
| #18 | Expo (React Native + Expo Router) プロジェクト初期化 | 🔲 | #17 |
| #109 | TypeScript 共有型定義パッケージ (packages/types) | 🔲 | #17 |
| #23 | Jest + React Native Testing Library テスト基盤 | 🔲 | #17 |
| #112 | GitHub Actions CI パイプライン (lint, typecheck, test) | 🔲 | #17, #36 |
| #20 | Nativewind v4 セットアップ + ダークモダンテーマ定義 | 🔲 | #18 |
| #22 | Zustand + TanStack Query セットアップ | 🔲 | #18 |
| #24 | expo-secure-store + expo-image + expo-haptics 導入 | 🔲 | #18 |
| #25 | UIコンポーネント基盤 (Button, Input, Card, Badge, Skeleton) | 🔲 | #18, #20 |

---

### Phase 1: データベース + 認証
**目標**: データ永続化と認証基盤の構築

| Issue | タイトル | 状態 | 依存 |
|-------|---------|------|------|
| #27 | Drizzle ORM + Turso クライアント初期化 | 🔲 | #19 |
| #26 | Drizzle schema: users テーブル (Better Auth + プロフィール拡張) | 🔲 | #27 |
| #29 | Drizzle schema: articles テーブル | 🔲 | #27 |
| #28 | Drizzle schema: sessions / accounts / verifications テーブル (Better Auth) | 🔲 | #26 |
| #30 | Drizzle schema: summaries + translations テーブル | 🔲 | #29 |
| #31 | Drizzle schema: tags + article_tags テーブル | 🔲 | #29 |
| #32 | Drizzle schema: notifications テーブル | 🔲 | #26 |
| #33 | Drizzle schema: follows テーブル | 🔲 | #26 |
| #34 | Drizzle schema エクスポート + マイグレーション実行 | 🔲 | #26, #29 |
| #37 | Better Auth サーバー設定 (メール認証) | 🔲 | #26, #28 |
| #35 | Better Auth OAuth設定 (Google / Apple / GitHub) | 🔲 | #37 |
| #38 | Hono 認証ミドルウェア作成 | 🔲 | #37 |
| #41 | Auth gate (root layout) + Zustand authStore | 🔲 | #38 |
| #39 | 新規登録画面 UI | 🔲 | #41 |
| #40 | ログイン画面 UI | 🔲 | #41 |

---

### Phase 2: パーサー実装
**目標**: 各ニュースソースからの記事取得機能

| Issue | タイトル | 状態 | 依存 |
|-------|---------|------|------|
| #42 | sourceDetector.ts (URL→ソース自動判定) | 🔲 | #29 |
| #43 | 汎用パーサー (Readability + linkedom + turndown) | 🔲 | #42 |
| #44 | Zenn API パーサー | 🔲 | #43 |
| #45 | Zenn Books パーサー | 🔲 | #43 |
| #46 | Qiita API パーサー | 🔲 | #43 |
| #47 | note.com パーサー | 🔲 | #43 |
| #48 | はてなブログ パーサー | 🔲 | #43 |
| #50 | Speakerdeck パーサー | 🔲 | #43 |
| #51 | Dev.to API パーサー | 🔲 | #43 |
| #52 | Medium パーサー (HTML + Readability) | 🔲 | #43 |
| #53 | Hacker News パーサー | 🔲 | #43 |
| #54 | Hashnode GraphQL API パーサー | 🔲 | #43 |
| #55 | GitHub REST API パーサー | 🔲 | #43 |
| #56 | freeCodeCamp / LogRocket / CSS-Tricks / Smashing Magazine パーサー群 | 🔲 | #43 |
| #60 | Stack Overflow API パーサー | 🔲 | #43 |
| #61 | Reddit JSON API パーサー | 🔲 | #43 |
| #57 | パーサールーター (URL→適切なパーサー振り分け) | 🔲 | #42 |
| #148 | パーサー エラーハンドリング強化 | 🔲 | #43 |

---

### Phase 3: API エンドポイント
**目標**: RESTful API の実装

| Issue | タイトル | 状態 | 依存 |
|-------|---------|------|------|
| #123 | CORS 設定 (Workers API) | 🔲 | #19 |
| #124 | セキュリティヘッダー ミドルウェア (Workers API) | 🔲 | #19 |
| #58 | POST /api/articles エンドポイント (記事保存) | 🔲 | #29, #38 |
| #59 | GET /api/articles エンドポイント (記事一覧・ページネーション) | 🔲 | #29, #38 |
| #62 | GET/PATCH/DELETE /api/articles/:id エンドポイント | 🔲 | #58 |
| #63 | Qwen3.5 9B (RunPod) 要約サービス + POST /api/articles/:id/summary | 🔲 | #30, #62 |
| #64 | Qwen3.5 9B (RunPod) 翻訳サービス + POST /api/articles/:id/translate | 🔲 | #30, #62 |
| #65 | タグ CRUD API | 🔲 | #31, #62 |
| #66 | 全文検索 API (GET /api/articles/search) | 🔲 | #59 |
| #67 | プロフィール API (GET/PATCH /api/users) | 🔲 | #26, #38 |
| #68 | アバター画像アップロード API (Cloudflare R2) | 🔲 | #67, #133 |
| #69 | フォロー/アンフォロー API + フォロワー/フォロー中一覧 | 🔲 | #33, #38 |
| #70 | 公開記事一覧 API (GET /api/users/:id/articles) | 🔲 | #67, #59 |
| #71 | 通知 API | 🔲 | #32, #38 |
| #72 | 通知トリガーロジック (Workers) | 🔲 | #71 |
| #73 | サブスクリプション状態確認 API + RevenueCat Webhook | 🔲 | #26, #38 |
| #107 | AI使用回数制限ロジック (無料: 月5回リセット) | 🔲 | #26, #63 |
| #116 | API レート制限ミドルウェア | 🔲 | #38, #155 |
| #125 | API入力バリデーション (Zod スキーマ定義 全エンドポイント) | 🔲 | #38 |
| #146 | OpenAPI (Swagger) ドキュメント生成 | 🔲 | #58 |

---

### Phase 4: モバイル画面
**目標**: ユーザーインターフェースの実装

| Issue | タイトル | 状態 | 依存 |
|-------|---------|------|------|
| #138 | constants.ts (API URL、アプリ設定定数) | 🔲 | #18 |
| #137 | formatters.ts ユーティリティ | 🔲 | #18 |
| #113 | タブナビゲーター レイアウト (ホーム/検索/プロフィール/設定) | 🔲 | #18, #20 |
| #134 | 空状態 UI コンポーネント (EmptyState: 全画面対応) | 🔲 | #25 |
| #136 | トースト通知コンポーネント | 🔲 | #25 |
| #115 | ローディングスケルトン (全画面共通) | 🔲 | #25 |
| #76 | ArticleCard コンポーネント | 🔲 | #25 |
| #77 | SourceBadge コンポーネント (18サイト対応) | 🔲 | #76 |
| #75 | ホーム画面 (記事一覧 FlatList + フィルター) | 🔲 | #113, #76, #59 |
| #74 | 記事保存画面 (Save Screen: URL入力→プレビュー→保存) | 🔲 | #113, #58 |
| #78 | 記事詳細画面 + ArticleReader (Markdown レンダリング) | 🔲 | #76, #62 |
| #79 | 検索画面 (Search Screen) | 🔲 | #113, #66 |
| #80 | TagPicker コンポーネント | 🔲 | #65 |
| #81 | プロフィール画面 (自分) + ProfileHeader | 🔲 | #113, #67 |
| #82 | プロフィール編集画面 | 🔲 | #81, #68 |
| #83 | 他ユーザープロフィール画面 + FollowButton | 🔲 | #81, #69 |
| #84 | 設定画面 (アカウント、サブスク、言語、通知) | 🔲 | #113 |
| #85 | 通知一覧画面 + NotificationItem + バッジ | 🔲 | #113, #71 |
| #108 | お気に入りトグル API + モバイルUI | 🔲 | #76 |
| #152 | 確認ダイアログ コンポーネント (破壊的操作用) | 🔲 | #25 |
| #158 | 確認ダイアログ + 成功フィードバック 全画面適用 | 🔲 | #152 |

---

### Phase 5: 課金・サブスクリプション
**目標**: 収益化機能の実装

| Issue | タイトル | 状態 | 依存 |
|-------|---------|------|------|
| #89 | RevenueCat サブスクリプション統合 | 🔲 | #73 |
| #90 | AdMob バナー広告 (AdBanner コンポーネント) | 🔲 | #18 |
| #91 | PremiumGate コンポーネント (サブスク誘導UI) | 🔲 | #89 |
| #144 | サブスクリプション詳細フロー (キャンセル、猶予期間、無料トライアル) | 🔲 | #89 |
| #161 | Workers Cron Trigger: AI使用回数月次リセット + サブスク期限チェック | 🔲 | #107 |

---

### Phase 6: ソーシャル・通知
**目標**: プッシュ通知・コミュニティ機能

| Issue | タイトル | 状態 | 依存 |
|-------|---------|------|------|
| #86 | expo-notifications セットアップ + プッシュ通知受信 | 🔲 | #71 |
| #145 | 通知設定 (種類別ON/OFF) + Android通知チャンネル | 🔲 | #86, #85 |
| #114 | フォロワー/フォロー中一覧画面 | 🔲 | #83 |

---

### Phase 7: オフライン対応
**目標**: オフライン読書機能

| Issue | タイトル | 状態 | 依存 |
|-------|---------|------|------|
| #87 | expo-sqlite ローカルDB + オフラインキャッシュ | 🔲 | #78 |
| #88 | ネットワーク状態監視 (NetInfo) + オフラインバナー | 🔲 | #87 |
| #156 | iOS バックグラウンドリフレッシュ + Android WorkManager | 🔲 | #87 |

---

### Phase 8: テスト・品質保証
**目標**: テストカバレッジと品質向上

| Issue | タイトル | 状態 | 依存 |
|-------|---------|------|------|
| #143 | テストデータ seed スクリプト (開発用フィクスチャ) | 🔲 | #34 |
| #100 | API 単体テスト カバレッジ目標達成 | 🔲 | Phase 3 |
| #97 | API 機能テスト (全エンドポイント統合テスト) | 🔲 | Phase 3 |
| #99 | モバイル単体テスト カバレッジ目標達成 | 🔲 | Phase 4 |
| #98 | Maestro E2E テスト | 🔲 | Phase 4 |

---

### Phase 9: リリース準備
**目標**: ストア公開準備と仕上げ

| Issue | タイトル | 状態 | 依存 |
|-------|---------|------|------|
| #92 | グローバルエラーバウンダリ + 画面別エラーハンドリング | 🔲 | #18 |
| #93 | expo-share-intent (ブラウザからURL共有で記事保存) | 🔲 | #74 |
| #94 | アプリアイコン + スプラッシュスクリーン (ダークテーマ) | 🔲 | #18 |
| #95 | EAS Build 設定 (iOS / Android ビルドプロファイル) | 🔲 | #18 |
| #110 | README.md 作成 | 🔲 | - |
| #111 | Cloudflare Workers デプロイ設定 (本番/ステージング環境) | 🔲 | #19 |
| #119 | プライバシーポリシー・利用規約ページ作成 | 🔲 | - |
| #120 | アカウント削除機能 (GDPR/App Store 必須) | 🔲 | #26, #38 |
| #121 | i18n 基盤セットアップ (react-i18next + 翻訳ファイル) | 🔲 | #18 |
| #122 | 全画面の UIテキスト i18n 対応 | 🔲 | #121 |
| #129 | Sentry エラー監視導入 | 🔲 | #18, #19 |
| #130 | 構造化ログ (Workers API) | 🔲 | #19 |
| #131 | ディープリンク設定 | 🔲 | #18 |
| #132 | メール送信基盤 (Resend or Cloudflare Email Workers) | 🔲 | #19 |
| #133 | Cloudflare R2 バケット作成 + 環境設定 | 🔲 | #19 |
| #135 | オンボーディング画面 (初回起動時ウォークスルー) | 🔲 | #113 |
| #139 | アクセシビリティ (a11y) 対応 | 🔲 | Phase 4 |
| #140 | iOS App Store 提出準備 | 🔲 | Phase 4-8 |
| #141 | Google Play Store 提出準備 | 🔲 | Phase 4-8 |
| #142 | expo-updates (OTA アップデート) セットアップ | 🔲 | #95 |
| #147 | 環境変数テンプレート + シークレット管理ドキュメント | 🔲 | #19 |
| #149 | アナリティクス導入 (Firebase Analytics or Mixpanel) | 🔲 | #18 |
| #150 | Turso DB バックアップ戦略 + リストア手順 | 🔲 | #27 |
| #151 | カスタムドメイン設定 (API + 画像配信) | 🔲 | #111 |
| #153 | アプリバージョニング戦略 + 自動バージョンバンプ | 🔲 | #95 |
| #154 | App Tracking Transparency (ATT) 対応 (iOS 14.5+) | 🔲 | #18 |
| #155 | Workers KV セットアップ (レート制限・キャッシュ用) | 🔲 | #19 |
| #157 | パスワード変更機能 (設定画面) | 🔲 | #37, #84 |
| #160 | GitHub Actions: EAS Build 自動化 | 🔲 | #95, #112 |
| #162 | 本番リリース前チェックリスト + リリース手順書 | 🔲 | - |
| #163 | DBマイグレーション ロールバック戦略 | 🔲 | #34 |

---

## 実装順序ルール

### 依存関係の原則
1. **Phase は順番に進める** - Phase N の完了前に Phase N+1 を開始しない
2. **Issue 依存を厳守** - 依存 Issue が未完了の場合、その Issue に着手しない
3. **テストは並行可能** - Phase 8 のテストは各 Phase と並行して進められる
4. **リリース準備は先行可能** - Phase 9 の一部（ドキュメント等）は早期着手可能

### 開発開始チェックリスト
Issue に着手する前に必ず確認：
- [ ] 依存 Issue がすべて完了している
- [ ] 対象 Phase の前提 Phase が完了している
- [ ] Git Worktree を作成した
- [ ] TDD サイクルを理解している（環境設定Issueは対象外）

---

## 次のアクション

現在の推奨着手 Issue（Phase 0 から開始）:

1. **#17 pnpm workspace + Turborepo 初期化** - 全ての基盤（依存なし）
2. **#49 Nix 開発環境 (flake.nix) セットアップ** - 開発環境（依存なし）

これら2つは並行して作業可能。#17 完了後に #19, #18, #36 等へ進める。
