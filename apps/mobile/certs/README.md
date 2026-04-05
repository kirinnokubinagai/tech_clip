# certs ディレクトリ

OTA アップデートのコード署名に使用する証明書ファイルを格納するディレクトリ。

## ファイル構成

| ファイル | Git管理 | 説明 |
|---------|--------|------|
| `certificate.pem` | コミット可 | 自己署名証明書（公開鍵）。`app.json` の `codeSigningCertificate` で参照 |
| `private-key.pem` | **コミット禁止** | RSA秘密鍵。`.gitignore` で除外済み |

## 証明書の生成手順

初回セットアップ時またはローカル開発時に以下のコマンドを実行する。

```bash
# プロジェクトルートから実行
cd apps/mobile

# 秘密鍵の生成（4096bit RSA）
openssl genrsa -out certs/private-key.pem 4096

# 自己署名証明書の生成（有効期限 10 年）
openssl req -new -x509 \
  -key certs/private-key.pem \
  -out certs/certificate.pem \
  -days 3650 \
  -subj "/CN=TechClip OTA Signing"
```

## 注意事項

- `private-key.pem` は絶対に Git にコミットしないこと
- 秘密鍵は CI/CD シークレット（GitHub Actions Secrets 等）または安全な鍵管理サービスで管理すること
- 証明書の有効期限は以下で確認できる:
  ```bash
  openssl x509 -in certs/certificate.pem -noout -dates
  ```

## 関連ドキュメント

- [docs/OTA_UPDATES.md](../../../docs/OTA_UPDATES.md) — OTA アップデート詳細手順
- [docs/RELEASE.md](../../../docs/RELEASE.md) — リリース手順書
