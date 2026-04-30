#!/usr/bin/env bats

@test "cleanup-e2e-artifacts.sh が実行可能である" {
  [ -x scripts/gate/cleanup-e2e-artifacts.sh ]
}

@test ".claude/.e2e-debug.json が存在するとき削除される" {
  touch ".claude/.e2e-debug.json"
  bash scripts/gate/cleanup-e2e-artifacts.sh
  [ ! -f ".claude/.e2e-debug.json" ]
}

@test ".claude/.e2e-progress.json が存在するとき削除される" {
  touch ".claude/.e2e-progress.json"
  bash scripts/gate/cleanup-e2e-artifacts.sh
  [ ! -f ".claude/.e2e-progress.json" ]
}

@test ".claude/.e2e-debug-shard*.json が存在するとき削除される" {
  touch ".claude/.e2e-debug-shard0.json"
  touch ".claude/.e2e-debug-shard1.json"
  bash scripts/gate/cleanup-e2e-artifacts.sh
  [ ! -f ".claude/.e2e-debug-shard0.json" ]
  [ ! -f ".claude/.e2e-debug-shard1.json" ]
}

@test "対象ファイルが存在しないときエラーにならない" {
  bash scripts/gate/cleanup-e2e-artifacts.sh
  [ $? -eq 0 ]
}

@test "--tmp オプションで /tmp/maestro-log-* が削除される" {
  touch "/tmp/maestro-log-cleanup-test-$$.log"
  bash scripts/gate/cleanup-e2e-artifacts.sh --tmp
  [ ! -f "/tmp/maestro-log-cleanup-test-$$.log" ]
}

@test "--tmp オプションで /tmp/maestro-result-* が削除される" {
  touch "/tmp/maestro-result-cleanup-test-$$.xml"
  bash scripts/gate/cleanup-e2e-artifacts.sh --tmp
  [ ! -f "/tmp/maestro-result-cleanup-test-$$.xml" ]
}

@test "--tmp オプションで /tmp/maestro-debug-* が削除される" {
  mkdir -p "/tmp/maestro-debug-cleanup-test-$$"
  bash scripts/gate/cleanup-e2e-artifacts.sh --tmp
  [ ! -d "/tmp/maestro-debug-cleanup-test-$$" ]
}

@test "--tmp なしで /tmp は削除されない" {
  touch "/tmp/maestro-log-noclean-$$.log"
  bash scripts/gate/cleanup-e2e-artifacts.sh
  [ -f "/tmp/maestro-log-noclean-$$.log" ]
  rm "/tmp/maestro-log-noclean-$$.log"
}

@test "複数ファイルを同時に削除できる" {
  touch ".claude/.e2e-debug.json"
  touch ".claude/.e2e-progress.json"
  touch "/tmp/maestro-log-multi-$$.log"
  bash scripts/gate/cleanup-e2e-artifacts.sh --tmp
  [ ! -f ".claude/.e2e-debug.json" ]
  [ ! -f ".claude/.e2e-progress.json" ]
  [ ! -f "/tmp/maestro-log-multi-$$.log" ]
}
