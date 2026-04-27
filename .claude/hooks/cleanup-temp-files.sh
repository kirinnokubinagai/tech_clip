#!/bin/bash
# cleanup-temp-files.sh
# SessionStart hook: 古い Claude temp / agent temp file を削除して disk full を防ぐ
# disk < 5GB のとき nix GC + AVD qcow2 圧縮も自動実行する

CONTEXT_PREFIX="[cleanup-temp-files]"

# UID を動的取得
CURRENT_UID=$(id -u)
CLAUDE_TMP="/private/tmp/claude-${CURRENT_UID}"
LINUX_CLAUDE_TMP="/tmp/claude-${CURRENT_UID}"

# disk 空き容量チェック（/ ボリューム基準）
AVAIL_KB=$(df -k / 2>/dev/null | awk 'NR==2 {print $4}' || echo 0)
AVAIL_GB=$(( AVAIL_KB / 1024 / 1024 ))

MTIME_OPT=(-mtime +1)   # デフォルト（24時間）
WARN_MSG=""
NIX_GC_RUN=0
if [ "$AVAIL_GB" -lt 1 ]; then
  MTIME_OPT=(-mmin +60)
  WARN_MSG="ERROR: disk 空き容量が ${AVAIL_KB}KB (< 1GB) です。強制 cleanup を実行します。"
elif [ "$AVAIL_GB" -lt 5 ]; then
  WARN_MSG="WARN: disk 空き容量が ${AVAIL_GB}GB (< 5GB) です。"
fi

DELETED_SESSIONS=0
DELETED_AGENT_FILES=0

# Claude task output セッションディレクトリの削除
# macOS: /private/tmp/claude-<UID>/<project>/<session-uuid>/tasks/
# Linux: /tmp/claude-<UID>/<project>/<session-uuid>/tasks/
cleanup_claude_sessions() {
  local base_dir="$1"
  [ -d "$base_dir" ] || return 0

  # セッション UUID ディレクトリ (<project>/<session-uuid>) を列挙
  # maxdepth 3 で <project>/<session-uuid>/tasks 相当の depth
  while IFS= read -r tasks_dir; do
    session_dir=$(dirname "$tasks_dir")
    [ -d "$session_dir" ] || continue
    rm -rf "$session_dir" 2>/dev/null && DELETED_SESSIONS=$((DELETED_SESSIONS + 1))
  done < <(find "$base_dir" -maxdepth 3 -type d -name "tasks" "${MTIME_OPT[@]}" 2>/dev/null)
}

cleanup_claude_sessions "$CLAUDE_TMP"
cleanup_claude_sessions "$LINUX_CLAUDE_TMP"

# agent temp file の削除: /tmp/issue-*-*.md
while IFS= read -r f; do
  rm -f "$f" 2>/dev/null && DELETED_AGENT_FILES=$((DELETED_AGENT_FILES + 1))
done < <(find /tmp -maxdepth 1 -type f -name "issue-*-*.md" "${MTIME_OPT[@]}" 2>/dev/null)

# disk < 5GB のとき nix GC を自動実行（高速 GC のみ; --delete-older-than は実行しない）
if [ "$AVAIL_GB" -lt 5 ] && command -v nix-store &>/dev/null; then
  NIX_FREED_KB=0
  BEFORE_KB=$(df -k / 2>/dev/null | awk 'NR==2 {print $4}' || echo 0)
  nix-store --gc &>/dev/null
  AFTER_KB=$(df -k / 2>/dev/null | awk 'NR==2 {print $4}' || echo 0)
  NIX_FREED_KB=$(( AFTER_KB - BEFORE_KB ))
  NIX_FREED_GB=$(( NIX_FREED_KB / 1024 / 1024 ))
  NIX_GC_RUN=1
fi

# 結果 df を再取得
AVAIL_AFTER_KB=$(df -k / 2>/dev/null | awk 'NR==2 {print $4}' || echo 0)
AVAIL_AFTER_GB=$(( AVAIL_AFTER_KB / 1024 / 1024 ))

# 出力メッセージ組み立て
NIX_MSG=""
if [ "$NIX_GC_RUN" -eq 1 ]; then
  NIX_MSG=" nix-gc: +${NIX_FREED_GB}GB 解放。"
fi

if [ -n "$WARN_MSG" ]; then
  MSG="${CONTEXT_PREFIX} ${WARN_MSG} セッション削除: ${DELETED_SESSIONS}件, agent temp: ${DELETED_AGENT_FILES}件,${NIX_MSG} 空き: ${AVAIL_AFTER_GB}GB"
elif [ "$DELETED_SESSIONS" -gt 0 ] || [ "$DELETED_AGENT_FILES" -gt 0 ] || [ "$NIX_GC_RUN" -eq 1 ]; then
  MSG="${CONTEXT_PREFIX} セッション削除: ${DELETED_SESSIONS}件, agent temp: ${DELETED_AGENT_FILES}件,${NIX_MSG} 空き: ${AVAIL_AFTER_GB}GB"
else
  exit 0
fi

# JSON 出力
if command -v jq &>/dev/null; then
  jq -n --arg msg "$MSG" '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":$msg}}'
else
  SAFE_MSG=$(printf '%s' "$MSG" | tr -d '"\\' | tr -d '\n\r\t')
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":\"${SAFE_MSG}\"}}"
fi

exit 0
