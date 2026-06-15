#!/usr/bin/env bash
#
# check-plan-freshness.sh — finding F-1(a), continuity Phase 2.
#
# Fails (or warns, in soft-launch) if the IMPLEMENTATION_PLAN hub's
# "Last updated:" date is OLDER than the newest entry in the Recently
# Completed spoke. A stale header is the first thing a reader distrusts
# (the original F-1: header read 2026-05-20 while the body had 2026-06-12
# entries).
#
# Usage:
#   scripts/check-plan-freshness.sh            # soft: warn, exit 0
#   scripts/check-plan-freshness.sh --strict   # hard:  fail, exit 1
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HUB="${ROOT}/docs/IMPLEMENTATION_PLAN.md"
RC="${ROOT}/docs/implementation/04_RECENTLY_COMPLETED.md"

STRICT=0
[ "${1:-}" = "--strict" ] && STRICT=1

fail() {
  if [ "$STRICT" -eq 1 ]; then
    echo "::error::$*"; exit 1
  else
    echo "::warning::$*"; exit 0
  fi
}

[ -f "$HUB" ] || fail "plan hub not found at docs/IMPLEMENTATION_PLAN.md"
[ -f "$RC" ]  || fail "Recently Completed spoke not found at docs/implementation/04_RECENTLY_COMPLETED.md"

# Hub header date: first YYYY-MM-DD on the "**Last updated:**" line.
HEADER_DATE="$(grep -m1 '^\*\*Last updated:\*\*' "$HUB" \
  | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -n1 || true)"
[ -n "$HEADER_DATE" ] || fail "could not parse a 'Last updated:' date from the plan hub"

# Newest Recently-Completed entry date: max YYYY-MM-DD across entry lines
# ("- **YYYY-MM-DD" bullets). Lexical max == chronological max for ISO dates.
NEWEST_RC="$(grep -oE '^- \*\*[0-9]{4}-[0-9]{2}-[0-9]{2}' "$RC" \
  | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | sort | tail -n1 || true)"
[ -n "$NEWEST_RC" ] || { echo "[plan-freshness] no dated Recently-Completed entries found — nothing to compare."; exit 0; }

if [[ "$HEADER_DATE" < "$NEWEST_RC" ]]; then
  fail "plan 'Last updated' date ($HEADER_DATE) is older than the newest Recently-Completed entry ($NEWEST_RC). Bump the header in docs/IMPLEMENTATION_PLAN.md."
fi

echo "[plan-freshness] OK — header $HEADER_DATE >= newest Recently-Completed $NEWEST_RC"
