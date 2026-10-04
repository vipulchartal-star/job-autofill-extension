#!/usr/bin/env bash
# Usage: ./send-whatsapp.sh <phone-digits-only-intl> "<message>" [autosend]
# Example: ./send-whatsapp.sh 919309555464 "Hi, following up on my application" autosend
set -euo pipefail
PHONE="${1:?phone required (international format, digits only, e.g. 919309555464)}"
TEXT="${2:?message text required}"
AUTOSEND="false"
[ "${3:-}" = "autosend" ] && AUTOSEND="true"

curl -sS -X POST http://localhost:8788/send-whatsapp \
  -H "Content-Type: application/json" \
  -d "{\"phone\":\"$PHONE\",\"text\":$(node -e 'console.log(JSON.stringify(process.argv[1]))' "$TEXT"),\"autoSend\":$AUTOSEND}"
echo
