#!/usr/bin/env bats

@test "shard index ごとに異なるポートフォワードを使う (shard 1 → 7001, shard 2 → 7002)" {
  grep -E 'MAESTRO_PORT=\$\(\(7000 \+ SHARD_INDEX\)\)' scripts/gate/run-maestro-and-create-marker.sh
}

@test "ポートフォワードに MAESTRO_PORT 変数を使っている" {
  grep -E 'forward tcp:\$MAESTRO_PORT tcp:7001' scripts/gate/run-maestro-and-create-marker.sh
}

@test "maestro test コマンドに --port フラグを使っていない（Maestro 2.4.x には存在しないフラグ）" {
  ! grep -E -- '--port ' scripts/gate/run-maestro-and-create-marker.sh
}

@test "DEVICE 指定時は自分の emulator のみ pm clear する" {
  grep -E 'if \[ -n "\$DEVICE" \]' scripts/gate/run-maestro-and-create-marker.sh
  grep -E 'adb -s "\$DEVICE" shell pm clear' scripts/gate/run-maestro-and-create-marker.sh
}

@test "DEVICE 未指定時（シングル実行）は全 emulator を pm clear する（後方互換）" {
  grep -E "# device 未指定時のみ全 emulator をクリア" scripts/gate/run-maestro-and-create-marker.sh
}
