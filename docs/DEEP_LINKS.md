# ディープリンク設定

TechClipアプリのディープリンク（Universal Links / App Links）設定に関するドキュメント。

---

## 概要

TechClipは2種類のディープリンクをサポートする。

| 種別 | プラットフォーム | スキーム | 例 |
|------|----------------|---------|-----|
| カスタムスキーム | iOS / Android | `techclip://` | `techclip://articles/123` |
| Universal Links | iOS | `https://` | `https://techclip.app/articles/123` |
| App Links | Android | `https://` | `https://techclip.app/articles/123` |

---

## app.json 設定

### カスタムスキーム

```json
{
  "expo": {
    "scheme": "techclip"
  }
}
```

### iOS Universal Links

```json
{
  "expo": {
    "ios": {
      "associatedDomains": [
        "applinks:techclip.app",
        "applinks:www.techclip.app"
      ]
    }
  }
}
```

### Android App Links

```json
{
  "expo": {
    "android": {
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "techclip.app",
              "pathPrefix": "/"
            },
            {
              "scheme": "https",
              "host": "www.techclip.app",
              "pathPrefix": "/"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

---

## サーバー側の設定

Universal Links / App Links が機能するには、ドメインにWell-Knownファイルの配置が必要。

### iOS: Apple App Site Association (AASA)

`https://techclip.app/.well-known/apple-app-site-association` に以下を配置する。

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "<TEAM_ID>.com.techclip.app",
        "paths": ["*"]
      }
    ]
  }
}
```

- `<TEAM_ID>` は Apple Developer Portal の Team ID に置き換える
- Content-Type: `application/json`
- リダイレクトなしで配信すること

### Android: Digital Asset Links

`https://techclip.app/.well-known/assetlinks.json` に以下を配置する。

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.techclip.app",
      "sha256_cert_fingerprints": [
        "<SHA256_FINGERPRINT>"
      ]
    }
  }
]
```

SHA256フィンガープリントの取得方法:

```bash
# Google Play App Signing を使用している場合
# Google Play Console > 設定 > アプリ署名 > デジタル資産リンク JSON から取得

# ローカルキーストアから取得する場合
keytool -list -v -keystore release.keystore -alias techclip
```

---

## URLスキーム一覧

| パス | 説明 | 例 |
|------|------|-----|
| `/` | ホーム画面 | `techclip://` |
| `/articles/:id` | 記事詳細 | `techclip://articles/01HX...` |
| `/articles?url=<encoded_url>` | URL共有から記事追加 | `techclip://articles?url=https%3A%2F%2F...` |
| `/settings` | 設定画面 | `techclip://settings` |
| `/auth/callback` | 認証コールバック | `techclip://auth/callback` |

---

## 実装メモ

### Expo Router でのディープリンク処理

Expo Router はファイルベースルーティングでディープリンクを自動処理する。`app/` ディレクトリの構造がそのままURLパスに対応する。

```
app/
├── index.tsx          → techclip://  または https://techclip.app/
├── articles/
│   ├── index.tsx      → techclip://articles
│   └── [id].tsx       → techclip://articles/:id
└── settings/
    └── index.tsx      → techclip://settings
```

### 認証コールバック

Better Auth のOAuth認証では `techclip://auth/callback` にリダイレクトされる。
APIサーバー側の `BETTER_AUTH_URL` および OAuth プロバイダーの Redirect URI にも登録が必要。

---

## 動作確認

### iOS シミュレーター

```bash
# カスタムスキーム
xcrun simctl openurl booted "techclip://articles/123"

# Universal Links (開発時はカスタムスキームにフォールバック)
xcrun simctl openurl booted "https://techclip.app/articles/123"
```

### Android エミュレーター

```bash
# カスタムスキーム
adb shell am start -W -a android.intent.action.VIEW -d "techclip://articles/123" com.techclip.app

# App Links
adb shell am start -W -a android.intent.action.VIEW -d "https://techclip.app/articles/123" com.techclip.app
```

---

## チェックリスト

### リリース前

- [ ] Apple Developer Portal で Associated Domains を有効化
- [ ] `apple-app-site-association` をドメインに配置
- [ ] `assetlinks.json` をドメインに配置
- [ ] Google Play Console で App Signing のSHA256フィンガープリントを取得
- [ ] iOS / Android 実機でディープリンク動作確認
- [ ] 認証コールバックURLをOAuthプロバイダーに登録
