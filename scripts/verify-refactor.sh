#!/bin/bash
#
# REFACTORING VERIFICATION SCRIPT
# Run this before and after each refactoring change to ensure nothing breaks
#
# Usage:
#   ./scripts/verify-refactor.sh           # Run all checks
#   ./scripts/verify-refactor.sh --quick   # Skip build (faster)
#   ./scripts/verify-refactor.sh --ci      # CI mode (exit on first failure)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
QUICK_MODE=false
CI_MODE=false
RESULTS_DIR="test-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Parse arguments
for arg in "$@"; do
  case $arg in
    --quick)
      QUICK_MODE=true
      ;;
    --ci)
      CI_MODE=true
      ;;
    --help)
      echo "Usage: $0 [--quick] [--ci]"
      echo "  --quick  Skip build step (faster)"
      echo "  --ci     CI mode - exit on first failure"
      exit 0
      ;;
  esac
done

# Track results
PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
print_header() {
  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_pass() {
  echo -e "${GREEN}✓ PASS:${NC} $1"
  ((PASSED++))
}

print_fail() {
  echo -e "${RED}✗ FAIL:${NC} $1"
  ((FAILED++))
  if $CI_MODE; then
    echo -e "${RED}CI mode - exiting on failure${NC}"
    exit 1
  fi
}

print_warn() {
  echo -e "${YELLOW}⚠ WARN:${NC} $1"
  ((WARNINGS++))
}

print_info() {
  echo -e "${BLUE}ℹ INFO:${NC} $1"
}

# Create results directory
mkdir -p "$RESULTS_DIR"

# =============================================================================
# STEP 1: TYPE CHECKING
# =============================================================================
print_header "Step 1: TypeScript Type Check"

if npx tsc --noEmit 2>&1 | tee "$RESULTS_DIR/typecheck_$TIMESTAMP.log"; then
  print_pass "TypeScript compilation successful (no type errors)"
else
  print_fail "TypeScript type errors found - see $RESULTS_DIR/typecheck_$TIMESTAMP.log"
fi

# =============================================================================
# STEP 2: LINTING
# =============================================================================
print_header "Step 2: ESLint Check"

if npm run lint 2>&1 | tee "$RESULTS_DIR/lint_$TIMESTAMP.log"; then
  print_pass "ESLint passed"
else
  # ESLint warnings are OK, errors are not
  if grep -q "error" "$RESULTS_DIR/lint_$TIMESTAMP.log"; then
    print_fail "ESLint errors found - see $RESULTS_DIR/lint_$TIMESTAMP.log"
  else
    print_warn "ESLint warnings found (no errors)"
  fi
fi

# =============================================================================
# STEP 3: UNIT TESTS
# =============================================================================
print_header "Step 3: Unit Tests"

if npx vitest run 2>&1 | tee "$RESULTS_DIR/tests_$TIMESTAMP.log"; then
  TESTS_PASSED=$(grep -oP '\d+(?= passed)' "$RESULTS_DIR/tests_$TIMESTAMP.log" | tail -1 || echo "0")
  print_pass "All unit tests passed ($TESTS_PASSED tests)"
else
  TESTS_FAILED=$(grep -oP '\d+(?= failed)' "$RESULTS_DIR/tests_$TIMESTAMP.log" || echo "unknown")
  print_fail "Unit tests failed ($TESTS_FAILED failures) - see $RESULTS_DIR/tests_$TIMESTAMP.log"
fi

# =============================================================================
# STEP 4: BUILD (optional)
# =============================================================================
if ! $QUICK_MODE; then
  print_header "Step 4: Production Build"

  if npm run build 2>&1 | tee "$RESULTS_DIR/build_$TIMESTAMP.log"; then
    print_pass "Production build successful"
  else
    print_fail "Build failed - see $RESULTS_DIR/build_$TIMESTAMP.log"
  fi
else
  print_header "Step 4: Production Build (SKIPPED - quick mode)"
  print_info "Run without --quick to include build verification"
fi

# =============================================================================
# STEP 5: CHECK FOR COMMON ISSUES
# =============================================================================
print_header "Step 5: Code Quality Checks"

# Check for console.log statements in production code (excluding tests)
CONSOLE_LOGS=$(grep -r "console\.log" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=tests --exclude-dir=__tests__ \
  . 2>/dev/null | wc -l || echo "0")

if [ "$CONSOLE_LOGS" -gt 10 ]; then
  print_warn "Found $CONSOLE_LOGS console.log statements (consider cleanup)"
else
  print_pass "Console.log usage acceptable ($CONSOLE_LOGS found)"
fi

# Check for TODO/FIXME comments
TODOS=$(grep -rE "(TODO|FIXME|HACK|XXX)" --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next \
  . 2>/dev/null | wc -l || echo "0")

print_info "Found $TODOS TODO/FIXME comments in codebase"

# Check for duplicate formatCurrency implementations
DUPLICATE_FORMATCURRENCY=$(grep -r "function formatCurrency\|const formatCurrency" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next \
  . 2>/dev/null | grep -v "lib/utils/formatters" | wc -l || echo "0")

if [ "$DUPLICATE_FORMATCURRENCY" -gt 0 ]; then
  print_warn "Found $DUPLICATE_FORMATCURRENCY duplicate formatCurrency implementations"
  grep -r "function formatCurrency\|const formatCurrency" \
    --include="*.ts" --include="*.tsx" \
    --exclude-dir=node_modules --exclude-dir=.next \
    . 2>/dev/null | grep -v "lib/utils/formatters" | head -5
else
  print_pass "No duplicate formatCurrency implementations"
fi

# Check for inline frequency multipliers
DUPLICATE_FREQ=$(grep -rE "WEEKLY.*52|FORTNIGHTLY.*26|MONTHLY.*12" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=tests \
  . 2>/dev/null | grep -v "lib/utils/frequencies" | wc -l || echo "0")

if [ "$DUPLICATE_FREQ" -gt 5 ]; then
  print_warn "Found $DUPLICATE_FREQ potential inline frequency multipliers"
else
  print_pass "Frequency multiplier usage acceptable"
fi

# =============================================================================
# SUMMARY
# =============================================================================
print_header "Verification Summary"

echo ""
echo -e "  ${GREEN}Passed:${NC}   $PASSED"
echo -e "  ${RED}Failed:${NC}   $FAILED"
echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  ✓ ALL CHECKS PASSED - Safe to proceed${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  exit 0
else
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}  ✗ VERIFICATION FAILED - Fix issues before proceeding${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Results saved to: $RESULTS_DIR/"
  exit 1
fi
