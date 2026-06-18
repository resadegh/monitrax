# Changelog - 2026-06-18

## Session: dme-d4-learned-routing-shk180

### Changes Made
- **Type**: Feature (Phase 50 D.4) + load-bearing decision record
- **Scope**: Document Intelligence Engine — learned routing (suggest-only) +
  the autonomy model decision.
- **Root Cause / Why**: Phase 50 D.4 ("smart routing") was the next
  engine-intelligence step. The path rules were deterministic; this makes them
  *learned* — if a user repeatedly files documents from a vendor under a given
  asset/property, the next document from that vendor pre-selects it. Reza's
  direction made the boundary explicit: **the AI suggests, the user always
  confirms** — pre-select, never auto-apply.
- **Solution**:
  - **Autonomy decision (Reza 2026-06-18):** AI always suggests; the user
    ALWAYS confirms and can edit; **bulk-approve** is the only sanctioned
    convenience; **no silent auto-execution**. Recorded in the Phase 50
    Decisions log. Consequence for D.3: auto-EXECUTION is now **rejected, not
    deferred** — the AUTO band is a display/priority cue only.
  - **D.4 learned routing (suggest-only):** new `VendorEntityHint` table +
    canonical `lib/documents/intelligence/learnedRouting.ts`. Records
    `(userId, vendorKey, entityType, entityId)` routings (count++) at the
    document-link chokepoints; reads the most-chosen routing to **pre-select**
    the entity in the scan flow's "What is this for?" selector with a
    "Suggested for you" cue. The user always confirms and can change it.

### Files Modified / Added
- `prisma/schema.prisma` — new `VendorEntityHint` model + `User` back-relation.
- `prisma/migrations/20260618090000_add_vendor_entity_hints/migration.sql` —
  additive table + indexes + FK (§12.12).
- `lib/documents/intelligence/learnedRouting.ts` (NEW) — canonical SSOT:
  `normalizeVendorKey`, `isRoutableEntityType`, `recordVendorEntityHint`,
  `getVendorEntityHint`, `recordHintFromDocument`.
- `app/api/documents/vendor-hint/route.ts` (NEW) — `GET ?vendor=` → suggested
  routing (thin wrapper over the service).
- `app/api/documents/[id]/link/route.ts` — fire-and-forget hint recording on
  link to a routable entity.
- `app/api/documents/analyze/confirm/route.ts` — record vendor→property/loan/
  asset hint on CREATE_EXPENSE attribution + LINK_TO_PROPERTY.
- `components/documents/GlobalScanReceipt.tsx` — pre-select the suggested target
  (suggest-only) + "Suggested for you" cue + sky-ring on the suggested pill.
- `tests/documents/learnedRouting.test.ts` (NEW) — 14 unit tests.
- `lib/services/accountReset.ts` — classify `VendorEntityHint` in
  `RESET_DELETE_MODELS` (CI guard `accountReset.classification.test.ts` requires
  every user-owned model be classified). A "Start fresh" reset wipes the routing
  memory — it references assets/properties the reset also deletes, so keeping it
  would dangle. Not CDR-lifecycle-owned, not identity → delete.

### Docs Updated
- `docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md` — Decisions log (autonomy
  model), D.3 capability (auto-exec rejected), D.4 capability (shipped,
  suggest-only), phased-build table, D.4/D.5 status.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — 0·DOC: D.3 ✅, D.4 ✅,
  bulk-approve queued; Last touched.
- `docs/IMPLEMENTATION_PLAN.md` — hub Last updated.

### Build Status
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` passes (exit 0)
- [x] `next lint` clean on changed files
- [x] `vitest run tests/documents/learnedRouting.test.ts` — 14/14 pass

### Destructive write checklist (CLAUDE.md §12.11)
- `prisma.vendorEntityHint.upsert(...)` in `learnedRouting.ts`.
  1. **`where` clause matches:** the unique tuple
     `(userId, vendorKey, entityType, entityId)` — a row this code path
     exclusively creates and owns.
  2. **Columns overwritten:** `count` (increment) + `lastUsedAt` only — never
     user-entered financial data. The `create` branch sets the row from scratch.
  3. **Guard:** the unique composite key. The `update` branch can only fire on a
     routing this same function created. SAFE.
  - User confirmation: NOT REQUIRED — no user data is mutated; the table is a
    new, code-owned routing-memory store.

### Phase 41E reform compliance (CLAUDE.md §12.14)
- N/A — no tax-engine file, no financial calc, no column on
  `Property`/`Investment`/`LegalEntity`, no AI tool, no per-asset tax UI.
  `VendorEntityHint` is a routing-memory table unrelated to tax regime.

### Stitch / §18.2.1
- No new section-level composition. The "Suggested for you" cue is a true tweak
  *within* the already-approved "What is this for?" selector (a cue + a
  pre-selection state on existing pills) — code-first is permitted.

---

## Session: dme-d5-retention-clock-shk180

### Changes Made
- **Type**: Feature (Phase 50 D.5b — lifecycle intelligence, retention clock)
- **Scope**: Document Intelligence Engine — ATO retention-clock advisory.
- **Why**: D.5 lifecycle. The retention half ("which documents are safe to
  archive?") is pure, read-only advice — autonomy-safe and shippable now. The
  renewal-extraction half (D.5a — writing an expiry date onto a user's asset so
  the existing reminder engine lights up) writes to a user row, so per the
  autonomy decision it must be suggest→confirm = a new UI surface = Stitch-first;
  deferred.
- **Solution**: new pure `lib/documents/intelligence/retentionClock.ts`:
  `computeRetentionStatus(date, category)` applies the ATO 5-year rule — 5 years
  after the END of the document's financial year (conservative; errs toward
  RETAIN) — to tax-substantiation categories only (RECEIPT/INVOICE/TAX/
  STATEMENT). Returns `RETAIN | ARCHIVE_SAFE | NO_CLOCK` + warm label +
  `retainUntil`. Contracts/leases/insurance/PDS/valuations get `NO_CLOCK` (they
  have ongoing legal/reference value — never nudge binning them). Surfaced
  computed (not stored — SSOT) on `/api/documents`; `DocumentList` shows a quiet
  "Safe to archive" pill on `ARCHIVE_SAFE` docs only. **Advice only — the app
  never auto-archives** (autonomy decision + financial-adviser lens).

### Files Modified / Added
- `lib/documents/intelligence/retentionClock.ts` (NEW) — pure engine:
  `computeRetentionStatus`, `extractDocumentDate`, `ATO_RETENTION_YEARS`.
- `app/api/documents/route.ts` — compute + add `retention` to each list item
  (additive, advisory).
- `components/documents/DocumentList.tsx` — `retention` on the item type + a
  quiet "Safe to archive" pill (true tweak — a cue on an existing row).
- `tests/documents/retentionClock.test.ts` (NEW) — 10 unit tests.

### Docs Updated
- `docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md` — D.5 capability (D.5b shipped,
  D.5a deferred Stitch-first), status line.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — 0·DOC D.5 row + Last touched.
- `docs/IMPLEMENTATION_PLAN.md` — hub Last updated.

### Build Status
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` passes
- [x] `next lint` clean on changed files (pre-existing `<img>` warnings only)
- [x] `vitest run tests/documents/retentionClock.test.ts` — 10/10 pass

### Destructive write checklist (CLAUDE.md §12.11)
- None. The retention clock is pure + read-only — no Prisma writes, no schema
  change, no deletion (it only *advises* "safe to archive"; the user acts).

### Phase 41E reform compliance (CLAUDE.md §12.14)
- N/A — not a tax-engine file (no CGT/neg-gear/trust/FBT/PAYG calc); the ATO
  5-year record-retention rule is administrative, not a reform-affected tax
  computation. No `Property`/`Investment`/`LegalEntity` column, no AI tool, no
  per-asset tax position UI.

### Doc-sync (CLAUDE.md §16)
- API contract: `/api/documents` gains an additive advisory `retention` field —
  documented in the Phase 50 doc (the feature's canonical spec). No schema, no
  infra, no identity/deploy/security surface. Component change is a true tweak
  (§18.2.1) — a pill on an existing row, not a new section composition.

---

## Session: dme-d1.1-scan-dedup-shk180

### Changes Made
- **Type**: Fix / hygiene (Phase 50 D.1.1 — close the dedup bypass on the scan path).
- **Scope**: Document Intelligence — the global "Scan a receipt" + form-autofill upload.
- **Root Cause**: `/api/documents/analyze-for-form` called the **legacy**
  `documentService.uploadDocument()`, which has no content-hash dedup. The D.1
  dedup (SHA-256 `(userId, contentHash)` lookup) lives in the DME
  `processUpload()` chokepoint — so the scan path bypassed it and a re-scan of
  the same receipt stored a duplicate.
- **Solution**: rewired that one call to `DocumentManagementEngine.processUpload()`
  via `createUploadContext`, with `source` mapped from the form type
  (`EXPENSE_FORM`/`INCOME_FORM`/`LOAN_FORM`/`PROPERTY_FORM`). The scan path now
  inherits the dedup + per-user storage-quota enforcement for free; a
  byte-identical re-scan returns the existing document. Only `documentId` is
  consumed downstream (the `signedUrl`→`storageUrl` field swap is inert — the
  client never read it). Left the other legacy caller (`/api/documents` POST,
  deprecated since Phase 38 PR2.5) as-is (out of scope, low traffic).

### Files Modified
- `app/api/documents/analyze-for-form/route.ts` — swap legacy `uploadDocument`
  → DME `processUpload`; import the engine helpers; map form type → source.

### Docs Updated
- `docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md` — D.1.1 capability + status.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — 0·DOC D.1.1 row.
- `docs/IMPLEMENTATION_PLAN.md` — hub Last updated.

### Build Status
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` passes
- [x] `vitest run tests/documents/` — 59/59 pass

### Destructive write checklist (CLAUDE.md §12.11)
- None. No new Prisma write/delete — `processUpload`'s own writes (create +
  dedup-link `createMany skipDuplicates`) were checklisted in the D.1 PR. No
  schema change (D.1's `contentHash` migration already deployed).

### Phase 41E reform compliance (CLAUDE.md §12.14)
- N/A — document-upload plumbing; no tax-engine file, no financial calc, no
  schema column on `Property`/`Investment`/`LegalEntity`, no AI tool, no
  per-asset tax UI.

### Doc-sync (CLAUDE.md §16)
- No covered surface changed: not a visual/design, config, infra, identity,
  deploy, or security-posture change. API behaviour is hardened (dedup now
  applies) but the contract is unchanged — documented in the Phase 50 doc.

---

## Session: dme-d6-bulk-approve-inbox-shk180

### Changes Made
- **Type**: Feature (Phase 50 D.6 — bulk-approve Smart Inbox), Stitch-first.
- **Scope**: My Vault / Documents — the AI-review surface.
- **Why**: The sanctioned autonomy convenience from the 2026-06-18 decision —
  with always-confirm, a user who trusts the AI needs a fast path to approve
  many recognised documents at once, while every item stays explicit + editable
  (no silent writes). Reza: *"the user can always have the option to bulk approve
  … but the confirmation and the option for user to edit the ai findings should
  always be there."*
- **Solution**: replaced the existing inline Smart Inbox (Phase 38 PR2,
  one-tap-per-row) — per §12.1, NOT a duplicate — with a dedicated
  `components/documents/SmartInbox.tsx`: (1) multi-select with the D.3 **AUTO
  band pre-selected**; (2) per-row **inline edit** of vendor/amount/date/category;
  (3) **"Approve N selected"** looping the SAME SSOT confirm path
  (`handleConfirmAnalysis` → `POST /api/documents/analyze/confirm`) once per item
  (D.2 reconcile + receipt-match per item; no batch shortcut, no background
  writes); (4) the approved Track glass design. No new endpoint (§12.4).

### Files Modified / Added
- `components/documents/SmartInbox.tsx` (NEW) — the bulk-approve component;
  bands via `confidencePolicy` (D.3 SSOT); JSDoc carries the autonomy contract +
  Stitch screen IDs.
- `app/dashboard/documents/page.tsx` — mount `<SmartInbox>`; remove the inline
  inbox JSX + the now-dead `summariseExtractedData` / `confidenceTone` /
  `formatActionLabel` helpers + orphaned imports (§12.1).
- `tests/components/SmartInbox.test.tsx` (NEW) — 6 tests pinning the autonomy
  contract (D.3 reuse, AUTO-only pre-select, reassurance copy, per-item confirm,
  edits-win).
- `.stitch/designs/phase50-smart-inbox/` (NEW) — 4-variant matrix HTML+PNG
  (desktop/mobile × light/dark).

### Docs Updated
- `docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md` — D.6 capability + Stitch IDs +
  status line.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — 0·DOC D.6 row.
- `docs/IMPLEMENTATION_PLAN.md` — hub Last updated.

### Build Status
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` passes
- [x] `next lint` clean on changed files (pre-existing warnings only)
- [x] `vitest run tests/components/SmartInbox.test.tsx` — 6/6 pass

### Destructive write checklist (CLAUDE.md §12.11)
- None. No Prisma writes in this PR — the component calls the existing confirm
  endpoint (whose own writes were checklisted in their PRs). No schema change.

### Phase 41E reform compliance (CLAUDE.md §12.14)
- N/A — UI surface; no tax-engine file, no financial calc, no schema column on
  `Property`/`Investment`/`LegalEntity`, no AI tool, no per-asset tax UI.

### Stitch / §18.2.1 + §18.7.2
- New in-app section composition → Stitch-first. Design approved by Reza before
  React. Full 4-variant matrix generated + committed (desktop/mobile × light/dark)
  per §18.7.2 dark-mode enforcement. Screen IDs:
  `ded7fd42483e4944978eaec88e2d283e` (desktop light),
  `939521f984694b55984d3c423c28003a` (desktop dark),
  `6ae7b7cb73874bae82e5d1d751d284b2` (mobile light),
  `da7e1e4903c34517b0b26e79a32f74e8` (mobile dark). Prompts seeded with the
  §18.7.2 in-app glass vocabulary (not Stitch defaults). No new design primitive
  (token/palette/glyph) — composition over existing primitives, so no
  06_/08_ token entry required; JSDoc on the component carries the design rules.
