# Changelog — 2026-05-20

> Per Reza directive 2026-05-18: every PR includes a CHANGELOG session entry as part of the PR, plus the full §16.5 doc-sync block in the PR description.

## Session: Phase 12 Track F.2 — Onboarding two-way sync (properties domain)

Branch: `claude/track-f2-properties-sync-NL4XV`

### Scope

- **Type:** Feature — onboarding wizard ⇄ real-table two-way sync, properties domain. Replicates the F.1 (`householdSync.ts`, PR #831) pattern.
- **Refs:** `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` §5 (write contract), §6.1 (whole-aggregate scope), §6.2 (chat deferred).
- **Scope decision (Reza 2026-05-20):** the **whole property aggregate** — `Property` + its mortgage `Loan` + rental `Income` + property `Expense`s — synced together. F.4 is thereby narrowed to standalone debts, F.8 to general (non-property) income/expenses.

### Root cause being fixed

The onboarding wizard staged the property portfolio into `UserPreference.onboardingDraft` (a JSON blob) and wrote the real `Property`/`Loan`/`Income`/`Expense` tables only once, at `/api/onboarding/bulk-create`. `/dashboard/properties` showed empty while the wizard held a full portfolio — a §12.2 SSOT violation.

### What was done

**1. `lib/onboarding/propertiesSync.ts` — NEW (~760 LOC)**

The canonical read/diff/write layer for the property aggregate:
- `readProperties()` — GET `/api/properties` → `PropertiesSnapshot` (loan rate converted DB-decimal → wizard-percentage).
- `diffProperties()` — PURE idempotency core. Per property emits a `PropertyOp` (create/update/delete) carrying nested `loanOps`/`incomeOps`/`expenseOps`. A no-edit re-entry diffs to `propertyOps: []`.
- `syncProperties()` — applies the diff via the property/loan/income/expense entity APIs; CREATE resolves the new `propertyId` then writes children; DELETE removes children first (Loan→Property is `onDelete:SetNull`, so deleting the property alone would orphan the mortgage).
- Mappers `snapshotToWizardProperties` / `wizardPropertiesToSnapshot` / `isPersistedId`.
- Quality guards (financial-adviser lens): a loan with `principal <= 0`, rental income `amount <= 0`, expense `amount <= 0` are dropped (a $0 row is false precision). An unpersisted property with no `purchaseDate` is dropped (incomplete in-session card); a persisted property is always kept (blanking a field never silently deletes).

**2. `prisma/schema.prisma` + migration — `PROPERTY_*` audit actions**

- 3 new `AuditAction` enum values: `PROPERTY_CREATED/UPDATED/DELETED`.
- Migration `20260520140000_phase_12_track_f2_property_audit_actions/migration.sql` — additive `ALTER TYPE ... ADD VALUE IF NOT EXISTS` (§12.12). Mirrors the F.1 pattern.

**3. Entity routes — audit logging + validation/reform fixes**

- `app/api/properties/route.ts` + `[id]/route.ts` — `createAuditLog()` on POST/PUT/DELETE (`PROPERTY_*`); **Phase 41E reform fields** (`acquisitionContractDate` / `isNewBuild` / `newBuildEvidence`) now plumbed through POST + PUT with the cut-over backfill (the route previously dropped them — F.2 closes that gap, §12.14); `purchasePrice`/`currentValue` validation relaxed `!field` → null-check (0 is a valid value).
- `app/api/loans/route.ts` + `[id]/route.ts` — `createAuditLog()` on POST/PUT/DELETE (generic `CREATE/UPDATE/DELETE`, `entityType: 'Loan'`); `minRepayment`/`termMonthsRemaining` validation relaxed to null-check.
- `app/api/income/route.ts` + `[id]/route.ts`, `app/api/expenses/route.ts` + `[id]/route.ts` — `createAuditLog()` on POST/PUT/DELETE (generic actions, `entityType: 'Income'`/`'Expense'`). Closes a pre-existing §12.5 audit gap on all four route families.

**4. `components/onboarding/wizard/steps/PropertiesStep.tsx` — rewired**

- New optional `registerStepCommit` prop. Reads the real tables on open (merges real + unsynced chat-staged/in-session properties), registers an async `commit` that `syncProperties()` writes on Continue/Back/jump.
- Loading + error banner. Carry-forward reminder on the mortgage section — *"We've linked this mortgage to [property]. You can fine-tune the rate, offset and repayments in the Debts step."*

**5. `components/onboarding/wizard/WizardContainer.tsx`** — passes `registerStepCommit` to `<PropertiesStep>`.

**6. `app/api/onboarding/bulk-create/route.ts` — property loop → no-op**

The "Create Properties with Loans" block is now a no-op (the properties step's commit already persisted everything; re-creating would duplicate). Removed `getLoanType` + `loanIdMap` (only ever held property loans). Offset→loan linking now resolves `acc.linkedLoanId` as a real owned `Loan` id directly (property loans carry real ids post-F.2).

**7. `tests/onboarding/propertiesSync.test.ts` — NEW (18 tests)**

Re-entry idempotency, mapper round-trip, create/update/delete classification (property + nested children), quality guards, `isPersistedId`, interest-rate percentage round-trip.

### Coexistence / what F.2 does NOT do

The **chat** property topic stays draft-staging — it captures only name/type/value/`hasLoan` and cannot build a complete `Property` (no `purchaseDate`). Form mode drains chat-staged properties into the real tables (the form step's read-on-open merge). A follow-up **F.2-chat** migrates the chat topic. See design doc §6.2.

### Build status

- [x] `npm run lint:financial-surfaces` — ✓ 0 new violations (28 grandfathered)
- [x] `npx tsc --noEmit` — ✓ clean
- [x] `npx vitest run tests/onboarding/propertiesSync.test.ts` — ✓ 18/18 pass

### Documentation updated

- `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` — §6 table (F.2 row), new §6.1 (whole-aggregate scope + F.4/F.8 clarification) + §6.2 (chat deferred), header status.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 0 (F.2 in progress + scope decision).
- `docs/architecture/07_API_STANDARDS.md` — property/loan validation relaxation + property reform-field plumbing note.
- `docs/changelog/CHANGELOG_2026_05_20.md` — this entry.

## Session: Phase 12 Track F.3 — Onboarding two-way sync (accounts domain)

Branch: `claude/track-f3-accounts-sync-NL4XV`

### Scope

- **Type:** Feature — onboarding wizard ⇄ real-table two-way sync, accounts domain. Replicates the F.1/F.2 `*Sync.ts` pattern.
- **Refs:** `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` §5 (write contract), §6.3 (accounts + the three data sources).
- **Key rule:** the sync writes **MANUAL accounts only**. BASIQ (Open Banking) and IMPORT (file-import) accounts already have real rows written by their source — F.3 reads + displays them but never creates/updates/deletes them. Data-safe by construction; matches pre-F.3 behaviour.

### What was done

**1. `lib/onboarding/accountsSync.ts` — NEW (~340 LOC)**

- `readAccounts()` — GET `/api/accounts` → `AccountsSnapshot`; classifies each row by `balanceSource` (MANUAL/USER_VERIFIED/null → manageable; BASIQ/IMPORT → external).
- `diffAccounts()` — PURE idempotency core; only MANUAL accounts produce create/update/delete ops; BASIQ/IMPORT are passthrough.
- `syncAccounts()` — applies the diff via `/api/accounts`; re-reads.
- Mappers `snapshotToWizardAccounts` / `wizardAccountsToSnapshot` / `isPersistedId` / `accountRealId` (resolves the real id from `id` or the legacy `existingAccountId` for BASIQ/IMPORT). Quality guard: an unpersisted MANUAL account with no name is dropped.

**2. `prisma/schema.prisma` + migration — `ACCOUNT_*` audit actions**

- 3 new `AuditAction` values: `ACCOUNT_CREATED/UPDATED/DELETED`.
- Migration `20260520160000_phase_12_track_f3_account_audit_actions/migration.sql` — additive `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.

**3. `app/api/accounts/route.ts` + `[id]/route.ts`**

- `createAuditLog()` on POST/PUT/DELETE (`ACCOUNT_*`).
- POST gained `interestRate`; PUT gained `institution` — the pair now covers every wizard `AccountInput` field. `currentBalance` validation accepts 0.
- **Offset→loan link**: POST + PUT accept `linkedLoanId`; for an OFFSET account the route sets `Loan.offsetAccountId` server-side, atomically (`prisma.$transaction`), ownership-verified. PUT clears any stale link first (re-link / un-link).

**4. `components/onboarding/wizard/steps/AccountsStep.tsx` — rewired**

- New optional `registerStepCommit` prop. Reads the real `Account` table on open (merges real + unsynced in-session/chat-staged accounts), registers an async `commit` → `syncAccounts()` on Continue/Back. Loading + error banner.

**5. `components/onboarding/wizard/WizardContainer.tsx`** — passes `registerStepCommit` to `<AccountsStep>`.

**6. `app/api/onboarding/bulk-create/route.ts` — accounts loop → no-op for MANUAL**

The MANUAL `tx.account.create` block is removed (the accounts step's commit persists them). The BASIQ/IMPORT skip + their offset-linking branch is kept (F.3 doesn't manage externally-sourced accounts).

**7. `tests/onboarding/accountsSync.test.ts` — NEW (17 tests)**

Re-entry idempotency, mapper round-trip, create/update/delete classification, **BASIQ/IMPORT never written** (3 tests), quality guard, `isPersistedId`/`accountRealId`.

### Build status

- [x] `npm run lint:financial-surfaces` — ✓ 0 new violations
- [x] `npx tsc --noEmit` — ✓ clean
- [x] `npm run build` — ✓ succeeds
- [x] `npx vitest run tests/onboarding/accountsSync.test.ts` — ✓ 17/17 pass

### Documentation updated

- `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` — §6 table (F.2 → done, F.3 row), new §6.3 (accounts + the three data sources), header status.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 0 (F.2 done, F.3 in progress).
- `docs/architecture/07_API_STANDARDS.md` §15.8 — accounts route audit + offset-link + extended fields.
- `docs/architecture/03_DATA_MODEL.md` §N.4 — F.3 `ACCOUNT_*` audit actions.
- `docs/changelog/CHANGELOG_2026_05_20.md` — this entry.
