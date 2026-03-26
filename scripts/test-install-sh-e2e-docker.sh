#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE_NAME="${GODSEYE_INSTALL_E2E_IMAGE:-godseye-install-e2e:local}"
INSTALL_URL="${GODSEYE_INSTALL_URL:-https://godseye.bot/install.sh}"

OPENAI_API_KEY="${OPENAI_API_KEY:-}"
ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-}"
ANTHROPIC_API_TOKEN="${ANTHROPIC_API_TOKEN:-}"
GODSEYE_E2E_MODELS="${GODSEYE_E2E_MODELS:-}"

echo "==> Build image: $IMAGE_NAME"
docker build \
  -t "$IMAGE_NAME" \
  -f "$ROOT_DIR/scripts/docker/install-sh-e2e/Dockerfile" \
  "$ROOT_DIR/scripts/docker/install-sh-e2e"

echo "==> Run E2E installer test"
docker run --rm \
  -e GODSEYE_INSTALL_URL="$INSTALL_URL" \
  -e GODSEYE_INSTALL_TAG="${GODSEYE_INSTALL_TAG:-latest}" \
  -e GODSEYE_E2E_MODELS="$GODSEYE_E2E_MODELS" \
  -e GODSEYE_INSTALL_E2E_PREVIOUS="${GODSEYE_INSTALL_E2E_PREVIOUS:-}" \
  -e GODSEYE_INSTALL_E2E_SKIP_PREVIOUS="${GODSEYE_INSTALL_E2E_SKIP_PREVIOUS:-0}" \
  -e OPENAI_API_KEY="$OPENAI_API_KEY" \
  -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  -e ANTHROPIC_API_TOKEN="$ANTHROPIC_API_TOKEN" \
  "$IMAGE_NAME"
