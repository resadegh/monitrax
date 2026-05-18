# Changelog — 2026-04-12

## Session: claude/review-monitrax-docs-ty15A (PR 3b — Wizard Structural Additions)

### Changes Made

- **Type**: Feature + Refactor
- **Scope**: Onboarding wizard data-capture paths, bulk-create API, Basiq integration, new `/app/onboarding/basiq-callback` route
- **Motivation**: Fourth PR in the Phase 12 pipeline. Closes the structural gaps identified in the original review — renter path, non-property loans, real `SuperannuationAccount` routing, Basiq shortcut, file import, household lifestyle fields. PR 3a was the visual overhaul; PR 3b is everything the visual overhaul intentionally didn't touch.

### Ground rules

- **No schema changes.** Every new field maps to an existing Prisma column.
- **Reuses existing Monitrax functionality** — file import composes `components/bank/ImportWizard.tsx` (Phase 18), Basiq uses `/api/basiq/connect` (Phase 24).
- **Zero duplicate parsing logic.** The wizard doesn't re-implement CSV/OFX/QIF.
- **Draft persistence from PR 2 unchanged.**
- **Strict "show once / never again" contract from PR 2 unchanged.**
- **All 5 decisions from the plan doc §3 A–F locked in before any code was written.**

### What shipped

#### Types foundation (`690161d`)

New `WizardData` fields: `housing`, `debtCategories`, `lifestylePreference`, `diningOutFrequency`, `hobbiesWithCosts`, `debts`, `superAccounts`. New `AccountInput.source` + `existingAccountId`. New type exports: `HousingSituation`, `DebtCategory`, `DebtInput`, `SuperAccountInput`, `LifestylePreference`, `DiningFrequency`, `AccountDataSource`. `getStepsForProfile` gains an optional `context` argument so Properties can be hidden for renters and Debts can be gated on the Welcome checkbox. `calculateSummary` now folds `totalDebtsBalance` and `totalSuperValue` into net worth and adds non-property-loan repayments to the annual cashflow.

#### Welcome, Household, Debts, Super steps (`6ccdbea`)

- **Welcome step** — added 3-option housing segmented control (Own / Rent / Both) and a multi-select debts chip row (HECS / Car / Personal / Business). Profile auto-inference now reads housing directly. Renter copy appears inline when Rent is picked: "We'll skip property setup and add your rent as a regular expense."
- **Household step** — new "Your lifestyle" section with 3 fields: lifestyle preference (segmented), dining-out frequency (segmented), optional free-text hobbies. Feeds the Phase 28 budget AI.
- **DebtsStep** — new conditional step. Expandable cards for CAR / STUDENT / PERSONAL / BUSINESS loans. Pre-seeds one row per ticked Welcome category on first open. HECS special case: indexation-rate default 4%, no `minRepayment` prompt, `isHecsHelp` flag. CAR loans get an optional vehicle-link dropdown (resolved against the Assets step).
- **SuperStep** — new step. Three fields only: `name`, `fundName`, `currentBalance`. Everything else deferred to a future Settings > Retirement page per plan doc §3 row A.

#### Accounts 3-tier picker (`417880b`)

New `AccountsDataSourceTiles` component (presentation-only) with Tier 1 Basiq (recommended hero card), Tier 2 File import (mid-weight ghost), Tier 3 Manual (de-ranked dashed-border). All three are freely mixable. Accounts step wires up:

- **Basiq handler**: `POST /api/basiq/connect` → `window.location = consentUrl`. Error banner on failure.
- **Import handler**: opens a `Dialog` containing the existing `components/bank/ImportWizard.tsx`. Listens to `onAccountCreated` and pushes new rows with `source='IMPORT'` + `existingAccountId`.
- **Manual handler**: reveals the existing PR 3a quick-add grid.

#### Basiq callback + WizardContainer wiring (`5820ae4`)

New `/app/onboarding/basiq-callback/page.tsx`. Polls `GET /api/basiq/connections` every 1.5s for up to 30s. On first `ACTIVE` connection redirects to `/onboarding?step=accounts&basiq=connected` with a green-tick flash. Timeout path shows a friendly "still syncing" message. Full-page layout with the existing `.wz-page-root` / `.wz-page-card` classes.

WizardContainer now imports `DebtsStep` and `SuperStep`, passes the runtime context (`housing` + `debtCategories`) to `getStepsForProfile`, and renders the new step ids.

#### Bulk-create API updates (`df9b314`)

- **Household upsert** — lifestyle fields written to both create and update branches (conditionally — empty values are omitted so re-runs don't clobber existing Settings data).
- **Accounts loop** — skips rows with `source='BASIQ'` or `'IMPORT'` (they already exist in the DB). Offset-loan linking still works for imported accounts.
- **New section 4a: SuperannuationAccount** — creates real rows with minimum-viable fields. Skips empty rows.
- **New section 4b: Non-property debts (first pass)** — writes STUDENT / PERSONAL / BUSINESS loans immediately. CAR loans with a `linkedAssetId` are held for second pass.
- **New section 5a: CAR debts (second pass)** — after Assets are written, resolves wizard temp ID → real Asset ID via a `Map` and writes the CAR loans with `Loan.linkedAssetId` populated.
- **HECS/STUDENT special case** — `minRepayment` forced to 0 (income-contingent; the Phase 20 Tax Intelligence Engine handles repayment from salary).
- **Renter path note** — inline comment documents why we do NOT auto-seed a rent expense at submission time (user is expected to add it in the Income/Expenses step UI).

### Files Modified

- `components/onboarding/wizard/types.ts` — new types + `getStepsForProfile` context
- `components/onboarding/wizard/WizardContainer.tsx` — new step imports + context-aware filter + render cases
- `components/onboarding/wizard/steps/WelcomeStep.tsx` — housing + debts questions
- `components/onboarding/wizard/steps/HouseholdStep.tsx` — lifestyle section
- `components/onboarding/wizard/steps/AccountsStep.tsx` — 3-tier picker wiring
- `app/api/onboarding/bulk-create/route.ts` — all new write paths

### Files Created

- `components/onboarding/wizard/steps/DebtsStep.tsx`
- `components/onboarding/wizard/steps/SuperStep.tsx`
- `components/onboarding/wizard/steps/AccountsDataSourceTiles.tsx`
- `app/onboarding/basiq-callback/page.tsx`
- `docs/changelog/CHANGELOG_2026_04_12_WIZARD_STRUCTURAL_ADDITIONS.md` (this file)

### Build Status

- [ ] TypeScript compilation — cannot verify locally (no `node_modules` in sandbox). CI gates the merge.
- [ ] `npm run build` — relying on CI.
- [ ] Lint — relying on CI.

### Not in This PR

- **PR 3c — Data source hygiene** (planned, not started):
  - Staleness chips on every `Account` balance display
  - Dashboard staleness nudge for MANUAL accounts > 14 days old
  - Confidence indicators on derived metrics
  - Settings > Accounts "Upgrade this account" button
  - Existing-user migration modal
  - `balanceLastUpdatedAt` enforcement audit
  - Balance age heat-map in Settings > Data Health
