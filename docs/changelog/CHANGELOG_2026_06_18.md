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
