#!/bin/bash
# Gods Eye installer wrapper
# Fetches and runs the main installer from the GitHub repository
set -euo pipefail
exec curl -fsSL https://raw.githubusercontent.com/bitan-del/gods-eye/main/scripts/install.sh | bash
