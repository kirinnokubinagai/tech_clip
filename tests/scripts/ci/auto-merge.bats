#!/usr/bin/env bats

SCRIPT="$BATS_TEST_DIRNAME/../../../scripts/ci/auto-merge.sh"

setup() {
  FAKE_BIN="$BATS_TEST_TMPDIR/bin"
  mkdir -p "$FAKE_BIN"
  GH_LOG="$BATS_TEST_TMPDIR/gh.log"
  export FAKE_BIN GH_LOG
}

create_fake_gh() {
  cat > "$FAKE_BIN/gh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

if [[ "$1" == "pr" && "$2" == "view" ]]; then
  auto_json=null
  if [[ "${FAKE_AUTO:-false}" == "true" ]]; then
    auto_json='{}'
  fi
  printf '{"state":"OPEN","mergeStateStatus":"CLEAN","autoMergeRequest":%s,"isDraft":false,"headRefOid":"test-head"}\n' "$auto_json"
elif [[ "$1" == "run" && "$2" == "list" ]]; then
  printf '%s:%s\n' "${FAKE_RUN_STATUS:-completed}" "${FAKE_RUN_CONCLUSION:-}"
elif [[ "$1" == "pr" && "$2" == "merge" ]]; then
  printf '%s\n' "$*" >> "$GH_LOG"
else
  printf 'unexpected gh invocation: %s\n' "$*" >&2
  exit 1
fi
EOF
  chmod +x "$FAKE_BIN/gh"
}

@test "Android E2E failure blocks merge" {
  create_fake_gh

  run env PATH="$FAKE_BIN:$PATH" GH_TOKEN=test PR_NUMBER=1 REPO=example/repo \
    FAKE_RUN_STATUS=completed FAKE_RUN_CONCLUSION=failure FAKE_AUTO=false \
    bash "$SCRIPT"

  [ "$status" -ne 0 ]
  [ ! -s "$GH_LOG" ]
  [[ "$output" == *"Android E2E did not pass"* ]]
}

@test "Android E2E success permits direct merge" {
  create_fake_gh

  run env PATH="$FAKE_BIN:$PATH" GH_TOKEN=test PR_NUMBER=1 REPO=example/repo \
    FAKE_RUN_STATUS=completed FAKE_RUN_CONCLUSION=success FAKE_AUTO=false \
    bash "$SCRIPT"

  [ "$status" -eq 0 ]
  [[ "$(cat "$GH_LOG")" == *"--squash"* ]]
}

@test "already-enabled auto-merge is disabled after E2E failure" {
  create_fake_gh

  run env PATH="$FAKE_BIN:$PATH" GH_TOKEN=test PR_NUMBER=1 REPO=example/repo \
    FAKE_RUN_STATUS=completed FAKE_RUN_CONCLUSION=failure FAKE_AUTO=true \
    bash "$SCRIPT"

  [ "$status" -ne 0 ]
  [[ "$(cat "$GH_LOG")" == *"--disable-auto"* ]]
}
