#!/bin/bash
# Gods Eye installer wrapper
# Fetches and runs the main installer from the GitHub repository
set -euo pipefail
TMPFILE="$(mktemp)"
trap 'rm -f "$TMPFILE"' EXIT
curl -fsSL https://raw.githubusercontent.com/bitan-del/gods-eye/main/scripts/install.sh -o "$TMPFILE"
bash "$TMPFILE"
