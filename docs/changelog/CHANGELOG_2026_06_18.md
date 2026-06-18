# Changelog - 2026-06-18

## Session: serene-goodall-6smazx — Phase 49.15 (Activity layout: search + filters under the AI bookkeeper tile)

Reza (live test 2026-06-18, screenshot): *"search and filters should move under the AI
Bookkeeping tile and above the transaction list."*

Previously search + the filter-chips row sat at the page top, ABOVE the "Your AI bookkeeper"
card — so the page opened on the controls before showing what the AI had done. Reordered the
Activity content column to read top-to-bottom as a clear story:

1. KPI summary strip (unchanged)
2. **Your AI bookkeeper** confidence card (moved up)
3. **Possible subscriptions** card (moved up)
4. "Uncategorised first" pill
5. **Search + filter chips** (now directly above the list)
6. Advanced filters panel
7. Transaction list / band lens

Implementation: lifted the two review cards (`ConfidenceReviewCard` + `SubscriptionsReviewCard`)
up to sit right after the KPI strip, rather than pushing the larger search markup down —
same result, minimal diff. No behaviour change; the band chips still drive the §49.14
confidence lens and the cards' `onReviewBand` still sets the active band.

§18.2.1: pure repositioning of existing approved sections (no new composition, no new
primitive) — true tweak, code-first permitted; no Stitch pass required.

### Files Modified
- `app/dashboard/activity/page.tsx` — review cards relocated above the search/filters block

### Build Status
- [x] tsc clean
- [x] Build passes (`npm run build`)

### §17.2 post-merge verification — PR #1082
- Production deploy `dpl_3dm44TVqCiizgriBa2KbxqZg8f9e` reached `READY`; runtime logs clean
  (only pre-existing DEP0169 noise).
