#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/db-backup.sh"

@test "db-backup.sh: TURSO_* 環境変数を使う仕様" {
  grep -qE "TURSO_ORG_NAME|TURSO_DB_NAME|TURSO_AUTH_TOKEN" "$SCRIPT"
}

@test "db-backup.sh: バックアップ保存先ディレクトリを持つ仕様" {
  grep -qE "BACKUP_DIR|backups" "$SCRIPT"
}

