#!/usr/bin/env bats
# check-test-coverage.sh のテストカバレッジ確認テスト
#
# 実行: bats tests/scripts/gate/check-test-coverage.bats

SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/gate/check-test-coverage.sh"
RULES="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/.claude/gate-rules.json"

setup() {
  TMPDIR=$(mktemp -d)
  REPO_DIR="$TMPDIR/repo"
  mkdir -p "$REPO_DIR"
  git -C "$REPO_DIR" init -b main
  git -C "$REPO_DIR" config user.email "test@example.com"
  git -C "$REPO_DIR" config user.name "Test User"

  mkdir -p "$REPO_DIR/.claude"
  cp "$RULES" "$REPO_DIR/.claude/gate-rules.json"

  echo "initial" > "$REPO_DIR/README.md"
  git -C "$REPO_DIR" add .
  git -C "$REPO_DIR" commit -m "initial"

  git clone --bare "$REPO_DIR" "$TMPDIR/origin.git" --quiet
  git -C "$REPO_DIR" remote add origin "$TMPDIR/origin.git"
  git -C "$REPO_DIR" fetch origin --quiet
  git -C "$REPO_DIR" branch --set-upstream-to=origin/main main 2>/dev/null || true
}

teardown() {
  rm -rf "$TMPDIR"
}

# ヘルパー: ファイルを追加してコミットする
add_file() {
  local file="$1"
  local content="${2:-content}"
  local dir
  dir=$(dirname "$REPO_DIR/$file")
  mkdir -p "$dir"
  echo "$content" > "$REPO_DIR/$file"
  git -C "$REPO_DIR" add "$REPO_DIR/$file"
}

commit_all() {
  git -C "$REPO_DIR" commit -m "test commit" --allow-empty
}

run_script() {
  run bash "$SCRIPT" origin/main
}

# テスト 1: ソースファイル + 対応 test ファイルを同時に追加 → PASS
@test "ソースファイルと test ファイルを同時に追加した場合は PASS" {
  add_file "apps/api/src/services/clip.ts" "export function clip() {}"
  add_file "tests/api/services/clip.test.ts" "import { clip } from '../../../apps/api/src/services/clip'"
  commit_all

  cd "$REPO_DIR"
  run_script

  [ "$status" -eq 0 ]
  echo "$output" | grep -q '"covered": true'
}

# テスト 2: ソースファイルのみ追加 (test なし) → FAIL
@test "新規ソースファイルに対応 test がない場合は FAIL" {
  add_file "apps/api/src/services/article.ts" "export function getArticle() {}"
  commit_all

  cd "$REPO_DIR"
  run_script

  [ "$status" -eq 1 ]
  echo "$output" | grep -q "test"
}

# テスト 3: exempt パスのみ変更 → PASS
@test "exempt パス (index.ts) のみの変更は PASS" {
  add_file "apps/api/src/services/index.ts" "export * from './clip'"
  commit_all

  cd "$REPO_DIR"
  run_script

  [ "$status" -eq 0 ]
  echo "$output" | grep -q '"covered": true'
}

# テスト 4: 既存ソースを変更 + test ファイルも変更 → PASS
@test "既存ソース変更 + test ファイルも変更した場合は PASS" {
  # initial commit でファイルを用意 (origin/main に push)
  mkdir -p "$REPO_DIR/apps/api/src/services"
  echo "export function getUser() {}" > "$REPO_DIR/apps/api/src/services/user.ts"
  mkdir -p "$REPO_DIR/tests/api/services"
  echo "import {getUser} from '../../../apps/api/src/services/user'" > "$REPO_DIR/tests/api/services/user.test.ts"
  git -C "$REPO_DIR" add .
  git -C "$REPO_DIR" commit -m "add user service"
  git -C "$REPO_DIR" push origin main --quiet

  # ソースと test を両方変更
  echo "export function getUser() { return null; }" > "$REPO_DIR/apps/api/src/services/user.ts"
  echo "// updated test" >> "$REPO_DIR/tests/api/services/user.test.ts"
  git -C "$REPO_DIR" add .
  commit_all

  cd "$REPO_DIR"
  run_script

  [ "$status" -eq 0 ]
  echo "$output" | grep -q '"covered": true'
}

# テスト 5: 既存ソースを変更 + test は変更しないが disk 上に存在 → PASS
@test "既存ソース変更で test は変更しなくても disk に test があれば PASS" {
  # initial commit でファイルを用意 (origin/main に push)
  mkdir -p "$REPO_DIR/apps/api/src/services"
  echo "export function getPost() {}" > "$REPO_DIR/apps/api/src/services/post.ts"
  mkdir -p "$REPO_DIR/tests/api/services"
  echo "import {getPost} from '../../../apps/api/src/services/post'" > "$REPO_DIR/tests/api/services/post.test.ts"
  git -C "$REPO_DIR" add .
  git -C "$REPO_DIR" commit -m "add post service"
  git -C "$REPO_DIR" push origin main --quiet

  # ソースのみ変更 (test は手を加えない)
  echo "export function getPost() { return []; }" > "$REPO_DIR/apps/api/src/services/post.ts"
  git -C "$REPO_DIR" add .
  commit_all

  cd "$REPO_DIR"
  run_script

  [ "$status" -eq 0 ]
  echo "$output" | grep -q '"covered": true'
}

# テスト 6: 削除のみ → PASS
@test "ファイル削除のみの変更は PASS" {
  # origin/main にファイルを配置
  mkdir -p "$REPO_DIR/apps/api/src/services"
  echo "export function oldService() {}" > "$REPO_DIR/apps/api/src/services/old.ts"
  mkdir -p "$REPO_DIR/tests/api/services"
  echo "// old test" > "$REPO_DIR/tests/api/services/old.test.ts"
  git -C "$REPO_DIR" add .
  git -C "$REPO_DIR" commit -m "add old service"
  git -C "$REPO_DIR" push origin main --quiet

  # 削除
  git -C "$REPO_DIR" rm "$REPO_DIR/apps/api/src/services/old.ts"
  commit_all

  cd "$REPO_DIR"
  run_script

  [ "$status" -eq 0 ]
  echo "$output" | grep -q '"covered": true'
}
