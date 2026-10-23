#!/usr/bin/env bash
#
# health.sh — poll the backend health endpoint and tail bridge logs.
# Useful for "is the system actually working right now" diagnosis.
#
# Usage:
#   ./webtools/scripts/health.sh              # one-shot report
#   ./webtools/scripts/health.sh watch        # repeat every 3s
#
# Requires:
#   - backend running on :8080 (or override OPS_API)
#   - adb on $ANDROID_SERIAL (or first attached device)
#
# Exit codes:
#   0 — backend up + at least one bridge fired in last 60s
#   1 — backend down
#   2 — backend up, no bridge activity

set -euo pipefail

OPS_API="${OPS_API:-http://localhost:8080}"
ADB="${ADB:-adb}"
SERIAL="${ANDROID_SERIAL:-${ADB_SERIAL:-}}"
POLL="${POLL:-3}"

if [[ -z "$SERIAL" ]]; then
    SERIAL="$($ADB devices | awk 'NR>1 && $2=="device" {print $1; exit}' || true)"
fi

probe() {
    local label="$1" status="ok"
    code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$OPS_API/api/v1/config/bundle" || echo "0")"
    if [[ "$code" != "200" ]]; then
        status="down"
        echo -e "\033[31m✗\033[0m  $label  http=$code"
        return 1
    fi
    echo -e "\033[32m✓\033[0m  $label  http=200"
    return 0
}

bundle_summary() {
    curl -s --max-time 3 "$OPS_API/api/v1/config/bundle" \
        | python3 -c '
import json, sys
b = json.load(sys.stdin)
ver = b.get("version", "?")
fetched = b.get("fetchedAt", "?")
notifs = len(b.get("notifications", []))
wvs = len(b.get("webviewExperiences", []))
pinned = sum(1 for w in b.get("webviewExperiences", []) if w.get("pinnedToFooter"))
flags = len(b.get("featureFlags", []))
themes = len(b.get("themes", []))
wds = len(b.get("withdrawnMedia", []))
print("  bundle:")
print("    version        :", ver)
print("    fetchedAt      :", fetched)
print("    notifications  :", notifs)
print("    webviews       :", wvs)
print("      pinned       :", pinned)
print("    featureFlags   :", flags)
print("    themes         :", themes)
print("    withdrawals    :", wds)
' 2>/dev/null || echo "  (failed to parse bundle)"
}

bridge_activity() {
    if [[ -z "$SERIAL" ]]; then
        echo "  (no adb device — skipping bridge check)"
        return
    fi
    # OPS_* tags emitted by NotificationBridge / WebviewMenuItemBridge /
    # FeatureFlagBridge / ThemeBridge.
    out="$($ADB -s "$SERIAL" logcat -d -t 200 2>/dev/null \
        | grep -E 'OPS_(NotificationBridge|WebviewMenuItemBridge|FeatureFlagBridge|ThemeBridge):' || true)"
    if [[ -z "$out" ]]; then
        echo "  (no bridge logs in last 200 lines)"
        return
    fi
    echo "  bridges (last 200 logcat lines):"
    echo "$out" | tail -8 | sed 's/^/    /'
    n=$(echo "$out" | wc -l | tr -d ' ')
    echo "  total bridge log lines: $n"
}

report() {
    printf "\033[1mOps Console health\033[0m  $(date '+%H:%M:%S')\n"
    printf "──────────────────────\n"
    probe "backend  ($OPS_API)" || return 1
    bundle_summary
    echo ""
    printf "Android device: ${SERIAL:-(none)}\n"
    bridge_activity
}

watch() {
    while true; do
        report || true
        sleep "$POLL"
        clear
    done
}

case "${1:-once}" in
    once|"")  report ;;
    watch)    watch ;;
    -h|--help)
        sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
        ;;
    *) echo "Unknown arg: $1"; exit 2 ;;
esac
