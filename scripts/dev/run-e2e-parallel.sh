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

TARGET_SHARDS="${MAESTRO_SHARDS:-2}"
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

cleanup() {
  for p in "${LAUNCHED_PORTS[@]}"; do
    echo "[e2e:parallel] cleanup: emulator-${p} を停止" >&2
    adb -s "emulator-${p}" emu kill 2>/dev/null || true
  done
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

# .env.yaml を --env 引数に展開
ENV_ARGS=()
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
if [ "${#FLOWS[@]}" -eq 1 ] || [ "$SHARDS" -lt 2 ]; then
  echo "[e2e:parallel] ${#FLOWS[@]} flow を ${SHARDS} 台で実行 (順次)"
  exec maestro test "${ENV_ARGS[@]}" "${FLOWS[@]}"
else
  echo "[e2e:parallel] ${#FLOWS[@]} flow を ${SHARDS} 台で並列実行 (--shard-split ${SHARDS})"
  exec maestro test --shard-split "$SHARDS" "${ENV_ARGS[@]}" "${FLOWS[@]}"
fi
