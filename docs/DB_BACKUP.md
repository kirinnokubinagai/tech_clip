# Turso DB バックアップ戦略

## 概要

TechClip は Turso (libSQL) をデータベースとして使用しています。本ドキュメントでは、バックアップ戦略・実行手順・リストア手順を定義します。

---

## バックアップ戦略

### バックアップ種別

| 種別 | 頻度 | 保持期間 | 用途 |
|------|------|----------|------|
| 定期バックアップ | 毎日 02:00 UTC | 30日間 | 障害時の復旧 |
| リリース前バックアップ | デプロイ前手動実行 | 90日間 | ロールバック用 |
| 週次フルバックアップ | 毎週日曜 00:00 UTC | 1年間 | 長期保管 |

### バックアップ先

- **ローカル**: `backups/` ディレクトリ（開発用）
- **本番**: Cloudflare R2 または AWS S3（環境変数 `BACKUP_STORAGE_URL` で指定）

---

## 必要なツール・環境変数

### Turso CLI のインストール

```bash
# macOS / Linux
curl -sSfL https://get.tur.so/install.sh | bash

# バージョン確認
turso --version
```

### 必要な環境変数

```bash
# .env または CI/CD シークレットに設定
TURSO_ORG_NAME=your-org-name          # Turso 組織名
TURSO_DB_NAME=techclip-prod           # データベース名
TURSO_AUTH_TOKEN=your-auth-token      # 認証トークン（turso auth token で取得）
BACKUP_DIR=./backups                  # バックアップ保存先ディレクトリ
BACKUP_STORAGE_URL=                   # (省略可) リモートストレージ URL
```

### 認証トークンの取得

```bash
# Turso にログイン
turso auth login

# トークン取得
turso auth token
```

---

## バックアップ手順

### 手動バックアップ

```bash
# バックアップスクリプトを実行
./scripts/db-backup.sh

# 特定のデータベースを指定してバックアップ
TURSO_DB_NAME=techclip-staging ./scripts/db-backup.sh
```

### バックアップ内容

`db-backup.sh` は以下を実行します。

1. Turso CLI で対象 DB に接続
2. `.dump` コマンドで SQL ダンプを取得
3. タイムスタンプ付きファイル名で保存（例: `techclip-prod_20240101_120000.sql`）
4. gzip 圧縮（`.sql.gz`）
5. （設定済みの場合）リモートストレージへアップロード

### バックアップファイルの確認

```bash
ls -lh backups/
# 出力例:
# techclip-prod_20240101_020000.sql.gz  1.2M
# techclip-prod_20231231_020000.sql.gz  1.1M
```

---

## リストア手順

### リストアスクリプトを使用する場合

```bash
# 最新バックアップからリストア
./scripts/db-restore.sh backups/techclip-prod_20240101_020000.sql.gz

# 解凍済み SQL ファイルからリストア
./scripts/db-restore.sh backups/techclip-prod_20240101_020000.sql
```

### 手動リストア手順

```bash
# 1. バックアップファイルを解凍
gunzip backups/techclip-prod_20240101_020000.sql.gz

# 2. Turso CLI でリストア
turso db shell $TURSO_DB_NAME < backups/techclip-prod_20240101_020000.sql

# 3. データ確認
turso db shell $TURSO_DB_NAME "SELECT count(*) FROM users;"
```

---

## 定期バックアップの設定

### Cron（サーバー運用の場合）

```bash
# crontab -e で以下を追加
# 毎日 02:00 UTC にバックアップ
0 2 * * * /path/to/tech_clip/scripts/db-backup.sh >> /var/log/db-backup.log 2>&1

# 毎週日曜 00:00 UTC にフルバックアップ
0 0 * * 0 BACKUP_RETENTION_DAYS=365 /path/to/tech_clip/scripts/db-backup.sh >> /var/log/db-backup-weekly.log 2>&1
```

### GitHub Actions（推奨）

```yaml
# .github/workflows/db-backup.yml
name: DB Backup

on:
  schedule:
    - cron: '0 2 * * *'   # 毎日 02:00 UTC
  workflow_dispatch:        # 手動実行も可能

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Turso CLI
        run: curl -sSfL https://get.tur.so/install.sh | bash

      - name: Run backup
        env:
          TURSO_ORG_NAME: ${{ secrets.TURSO_ORG_NAME }}
          TURSO_DB_NAME: ${{ secrets.TURSO_DB_NAME }}
          TURSO_AUTH_TOKEN: ${{ secrets.TURSO_AUTH_TOKEN }}
          BACKUP_STORAGE_URL: ${{ secrets.BACKUP_STORAGE_URL }}
        run: ./scripts/db-backup.sh
```

---

## 障害対応フロー

```
障害発生
  │
  ├─ 影響範囲の確認
  │    └─ turso db shell $TURSO_DB_NAME "SELECT 1;"
  │
  ├─ 最新バックアップの特定
  │    └─ ls -lt backups/ | head -5
  │
  ├─ リストア実行
  │    └─ ./scripts/db-restore.sh <backup-file>
  │
  └─ データ整合性の確認
       └─ 主要テーブルのレコード数を確認
```

---

## 重要な注意事項

- **本番リストア前に必ず現在の状態をバックアップすること**
- **リストアは本番データを上書きするため、必ず2名以上で確認してから実行**
- `TURSO_AUTH_TOKEN` は絶対にコードにハードコードしないこと（環境変数必須）
- バックアップファイルには機密データが含まれるため、アクセス権限を制限すること
- リストア後は必ずアプリケーションの動作確認を行うこと
