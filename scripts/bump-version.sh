#!/usr/bin/env bash
#
# bump-version.sh - TechClip バージョンバンプスクリプト
#
# 使い方:
#   ./scripts/bump-version.sh patch   # 1.2.3 → 1.2.4
#   ./scripts/bump-version.sh minor   # 1.2.3 → 1.3.0
#   ./scripts/bump-version.sh major   # 1.2.3 → 2.0.0
#
# 更新対象:
#   - apps/mobile/app.json  (expo.version, ios.buildNumber, android.versionCode)
#   - package.json          (version)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

APP_JSON="${REPO_ROOT}/apps/mobile/app.json"
PKG_JSON="${REPO_ROOT}/package.json"

# --- 引数チェック ---

BUMP_TYPE="${1:-}"

if [[ -z "${BUMP_TYPE}" ]]; then
  echo "エラー: バンプ種別を指定してください。"
  echo "使い方: $0 <patch|minor|major>"
  exit 1
fi

if [[ "${BUMP_TYPE}" != "patch" && "${BUMP_TYPE}" != "minor" && "${BUMP_TYPE}" != "major" ]]; then
  echo "エラー: バンプ種別は patch / minor / major のいずれかを指定してください。"
  echo "使い方: $0 <patch|minor|major>"
  exit 1
fi

# --- ファイル存在確認 ---

if [[ ! -f "${APP_JSON}" ]]; then
  echo "エラー: ${APP_JSON} が見つかりません。"
  exit 1
fi

if [[ ! -f "${PKG_JSON}" ]]; then
  echo "エラー: ${PKG_JSON} が見つかりません。"
  exit 1
fi

# --- jq の存在確認 ---

if ! command -v jq &>/dev/null; then
  echo "エラー: jq がインストールされていません。"
  echo "  macOS: brew install jq"
  echo "  Ubuntu: apt-get install jq"
  exit 1
fi

# --- 現在のバージョン取得 ---

CURRENT_VERSION="$(jq -r '.expo.version' "${APP_JSON}")"
CURRENT_BUILD_NUMBER="$(jq -r '.expo.ios.buildNumber // "0"' "${APP_JSON}")"
CURRENT_VERSION_CODE="$(jq -r '.expo.android.versionCode // 0' "${APP_JSON}")"

if [[ -z "${CURRENT_VERSION}" || "${CURRENT_VERSION}" == "null" ]]; then
  echo "エラー: app.json から expo.version を取得できませんでした。"
  exit 1
fi

# --- 新バージョン計算 ---

IFS='.' read -r MAJOR MINOR PATCH <<< "${CURRENT_VERSION}"

case "${BUMP_TYPE}" in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
NEW_BUILD_NUMBER=$((CURRENT_BUILD_NUMBER + 1))
NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))

# --- 変更内容の表示 ---

echo "バージョンバンプ: ${BUMP_TYPE}"
echo ""
echo "  version:     ${CURRENT_VERSION} → ${NEW_VERSION}"
echo "  buildNumber: ${CURRENT_BUILD_NUMBER} → ${NEW_BUILD_NUMBER}"
echo "  versionCode: ${CURRENT_VERSION_CODE} → ${NEW_VERSION_CODE}"
echo ""

# --- app.json の更新 ---

UPDATED_APP_JSON="$(
  jq \
    --arg version "${NEW_VERSION}" \
    --arg buildNumber "${NEW_BUILD_NUMBER}" \
    --argjson versionCode "${NEW_VERSION_CODE}" \
    '.expo.version = $version
     | .expo.ios.buildNumber = $buildNumber
     | .expo.android.versionCode = $versionCode' \
    "${APP_JSON}"
)"

echo "${UPDATED_APP_JSON}" > "${APP_JSON}"
echo "更新済み: ${APP_JSON}"

# --- package.json の更新 ---

UPDATED_PKG_JSON="$(
  jq \
    --arg version "${NEW_VERSION}" \
    '.version = $version' \
    "${PKG_JSON}"
)"

echo "${UPDATED_PKG_JSON}" > "${PKG_JSON}"
echo "更新済み: ${PKG_JSON}"

echo ""
echo "完了: v${NEW_VERSION}"
echo ""
echo "次のステップ:"
echo "  git add apps/mobile/app.json package.json"
echo "  git commit -m \"chore: bump version to ${NEW_VERSION}\""
