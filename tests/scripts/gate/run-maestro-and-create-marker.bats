#!/usr/bin/env bats

@test "MAESTRO_PORT 変数を使っていない（Maestro 内部のポート管理に委ねる）" {
  ! grep -E '^\s*MAESTRO_PORT=' scripts/gate/run-maestro-and-create-marker.sh
}

@test "手動 adb forward を行わない（Maestro が内部で処理）" {
  ! grep -E 'adb (-s "\$DEVICE" )?forward tcp:' scripts/gate/run-maestro-and-create-marker.sh
}

@test "am instrument による maestro driver 手動起動を行わない" {
  ! grep -E 'am instrument -w dev\.mobile\.maestro' scripts/gate/run-maestro-and-create-marker.sh
}

@test "shard-flows.sh を呼び出さない（Maestro --shard-split が内部分配する）" {
  ! grep -E 'scripts/ci/shard-flows\.sh' scripts/gate/run-maestro-and-create-marker.sh
}

@test "--shard all/N 形式が受け入れられる仕様を持つ" {
  grep -F 'all/N' scripts/gate/run-maestro-and-create-marker.sh
}

@test "DEVICE が空のとき adb devices で全 emulator を自動検出してカンマ結合する" {
  grep -E 'adb devices' scripts/gate/run-maestro-and-create-marker.sh
  grep -E 'IFS=,' scripts/gate/run-maestro-and-create-marker.sh
}

@test "DEVICE_COUNT > 1 のとき --shard-split を付ける" {
  grep -E 'SHARD_SPLIT_ARGS\+=\("--shard-split"' scripts/gate/run-maestro-and-create-marker.sh
}

@test "maestro test に --device を必ず渡す" {
  grep -F -- '--device "$DEVICE"' scripts/gate/run-maestro-and-create-marker.sh
}

@test "DEVICE 指定時は自分の emulator のみ pm clear する（並列実行で他 shard に影響を与えない）" {
  grep -E 'pm clear' scripts/gate/run-maestro-and-create-marker.sh
}

@test "create-e2e-marker.sh を呼び出して .e2e-passed を生成する（all モード共通）" {
  grep -E 'create-e2e-marker\.sh' scripts/gate/run-maestro-and-create-marker.sh
}

@test ".claude/.e2e-shard-<N>of<TOTAL>.json の手動書き出しを行わない（Maestro 1 プロセス内並列のため）" {
  ! grep -E '\.claude/\.e2e-shard-' scripts/gate/run-maestro-and-create-marker.sh
}

@test "adb devices で 0 台のときエラー終了する" {
  grep -E 'no emulator detected|ERROR.*emulator' scripts/gate/run-maestro-and-create-marker.sh
}

@test "--shard all/N の N が DEVICE_COUNT と一致しない場合エラー終了する" {
  grep -E 'SHARD_TOTAL.*DEVICE_COUNT|DEVICE_COUNT.*SHARD_TOTAL' scripts/gate/run-maestro-and-create-marker.sh
}

@test "Maestro stdout をログファイルに tee する" {
  grep -E 'tee "\$LOG_FILE"' scripts/gate/run-maestro-and-create-marker.sh
}

@test ".e2e-progress.json を Maestro 起動前に status=running で書き出す" {
  grep -F '"running"' scripts/gate/run-maestro-and-create-marker.sh
  grep -F '.e2e-progress.json' scripts/gate/run-maestro-and-create-marker.sh
}

@test ".e2e-progress.json に log_file / result_xml / flow_count を含む" {
  grep -F 'log_file' scripts/gate/run-maestro-and-create-marker.sh
  grep -F 'result_xml' scripts/gate/run-maestro-and-create-marker.sh
  grep -F 'flow_count' scripts/gate/run-maestro-and-create-marker.sh
}

@test "Maestro 完了後に .e2e-progress.json を status=completed に更新する" {
  grep -F '"completed"' scripts/gate/run-maestro-and-create-marker.sh
}

@test "maestro test 実行前に JAVA_TOOL_OPTIONS で preferIPv4Stack=true を設定する" {
  grep -E 'JAVA_TOOL_OPTIONS.*preferIPv4Stack=true' scripts/gate/run-maestro-and-create-marker.sh
}
