#!/usr/bin/env bats
# evaluate-paths.sh の gate 判定テスト
#
# 実行: bats tests/scripts/gate/evaluate-paths.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/gate/evaluate-paths.sh"
RULES="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/.claude/gate-rules.json"

setup() {
  TMPDIR=$(mktemp -d)
  REPO_DIR="$TMPDIR/repo"
  mkdir -p "$REPO_DIR"
  git -C "$REPO_DIR" init -b main
  git -C "$REPO_DIR" config user.email "test@example.com"
  git -C "$REPO_DIR" config user.name "Test User"

  # gate-rules.json をコピー
  mkdir -p "$REPO_DIR/.claude"
  cp "$RULES" "$REPO_DIR/.claude/gate-rules.json"

  # initial commit
  echo "initial" > "$REPO_DIR/README.md"
  git -C "$REPO_DIR" add .
  git -C "$REPO_DIR" commit -m "initial"

  # origin/main として使えるように bare clone
  git clone --bare "$REPO_DIR" "$TMPDIR/origin.git" --quiet
  git -C "$REPO_DIR" remote add origin "$TMPDIR/origin.git"
  git -C "$REPO_DIR" fetch origin --quiet
  git -C "$REPO_DIR" branch --set-upstream-to=origin/main main 2>/dev/null || true
}

teardown() {
  rm -rf "$TMPDIR"
}

# ヘルパー: ファイルを追加してコミットし evaluate-paths.sh を実行する
# REPO_ROOT を temp repo に override して高速に実行する
add_and_run() {
  local file="$1"
  local content="${2:-content}"
  mkdir -p "$REPO_DIR/$(dirname "$file")"
  echo "$content" > "$REPO_DIR/$file"
  git -C "$REPO_DIR" add "$file"
  git -C "$REPO_DIR" commit -m "add $file" --quiet
  (cd "$REPO_DIR" && REPO_ROOT="$REPO_DIR" bash "$SCRIPT" origin/main)
}

# ─────────────────────────────────────────────────────────
# 1. 空 diff → review gate 不要・e2e skip
# ─────────────────────────────────────────────────────────
@test "空 diff: review_gate.required=false, e2e_gate.auto_skip=true" {
  # HEAD == origin/main なので diff がない
  git -C "$REPO_DIR" push origin main --quiet
  local out
  out=$(cd "$REPO_DIR" && REPO_ROOT="$REPO_DIR" bash "$SCRIPT" origin/main)
  echo "$out" | jq -e '.review_gate.required == false'
  echo "$out" | jq -e '.e2e_gate.auto_skip == true'
  echo "$out" | jq -e '.e2e_gate.skip_reason == "no_e2e_affecting_paths"'
}

# ─────────────────────────────────────────────────────────
# 2. テストのみ変更 → review 必要・e2e skip
# ─────────────────────────────────────────────────────────
@test "test-only diff: review_gate.required=true, e2e_gate.auto_skip=true" {
  local out
  out=$(add_and_run "tests/api/routes/auth.test.ts")
  echo "$out" | jq -e '.review_gate.required == true'
  echo "$out" | jq -e '.e2e_gate.auto_skip == true'
  echo "$out" | jq -e '.e2e_gate.skip_reason == "no_e2e_affecting_paths"'
}

# ─────────────────────────────────────────────────────────
# 3. mobile コンポーネント変更 → review 必要・e2e 必要
# ─────────────────────────────────────────────────────────
@test "mobile component: review_gate.required=true, e2e_gate.required=true, auto_skip=false" {
  local out
  out=$(add_and_run "apps/mobile/src/components/VideoCard.tsx")
  echo "$out" | jq -e '.review_gate.required == true'
  echo "$out" | jq -e '.e2e_gate.required == true'
  echo "$out" | jq -e '.e2e_gate.auto_skip == false'
}

# ─────────────────────────────────────────────────────────
# 4. workflow ファイル変更 → review 必要・e2e skip
# ─────────────────────────────────────────────────────────
@test "workflow change: review_gate.required=true, e2e_gate.auto_skip=true" {
  local out
  out=$(add_and_run ".github/workflows/ci.yml")
  echo "$out" | jq -e '.review_gate.required == true'
  echo "$out" | jq -e '.e2e_gate.auto_skip == true'
}

# ─────────────────────────────────────────────────────────
# 5. docs のみ変更 → review auto_pass=true
# ─────────────────────────────────────────────────────────
@test "docs-only diff: review_gate.required=false, e2e_gate.auto_skip=true" {
  # docs/** は review_required_paths に含まれないため review_required=false
  # (auto_pass_paths は review_required=true の場合に影響する)
  local out
  out=$(add_and_run "docs/design/overview.md")
  echo "$out" | jq -e '.review_gate.required == false'
  echo "$out" | jq -e '.e2e_gate.auto_skip == true'
}

# ─────────────────────────────────────────────────────────
# 6. infra-only diff (.claude/ 配下) → e2e skip
# ─────────────────────────────────────────────────────────
@test "infra-only diff (.claude/): e2e_gate.auto_skip=true" {
  local out
  out=$(add_and_run ".claude/agents/reviewer.md")
  echo "$out" | jq -e '.e2e_gate.auto_skip == true'
}

# ─────────────────────────────────────────────────────────
# 7. API アプリのみ変更 → e2e skip・ci_jobs に api_test を含む
# ─────────────────────────────────────────────────────────
@test "api-only change: e2e skip, ci_jobs includes api_test" {
  local out
  out=$(add_and_run "apps/api/src/routes/articles.ts")
  echo "$out" | jq -e '.e2e_gate.auto_skip == true'
  echo "$out" | jq -e '[.ci_jobs_needed[] | select(. == "api_test")] | length > 0'
}

# ─────────────────────────────────────────────────────────
# 8. maestro yaml 変更 → e2e 必要
# ─────────────────────────────────────────────────────────
@test "maestro yaml: e2e_gate.required=true, auto_skip=false" {
  local out
  out=$(add_and_run "tests/e2e/maestro/login.yaml")
  echo "$out" | jq -e '.e2e_gate.required == true'
  echo "$out" | jq -e '.e2e_gate.auto_skip == false'
}

# ─────────────────────────────────────────────────────────
# 9. mixed (mobile + api) → e2e 必要・両 ci_jobs
# ─────────────────────────────────────────────────────────
@test "mixed mobile+api: e2e required, ci_jobs has both mobile_test and api_test" {
  mkdir -p "$REPO_DIR/apps/mobile/src/components"
  echo "content1" > "$REPO_DIR/apps/mobile/src/components/Feed.tsx"
  mkdir -p "$REPO_DIR/apps/api/src/routes"
  echo "content2" > "$REPO_DIR/apps/api/src/routes/feed.ts"
  git -C "$REPO_DIR" add .
  git -C "$REPO_DIR" commit -m "mixed" --quiet
  local out
  out=$(cd "$REPO_DIR" && REPO_ROOT="$REPO_DIR" bash "$SCRIPT" origin/main)
  echo "$out" | jq -e '.e2e_gate.required == true'
  echo "$out" | jq -e '[.ci_jobs_needed[] | select(. == "mobile_test")] | length > 0'
  echo "$out" | jq -e '[.ci_jobs_needed[] | select(. == "api_test")] | length > 0'
}

# ─────────────────────────────────────────────────────────
# 10. locales 変更 → e2e 必要
# ─────────────────────────────────────────────────────────
@test "locales change: e2e_gate.required=true" {
  local out
  out=$(add_and_run "apps/mobile/src/locales/ja.json")
  echo "$out" | jq -e '.e2e_gate.required == true'
}

# ─────────────────────────────────────────────────────────
# 11. (#1138) stage branch での base_ref 自動判定が origin/main になること
# REPO_ROOT env var で temp repo を指定して高速に検証する。
# ─────────────────────────────────────────────────────────
@test "stage branch 上で base_ref 自動判定が origin/main になること" {
  # Arrange: origin を持つ temp repo を stage branch に設定
  git -C "$REPO_DIR" push origin main --quiet
  # stage branch を origin に push
  git -C "$REPO_DIR" checkout -b stage main 2>/dev/null
  git -C "$REPO_DIR" push origin stage:stage --quiet
  git -C "$REPO_DIR" fetch origin --quiet

  # Act: REPO_ROOT を temp repo に override して引数なしで実行
  local out
  out=$(REPO_ROOT="$REPO_DIR" bash "$SCRIPT")

  # Assert: stage branch → base_ref が origin/main になること
  echo "$out" | jq -e '.base_ref == "origin/main"'
}

# ─────────────────────────────────────────────────────────
# 12. (#1138) feature branch 上で origin/stage がある場合 base_ref が origin/stage になること
# ─────────────────────────────────────────────────────────
@test "feature branch 上で base_ref 自動判定が origin/stage になること" {
  # Arrange: origin/stage を作成してから feature branch に移動
  git -C "$REPO_DIR" push origin main --quiet
  git -C "$REPO_DIR" checkout -b stage main 2>/dev/null
  git -C "$REPO_DIR" push origin stage:stage --quiet
  git -C "$REPO_DIR" fetch origin --quiet
  git -C "$REPO_DIR" checkout -b feature/test-auto main 2>/dev/null

  # Act: REPO_ROOT を temp repo に override して引数なしで実行
  local out
  out=$(REPO_ROOT="$REPO_DIR" bash "$SCRIPT")

  # Assert: origin/stage が存在 → base_ref が origin/stage になること
  echo "$out" | jq -e '.base_ref == "origin/stage"'
}

# ─────────────────────────────────────────────────────────
# 13. (#1138) feature branch 上で origin/stage がない場合 origin/main にフォールバックすること
# ─────────────────────────────────────────────────────────
@test "feature branch 上で origin/stage が存在しない場合 origin/main にフォールバックすること" {
  # Arrange: origin/stage を作らずに feature branch で作業
  git -C "$REPO_DIR" push origin main --quiet
  git -C "$REPO_DIR" checkout -b feature/no-stage main 2>/dev/null

  # Act: REPO_ROOT を temp repo に override (origin/stage が存在しない)
  local out
  out=$(REPO_ROOT="$REPO_DIR" bash "$SCRIPT")

  # Assert: origin/main にフォールバック
  echo "$out" | jq -e '.base_ref == "origin/main"'
}

# ─────────────────────────────────────────────────────────
# 14. (#1138) BASE_REF 環境変数で base_ref を override できること
# ─────────────────────────────────────────────────────────
@test "BASE_REF 環境変数で base_ref を override できること" {
  # Arrange: temp repo を push して empty diff にする
  git -C "$REPO_DIR" push origin main --quiet

  # Act: BASE_REF 環境変数で origin/main を明示 (引数なし)
  local out
  out=$(REPO_ROOT="$REPO_DIR" BASE_REF=origin/main bash "$SCRIPT")

  # Assert: base_ref が override された値になること
  echo "$out" | jq -e '.base_ref == "origin/main"'
}
