#!/usr/bin/env bash
#
# baseline-prisma-migrations.sh
#
# One-time helper to baseline an existing Cloud SQL database with
# Prisma's migration tracking. Creates the `_prisma_migrations`
# table and marks `0_init` as applied. DOES NOT execute any SQL
# from migration files — the baseline is metadata-only.
#
# Usage:
#   export DATABASE_URL="postgresql://monitrax_app:PASSWORD@127.0.0.1:5433/monitrax?sslmode=require"
#   ./scripts/baseline-prisma-migrations.sh
#
# The DATABASE_URL must point at an already-running Cloud SQL
# Auth Proxy. See docs/operational/database/04_PRISMA_MIGRATION_BASELINE.md
# for the full runbook including proxy setup and verification.
#
# Safety guarantees:
#   - Zero user data touched
#   - Refuses to run if DATABASE_URL is not set
#   - Refuses to run if _prisma_migrations already exists (check §6 of runbook)
#   - Prompts for explicit confirmation before writing
#
# Exit codes:
#   0 - success
#   1 - preflight failure (no DATABASE_URL, existing table, etc.)
#   2 - user declined confirmation
#   3 - prisma command failed

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo -e "${RED}ERROR${NC}: DATABASE_URL is not set."
  echo "Export it with e.g.:"
  echo "  export DATABASE_URL='postgresql://monitrax_app:PASSWORD@127.0.0.1:5433/monitrax?sslmode=require'"
  exit 1
fi

# Redact password from display
REDACTED_URL="$(echo "$DATABASE_URL" | sed -E 's|://([^:]+):([^@]+)@|://\1:***@|')"

echo -e "${BLUE}Prisma Migration Baseline${NC}"
echo "=========================="
echo "Target database: $REDACTED_URL"
echo ""

# Preflight: check Prisma can connect
echo -e "${BLUE}Step 1/4${NC}: Checking Prisma can connect to the database..."
if ! npx prisma migrate status > /tmp/prisma-status.out 2>&1; then
  STATUS_OUTPUT="$(cat /tmp/prisma-status.out)"
  if echo "$STATUS_OUTPUT" | grep -q "_prisma_migrations"; then
    # This is the EXPECTED state for a fresh baseline — the error
    # says the table doesn't exist yet.
    if echo "$STATUS_OUTPUT" | grep -qiE "does not exist|relation .*_prisma_migrations"; then
      echo -e "${GREEN}OK${NC}: _prisma_migrations does not exist yet (expected)"
    else
      echo -e "${RED}ERROR${NC}: prisma migrate status failed in an unexpected way:"
      echo "$STATUS_OUTPUT"
      exit 1
    fi
  else
    echo -e "${RED}ERROR${NC}: prisma migrate status failed:"
    echo "$STATUS_OUTPUT"
    exit 1
  fi
else
  # Non-zero exit codes are expected before baseline. If this
  # succeeded, _prisma_migrations already exists — STOP.
  STATUS_OUTPUT="$(cat /tmp/prisma-status.out)"
  if echo "$STATUS_OUTPUT" | grep -q "Database schema is up to date"; then
    echo -e "${YELLOW}WARNING${NC}: _prisma_migrations already exists and is up to date."
    echo "Nothing to do. See §6 of the baseline runbook if this is unexpected."
    exit 0
  fi
  if echo "$STATUS_OUTPUT" | grep -q "have not yet been applied"; then
    echo -e "${RED}ERROR${NC}: _prisma_migrations exists but has pending migrations."
    echo "This script only handles fresh baselines. STOP and read §6 of the runbook."
    echo ""
    echo "$STATUS_OUTPUT"
    exit 1
  fi
fi

# Confirmation
echo ""
echo -e "${BLUE}Step 2/4${NC}: Confirmation"
echo "About to run: npx prisma migrate resolve --applied 0_init"
echo ""
echo "This will:"
echo "  - Create the _prisma_migrations table"
echo "  - Insert one row marking 0_init as applied"
echo "  - NOT execute any SQL from 0_init/migration.sql (it is SELECT 1;)"
echo "  - NOT modify any user data"
echo ""
read -rp "Type 'baseline' to proceed: " CONFIRM
if [[ "$CONFIRM" != "baseline" ]]; then
  echo -e "${YELLOW}Aborted${NC} by user."
  exit 2
fi

# Execute
echo ""
echo -e "${BLUE}Step 3/4${NC}: Running baseline..."
if ! npx prisma migrate resolve --applied 0_init; then
  echo -e "${RED}ERROR${NC}: prisma migrate resolve failed."
  exit 3
fi

# Verify
echo ""
echo -e "${BLUE}Step 4/4${NC}: Verifying..."
if ! npx prisma migrate status; then
  echo -e "${RED}ERROR${NC}: verification failed. The baseline may be in an inconsistent state."
  echo "Check _prisma_migrations manually and see §7 of the runbook."
  exit 3
fi

echo ""
echo -e "${GREEN}SUCCESS${NC}: baseline complete."
echo "The target database is now tracked by Prisma migrations."
echo ""
echo "Next steps:"
echo "  1. If this was the DEV database, repeat §5 of the runbook for PROD"
echo "  2. After both DBs are baselined, unblock PR #3 (deploy pipeline gate)"
