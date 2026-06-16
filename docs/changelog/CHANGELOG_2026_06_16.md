# Changelog — 2026-06-16

## Session: gcs-factory-keyless-gate-shk180 (fix — factory GCS-detection must accept keyless)

### Why (root cause)
While provisioning keyless GCS in prod (Reza granting `vercel-monitrax-db`
`objectUser` on the bucket, about to delete `GCS_SERVICE_ACCOUNT_KEY`), Reza
asked *"are you sure the app won't break by deleting the key?"* — and it would
have. The keyless PR (#1126) made the **provider** keyless-capable but left the
**factory's** GCS-detection gate still requiring the key:

```ts
// BEFORE (lib/documents/storage/factory.ts) — required the key:
const isGCSConfigured = !!(GCS_PROJECT_ID && GCS_BUCKET_NAME && GCS_SERVICE_ACCOUNT_KEY);
```

So deleting `GCS_SERVICE_ACCOUNT_KEY` would make `isGCSConfigured` false → the
factory builds **no** GCS provider → `getDefaultProvider()` returns Monitrax (DB)
→ **new uploads silently route to Postgres bytea instead of keyless GCS.** No
crash, no error — just the wrong backend. Caught before any prod change.

### What changed
```ts
// AFTER — pure, testable; accepts a key OR the keyless WIF env:
export function computeGcsConfigured(env = process.env): boolean {
  const hasLocation = !!(env.GCS_PROJECT_ID && env.GCS_BUCKET_NAME);
  const hasKey = !!env.GCS_SERVICE_ACCOUNT_KEY;
  const hasKeylessWif = !!(env.GCP_WORKLOAD_IDENTITY_PROVIDER && env.GCP_SERVICE_ACCOUNT_EMAIL);
  return hasLocation && (hasKey || hasKeylessWif);
}
const isGCSConfigured = computeGcsConfigured();
```
The startup log now also reports `keylessWif: available|NOT available`.

### Blast radius (what this touches, what it does NOT)
- **Touches ONLY** the factory's "should I use GCS as default?" decision.
- **Backward-compatible:** with the key still set, `hasKey` is true → `isGCSConfigured`
  true → **identical** behaviour to before (key path). Nothing changes until the
  key is removed.
- **No change** to the provider's auth, the download route, readUrl, the quota,
  or the DB. No schema change, no destructive write.
- Local dev: WIF env absent + no key → `isGCSConfigured` false → Monitrax DB (unchanged).

### Rollback (if anything misbehaves)
1. **Code rollback:** revert this commit → `isGCSConfigured` reverts to requiring
   the key. Safe as long as the key env var is present.
2. **Runtime rollback (fastest, no deploy of code):** re-add
   `GCS_SERVICE_ACCOUNT_KEY` (the `monitrax-backend` base64 key) in Vercel +
   redeploy → `initialize` checks the key first, so GCS instantly reverts to the
   known-good key path regardless of this change. **Keep the `monitrax-backend`
   key recoverable until keyless is proven in prod.**
3. **Fall all the way back to DB:** unset `GCS_BUCKET_NAME` → `isGCSConfigured`
   false → Monitrax DB. (Existing GCS docs still *read* fine via the provider.)

Full operational reference: `PHASE_50_AI_DOCUMENT_ROUTER.md` § "Storage backend —
how it resolves, and how to roll back".

### Files Modified
- `lib/documents/storage/factory.ts` — `computeGcsConfigured()` (key OR keyless WIF)
- `tests/documents/gcsConfigured.test.ts` — **new**, 5 tests (keyless-true, key-true, missing-location, no-auth, partial-WIF)
- `docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md` — storage-resolution + rollback runbook section

### Testing
- [x] `npx vitest run tests/documents/gcsConfigured.test.ts` — 5/5 green
- [x] `npx tsc --noEmit` clean; `npm run build` + financial-surfaces gate green

### Cutover state (2026-06-16)
- ✅ Bucket `monitrax-documents` exists; `monitrax-backend` (key) + `vercel-monitrax-db` (keyless, `objectUser`) both have access.
- ✅ Vercel prod has `GCS_PROJECT_ID` + `GCS_BUCKET_NAME` + (still) `GCS_SERVICE_ACCOUNT_KEY` → GCS active **via the key today**.
- ⏭️ After this PR merges: delete `GCS_SERVICE_ACCOUNT_KEY` + redeploy → keyless engages. Then verify from logs.

## Session: gcs-keyless-wif-shk180 (Phase B — keyless GCS auth + GCS-aware download)

### Context
Reza chose the keyless route (recommended) for GCS storage: no static
service-account key — reuse the same Workload Identity Federation identity the
database already uses. This makes the GCS provider usable on Vercel without a
credential, and makes document reads work end-to-end for GCS-stored files.

### Changes Made
- **Keyless WIF auth for GCS.** New canonical `lib/gcp/wifAuthClient.ts` —
  `buildGcpWifAuthClient()` returns a google-auth-library `external_account`
  (`IdentityPoolClient`) that mints impersonated SA access tokens from the Vercel
  OIDC token (byte-identical config to `lib/db.ts`'s inline Cloud SQL client; kept
  as a separate helper to avoid touching CDR-critical DB auth). The GCS provider's
  `initialize` now resolves auth in order: **key** (`GCS_SERVICE_ACCOUNT_KEY`, legacy)
  → **keyless WIF** (env present) → **ADC** (local dev). No key needed in prod.
- **GCS-aware download.** `/api/documents/download` rewritten to be provider-aware:
  verify the (provider-agnostic) HMAC signature → look up the `Document` by
  `storagePath` → **stream bytes from the right backend** (DB bytea or GCS). The
  former route could only serve Monitrax DB files.
- **Read-URL policy SSOT.** New `lib/documents/storage/readUrl.ts` →
  `getDocumentReadUrl(provider, path)`: GCS+key → native v4 signed URL; **GCS keyless
  → our HMAC streaming route** (keyless can't sign locally — and the bytes never
  leave via a public URL, the better CDR posture); LOCAL_DRIVE → path; MONITRAX →
  HMAC route. Wired into `documentService.uploadDocument` + `getDocumentDownloadUrl`
  (replacing the inline per-provider branches).

### Files Modified
- `lib/gcp/wifAuthClient.ts` — **new** canonical keyless GCP auth client
- `lib/documents/storage/readUrl.ts` — **new** read-URL policy SSOT
- `lib/documents/storage/googleCloudStorageProvider.ts` — keyless `initialize`
- `app/api/documents/download/route.ts` — provider-aware streaming
- `lib/documents/documentService.ts` — use `getDocumentReadUrl`
- `lib/documents/storage/index.ts` — barrel exports
- `tests/documents/readUrl.test.ts` — **new**, 4 tests
- `docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md` — keyless shipped + simplified 3-step provisioning checklist
- `docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md` — keyless GCS env rows

### Testing
- [x] `npx vitest run tests/documents/readUrl.test.ts tests/documents/storageQuota.test.ts` — 11/11 green
- [x] `npx tsc --noEmit` clean; `npm run build` + lint + financial-surfaces gate green

### Notes / boundaries
- **§12.11/§12.12 N/A** — no destructive write, no schema change.
- **§13.6 honoured** — no static credential introduced; GCS reuses the DB's keyless WIF identity.
- **Operator action still required** to go live: bucket + IAM grant + 2 non-secret env vars (PHASE_50 §B-storage).
- The `/api/documents/analyze` 500 stays a **separate diagnostic** (not assumed fixed by GCS).

## Session: document-router-phase-b-shk180 (Phase B — per-user storage quota)

### Context
Continuation of the AI Document Router (Phase A merged & live, PRs #1122/#1123).
Reza: "document everything and continue." Storage decision: **GCS, with a
per-user quota.** This session delivers the quota half (the GCS switch itself is
operator-provisioning + the factory's existing auto-select — no code) and the
full Phase A→C documentation.

### Changes Made (Phase B — storage track, slice 1)
- **Per-user storage quota (canonical SSOT).** New
  `lib/documents/storage/storageQuota.ts`. **Drift-free by design** — usage is
  COMPUTED from `SUM(Document.size) WHERE deletedAt IS NULL` at check time, never
  a maintained counter that could desync. **Backend-independent** (counts DB
  bytea + GCS identically). Default allowance **2 GiB**, with a per-user override
  hook (`resolveQuotaBytes`) for later paid-tier/household work. Exposes
  `getStorageUsage`, `assertWithinQuota`, `StorageQuotaExceededError`.
- **Enforced at every upload path, none bypassable.** Wired into the single DME
  chokepoint `DocumentManagementEngine.processUpload` (Step 0, before any byte is
  written) AND the legacy `documentService.uploadDocument` path (the scan).
  LOCAL_DRIVE is exempt (bytes live on the user's own machine).
- **Correct HTTP semantics.** `/api/documents/upload` maps a quota breach to
  **413 Payload Too Large** (a client condition) via a new `errorCode` on
  `EngineResult` — not a generic 500.

### Files Modified
- `lib/documents/storage/storageQuota.ts` — **new** canonical quota SSOT
- `lib/documents/storage/index.ts` — barrel exports
- `lib/documents/engine/types.ts` — `EngineResult.errorCode`
- `lib/documents/engine/DocumentManagementEngine.ts` — Step-0 quota guard + 413 code
- `lib/documents/documentService.ts` — quota guard on the legacy/scan path
- `app/api/documents/upload/route.ts` — 413 mapping
- `tests/documents/storageQuota.test.ts` — **new**, 7 tests
- `docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md` — **new** phase spec (A/B/C + GCS provisioning checklist + decisions log)
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — new `0·DOC` workstream

### Testing
- [x] `npx vitest run tests/documents/storageQuota.test.ts` — 7/7 green
- [x] `npx tsc --noEmit` clean (only pre-existing tsconfig baseUrl warning)

### Notes / boundaries
- **§12.11:** no destructive write. **§12.12:** no schema change (quota is computed
  from the existing `Document.size` column — deliberately no migration, no
  counter to drift).
- **GCS cut-over is operator-provisioning, not code** — the factory auto-selects
  GCS once `GCS_PROJECT_ID`/`GCS_BUCKET_NAME`(/`GCS_SERVICE_ACCOUNT_KEY`) are set.
  Checklist + IAM in PHASE_50 §B-storage. Likely also clears the analyze 500.
- **Next slices:** GCS-aware `/api/documents/download` (DB-only today); then
  B-intelligence (`ATTACH_TO_*` actions + entity picker + Stitch scan-UI branch).

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

### Strategic decisions (Reza, 2026-06-16) — to action in Phase B
- **DECIDED — Storage = Google Cloud Storage.** Move document/photo bytes from
  inline DB (bytea) to GCS, with a per-user quota. To be done carefully in the
  Phase B storage track: verify the prod GCS bucket + service-account access
  (likely the root cause of the unresolved `/api/documents/analyze` 500 — stored
  bytes not retrievable), add the quota, and decide migrate-vs-leave for existing
  inline docs. The DME already has a `googleCloudStorageProvider`.
- **DECIDED — Household document visibility.** Multi-*user* household accounts
  don't exist yet (today "My Household" is family members/pets as data, single
  login). Ruling for if/when multi-user is added: **all household finances,
  documents included, are shared across household users** — no per-document
  privacy. No work now; direction settled so it isn't re-litigated.

---

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
