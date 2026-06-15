#!/usr/bin/env bash
#
# check-index-paths.sh — finding F-1(b), continuity Phase 2.
#
# Warns (or fails, in --strict) when a Markdown doc under docs/ is not
# referenced anywhere in docs/00_INDEX.md. The original F-4 found the
# index silently omitting whole doc sets (GTM, several CDR docs,
# AI_PROVIDER_STRATEGY); this guards against the index drifting behind
# the live tree again.
#
# Scope: docs/**/*.md, plus the two root continuity docs (STATE.md,
# SYSTEM_MAP.md). Intentionally-unindexed trees are skipped (changelogs,
# archive, and the per-area sub-indexes which 00_INDEX links to as
# directories rather than file-by-file).
#
# Usage:
#   scripts/check-index-paths.sh            # soft: warn, exit 0
#   scripts/check-index-paths.sh --strict   # hard:  fail, exit 1
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INDEX="${ROOT}/docs/00_INDEX.md"

STRICT=0
[ "${1:-}" = "--strict" ] && STRICT=1

emit() { # severity message
  if [ "$1" = "error" ] && [ "$STRICT" -eq 1 ]; then
    echo "::error::$2"
  else
    echo "::warning::$2"
  fi
}

[ -f "$INDEX" ] || { echo "::error::docs/00_INDEX.md not found"; [ "$STRICT" -eq 1 ] && exit 1 || exit 0; }

# Trees the index deliberately covers as a GROUP (a single rolled-up row or a
# linked sub-index), not file-by-file — skipping them keeps the signal high:
#   - changelog/ + archive/      : history, not the live map
#   - blueprint/PHASE_* + CHANGELOG_* : rolled up ("PHASE_01..PHASE_31 (~47 files)"); per-phase status lives in MASTER_BLUEPRINT
#   - operational/ + mobile/     : have their own 00_INDEX linked as a tree
#   - help/ + legal/             : app-served content, not the dev doc registry
#   - the sub-index / cross-ref files themselves
SKIP_RE='^docs/(changelog|archive|help|legal|operational|mobile)/|^docs/blueprint/(PHASE_|CHANGELOG_)|/00_INDEX\.md$|/00_CROSS_REFERENCES\.md$|^docs/BASIQ FILES/'

missing=0
while IFS= read -r f; do
  rel="${f#"${ROOT}/"}"
  echo "$rel" | grep -qE "$SKIP_RE" && continue
  base="$(basename "$rel")"
  # Indexed if the index references either the repo-relative path or the basename.
  if grep -qF "$rel" "$INDEX" || grep -qF "$base" "$INDEX"; then
    continue
  fi
  emit error "doc not referenced in docs/00_INDEX.md: $rel"
  missing=$((missing+1))
done < <(find "${ROOT}/docs" -type f -name '*.md' | sort)

# Root continuity docs must be discoverable from the index too.
for r in STATE.md SYSTEM_MAP.md; do
  if ! grep -qF "$r" "$INDEX"; then
    emit error "root continuity doc not referenced in docs/00_INDEX.md: $r"
    missing=$((missing+1))
  fi
done

if [ "$missing" -gt 0 ]; then
  echo "[index-paths] $missing doc(s) missing from docs/00_INDEX.md"
  [ "$STRICT" -eq 1 ] && exit 1 || exit 0
fi
echo "[index-paths] OK — every in-scope doc is referenced in docs/00_INDEX.md"
