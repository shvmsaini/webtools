#!/usr/bin/env bash
#
# restart-frontend.sh — restart just the Vite dev server.
#
# Vite picks up most changes via HMR, but if the dev server gets
# wedged (stale state, dependency install issues) this gives you
# a clean restart without touching the backend.
#
# Usage:
#   ./webtools/scripts/restart-frontend.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
FRONTEND_DIR="$ROOT/webtools/ops-console-ui"

FRONTEND_LOG="${FRONTEND_LOG:-/tmp/ops-frontend.log}"
FRONTEND_PID_FILE="${FRONTEND_PID_FILE:-/tmp/ops-frontend.pid}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

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
            err "Frontend failed to bind port $port within 20s"
            return 1
        fi
        sleep 0.5
    done
}

stop_frontend() {
    local pid
    pid="$(read_pid "$FRONTEND_PID_FILE")"
    if is_pid_alive "$pid"; then
        info "Stopping frontend (pid $pid)…"
        kill "$pid" 2>/dev/null || true
        for _ in 1 2 3 4 5; do
            is_pid_alive "$pid" || break
            sleep 1
        done
        if is_pid_alive "$pid"; then
            warn "Frontend did not stop gracefully, killing"
            kill -9 "$pid" 2>/dev/null || true
        fi
    fi
    rm -f "$FRONTEND_PID_FILE"

    if port_in_use "$FRONTEND_PORT"; then
        warn "Port $FRONTEND_PORT still bound by external process — killing"
        lsof -nP -iTCP:"$FRONTEND_PORT" -sTCP:LISTEN -t 2>/dev/null | xargs -r kill -9
        sleep 1
    fi
}

start_frontend() {
    if [[ ! -d "$FRONTEND_DIR" ]]; then
        err "Frontend dir not found: $FRONTEND_DIR"
        return 1
    fi
    if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
        info "Installing frontend dependencies (first run)…"
        (cd "$FRONTEND_DIR" && npm install --silent)
    fi

    info "Starting Vite dev server on :$FRONTEND_PORT"
    info "${DIM}log: $FRONTEND_LOG${RESET}"

    (
        cd "$FRONTEND_DIR"
        : > "$FRONTEND_LOG"
        nohup npm run dev > "$FRONTEND_LOG" 2>&1 &
        echo $! > "$FRONTEND_PID_FILE"
    )

    if ! wait_for_port "$FRONTEND_PORT"; then
        err "See $FRONTEND_LOG for details"
        return 1
    fi
    ok "Frontend up — pid $(read_pid "$FRONTEND_PID_FILE"), http://localhost:$FRONTEND_PORT"
}

main() {
    log "${BOLD}Restarting Ops Console frontend${RESET}"
    log "──────────────────────────────────"
    stop_frontend
    start_frontend
    log ""
    log "${DIM}Tail log: tail -f $FRONTEND_LOG${RESET}"
}

main
