#!/bin/bash
# build_verify.sh - Comprehensive build verification for all three components
# 1. Webtools TypeScript frontend
# 2. Webtools Java backend
# 3. Android Kotlin bridge sanity check

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Webtools Build Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

ERRORS=0

# 1. TypeScript type-check (no emit)
echo -e "${YELLOW}[1/6] Running TypeScript type-check (no emit)...${NC}"
cd "$SCRIPT_DIR/ops-console-ui"
if npx tsc --noEmit 2>&1; then
    echo -e "${GREEN}✅ TypeScript: No errors found${NC}"
else
    echo -e "${RED}❌ TypeScript errors detected${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 2. Production frontend build
echo -e "${YELLOW}[2/6] Building TypeScript frontend (npm run build)...${NC}"
if npm run build 2>&1 | tail -10; then
    echo -e "${GREEN}✅ Frontend build: SUCCESS${NC}"
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 3. Java backend compile
echo -e "${YELLOW}[3/6] Compiling Java backend (mvn compile)...${NC}"
cd "$SCRIPT_DIR/ops-console/server"
if mvn compile -DskipTests -q 2>&1; then
    echo -e "${GREEN}✅ Backend compile: SUCCESS${NC}"
else
    echo -e "${RED}❌ Backend compile failed${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 4. Backend package (jar)
echo -e "${YELLOW}[4/6] Packaging backend (mvn package)...${NC}"
if mvn package -DskipTests -q 2>&1 | tail -5; then
    echo -e "${GREEN}✅ Backend package: SUCCESS${NC}"
else
    echo -e "${RED}❌ Backend package failed${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 5. Android bridge sanity check
echo -e "${YELLOW}[5/6] Android Kotlin bridge sanity check...${NC}"
# Try a few common locations for the leanback-android project
LEANBACK_PATHS=(
    "$(dirname "$SCRIPT_DIR")/leanback-android"
    "$HOME/AndroidStudioProjects/leanback-android"
    "/Users/sainis/AndroidStudioProjects/leanback-android"
)
LEANBACK_ROOT=""
for p in "${LEANBACK_PATHS[@]}"; do
    if [ -d "$p" ] && [ -f "$p/verify_android.sh" ]; then
        LEANBACK_ROOT="$p"
        break
    fi
done

if [ -n "$LEANBACK_ROOT" ]; then
    if "$LEANBACK_ROOT/verify_android.sh" 2>&1 | tail -10; then
        echo -e "${GREEN}✅ Android bridge check: passed${NC}"
    else
        echo -e "${RED}❌ Android bridge check failed${NC}"
        ERRORS=$((ERRORS + 1))
    fi
else
    echo -e "${YELLOW}⚠️  leanback-android project not found — skipping Android check${NC}"
fi
echo ""

# 6. Git status check
echo -e "${YELLOW}[6/6] Checking git state...${NC}"
cd "$SCRIPT_DIR"
LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse origin/main 2>/dev/null || echo "none")
AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "0")

echo "Local HEAD:  $LOCAL"
echo "Remote main: $REMOTE"
echo "Commits ahead: $AHEAD"

if [ "$AHEAD" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  You have $AHEAD unpushed commit(s) ahead of origin/main${NC}"
    echo "   Render.com deploys from origin/main — push your fixes:"
    echo "   git push origin main"
else
    echo -e "${GREEN}✅ All commits are pushed to remote${NC}"
fi
echo ""

# Final summary
echo -e "${BLUE}========================================${NC}"
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All builds passed!${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo "Frontend: $SCRIPT_DIR/ops-console-ui/dist/"
    echo "Backend:  $SCRIPT_DIR/ops-console/server/target/"
    exit 0
else
    echo -e "${RED}❌ $ERRORS build check(s) failed${NC}"
    echo -e "${BLUE}========================================${NC}"
    exit 1
fi
