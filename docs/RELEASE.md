# EAS ビルド・リリース手順書

## 概要

TechClip モバイルアプリ（Expo SDK 55）の EAS Build を使用した本番ビルド・リリース手順。

---

## 目次

1. [ビルド前チェックリスト](#1-ビルド前チェックリスト)
2. [コード署名証明書セットアップ](#2-コード署名証明書セットアップ)
3. [ビルドコマンド](#3-ビルドコマンド)
4. [OTA アップデート検証手順](#4-ota-アップデート検証手順)
5. [ビルド後検証](#5-ビルド後検証)
6. [環境変数一覧](#6-環境変数一覧)

---

## 1. ビルド前チェックリスト

### EAS CLI・認証

```bash
# EAS CLI バージョン確認（12.0.0 以上が必要）
eas --version

# Expo アカウントへのログイン確認
eas whoami
```

- [ ] EAS CLI が `>= 12.0.0` であること
- [ ] `eas whoami` でアカウントが表示されること

### バージョン番号の確認

| ファイル | 設定項目 | 確認内容 |
|---------|--------|--------|
| `apps/mobile/app.json` | `expo.version` | 前回ビルドと比較して適切にインクリメントされているか |
| `apps/mobile/app.json` | `expo.ios.buildNumber` | iOS ビルド番号（App Store Connect の要件を満たすか） |
| `apps/mobile/app.json` | `expo.android.versionCode` | Android バージョンコード（前回より大きいか） |

### 必須環境変数の設定確認

```bash
# EAS シークレットの確認
eas secret:list
```

以下のシークレットが EAS プロジェクトに設定済みであること:

- [ ] `EXPO_PUBLIC_API_URL` — 本番 API の URL
- [ ] `APPLE_ID` — Apple ID（iOS 提出時）
- [ ] `ASC_APP_ID` — App Store Connect App ID（iOS 提出時）
- [ ] `APPLE_TEAM_ID` — Apple Developer Team ID（iOS 提出時）
- [ ] `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` — Google Play Service Account JSON（Android 提出時）

### コード品質確認

```bash
# ルートから実行
pnpm biome check apps/mobile/

# 型チェック
pnpm --filter @tech-clip/mobile typecheck
```

- [ ] Biome エラーが 0 件であること
- [ ] TypeScript 型エラーが 0 件であること

### OTA コード署名証明書の存在確認

```bash
ls -la apps/mobile/certs/certificate.pem
```

- [ ] `certificate.pem` が存在すること（生成手順は [セクション 2](#2-コード署名証明書セットアップ) を参照）

---

## 2. コード署名証明書セットアップ

OTA アップデートの改ざん防止のために RSA コード署名を使用する。

### 証明書の生成（初回のみ）

```bash
cd apps/mobile

# certs ディレクトリが存在しない場合は作成
mkdir -p certs

# RSA 秘密鍵の生成（4096bit）
openssl genrsa -out certs/private-key.pem 4096

# 自己署名証明書の生成（有効期限 10 年）
openssl req -new -x509 \
  -key certs/private-key.pem \
  -out certs/certificate.pem \
  -days 3650 \
  -subj "/CN=TechClip OTA Signing"

# 生成確認
openssl x509 -in certs/certificate.pem -noout -text | head -20
```

### 証明書の Git 管理ルール

| ファイル | 管理方法 |
|---------|--------|
| `certs/certificate.pem` | Git コミット可（公開鍵証明書） |
| `certs/private-key.pem` | **コミット禁止**（`.gitignore` で除外済み） |

### 秘密鍵の CI/CD への登録

GitHub Actions で EAS Build を実行する場合、秘密鍵を Secrets に登録する。

```bash
# 秘密鍵を base64 エンコード
base64 -i apps/mobile/certs/private-key.pem | tr -d '\n'
```

GitHub リポジトリの Settings > Secrets and variables > Actions に `OTA_SIGNING_PRIVATE_KEY` として登録する。

### 証明書の有効期限確認

```bash
openssl x509 -in apps/mobile/certs/certificate.pem -noout -dates
```

有効期限が切れる 30 日前までに証明書を更新すること。

---

## 3. ビルドコマンド

### プロファイル構成

| プロファイル | 配布方式 | チャネル | 用途 |
|------------|--------|--------|-----|
| `development` | internal | development | ローカル開発・デバッグ |
| `preview` | internal | preview | QA・内部テスト（TestFlight / 内部配布） |
| `production` | store | production | App Store / Google Play 本番リリース |

### iOS ビルド

```bash
# プロジェクトルートから実行

# development（シミュレーター向け）
pnpm --filter @tech-clip/mobile build:ios -- --profile development

# preview（TestFlight / 内部配布）
eas build --platform ios --profile preview

# production（App Store 提出用）
eas build --platform ios --profile production
```

### Android ビルド

```bash
# development（APK）
eas build --platform android --profile development

# preview（APK / 内部テスト）
eas build --platform android --profile preview

# production（AAB / Google Play 提出用）
eas build --platform android --profile production
```

### 両プラットフォーム同時ビルド

```bash
# 本番ビルド（iOS + Android）
eas build --platform all --profile production
```

### ビルド状況の確認

```bash
# ビルド一覧
eas build:list

# 特定ビルドの詳細
eas build:view <build-id>
```

### ストアへの提出

```bash
# iOS — App Store Connect へ提出
eas submit --platform ios --latest

# Android — Google Play Console へ提出
eas submit --platform android --latest
```

---

## 4. OTA アップデート検証手順

### OTA アップデート配信

JS / アセットのみの変更（ネイティブコード変更なし）の場合に使用する。

```bash
# production チャネルへ配信
eas update --channel production --message "バグ修正: <変更内容>"

# preview チャネルへ配信（QA確認用）
eas update --channel preview --message "feat: <変更内容>"
```

### 配信確認

```bash
# アップデート一覧
eas update:list

# production チャネルのアップデート一覧
eas update:list --channel production
```

### コード署名の検証

```bash
# EAS Update のコード署名設定確認
eas update:configure
```

### OTA 適用可否の判断基準

| 変更種別 | OTA 配信 | ストアビルド |
|---------|--------|-----------|
| JS ロジック変更 | 可 | 不要 |
| アセット（画像・フォント）変更 | 可 | 不要 |
| 新しいネイティブモジュール追加 | **不可** | 必須 |
| `app.json` の `version` 変更 | **不可** | 必須 |
| Expo SDK バージョンアップ | **不可** | 必須 |

### OTA アップデートのロールバック

```bash
# 前のアップデートグループ ID を確認
eas update:list --channel production

# 前のアップデートを再配信してロールバック
eas update --channel production --message "緊急ロールバック" \
  --republish --group <previous-group-id>
```

---

## 5. ビルド後検証

### iOS 実機検証

- [ ] TestFlight からインストールしてアプリが起動すること
- [ ] ユーザー登録・ログインが正常に動作すること
- [ ] 記事一覧が表示されること
- [ ] OTA アップデートが受信できること（`eas update:list` で最新を確認後、アプリを再起動）
- [ ] ディープリンク（`techclip://`）が正常に動作すること
- [ ] プッシュ通知が届くこと

### Android 実機検証

- [ ] Google Play 内部テストからインストールしてアプリが起動すること
- [ ] ユーザー登録・ログインが正常に動作すること
- [ ] 記事一覧が表示されること
- [ ] OTA アップデートが受信できること
- [ ] ディープリンク（`techclip://`）が正常に動作すること

### ビルド成果物の確認

```bash
# ビルド詳細（成果物のダウンロード URL 含む）
eas build:view <build-id>
```

---

## 6. 環境変数一覧

### EAS プロジェクトシークレット（`eas secret:*` で管理）

| 変数名 | 用途 | 必須 |
|-------|-----|-----|
| `EXPO_PUBLIC_API_URL` | 本番 API の URL | 全プロファイル |
| `APPLE_ID` | Apple ID | iOS 提出時 |
| `ASC_APP_ID` | App Store Connect App ID | iOS 提出時 |
| `APPLE_TEAM_ID` | Apple Developer Team ID | iOS 提出時 |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Google Play Service Account JSON パス | Android 提出時 |

### ローカル開発用（`.env` / `.env.local`）

```bash
# apps/mobile/.env.local
EXPO_PUBLIC_API_URL=http://localhost:8787
```

---

## 関連ドキュメント

- [OTA_UPDATES.md](./OTA_UPDATES.md) — OTA アップデート詳細
- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) — リリース前チェックリスト
- [VERSIONING.md](./VERSIONING.md) — バージョン管理方針
- [APP_STORE_IOS.md](./APP_STORE_IOS.md) — App Store 申請手順
- [PLAY_STORE_ANDROID.md](./PLAY_STORE_ANDROID.md) — Google Play 申請手順
- [Expo EAS Build 公式ドキュメント](https://docs.expo.dev/build/introduction/)
- [EAS Update 公式ドキュメント](https://docs.expo.dev/eas-update/introduction/)
