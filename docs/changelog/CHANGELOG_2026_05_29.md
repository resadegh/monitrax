# Changelog — 2026-05-29

## Session: asset-rego-reminders-LFNFt

### Changes Made
- **Type**: Feature (Phase 21.5 — Tier 1)
- **Scope**: Assets (My Wealth) + new canonical reminder engine + Home
- **Description**: Added vehicle registration / CTP / comprehensive-insurance
  renewal dates to assets, and built the canonical **reminder engine** that
  projects them — plus loan fixed-rate expiry, bank/CDR consent expiry, and
  warranty expiry — into a calm, in-app "Renewals & reminders" surface.

  Originating user report: creating a car as an asset had no registration /
  rego renewal date, no CTP, no insurance dates. Investigation (CLAUDE.md §10)
  confirmed: `Asset` stored the rego *plate* (`vehicleRegistration`) but no
  *dates*; and the app had **no reminder capability at all** — the Settings
  notification toggles ("Bill Reminders" etc.) persist to `UserPreference` but
  nothing reads them (per `docs/operational/runbooks/11_EMAIL_NOTIFICATIONS_AUDIT.md`).
  A full data-model sweep catalogued every reminder-worthy value (loan
  fixed-rate expiry, CDR consent expiry, warranty, property rates/insurance/
  land-tax/lease, term-deposit maturity, standalone insurance, personal docs,
  bills) — see IMPLEMENTATION_PLAN.

  **Scope decisions (Reza, this session):** Tier 1 (data + in-app, no email/
  push yet — so no toggle that lies); rego + CTP + comprehensive fields; fold
  in the "Tier A trio" of already-stored dates (loan fixed-rate / CDR consent /
  warranty) since they're ~free on the same engine; defer the high-volume
  bank-detected bills feed to Tier 2 (needs snooze/dismiss). Property /
  standalone-insurance / personal-docs producers queued as follow-up slices.

### Files Modified / Created
- `prisma/schema.prisma` — +6 nullable vehicle columns on `Asset`
  (`vehicleRegistrationExpiry`, `vehicleCtpProvider`, `vehicleCtpExpiry`,
  `vehicleInsuranceProvider`, `vehicleInsurancePolicyNumber`,
  `vehicleInsuranceExpiry`).
- `prisma/migrations/20260529100000_phase_21_5_vehicle_renewal_dates/migration.sql`
  — additive `ADD COLUMN` migration (matching schema change, §12.12).
- `lib/reminders/reminderEngine.ts` — **NEW.** Canonical, pure reminder engine
  (SSOT). Producers: vehicle renewals, warranty, loan fixed-rate expiry, bank/
  CDR consent expiry. Urgency tiers + sort + selectors + warm timing labels.
- `app/api/reminders/route.ts` — **NEW.** Thin `GET` wrapper (fetch → engine).
- `components/reminders/RenewalChip.tsx` — **NEW.** Urgency pill (presentational).
- `components/reminders/RenewalsCard.tsx` — **NEW.** Self-contained, self-hiding
  "Renewals & reminders" island (fetches `/api/reminders`).
- `app/api/assets/route.ts`, `app/api/assets/[id]/route.ts` — accept + persist
  the 6 new vehicle fields (POST + PUT).
- `app/dashboard/assets/page.tsx` — form fields (renewals sub-section), detail
  view renewals block, per-tile renewal chip, mounted `<RenewalsCard>`.
- `components/assets/AssetTile.tsx` — optional `renewal` prop → `<RenewalChip>`.
- `app/dashboard/page.tsx` — mounted `<RenewalsCard>` (self-hiding island).
- `.audit/financial-math-baseline.json` — **line-number realignment only**: the
  Home-page `<RenewalsCard>` insertion shifted 7 pre-existing baseline entries
  by +8 lines. Regenerated via `BASELINE_REGENERATE=1`; verified 27 entries
  before/after with **zero (file,pattern,match) tuples added or removed** — no
  new violations grandfathered.

### Documentation Updated
- `docs/blueprint/PHASE_21_ASSET_MANAGEMENT.md` — §8.2 + §13 (21.5) marked
  shipped; "where to replicate next" added.
- `docs/architecture/03_DATA_MODEL.md` — new `Asset` columns.
- `docs/architecture/07_API_STANDARDS.md` — `GET /api/reminders`.
- `docs/architecture/06_UI_UX_FOUNDATION.md` — RenewalsCard / RenewalChip pattern.
- `docs/IMPLEMENTATION_PLAN.md` — workstream + queued producers + deferred Tiers.

### Testing
- [x] `prisma validate` — schema valid
- [x] `tsc --noEmit` — 0 errors (whole project)
- [x] `npm run lint:financial-surfaces` — exit 0 (baseline realigned)
- [x] `next build` — ✓ Compiled successfully

### Destructive write checklist (CLAUDE.md §12.11)
N/A — the only schema change is 6 nullable additive `ADD COLUMN`s. No
`update`/`upsert`/`delete`/`updateMany`/`deleteMany` on existing rows; no
backfill; no `DROP`/`ALTER ... DROP`/`TRUNCATE`. No existing data touched.

### PR
- Branch: `claude/asset-rego-reminders-LFNFt`
- Status: Merged (PR #921)

---

## Session: mobile-date-input-fix-LFNFt

### Changes Made
- **Type**: Fix (mobile rendering)
- **Scope**: `components/ui/input.tsx` (canonical text-field primitive)
- **Root Cause**: The shared `<Input>` uses `display:flex` (needed for `file:`
  inputs). iOS Safari renders `<input type="date">` with `display:flex` as
  oversized empty boxes (a long-standing WebKit bug). Reported on the vehicle
  "Renewals & reminders" form (Phase 21.5 / PR #921): date fields ballooned on
  mobile while insurer text fields rendered normally — exactly the flex-only-
  affects-date asymmetry the bug produces.
- **Solution**: At the SSOT — for date-like input types (`date` / `time` /
  `datetime-local` / `month` / `week`) append `block min-w-0 appearance-none`;
  `twMerge` keeps the later display utility so `flex` is dropped only for those
  types. Fixes every date input app-wide (assets, properties, settings, …),
  not just the reported surface. Text + `file:` inputs untouched.

### Files Modified
- `components/ui/input.tsx` — date-like types get `block` instead of `flex`.

### Build Status
- [x] `tsc --noEmit` — 0 errors
- [x] `npm run lint:financial-surfaces` — exit 0

### PR
- Branch: `claude/mobile-date-input-fix-LFNFt`
- Status: Merged (PR #922) — prod deploy `dpl_Fq2dXqXdgcwVfwmjxpfJmDQEReU1` READY.

---

## Session: property-renewals-LFNFt

### Changes Made
- **Type**: Feature (Phase 21.5 — R3 producer)
- **Scope**: Properties (My Wealth) + canonical reminder engine + reminders API
- **Description**: Added property renewal dates and projected them through the
  existing canonical reminder engine — the direct continuation of the Tier 1
  vehicle work (PR #921), reusing the same engine, `<RenewalsCard>`, and
  `<RenewalChip>` with no new surface plumbing.

  Fields (all nullable, optional): council rates, water rates, land tax,
  building & contents insurance (provider + policy + expiry), strata / body
  corporate, lease renewal, compliance certificate. **UX (designer + behaviour
  + financial-adviser lenses):** owner-paid bills (rates / land tax / strata /
  compliance) are hidden on RENTAL properties — the landlord pays those; a
  renter still records their lease + contents insurance (the insurer label
  flips to "Contents insurer" for rentals). Lease renewal uses the longer 90-day
  lead window — re-letting / rent review takes time to action.

### Files Modified / Created
- `prisma/schema.prisma` — +9 nullable `Property` columns (`councilRatesDueDate`,
  `waterRatesDueDate`, `landTaxDueDate`, `buildingInsuranceProvider`,
  `buildingInsurancePolicyNumber`, `buildingInsuranceExpiry`, `strataDueDate`,
  `leaseExpiry`, `complianceCertExpiry`) + §12.14 FW-3 reform-impact comment.
- `prisma/migrations/20260529110000_phase_21_5_property_renewal_dates/migration.sql`
  — additive `ADD COLUMN` migration (matches schema change, §12.12).
- `lib/reminders/reminderEngine.ts` — `PROPERTY` category, 7 `PROPERTY_*` source
  types, `PropertyRenewalSource`, `computePropertyRenewals` producer; wired into
  `computeAllReminders`. Header Tier-1 list updated.
- `app/api/reminders/route.ts` — fans out `prisma.property.findMany` (renewal
  columns only) alongside assets/loans/consents.
- `components/reminders/RenewalsCard.tsx` — `PROPERTY` → `Building2` glyph.
- `app/api/properties/route.ts`, `app/api/properties/[id]/route.ts` — accept +
  persist the 9 fields (POST plain; PUT with the `!== undefined` no-clobber guard).
- `app/dashboard/properties/page.tsx` — `Property` + `PropertyFormData` fields,
  `EMPTY_RENEWALS` block, initial state + reset + edit-map, renewals form
  sub-section (owner-bills gated on `type !== 'RENTAL'`), per-property renewals
  block in the detail dialog.

### Documentation Updated
- `docs/blueprint/PHASE_21_ASSET_MANAGEMENT.md` — §8.2 + §13 (21.5) property
  producer marked shipped; "replicate next" list struck through for property.
- `docs/architecture/03_DATA_MODEL.md` — Property entity gains renewal fields.
- `docs/architecture/07_API_STANDARDS.md` — `/api/reminders` category +
  sourceType enums + property producer note.
- `docs/IMPLEMENTATION_PLAN.md` — R3 row → ✅ SHIPPED.

### Build Status
- [x] `prisma generate` — client regenerated with new fields
- [x] `tsc --noEmit` — 0 errors (whole project)
- [x] `npm run lint:financial-surfaces` — exit 0 (no new violations; no baseline shift)
- [x] `next build` — ✓ Compiled successfully

### Destructive write checklist (CLAUDE.md §12.11)
The PUT route's existing `prisma.property.update` gains 9 fields:
1. **`where` clause matches:** `{ id }` — single property, after `verifyOwnership`
   confirms it belongs to `auth.userId`. No broader match.
2. **Columns overwritten:** only the 9 new renewal columns (+ the pre-existing
   write set). Each uses the `field !== undefined ? … : undefined` guard, so a
   caller that omits a field leaves the stored value untouched — no clobber.
3. **Guard:** `verifyOwnership(existing, auth.userId, 'Property')` + the
   undefined-guard per field. Schema change itself is 9 nullable additive
   `ADD COLUMN`s — no backfill, no `DROP`/`TRUNCATE`, no existing row touched.

User confirmation: NOT REQUIRED — additive columns + ownership-guarded update of
only user-entered renewal fields; no existing data at risk.

### Phase 41E reform compliance (CLAUDE.md §12.14)
- New `Property` columns are **operational reminder inputs** (rates / insurance /
  strata / lease / compliance cadence). FW-3: they do **NOT** interact with the
  CGT grandfathering test — that remains driven solely by
  `acquisitionContractDate`. No reform regime math reads them.
- `computePropertyRenewals` produces **no tax-relevant output** (only renewal
  dates + urgency), so FW-1 / FW-2 are N/A. No tax-engine file touched.

### PR
- Branch: `claude/property-renewals-LFNFt`
- Status: Draft (pending review)
