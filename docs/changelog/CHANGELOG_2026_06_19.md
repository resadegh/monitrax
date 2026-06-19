# Changelog - 2026-06-19

## Session: tax-accountant-pack-shk180

### Changes Made
- **Type**: Feature (Unified Accountant Pack) + doc maintenance.
- **Scope**: tax-pack export (`/api/bookkeeping/tax-pack/export`) + the
  `TaxPackExportButton` on Reports.
- **Why**: Reza picked "Unified Accountant Pack" from the scoping question. The
  FY tax-pack export already shipped (Phase 42) — summary (PDF/XLSX/CSV/JSON) and
  receipts (`format=zip`) as **separate** downloads. The gap: combine them so the
  user forwards ONE file. **Per §10/§12.1 I confirmed the existing surface first
  and did NOT rebuild** — this is an orchestration layer over the canonical
  builders.
- **Solution**:
  - **`format=pack`** — new export format producing ONE ZIP:
    `Summary/Tax-Summary-FY….pdf` + `…xlsx`, plus `Receipts/` `Invoices/`
    `Tax_Documents/` and a `README.txt`.
  - **`lib/bookkeeping/taxPack/accountantPackBuilder.ts`** (NEW, orchestration
    only): reuses `buildTaxPackSummary` + `buildTaxPackPdf`/`buildTaxPackXlsx`
    (same exporters) + `addReceiptDocuments`.
  - **`zipBundleBuilder.ts`**: extracted the receipt-foldering loop into a shared
    `addReceiptDocuments(root, userId, window)` helper (§12.2 SSOT) — both the
    standalone receipt bundle and the new pack use it; behaviour byte-identical.
  - **`TaxPackExportButton`**: "Complete pack — summary + receipts" option, now
    the default.

### Files Modified / Added
- `lib/bookkeeping/taxPack/accountantPackBuilder.ts` (NEW) — `buildAccountantPack`
  + `buildAccountantPackForFy` + `suggestedPackFilename`.
- `lib/bookkeeping/taxPack/zipBundleBuilder.ts` — extracted `addReceiptDocuments`.
- `app/api/bookkeeping/tax-pack/export/route.ts` — `format=pack` branch.
- `components/bookkeeping/TaxPackExportButton.tsx` — pack option + default.
- `tests/bookkeeping/accountantPack.test.ts` (NEW) — 6 tests (ZIP assembly +
  counts + README disclaimer; deps mocked, no DB fixture).
- `docs/blueprint/MASTER_BLUEPRINT.md` — Phase 50 status refreshed (Phase D
  complete; tax-pack surfacing noted) — the §3.4 phase-status sync that was
  stale.

### Docs Updated
- `docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md` — Tax-pack (Accountant Pack)
  shipped; renewal tie-in ticked (D.5a); status line.
- `docs/blueprint/MASTER_BLUEPRINT.md` — Phase 50 row.
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — Tax-pack row; 0·DOC complete.
- `docs/IMPLEMENTATION_PLAN.md` — hub Last updated.

### Build Status
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` passes
- [x] `vitest run tests/bookkeeping/accountantPack.test.ts tests/bookkeeping/taxPackSummary.test.ts` — 15/15 pass

### Destructive write checklist (CLAUDE.md §12.11)
- **None.** Read-only export — no Prisma write/delete, no schema change.

### Phase 41E reform compliance (CLAUDE.md §12.14)
- N/A — export/bundling of existing summaries; no tax-engine file modified, no
  new financial calc (reuses `buildTaxPackSummary`), no schema column, no AI tool,
  no per-asset tax UI.

### Stitch / §18.2.1
- No new section-level composition — the only UI change is **one option added to
  an existing approved selector** (`TaxPackExportButton`), a true tweak →
  code-first permitted. The bundle itself is a server-side ZIP (no UI surface).

### Doc-sync (CLAUDE.md §16)
- API contract: the export route gains a `pack` format value (additive) —
  documented in the Phase 50 doc. No schema/infra/identity/deploy/security change.

---

## Session: Document Vault — fix "This content is blocked" preview (same-origin reads)

### Changes Made
- **Type**: Fix (document preview / read-URL policy)
- **Scope**: `lib/documents/storage/readUrl.ts` (the read-URL SSOT).
- **Problem (Reza, 2026-06-19 prod screenshots ×2)**: in My Vault, viewing a
  document showed Chrome's *"This content is blocked. Contact the site owner to
  fix the issue."* and the card image wouldn't render.
- **Root cause**: with a GCS service-account key present, `getDocumentReadUrl`
  handed the browser a **native cross-origin `storage.googleapis.com` v4 signed
  URL**. The preview frames it in an `<iframe>`, which Chrome blocks for a
  cross-origin resource (`ERR_BLOCKED_BY_RESPONSE`), and GCS serves the object
  with its own stored content-type, so an `<img>` of an `octet-stream` object
  renders broken. (The URL was valid — `getSignedUrl` only issues it after
  `file.exists()` — so the bytes were reachable; it was purely a browser
  cross-origin rendering block.)
- **Solution**: route **every** server-backed read (MONITRAX and GCS, key OR
  keyless) through our own same-origin streaming route `/api/documents/download`,
  which already downloads GCS bytes server-side and sets `Content-Type` from the
  authoritative DB `mimeType` + `Content-Disposition: inline`. Dropped the
  native-GCS-signed-URL branch (+ the now-unused `gcsHasSigningKey` helper and
  GCS import, §12.1). This is also the documented CDR-preferred posture (every
  read mediated, no public signed URL).

### Files Modified
- `lib/documents/storage/readUrl.ts` — always mediate; removed native-GCS branch.
- `tests/documents/readUrl.test.ts` — pin the new contract (GCS + key → our route,
  never a native URL). 4/4 pass.

### Build Status
- [x] `tsc --noEmit` — clean
- [x] `npm run build` — passes
- [x] `tests/documents` — green

### Doc-sync (CLAUDE.md §16)
Surfaces changed:
- [x] security / CDR posture (reads now always mediated) → `docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md` §B-storage
- [ ] config / infra / identity / deployment — none (no env/infra change; the GCS
      key may stay set, it's just no longer used to mint browser URLs)

### Notes
- Pure read-path change — no schema, no migration, no calc-engine touch. The
  download route already supported server-side GCS download (key + keyless), so
  no new server capability was needed.

---

## Session: dme-d5a-renewal-reminder-shk180

### Changes Made
- **Type**: Feature (Phase 50 D.5a — renewal/expiry → reminder), Stitch-first.
- **Scope**: the global "Scan a receipt" flow → the existing reminder engine.
- **Why**: close the last Phase D engine-intelligence item. When a scanned
  document carries a renewal/expiry date (insurance/rego/warranty), offer — calmly,
  suggest→confirm — a reminder so the existing engine nudges the user in time.
  Reuses the notification engine (Reza directive); no new engine.
- **Solution**:
  - **Extraction**: added an optional `expiryDate` field to
    `analyze-for-form`'s `DEFAULT_EXPENSE_FIELDS` — populated only for
    policy/registration/warranty docs, null for ordinary receipts.
  - **Surface (Stitch-first, "in the scan flow")**: new
    `components/documents/RenewalReminderCard.tsx` — calm sky→teal "safety-net"
    glass card (NOT money-emerald, NOT urgent amber/red). The date is pre-filled
    but **editable**; the user explicitly taps "Set reminder" or "Not now".
    Shown as a new `renewal` stage in `GlobalScanReceipt` after the expense save,
    only when a valid ISO date was extracted (`isIsoDate` gate).
  - **Write (v1)**: creates a **custom `Reminder`** via the existing
    `POST /api/reminders/custom` — a CREATE, not an update (§12.11-safe, no
    clobber of an existing asset row). `computeCustomReminders()` (same engine)
    projects it into the bell + RenewalsCard with the 30-day window. Writing the
    typed entity column (`Asset.vehicleInsuranceExpiry`) is a v2 — needs a safe
    partial-update endpoint first.

### Files Modified / Added
- `components/documents/RenewalReminderCard.tsx` (NEW) — the suggest→confirm card.
- `components/documents/GlobalScanReceipt.tsx` — `renewal` stage + `expiryDate`
  detection (`isIsoDate`) + `handleSetReminder` (custom-reminder create).
- `app/api/documents/analyze-for-form/route.ts` — `expiryDate` extraction field.
- `tests/components/RenewalReminderCard.test.tsx` (NEW) — 6 tests (autonomy/tone
  contract + create-only wiring + ISO-date gate).
- `.stitch/designs/phase50-d5a-renewal/` (NEW) — 4-variant matrix HTML+PNG.

### Docs Updated
- `docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md` — D.5a shipped (incl. the
  create-only v1 decision) + status (Phase D complete).
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — D.5/D.5a rows; Phase D complete.
- `docs/IMPLEMENTATION_PLAN.md` — hub Last updated.

### Build Status
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` passes
- [x] `vitest run tests/components/RenewalReminderCard.test.tsx` — 6/6 pass

### Destructive write checklist (CLAUDE.md §12.11)
- **None.** The only write is a custom `Reminder` **create** via the existing
  endpoint (no `update`/`upsert`/`delete`, no schema change). The v1 deliberately
  AVOIDS a partial PUT to an asset/property row precisely to sidestep the clobber
  risk — documented as the reason the typed-column write is deferred to v2.

### Phase 41E reform compliance (CLAUDE.md §12.14)
- N/A — document-scan UX + a reminder create; no tax-engine file, no financial
  calc, no schema column on `Property`/`Investment`/`LegalEntity`, no AI tool, no
  per-asset tax UI. (The `expiryDate` extraction field is on the form-autofill
  request, not a schema column.)

### Stitch / §18.2.1 + §18.7.2
- New in-app section composition (a card) → Stitch-first; design approved by Reza
  before React. Full 4-variant matrix committed (desktop/mobile × light/dark),
  prompts seeded with the §18.7.2 glass vocabulary. Screen IDs:
  `0f82f766ccc04476bb787c84bea5c496` (desktop light),
  `6884dbef6feb47df85abadc5c057c9e9` (desktop dark),
  `53b80bcd424a4cf68a972b832e649049` (mobile light),
  `9a368f8ddd234f8b97deda337e4bf530` (mobile dark). No new design primitive —
  JSDoc on the component carries the design rules + screen IDs.

### Doc-sync (CLAUDE.md §16)
- API contract: `analyze-for-form` returns an additive optional `expiryDate`
  field — documented in the Phase 50 doc. No schema, infra, identity, deploy, or
  security-posture change.

---

## Session: Wealth Universe — WX.6.1 (tap to zoom first, details second)

### Changes Made
- **Type**: Fix (UI interaction)
- **Scope**: `WealthUniverseCanvas.tsx` + `WealthUniverseMobile.tsx` tap handlers.
- **Problem (Reza, 2026-06-19 prod screenshots ×3)**: clicking an entity (e.g.
  YOU) on Level 1 zoomed into its bundles AND opened the entity detail file at
  the same time — the file greyed out the universe the user had just zoomed
  into, forcing a close before the bundles could be seen. *"First click on a
  layer change needs to only zoom in; second click should open the node
  details."*
- **Solution**: split the two actions across two taps.
  - **First tap** on an expandable bubble → **zoom in only** (`expandedIds`
    push/replace; `selectedId` cleared, so no panel).
  - **Second tap** on the centred bubble → opens its detail file (entity /
    group). A **cluster** has no file, so its second tap zooms back out
    (the breadcrumb is the other way back).
  - A leaf asset, or a holding-less entity (nothing to zoom into), opens its
    file on the first tap — unchanged.
  - Deep-link `?focus=` mirrors a manual first tap (zoom, no panel).

### Files Modified
- `components/wealth-explorer/WealthUniverseCanvas.tsx` — `handleNodeClick`
  first-tap-zoom / second-tap-details; deep-link no longer auto-selects.
- `components/wealth-explorer/WealthUniverseMobile.tsx` — same for `onTapTile`
  + deep-link.

### Build Status
- [x] `tsc --noEmit` — clean
- [x] `next lint` — clean on changed files
- [x] `npm run build` — passes
- [x] `tests/wealth-explorer/semanticZoomLayout.test.ts` — 36/36 (layout
  unchanged; this is an interaction-only change in the components, which the
  codebase does not have a test harness for).

### Doc-sync (CLAUDE.md §16)
Surfaces changed:
- [x] component pattern / interaction → `docs/architecture/06_UI_UX_FOUNDATION.md`
  (semantic-zoom section: new tap-semantics rule 7 + reviewer-reject rule 8)
- [ ] config / infra / identity / deployment / security / strategic decision — none

### Notes
- §18.2.1: interaction-behaviour tweak (tap semantics) on an approved surface —
  no new section-level composition or visual primitive → true tweak, code-first
  permitted; no Stitch pass required.
- Pure-presentation — no schema, no migration, no calc-engine touch.
- Follow-up to WX.6 (PR #1158, merged); fixes the panel-on-zoom-in interaction.

---

## Session: mobile-governance-scaffolding (0·MOB)

### Changes Made
- **Type**: Governance scaffolding + continuity-cursor refresh (docs/CI only — no code, schema, or calc surface).
- **Scope**: Implementation-plan spokes + hub, STATE.md cursor, continuity-gate workflow.
- **Why**: Stand up live tracking for the mobile companion workstream (`0·MOB`) and
  refresh the stale STATE.md web cursor (pinned at `654bc55`/2026-06-16 while the repo
  had advanced to `a0eb95e`/#1162). Governing principle encoded: **one repo = one
  STATE.md = one live-status SSOT**; spec docs separate by topic (`docs/mobile/*`),
  the continuity cursor separates by repo. The RN app (`monitrax-mobile`) gets its own
  STATE/CLAUDE/continuity-gate when stood up — this PR does NOT fork a second cursor
  inside `resadegh/monitrax`.

### Files Modified
- `docs/implementation/05_MOBILE_WORKSTREAM.md` — **NEW** spoke: the `0·MOB` live tracker
  (scope boundary, phase checklist, decision log D1–D5, open-for-Reza items incl. the D4
  notification-copy compliance blocker, cross-references to the `docs/mobile/*` spec tree).
- `docs/IMPLEMENTATION_PLAN.md` — added the 📱 Mobile Workstream row to the spoke table;
  bumped `Last updated` note (workstream registered + cursor refreshed).
- `STATE.md` — re-pinned "Last verified against HEAD" + Section C re-pin line to live HEAD
  `a0eb95e` (#1162), summarised what landed since `654bc55` (Phase 50 Phase D complete /
  0·DOC feature-complete / WX.6 / accountant tax-pack / Vault preview fix); added the
  `0·MOB` design-phase sub-cursor (additive, alongside the active web cursor).
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — registered `0·MOB` at the top with the
  standard fields, detail pointed at `05_MOBILE_WORKSTREAM.md` to avoid bloating the
  over-budget (~289 KB) spoke (§15.5).
- `.github/workflows/continuity-gate.yml` — additive: added
  `docs/implementation/05_MOBILE_WORKSTREAM.md` to the substantive-paths watch so a PR
  changing the mobile tracker must also update STATE.md + the plan in the same PR. YAML
  validated; workflow not restructured.

### Build Status
- [x] YAML parse — `continuity-gate.yml` valid (`yaml.safe_load`).
- [x] `scripts/check-plan-freshness.sh` — OK (header 2026-06-19 ≥ newest RC 2026-06-19).
- [x] No `docs/mobile/*` file modified (tracking scaffolding only — acceptance criterion).

### Doc-sync (CLAUDE.md §16)
Surfaces changed:
- [x] strategic decision (workstream `0·MOB` registered) → `docs/implementation/05_MOBILE_WORKSTREAM.md`,
  `docs/implementation/01_ACTIVE_WORKSTREAMS.md`, `docs/IMPLEMENTATION_PLAN.md`, `STATE.md`,
  `.github/workflows/continuity-gate.yml`
- [ ] visual design system / config / infra / identity / deployment / security / operational procedure — none

### Notes
- No Stitch pass required: this PR ships no UI/UX surface (§18.2 — docs/CI scaffolding only).
  The mobile design realignment (Stitch-first, §18.7) is the NEXT step, tracked in the new spoke.
- No destructive Prisma write (§12.11) and no schema change (§12.12).
