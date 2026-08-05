#!/usr/bin/env bats
SCRIPT="$(cd "$(dirname "$BATS_TEST_FILENAME")/../../.." && pwd)/scripts/ci/verify-eas-build-json.py"

setup() {
  TMP_DIR="$(mktemp -d)"
}

teardown() {
  rm -rf "$TMP_DIR"
}

@test "verify-eas-build-json accepts a finished build with an artifact" {
  printf '%s\n' '{"id":"build-1","platform":"android","status":"finished","artifacts":{"buildUrl":"https://expo.dev/artifacts/build-1"}}' > "$TMP_DIR/build.json"

  run python3 "$SCRIPT" "$TMP_DIR/build.json" android

  [ "$status" -eq 0 ]
  [[ "$output" == *"Verified EAS android build build-1"* ]]
}

@test "verify-eas-build-json rejects a finished build without an artifact" {
  printf '%s\n' '{"id":"build-2","platform":"android","status":"finished","artifacts":{}}' > "$TMP_DIR/build.json"

  run python3 "$SCRIPT" "$TMP_DIR/build.json" android

  [ "$status" -ne 0 ]
  [[ "$output" == *"no downloadable artifact URL"* ]]
}

@test "verify-eas-build-json rejects a non-finished build" {
  printf '%s\n' '{"id":"build-3","platform":"ios","status":"errored"}' > "$TMP_DIR/build.json"

  run python3 "$SCRIPT" "$TMP_DIR/build.json" ios

  [ "$status" -ne 0 ]
  [[ "$output" == *"did not finish"* ]]
}
