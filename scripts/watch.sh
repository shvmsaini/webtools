#!/usr/bin/env bash
#
# watch.sh — keep backend + frontend running. If either dies, restart it.
# Loops every 5s, prints a heartbeat. Ctrl-C to stop.
#
# Usage:
#   ./webtools/scripts/watch.sh
#
# Wraps run-dev.sh. Useful when running on a laptop that goes to sleep
# or after editing pom.xml (mvn restarts the backend).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
    echo ""
    echo "Stopping ops console…"
    "$SCRIPT_DIR/run-dev.sh" stop >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

echo "Ops Console watcher — Ctrl-C to stop"
echo "────────────────────────────────────"

# Make sure both are up before watching
"$SCRIPT_DIR/run-dev.sh" start >/dev/null

last_status=""
while true; do
    status=$("$SCRIPT_DIR/run-dev.sh" status 2>&1 || true)
    if [[ "$status" != "$last_status" ]]; then
        printf "\033[2J\033[H"   # clear screen
        printf "%s\n" "$status"
        printf "\n\033[2mWatching… Ctrl-C to stop\033[0m\n"
        last_status="$status"
    else
        printf "."
    fi

    # Detect down services and restart silently
    if ! echo "$status" | grep -q "Backend  :8080  pid="; then
        "$SCRIPT_DIR/run-dev.sh" backend >/dev/null 2>&1 || true
        last_status=""
    fi
    if ! echo "$status" | grep -q "Frontend :5173  pid="; then
        "$SCRIPT_DIR/run-dev.sh" frontend >/dev/null 2>&1 || true
        last_status=""
    fi

    sleep 5
done
