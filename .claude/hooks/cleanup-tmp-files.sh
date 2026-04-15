#!/bin/bash
# cleanup-tmp-files.sh
# SessionStart hook: 24 時間以上前の /tmp/issue-*-*.md を削除

REMOVED=0
if [ -d /tmp ]; then
    while IFS= read -r f; do
        [ -z "$f" ] && continue
        rm -f "$f" 2>/dev/null && REMOVED=$((REMOVED + 1))
    done < <(find /tmp -maxdepth 1 -type f -name 'issue-*-*.md' -mmin +1440 2>/dev/null)
fi

if [ "$REMOVED" -gt 0 ]; then
    if command -v jq >/dev/null 2>&1; then
        jq -n --arg msg "cleanup-tmp-files: ${REMOVED}件の古い spec ファイルを削除" \
          '{hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:$msg}}'
    fi
fi

exit 0
