#!/usr/bin/env bash
#
# Send sample payloads to the Operations Console backend so you can see
# the dashboard and the seatback's bridge react.
#
# Assumes the backend is reachable on $OPS_HOST (default
# http://localhost:8080). The samples/*.json files are simple payloads
# that satisfy the wire contract.
#

set -euo pipefail

OPS_HOST="${OPS_HOST:-http://localhost:8080}"
SAMPLES_DIR="$(cd "$(dirname "$0")" && pwd)"

curl -fsS -X POST "${OPS_HOST}/api/v1/notifications" \
    -H 'Content-Type: application/json' \
    --data "@${SAMPLES_DIR}/welcome-notification.json" \
    >/dev/null
echo "Sent welcome-notification.json"

curl -fsS -X PUT "${OPS_HOST}/api/v1/webview/experiences/quiz-001" \
    -H 'Content-Type: application/json' \
    --data "@${SAMPLES_DIR}/sample-webview-experience.json" \
    >/dev/null
echo "Sent sample-webview-experience.json"

curl -fsS -X POST "${OPS_HOST}/api/v1/config/themes" \
    -H 'Content-Type: application/json' \
    --data "@${SAMPLES_DIR}/sample-theme.json" \
    >/dev/null
echo "Sent sample-theme.json"

curl -fsS -X POST "${OPS_HOST}/api/v1/config/features" \
    -H 'Content-Type: application/json' \
    --data '{"name":"SEARCH","enabled":true,"reason":"sample-script","updatedAt":"2026-09-15T22:00:00Z","updatedBy":"sample-script"}' \
    >/dev/null
echo "Toggled SEARCH feature flag"

echo
echo "Bundle now:"
curl -fsS "${OPS_HOST}/api/v1/config/bundle" | python3 -m json.tool
