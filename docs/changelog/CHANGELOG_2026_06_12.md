# Changelog - 2026-06-12

## Session: serene-goodall-6smazx — Phase 49.14 (confidence bands as list filters + the discrepancy fix)

Reza live-test report (2026-06-12, three parts): (1) transactions in the list LOOK confident
(calm category tones) while the card says nothing high/medium remains; (2) "Review low"
shows DIFFERENT items than the list; (3) wants high/medium/low as filters so each band's
transactions + confirmed status are visible and comparable. Plus the simplicity directive:
*"we need to make sure the solution is simple enough for everyone to understand."*

**Root causes found:**
1. **Pill-tint bug** — the Phase 49.12 `uncertain` check had a `> 0` guard, so rows with
   confidenceScore EXACTLY 0 (the AI-fallback rows written during the Gemini outage) never
   took the rose tint — they wore calm category tones and masqueraded as confident. Fixed:
   `confidenceScore !== null && < 0.9 && !userCorrectedCategory`.
2. **Two populations, one band name** — "Review low" listed TransactionReviewQueue items
   (imports not yet in the books) while the main list holds BOOKED low-score transactions
   (outage-era fallback rows). Different tables → different lists → Reza's discrepancy.

**Fix — the confidence bands are now plain list filters (Stitch-first per §18.2.1; design
deliberately SIMPLIFIED to one list + plain words after Reza's directive — screens
84594a33076847f6909990ceffc08e66 → simplified 05d687e487894fd988a904280f47184a, artefact
`.stitch/designs/phase49.14/confidence-lens-desktop-light.{html,png}`):**
- Three chips — High (emerald) / Medium (amber) / Low (rose) — counts now include
  EVERYTHING in the band (queue + booked) so the chip number matches what clicking shows.
- Clicking a band shows: the "New — confirm to add" card (queue items, plain-English header
  replacing the old clinical blurbs) followed by the band-filtered booked list.
- Every booked row in band mode carries a plain status chip: emerald "✓ Confirmed" vs ghost
  "Not confirmed yet" — and any unconfirmed row gets the one-tap "✓ Looks right" confirm
  (previously only uncertain rows had it).
- NEW `confidence=high|medium|low` filter on GET /api/unified-transactions (high ≥0.9,
  medium 0.7–0.9, low <0.7 incl. score-0 fallback rows; NULL = no AI, excluded).
- `getConfidenceSummary` gains txMedium/txLow (booked rows in those score ranges).

### Files Modified
- `app/api/unified-transactions/route.ts` — confidence band filter param
- `lib/bank/bulkConfirm.ts` — txMedium/txLow in the summary
- `app/dashboard/activity/page.tsx` — band chips ×3 with combined counts, band-lens render
  (queue card + filtered booked list), per-row ✓ Confirmed / Not confirmed chips, pill
  score-0 tint fix, plain-English queue header copy
- `.stitch/designs/phase49.14/confidence-lens-desktop-light.{html,png}` — NEW artefact

### Build Status
- [x] tsc clean (after `prisma generate` for the merged audit-enum values)
- [x] Build passes (`npm run build`)

### §17.2 post-merge verification — PR #1081
- Production deploy `dpl_9LdfsWTs9NUBNAVBoWGcopjsYaQa` reached `READY` after ~3 min.
  Runtime logs clean — only pre-existing DEP0169 noise.
