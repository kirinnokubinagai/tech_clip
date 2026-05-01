#!/usr/bin/env bats
# dangerous-command-guard.sh の check_main_branch_write テスト
#
# テスト環境: bats-core
# 実行: bats tests/hooks/dangerous-command-guard.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/.claude/hooks/dangerous-command-guard.sh"

setup() {
  unset GIT_DIR GIT_WORK_TREE
    TMPDIR="$BATS_TEST_TMPDIR"
    REPO_DIR="$TMPDIR/main"

    mkdir -p "$REPO_DIR"
    git -C "$REPO_DIR" init -b main
    git -C "$REPO_DIR" config user.email "test@example.com"
    git -C "$REPO_DIR" config user.name "Test User"
    echo "initial" > "$REPO_DIR/file.txt"
    git -C "$REPO_DIR" add .
    git -C "$REPO_DIR" commit -m "initial commit"
}


# ARGUMENTS JSON を組み立てて hook を実行するヘルパー
# jq で JSON を安全に構築することでダブルクォートを含むコマンドも正しく処理する
run_hook() {
    local cmd="$1"
    local json
    json=$(jq -n --arg c "$cmd" '{"command":$c}')
    (cd "$REPO_DIR" && ARGUMENTS="$json" bash "$SCRIPT")
}

@test "mainブランチ上の sed -i はブロックされること" {
    run run_hook "sed -i 's/foo/bar/g' file.txt"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "mainブランチ上の sed -E -i はブロックされること" {
    run run_hook "sed -E -i 's/foo/bar/g' file.txt"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "mainブランチ上の sed --in-place はブロックされること" {
    run run_hook "sed --in-place 's/foo/bar/g' file.txt"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "mainブランチ上の tee はブロックされること" {
    run run_hook "tee file.txt"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "featureブランチ上の sed -i は許可されること" {
    git -C "$REPO_DIR" checkout -b issue/test/feature
    run run_hook "sed -i 's/foo/bar/g' file.txt"
    [ "$status" -ne 2 ]
}

@test "featureブランチ上の tee は許可されること" {
    git -C "$REPO_DIR" checkout -b issue/test/feature
    run run_hook "tee file.txt"
    [ "$status" -ne 2 ]
}

@test "mainブランチ上の sed -E（インプレースなし）は許可されること" {
    run run_hook "sed -E 's/foo/bar/g' file.txt"
    [ "$status" -ne 2 ]
}

@test "mainブランチ上の通常の sed（-i なし）は許可されること" {
    run run_hook "sed 's/foo/bar/g' file.txt"
    [ "$status" -ne 2 ]
}

@test "gh pr edit --remove-label 'AI Review: NEEDS WORK' はブロックされること" {
    run run_hook "gh pr edit 123 --remove-label 'AI Review: NEEDS WORK'"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
    [[ "$output" == *"AI Review"* ]]
}

@test "gh pr edit --add-label 'AI Review: APPROVED' はブロックされること" {
    run run_hook "gh pr edit 123 --add-label 'AI Review: APPROVED'"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "gh pr edit --remove-label 'AI Review: SKIPPED' (ダブルクォート) もブロックされること" {
    run run_hook 'gh pr edit 123 --remove-label "AI Review: SKIPPED"'
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "gh issue edit --add-label 'AI Review: APPROVED' もブロックされること" {
    run run_hook "gh issue edit 1167 --add-label 'AI Review: APPROVED'"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "大文字小文字混在 'ai-review-needs-work' もブロックされること" {
    run run_hook "gh pr edit 123 --add-label 'ai-review-needs-work'"
    [ "$status" -eq 2 ]
    [[ "$output" == *"DENY"* ]]
}

@test "gh pr edit --add-label 'bug' (AI Review 以外) は許可されること" {
    run run_hook "gh pr edit 123 --add-label 'bug'"
    [ "$status" -ne 2 ]
}

@test "gh pr edit --add-label 'needs-review' (AI Review プレフィックスなし) は許可されること" {
    run run_hook "gh pr edit 123 --add-label 'needs-review'"
    [ "$status" -ne 2 ]
}

@test "gh pr view 123 (edit 以外) は許可されること" {
    run run_hook "gh pr view 123"
    [ "$status" -ne 2 ]
}

@test "gh pr edit --title 'fix' (--*-label なし) は許可されること" {
    run run_hook "gh pr edit 123 --title 'fix: foo'"
    [ "$status" -ne 2 ]
}

@test "AI Review ブロック時に修正手順メッセージが出ること" {
    run run_hook "gh pr edit 123 --remove-label 'AI Review: NEEDS WORK'"
    [ "$status" -eq 2 ]
    [[ "$output" == *"全件"* || "$output" == *"push"* ]]
}
