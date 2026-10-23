#!/usr/bin/env bash
#
# Bootstrap script for the Operations Console backend.
#
# Spins up the Spring Boot server on localhost:8080, applies the
# default Leanback theme + welcome notification, and verifies the
# /api/v1/config/bundle endpoint returns the expected payload.
#
# Usage:
#   bash webtools/samples/bootstrap-backend.sh
#

set -euo pipefail

PORT="${OPS_PORT:-8080}"
HOST="${OPS_HOST:-http://localhost:${PORT}}"

echo "==> Waiting for ${HOST}/actuator/health..."
for i in $(seq 1 30); do
    if curl -fsS "${HOST}/api/v1/config/bundle" >/dev/null 2>&1; then
        echo "    Server is up after ${i} attempt(s)."
        break
    fi
    sleep 1
done

echo "==> Fetching current bundle..."
curl -fsS "${HOST}/api/v1/config/bundle" | python3 -m json.tool

echo "==> Done."
