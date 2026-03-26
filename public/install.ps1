# Gods Eye installer wrapper for Windows
# Fetches and runs the main installer from the GitHub repository
$ErrorActionPreference = 'Stop'
Invoke-Expression (Invoke-WebRequest -UseBasicParsing -Uri 'https://raw.githubusercontent.com/bitan-del/gods-eye/main/scripts/install.ps1').Content
