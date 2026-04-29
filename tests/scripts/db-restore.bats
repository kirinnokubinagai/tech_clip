#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/db-restore.sh"

@test "db-restore.sh: 引数なしでエラー終了する" {
  run bash "$SCRIPT"
  [ "$status" -ne 0 ]
}

@test "db-restore.sh: backup ファイルパスを引数に取る仕様" {
  grep -qE "backup|BACKUP|sql|sql.gz" "$SCRIPT"
}

