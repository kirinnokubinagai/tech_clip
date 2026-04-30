#!/usr/bin/env bash
# askuserquestion-flag.sh: AskUserQuestion フラグの妥当性を確認するヘルパー
#
# 使い方:
#   source scripts/lib/askuserquestion-flag.sh
#   if check_askuserquestion_flag <max-elapsed-seconds>; then
#     # フラグ有効
#   fi
#
# 引数:
#   max_elapsed (省略時 300): 何秒以内のフラグなら有効とみなすか
#
# 環境変数:
#   CLAUDE_USER_ROOT: フラグファイルの探索ルート（デフォルト REPO/.claude-user）

check_askuserquestion_flag() {
  local max_elapsed="${1:-300}"
  local root="${CLAUDE_USER_ROOT:-${REPO_ROOT:-$(pwd)}/.claude-user}"

  local flag_file
  flag_file=$(ls "${root}/projects/"*/memory/tmp-last-askuserquestion.flag 2>/dev/null | head -1 || true)
  [ -n "$flag_file" ] && [ -f "$flag_file" ] || return 1

  local flag_time
  flag_time=$(cat "$flag_file" 2>/dev/null || echo "")
  [ -n "$flag_time" ] || return 1

  local flag_epoch
  flag_epoch=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "${flag_time%Z}" +%s 2>/dev/null \
    || date -d "$flag_time" +%s 2>/dev/null \
    || echo 0)

  local now_epoch elapsed
  now_epoch=$(date +%s)
  elapsed=$((now_epoch - flag_epoch))

  [ "$elapsed" -le "$max_elapsed" ]
}

# mockup approval flag (issue 番号別、デフォルト 30 分)
check_mockup_approval_flag() {
  local issue_num="${1:?usage: check_mockup_approval_flag <issue-num>}"
  local max_elapsed="${2:-1800}"
  local root="${CLAUDE_USER_ROOT:-${REPO_ROOT:-$(pwd)}/.claude-user}"

  local flag_path
  flag_path=$(ls "${root}/projects/"*/memory/mockup-approved-${issue_num}.flag 2>/dev/null | head -1 || true)
  [ -n "$flag_path" ] && [ -f "$flag_path" ] || return 1

  local flag_time flag_epoch now_epoch elapsed
  flag_time=$(cat "$flag_path" 2>/dev/null || echo "")
  [ -n "$flag_time" ] || return 1

  flag_epoch=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "${flag_time%Z}" +%s 2>/dev/null \
    || date -d "$flag_time" +%s 2>/dev/null \
    || echo 0)
  now_epoch=$(date +%s)
  elapsed=$((now_epoch - flag_epoch))
  [ "$elapsed" -le "$max_elapsed" ]
}
