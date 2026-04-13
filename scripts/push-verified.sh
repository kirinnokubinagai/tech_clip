#!/usr/bin/env bash
set -euo pipefail

LOCAL_SHA=$(git rev-parse HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)

echo "Pushing branch: ${BRANCH} (${LOCAL_SHA})"

git push origin HEAD

git fetch origin "${BRANCH}"
REMOTE_SHA=$(git rev-parse "origin/${BRANCH}")

if [ "${LOCAL_SHA}" = "${REMOTE_SHA}" ]; then
  echo "✅ Push verified: ${LOCAL_SHA}"
else
  echo "❌ Push verification failed"
  echo "  Local:  ${LOCAL_SHA}"
  echo "  Remote: ${REMOTE_SHA}"
  exit 1
fi
