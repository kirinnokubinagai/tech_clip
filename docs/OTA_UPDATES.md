# OTA アップデート (expo-updates) セットアップガイド

## 概要

TechClip は [expo-updates](https://docs.expo.dev/versions/latest/sdk/updates/) を使用した OTA (Over-The-Air) アップデートに対応しています。
ネイティブコードを変更しない JavaScript / アセットの更新を、ストアレビューなしでユーザーに即時配信できます。

---

## app.json 設定

`apps/mobile/app.json` に以下の設定が追加されています。

```json
{
  "expo": {
    "updates": {
      "enabled": true,
      "fallbackToCacheTimeout": 0,
      "url": "https://u.expo.dev/tech-clip",
      "requestHeaders": {
        "expo-channel-name": "production"
      },
      "codeSigningCertificate": "./certs/certificate.pem",
      "codeSigningMetadata": {
        "keyid": "main",
        "alg": "rsa-v1_5-sha256"
      }
    },
    "runtimeVersion": {
      "policy": "appVersion"
    }
  }
}
```

### 設定項目の説明

| 設定項目 | 値 | 説明 |
|----------|-----|------|
| `updates.enabled` | `true` | OTA アップデートを有効化 |
| `updates.fallbackToCacheTimeout` | `0` | 起動時にアップデートチェックに失敗した場合、即座にキャッシュにフォールバック（UX優先） |
| `updates.url` | `https://u.expo.dev/tech-clip` | EAS Update のエンドポイント URL |
| `updates.requestHeaders.expo-channel-name` | `production` | デフォルトチャネル（ブランチ） |
| `updates.codeSigningCertificate` | `./certs/certificate.pem` | コード署名証明書のパス |
| `updates.codeSigningMetadata.keyid` | `main` | 署名鍵の識別子 |
| `updates.codeSigningMetadata.alg` | `rsa-v1_5-sha256` | 署名アルゴリズム |
| `runtimeVersion.policy` | `appVersion` | `package.json` の `version` をランタイムバージョンとして使用 |

---

## チャネル構成

| チャネル名 | 用途 | 対象環境 |
|-----------|------|---------|
| `production` | 本番ユーザー向け配信 | App Store / Google Play ビルド |
| `preview` | QA・内部テスト向け配信 | TestFlight / 内部配布ビルド |
| `development` | 開発者向け | ローカル開発 |

---

## eas.json との対応

`apps/mobile/eas.json` のビルドプロファイルとチャネルは以下のように対応します。

```json
{
  "build": {
    "production": {
      "channel": "production"
    },
    "preview": {
      "channel": "preview"
    }
  }
}
```

> eas.json への `channel` 設定の追記は EAS Build 実行前に行うこと。

---

## コード署名（Code Signing）

不正な OTA アップデートの配信を防ぐためにコード署名を使用します。

### 証明書の生成手順

```bash
# 証明書ディレクトリの作成
mkdir -p apps/mobile/certs

# 秘密鍵の生成
openssl genrsa -out apps/mobile/certs/private-key.pem 4096

# 自己署名証明書の生成（有効期限 10 年）
openssl req -new -x509 \
  -key apps/mobile/certs/private-key.pem \
  -out apps/mobile/certs/certificate.pem \
  -days 3650 \
  -subj "/CN=TechClip OTA Signing"
```

### 注意事項

- `private-key.pem` は絶対に Git にコミットしないこと（`.gitignore` に追加済み）
- `certificate.pem` はリポジトリにコミットして構わない（公開鍵証明書）
- 秘密鍵は CI/CD シークレットまたは安全な鍵管理サービスで管理すること

---

## OTA アップデートの配信手順

### 1. EAS Update の実行

```bash
# production チャネルへ配信
pnpm eas update --channel production --message "バグ修正: ログイン画面のレイアウト修正"

# preview チャネルへ配信（QA確認用）
pnpm eas update --channel preview --message "feat: 新機能 X の追加"
```

### 2. 配信確認

```bash
# アップデート一覧の確認
pnpm eas update:list

# 特定チャネルのアップデート確認
pnpm eas update:list --channel production
```

---

## ランタイムバージョンポリシー

`"policy": "appVersion"` を設定しているため、`package.json` の `version` フィールドがランタイムバージョンになります。

### バージョン互換性ルール

| 変更種別 | 対応 | 理由 |
|---------|------|------|
| JS / アセットのみの変更 | OTA 配信可能 | ネイティブコード変更なし |
| ネイティブモジュールの追加・更新 | ストアビルド必須 | ランタイムバージョンが変わる |
| `app.json` の `version` 変更 | ストアビルド必須 | 新しいランタイムバージョンが必要 |

### バージョン更新のタイミング

```bash
# ネイティブコードを変更した場合は version を上げてビルドし直す
# apps/mobile/package.json
{
  "version": "1.1.0"  # ← インクリメント
}

# その後 EAS Build を実行
pnpm eas build --platform all --profile production
```

---

## アップデート戦略

### デフォルト動作（fallbackToCacheTimeout: 0）

```
アプリ起動
  └─ バックグラウンドでアップデート確認
       ├─ 最新アップデートあり → 次回起動時に適用
       └─ ネットワーク不可 / タイムアウト → キャッシュで即起動（UX優先）
```

### カスタムアップデートチェック（必要な場合）

アプリ内で `expo-updates` を使って手動チェックする場合:

```typescript
import * as Updates from "expo-updates";

/**
 * アップデートを確認して適用する
 * 重要なバグ修正など即時適用が必要な場合に使用
 */
async function checkAndApplyUpdate(): Promise<void> {
  if (!Updates.isEnabled) {
    return;
  }

  const update = await Updates.checkForUpdateAsync();
  if (!update.isAvailable) {
    return;
  }

  await Updates.fetchUpdateAsync();
  await Updates.reloadAsync();
}
```

---

## 初回セットアップ手順

EAS Update を初めて使用する際の手順です。

```bash
# 1. EAS CLI のインストール（未導入の場合）
pnpm add -g eas-cli

# 2. Expo アカウントにログイン
eas login

# 3. プロジェクトの初期化（初回のみ）
cd apps/mobile
eas update:configure

# 4. コード署名証明書の生成（上記「証明書の生成手順」を参照）

# 5. 初回アップデートの配信
eas update --channel production --message "初回 OTA アップデート配信"
```

---

## トラブルシューティング

### アップデートが適用されない

1. `updates.url` の EAS プロジェクト ID が正しいか確認する
2. `runtimeVersion` がビルドと一致しているか確認する
3. `expo-channel-name` ヘッダーが正しいチャネルを指しているか確認する

### コード署名エラー

1. `certs/certificate.pem` が存在するか確認する
2. 証明書の有効期限を確認する（`openssl x509 -in certs/certificate.pem -noout -dates`）
3. EAS に登録されているコード署名設定と一致しているか確認する

---

## 関連ドキュメント

- [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) - リリース前チェックリスト
- [VERSIONING.md](./VERSIONING.md) - バージョン管理方針
- [Expo Updates 公式ドキュメント](https://docs.expo.dev/versions/latest/sdk/updates/)
- [EAS Update 公式ドキュメント](https://docs.expo.dev/eas-update/introduction/)
