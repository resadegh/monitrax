# Changelog - 2026-06-11

## Session: serene-goodall-6smazx (continued)

### Changes Made
- **Type**: Feature + Redesign
- **Scope**: Activity page (`/dashboard/activity`) + AI categorisation confirmation
- **Description**: Phase 49 — full Stitch-first redesign of the Activity page to the
  Phase 39 glass vocabulary, plus confidence-based bulk confirmation of AI
  categorisations (Reza directives 2026-06-11: "Perform a redesign of the whole page
  based on the design principles and the stitch UI … included the swipe options
  specially on mobile view" + "there should be a bulk confirmation based on the
  confidence level").

### Stitch-first compliance (CLAUDE.md §18)
Project `1859462351962811110`; 4-variant matrix per §18.7.2 dark-mode enforcement:
| Variant | Screen ID |
|---|---|
| Desktop light | `351c6db2f6f34996a93da26f60c47a2b` |
| Desktop dark | `c86cfc05ff8d4a129bc1c608d7748a55` |
| Mobile light | `1f2e9df37c16409c99a448871ff69277` |
| Mobile dark | `fa6a2ea95aab4679be793c2cc8144927` |
Artefacts committed at `.stitch/designs/activity-redesign/*.{html,png}`. Generation
prompts seeded with the §18.7.2 digest verbatim (warm ivory, glass recipe + exact
shadow values, radius hierarchy, money-signal rules, gems, tabular-nums,
behaviour-psychology framing); mobile applied §18.7.6 Compact Dashboard mechanics.
Direction approved by Reza before React ("generate the dark version and ship it").

### Files Modified
- `lib/bank/bulkConfirm.ts` — NEW canonical service: `getConfidenceSummary()` +
  `bulkConfirmCategorisations()` (band or explicit ids; promotes confidenceScore to
  1.0 — the established "user validated" convention from bulk-categorise — and
  reinforces MerchantMapping with `lastConfirmedAt`; never overwrites USER-source
  mappings; no category mutation; no schema change needed)
- `app/api/unified-transactions/bulk-confirm/route.ts` — NEW thin route: GET summary
  + POST confirm (`withPermission` transaction.read/write)
- `components/bookkeeping/ConfidenceReviewCard.tsx` — NEW "Your AI bookkeeper" hero
  card: segmented emerald/amber/rose confidence bar, "Confirm all N medium" primary
  gradient action, "Review N low" → card-stack review, celebratory copy, self-hides
  when tidy
- `app/dashboard/activity/page.tsx` — glass restyle (hero card list, search,
  advanced panel, day-group cards), §18.7.2 polished KPI tiles (rose/emerald/brand-
  gradient/violet gems + top-accent strips), §18.7.6 mobile KPI swipe strip
  (snap-mandatory, 78vw tiles with peek, page dots), per-row confidence dots
  (always-visible when < 0.9), "✓ Looks right" single-row confirm chip, mobile
  category pill under merchant, swipe-affordance hint line, reviewLowMode wiring
  into the existing ReviewQueueCards stack

### Architecture decisions
- **No schema migration**: "confirmed" = `confidenceScore: 1.0`, the same value
  bulk-categorise writes — §12.12 avoided entirely
- **Confirmation ≠ correction**: bulk-confirm never touches the category triple or
  `userCorrectedCategory`; corrections stay on the PATCH/bulk-categorise paths
- **One endpoint per concern (§12.4)**: bulk-confirm (accept AI as-is) is distinct
  from bulk-categorise (re-categorise to a user-chosen triple)
- **TransactionReviewQueue rows deliberately not updated** — import-time staging
  with no UI (🗑️ row 31); confirming live transactions is the user-facing truth

### Testing
- [x] tsc clean
- [x] 458/458 tests (tests/bookkeeping + tests/ai)
- [x] Build passes

