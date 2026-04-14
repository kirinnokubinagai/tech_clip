#!/usr/bin/env bats
# poll-pr-review.sh のテスト
#
# テスト環境: bats-core
# 実行: bats tests/scripts/poll-pr-review.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../.." && pwd)/scripts/poll-pr-review.sh"

setup() {
    TMPDIR=$(mktemp -d)
    # タイムアウトを最小に設定してテストを速くする
    export POLL_PR_REVIEW_TIMEOUT_SECONDS=1
    export POLL_PR_REVIEW_INTERVAL_SECONDS=1
}

teardown() {
    rm -rf "$TMPDIR"
}

# gh コマンドをモックする共通ヘルパー
# $1: gh が返す JSON
mock_gh_with_json() {
    local json="$1"
    local fake_bin_dir="$TMPDIR/fake_bin"
    mkdir -p "$fake_bin_dir"
    cat > "$fake_bin_dir/gh" <<GHEOF
#!/usr/bin/env bash
printf '%s' '${json//\'/\'\\\'\'}'
GHEOF
    chmod +x "$fake_bin_dir/gh"
    export PATH="$fake_bin_dir:$PATH"
}

# @test: AC-1 - bot コメントに「全件 PASS」を含む場合 APPROVED を返すこと
@test "bot コメントに「全件 PASS」を含む場合 APPROVED を返せること" {
    # Arrange
    local json
    json=$(cat <<'EOF'
{
  "reviewDecision": null,
  "reviews": [],
  "comments": [
    {
      "author": {"login": "claude[bot]"},
      "body": "全件 PASS\n\n指摘事項はありません。",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
EOF
)
    mock_gh_with_json "$json"

    # Act
    run bash "$SCRIPT" "123"

    # Assert
    [ "$status" -eq 0 ]
    [[ "$output" == *"APPROVED"* ]]
}

# @test: AC-1 - bot コメントに「LGTM」を含む場合 APPROVED を返すこと
@test "bot コメントに「LGTM」を含む場合 APPROVED を返せること" {
    # Arrange
    local json
    json=$(cat <<'EOF'
{
  "reviewDecision": null,
  "reviews": [],
  "comments": [
    {
      "author": {"login": "claude[bot]"},
      "body": "LGTM\n\nマージして問題ありません。",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
EOF
)
    mock_gh_with_json "$json"

    # Act
    run bash "$SCRIPT" "123"

    # Assert
    [ "$status" -eq 0 ]
    [[ "$output" == *"APPROVED"* ]]
}

# @test: AC-2 - bot コメントに「🔄 Request Changes」を含む場合 CHANGES_REQUESTED を返すこと
@test "bot コメントに「🔄 Request Changes」を含む場合 CHANGES_REQUESTED を返せること" {
    # Arrange
    local json
    json=$(cat <<'EOF'
{
  "reviewDecision": null,
  "reviews": [],
  "comments": [
    {
      "author": {"login": "claude[bot]"},
      "body": "🔄 Request Changes\n\n- 指摘1: コードを修正してください",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
EOF
)
    mock_gh_with_json "$json"

    # Act
    run bash "$SCRIPT" "123"

    # Assert
    [ "$status" -eq 1 ]
    [[ "$output" == *"CHANGES_REQUESTED"* ]]
}

# @test: AC-2 - CHANGES_REQUESTED 時はコメント本文が出力されること
@test "CHANGES_REQUESTED 時にコメント本文が stdout に出力されること" {
    # Arrange
    local json
    json=$(cat <<'EOF'
{
  "reviewDecision": null,
  "reviews": [],
  "comments": [
    {
      "author": {"login": "claude[bot]"},
      "body": "🔄 Request Changes\n\n- 指摘1: コードを修正してください",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
EOF
)
    mock_gh_with_json "$json"

    # Act
    run bash "$SCRIPT" "123"

    # Assert
    [ "$status" -eq 1 ]
    [[ "$output" == *"Review Content"* ]]
}

# @test: AC-3 - 判定パターン非該当時は TIMEOUT（タイムアウト設定が短いため）
@test "判定パターン非該当のコメントの場合 TIMEOUT になること" {
    # Arrange
    local json
    json=$(cat <<'EOF'
{
  "reviewDecision": null,
  "reviews": [],
  "comments": [
    {
      "author": {"login": "claude[bot]"},
      "body": "レビュー中です。しばらくお待ちください。",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
EOF
)
    mock_gh_with_json "$json"

    # Act
    run bash "$SCRIPT" "123"

    # Assert
    [ "$status" -eq 2 ]
    [[ "$output" == *"TIMEOUT"* ]]
}

# @test: AC-4 - formal review APPROVED が最優先されること
@test "formal review が APPROVED の場合 bot コメントより優先して APPROVED を返せること" {
    # Arrange
    local json
    json=$(cat <<'EOF'
{
  "reviewDecision": "APPROVED",
  "reviews": [
    {
      "author": {"login": "reviewer1"},
      "state": "APPROVED",
      "body": "LGTM"
    }
  ],
  "comments": []
}
EOF
)
    mock_gh_with_json "$json"

    # Act
    run bash "$SCRIPT" "123"

    # Assert
    [ "$status" -eq 0 ]
    [[ "$output" == *"APPROVED"* ]]
}

# @test: AC-4 - formal review CHANGES_REQUESTED が最優先されること
@test "formal review が CHANGES_REQUESTED の場合 bot コメントより優先して CHANGES_REQUESTED を返せること" {
    # Arrange
    local json
    json=$(cat <<'EOF'
{
  "reviewDecision": "CHANGES_REQUESTED",
  "reviews": [
    {
      "author": {"login": "reviewer1"},
      "state": "CHANGES_REQUESTED",
      "body": "修正が必要です。"
    }
  ],
  "comments": [
    {
      "author": {"login": "claude[bot]"},
      "body": "全件 PASS",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
EOF
)
    mock_gh_with_json "$json"

    # Act
    run bash "$SCRIPT" "123"

    # Assert
    [ "$status" -eq 1 ]
    [[ "$output" == *"CHANGES_REQUESTED"* ]]
}

# @test: AC-5 - 絵文字・改行・特殊文字を含むコメントでもパースエラーが起きないこと
@test "絵文字や改行を含む bot コメントでも jq パースエラーが発生しないこと" {
    # Arrange
    local json
    json=$(cat <<'EOF'
{
  "reviewDecision": null,
  "reviews": [],
  "comments": [
    {
      "author": {"login": "claude[bot]"},
      "body": "✅ 全件 PASS\n\n## サマリー\n指摘0件\n\n```typescript\nconst x = 1;\n```\n\n🎉 マージ可能です",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
EOF
)
    mock_gh_with_json "$json"

    # Act
    run bash "$SCRIPT" "123"

    # Assert（APPROVED になりjqエラーで終了しないこと）
    [ "$status" -eq 0 ]
    [[ "$output" == *"APPROVED"* ]]
}

# @test: AC-6 - bot コメントが 0 件の場合 PENDING で TIMEOUT になること
@test "bot コメントが 0 件の場合 jq エラーなく TIMEOUT になること" {
    # Arrange
    local json
    json=$(cat <<'EOF'
{
  "reviewDecision": null,
  "reviews": [],
  "comments": []
}
EOF
)
    mock_gh_with_json "$json"

    # Act
    run bash "$SCRIPT" "123"

    # Assert
    [ "$status" -eq 2 ]
    [[ "$output" == *"TIMEOUT"* ]]
}

# @test: AC-6 - comments フィールド自体がない場合も TIMEOUT になること
@test "comments フィールドが存在しない場合も jq エラーなく TIMEOUT になること" {
    # Arrange
    local json
    json=$(cat <<'EOF'
{
  "reviewDecision": null,
  "reviews": []
}
EOF
)
    mock_gh_with_json "$json"

    # Act
    run bash "$SCRIPT" "123"

    # Assert
    [ "$status" -eq 2 ]
    [[ "$output" == *"TIMEOUT"* ]]
}

# @test: 最新のコメントのみが判定対象になること
@test "複数 bot コメントがある場合 最新（最後の）コメントのみが判定対象になること" {
    # Arrange: 古いコメントは APPROVED フレーズ、最新は CHANGES_REQUESTED フレーズ
    local json
    json=$(cat <<'EOF'
{
  "reviewDecision": null,
  "reviews": [],
  "comments": [
    {
      "author": {"login": "claude[bot]"},
      "body": "全件 PASS",
      "createdAt": "2024-01-01T00:00:00Z"
    },
    {
      "author": {"login": "claude[bot]"},
      "body": "🔄 Request Changes\n\n- 修正が必要です",
      "createdAt": "2024-01-02T00:00:00Z"
    }
  ]
}
EOF
)
    mock_gh_with_json "$json"

    # Act
    run bash "$SCRIPT" "123"

    # Assert: 最新コメントの CHANGES_REQUESTED が採用されること
    [ "$status" -eq 1 ]
    [[ "$output" == *"CHANGES_REQUESTED"* ]]
}

# @test: bot 以外のコメントは無視されること
@test "bot 以外のユーザーコメントは無視されること" {
    # Arrange: 一般ユーザーのコメントに APPROVED フレーズがあっても無視
    local json
    json=$(cat <<'EOF'
{
  "reviewDecision": null,
  "reviews": [],
  "comments": [
    {
      "author": {"login": "human-user"},
      "body": "全件 PASS だと思います",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ]
}
EOF
)
    mock_gh_with_json "$json"

    # Act
    run bash "$SCRIPT" "123"

    # Assert: bot コメントではないので PENDING → TIMEOUT
    [ "$status" -eq 2 ]
    [[ "$output" == *"TIMEOUT"* ]]
}
