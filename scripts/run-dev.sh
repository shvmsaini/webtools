#!/usr/bin/env bash
#
# run-dev.sh — start the Ops Console backend (Spring Boot) and
# frontend (Vite dev server) together, in the background, with logs
# to /tmp.
#
# Usage:
#   ./webtools/scripts/run-dev.sh           # start both (default)
#   ./webtools/scripts/run-dev.sh backend   # backend only
#   ./webtools/scripts/run-dev.sh frontend  # frontend only
#   ./webtools/scripts/run-dev.sh stop      # stop both
#   ./webtools/scripts/run-dev.sh status    # show pid + log paths
#   ./webtools/scripts/run-dev.sh restart   # stop then start both
#
# Logs:
#   /tmp/ops-backend.log    — Spring Boot stdout
#   /tmp/ops-frontend.log   — Vite dev server stdout
#
# State:
#   /tmp/ops-backend.pid
#   /tmp/ops-frontend.pid

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKEND_DIR="$ROOT/webtools/ops-console/server"
FRONTEND_DIR="$ROOT/webtools/ops-console-ui"

BACKEND_LOG="${BACKEND_LOG:-/tmp/ops-backend.log}"
FRONTEND_LOG="${FRONTEND_LOG:-/tmp/ops-frontend.log}"
BACKEND_PID_FILE="${BACKEND_PID_FILE:-/tmp/ops-backend.pid}"
FRONTEND_PID_FILE="${FRONTEND_PID_FILE:-/tmp/ops-frontend.pid}"

BACKEND_PORT="${BACKEND_PORT:-8080}"
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

wait_for_port() {
    local port="$1" name="$2" tries=40
    while ! port_in_use "$port"; do
        tries=$((tries - 1))
        if [[ $tries -le 0 ]]; then
            err "$name failed to bind port $port within 20s"
            return 1
        fi
        sleep 0.5
    done
}

is_pid_alive() {
    local pid="${1:-}"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

read_pid() {
    local file="$1"
    [[ -f "$file" ]] && cat "$file" 2>/dev/null || echo ""
}

start_backend() {
    if is_pid_alive "$(read_pid "$BACKEND_PID_FILE")"; then
        warn "Backend already running (pid $(read_pid "$BACKEND_PID_FILE"))"
        return 0
    fi
    if port_in_use "$BACKEND_PORT"; then
        if [[ "${OPS_FORCE:-0}" == "1" ]]; then
            warn "Port $BACKEND_PORT bound by external process — killing"
            lsof -nP -iTCP:"$BACKEND_PORT" -sTCP:LISTEN -t 2>/dev/null | xargs -r kill -9
            sleep 1
        else
            warn "Port $BACKEND_PORT already bound — backend assumed external (set OPS_FORCE=1 to override)"
            return 0
        fi
    fi

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

    if ! wait_for_port "$BACKEND_PORT" "Backend"; then
        err "See $BACKEND_LOG for details"
        return 1
    fi
    ok "Backend up — pid $(read_pid "$BACKEND_PID_FILE"), http://localhost:$BACKEND_PORT"
}

start_frontend() {
    if is_pid_alive "$(read_pid "$FRONTEND_PID_FILE")"; then
        warn "Frontend already running (pid $(read_pid "$FRONTEND_PID_FILE"))"
        return 0
    fi
    if port_in_use "$FRONTEND_PORT"; then
        if [[ "${OPS_FORCE:-0}" == "1" ]]; then
            warn "Port $FRONTEND_PORT bound by external process — killing"
            lsof -nP -iTCP:"$FRONTEND_PORT" -sTCP:LISTEN -t 2>/dev/null | xargs -r kill -9
            sleep 1
        else
            warn "Port $FRONTEND_PORT already bound — frontend assumed external (set OPS_FORCE=1 to override)"
            return 0
        fi
    fi

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
        nohup npm run dev \
            > "$FRONTEND_LOG" 2>&1 &
        echo $! > "$FRONTEND_PID_FILE"
    )

    if ! wait_for_port "$FRONTEND_PORT" "Frontend"; then
        err "See $FRONTEND_LOG for details"
        return 1
    fi
    ok "Frontend up — pid $(read_pid "$FRONTEND_PID_FILE"), http://localhost:$FRONTEND_PORT"
}

stop_one() {
    local name="$1" file="$2"
    local pid
    pid="$(read_pid "$file")"
    if is_pid_alive "$pid"; then
        info "Stopping $name (pid $pid)…"
        # Try TERM first, then KILL after 5s
        kill "$pid" 2>/dev/null || true
        for _ in 1 2 3 4 5; do
            is_pid_alive "$pid" || break
            sleep 1
        done
        if is_pid_alive "$pid"; then
            warn "$name did not stop gracefully, killing"
            kill -9 "$pid" 2>/dev/null || true
        fi
        ok "$name stopped"
    else
        info "$name not running"
    fi
    rm -f "$file"
}

stop_all() {
    stop_one "Frontend" "$FRONTEND_PID_FILE"
    stop_one "Backend"  "$BACKEND_PID_FILE"
}

show_status() {
    log "${BOLD}Ops Console status${RESET}"
    log "────────────────────"

    local backend_pid frontend_pid backend_pids frontend_pids
    backend_pid="$(read_pid "$BACKEND_PID_FILE")"
    frontend_pid="$(read_pid "$FRONTEND_PID_FILE")"
    backend_pids="$(lsof -nP -iTCP:"$BACKEND_PORT" -sTCP:LISTEN -t 2>/dev/null | tr '\n' ',' | sed 's/,$//')"
    frontend_pids="$(lsof -nP -iTCP:"$FRONTEND_PORT" -sTCP:LISTEN -t 2>/dev/null | tr '\n' ',' | sed 's/,$//')"

    if is_pid_alive "$backend_pid"; then
        ok "Backend  :$BACKEND_PORT  pid=${backend_pid}  log=${BACKEND_LOG}"
    elif [[ -n "$backend_pids" ]]; then
        ok "Backend  :$BACKEND_PORT  external pid=${backend_pids} (not managed by this script)"
    else
        warn "Backend  :$BACKEND_PORT  not running"
    fi

    if is_pid_alive "$frontend_pid"; then
        ok "Frontend :$FRONTEND_PORT  pid=${frontend_pid}  log=${FRONTEND_LOG}"
    elif [[ -n "$frontend_pids" ]]; then
        ok "Frontend :$FRONTEND_PORT  external pid=${frontend_pids} (not managed by this script)"
    else
        warn "Frontend :$FRONTEND_PORT  not running"
    fi

    log ""
    log "${DIM}Stop managed processes with: $0 stop${RESET}"
    log "${DIM}Tail logs with: tail -f $BACKEND_LOG $FRONTEND_LOG${RESET}"
}

cmd="${1:-start}"
case "$cmd" in
    start|"")       start_backend; start_frontend; show_status ;;
    backend)        start_backend; show_status ;;
    frontend)       start_frontend; show_status ;;
    stop)           stop_all ;;
    restart)        stop_all; start_backend; start_frontend; show_status ;;
    status)         show_status ;;
    logs)           tail -f "$BACKEND_LOG" "$FRONTEND_LOG" ;;
    -h|--help|help)
        sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
        exit 0
        ;;
    *)
        err "Unknown command: $cmd"
        log "Run: $0 {start|backend|frontend|stop|restart|status|logs}"
        exit 2
        ;;
esac
