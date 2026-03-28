# カスタムドメイン設定ガイド

TechClip の本番環境で使用するカスタムドメインの設定手順。

## ドメイン構成

| サービス | ドメイン | 用途 |
|---------|---------|------|
| API (Cloudflare Workers) | `api.techclip.app` | REST API エンドポイント |
| 画像 CDN (R2) | `images.techclip.app` | アバター・メディア配信 |

---

## 前提条件

- Cloudflare アカウントで `techclip.app` ドメインを管理していること
- Cloudflare Workers の本番デプロイが完了していること (`tech-clip-api-production`)
- R2 バケット `tech-clip-avatars` が作成済みであること

---

## 1. API カスタムドメイン設定 (`api.techclip.app`)

### 1-1. wrangler.toml にルートを追加

`apps/api/wrangler.toml` の `[env.production]` セクションに以下を追加済み:

```toml
[env.production.routes]
routes = [
  { pattern = "api.techclip.app/*", custom_domain = true }
]
```

### 1-2. Cloudflare ダッシュボードでの設定

1. [Cloudflare ダッシュボード](https://dash.cloudflare.com) にログイン
2. 対象アカウント > **Workers & Pages** を選択
3. `tech-clip-api-production` Worker を選択
4. **Settings** > **Triggers** タブを開く
5. **Custom Domains** セクションで **Add Custom Domain** をクリック
6. `api.techclip.app` を入力して **Add Custom Domain** を実行

Cloudflare が自動的に:
- DNS レコード (CNAME) を作成
- SSL/TLS 証明書を発行・管理

### 1-3. CLI でのデプロイ

```bash
# 本番環境へのデプロイ（ルート設定を含む）
cd apps/api
pnpm wrangler deploy --env production
```

---

## 2. 画像 CDN カスタムドメイン設定 (`images.techclip.app`)

### 2-1. R2 バケットのパブリックアクセス有効化

```bash
# R2 バケットにカスタムドメインを設定
pnpm wrangler r2 bucket domain add tech-clip-avatars --domain images.techclip.app
```

または Cloudflare ダッシュボードから:

1. **R2** > `tech-clip-avatars` バケットを選択
2. **Settings** タブ > **Custom Domains** セクション
3. **Connect Domain** をクリック
4. `images.techclip.app` を入力して接続

### 2-2. DNS レコード確認

カスタムドメイン設定後、Cloudflare が自動で以下を作成する:

| タイプ | 名前 | 内容 |
|-------|------|------|
| CNAME | `images` | `<bucket>.r2.cloudflarestorage.com` |

SSL 証明書は Cloudflare が自動で管理する。

---

## 3. DNS 設定（手動追加が必要な場合）

Cloudflare で `techclip.app` を管理している場合、通常は自動設定される。
手動で設定する場合は以下を Cloudflare DNS に追加:

```
# API エンドポイント
CNAME  api      <worker-name>.workers.dev   (Proxied)

# 画像 CDN
CNAME  images   <bucket>.r2.cloudflarestorage.com   (Proxied)
```

> **注意**: Proxy 設定（オレンジ色の雲マーク）を有効にすること。
> これにより Cloudflare の DDoS 保護・CDN キャッシュが適用される。

---

## 4. SSL/TLS 証明書

Cloudflare Workers および R2 カスタムドメインは **Universal SSL** により自動で証明書が発行される。

- 証明書の発行: カスタムドメイン設定後、数分以内に完了
- 自動更新: Cloudflare が自動で管理（手動更新不要）
- SSL モード: **Full (strict)** を推奨

Cloudflare ダッシュボード > **SSL/TLS** > **Overview** で確認可能。

---

## 5. 動作確認

設定完了後、以下のコマンドで疎通確認を行う:

```bash
# API エンドポイント確認
curl -I https://api.techclip.app/health

# 画像 CDN 確認（存在するオブジェクトのキーを指定）
curl -I https://images.techclip.app/<object-key>
```

期待されるレスポンス:
- API: `HTTP/2 200`（または適切なステータスコード）
- 画像: `HTTP/2 200` と `content-type: image/*`

---

## 6. トラブルシューティング

### カスタムドメインが解決されない

- DNS の伝播に最大 48 時間かかる場合がある
- `dig api.techclip.app` で CNAME レコードを確認

### SSL エラーが発生する

- Cloudflare SSL/TLS モードが **Full** または **Full (strict)** になっているか確認
- 証明書の発行状況を **SSL/TLS** > **Edge Certificates** で確認

### 403 Forbidden (R2)

- R2 バケットのパブリックアクセス設定を確認
- カスタムドメイン接続が完了しているか確認

### Worker が応答しない

- `pnpm wrangler deploy --env production` で再デプロイ
- Workers & Pages ダッシュボードでデプロイ状況を確認
