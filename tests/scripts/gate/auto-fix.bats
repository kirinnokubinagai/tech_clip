#!/usr/bin/env bats
# auto-fix.sh の bats テスト
#
# テスト環境: bats-core
# 実行: bats tests/scripts/gate/auto-fix.bats

REAL_SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/../scripts/gate/auto-fix.sh"

setup() {
    TMPDIR="$BATS_TEST_TMPDIR"
    export REPO_DIR="$TMPDIR/repo"
    mkdir -p "$REPO_DIR"
    git -C "$REPO_DIR" init -b main
    git -C "$REPO_DIR" config user.email "test@example.com"
    git -C "$REPO_DIR" config user.name "Test User"
    echo "init" > "$REPO_DIR/README.md"
    git -C "$REPO_DIR" add .
    git -C "$REPO_DIR" commit -m "init"

    # scripts/gate/ を REPO_DIR に作成して auto-fix.sh をコピー
    mkdir -p "$REPO_DIR/scripts/gate"
    cp "$REAL_SCRIPT" "$REPO_DIR/scripts/gate/auto-fix.sh"
    chmod +x "$REPO_DIR/scripts/gate/auto-fix.sh"

    # デフォルト: check-test-coverage.sh → PASS
    cat > "$REPO_DIR/scripts/gate/check-test-coverage.sh" <<'EOF'
#!/usr/bin/env bash
echo '{ "covered": true, "checked_files": 0, "exempt_files": 0 }'
exit 0
EOF
    chmod +x "$REPO_DIR/scripts/gate/check-test-coverage.sh"

    # bin stub dir
    mkdir -p "$TMPDIR/bin"

    # direnv stub: "exec <path> <cmd...>" → <cmd...>
    cat > "$TMPDIR/bin/direnv" <<'STUB'
#!/usr/bin/env bash
shift  # "exec"
shift  # path argument
exec "$@"
STUB
    chmod +x "$TMPDIR/bin/direnv"
}



# REPO_DIR の auto-fix.sh を実行するヘルパー
run_script() {
    local input="$1"
    (
        cd "$REPO_DIR"
        export PATH="$TMPDIR/bin:$PATH"
        echo "$input" | bash "$REPO_DIR/scripts/gate/auto-fix.sh"
    )
}

# -------------------------------------------------------------------------
# C-6: auto-fix.sh テスト
# -------------------------------------------------------------------------

@test "biome 指摘を含む CHANGES_REQUESTED は biome --apply を実行し exit 0 になること [C-6]" {
    cat > "$TMPDIR/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
    chmod +x "$TMPDIR/bin/pnpm"

    run run_script "Biome lint エラーが検出されました: unused import in src/foo.ts"
    [ "$status" -eq 0 ]
    [[ "$output" == *"auto-fix: biome check --apply 実行中"* ]]
}

@test "不足 test ファイルを含む CHANGES_REQUESTED は TS skeleton を生成して exit 0 になること [C-6]" {
    # check-test-coverage.sh を FAIL させて欠損テストパスを出力するスタブに差し替え
    cat > "$REPO_DIR/scripts/gate/check-test-coverage.sh" <<'EOF'
#!/usr/bin/env bash
echo "ERROR: 以下の変更に対応する test ファイルが不足しています:" >&2
echo "  - apps/api/src/foo.ts -> tests/api/foo.test.ts (新規ファイルに test が必要)" >&2
exit 1
EOF
    chmod +x "$REPO_DIR/scripts/gate/check-test-coverage.sh"

    cat > "$TMPDIR/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
    chmod +x "$TMPDIR/bin/pnpm"

    run run_script "test ファイルが存在しない: tests/api/foo.test.ts"
    [ "$status" -eq 0 ]
    [ -f "$REPO_DIR/tests/api/foo.test.ts" ]
    [[ "$(cat "$REPO_DIR/tests/api/foo.test.ts")" == *"auto-generated stub"* ]]
}

@test "不足 .bats ファイルを含む CHANGES_REQUESTED は bats stub を生成して exit 0 になること [C-6]" {
    cat > "$REPO_DIR/scripts/gate/check-test-coverage.sh" <<'EOF'
#!/usr/bin/env bash
echo "ERROR: test 不足" >&2
echo "  - .claude/hooks/foo.sh -> tests/hooks/foo.bats (新規ファイルに test が必要)" >&2
exit 1
EOF
    chmod +x "$REPO_DIR/scripts/gate/check-test-coverage.sh"

    cat > "$TMPDIR/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
    chmod +x "$TMPDIR/bin/pnpm"

    run run_script "test が必要: tests/hooks/foo.bats"
    [ "$status" -eq 0 ]
    [ -f "$REPO_DIR/tests/hooks/foo.bats" ]
    [[ "$(cat "$REPO_DIR/tests/hooks/foo.bats")" == *"#!/usr/bin/env bats"* ]]
}

@test "生成された TS stub は it.todo のみで failing テストを含まないこと [C-6]" {
    cat > "$REPO_DIR/scripts/gate/check-test-coverage.sh" <<'EOF'
#!/usr/bin/env bash
echo "ERROR: 以下の変更に対応する test ファイルが不足しています:" >&2
echo "  - apps/api/src/bar.ts -> tests/api/bar.test.ts (新規ファイルに test が必要)" >&2
exit 1
EOF
    chmod +x "$REPO_DIR/scripts/gate/check-test-coverage.sh"

    cat > "$TMPDIR/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
    chmod +x "$TMPDIR/bin/pnpm"

    run run_script "test ファイルが存在しない: tests/api/bar.test.ts"
    [ "$status" -eq 0 ]
    [ -f "$REPO_DIR/tests/api/bar.test.ts" ]
    # it.todo のみ含まれること
    grep -q 'it\.todo' "$REPO_DIR/tests/api/bar.test.ts"
    # 実際に実行される it(...) が含まれないこと（non-failing 保証）
    ! grep -qP '^  it\(' "$REPO_DIR/tests/api/bar.test.ts"
}

@test "生成された bats stub は skip のみで failing テストを含まないこと [C-6]" {
    cat > "$REPO_DIR/scripts/gate/check-test-coverage.sh" <<'EOF'
#!/usr/bin/env bash
echo "ERROR: test 不足" >&2
echo "  - .claude/hooks/bar.sh -> tests/hooks/bar.bats (新規ファイルに test が必要)" >&2
exit 1
EOF
    chmod +x "$REPO_DIR/scripts/gate/check-test-coverage.sh"

    cat > "$TMPDIR/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
    chmod +x "$TMPDIR/bin/pnpm"

    run run_script "test が必要: tests/hooks/bar.bats"
    [ "$status" -eq 0 ]
    [ -f "$REPO_DIR/tests/hooks/bar.bats" ]
    # skip 命令が含まれること
    grep -q 'skip ' "$REPO_DIR/tests/hooks/bar.bats"
    # run コマンド（実際の実行テスト）が含まれないこと
    ! grep -q '^  run ' "$REPO_DIR/tests/hooks/bar.bats"
}

@test "自動修正できない指摘は exit 1 になること [C-6]" {
    run run_script "ロジックのバグです: getUser() が null を返すケースが未処理"
    [ "$status" -eq 1 ]
    [[ "$output" == *"自動修正できる pattern を検出できませんでした"* ]]
}

@test "biome 修正後の再 lint が失敗する場合は exit 1 になること [C-6]" {
    # biome --apply は成功するが lint は失敗する
    cat > "$TMPDIR/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
CMD="$*"
if echo "$CMD" | grep -q "biome check --apply"; then
    exit 0
fi
exit 1
STUB
    chmod +x "$TMPDIR/bin/pnpm"

    run run_script "biome lint エラーが見つかりました"
    [ "$status" -eq 1 ]
    [[ "$output" == *"lint がまだ失敗しています"* ]]
}

@test "生成された TS stub は静的解析で non-failing パターンのみ含むこと [C-11]" {
    cat > "$REPO_DIR/scripts/gate/check-test-coverage.sh" <<'EOF'
#!/usr/bin/env bash
echo "ERROR: test 不足" >&2
echo "  - apps/api/src/baz.ts -> tests/api/baz.test.ts (新規ファイルに test が必要)" >&2
exit 1
EOF
    chmod +x "$REPO_DIR/scripts/gate/check-test-coverage.sh"

    cat > "$TMPDIR/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
    chmod +x "$TMPDIR/bin/pnpm"

    run run_script "test ファイルが存在しない: tests/api/baz.test.ts"
    [ "$status" -eq 0 ]

    # import 行と it.todo のみが含まれること
    grep -qE '^import \{ describe, it \} from "vitest";$' "$REPO_DIR/tests/api/baz.test.ts"
    grep -qE 'it\.todo\(' "$REPO_DIR/tests/api/baz.test.ts"
    # expect / assert / throw 等の failing 可能 statement が含まれないこと
    ! grep -qE '(expect\(|assert\(|throw |fail\(|toBe\()' "$REPO_DIR/tests/api/baz.test.ts"
    # 実行可能な it(...) (it.todo 以外) が含まれないこと
    ! grep -qE '^  it\([^.]' "$REPO_DIR/tests/api/baz.test.ts"
}

@test "生成された bats stub は skip のみで静的解析 non-failing であること [C-11]" {
    cat > "$REPO_DIR/scripts/gate/check-test-coverage.sh" <<'EOF'
#!/usr/bin/env bash
echo "ERROR: test 不足" >&2
echo "  - .claude/hooks/baz.sh -> tests/hooks/baz.bats (新規ファイルに test が必要)" >&2
exit 1
EOF
    chmod +x "$REPO_DIR/scripts/gate/check-test-coverage.sh"

    cat > "$TMPDIR/bin/pnpm" <<'STUB'
#!/usr/bin/env bash
exit 0
STUB
    chmod +x "$TMPDIR/bin/pnpm"

    run run_script "test が必要: tests/hooks/baz.bats"
    [ "$status" -eq 0 ]

    # @test ブロックと skip のみ含まれること
    grep -qE '^@test ".*" \{$' "$REPO_DIR/tests/hooks/baz.bats"
    grep -qE '  skip ' "$REPO_DIR/tests/hooks/baz.bats"
    # run / [ ... ] 等の実行 statement が含まれないこと
    ! grep -qE '^  (run |\[ |\[\[ )' "$REPO_DIR/tests/hooks/baz.bats"
}
