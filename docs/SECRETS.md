# シークレット管理ガイド

各シークレットの取得手順と設定方法をまとめます。

## 概要

| シークレット | 利用箇所 | ファイル |
|---|---|---|
| `TURSO_DATABASE_URL` | API (Cloudflare Workers) | `apps/api/.dev.vars` |
| `TURSO_AUTH_TOKEN` | API (Cloudflare Workers) | `apps/api/.dev.vars` |
| `BETTER_AUTH_SECRET` | API (Cloudflare Workers) | `apps/api/.dev.vars` |
| `GOOGLE_CLIENT_ID` | API (Cloudflare Workers) | `apps/api/.dev.vars` |
| `GOOGLE_CLIENT_SECRET` | API (Cloudflare Workers) | `apps/api/.dev.vars` |
| `APPLE_CLIENT_ID` | API (Cloudflare Workers) | `apps/api/.dev.vars` |
| `APPLE_CLIENT_SECRET` | API (Cloudflare Workers) | `apps/api/.dev.vars` |
| `GITHUB_CLIENT_ID` | API (Cloudflare Workers) | `apps/api/.dev.vars` |
| `GITHUB_CLIENT_SECRET` | API (Cloudflare Workers) | `apps/api/.dev.vars` |
| `REVENUECAT_WEBHOOK_SECRET` | API (Cloudflare Workers) | `apps/api/.dev.vars` |
| `RESEND_API_KEY` | API (Cloudflare Workers) | `apps/api/.dev.vars` |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | モバイル (Expo) | `apps/mobile/.env` |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | モバイル (Expo) | `apps/mobile/.env` |

---

## セットアップ手順

`nix develop` で開発シェルに入った後、以下のコマンドを実行してください。

```bash
setup-secrets
```

このコマンドは `apps/api/.dev.vars` と `apps/mobile/.env` が存在しない場合にのみ
各 example ファイルからコピーします。既存ファイルは上書きしません。

作成後は各ファイルを開き、実際の値を設定してください。

### 手動でセットアップする場合

```bash
cp apps/api/.dev.vars.example apps/api/.dev.vars
cp apps/mobile/.env.example apps/mobile/.env
```

`apps/api/.dev.vars` と `apps/mobile/.env` を開き、以下の各シークレットを設定してください。

---

## 各シークレットの取得手順

### TURSO_DATABASE_URL / TURSO_AUTH_TOKEN

**ダッシュボード:** https://app.turso.tech

1. アカウント作成またはログイン
2. "Create Database" からデータベースを作成する
3. データベース詳細ページの "Connect" タブを開く
4. `libsql://` で始まる URL を `TURSO_DATABASE_URL` に設定する
5. "Generate Token" をクリックし、発行されたトークンを `TURSO_AUTH_TOKEN` に設定する

**ローカル開発 (sqld を使う場合):**

```bash
# sqld を起動
sqld --grpc-listen-addr 127.0.0.1:5001

# .dev.vars に設定
TURSO_DATABASE_URL=http://127.0.0.1:8080
TURSO_AUTH_TOKEN=  # ローカルでは空でも可
```

---

### BETTER_AUTH_SECRET

セッション署名・暗号化に使用するランダム文字列です。32 文字以上を推奨します。

```bash
# ランダム文字列の生成例
openssl rand -base64 32
```

生成した文字列を `BETTER_AUTH_SECRET` に設定してください。

---

### GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET

**ダッシュボード:** https://console.cloud.google.com

1. プロジェクトを選択または作成する
2. "APIs & Services" > "Credentials" を開く
3. "Create Credentials" > "OAuth 2.0 Client IDs" を選択する
4. アプリケーションの種類: "Web application"
5. 承認済みリダイレクト URI に以下を追加する:
   - 開発: `http://localhost:18787/api/auth/callback/google`
   - 本番: `https://your-api-domain.workers.dev/api/auth/callback/google`
6. 作成後に表示されるクライアント ID とシークレットを設定する

---

### APPLE_CLIENT_ID / APPLE_CLIENT_SECRET

**ダッシュボード:** https://developer.apple.com

#### APPLE_CLIENT_ID (サービス ID)

1. "Certificates, Identifiers & Profiles" > "Identifiers" を開く
2. "+" ボタンから "Services IDs" を選択する
3. Description と Identifier (例: `com.techclip.service`) を入力する
4. "Sign In with Apple" を有効化し、ドメインとリダイレクト URL を設定する:
   - ドメイン: `your-api-domain.workers.dev`
   - リターン URL: `https://your-api-domain.workers.dev/api/auth/callback/apple`
5. Identifier を `APPLE_CLIENT_ID` に設定する

#### APPLE_CLIENT_SECRET (JWT トークン)

Apple のクライアントシークレットは静的な文字列ではなく、秘密鍵から生成する JWT です。

1. "Keys" > "+" から新しいキーを作成し "Sign In with Apple" を有効化する
2. 作成後に `.p8` 秘密鍵ファイルをダウンロードする (再ダウンロード不可)
3. Key ID と Team ID をメモする
4. 以下のスクリプトで JWT を生成する:

```bash
# 必要な情報
KEY_ID="YOUR_KEY_ID"        # Apple Developer の Key ID
TEAM_ID="YOUR_TEAM_ID"      # Apple Developer の Team ID
CLIENT_ID="com.techclip.service"  # 上記で作成した Services ID
KEY_FILE="AuthKey_XXXXXX.p8"      # ダウンロードした秘密鍵ファイル

# JWT 生成 (Node.js)
node -e "
const fs = require('fs');
const crypto = require('crypto');

const privateKey = fs.readFileSync('$KEY_FILE', 'utf8');
const now = Math.floor(Date.now() / 1000);
const exp = now + 15777000; // 約6ヶ月

const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: '$KEY_ID' })).toString('base64url');
const payload = Buffer.from(JSON.stringify({
  iss: '$TEAM_ID',
  iat: now,
  exp: exp,
  aud: 'https://appleid.apple.com',
  sub: '$CLIENT_ID'
})).toString('base64url');

const sign = crypto.createSign('SHA256');
sign.update(header + '.' + payload);
const signature = sign.sign(privateKey, 'base64url');
console.log(header + '.' + payload + '.' + signature);
"
```

生成された JWT を `APPLE_CLIENT_SECRET` に設定してください。有効期限は最大 6 ヶ月です。

---

### GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET

**ダッシュボード:** https://github.com/settings/developers

1. "OAuth Apps" > "New OAuth App" をクリックする
2. 以下を入力する:
   - Application name: `TechClip (dev)` など
   - Homepage URL: `http://localhost:18787`
   - Authorization callback URL: `http://localhost:18787/api/auth/callback/github`
3. "Register application" をクリックする
4. Client ID を `GITHUB_CLIENT_ID` に設定する
5. "Generate a new client secret" から生成したシークレットを `GITHUB_CLIENT_SECRET` に設定する

---

### REVENUECAT_WEBHOOK_SECRET

**ダッシュボード:** https://app.revenuecat.com

1. プロジェクトを選択する
2. 左メニューの "Integrations" > "Webhooks" を開く
3. "Add Webhook" から新しい Webhook を追加する
4. Webhook URL に `https://api.techclip.app/api/subscription/webhooks/revenuecat` を設定する
5. "Shared Secret" フィールドに表示されるシークレットを `REVENUECAT_WEBHOOK_SECRET` に設定する

> **注意:** Webhook Secret はペイロードの署名検証に使用します。ステージングと本番で別々の Webhook を作成し、それぞれ異なるシークレットを使用してください。

---

### RESEND_API_KEY

**ダッシュボード:** https://resend.com

1. アカウント作成またはログインする
2. 左メニューの "API Keys" を開く
3. "Create API Key" をクリックし、名前（例: `tech-clip-production`）を入力する
4. 権限は "Full Access" または "Sending Access" を選択する
5. 発行された API キーを `RESEND_API_KEY` に設定する

**ドメイン認証（本番環境で必須）:**

1. 左メニューの "Domains" を開く
2. "Add Domain" から `techclip.app` を追加する
3. 表示された DNS レコード（MX, SPF, DKIM）をドメインプロバイダーに設定する
4. 認証完了後、このドメインからメール送信が可能になる

---

### EXPO_PUBLIC_REVENUECAT_IOS_API_KEY / EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY

**ダッシュボード:** https://app.revenuecat.com

1. プロジェクトを作成またはログインする
2. 左メニューの "Projects" からプロジェクトを選択する
3. "API Keys" を開く
4. "Public app-specific API key" から iOS 用と Android 用のキーをそれぞれ取得する
5. iOS キーを `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` に設定する
6. Android キーを `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` に設定する

> **注意:** `EXPO_PUBLIC_` プレフィックスの変数はアプリバンドルに含まれ、ユーザーが参照可能です。RevenueCat の Public キーは公開を前提とした設計のため問題ありませんが、他の機密情報にこのプレフィックスを使わないでください。

---

## 本番環境への設定

ローカル開発では `.dev.vars` を使用しますが、本番環境では Cloudflare Workers の Secrets 機能を使います。

### ステージング環境

```bash
wrangler secret put TURSO_DATABASE_URL --env staging
wrangler secret put TURSO_AUTH_TOKEN --env staging
wrangler secret put BETTER_AUTH_SECRET --env staging
wrangler secret put GOOGLE_CLIENT_ID --env staging
wrangler secret put GOOGLE_CLIENT_SECRET --env staging
wrangler secret put APPLE_CLIENT_ID --env staging
wrangler secret put APPLE_CLIENT_SECRET --env staging
wrangler secret put GITHUB_CLIENT_ID --env staging
wrangler secret put GITHUB_CLIENT_SECRET --env staging
wrangler secret put REVENUECAT_WEBHOOK_SECRET --env staging
wrangler secret put RESEND_API_KEY --env staging
```

### 本番環境

```bash
wrangler secret put TURSO_DATABASE_URL --env production
wrangler secret put TURSO_AUTH_TOKEN --env production
wrangler secret put BETTER_AUTH_SECRET --env production
wrangler secret put GOOGLE_CLIENT_ID --env production
wrangler secret put GOOGLE_CLIENT_SECRET --env production
wrangler secret put APPLE_CLIENT_ID --env production
wrangler secret put APPLE_CLIENT_SECRET --env production
wrangler secret put GITHUB_CLIENT_ID --env production
wrangler secret put GITHUB_CLIENT_SECRET --env production
wrangler secret put REVENUECAT_WEBHOOK_SECRET --env production
wrangler secret put RESEND_API_KEY --env production
```

各コマンド実行後にプロンプトが表示されるので、値を入力してください。

### 設定確認

設定済みの secrets 一覧を確認するには:

```bash
# ステージング環境の確認
wrangler secret list --env staging

# 本番環境の確認
wrangler secret list --env production
```

### 本番環境セットアップチェックリスト

リリース前に以下を確認してください。

#### Turso DB
- [ ] 本番用 Turso データベースを作成済み（ステージングと別インスタンス）
- [ ] `TURSO_DATABASE_URL` を本番用 URL に設定済み
- [ ] `TURSO_AUTH_TOKEN` を本番用トークンに設定済み
- [ ] 本番 DB へのマイグレーション適用済み (`pnpm drizzle-kit migrate`)

#### Better Auth
- [ ] `BETTER_AUTH_SECRET` に32文字以上のランダム文字列を設定済み
- [ ] ステージングと本番で異なる値を使用している

#### OAuth プロバイダー
- [ ] Google: 本番用リダイレクト URI を Google Cloud Console に登録済み
- [ ] Apple: 本番ドメイン (`api.techclip.app`) を Apple Developer に登録済み
- [ ] Apple: `APPLE_CLIENT_SECRET` (JWT) の有効期限を確認済み（最大6ヶ月）
- [ ] GitHub: 本番用コールバック URL を GitHub OAuth App に登録済み

#### RevenueCat
- [ ] `REVENUECAT_WEBHOOK_SECRET` を RevenueCat ダッシュボードで発行済み
- [ ] Webhook URL に `https://api.techclip.app/api/subscription/webhooks/revenuecat` を設定済み

#### Resend
- [ ] 本番用 Resend API キーを発行済み
- [ ] 送信元ドメイン (`techclip.app`) を Resend で認証済み
- [ ] `RESEND_API_KEY` を本番用キーに設定済み

#### 最終確認
- [ ] `wrangler secret list --env production` で全 secrets が揃っていることを確認済み
- [ ] 本番デプロイ後に認証フローが正常に動作することを確認済み

---

## セキュリティ上の注意

- `.dev.vars` と `.env` は `.gitignore` で除外済みです。コミットしないでください。
- シークレットをチャット・メール・Issue に貼り付けないでください。
- シークレットが漏洩した場合は直ちにローテーション（再発行）してください。
- Apple Client Secret は最大 6 ヶ月で失効します。期限前に再生成してください。
