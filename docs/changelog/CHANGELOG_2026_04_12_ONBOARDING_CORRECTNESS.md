# Changelog — 2026-04-12

## Session: claude/review-monitrax-docs-ty15A (PR 1 — Onboarding Correctness)

### Changes Made

- **Type**: Fix / Refactor
- **Scope**: Onboarding wizard, bulk-create API, schema, permissions
- **Motivation**: Deep review of the onboarding wizard flow (documented in the
  same session) surfaced eleven correctness bugs where the wizard either
  silently dropped user input, wrote numerically wrong data, or routed data to
  the wrong column. PR 1 fixes every correctness bug without changing the UX
  flow; PR 2 (draft persistence) and PR 3 (UX redesign) will follow.

### Root Causes & Fixes

1. **Frequency double-conversion in bulk-create** — `normalizeToMonthly()` was
   applied to every income/expense amount and the original frequency was then
   stored unchanged, so downstream calculators re-applied the frequency
   multiplier. A user entering `$1000/WEEKLY` ended up as
   `amount=4333.33, frequency=WEEKLY` which the snapshot engine read as
   `$225,333/year` instead of `$52,000/year`. Removed `normalizeToMonthly()`
   entirely; amounts now flow through unchanged, matching
   `/api/income/route.ts` and every other write path in the codebase.

2. **Household data never persisted** — `HouseholdStep.tsx` collected
   `householdMembers`, `householdPets`, and `carsCount` into `WizardData`, but
   the bulk-create API had no code path to create `HouseholdProfile`,
   `HouseholdMember`, or `HouseholdPet` rows. Added a new "1a" block inside the
   transaction that upserts the profile and idempotently replaces its members
   and pets (`deleteMany` + `create`). Also computes `adultsCount`,
   `childrenCount`, `childrenAges`, and `petTypes` for the Phase 28 budget AI.

3. **`Account.balanceSource` never set** — wizard-created accounts were left
   with a `null` `balanceSource`, losing the MANUAL vs BASIQ vs IMPORT audit
   trail. Now set to `'MANUAL'` with `balanceLastUpdatedAt: now()` on create.

4. **`INVESTMENT`-type income routed as `sourceType=GENERAL`** — dividends and
   distributions were written with `sourceType: 'GENERAL'`, breaking GRDCS
   linkage to the investment module. Now set `sourceType: 'INVESTMENT'` and
   link `investmentAccountId` to the first investment account created in the
   same wizard run (if any).

5. **`ExpenseCategory` picker missing HEALTH / EDUCATION (and others)** — the
   wizard's local type and the `IncomeExpensesStep` picker listed only 14 of
   the 20 Prisma enum values. Synced both to the full enum: added `RENT`,
   `GROCERIES`, `SUBSCRIPTION`, `HEALTH`, `EDUCATION` with labels, icons, and
   examples.

6. **`taxYear` captured but discarded** — `WelcomeStep` collected it into
   `WizardData.taxYear` but there was no column to store it. Added
   `UserPreference.taxYear String?`, wired it through `bulk-create` (upsert
   branches) and `/api/onboarding/state` (GET select + POST update path).

7. **`Property.purchaseDate` / `Asset.purchaseDate` silently defaulting to
   `now()`** — the wizard never rendered the field, so `new Date()` was used,
   which corrupted CGT, depreciation, and equity-history downstream. Added
   `Purchase Date` inputs to both `PropertiesStep` and `AssetsStep` with
   "approximate is fine" helper text and a `max={today}` cap. `bulk-create`
   now throws a 400 (not 500) with a clear message if the field is missing or
   unparseable, instead of silently defaulting.

8. **`withPermission('settings.write')` on bulk-create** — semantically wrong
   since the route writes properties, loans, accounts, income, expenses,
   investments, holdings, assets, household profile, and user onboarding
   state — all in one call. Added a new granular `onboarding.complete`
   permission scoped to `OWNER` and switched the guard to it.

9. **Missing `QUARTERLY` in Income/Expenses step** — the centralised frequency
   utilities (`lib/utils/frequencies.ts`) and every other step support
   `QUARTERLY`, but `IncomeExpensesStep.tsx` hard-coded only four values.
   Added it.

10. **Dead v1 wizard still on disk** — `InitialSetupWizard.tsx` and eight
    `components/onboarding/steps/*` files (`ProfileTypeStep`, `CountryTaxStep`,
    `BankAccountStep`, `PropertyStep`, `InvestmentAccountStep`, `IncomeStep`,
    `ExpenseStep`, `ReviewStep`) were unimported but still present. Deleted
    all nine files and removed the re-export from `components/onboarding/index.ts`
    per CLAUDE.md §12.1.

### Files Modified

- `app/api/onboarding/bulk-create/route.ts` — Fixes 1–4, 6, 7, 8: removed
  `normalizeToMonthly`, added household persistence, set `balanceSource=MANUAL`,
  routed `INVESTMENT` income correctly, persisted `taxYear`, rejected missing
  purchase dates, switched to `onboarding.complete` permission.
- `app/api/onboarding/state/route.ts` — Added `taxYear` to GET select, POST
  body destructure, and update path.
- `prisma/schema.prisma` — Added `UserPreference.taxYear String?`.
- `lib/auth/permissions.ts` — Added `onboarding.complete: ['OWNER']`.
- `components/onboarding/wizard/types.ts` — Full `ExpenseCategory` sync to
  schema (added RENT, GROCERIES, SUBSCRIPTION, HEALTH, EDUCATION).
- `components/onboarding/wizard/steps/IncomeExpensesStep.tsx` — Added new
  categories to picker; added `QUARTERLY` to frequency list.
- `components/onboarding/wizard/steps/PropertiesStep.tsx` — Added `Purchase
  Date` input with helper text.
- `components/onboarding/wizard/steps/AssetsStep.tsx` — Added `Purchase Date`
  input with helper text.
- `components/onboarding/index.ts` — Removed `InitialSetupWizard` re-export.

### Files Deleted

- `components/onboarding/InitialSetupWizard.tsx`
- `components/onboarding/steps/ProfileTypeStep.tsx`
- `components/onboarding/steps/CountryTaxStep.tsx`
- `components/onboarding/steps/BankAccountStep.tsx`
- `components/onboarding/steps/PropertyStep.tsx`
- `components/onboarding/steps/InvestmentAccountStep.tsx`
- `components/onboarding/steps/IncomeStep.tsx`
- `components/onboarding/steps/ExpenseStep.tsx`
- `components/onboarding/steps/ReviewStep.tsx`
- `components/onboarding/steps/` (directory)

### Database Migration Required

The team manages schema changes via `prisma db push` (there are no migration
files after the `0_init` baseline). After merging, run the following SQL
against the production database:

```sql
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "taxYear" TEXT;
```

Or equivalently:

```bash
npx prisma db push
```

No existing rows need backfilling — the column is nullable and the wizard
populates it on next onboarding completion.

### Not in This PR (coming in PR 2 / PR 3)

- **PR 2** — Draft persistence (`onboardingDraft JSONB` on `UserPreference`),
  resume banner on dashboard, per-step autosave.
- **PR 3** — Full UX redesign: `/app/onboarding` dedicated route, auto-infer
  profile type, renter path (Own/Rent/Both on Welcome), non-property loan
  entry (CAR/PERSONAL/STUDENT/LOC), `SuperannuationAccount` routing, Basiq
  "Connect bank" shortcut on Accounts step, lifestyle fields (lifestyle
  preference / dining frequency / hobbies) added to Household step.

### Build Status

- [ ] TypeScript compilation — cannot verify locally (no `node_modules` in
      sandbox). CI will gate the merge.
- [ ] `npm run build` — same; relying on CI.
- [ ] Lint — same; relying on CI.

### Testing Notes (manual, post-deploy)

1. Run `prisma db push` (or the SQL above) in staging.
2. Register a new user → open wizard → complete as STARTER profile with:
   - 1 household member (SELF), 1 pet, 1 car
   - 1 transaction account ($5000)
   - Salary income: $1000/week (GROSS)
   - Expenses: $400/week Groceries, $200/fortnightly Health
3. Verify on the dashboard:
   - Net worth shows $5,000 (not inflated)
   - Annual income shows $52,000 (not $225,333)
   - Annual expenses shows ~$26,000 (not ~$113K)
   - `HouseholdProfile`, `HouseholdMember`, `HouseholdPet` rows exist
   - `Account.balanceSource = 'MANUAL'`
4. Run wizard as HOMEOWNER with a property that has no purchase date →
   expect a 400 response with a clear error message, not a silent success.
5. Run wizard as INVESTOR with a single dividend income line → verify
   `Income.sourceType = 'INVESTMENT'` and `investmentAccountId` is set.
