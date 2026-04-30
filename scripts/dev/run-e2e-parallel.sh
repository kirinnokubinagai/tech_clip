#!/usr/bin/env bash
# run-e2e-parallel.sh: ローカルで maestro flow を並列実行する開発者向け shortcut
#
# 使い方:
#   pnpm test:e2e:parallel              # 2 shard で並列 (デフォルト)
#   MAESTRO_SHARDS=3 pnpm test:e2e:parallel  # 3 shard
#   pnpm test:e2e:parallel 04-article-save  # 特定 flow のみ
#
# 動作:
#   1. emulator が target 数になるよう自動起動 (足りない分のみ追加)
#   2. Turso dev サーバーが未起動なら自動起動
#   3. e2e 環境を reset
#   4. maestro --shard-split N で並列実行
#   5. 自動起動した emulator は終了時に停止 (既存は残す)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || git rev-parse --show-toplevel)"

TARGET_SHARDS="${MAESTRO_SHARDS:-4}"
SPECIFIC_FLOW="${1:-}"

if ! command -v maestro >/dev/null 2>&1; then
  echo "ERROR: maestro がインストールされていません" >&2
  echo "  インストール: curl -Ls \"https://get.maestro.mobile.dev\" | bash" >&2
  exit 1
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "ERROR: adb が見つかりません。Android SDK を確認してください" >&2
  exit 1
fi

# Turso 起動チェック
if ! curl -sf -o /dev/null --max-time 3 -X POST \
     -H "Content-Type: application/json" \
     -d '{"requests":[]}' \
     "http://127.0.0.1:8888/v2/pipeline" 2>/dev/null; then
  echo "[e2e:parallel] Turso dev サーバーを自動起動..."
  bash "${REPO_ROOT}/scripts/ci/start-turso.sh"
fi

# emulator 不足分を自動起動
LAUNCHED_PORTS=()
EXISTING_COUNT=$(adb devices 2>/dev/null | grep -cE '^emulator-[0-9]+\s+device' || echo 0)
if [ "$EXISTING_COUNT" -lt "$TARGET_SHARDS" ]; then
  echo "[e2e:parallel] emulator が ${EXISTING_COUNT} 台 → ${TARGET_SHARDS} 台に拡張..."
  while IFS= read -r port; do
    [ -n "$port" ] && LAUNCHED_PORTS+=("$port")
  done < <(bash "${REPO_ROOT}/scripts/dev/launch-shard-emulators.sh" "$TARGET_SHARDS")
fi

# maestro 実行前の test output 一覧を記録 (新規生成のみ削除するため)
PRE_RUN_MAESTRO_DIRS_FILE="$(mktemp)"
ls -1 "${HOME}/.maestro/tests" 2>/dev/null | sort -u > "$PRE_RUN_MAESTRO_DIRS_FILE" || true

cleanup() {
  for p in "${LAUNCHED_PORTS[@]}"; do
    echo "[e2e:parallel] cleanup: emulator-${p} を停止" >&2
    adb -s "emulator-${p}" emu kill 2>/dev/null || true
  done

  # maestro が出力した test artifact を削除する。
  # 失敗時は最新の失敗 run のみ残し (デバッグ用)、それ以前を削除する。
  # 成功時は今回の run で新規生成されたもの全てを削除する。
  if [ -d "${HOME}/.maestro/tests" ] && [ -f "$PRE_RUN_MAESTRO_DIRS_FILE" ]; then
    POST_RUN_DIRS=$(ls -1 "${HOME}/.maestro/tests" 2>/dev/null | sort -u || true)
    NEW_DIRS=()
    while IFS= read -r dir; do
      [ -z "$dir" ] && continue
      if ! grep -qFx "$dir" "$PRE_RUN_MAESTRO_DIRS_FILE"; then
        NEW_DIRS+=("$dir")
      fi
    done <<< "$POST_RUN_DIRS"

    if [ "${MAESTRO_EXIT:-0}" -eq 0 ]; then
      # 成功: 全て削除
      for dir in "${NEW_DIRS[@]}"; do
        rm -rf "${HOME}/.maestro/tests/${dir}"
        echo "[e2e:parallel] cleanup: ~/.maestro/tests/${dir} を削除" >&2
      done
    else
      # 失敗: 最新 1 件だけ残す
      if [ "${#NEW_DIRS[@]}" -gt 1 ]; then
        # 配列をソート (時刻 prefix なので lexicographic = 時系列)
        IFS=$'\n' sorted=($(printf '%s\n' "${NEW_DIRS[@]}" | sort))
        unset IFS
        last_idx=$((${#sorted[@]} - 1))
        for i in "${!sorted[@]}"; do
          if [ "$i" -ne "$last_idx" ]; then
            rm -rf "${HOME}/.maestro/tests/${sorted[$i]}"
            echo "[e2e:parallel] cleanup: ~/.maestro/tests/${sorted[$i]} を削除" >&2
          fi
        done
        echo "[e2e:parallel] failure 時のため ~/.maestro/tests/${sorted[$last_idx]} を保持 (debug 用)" >&2
      fi
    fi
    rm -f "$PRE_RUN_MAESTRO_DIRS_FILE"
  fi

  # プロジェクト内の screenshots/ debug-output/ 等は常に削除 (test 結果として残さない)
  rm -rf "${REPO_ROOT}/screenshots" 2>/dev/null || true
  rm -rf "${REPO_ROOT}/debug-output" 2>/dev/null || true
  rm -rf "${REPO_ROOT}/.maestro" 2>/dev/null || true
}
trap cleanup EXIT

# 改めて emulator 数確認
EMU_COUNT=$(adb devices 2>/dev/null | grep -cE '^emulator-[0-9]+\s+device' || echo 0)
SHARDS="$EMU_COUNT"
if [ "$SHARDS" -gt "$TARGET_SHARDS" ]; then
  SHARDS="$TARGET_SHARDS"
fi

if [ "$SHARDS" -lt 1 ]; then
  echo "ERROR: 利用可能な emulator が 1 台もありません" >&2
  exit 1
fi

# 全 emulator で app state を完全クリア (Android Keystore = expo-secure-store の
# 認証トークンも含む)。maestro `clearState: true` は app data のみ消すので、前回
# テストで保存された auth token が Keystore に残り「セッション期限切れ」エラーを
# 引き起こすケースに対応する。
APP_PACKAGE="${SHARD_APP_ID:-com.techclip.app}"
echo "[e2e:parallel] 全 emulator の ${APP_PACKAGE} cache + Keystore を消去..."
while IFS= read -r line; do
  port=$(echo "$line" | grep -oE 'emulator-[0-9]+' || true)
  [ -z "$port" ] && continue
  adb -s "$port" shell pm clear "$APP_PACKAGE" >/dev/null 2>&1 &
done < <(adb devices 2>/dev/null | grep -E '^emulator-[0-9]+\s+device')
wait
echo "[e2e:parallel] cache 消去完了"


# e2e 環境 reset
echo "[e2e:parallel] e2e 環境をリセット中..."
bash "${REPO_ROOT}/scripts/e2e/reset-e2e-env.sh"

# 対象 flow を決定
FLOWS=()
if [ -n "$SPECIFIC_FLOW" ]; then
  # ユーザーが specific flow を指定
  CANDIDATE="${REPO_ROOT}/tests/e2e/maestro/${SPECIFIC_FLOW}"
  [[ "$CANDIDATE" != *.yaml ]] && CANDIDATE="${CANDIDATE}.yaml"
  if [ ! -f "$CANDIDATE" ]; then
    echo "ERROR: flow file not found: $CANDIDATE" >&2
    exit 1
  fi
  FLOWS+=("$CANDIDATE")
else
  while IFS= read -r f; do
    FLOWS+=("$f")
  done < <(find "${REPO_ROOT}/tests/e2e/maestro" -maxdepth 1 -name "*.yaml" ! -name ".env.yaml" ! -name "config.yaml" | sort)
fi

if [ "${#FLOWS[@]}" -eq 0 ]; then
  echo "ERROR: 対象 flow が見つかりません" >&2
  exit 1
fi

# config.yaml の env: ブロックを --env 引数に展開
# (--shard-split 実行では maestro が config.yaml の env を自動マージしないため、
#  個別 flow yaml の `${TEST_EMAIL}` 等を解決するために明示的に渡す)
ENV_ARGS=()
CONFIG_FILE="${REPO_ROOT}/tests/e2e/maestro/config.yaml"
if [ -f "$CONFIG_FILE" ]; then
  in_env=0
  while IFS= read -r line; do
    case "$line" in
      env:) in_env=1; continue ;;
      [a-zA-Z]*:) in_env=0; continue ;;
    esac
    if [ "$in_env" -eq 1 ]; then
      # "  KEY: VALUE" 形式 (先頭にインデント) のみ env として扱う
      case "$line" in
        ''|'#'*) continue ;;
        ' '*|$'\t'*)
          stripped="${line#"${line%%[![:space:]]*}"}"  # left trim
          k="${stripped%%:*}"
          v="${stripped#*: }"
          [ -z "$k" ] && continue
          ENV_ARGS+=("--env" "${k}=${v}")
          ;;
      esac
    fi
  done < "$CONFIG_FILE"
fi

# .env.yaml が存在すれば追加で展開 (機密情報の上書き用)
ENV_FILE="${REPO_ROOT}/tests/e2e/maestro/.env.yaml"
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line; do
    case "$line" in
      ''|'#'*) continue ;;
    esac
    k="${line%%:*}"
    v="${line#*: }"
    [ -z "$k" ] && continue
    ENV_ARGS+=("--env" "${k}=${v}")
  done < "$ENV_FILE"
fi

# 1 flow なら shard 不要、複数なら --shard-split
# exec せずに通常実行する (trap cleanup を発火させるため)
MAESTRO_EXIT=0
if [ "${#FLOWS[@]}" -eq 1 ] || [ "$SHARDS" -lt 2 ]; then
  echo "[e2e:parallel] ${#FLOWS[@]} flow を ${SHARDS} 台で実行 (順次)"
  maestro test "${ENV_ARGS[@]}" "${FLOWS[@]}" || MAESTRO_EXIT=$?
else
  echo "[e2e:parallel] ${#FLOWS[@]} flow を ${SHARDS} 台で並列実行 (--shard-split ${SHARDS})"
  maestro test --shard-split "$SHARDS" "${ENV_ARGS[@]}" "${FLOWS[@]}" || MAESTRO_EXIT=$?
fi
exit "$MAESTRO_EXIT"
