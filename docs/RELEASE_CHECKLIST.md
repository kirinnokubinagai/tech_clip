# TechClip 本番リリース前チェックリスト & リリース手順書

## 概要

本ドキュメントはTechClipアプリ（React Native + Expo / Cloudflare Workers）を本番環境にリリースする際の手順とチェックリストを定義する。

リリース担当者はすべての項目を順番に確認し、各チェックを完了させること。

---

## 目次

1. [コード品質チェック](#1-コード品質チェック)
2. [セキュリティ監査](#2-セキュリティ監査)
3. [パフォーマンスチェック](#3-パフォーマンスチェック)
4. [データベース・マイグレーション確認](#4-データベースマイグレーション確認)
5. [アプリストア要件確認](#5-アプリストア要件確認)
6. [デプロイ手順](#6-デプロイ手順)
7. [デプロイ後検証](#7-デプロイ後検証)
8. [ロールバック手順](#8-ロールバック手順)

---

## 1. コード品質チェック

### 1-1. テスト

```bash
# 全テスト実行
pnpm test

# カバレッジレポート生成
pnpm test --coverage
```

- [ ] すべてのテストがパスすること（0 failed）
- [ ] テストカバレッジが80%以上であること
- [ ] スキップされたテスト（`it.skip`）が0件であること

### 1-2. 静的解析・フォーマット

```bash
# Biomeによるリントとフォーマットチェック
pnpm biome check .

# 自動修正（修正後に差分を確認すること）
pnpm biome check --write .
```

- [ ] Biomeエラーが0件であること
- [ ] `any` 型の使用がないこと（`grep -r ": any" src/` で確認）
- [ ] `console.log` の残存がないこと（`grep -r "console.log" src/` で確認）

### 1-3. 型チェック

```bash
# TypeScript型チェック（APIパッケージ）
pnpm --filter @tech-clip/api tsc --noEmit

# TypeScript型チェック（モバイルパッケージ）
pnpm --filter @tech-clip/mobile tsc --noEmit
```

- [ ] TypeScript型エラーが0件であること

### 1-4. ビルド確認

```bash
# Cloudflare Workers ビルド
pnpm --filter @tech-clip/api build

# Expo ビルド確認（ローカル）
pnpm --filter @tech-clip/mobile expo export
```

- [ ] APIのビルドが成功すること
- [ ] モバイルアプリのエクスポートが成功すること

---

## 2. セキュリティ監査

### 2-1. 環境変数・シークレット

```bash
# .env ファイルがリポジトリにコミットされていないか確認
git log --all --full-history -- "*.env" "**/.env"

# ハードコードされたシークレットのチェック
grep -r "sk_live\|sk_test\|password.*=\|secret.*=" src/ --include="*.ts"
```

- [ ] `.env` ファイルがGit履歴に含まれていないこと
- [ ] APIキー・シークレットがソースコードにハードコードされていないこと
- [ ] Cloudflare Workers のシークレットが `wrangler secret` で設定済みであること
- [ ] 以下の環境変数がすべて本番環境に設定済みであること
  - `BETTER_AUTH_SECRET`
  - `TURSO_DATABASE_URL`
  - `TURSO_AUTH_TOKEN`
  - `RUNPOD_API_KEY`
  - `ALLOWED_ORIGINS`

### 2-2. 認証・認可

- [ ] Better Authのセッション有効期限が適切に設定されていること
- [ ] HTTPOnly Cookieでトークンが保存されていること（`localStorage` 使用なし）
- [ ] 全APIエンドポイントで認証チェックが実装されていること
- [ ] リソース所有者チェックが実装されていること（他ユーザーデータへのアクセス不可）

### 2-3. ネットワーク

- [ ] CORSの許可オリジンが本番URLのみに限定されていること（`*` 禁止）
- [ ] レート制限が実装されていること
- [ ] HTTPS通信のみが許可されていること

### 2-4. 依存パッケージの脆弱性

```bash
# npm audit実行
pnpm audit

# 重大な脆弱性の確認
pnpm audit --audit-level=high
```

- [ ] `high` 以上の重大な脆弱性が0件であること
- [ ] 脆弱性が検出された場合はパッチバージョンにアップデートして解消すること

---

## 3. パフォーマンスチェック

### 3-1. APIパフォーマンス

```bash
# Cloudflare Workers のサイズ確認
pnpm --filter @tech-clip/api build && ls -la dist/
```

- [ ] Workerバンドルサイズが1MB以下であること（Cloudflareの制限）
- [ ] 主要APIエンドポイントのレスポンスタイムが500ms以下であること
- [ ] N+1クエリが発生していないこと（クエリログで確認）

### 3-2. モバイルアプリパフォーマンス

- [ ] アプリの初回起動時間が3秒以内であること
- [ ] 記事一覧のスクロールがスムーズであること（60fps）
- [ ] 画像の遅延読み込みが実装されていること
- [ ] オフライン対応が正常に動作すること

### 3-3. データベース

- [ ] 主要クエリにインデックスが設定されていること
- [ ] 不要なデータのフルスキャンが発生していないこと（`EXPLAIN QUERY PLAN` で確認）

---

## 4. データベース・マイグレーション確認

### 4-1. マイグレーションファイルの確認

```bash
# マイグレーション一覧の確認
ls -la drizzle/

# マイグレーションの差分確認
pnpm drizzle-kit status
```

- [ ] すべてのマイグレーションファイルがGitにコミット済みであること
- [ ] `drizzle-kit push` が使用されていないこと（`drizzle-kit migrate` のみ使用）
- [ ] 手動でSQLファイルが編集されていないこと

### 4-2. マイグレーションの安全性確認

- [ ] **破壊的変更（カラム削除・テーブル削除）がある場合**: データのバックアップを事前に取得すること
- [ ] **カラム名変更がある場合**: データ移行スクリプトが用意されていること
- [ ] **NOT NULL制約追加がある場合**: 既存データへのデフォルト値設定が適切であること
- [ ] ステージング環境でマイグレーションが正常に完了していること

### 4-3. 本番マイグレーション実行（Turso）

```bash
# 本番DBにマイグレーション適用
TURSO_DATABASE_URL=<本番URL> TURSO_AUTH_TOKEN=<本番トークン> pnpm drizzle-kit migrate
```

- [ ] マイグレーションが正常に完了したこと（エラーなし）
- [ ] マイグレーション後にデータが正常に参照できること

---

## 5. アプリストア要件確認

### 5-1. 共通要件

- [ ] プライバシーポリシーが最新の状態であること（`docs/legal/` を確認）
- [ ] 利用規約が最新の状態であること
- [ ] プライバシーポリシーURLがアプリ内に正しく設定されていること

### 5-2. App Store (iOS) 要件

- [ ] アプリアイコンが全サイズで用意されていること
  - 1024x1024 px（App Store用）
  - 180x180 px（iPhone 6 Plus以降）
  - 120x120 px（iPhone）
  - 76x76 px（iPad）
- [ ] スクリーンショットが用意されていること（最低1枚、最大10枚）
  - iPhone 6.7インチ（必須）
  - iPhone 6.5インチ
  - iPad Pro 12.9インチ
- [ ] アプリ説明文が日本語で記載されていること
- [ ] キーワードが設定されていること
- [ ] 年齢制限が適切に設定されていること（4+）
- [ ] データ収集の申告（App Privacy）が完了していること
  - 収集データの種類
  - 使用目的
  - データのリンク有無
- [ ] In-App Purchase（課金機能）がある場合、Sandboxテストが完了していること

### 5-3. Google Play (Android) 要件

- [ ] アプリアイコンが用意されていること
  - 512x512 px（ハイレゾアイコン）
  - Feature graphic: 1024x500 px
- [ ] スクリーンショットが用意されていること（最低2枚）
  - スマートフォン（必須）
  - タブレット（推奨）
- [ ] アプリ説明文（短文・長文）が日本語で記載されていること
- [ ] コンテンツレーティングのアンケートが完了していること
- [ ] データセーフティセクションが完了していること
  - 収集するデータの種類
  - データの使用目的
  - データ共有の有無
- [ ] ターゲットAPIレベルがAndroidの要件を満たしていること（API 33以上）

---

## 6. デプロイ手順

### 6-1. 前提条件の確認

```bash
# wrangler CLIのログイン確認
wrangler whoami

# EASのログイン確認
eas whoami
```

- [ ] Cloudflareアカウントへのログインが完了していること
- [ ] EAS（Expo Application Services）へのログインが完了していること
- [ ] 本番用シークレットが設定済みであること

### 6-2. APIデプロイ（Cloudflare Workers）

```bash
# ステップ1: ビルド確認
pnpm --filter @tech-clip/api build

# ステップ2: ステージング環境へデプロイ（最終確認）
pnpm --filter @tech-clip/api wrangler deploy --env staging

# ステップ3: ステージングでの動作確認（後述の検証項目を実施）

# ステップ4: 本番環境へデプロイ
pnpm --filter @tech-clip/api wrangler deploy --env production
```

- [ ] ステージング環境へのデプロイが成功したこと
- [ ] ステージングでの動作確認が完了したこと
- [ ] 本番環境へのデプロイが成功したこと
- [ ] デプロイログにエラーがないこと

### 6-3. モバイルアプリビルド（EAS Build）

#### iOS ビルド

```bash
# iOS本番ビルド
eas build --platform ios --profile production

# App Storeへの提出
eas submit --platform ios --latest
```

- [ ] EAS Buildが正常に完了したこと
- [ ] App Store Connectへの提出が完了したこと
- [ ] App Reviewの審査が通過したこと

#### Android ビルド

```bash
# Android本番ビルド
eas build --platform android --profile production

# Google Playへの提出
eas submit --platform android --latest
```

- [ ] EAS Buildが正常に完了したこと
- [ ] Google Play Consoleへの提出が完了したこと
- [ ] Google Playの審査が通過したこと

### 6-4. OTA（Over-The-Air）アップデート

JSのみの変更でネイティブコードを含まない場合は EAS Update を使用できる。

```bash
# OTAアップデートの配信
eas update --channel production --message "リリースノート"
```

- [ ] ネイティブコードの変更がないことを確認してから使用すること
- [ ] アップデートメッセージに変更内容が記載されていること

---

## 7. デプロイ後検証

### 7-1. APIの動作確認

```bash
# ヘルスチェック
curl https://api.techclip.app/health

# 認証エンドポイントの確認
curl -X POST https://api.techclip.app/auth/sign-in \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword"}'
```

- [ ] ヘルスチェックエンドポイントが200を返すこと
- [ ] 認証フローが正常に動作すること
- [ ] 記事一覧APIが正常なレスポンスを返すこと
- [ ] AI要約機能が正常に動作すること（RunPod APIの疎通確認）
- [ ] エラーレスポンスが定義されたフォーマットで返ること

### 7-2. モバイルアプリの動作確認

実機（iOS/Android）での確認項目:

- [ ] アプリが正常に起動すること
- [ ] ユーザー登録・ログインが正常に動作すること
- [ ] 記事一覧が表示されること
- [ ] 記事詳細が表示されること
- [ ] AI要約が正常に動作すること
- [ ] オフライン時に保存済み記事が表示されること
- [ ] プッシュ通知が届くこと（設定している場合）
- [ ] アプリがクラッシュしないこと（30分の通常操作）

### 7-3. モニタリング確認

- [ ] Cloudflare Workersのメトリクスが正常範囲であること
  - エラーレート: 1%以下
  - 平均レスポンスタイム: 500ms以下
- [ ] 異常なエラーログが出力されていないこと

---

## 8. ロールバック手順

問題が発生した場合は以下の手順でロールバックを行う。

### 8-1. APIのロールバック（Cloudflare Workers）

```bash
# デプロイ履歴の確認
wrangler deployments list

# 前バージョンへのロールバック
wrangler rollback <deployment-id>
```

- [ ] ロールバック対象のデプロイIDを確認する
- [ ] `wrangler rollback` コマンドでロールバックを実行する
- [ ] ロールバック後にAPIの動作確認を実施する

### 8-2. データベースのロールバック

**注意: データベースのロールバックは慎重に行うこと。データ損失のリスクがある。**

```bash
# マイグレーション履歴の確認
pnpm drizzle-kit status

# ロールバックSQLの手動実行（drizzle-kitはdown migrationを未サポートのため手動対応）
# 事前にロールバック用SQLを用意しておくこと
```

- [ ] マイグレーションのロールバックが必要かどうかを判断する
- [ ] ロールバック前にデータのバックアップを取得する
- [ ] ロールバック用SQLを実行する
- [ ] データが正常に復元されたことを確認する

### 8-3. モバイルアプリのロールバック

#### OTAアップデートのロールバック

```bash
# 前のチャンネルに戻す
eas update --channel production --message "緊急ロールバック" --republish --group <previous-group-id>
```

#### ストアのロールバック

- iOS: App Store Connectでバージョンの段階的ロールアウトを停止する
- Android: Google Play Consoleでリリースを一時停止し、前バージョンを再公開する

---

## リリース実施記録テンプレート

リリースを実施した際は以下の情報を記録すること。

```
リリース日時: YYYY-MM-DD HH:MM JST
リリース担当者:
バージョン:
  - API: v0.0.0
  - iOS: 0.0.0 (build: 0)
  - Android: 0.0.0 (versionCode: 0)

変更内容:
  -

チェックリスト完了確認:
  - [ ] コード品質チェック 完了
  - [ ] セキュリティ監査 完了
  - [ ] パフォーマンスチェック 完了
  - [ ] DBマイグレーション 完了
  - [ ] アプリストア要件 完了
  - [ ] デプロイ 完了
  - [ ] デプロイ後検証 完了

特記事項:
```

---

## 関連ドキュメント

- [ROADMAP.md](./ROADMAP.md) — 実装フェーズとIssue一覧
- [SECRETS.md](./SECRETS.md) — シークレット管理ガイドライン
- [CLAUDE.md](../CLAUDE.md) — 開発ルールと規約
