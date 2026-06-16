# Changelog — 2026-06-16

## Session: add-half-yearly-frequency-shk180

### Changes Made
- **Type**: Feature (cross-cutting)
- **Scope**: Frequency selection — add `HALF_YEARLY` ("Half-yearly", every 6 months, 2×/year)
- **Description**: The frequency picker (e.g. for insurance) only offered
  Weekly/Fortnightly/Monthly/Quarterly/Annually — no half-yearly, which many AU
  bills (insurance especially) use. Added `HALF_YEARLY` to the billing-cadence
  enums **`Frequency`** (expenses/income UI) and **`PayFrequency`** (income/tax),
  end-to-end. **Out of scope (by design):** `RepaymentFrequency` (loans are
  W/F/M only), `RecurrencePattern` (auto-detection internals), `DiningFrequency`
  (lifestyle) — no `HALF_YEARLY` value can reach those paths.
- **Correctness**: every annualisation switch that consumes these enums now maps
  `HALF_YEARLY → ×2/yr` (or `/6` monthly, `182d` interval), so a $215.59
  half-yearly premium annualises to $431.18 — not $215.59. The canonical
  converter + 9 independent switches (PAYG ×4, reports ×2, portfolio ×2,
  exporter ×2, reconciliation, debt-analysis) were all updated.

### Files Modified
- `prisma/schema.prisma` — `Frequency` + `PayFrequency` gain `HALF_YEARLY`
- `prisma/migrations/20260616074500_add_half_yearly_frequency/migration.sql` —
  **new**, additive `ALTER TYPE … ADD VALUE` (non-destructive)
- `lib/types/prisma-enums.ts`, `lib/validation/common.ts` — enum mirror + Zod
- `lib/utils/frequencies.ts` — canonical converter (toAnnual/periodsPerYear/Decimal)
- `lib/tax-engine/core/paygCalculator.ts`, `lib/tax-engine/types.ts`,
  `lib/tax-engine/income/salaryProcessor.ts` — PAYG conversions + label
- `lib/reports/contextBuilder.ts`, `lib/intelligence/portfolioEngine.ts`,
  `lib/testing/exporter.ts`, `lib/utils/reconciliation.ts` — independent switches
- `app/api/tax/route.ts`, `app/api/tax/salary/route.ts`,
  `app/api/income/route.ts`, `app/api/income/[id]/route.ts`,
  `app/api/ai/debt-analysis/route.ts`,
  `app/api/documents/analyze-for-form/route.ts` — API validation/mapping/options
- `components/ExpenseDialog.tsx`, `components/recurring/CreateExpenseFromRecurring.tsx`,
  `components/transactions/TransactionLinkDialog.tsx` (×2),
  `app/dashboard/income/page.tsx` — "Half-yearly" dropdown option
- `tests/utils/frequencies.test.ts`, `tests/utils/frequencies.decimal.test.ts` —
  HALF_YEARLY coverage (incl. the insurance-premium correctness guard)
- `docs/architecture/03_DATA_MODEL.md` — Expense frequency union

### Phase 41E reform compliance (CLAUDE.md §12.14)
- Touches `lib/tax-engine/*` (paygCalculator, types, salaryProcessor). The added
  functions/cases are pure frequency-annualisation math — outcome **(b)**: no
  post-reform number changes, no regime branch, defaults preserved (FW-2 wall
  intact). No new field on `Property`/`Investment`/`LegalEntity` (FW-3 N/A); no
  AI tool added (FW-4 N/A); no per-asset tax UI (FW-5 N/A). No tax-engine test
  regressed (1035/1035 green across tax-engine/cashflow/calculations/intelligence).

### Testing
- [x] `npx tsc --noEmit` clean (only pre-existing tsconfig baseUrl warning)
- [x] `npm run build` passes
- [x] `npx vitest run` — frequencies + decimal (64) and tax/cashflow/calculations/
  intelligence (1035) all green
- [x] `npx next lint --file` on 22 changed files — no errors (2 pre-existing
  exhaustive-deps warnings in touched files, unrelated to the one-line additions)

### Notes
- **Destructive write (§12.11):** none. The migration is additive
  `ALTER TYPE … ADD VALUE IF NOT EXISTS` — no row mutation, no column drop.
- **Schema change (§12.12):** matching migration shipped in the same commit.

---

## Session: document-upload-camera-capture-shk180

### Changes Made
- **Type**: Feature
- **Scope**: Document intelligence — mobile camera capture + global "Scan a receipt"
- **Description**: Surfaced the existing (Phase 25/26) AI document-recognition
  engine where mobile users actually are. Two parts:
  1. **Camera capture in forms (code-first tweak).** `FormDocumentUpload`
     (used by the Expense / Loan / Income / Balances / Transaction dialogs)
     gained a native **"Take photo"** affordance — a second hidden input with
     `capture="environment"` — shown only on touch devices (`pointer: coarse`).
     The existing "Choose File" / drop-zone upload is unchanged, so every
     dialog now offers *both* snap-a-photo and pick-a-file. The pre-existing
     `Camera` icon was decorative; it now has a working button beside it.
  2. **Global mobile "Scan a receipt" (Stitch-first composition).** A new
     `GlobalScanReceipt` component renders a sky→indigo camera **FAB** above
     the editorial bottom nav (mobile only) that opens a glass bottom sheet:
     Take photo / Choose a file → AI reads it → a result preview (vendor,
     amount, GST, date, category with a confidence pill) → one-tap confirm.
     It rides the **canonical pipeline** with no new create logic:
     `useDocumentUpload` → `POST /api/documents/upload` (DME) →
     `POST /api/documents/analyze` (DIE, persists the analysis so it also
     lands in the Smart Inbox) → `POST /api/documents/analyze/confirm`
     (creates the Expense/Income/Loan from the top suggested action). Nothing
     is written until the user taps the primary CTA.

### Files Modified
- `components/documents/FormDocumentUpload.tsx` — added `capture="environment"`
  camera input + "Take Photo" button (compact + full variants), touch-only via
  `pointer: coarse`.
- `components/documents/GlobalScanReceipt.tsx` — **new**. FAB + capture/analyze/
  result/success/error bottom sheet. Mirrors `MoreSheet` chrome (Esc + scroll
  lock + ARIA + motion-safe slide-in). In-app glass vocabulary (§18.7.2).
- `components/DashboardLayout.tsx` — mount `<GlobalScanReceipt />` (mobile-only,
  hidden during onboarding).
- `.stitch/designs/phase49-scan-receipt/*` — Stitch artefacts (capture + result,
  light + dark) HTML + PNG.

### Documentation Updated
- `docs/blueprint/PHASE_26_DOCUMENT_INTELLIGENCE_ENGINE.md` — new §26.7.
- `docs/architecture/06_UI_UX_FOUNDATION.md` — mobile scan-sheet + camera-capture
  pattern note.
- `docs/implementation/04_RECENTLY_COMPLETED.md` + `docs/IMPLEMENTATION_PLAN.md`
  (hub date).

### Testing
- [x] `npx tsc --noEmit` — clean (only the pre-existing `tsconfig baseUrl`
  deprecation warning).
- [x] `npm run build` — passes (full route manifest emitted).
- [x] `npx next lint --file` on the three changed files — no warnings or errors.
- [ ] Manual on-device camera test — pending (requires a physical phone; the
  `capture` path is OS-native so cannot be exercised in CI).

### Notes / boundaries
- **No schema change** (§12.12 N/A) and **no destructive Prisma write**
  (§12.11 N/A) — the component only calls existing API routes.
- **Financial-correctness:** entity creation is delegated entirely to the
  canonical confirm route; this PR introduces no new frequency/category
  defaulting. (The confirm route's existing receipt→`MONTHLY` default is
  pre-existing behaviour and out of scope — flagged as an open question.)
- Assets-page upload affordance and a My-Vault discoverability link were
  **deliberately not built** this PR (Reza chose camera-in-forms + global scan).
