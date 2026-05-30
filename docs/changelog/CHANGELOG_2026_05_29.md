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
- Status: Merged (PR #923) — prod deploy `dpl_3QSZLB6h...` READY.

---

## Session: reminders-tier2-state-LFNFt

### Changes Made
- **Type**: Feature (Phase 21.5 — R1 Tier 2, PR1 of 3)
- **Scope**: Reminders — persistence foundation (snooze/dismiss/done)
- **Description**: First slice of R1 (Tier 2 in-app reminders, Reza-greenlit
  2026-05-29). Adds per-user **snooze / dismiss / done** state on the existing
  projected reminders and makes the `<RenewalsCard>` rows actionable — the
  behaviour-psychology gap in Tier 1 (a reminder you can't clear becomes a nag,
  not a help). PR2 (in-app bell/centre) and PR3 (bank-detected bills feed) build
  on this layer; R2 (email/push delivery) sits on top of all three.

  **Design (architect lens):** state is keyed by the engine's existing synthetic
  id (`${entityId}:${sourceType}`) + the **due-date cycle** the action was taken
  against. Absence of a row = ACTIVE, so the table only holds acted-upon
  reminders. The merge ignores a state once the live reminder's `dueDate` moves
  on — so marking "rego renewed" this year does NOT suppress next year's
  reminder. The merge is a **pure** engine function (`applyReminderStates`), so
  Prisma never leaks into the engine (§6.4).

### Files Modified / Created
- `prisma/schema.prisma` — new `ReminderStatus` enum + `ReminderState` model
  (`@@unique([userId, reminderKey])`, `@@index([userId])`, `@@map("reminder_states")`)
  + `User.reminderStates` back-relation.
- `prisma/migrations/20260529120000_phase_21_5_tier2_reminder_state/migration.sql`
  — additive: one `CREATE TYPE` + one `CREATE TABLE` (matches schema, §12.12).
- `lib/reminders/reminderEngine.ts` — **pure** Tier 2 merge: `ReminderStateInput`
  + `AnnotatedReminder` + `ReminderLiveState` types, `applyReminderStates()`
  (due-date-cycle-aware, expired-snooze-aware), `visibleReminders()`.
- `app/api/reminders/route.ts` — GET fetches `reminderState` rows + merges via
  the engine; returns only still-ACTIVE reminders.
- `app/api/reminders/state/route.ts` — **NEW.** `POST` snooze/dismiss/done/restore
  (`withPermission('entity.write')`, thin wrapper, no audit — UI-preference state).
- `components/reminders/RenewalsCard.tsx` — per-row action menu (snooze 7/30d ·
  mark done · dismiss) via shadcn `DropdownMenu`; optimistic row removal; the
  menu is a sibling of the row `<Link>` (no nested-interactive).

### Documentation Updated
- `docs/blueprint/PHASE_21_ASSET_MANAGEMENT.md` — §8.2 Tier 2 progress block +
  §13 checklist line.
- `docs/architecture/03_DATA_MODEL.md` — `ReminderState` table + property/asset
  renewal sections.
- `docs/architecture/07_API_STANDARDS.md` — GET state-merge note + `POST
  /api/reminders/state` contract.
- `docs/IMPLEMENTATION_PLAN.md` — R1 → 🟡 in flight, PR1 ✅, PR2/PR3 queued.

### Build Status
- [x] `prisma validate` — schema valid
- [x] `prisma generate` — client regenerated
- [x] `tsc --noEmit` — 0 errors (whole project)
- [x] `npm run lint:financial-surfaces` — exit 0 (no new violations; no baseline shift)
- [x] `next build` — ✓ Compiled successfully (`/api/reminders/state` route built)

### Destructive write checklist (CLAUDE.md §12.11)
`POST /api/reminders/state` contains `prisma.reminderState.upsert` + `deleteMany`:
1. **`where` clause matches:** `upsert` → `{ userId_reminderKey: { userId, reminderKey } }`;
   `deleteMany` → `{ userId, reminderKey }`. Both scoped to the authed `userId` +
   a synthetic key. The only rows that can match are reminder-state rows THIS
   code path created.
2. **Columns overwritten / rows deleted:** `upsert` rewrites only `status` /
   `snoozedUntil` / `dueDate` — all owned exclusively by this code path, never
   user-entered financial data. `deleteMany` (restore) removes only the user's
   own state row (reverting to ACTIVE).
3. **Guard:** `userId` from `withPermission` auth + the synthetic `reminderKey`
   that only this code path ever writes. Schema change is additive (one enum +
   one table) — no existing row touched.

User confirmation: NOT REQUIRED — additive table + writes confined to
this-code-path-owned UI-preference state, scoped to the authed user; no
existing data at risk.

### Phase 41E reform compliance (CLAUDE.md §12.14)
N/A — no `lib/tax-engine/*` touched, no financial calculation, no column on
`Property`/`Investment`/`LegalEntity`. `ReminderState` is UI-preference state.

### PR
- Branch: `claude/reminders-tier2-state-LFNFt`
- Status: Merged (PR #924) — prod deploy `dpl_C4u1Evu5...` READY.

---

## Session: reminders-notification-bell-LFNFt

### Changes Made
- **Type**: Feature (Phase 21.5 — R1 Tier 2, PR2 of 3)
- **Scope**: Reminders — in-app notification bell / centre (dashboard top bar)
- **Description**: Wires the previously-dead bell button in `<EditorialTopBar>`
  into a real `<NotificationBell>` centre — count badge + dropdown panel of
  surfaced reminders with inline snooze (7d) + dismiss, reusing the PR1
  snooze/dismiss machinery. Custom user-created reminders (new `Reminder` model)
  split out to PR2b to keep this PR focused; the bills feed is PR3.

  **Architecture (§12.3 win):** extracted the fetch + snooze/dismiss/done client
  logic into a shared `useReminders` hook, now the SSOT consumed by BOTH the
  bell and `<RenewalsCard>` (which was refactored onto it — net code reduction,
  no behaviour change). No new popover dependency: the panel is built on the
  already-approved `DropdownMenu` primitive (§12.7 / §13.8), controlled-open so
  the row link closes it while the action buttons keep it open.

  **No new API or schema** — reuses `GET /api/reminders` + `POST
  /api/reminders/state` from PR1.

### Files Modified / Created
- `hooks/useReminders.ts` — **NEW.** Shared SSOT hook (fetch feed + optimistic
  snooze/dismiss/done + reload).
- `components/reminders/NotificationBell.tsx` — **NEW.** Top-bar bell + badge +
  dropdown panel + empty state.
- `components/reminders/RenewalsCard.tsx` — refactored onto `useReminders`
  (removed its own fetch/act; behaviour unchanged).
- `components/editorial/shell/EditorialTopBar.tsx` — dead bell button →
  `<NotificationBell />`; dropped the now-unused `Bell` import.

### Documentation Updated
- `docs/blueprint/PHASE_21_ASSET_MANAGEMENT.md` — §8.2 PR2 ✅ + §13 line.
- `docs/architecture/06_UI_UX_FOUNDATION.md` — Renewals pattern table gains
  `<NotificationBell>` + `useReminders`; badge-tone + behaviour notes.
- `docs/IMPLEMENTATION_PLAN.md` — R1 PR2 ✅ (PR2b/PR3 queued).

### Build Status
- [x] `tsc --noEmit` — 0 errors (whole project)
- [x] `npm run lint:financial-surfaces` — exit 0 (no new violations)
- [x] `next build` — ✓ Compiled successfully

### Destructive write checklist (CLAUDE.md §12.11)
N/A — no Prisma writes, no schema change. Reuses existing routes.

### Phase 41E reform compliance (CLAUDE.md §12.14)
N/A — no tax-engine / financial calc / schema column touched.

### UI/UX Stitch-first (CLAUDE.md §18)
N/A — internal app surface (`/dashboard/*` shell), which §18.2 explicitly
excludes from Stitch-first (uses the internal design system per
`08_BRAND_UI_DESIGN.md`). Reused existing editorial-* tokens + `RenewalChip` +
`DropdownMenu`; no new visual primitives.

### PR
- Branch: `claude/reminders-notification-bell-LFNFt`
- Status: Merged (PR #925) — prod deploy `dpl_A7JSM83t...` READY.

---

## Session: reminders-custom-LFNFt

### Changes Made
- **Type**: Feature (Phase 21.5 — R1 Tier 2, PR2b of the bell slice)
- **Scope**: Reminders — user-created custom reminders
- **Description**: Lets a user add their own reminder ("remind me to call the
  accountant about FY26") from the notification bell's "+ New". The created
  reminder flows through the SAME unified feed + snooze/dismiss/done state as
  every derived reminder (synthetic key `${id}:CUSTOM`) — so it shows up in both
  the bell and the Renewals card with zero extra surface code (the producer
  pattern paying off).

  **Scope held (architect lens):** create + display only. Edit / hard-delete /
  a dedicated manage view are a deliberate fast-follow — Dismiss already removes
  a custom reminder from view (ReminderState), so the create→see→clear loop is
  complete. Custom reminders are rendered **non-navigable** (no entity page);
  both row surfaces branch on empty `href` via a shared `ReminderRowBody`.

  **Far-future feedback:** a reminder set >60 days out won't appear in the
  "coming up" feed yet — so `<AddReminderDialog>` confirms the saved date inline
  ("Reminder set for 15 August 2026") rather than letting it silently vanish
  (behaviour-psychology §0).

### Files Modified / Created
- `prisma/schema.prisma` — new `Reminder` model (title/dueDate/note) +
  `User.customReminders` back-relation.
- `prisma/migrations/20260529130000_phase_21_5_custom_reminders/migration.sql`
  — additive `CREATE TABLE` (matches schema, §12.12).
- `lib/reminders/reminderEngine.ts` — `CUSTOM` category + sourceType +
  `CustomReminderSource` + `computeCustomReminders` producer; wired into
  `computeAllReminders`.
- `app/api/reminders/route.ts` — feed fans out `prisma.reminder.findMany`.
- `app/api/reminders/custom/route.ts` — **NEW.** `POST` create (entity.write).
- `hooks/useReminders.ts` — added `createCustom()` + `CustomReminderInput`.
- `components/reminders/AddReminderDialog.tsx` — **NEW.** Create form + inline
  saved-confirmation.
- `components/reminders/NotificationBell.tsx` — "+ New" button + dialog wiring;
  extracted `NotificationRow` handling the non-navigable custom case + `CUSTOM`
  (Pin) icon.
- `components/reminders/RenewalsCard.tsx` — `CUSTOM` (Pin) icon, conditional
  label, non-navigable custom rows via a shared `ReminderRowBody` helper.

### Documentation Updated
- `docs/blueprint/PHASE_21_ASSET_MANAGEMENT.md` — §8.2 PR2b ✅ + §13 line.
- `docs/architecture/03_DATA_MODEL.md` — `Reminder` model.
- `docs/architecture/07_API_STANDARDS.md` — `CUSTOM` enums + `POST /api/reminders/custom`.
- `docs/architecture/06_UI_UX_FOUNDATION.md` — `<AddReminderDialog>` + custom-reminder note.
- `docs/IMPLEMENTATION_PLAN.md` — R1 PR2b ✅ (PR3 = last R1 slice).

### Build Status
- [x] `prisma validate` — schema valid
- [x] `prisma generate` — client regenerated
- [x] `tsc --noEmit` — 0 errors (whole project)
- [x] `npm run lint:financial-surfaces` — exit 0 (no new violations)
- [x] `next build` — ✓ Compiled successfully (`/api/reminders/custom` route built)

### Destructive write checklist (CLAUDE.md §12.11)
N/A — the only Prisma write is `prisma.reminder.create` (additive, scoped to
`auth.userId`). No update/upsert/delete on existing rows; schema change is one
additive `CREATE TABLE`, no backfill, no `DROP`/`TRUNCATE`.

### Phase 41E reform compliance (CLAUDE.md §12.14)
N/A — no tax-engine / financial calc / schema column on
`Property`/`Investment`/`LegalEntity`. `Reminder` is UI content.

### UI/UX Stitch-first (CLAUDE.md §18)
N/A — internal app surface (`/dashboard/*` shell). Reused existing `Dialog` /
`Input` / `Textarea` primitives + editorial tokens; no new visual primitives.

### PR
- Branch: `claude/reminders-custom-LFNFt`
- Status: Draft (pending review)

---

## Session: stitch-dashboard-redesign-LIlK9 (R-Charts-1)

### Changes Made
- **Type**: Feature (Workstream 0·StD — Phase R-Charts-1)
- **Scope**: Editorial chart primitives + 3 real-data dashboard charts (labs preview)
- **Description**: Built the editorial interactive-chart vocabulary and wired
  three charts to live portfolio data behind a `/dashboard/labs/charts`
  preview route: Asset Allocation donut, 6-month Cashflow bars, and per-entity
  Net Value contribution bars. Grounded in the locked Stitch design
  `dashboard-interactive-charts` (project 1859462351962811110). Net Worth Trend,
  Spending Sparklines and Debt Freedom (the other 3 Stitch charts) are deferred
  to R-Charts-2/3.

### Files Created
- `lib/calculations/entityValueBreakdown.ts` — canonical per-LegalEntity net
  value aggregation. Reuses `calculateTotalAssets`/`calculateTotalLiabilities`
  with the `ownerEntityId` filter (SSOT — per-entity figures reconcile to the
  Net Worth tile). Drops zero-value entities; net value may be negative.
- `app/api/dashboard/charts/route.ts` — dedicated `report.read` endpoint
  returning chart-ready arrays (`assetAllocation` slices + `totalAssets`,
  `cashflowBars` + `cashflowAvgNet`, `entityComparison`). Distinct concern from
  `/api/dashboard/insights` (§12.4). ALL arithmetic server-side.
- `components/editorial/charts/EditorialChartCard.tsx` — shared card shell.
- `components/editorial/charts/EditorialChartTooltip.tsx` — styled popover wrapper.
- `components/editorial/charts/EditorialDonutChart.tsx` — Recharts donut + legend.
- `components/editorial/charts/EditorialBarChart.tsx` — grouped vertical bars.
- `components/editorial/charts/EditorialEntityBars.tsx` — CSS diverging bars.
- `components/editorial/charts/index.ts` — barrel.
- `app/dashboard/labs/charts/page.tsx` — live-data preview route.

### Files Modified
- `docs/IMPLEMENTATION_PLAN.md` — R-Charts workstream: R-Charts-1 ticked,
  R-Charts-2/3 + consumer-swap queued with triggers.
- `docs/architecture/06_UI_UX_FOUNDATION.md` — editorial charts section.

### Architecture decisions
- **Two charts had ready data, one needed a new aggregation.** Asset allocation
  comes from `snapshot.netWorth.assets`; cashflow bars from the existing
  `getMoneyStoryTrend` monthly series. Entity comparison needed per-entity net
  value, which the snapshot does not expose — so a NEW canonical function was
  added in `lib/` (not inlined in the route), reusing the net-worth calculator's
  `ownerEntityId` filter so the numbers stay traceable and consistent (financial
  -adviser + architect lenses).
- **Dedicated endpoint, not an `/insights` extension.** Charts are a distinct
  concern and the per-entity aggregation adds query weight; keeping it off the
  hot insights path until the charts graduate to the live dashboard. The
  consumer-swap phase decides how to fold it in (§12.10).
- **Components are presentational; all math is server-side.** Donut percentages
  and cashflow average net are computed in the API so the chart components never
  do dotted-property `+`/`-` or frequency conversion — Phase 41i.6b surface
  linter: 0 new violations.
- **Never red.** Negative cashflow/entity values render amber, per the editorial
  rule (red reserved for destructive actions).

### Build Status
- [x] `npm ci` — dependencies installed (fresh container)
- [x] `npm run lint:financial-surfaces` — 27 grandfathered, 0 new
- [ ] `npm run build` — see verification below

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (new editorial chart primitives)
- [ ] application config
- [ ] GCP infrastructure
- [ ] identity / auth
- [ ] deployment / build
- [ ] security / CDR posture
- [ ] operational procedure
- [ ] strategic decision

Docs updated in this PR:
- `docs/architecture/06_UI_UX_FOUNDATION.md` — editorial chart suite section (primitives, tokens, scope)
- `docs/IMPLEMENTATION_PLAN.md` — R-Charts-1 ticked, R-Charts-2/3 queued

### Phase 41E reform compliance (CLAUDE.md §12.14)
N/A — no `lib/tax-engine/*` touched, no reform-affected calculation. The new
`entityValueBreakdown` aggregation reuses the existing net-worth calculator and
adds no regime-dependent math; no column added to `Property`/`Investment`/`LegalEntity`.

### PR
- Branch: `claude/stitch-dashboard-redesign-LIlK9`
- Status: Draft (pending review)

---

## Session: stitch-dashboard-redesign-LIlK9 (desktop sub-nav regression fix)

### Changes Made
- **Type**: Fix (Workstream 0·StD — editorial shell regression)
- **Scope**: `components/editorial/shell/EditorialSidebar.tsx`
- **Root Cause**: The Phase R2b DashboardLayout swap (PR #904) replaced the
  legacy sidebar — which rendered each active section's `children` as indented
  sub-tab links on desktop — with `EditorialSidebar`, which rendered only the
  8 top-level TRAIL sections. `SectionTabsRow` (the sub-tab strip) is
  `md:hidden` by design and explicitly defers desktop sub-nav to the sidebar.
  Net effect: on desktop there was NO path to a section's sub-pages — e.g.
  My Wealth opened Properties with no way to reach Investments or Assets.
  (Mobile was unaffected — `SectionTabsRow` shows the tabs there.)
- **Solution**: `EditorialSidebar` now expands the active section to show its
  `children` (from the canonical `trailNavItems` SSOT) as indented sub-tab
  links with an active-child highlight, mirroring the legacy desktop UX in the
  editorial vocabulary (emerald active tint, divider connector). `EditorialNavRow`
  already shipped a `dense` mode for nested rows — the sub-nav was always
  intended, just never wired into the sidebar.

### Files Modified
- `components/editorial/shell/EditorialSidebar.tsx` — render active section's
  child sub-tabs on desktop + JSDoc update.

### Build Status
- [x] `npm run build` — passes (exit 0)

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (sidebar sub-nav restored)
- [ ] application config / GCP / identity / deployment / security / operational / strategic

Docs updated in this PR:
- `docs/changelog/CHANGELOG_2026_05_29.md` — this entry
- `docs/IMPLEMENTATION_PLAN.md` — 0·StD note (desktop sub-nav regression fixed)

### PR
- Branch: `claude/stitch-dashboard-redesign-LIlK9`
- Status: Draft (pending review)

---

## Session: stitch-dashboard-redesign-LIlK9 (R-Charts consumer swap)

### Changes Made
- **Type**: Feature (Workstream 0·StD — Phase R-Charts-1 consumer swap)
- **Scope**: `/dashboard` live page — Asset Allocation + Entity Comparison
- **Description**: Wired two of the three R-Charts-1 editorial chart primitives onto
  the live dashboard. Asset Allocation card and the Phase-3/4 row's Entity
  Comparison both now consume `/api/dashboard/charts`. Cashflow Bars remains in
  the labs preview only — its placement on the dashboard is a separate UX call
  (adding a new section would bloat the page; replacing the KPI Cash Flow
  sparkline would lose the 12-month context). Defer to a follow-up decision.

### Files Modified
- `app/dashboard/page.tsx`:
  - Added `charts` state + parallel fetch of `/api/dashboard/charts` (now 3
    parallel calls; §12.10 budget still met).
  - Replaced the Asset Allocation `Card` (donut + manual progress-bar legend
    with hard-coded blue/green/purple/orange) with `EditorialChartCard` +
    `EditorialDonutChart` (sky/emerald/indigo/muted, slice arithmetic
    server-side).
  - Replaced `EntityComparisonChart` (cashflow-by-entity) with
    `EditorialChartCard` + `EditorialEntityBars` (net-value-by-entity). The
    entity-cashflow story remains covered by `EntityCashflowSummary` in the
    earlier Debt Quality section — no information loss.
  - **Dead code removed**: local `DonutChart` (~80 lines, SVG) and local
    `ProgressBar` (~25 lines), both orphaned by the swap. Also removed
    `getAssetAllocationData` helper.
  - Removed imports of `EntityComparisonChart` + `buildEntityComparisonData`
    from `Phase2Enhancements` (now orphaned exports — see dead-code backlog).
- `.audit/financial-math-baseline.json`:
  - Line numbers shifted for 7 pre-existing entries due to upstream deletions
    (same expressions, same violations — purely line-number drift; no new
    suppressions).

### Architecture decisions
- **Three parallel calls, not endpoint consolidation.** Keeping
  `/api/dashboard/charts` separate from `/insights` preserves the labs route
  contract and the §12.4 "one concern per endpoint" rule. The dashboard's
  existing two-call Promise.all extends to three; no perf regression.
- **Cashflow Bars deferred.** Restraint over richness (designer + behaviour
  psychologist lens) — adding a new section would lengthen the dashboard;
  placement is a separate decision worth its own review.

### Build Status
- [x] `npm run lint:financial-surfaces` — 27 grandfathered (baseline line
      numbers updated for upstream drift), 0 new
- [x] `npm run build` — see verification below

### Doc-sync (CLAUDE.md §16)
Surfaces changed in this PR:
- [x] visual design system / component pattern (dashboard chart sections)
- [ ] application config / GCP / identity / deployment / security / operational / strategic

Docs updated in this PR:
- `docs/IMPLEMENTATION_PLAN.md` — R-Charts consumer-swap (partial) ticked; dead-code backlog updated
- `docs/changelog/CHANGELOG_2026_05_29.md` — this entry

### Phase 41E reform compliance (CLAUDE.md §12.14)
N/A — UI consumer swap; no `lib/tax-engine/*`, no financial calculation, no
schema change, no AI tool, no per-asset tax UI.

### PR
- Branch: `claude/stitch-dashboard-redesign-LIlK9`
- Status: Draft (pending review)

---

## Session: reminders-import-cadence-LFNFt

### Changes Made
- **Type**: Feature (Phase 21.5 — R7-PR1, new reminder producer)
- **Scope**: Reminders — transaction-import cadence nudge
- **Description**: A recurring (~monthly) reminder nudging users to import their
  latest bank transactions, so their data — and every number derived from it —
  stays current. Reza's idea (2026-05-29), slotted onto the reminder engine
  built this session rather than a bespoke nudge.

  **Why it matters (financial-adviser + architect lenses):** Basiq (the auto
  bank feed) is OFF by default (`lib/featureFlags/basiqGate.ts`), so manual
  CSV/QIF/OFX import is the primary data path for essentially every user. With
  nothing prompting a refresh, cashflow / budget / health-score / the bills feed
  all silently drift stale. This is the most foundational TRAIL-stage-Track loop.

  **Design:** a new engine producer `computeImportReminder` — NOT a new nudge
  component (that's the `StaleBalanceNudge` parallel-implementation trap).
  Emits ONE `IMPORT_DUE` reminder per user, **data-gated not toggle-gated**:
  only fires for users with a non-Basiq account whose data is ~a month stale;
  auto-suppressed for fully Basiq-fed users. Rides the existing feed + bell +
  card + `ReminderState` — importing advances `ImportBatch.dateRangeEnd`, so the
  due-date cycle moves forward and the reminder auto-clears, returning next
  cycle. Warm copy ("Up to date through 30 Apr 2026"), never shaming. **No
  schema change.**

  **Scope corrected (Reza 2026-05-29): "this should be only a reminder, not a
  new import engine."** R7 = the reminder, which links to the EXISTING
  `ImportWizard` (`/dashboard/balances?action=import`). The heavier import-guide
  idea (date-range pre-fill + QIF how-to) is parked — if revived it's at most
  light copy on the existing wizard, never a parallel import engine (§12.1/§12.4).

### Files Modified
- `lib/reminders/reminderEngine.ts` — `IMPORT` category + `IMPORT_DUE` sourceType
  + `ImportCadenceSource` + `computeImportReminder` producer (short surfacing
  window so fresh importers aren't nagged early) + `IMPORT_CADENCE_DAYS`; wired
  into `computeAllReminders`. Header updated.
- `app/api/reminders/route.ts` — feed fans out `prisma.importBatch.aggregate`
  (`_max.dateRangeEnd`, COMPLETED/PARTIAL) + `prisma.account` sources; computes
  the `importCadence` source (manual-account gate + earliest-manual-account).
- `components/reminders/NotificationBell.tsx`, `RenewalsCard.tsx` — `IMPORT` →
  `Download` glyph in `CATEGORY_ICON`.

### Documentation Updated
- `docs/blueprint/PHASE_21_ASSET_MANAGEMENT.md` — §8.2 R7-PR1 + §13 line.
- `docs/architecture/07_API_STANDARDS.md` — `IMPORT`/`IMPORT_DUE` enums + producer note.
- `docs/architecture/06_UI_UX_FOUNDATION.md` — import-cadence reminder note.
- `docs/IMPLEMENTATION_PLAN.md` — new R7 row (PR1 ✅, PR2 guide queued).

### Build Status
- [x] `prisma generate` — client regenerated (no schema change)
- [x] `tsc --noEmit` — 0 errors (whole project)
- [x] `npm run lint:financial-surfaces` — exit 0 (no new violations)
- [x] `next build` — ✓ Compiled successfully

### Destructive write checklist (CLAUDE.md §12.11)
N/A — read-only producer. No schema change, no Prisma writes (the feed route
only reads: `importBatch.aggregate` + `account.findMany`).

### Phase 41E reform compliance (CLAUDE.md §12.14)
N/A — no tax-engine / financial calc / schema column touched.

### PR
- Branch: `claude/reminders-import-cadence-LFNFt`
- Status: Draft (pending review)
