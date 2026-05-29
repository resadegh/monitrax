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
- Status: Draft (pending review)
