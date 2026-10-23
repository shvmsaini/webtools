#!/usr/bin/env bash
#
# bump-build-id.sh — bump the app version + version code so you can tell
# when a new APK is on the emulator.
#
# Usage:
#   ./webtools/scripts/bump-build-id.sh         # bump patch version
#   ./webtools/scripts/bump-build-id.sh major   # bump major
#   ./webtools/scripts/bump-build-id.sh minor
#   ./webtools/scripts/bump-build-id.sh 1.4.2   # set explicit

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
GRADLE="$ROOT/appsm/build.gradle"

if [[ ! -f "$GRADLE" ]]; then
    echo "build.gradle not found: $GRADLE" >&2
    exit 1
fi

current=$(grep -E '^\s*versionCode\s+\d+|^\s*versionName\s+"[^"]+"' "$GRADLE" \
    | awk -F'[ "]+' '{
        if ($1 == "versionCode") print "code=" $2
        else if ($1 == "versionName") print "name=" $3
    }')
echo "Current: $current"

case "${1:-patch}" in
    major)
        # 1.2.3 → 2.0.0
        IFS=. read -r major minor patch <<<"$(echo "$current" | awk -F'"' '/name=/ {print $2; exit}')"
        new="$((major+1)).0.0"
        ;;
    minor)
        # 1.2.3 → 1.3.0
        IFS=. read -r major minor patch <<<"$(echo "$current" | awk -F'"' '/name=/ {print $2; exit}')"
        new="$major.$((minor+1)).0"
        ;;
    patch|"")
        IFS=. read -r major minor patch <<<"$(echo "$current" | awk -F'"' '/name=/ {print $2; exit}')"
        new="$major.$minor.$((patch+1))"
        ;;
    *)
        # explicit triple
        new="$1"
        ;;
esac

old_code=$(grep -E '^\s*versionCode\s+\d+' "$GRADLE" | awk '{print $2}' | head -1)
new_code=$((old_code + 1))

# macOS sed needs -i ''
if sed -i '' -E "s/versionCode\s+[0-9]+/versionCode $new_code/; s/versionName\s+\"[^\"]+\"/versionName \"$new\"/" "$GRADLE"; then
    echo "Updated: versionCode $old_code → $new_code, versionName → \"$new\""
else
    echo "Failed to update $GRADLE" >&2
    exit 1
fi
