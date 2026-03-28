#!/usr/bin/env bash
# Turso DB バックアップスクリプト
#
# 使用方法:
#   ./scripts/db-backup.sh
#
# 必要な環境変数:
#   TURSO_ORG_NAME    - Turso 組織名
#   TURSO_DB_NAME     - データベース名
#   TURSO_AUTH_TOKEN  - 認証トークン（turso auth token で取得）
#   BACKUP_DIR        - バックアップ保存先ディレクトリ（省略時: ./backups）
#   BACKUP_STORAGE_URL - (省略可) リモートストレージ URL

set -euo pipefail

# ---------------------------------------------------------------------------
# 設定
# ---------------------------------------------------------------------------

# バックアップ保存先ディレクトリ
BACKUP_DIR="${BACKUP_DIR:-./backups}"

# バックアップ保持日数（この日数より古いファイルを削除）
BACKUP_RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

# タイムスタンプ（ファイル名に使用）
TIMESTAMP="$(date -u '+%Y%m%d_%H%M%S')"

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
# バックアップ実行
# ---------------------------------------------------------------------------

run_backup() {
  local db_url="libsql://${TURSO_DB_NAME}-${TURSO_ORG_NAME}.turso.io"
  local backup_file="${BACKUP_DIR}/${TURSO_DB_NAME}_${TIMESTAMP}.sql"
  local compressed_file="${backup_file}.gz"

  echo "[INFO] バックアップ開始: ${TURSO_DB_NAME} (${TIMESTAMP})"
  echo "[INFO] 接続先: ${db_url}"

  # バックアップディレクトリを作成
  mkdir -p "$BACKUP_DIR"

  # Turso DB から SQL ダンプを取得
  # TURSO_AUTH_TOKEN を環境変数として渡す
  if ! TURSO_TOKEN="$TURSO_AUTH_TOKEN" turso db shell "$db_url" .dump > "$backup_file" 2>/dev/null; then
    # turso db shell は db 名でも接続できる
    if ! turso db shell "$TURSO_DB_NAME" .dump > "$backup_file"; then
      echo "[ERROR] バックアップの取得に失敗しました" >&2
      rm -f "$backup_file"
      exit 1
    fi
  fi

  # ダンプファイルが空でないことを確認
  if [[ ! -s "$backup_file" ]]; then
    echo "[ERROR] バックアップファイルが空です" >&2
    rm -f "$backup_file"
    exit 1
  fi

  echo "[INFO] SQL ダンプ取得完了: ${backup_file}"

  # gzip 圧縮
  gzip "$backup_file"
  echo "[INFO] 圧縮完了: ${compressed_file}"

  # ファイルサイズを表示
  local size
  size="$(du -sh "$compressed_file" | cut -f1)"
  echo "[INFO] バックアップサイズ: ${size}"

  # リモートストレージへアップロード（設定済みの場合）
  if [[ -n "${BACKUP_STORAGE_URL:-}" ]]; then
    upload_to_remote "$compressed_file"
  fi

  echo "[INFO] バックアップ完了: ${compressed_file}"
}

# ---------------------------------------------------------------------------
# リモートストレージへアップロード
# ---------------------------------------------------------------------------

upload_to_remote() {
  local file="$1"
  local filename
  filename="$(basename "$file")"

  echo "[INFO] リモートストレージへアップロード中: ${BACKUP_STORAGE_URL}/${filename}"

  # rclone が利用可能な場合
  if command -v rclone &>/dev/null; then
    rclone copy "$file" "${BACKUP_STORAGE_URL}/"
    echo "[INFO] rclone アップロード完了"
    return
  fi

  # aws CLI が利用可能な場合（S3 互換）
  if command -v aws &>/dev/null; then
    aws s3 cp "$file" "${BACKUP_STORAGE_URL}/${filename}"
    echo "[INFO] S3 アップロード完了"
    return
  fi

  echo "[WARN] リモートアップロードツールが見つかりません（rclone または aws CLI が必要）" >&2
}

# ---------------------------------------------------------------------------
# 古いバックアップの削除
# ---------------------------------------------------------------------------

cleanup_old_backups() {
  echo "[INFO] ${BACKUP_RETENTION_DAYS} 日以上前のバックアップを削除中..."

  local deleted_count=0
  while IFS= read -r -d '' file; do
    rm -f "$file"
    echo "[INFO] 削除: ${file}"
    ((deleted_count++)) || true
  done < <(find "$BACKUP_DIR" -name "*.sql.gz" -mtime +"$BACKUP_RETENTION_DAYS" -print0 2>/dev/null)

  if [[ "$deleted_count" -eq 0 ]]; then
    echo "[INFO] 削除対象のバックアップはありません"
  else
    echo "[INFO] ${deleted_count} 件のバックアップを削除しました"
  fi
}

# ---------------------------------------------------------------------------
# メイン処理
# ---------------------------------------------------------------------------

main() {
  check_required_env
  check_turso_cli
  run_backup
  cleanup_old_backups
  echo "[INFO] すべての処理が完了しました"
}

main "$@"
