# DB マイグレーション ロールバック戦略

## 概要

本ドキュメントは、Drizzle Kit を使用したデータベースマイグレーションの失敗時に、安全かつ迅速にロールバックするための手順を定義します。

---

## 基本方針

| 原則 | 内容 |
|------|------|
| バックアップ優先 | マイグレーション前に必ずバックアップを取得する |
| ステージング検証 | 本番適用前にステージング環境で検証する |
| 最小変更単位 | 1マイグレーション = 1論理変更（大きな変更は分割する） |
| 前進優先 | 可能な場合はロールバックより前進修正（fix-forward）を優先する |

---

## Drizzle マイグレーションの仕組み

Drizzle Kit は `drizzle/` ディレクトリにマイグレーションファイルを生成し、`__drizzle_migrations` テーブルで適用済みマイグレーションを追跡します。

```
drizzle/
├── meta/
│   ├── _journal.json        # マイグレーション適用履歴
│   └── 0000_snapshot.json   # スキーマスナップショット
├── 0000_initial_schema.sql
├── 0001_add_users_table.sql
└── 0002_add_posts_table.sql
```

**重要**: Drizzle Kit には組み込みのロールバックコマンドがありません。ロールバックは手動 SQL または前進修正で対応します。

---

## マイグレーション前チェックリスト

マイグレーションを実行する前に、以下をすべて完了してください。

### 必須作業

- [ ] **データベースバックアップを取得する**（後述の手順参照）
- [ ] ステージング環境でマイグレーションを検証済みである
- [ ] ロールバック SQL を事前に生成・確認済みである（`scripts/generate-rollback.sh` を使用）
- [ ] マイグレーション実行中のサービスダウンタイムを関係者に通知済みである
- [ ] DB に接続しているアプリケーションの状態を確認した（接続数、実行中クエリ）

### バックアップ手順（Turso / libSQL）

```bash
# ローカル開発（SQLite）
cp local.db local.db.backup-$(date +%Y%m%d-%H%M%S)

# Turso 本番環境
# Turso は自動バックアップを提供しているが、手動スナップショットも推奨
turso db shell <DB_NAME> ".dump" > backup-$(date +%Y%m%d-%H%M%S).sql
```

---

## ロールバック手順

### ステップ 1: 障害の確認

```bash
# エラーログを確認
pnpm drizzle-kit migrate 2>&1 | tee migration.log

# 適用済みマイグレーションを確認
turso db shell <DB_NAME> "SELECT * FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 10;"
```

### ステップ 2: ロールバック SQL の実行

`scripts/generate-rollback.sh` で生成したロールバック SQL を適用します。

```bash
# ロールバック SQL の生成（事前に実施しておくことが推奨）
./scripts/generate-rollback.sh drizzle/0002_add_posts_table.sql

# 生成されたロールバック SQL を確認
cat drizzle/rollback/0002_add_posts_table.rollback.sql

# ロールバック SQL を適用（ローカル SQLite）
sqlite3 local.db < drizzle/rollback/0002_add_posts_table.rollback.sql

# ロールバック SQL を適用（Turso 本番環境）
turso db shell <DB_NAME> < drizzle/rollback/0002_add_posts_table.rollback.sql
```

### ステップ 3: マイグレーション追跡テーブルの修正

ロールバック SQL 適用後、Drizzle のマイグレーション追跡テーブルからエントリを削除します。

```bash
# ロールバックしたマイグレーションのエントリを削除
turso db shell <DB_NAME> \
  "DELETE FROM __drizzle_migrations WHERE tag = '0002_add_posts_table';"
```

### ステップ 4: アプリケーションの動作確認

```bash
# ローカルでアプリを起動して動作確認
pnpm dev

# ヘルスチェック
curl http://localhost:18787/health
```

### ステップ 5: 原因調査と修正

ロールバック完了後、以下を実施します。

1. マイグレーション失敗の原因を特定する
2. `src/db/schema.ts` を修正する
3. 新しいマイグレーションファイルを生成する（**既存のマイグレーションファイルは編集しない**）
4. ステージング環境で再検証する

```bash
# 修正後、新しいマイグレーションを生成
pnpm drizzle-kit generate --name fix_posts_table_constraint
pnpm drizzle-kit migrate
```

---

## 一般的なロールバックパターン

### カラム追加のロールバック

```sql
-- 元のマイグレーション（0003_add_bio_to_users.sql）
ALTER TABLE users ADD COLUMN bio TEXT;

-- ロールバック SQL
ALTER TABLE users DROP COLUMN bio;
-- __drizzle_migrations からエントリを削除
DELETE FROM __drizzle_migrations WHERE tag = '0003_add_bio_to_users';
```

### テーブル作成のロールバック

```sql
-- 元のマイグレーション
CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id)
);

-- ロールバック SQL
DROP TABLE IF EXISTS posts;
DELETE FROM __drizzle_migrations WHERE tag = '0002_add_posts_table';
```

### インデックス追加のロールバック

```sql
-- 元のマイグレーション
CREATE INDEX idx_users_email ON users(email);

-- ロールバック SQL
DROP INDEX IF EXISTS idx_users_email;
DELETE FROM __drizzle_migrations WHERE tag = '0004_add_email_index';
```

### カラム名変更のロールバック（非破壊的アプローチ）

SQLite はカラム名変更をサポートしていません。非破壊的な方法を使用します。

```sql
-- 推奨アプローチ: 新旧カラムを並存させる
-- 元のマイグレーション（新カラム追加）
ALTER TABLE users ADD COLUMN display_name TEXT;
UPDATE users SET display_name = name;

-- ロールバック SQL（新カラムを削除し古いカラムを保持）
ALTER TABLE users DROP COLUMN display_name;
DELETE FROM __drizzle_migrations WHERE tag = '0005_rename_name_to_display_name';
```

---

## ステージング環境でのロールバック検証

本番環境に適用する前に、必ずステージング環境でロールバック手順を検証します。

```bash
# 1. ステージング DB でマイグレーションを適用
DATABASE_URL=$STAGING_DATABASE_URL pnpm drizzle-kit migrate

# 2. ロールバック SQL を生成
./scripts/generate-rollback.sh drizzle/<migration_file>.sql

# 3. ステージング DB でロールバックを実行
turso db shell $STAGING_DB_NAME < drizzle/rollback/<migration_file>.rollback.sql

# 4. データ整合性を確認
turso db shell $STAGING_DB_NAME "SELECT COUNT(*) FROM users;"

# 5. アプリケーションを再起動して動作確認
```

---

## 緊急ロールバック（本番障害時）

本番環境でマイグレーション失敗が発生した場合の緊急手順です。

```bash
# 1. アプリケーションを停止してトラフィックをブロック（必要に応じて）
# Cloudflare Workers の場合: ルートを一時的に無効化

# 2. バックアップからリストア（最終手段）
turso db shell <DB_NAME> < backup-YYYYMMDD-HHMMSS.sql

# 3. または生成済みロールバック SQL を適用
turso db shell <DB_NAME> < drizzle/rollback/<migration>.rollback.sql

# 4. マイグレーション追跡テーブルを修正
turso db shell <DB_NAME> "DELETE FROM __drizzle_migrations WHERE tag = '<migration_tag>';"

# 5. アプリケーションを再起動
# 6. ヘルスチェックで動作確認
# 7. インシデントレポートを作成
```

---

## データ損失リスクが高いマイグレーション

以下のマイグレーションは特に注意が必要です。ロールバック SQL を必ず事前準備してください。

| 操作 | リスク | 対策 |
|------|--------|------|
| `DROP TABLE` | データ消失 | バックアップ必須、前進修正を検討 |
| `DROP COLUMN` | データ消失 | バックアップ必須 |
| `NOT NULL` 制約追加 | 既存データで失敗の可能性 | デフォルト値を先に設定 |
| 外部キー制約追加 | 既存データで失敗の可能性 | データ整合性を事前確認 |
| データ型変更 | データ損失の可能性 | 段階的移行（新カラム追加 → データコピー → 旧カラム削除） |

---

## 関連ドキュメント

- [ROADMAP.md](./ROADMAP.md) - 実装ロードマップ
- [Drizzle Kit 公式ドキュメント](https://orm.drizzle.team/kit-docs/overview)
- `scripts/generate-rollback.sh` - ロールバック SQL 生成スクリプト
