#!/usr/bin/env bash
# Turso DB リストアスクリプト
#
# 使用方法:
#   ./scripts/db-restore.sh <backup-file>
#
#   例:
#     ./scripts/db-restore.sh backups/techclip-prod_20240101_020000.sql.gz
#     ./scripts/db-restore.sh backups/techclip-prod_20240101_020000.sql
#
# 必要な環境変数:
#   TURSO_ORG_NAME    - Turso 組織名
#   TURSO_DB_NAME     - データベース名
#   TURSO_AUTH_TOKEN  - 認証トークン（turso auth token で取得）

set -euo pipefail

# ---------------------------------------------------------------------------
# 引数チェック
# ---------------------------------------------------------------------------

if [[ $# -lt 1 ]]; then
  echo "使用方法: $0 <backup-file>" >&2
  echo "" >&2
  echo "例:" >&2
  echo "  $0 backups/techclip-prod_20240101_020000.sql.gz" >&2
  echo "  $0 backups/techclip-prod_20240101_020000.sql" >&2
  exit 1
fi

BACKUP_FILE="$1"

# ---------------------------------------------------------------------------
# 必須環境変数チェック
# ---------------------------------------------------------------------------

check_required_env() {
  local missing=0

  if [[ -z "${TURSO_ORG_NAME:-}" ]]; then
    echo "[ERROR] 環境変数 TURSO_ORG_NAME が設定されていません" >&2
    missing=1
  fi

  if [[ -z "${TURSO_DB_NAME:-}" ]]; then
    echo "[ERROR] 環境変数 TURSO_DB_NAME が設定されていません" >&2
    missing=1
  fi

  if [[ -z "${TURSO_AUTH_TOKEN:-}" ]]; then
    echo "[ERROR] 環境変数 TURSO_AUTH_TOKEN が設定されていません" >&2
    missing=1
  fi

  if [[ "$missing" -eq 1 ]]; then
    echo "[ERROR] 必須環境変数が不足しています。.env ファイルまたは CI/CD シークレットを確認してください" >&2
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# Turso CLI の存在確認
# ---------------------------------------------------------------------------

check_turso_cli() {
  if ! command -v turso &>/dev/null; then
    echo "[ERROR] turso CLI が見つかりません" >&2
    echo "[INFO]  インストール: curl -sSfL https://get.tur.so/install.sh | bash" >&2
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# バックアップファイルの確認
# ---------------------------------------------------------------------------

check_backup_file() {
  if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "[ERROR] バックアップファイルが見つかりません: ${BACKUP_FILE}" >&2
    exit 1
  fi
}

# ---------------------------------------------------------------------------
# 確認プロンプト
# ---------------------------------------------------------------------------

confirm_restore() {
  local db_url="libsql://${TURSO_DB_NAME}-${TURSO_ORG_NAME}.turso.io"

  echo ""
  echo "=================================================================="
  echo "  警告: データベースリストアを実行します"
  echo "=================================================================="
  echo "  対象DB : ${TURSO_DB_NAME}"
  echo "  接続先 : ${db_url}"
  echo "  ファイル: ${BACKUP_FILE}"
  echo "=================================================================="
  echo ""
  echo "この操作は現在のデータベースの内容を上書きします。"
  echo "実行前に現在のデータをバックアップしてください。"
  echo ""
  read -r -p "続行しますか？ (yes/no): " answer

  if [[ "$answer" != "yes" ]]; then
    echo "[INFO] リストアをキャンセルしました"
    exit 0
  fi
}

# ---------------------------------------------------------------------------
# リストア前に現在の状態をバックアップ
# ---------------------------------------------------------------------------

backup_current_state() {
  echo "[INFO] リストア前に現在の状態をバックアップ中..."

  local pre_restore_dir="./backups/pre-restore"
  mkdir -p "$pre_restore_dir"

  local timestamp
  timestamp="$(date -u '+%Y%m%d_%H%M%S')"
  local pre_restore_file="${pre_restore_dir}/${TURSO_DB_NAME}_pre-restore_${timestamp}.sql"

  if turso db shell "$TURSO_DB_NAME" .dump > "$pre_restore_file" 2>/dev/null; then
    gzip "$pre_restore_file"
    echo "[INFO] 現在の状態をバックアップしました: ${pre_restore_file}.gz"
  else
    echo "[WARN] 現在の状態のバックアップに失敗しました（DB が空の可能性があります）" >&2
  fi
}

# ---------------------------------------------------------------------------
# SQL ファイルの準備（解凍が必要な場合）
# ---------------------------------------------------------------------------

prepare_sql_file() {
  if [[ "$BACKUP_FILE" == *.gz ]]; then
    echo "[INFO] バックアップファイルを解凍中..."

    # 一時ファイルに解凍（元ファイルを保持するため -k オプション）
    TEMP_SQL_FILE="${BACKUP_FILE%.gz}"

    # 解凍先が既に存在する場合は削除
    if [[ -f "$TEMP_SQL_FILE" ]]; then
      rm -f "$TEMP_SQL_FILE"
    fi

    gunzip -k "$BACKUP_FILE"
    SQL_FILE="$TEMP_SQL_FILE"
    CLEANUP_TEMP=true
    echo "[INFO] 解凍完了: ${SQL_FILE}"
  else
    SQL_FILE="$BACKUP_FILE"
    CLEANUP_TEMP=false
  fi
}

# ---------------------------------------------------------------------------
# リストア実行
# ---------------------------------------------------------------------------

run_restore() {
  local db_url="libsql://${TURSO_DB_NAME}-${TURSO_ORG_NAME}.turso.io"

  echo "[INFO] リストア開始: ${TURSO_DB_NAME}"
  echo "[INFO] 接続先: ${db_url}"

  if ! turso db shell "$TURSO_DB_NAME" < "$SQL_FILE"; then
    echo "[ERROR] リストアに失敗しました" >&2

    # 一時ファイルのクリーンアップ
    if [[ "${CLEANUP_TEMP:-false}" == "true" && -f "${SQL_FILE:-}" ]]; then
      rm -f "$SQL_FILE"
    fi

    exit 1
  fi

  echo "[INFO] リストア完了"
}

# ---------------------------------------------------------------------------
# 一時ファイルのクリーンアップ
# ---------------------------------------------------------------------------

cleanup_temp_files() {
  if [[ "${CLEANUP_TEMP:-false}" == "true" && -f "${SQL_FILE:-}" ]]; then
    rm -f "$SQL_FILE"
    echo "[INFO] 一時ファイルを削除しました: ${SQL_FILE}"
  fi
}

# ---------------------------------------------------------------------------
# リストア後の確認
# ---------------------------------------------------------------------------

verify_restore() {
  echo "[INFO] リストア結果を確認中..."

  local tables
  tables="$(turso db shell "$TURSO_DB_NAME" ".tables" 2>/dev/null || echo "")"

  if [[ -z "$tables" ]]; then
    echo "[WARN] テーブルが見つかりません。リストア内容を確認してください" >&2
    return
  fi

  echo "[INFO] 復元されたテーブル:"
  echo "$tables" | while read -r table; do
    if [[ -n "$table" ]]; then
      local count
      count="$(turso db shell "$TURSO_DB_NAME" "SELECT count(*) FROM ${table};" 2>/dev/null | tail -1 || echo "?")"
      echo "  - ${table}: ${count} 件"
    fi
  done
}

# ---------------------------------------------------------------------------
# メイン処理
# ---------------------------------------------------------------------------

main() {
  check_required_env
  check_turso_cli
  check_backup_file
  confirm_restore
  backup_current_state
  prepare_sql_file
  run_restore
  cleanup_temp_files
  verify_restore
  echo "[INFO] すべての処理が完了しました"
  echo "[INFO] アプリケーションの動作確認を行ってください"
}

main "$@"
