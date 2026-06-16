# Changelog — 2026-06-16

## Session: asset-document-upload-shk180 (Phase A — AI document router foundation)

### Context
Reza's vision: every document/receipt should be (a) recognised by AI, (b)
attached to the correct item/asset OR used to create a new item/expense, and
(c) filed in the right Vault folder for future reporting/extraction. Building
in 3 phases (A: foundation + fix the live scan bug; B: attach-to-existing /
transaction-match intelligence; C: per-item Documents sections + Tax-pack).

### Changes Made (Phase A)
- **Fix: global "Scan a receipt" recognition (the live bug).** Reza scanned a
  receipt and it "only stored to Vault without identifying it." Prod logs:
  `POST /api/documents/analyze` returns **500** on a freshly-uploaded photo
  (reaches OCR then throws — NOT storage-read, NOT Vision-config; both
  eliminated via log queries). The scan's two-step path (upload → re-read
  stored file → analyze) is unreliable in prod. **Rewired `GlobalScanReceipt`
  to the proven single-step `/api/documents/analyze-for-form`** (the exact path
  the expense/income forms already use successfully): it OCRs the in-hand
  upload + Gemini-maps to expense fields + files the doc as a RECEIPT. The
  result preview now renders vendor/amount/GST/date/category from the returned
  `fieldMappings`; "Add expense" creates via `/api/expenses`.
- **Feature: `ASSET` is now a linkable document type.** Previously documents
  could link to property/loan/expense/income/accounts/investments/transactions
  but NOT assets — so a receipt couldn't be tagged to a vehicle. Added `ASSET`
  end-to-end: `LinkedEntityType` enum (schema + migration + TS mirror),
  `EntityContext.assetId`, the upload route's entity map, the `useDocumentUpload`
  hook's `LINK_FIELD_BY_ENTITY`, a new `asset_direct` rule in the DME
  `LinkingRules`, and the `DocumentList` entity-label map. This is the
  foundation Phase C's asset Documents section builds on.

### Files Modified
- `components/documents/GlobalScanReceipt.tsx` — rewired to analyze-for-form
- `prisma/schema.prisma` + `prisma/migrations/20260616093000_add_asset_linked_entity_type/migration.sql`
- `lib/documents/types.ts`, `lib/documents/engine/types.ts`,
  `lib/documents/engine/rules/LinkingRules.ts`,
  `app/api/documents/upload/route.ts`, `hooks/useDocumentUpload.ts`,
  `components/documents/DocumentList.tsx`

### Testing
- [x] `npx tsc --noEmit` clean (only pre-existing tsconfig baseUrl warning)
- [x] `npm run build` passes
- [x] `npx next lint --file` on changed files — no errors (1 pre-existing
  `<img>` warning in DocumentList, unrelated)

### Notes / boundaries
- **§12.11:** no destructive write — migration is additive
  `ALTER TYPE "LinkedEntityType" ADD VALUE IF NOT EXISTS 'ASSET'`.
- **§12.12:** schema change paired with the migration in the same commit.
- **Completeness review delivered to Reza (gaps for Phase B/C):** iPhone HEIC
  handling, duplicate-receipt detection, owning-legal-entity linking + multi-link,
  ATO 5yr retention + Tax-pack export, renewal-date tie-in, per-item Documents
  sections everywhere, security/PII (encryption, no-log, purge-on-deletion,
  household access), storage-at-scale (GCS vs bytea), delete/unlink/version
  lifecycle. Logged for sequencing.
- **Q-SCAN-FREQ** still applies — the scan's "Add expense" defaults frequency
  to MONTHLY (existing convention); Phase B's attach-or-create flow supersedes it.

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
