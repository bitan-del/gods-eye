#!/usr/bin/env bash
set -euo pipefail

cd /repo

export GODSEYE_STATE_DIR="/tmp/godseye-test"
export GODSEYE_CONFIG_PATH="${GODSEYE_STATE_DIR}/godseye.json"

echo "==> Build"
pnpm build

echo "==> Seed state"
mkdir -p "${GODSEYE_STATE_DIR}/credentials"
mkdir -p "${GODSEYE_STATE_DIR}/agents/main/sessions"
echo '{}' >"${GODSEYE_CONFIG_PATH}"
echo 'creds' >"${GODSEYE_STATE_DIR}/credentials/marker.txt"
echo 'session' >"${GODSEYE_STATE_DIR}/agents/main/sessions/sessions.json"

echo "==> Reset (config+creds+sessions)"
pnpm godseye reset --scope config+creds+sessions --yes --non-interactive

test ! -f "${GODSEYE_CONFIG_PATH}"
test ! -d "${GODSEYE_STATE_DIR}/credentials"
test ! -d "${GODSEYE_STATE_DIR}/agents/main/sessions"

echo "==> Recreate minimal config"
mkdir -p "${GODSEYE_STATE_DIR}/credentials"
echo '{}' >"${GODSEYE_CONFIG_PATH}"

echo "==> Uninstall (state only)"
pnpm godseye uninstall --state --yes --non-interactive

test ! -d "${GODSEYE_STATE_DIR}"

echo "OK"
