#!/usr/bin/env bats
bats_require_minimum_version 1.5.0
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/skills/spawn-prepare.sh"

@test "spawn-prepare: zone 衝突最終ガードのコードが存在する" {
  grep -q "list-active-zones.sh" "$SCRIPT"
  grep -q "detect-issue-zones.sh" "$SCRIPT"
  grep -q "zone conflict detected" "$SCRIPT"
}

@test "spawn-prepare: --exclude-issue で自分を除外する" {
  grep -q -- "--exclude-issue" "$SCRIPT"
}

# zone 衝突時に exit 1 で終了すること
@test "spawn-prepare: zone 衝突が発生した場合は exit 1 で中断する" {
  # Arrange: tmpdir に skills/ サブディレクトリを作り、spawn-prepare.sh をそこに配置
  FAKE_SKILLS="$BATS_TEST_TMPDIR/skills"
  mkdir -p "$FAKE_SKILLS"

  # spawn-prepare.sh を skills/ の親ディレクトリ（= SCRIPT_DIR 相当）にコピー
  # SCRIPT_DIR = dirname(spawn-prepare.sh) → "$BATS_TEST_TMPDIR"
  # "$SCRIPT_DIR/list-active-zones.sh" = "$BATS_TEST_TMPDIR/list-active-zones.sh"
  cp "$SCRIPT" "$BATS_TEST_TMPDIR/spawn-prepare.sh"

  # list-active-zones stub: api-auth が active
  cat > "$BATS_TEST_TMPDIR/list-active-zones.sh" << 'EOF'
#!/usr/bin/env bash
echo '{"active_issues":[9999],"active_zones":["api-auth"]}'
EOF
  chmod +x "$BATS_TEST_TMPDIR/list-active-zones.sh"

  # detect-issue-zones stub: api-auth を返す（衝突する）
  cat > "$BATS_TEST_TMPDIR/detect-issue-zones.sh" << 'EOF'
#!/usr/bin/env bash
echo '{"issue":1,"zones":["api-auth"]}'
EOF
  chmod +x "$BATS_TEST_TMPDIR/detect-issue-zones.sh"

  # Act
  run bash "$BATS_TEST_TMPDIR/spawn-prepare.sh" 1 "test-desc"

  # Assert: zone 衝突があれば exit 1
  [ "$status" -eq 1 ]
  echo "$output" | grep -q "zone conflict detected"
}

# zone 衝突なし（active zone が空）の場合は zone チェックを通過すること
@test "spawn-prepare: zone 衝突がない場合は zone チェックを通過する" {
  # Arrange
  FAKE_SKILLS="$BATS_TEST_TMPDIR/skills"
  mkdir -p "$FAKE_SKILLS"
  cp "$SCRIPT" "$BATS_TEST_TMPDIR/spawn-prepare.sh"

  # list-active-zones stub: active zone なし
  cat > "$BATS_TEST_TMPDIR/list-active-zones.sh" << 'EOF'
#!/usr/bin/env bash
echo '{"active_issues":[],"active_zones":[]}'
EOF
  chmod +x "$BATS_TEST_TMPDIR/list-active-zones.sh"

  # detect-issue-zones stub: api-auth を返すが active と衝突しない
  cat > "$BATS_TEST_TMPDIR/detect-issue-zones.sh" << 'EOF'
#!/usr/bin/env bash
echo '{"issue":1,"zones":["api-auth"]}'
EOF
  chmod +x "$BATS_TEST_TMPDIR/detect-issue-zones.sh"

  # decide-shard-total stub
  cat > "$BATS_TEST_TMPDIR/decide-shard-total.sh" << 'EOF'
#!/usr/bin/env bash
echo "2"
EOF
  chmod +x "$BATS_TEST_TMPDIR/decide-shard-total.sh"

  # create-worktree.sh stub（REPO_ROOT/../issue-1 を作成して終了）
  WORKTREE_DIR="$(dirname "$BATS_TEST_TMPDIR")/issue-1"
  mkdir -p "$WORKTREE_DIR"

  # gh stub
  FAKE_BIN="$BATS_TEST_TMPDIR/fake_bin"
  mkdir -p "$FAKE_BIN"
  cat > "$FAKE_BIN/gh" << 'EOF'
#!/usr/bin/env bash
echo '{"title":"test","body":"","labels":[]}'
EOF
  chmod +x "$FAKE_BIN/gh"

  # Act: zone チェックを通過するかを確認（exit 1 かつ zone conflict メッセージなければ通過）
  run -127 bash -c "PATH='$FAKE_BIN:$PATH' bash '$BATS_TEST_TMPDIR/spawn-prepare.sh' 1 'test-desc'"

  # Assert: zone conflict で中断していないこと
  if [ "$status" -eq 1 ]; then
    ! echo "$output" | grep -q "zone conflict detected"
  else
    true
  fi
}
