#!/usr/bin/env bash
#
# restart-backend.sh — restart just the Spring Boot backend.
#
# Use when you've added a new controller/route that needs to be
# picked up (Spring DevTools handles class-level hot reload, but not
# the initial classpath registration of new @RestController classes).
#
# If the backend was started by run-dev.sh, this stops it cleanly
# via its PID file and restarts it. If something else owns the
# process on :8080, we kill the listener (set RESTART_FORCE=0 to
# skip).
#
# Usage:
#   ./webtools/scripts/restart-backend.sh
#   RESTART_FORCE=0 ./webtools/scripts/restart-backend.sh   # fail if port busy
#
# Logs:
#   /tmp/ops-backend.log    — Spring Boot stdout
#   /tmp/ops-backend.pid    — pid file written by run-dev.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$ROOT/webtools/ops-console/server"

BACKEND_LOG="${BACKEND_LOG:-/tmp/ops-backend.log}"
BACKEND_PID_FILE="${BACKEND_PID_FILE:-/tmp/ops-backend.pid}"
BACKEND_PORT="${BACKEND_PORT:-8080}"

RED=$'\033[31m'
GREEN=$'\033[32m'
YELLOW=$'\033[33m'
BLUE=$'\033[34m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
RESET=$'\033[0m'

log()  { printf "%b\n" "$*"; }
info() { log "${BLUE}ℹ${RESET}  $*"; }
ok()   { log "${GREEN}✓${RESET}  $*"; }
warn() { log "${YELLOW}⚠${RESET}  $*"; }
err()  { log "${RED}✗${RESET}  $*" >&2; }

port_in_use() {
    lsof -i ":$1" -sTCP:LISTEN -t >/dev/null 2>&1
}

is_pid_alive() {
    local pid="${1:-}"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

read_pid() {
    [[ -f "$1" ]] && cat "$1" 2>/dev/null || echo ""
}

wait_for_port() {
    local port="$1" tries=40
    while ! port_in_use "$port"; do
        tries=$((tries - 1))
        if [[ $tries -le 0 ]]; then
            err "Backend failed to bind port $port within 20s"
            return 1
        fi
        sleep 0.5
    done
}

stop_backend() {
    local pid
    pid="$(read_pid "$BACKEND_PID_FILE")"
    if is_pid_alive "$pid"; then
        info "Stopping backend (pid $pid)…"
        kill "$pid" 2>/dev/null || true
        for _ in 1 2 3 4 5; do
            is_pid_alive "$pid" || break
            sleep 1
        done
        if is_pid_alive "$pid"; then
            warn "Backend did not stop gracefully, killing"
            kill -9 "$pid" 2>/dev/null || true
        fi
    fi
    rm -f "$BACKEND_PID_FILE"

    # If something else still owns the port, kill it (unless disabled).
    if port_in_use "$BACKEND_PORT"; then
        if [[ "${RESTART_FORCE:-1}" == "1" ]]; then
            warn "Port $BACKEND_PORT still bound by external process — killing"
            lsof -nP -iTCP:"$BACKEND_PORT" -sTCP:LISTEN -t 2>/dev/null | xargs -r kill -9
            sleep 1
        else
            err "Port $BACKEND_PORT is bound by an external process; refusing to kill (RESTART_FORCE=0)"
            return 1
        fi
    fi
}

start_backend() {
    if [[ ! -d "$BACKEND_DIR" ]]; then
        err "Backend dir not found: $BACKEND_DIR"
        return 1
    fi

    info "Starting Spring Boot backend on :$BACKEND_PORT"
    info "${DIM}log: $BACKEND_LOG${RESET}"

    (
        cd "$BACKEND_DIR"
        : > "$BACKEND_LOG"
        nohup mvn -q -DskipTests spring-boot:run \
            > "$BACKEND_LOG" 2>&1 &
        echo $! > "$BACKEND_PID_FILE"
    )

    if ! wait_for_port "$BACKEND_PORT"; then
        err "See $BACKEND_LOG for details"
        return 1
    fi
    ok "Backend up — pid $(read_pid "$BACKEND_PID_FILE"), http://localhost:$BACKEND_PORT"
}

main() {
    log "${BOLD}Restarting Ops Console backend${RESET}"
    log "───────────────────────────────"
    stop_backend
    start_backend
    log ""
    log "${DIM}Tail log: tail -f $BACKEND_LOG${RESET}"
}

main
