#!/usr/bin/env bash
#
# generate-rollback.sh
# Drizzle マイグレーションファイルからロールバック SQL を生成するスクリプト
#
# 使用方法:
#   ./scripts/generate-rollback.sh <migration_file>
#   ./scripts/generate-rollback.sh drizzle/0002_add_posts_table.sql
#
# 出力:
#   drizzle/rollback/<migration_name>.rollback.sql
#
# 注意:
#   - このスクリプトはヒューリスティックなパターンマッチングを使用します
#   - 生成されたロールバック SQL は必ず手動で確認・修正してください
#   - 複雑なマイグレーション（データ変換等）は手動でロールバック SQL を作成してください

set -euo pipefail

# ---------------------------------------------------------------------------
# 定数
# ---------------------------------------------------------------------------

## ロールバック SQL の出力ディレクトリ
ROLLBACK_DIR="drizzle/rollback"

# ---------------------------------------------------------------------------
# 関数定義
# ---------------------------------------------------------------------------

print_usage() {
  echo "使用方法: $0 <migration_file>"
  echo ""
  echo "例:"
  echo "  $0 drizzle/0002_add_posts_table.sql"
  echo "  $0 drizzle/0003_add_bio_to_users.sql"
  echo ""
  echo "出力: ${ROLLBACK_DIR}/<migration_name>.rollback.sql"
}

print_error() {
  echo "[ERROR] $1" >&2
}

print_info() {
  echo "[INFO] $1"
}

print_warn() {
  echo "[WARN] $1"
}

# CREATE TABLE -> DROP TABLE
generate_drop_table() {
  local table_name="$1"
  echo "DROP TABLE IF EXISTS ${table_name};"
}

# ALTER TABLE ADD COLUMN -> ALTER TABLE DROP COLUMN
generate_drop_column() {
  local table_name="$1"
  local column_name="$2"
  echo "ALTER TABLE ${table_name} DROP COLUMN IF EXISTS ${column_name};"
}

# CREATE INDEX -> DROP INDEX
generate_drop_index() {
  local index_name="$1"
  echo "DROP INDEX IF EXISTS ${index_name};"
}

# CREATE UNIQUE INDEX -> DROP INDEX
generate_drop_unique_index() {
  local index_name="$1"
  echo "DROP INDEX IF EXISTS ${index_name};"
}

# マイグレーションタグを __drizzle_migrations から削除
generate_delete_migration_record() {
  local migration_tag="$1"
  echo ""
  echo "-- マイグレーション追跡テーブルからエントリを削除"
  echo "DELETE FROM __drizzle_migrations WHERE tag = '${migration_tag}';"
}

# ---------------------------------------------------------------------------
# メイン処理
# ---------------------------------------------------------------------------

# 引数チェック
if [ $# -eq 0 ]; then
  print_usage
  exit 1
fi

MIGRATION_FILE="$1"

# ファイル存在チェック
if [ ! -f "${MIGRATION_FILE}" ]; then
  print_error "マイグレーションファイルが見つかりません: ${MIGRATION_FILE}"
  exit 1
fi

# ファイル名からマイグレーション名を抽出（拡張子なし）
MIGRATION_BASENAME=$(basename "${MIGRATION_FILE}" .sql)

# ロールバック出力ファイルのパス
ROLLBACK_FILE="${ROLLBACK_DIR}/${MIGRATION_BASENAME}.rollback.sql"

# 出力ディレクトリを作成
mkdir -p "${ROLLBACK_DIR}"

print_info "マイグレーションファイルを解析中: ${MIGRATION_FILE}"

# ロールバック SQL ファイルのヘッダーを生成
cat > "${ROLLBACK_FILE}" << EOF
-- ============================================================
-- ロールバック SQL: ${MIGRATION_BASENAME}
-- 生成日時: $(date '+%Y-%m-%d %H:%M:%S')
-- 元ファイル: ${MIGRATION_FILE}
--
-- 警告: このファイルはヒューリスティックにより自動生成されました。
--       実行前に必ず内容を確認・修正してください。
--       特に以下の点に注意:
--         - DROP 操作はデータを削除します（バックアップを確認してください）
--         - 複雑な変換ロジックは手動で追記が必要な場合があります
-- ============================================================

BEGIN;

EOF

GENERATED_STATEMENTS=0

# マイグレーション SQL を行ごとに解析
while IFS= read -r line; do
  # 空行・コメント行はスキップ
  trimmed_line=$(echo "${line}" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
  if [ -z "${trimmed_line}" ] || [[ "${trimmed_line}" == --* ]]; then
    continue
  fi

  # CREATE TABLE の検出
  if echo "${trimmed_line}" | grep -qiE "^CREATE[[:space:]]+(TABLE|TABLE[[:space:]]+IF[[:space:]]+NOT[[:space:]]+EXISTS)"; then
    table_name=$(echo "${trimmed_line}" | grep -oiE "(TABLE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?)\`?\"?([a-zA-Z_][a-zA-Z0-9_]*)\`?\"?" | awk '{print $NF}' | tr -d '`"')
    if [ -n "${table_name}" ]; then
      echo "-- ロールバック: CREATE TABLE ${table_name}" >> "${ROLLBACK_FILE}"
      generate_drop_table "${table_name}" >> "${ROLLBACK_FILE}"
      echo "" >> "${ROLLBACK_FILE}"
      GENERATED_STATEMENTS=$((GENERATED_STATEMENTS + 1))
      print_info "  検出: CREATE TABLE ${table_name} -> DROP TABLE ${table_name}"
    fi
  fi

  # ALTER TABLE ADD COLUMN の検出
  if echo "${trimmed_line}" | grep -qiE "^ALTER[[:space:]]+TABLE.+ADD[[:space:]]+COLUMN"; then
    table_name=$(echo "${trimmed_line}" | grep -oiE "TABLE[[:space:]]+\`?\"?([a-zA-Z_][a-zA-Z0-9_]*)\`?\"?" | awk '{print $NF}' | tr -d '`"')
    column_name=$(echo "${trimmed_line}" | grep -oiE "ADD[[:space:]]+COLUMN[[:space:]]+\`?\"?([a-zA-Z_][a-zA-Z0-9_]*)\`?\"?" | awk '{print $NF}' | tr -d '`"')
    if [ -n "${table_name}" ] && [ -n "${column_name}" ]; then
      echo "-- ロールバック: ALTER TABLE ${table_name} ADD COLUMN ${column_name}" >> "${ROLLBACK_FILE}"
      generate_drop_column "${table_name}" "${column_name}" >> "${ROLLBACK_FILE}"
      echo "" >> "${ROLLBACK_FILE}"
      GENERATED_STATEMENTS=$((GENERATED_STATEMENTS + 1))
      print_info "  検出: ADD COLUMN ${column_name} on ${table_name} -> DROP COLUMN ${column_name}"
    fi
  fi

  # CREATE INDEX の検出
  if echo "${trimmed_line}" | grep -qiE "^CREATE[[:space:]]+INDEX"; then
    index_name=$(echo "${trimmed_line}" | grep -oiE "INDEX[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?\`?\"?([a-zA-Z_][a-zA-Z0-9_]*)\`?\"?" | awk '{print $NF}' | tr -d '`"')
    if [ -n "${index_name}" ]; then
      echo "-- ロールバック: CREATE INDEX ${index_name}" >> "${ROLLBACK_FILE}"
      generate_drop_index "${index_name}" >> "${ROLLBACK_FILE}"
      echo "" >> "${ROLLBACK_FILE}"
      GENERATED_STATEMENTS=$((GENERATED_STATEMENTS + 1))
      print_info "  検出: CREATE INDEX ${index_name} -> DROP INDEX ${index_name}"
    fi
  fi

  # CREATE UNIQUE INDEX の検出
  if echo "${trimmed_line}" | grep -qiE "^CREATE[[:space:]]+UNIQUE[[:space:]]+INDEX"; then
    index_name=$(echo "${trimmed_line}" | grep -oiE "INDEX[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?\`?\"?([a-zA-Z_][a-zA-Z0-9_]*)\`?\"?" | awk '{print $NF}' | tr -d '`"')
    if [ -n "${index_name}" ]; then
      echo "-- ロールバック: CREATE UNIQUE INDEX ${index_name}" >> "${ROLLBACK_FILE}"
      generate_drop_unique_index "${index_name}" >> "${ROLLBACK_FILE}"
      echo "" >> "${ROLLBACK_FILE}"
      GENERATED_STATEMENTS=$((GENERATED_STATEMENTS + 1))
      print_info "  検出: CREATE UNIQUE INDEX ${index_name} -> DROP INDEX ${index_name}"
    fi
  fi

  # DROP TABLE の警告（ロールバックには元のデータが必要）
  if echo "${trimmed_line}" | grep -qiE "^DROP[[:space:]]+TABLE"; then
    print_warn "  DROP TABLE を検出しました。ロールバックにはバックアップからのデータリストアが必要です。"
    echo "-- 警告: DROP TABLE のロールバックにはバックアップからのデータリストアが必要です" >> "${ROLLBACK_FILE}"
    echo "-- 元のテーブル定義と全データを手動でリストアしてください" >> "${ROLLBACK_FILE}"
    echo "" >> "${ROLLBACK_FILE}"
  fi

done < "${MIGRATION_FILE}"

# マイグレーション追跡テーブルのエントリ削除を追加
generate_delete_migration_record "${MIGRATION_BASENAME}" >> "${ROLLBACK_FILE}"

# トランザクション終了
cat >> "${ROLLBACK_FILE}" << EOF

COMMIT;
EOF

# 結果の報告
echo ""
if [ "${GENERATED_STATEMENTS}" -eq 0 ]; then
  print_warn "自動生成されたロールバック文がありません。"
  print_warn "マイグレーションに手動ロールバック SQL の追記が必要な可能性があります。"
  print_warn "出力ファイルを確認してください: ${ROLLBACK_FILE}"
else
  print_info "ロールバック SQL を生成しました: ${ROLLBACK_FILE}"
  print_info "生成されたロールバック文: ${GENERATED_STATEMENTS} 件"
fi

echo ""
print_warn "============================================================"
print_warn "重要: 実行前に ${ROLLBACK_FILE} の内容を必ず確認してください。"
print_warn "特に DROP 操作はデータを削除します。バックアップを確認してください。"
print_warn "============================================================"
