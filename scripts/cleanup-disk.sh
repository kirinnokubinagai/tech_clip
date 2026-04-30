#!/bin/bash
# cleanup-disk.sh
# ディスク容量を解放する手動クリーンアップスクリプト
# 使い方: bash scripts/cleanup-disk.sh [--deep]
#   --deep: nix の古い世代も削除（より多くの容量を解放できるが遅い）

set -euo pipefail

DEEP=0
for arg in "$@"; do
  [ "$arg" = "--deep" ] && DEEP=1
done

echo "=== Tech Clip ディスククリーンアップ ==="
df -h / | awk 'NR==2 {printf "現在の空き容量: %s / %s (%s使用)\n", $4, $2, $5}'
echo ""

# ── 1. Nix GC ──────────────────────────────────────────────────────────────
if command -v nix-store &>/dev/null; then
  echo "[1/4] Nix ストアの GC を実行中..."
  BEFORE=$(df -k / | awk 'NR==2 {print $4}')
  if [ "$DEEP" -eq 1 ]; then
    # 古い世代のプロファイルも削除
    nix-collect-garbage -d 2>&1 | tail -3
  else
    nix-store --gc 2>&1 | tail -3
  fi
  AFTER=$(df -k / | awk 'NR==2 {print $4}')
  FREED=$(( (AFTER - BEFORE) / 1024 ))
  echo "  → ${FREED}MB 解放"
else
  echo "[1/4] nix-store が見つかりません。スキップ"
fi
echo ""

# ── 2. pnpm ストアのプルーン ──────────────────────────────────────────────
if command -v pnpm &>/dev/null; then
  echo "[2/4] pnpm ストアをプルーン中..."
  BEFORE=$(df -k / | awk 'NR==2 {print $4}')
  pnpm store prune 2>&1 | tail -3 || true
  AFTER=$(df -k / | awk 'NR==2 {print $4}')
  FREED=$(( (AFTER - BEFORE) / 1024 ))
  echo "  → ${FREED}MB 解放"
else
  echo "[2/4] pnpm が見つかりません。スキップ"
fi
echo ""

# ── 3. Android AVD qcow2 圧縮 ─────────────────────────────────────────────
# qcow2 ファイルは書き込みが発生するたびに肥大化し自動では縮小されない
# qemu-img convert で圧縮した新しいイメージに置き換える
AVD_DIR="$HOME/.android/avd"
if command -v qemu-img &>/dev/null && [ -d "$AVD_DIR" ]; then
  echo "[3/4] Android AVD qcow2 ファイルを圧縮中..."
  TOTAL_FREED=0
  while IFS= read -r qcow2; do
    ORIG_SIZE=$(du -k "$qcow2" | cut -f1)
    TMP="${qcow2}.compact.tmp"
    if qemu-img convert -O qcow2 "$qcow2" "$TMP" 2>/dev/null; then
      NEW_SIZE=$(du -k "$TMP" | cut -f1)
      mv "$TMP" "$qcow2"
      FREED=$(( ORIG_SIZE - NEW_SIZE ))
      TOTAL_FREED=$(( TOTAL_FREED + FREED ))
      echo "  圧縮: $(basename "$qcow2") — ${FREED}KB 削減"
    else
      rm -f "$TMP"
      echo "  スキップ: $(basename "$qcow2") (emulator 起動中の可能性)"
    fi
  done < <(find "$AVD_DIR" -name "*.qcow2" 2>/dev/null)
  echo "  → 合計 $(( TOTAL_FREED / 1024 ))MB 解放"
else
  echo "[3/4] qemu-img が見つからないか AVD ディレクトリが存在しません。スキップ"
  if [ -d "$AVD_DIR" ]; then
    echo "  ヒント: nix develop 環境内で実行すると qemu-img が使えます"
    echo "  または: nix-env -iA nixpkgs.qemu"
  fi
fi
echo ""

# ── 4. Gradle キャッシュのプルーン ────────────────────────────────────────
GRADLE_CACHE="$HOME/.gradle/caches"
if [ -d "$GRADLE_CACHE" ]; then
  echo "[4/4] Gradle キャッシュのクリーンアップ中..."
  BEFORE=$(df -k / | awk 'NR==2 {print $4}')
  # 30日以上古いビルドキャッシュのみ削除（依存関係キャッシュは保持）
  find "$GRADLE_CACHE" -maxdepth 3 -name "*.tmp" -mtime +1 -delete 2>/dev/null || true
  find "$GRADLE_CACHE/build-cache-*" -mtime +30 -delete 2>/dev/null || true
  AFTER=$(df -k / | awk 'NR==2 {print $4}')
  FREED=$(( (AFTER - BEFORE) / 1024 ))
  echo "  → ${FREED}MB 解放"
else
  echo "[4/4] Gradle キャッシュが見つかりません。スキップ"
fi
echo ""

# ── 最終レポート ────────────────────────────────────────────────────────────
echo "=== 完了 ==="
df -h / | awk 'NR==2 {printf "現在の空き容量: %s / %s (%s使用)\n", $4, $2, $5}'
