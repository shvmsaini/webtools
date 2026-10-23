#!/usr/bin/env bash
#
# seed.sh — load the sample JSON payloads into the running backend via
# the REST API. Useful to populate a fresh dev instance with realistic
# demo data so the Android app has something to show.
#
# Usage:
#   ./webtools/scripts/seed.sh              # load everything
#   ./webtools/scripts/seed.sh welcome      # just the welcome notification
#   ./webtools/scripts/seed.sh webview      # just the sample webview
#
# Loads from webtools/samples/*.json. Falls back to inline JSON if the
# file doesn't exist.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OPS_API="${OPS_API:-http://localhost:8080/api/v1}"
SAMPLES="$ROOT/webtools/samples"

note() { printf "\033[1;36m%s\033[0m\n" "$*"; }
ok()   { printf "\033[32m✓\033[0m  %s\n" "$*"; }
warn() { printf "\033[33m⚠\033[0m  %s\n" "$*"; }

post() {
    local label="$1" path="$2" body="$3"
    code=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$OPS_API$path" \
        -H 'Content-Type: application/json' -d "$body" || echo "000")
    if [[ "$code" == "200" || "$code" == "201" || "$code" == "400" ]]; then
        ok "$label  ($code)"
    else
        warn "$label  HTTP $code"
    fi
}

put() {
    local label="$1" path="$2" body="$3"
    code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT "$OPS_API$path" \
        -H 'Content-Type: application/json' -d "$body" || echo "000")
    if [[ "$code" == "200" || "$code" == "201" ]]; then
        ok "$label  ($code)"
    else
        warn "$label  HTTP $code"
    fi
}

# Verify backend is reachable
if ! curl -s -o /dev/null --max-time 3 "$OPS_API/../api/v1/config/bundle"; then
    warn "Backend unreachable at $OPS_API — start it first: ./webtools/scripts/run-dev.sh"
    exit 1
fi

now() { date -u +'%Y-%m-%dT%H:%M:%SZ'; }

seed_welcome() {
    note "Seeding welcome notification…"
    if [[ -f "$SAMPLES/welcome-notification.json" ]]; then
        body=$(jq -c --arg ts "$(now)" '.createdAt = $ts' "$SAMPLES/welcome-notification.json")
        post "welcome notification" /notifications "$body"
    else
        post "welcome notification" /notifications "$(cat <<JSON
{
  "id": "welcome-001",
  "title": "Welcome aboard",
  "body": "Browse the seat-back screen to enjoy entertainment during your flight.",
  "channel": "POLL",
  "category": "ANNOUNCEMENT",
  "createdAt": "$(now)"
}
JSON
)"
    fi
}

seed_webview() {
    note "Seeding sample webview experience…"
    if [[ -f "$SAMPLES/sample-webview-experience.json" ]]; then
        body=$(cat "$SAMPLES/sample-webview-experience.json")
        id=$(echo "$body" | jq -r '.id')
        put "webview $id" "/webview/experiences/$id" "$body"
    else
        put "webview sample-modal" "/webview/experiences/sample-modal" '{
  "id": "sample-modal",
  "title": "Sample Modal",
  "type": "CAMPAIGN",
  "url": "https://example.com",
  "active": true,
  "display": {"mode": "MODAL", "showHeader": true, "showCloseButton": true}
}'
        put "webview sample-pinned" "/webview/experiences/sample-pinned" '{
  "id": "sample-pinned",
  "title": "Sample Pinned Item",
  "type": "PARTNER",
  "url": "https://example.com",
  "active": true,
  "pinnedToFooter": true,
  "footerPosition": 1,
  "display": {"mode": "MODAL", "showHeader": true, "showCloseButton": true}
}'
    fi
}

seed_theme() {
    note "Seeding sample theme…"
    if [[ -f "$SAMPLES/sample-theme.json" ]]; then
        body=$(cat "$SAMPLES/sample-theme.json")
        id=$(echo "$body" | jq -r '.id')
        post "theme $id" /config/themes "$body"
    else
        post "theme sample-emirates" /config/themes '{
  "id": "sample-emirates",
  "label": "Sample Emirates",
  "colorTokens": {
    "primary": "#d71921",
    "background": "#0a001a",
    "surface": "#1e293b",
    "textPrimary": "#f5f5f9"
  },
  "updatedAt": "'"$(now)"'"
}'
    fi
}

seed_flags() {
    note "Seeding feature flags…"
    post "feature flag LIVE_TV" /config/features "$(cat <<JSON
{
  "name": "LIVE_TV",
  "enabled": true,
  "reason": "Seed data",
  "updatedAt": "$(now)"
}
JSON
)"
    post "feature flag SEARCH" /config/features "$(cat <<JSON
{
  "name": "SEARCH",
  "enabled": true,
  "reason": "Seed data",
  "updatedAt": "$(now)"
}
JSON
)"
}

target="${1:-all}"
case "$target" in
    all)        seed_welcome; seed_webview; seed_theme; seed_flags ;;
    welcome)    seed_welcome ;;
    webview|webviews) seed_webview ;;
    theme|themes)      seed_theme ;;
    flags|features)    seed_flags ;;
    *)
        echo "Unknown target: $target"
        echo "Usage: $0 {all|welcome|webview|theme|flags}"
        exit 2
        ;;
esac

ok "Seeding complete."
