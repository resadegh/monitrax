# Changelog - 2026-06-19

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
