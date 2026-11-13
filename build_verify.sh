#!/bin/bash
# build_verify.sh - Comprehensive build verification for webtools project
# Runs TypeScript check, frontend build, and Java backend compile
# Verifies all components build successfully before deployment

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Webtools Build Verification${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

ERRORS=0

# 1. TypeScript type-check (no emit)
echo -e "${YELLOW}[1/5] Running TypeScript type-check (no emit)...${NC}"
cd "$PROJECT_ROOT/ops-console-ui"
if npx tsc --noEmit 2>&1; then
    echo -e "${GREEN}✅ TypeScript: No errors found${NC}"
else
    echo -e "${RED}❌ TypeScript errors detected${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 2. Production frontend build
echo -e "${YELLOW}[2/5] Building TypeScript frontend (npm run build)...${NC}"
if npm run build 2>&1 | tail -10; then
    echo -e "${GREEN}✅ Frontend build: SUCCESS${NC}"
else
    echo -e "${RED}❌ Frontend build failed${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 3. Java backend compile
echo -e "${YELLOW}[3/5] Compiling Java backend (mvn compile)...${NC}"
cd "$PROJECT_ROOT/ops-console/server"
if mvn compile -DskipTests -q 2>&1; then
    echo -e "${GREEN}✅ Backend compile: SUCCESS${NC}"
else
    echo -e "${RED}❌ Backend compile failed${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 4. Backend package (jar)
echo -e "${YELLOW}[4/5] Packaging backend (mvn package)...${NC}"
if mvn package -DskipTests -q 2>&1 | tail -5; then
    echo -e "${GREEN}✅ Backend package: SUCCESS${NC}"
else
    echo -e "${RED}❌ Backend package failed${NC}"
    ERRORS=$((ERRORS + 1))
fi
echo ""

# 5. Git status check
echo -e "${YELLOW}[5/5] Checking git state...${NC}"
cd "$PROJECT_ROOT"
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
    echo "Frontend: $PROJECT_ROOT/ops-console-ui/dist/"
    echo "Backend:  $PROJECT_ROOT/ops-console/server/target/"
    echo ""
    exit 0
else
    echo -e "${RED}❌ $ERRORS build check(s) failed${NC}"
    echo -e "${BLUE}========================================${NC}"
    exit 1
fi
