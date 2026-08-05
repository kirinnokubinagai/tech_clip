#!/usr/bin/env bash
# Materialize the public OTA certificate required by Expo config without
# persisting the private signing key in the worktree or EAS build archive.
set -euo pipefail

if [[ -z "${OTA_UPDATE_CERTIFICATE:-}" && -z "${OTA_UPDATE_PRIVATE_KEY:-}" ]]; then
  echo "::error::OTA_UPDATE_CERTIFICATE or OTA_UPDATE_PRIVATE_KEY is required to build with OTA code signing enabled." >&2
  exit 1
fi

CERT_DIR="${1:-apps/mobile/certs}"
mkdir -p "$CERT_DIR"
private_key="$CERT_DIR/private-key.pem"
certificate="$CERT_DIR/certificate.pem"

cleanup() {
  rm -f "$private_key"
}
trap cleanup EXIT

umask 077
if [[ -n "${OTA_UPDATE_CERTIFICATE:-}" ]]; then
  printf '%s' "$OTA_UPDATE_CERTIFICATE" > "$certificate"
else
  printf '%s' "$OTA_UPDATE_PRIVATE_KEY" > "$private_key"
  openssl req -new -x509 \
    -key "$private_key" \
    -out "$certificate" \
    -days 3650 \
    -subj "/CN=TechClip OTA Signing" \
    >/dev/null 2>&1
fi
chmod 0644 "$certificate"
printf 'OTA signing certificate prepared at %s\n' "$certificate"
