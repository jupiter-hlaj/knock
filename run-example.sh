#!/bin/bash

TMPFILE=$(mktemp)
CLOUDFLARED_PID=""

cleanup() {
  [[ -n "$CLOUDFLARED_PID" ]] && kill "$CLOUDFLARED_PID" 2>/dev/null
  rm -f "$TMPFILE"
}
trap cleanup EXIT INT TERM

echo "Starting Cloudflare tunnel..."
npx cloudflared tunnel --url http://localhost:3000 > "$TMPFILE" 2>&1 &
CLOUDFLARED_PID=$!

URL=""
for i in $(seq 1 30); do
  sleep 1
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' "$TMPFILE" | head -1)
  [[ -n "$URL" ]] && break
  echo -n "."
done
echo ""

if [[ -z "$URL" ]]; then
  echo "Error: timed out waiting for tunnel URL"
  exit 1
fi

DOMAIN="${URL#https://}"

echo ""
echo "Share this URL: $URL"
echo "$URL" | pbcopy
echo "(copied to clipboard)"
echo ""

export KNOCK_ORIGIN="$URL"
export KNOCK_RP_ID="$DOMAIN"

npm run example
