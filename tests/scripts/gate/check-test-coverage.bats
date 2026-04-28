#!/usr/bin/env bats
# check-test-coverage.sh のテストカバレッジ確認テスト
#
# 実行: bats tests/scripts/gate/check-test-coverage.bats

REAL_SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/gate/check-test-coverage.sh"
SCRIPT="$REAL_SCRIPT"
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

run_script_staged() {
  run bash "$SCRIPT" --staged
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

# --- staged モード (C-9a) ---

# テスト 7: --staged + staging に source のみ (test なし) → FAIL
@test "--staged: staging に source のみで test が staging されていない場合は FAIL" {
  mkdir -p "$REPO_DIR/apps/api/src/services"
  echo "export function newService() {}" > "$REPO_DIR/apps/api/src/services/new-staged.ts"
  git -C "$REPO_DIR" add "$REPO_DIR/apps/api/src/services/new-staged.ts"

  cd "$REPO_DIR"
  run_script_staged

  [ "$status" -eq 1 ]
  echo "$output" | grep -q "test"
}

# テスト 8: --staged + staging に source + 対応 test → PASS
@test "--staged: staging に source と対応 test が両方含まれる場合は PASS" {
  mkdir -p "$REPO_DIR/apps/api/src/services"
  echo "export function stagedService() {}" > "$REPO_DIR/apps/api/src/services/staged-svc.ts"
  mkdir -p "$REPO_DIR/tests/api/services"
  echo "// test stub" > "$REPO_DIR/tests/api/services/staged-svc.test.ts"
  git -C "$REPO_DIR" add "$REPO_DIR/apps/api/src/services/staged-svc.ts"
  git -C "$REPO_DIR" add "$REPO_DIR/tests/api/services/staged-svc.test.ts"

  cd "$REPO_DIR"
  run_script_staged

  [ "$status" -eq 0 ]
  echo "$output" | grep -q '"covered": true'
}

# テスト 9: --staged なし (既存挙動) は後方互換 → 正常動作
@test "--staged なし (既存モード) は後方互換を維持する" {
  add_file "apps/api/src/services/compat.ts" "export function compat() {}"
  add_file "tests/api/services/compat.test.ts" "// test"
  commit_all

  cd "$REPO_DIR"
  run_script

  [ "$status" -eq 0 ]
  echo "$output" | grep -q '"covered": true'
}

# ─────────────────────────────────────────────────────────
# (#1138) base_ref 自動判定テスト
# ─────────────────────────────────────────────────────────

# テスト 10: stage branch 上での auto base_ref 判定 → origin/main と diff を取る
@test "stage branch 上では引数なしで origin/main を base_ref として使うこと" {
  # Arrange: origin/main に push してから stage branch に切り替え
  git -C "$REPO_DIR" push origin main --quiet
  git -C "$REPO_DIR" checkout -b stage main 2>/dev/null
  git -C "$REPO_DIR" push origin stage:stage --quiet
  git -C "$REPO_DIR" fetch origin --quiet

  # stage branch でファイルを追加 (test あり)
  add_file "scripts/gate/new-tool.sh" "#!/bin/bash\necho hi"
  add_file "tests/scripts/gate/new-tool.bats" "#!/usr/bin/env bats\n@test 'works' { true; }"
  commit_all

  # Act: 引数なしで実行 (auto-detect)
  cd "$REPO_DIR"
  run bash "$SCRIPT"

  # Assert: origin/main ベースで diff が取れて PASS すること
  [ "$status" -eq 0 ]
  echo "$output" | grep -q '"covered": true'
}

# テスト 11: feature branch 上で origin/stage がある場合 → origin/stage を base_ref として使う
@test "feature branch 上で origin/stage がある場合は引数なしで origin/stage を base_ref として使うこと" {
  # Arrange: origin/stage を作成してから feature branch に移動
  git -C "$REPO_DIR" push origin main --quiet
  git -C "$REPO_DIR" checkout -b stage main 2>/dev/null
  git -C "$REPO_DIR" push origin stage:stage --quiet
  git -C "$REPO_DIR" fetch origin --quiet
  git -C "$REPO_DIR" checkout -b feature/test-coverage main 2>/dev/null

  # feature branch でファイルを追加 (test あり)
  add_file "scripts/gate/feat-tool.sh" "#!/bin/bash\necho hi"
  add_file "tests/scripts/gate/feat-tool.bats" "#!/usr/bin/env bats\n@test 'works' { true; }"
  commit_all

  # Act: 引数なしで実行 (auto-detect → origin/stage 基準)
  cd "$REPO_DIR"
  run bash "$SCRIPT"

  # Assert: origin/stage ベースで diff が取れて PASS すること
  [ "$status" -eq 0 ]
  echo "$output" | grep -q '"covered": true'
}
