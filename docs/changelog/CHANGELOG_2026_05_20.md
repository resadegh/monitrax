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

## Session: Phase 12 Track F.4 — Onboarding two-way sync (debts domain)

Branch: `claude/track-f4-debts-sync-NL4XV`

### Scope

- **Type:** Feature — onboarding wizard ⇄ real-table two-way sync, debts domain (standalone non-property loans: car / student / personal / business). Replicates the F.1–F.3 `*Sync.ts` pattern.
- **Refs:** `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` §5 (write contract), §6.4 (debts scope + CAR-link deferral + budget/actuals invariant).
- **No schema change** — F.2 already added `createAuditLog()` + relaxed validation to the `/api/loans` routes; F.4 reuses them.

### What was done

**1. `lib/onboarding/debtsSync.ts` — NEW (~290 LOC)**

- `readDebts()` — GET `/api/loans`, filtered to non-property debt types (`CAR/STUDENT/PERSONAL/BUSINESS`). Reads **only the raw budget columns** (`principal`, `minRepayment`, `interestRateAnnual`) — never the transaction-reconciled actuals.
- `diffDebts()` — PURE idempotency core; create/update/delete classification.
- `syncDebts()` — applies the diff via `/api/loans`; re-reads.
- Mappers + `isPersistedId`. Quality guard: an unpersisted debt with `principal <= 0` is dropped (matches bulk-create's skip).

**2. `components/onboarding/wizard/steps/DebtsStep.tsx` — rewired**

- New optional `registerStepCommit` prop. Reads the real `Loan` table on open (merges real + unsynced; folds the old category pre-seed into the read so it can't race), commits the delta on Continue/Back. Loading + error banner.

**3. `components/onboarding/wizard/WizardContainer.tsx`** — passes `registerStepCommit` to `<DebtsStep>`.

**4. `app/api/onboarding/bulk-create/route.ts`**

- §4b debts loop → no-op (the Debts step's commit persists them).
- §5a → now *updates* the already-real CAR loan's `linkedAssetId` after the Assets loop (instead of creating the loan); ownership-verified.

**5. `tests/onboarding/debtsSync.test.ts` — NEW (11 tests)**

Re-entry idempotency, mapper round-trip, create/update/delete classification, quality guard, lender-is-not-persisted, HECS derivation, `isPersistedId`.

### Budget vs actuals (Reza directive 2026-05-20)

Confirmed + documented: the two-way sync reads/writes only the raw **budget** columns; the transaction-reconciled **actuals** (`actualFromTransactions`, `monthlyAverageActual`) are never read or written by F.2/F.3/F.4. Reconciliation stays fully independent. **DECIDED (Reza):** the wizard never surfaces actuals — onboarding captures the initial budget data only. A **post-onboarding completion message** (shown only when transactions were imported during the wizard) reminds the user about reconciliation and links to that page. Single follow-up — **F-reconcile-handoff** — after the F.5–F.8 sweep. Supersedes the earlier "actuals-on-re-entry" idea. See design doc §6.4.

### Build status

- [x] `npm run lint:financial-surfaces` — ✓ 0 new violations
- [x] `npx tsc --noEmit` — ✓ clean
- [x] `npx vitest run tests/onboarding/debtsSync.test.ts` — ✓ 11/11 pass
- [x] `npm run build` — ✓ succeeds

### Documentation updated

- `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` — §6 table (F.3 → done, F.4 row), new §6.4 (debts scope + CAR-link + budget/actuals invariant), header status.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 0 (F.3 done, F.4 in progress + budget/actuals invariant).
- `docs/changelog/CHANGELOG_2026_05_20.md` — this entry.

### Status

F.4 code complete + verified. PR held pending Reza's design call on whether "surface actuals on wizard re-entry" folds into the domain PRs or lands as a single follow-up. — **Resolved:** Reza confirmed the single-follow-up (`F-reconcile-handoff`) + the refined "completion message" approach (see the F-reconcile-handoff decision entry above); F.4 shipped as PR #838.

## Session: Phase 12 Track F.5 — Onboarding two-way sync (investments domain)

Branch: `claude/track-f5-investments-sync-NL4XV`

### Scope

- **Type:** Feature — onboarding wizard ⇄ real-table two-way sync, investments domain. The `InvestmentAccount` + `InvestmentHolding` **aggregate**, mirroring F.2's property aggregate.
- **Refs:** `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` §5 (write contract), §6.5 (investments aggregate).

### What was done

**1. `lib/onboarding/investmentsSync.ts` — NEW (~410 LOC)**

- `readInvestments()` — GET `/api/investments/accounts` (includes holdings) → `InvestmentsSnapshot`.
- `diffInvestments()` — PURE idempotency core; per-account `InvestmentOp` carrying nested `holdingOps`.
- `syncInvestments()` — CREATE POSTs the account then its holdings; UPDATE PUTs the account (if core changed) + applies holding ops; DELETE removes the account (holdings cascade-delete).
- Mappers + `isPersistedId`. Quality guards: a holding with no ticker / `units<=0` / `averagePrice<=0` is dropped; an unpersisted account with no name is dropped.

**2. `prisma/schema.prisma` + migration — `INVESTMENT_*` audit actions**

- 3 new `AuditAction` values: `INVESTMENT_CREATED/UPDATED/DELETED`.
- Migration `20260520180000_phase_12_track_f5_investment_audit_actions/migration.sql` — additive `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.

**3. `/api/investments/accounts` + `/api/investments/holdings` (route.ts + [id])**

- `createAuditLog()` on every state-changing write — `INVESTMENT_*` for the account; generic `CREATE/UPDATE/DELETE` (`entityType: 'InvestmentHolding'`) for holdings (incl. the holdings PATCH price-update).

**4. `components/onboarding/wizard/steps/InvestmentsStep.tsx` — rewired**

- New optional `registerStepCommit` prop. Reads the real tables on open (merges real + unsynced accounts), commits the delta on Continue/Back. Loading + error banner.

**5. `components/onboarding/wizard/WizardContainer.tsx`** — passes `registerStepCommit` to `<InvestmentsStep>`.

**6. `app/api/onboarding/bulk-create/route.ts`** — §4 investments loop → no-op; `firstInvestmentAccountId` (used for INVESTMENT-income linking) now resolved from the real `data.investments[0].id` instead of this route's own creates.

**7. `tests/onboarding/investmentsSync.test.ts` — NEW (11 tests)**

Re-entry idempotency, mapper round-trip, account create/update/delete, nested holding create+update+delete, cascade-delete (holdingOps empty on account delete), quality guards, `isPersistedId`.

### Build status

- [x] `npm run lint:financial-surfaces` — ✓ 0 new violations
- [x] `npx tsc --noEmit` — ✓ clean
- [x] `npm run build` — ✓ succeeds
- [x] `npx vitest run tests/onboarding/investmentsSync.test.ts` — ✓ 11/11 pass

### Documentation updated

- `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` — §6 table (F.4 → done, F.5 row), new §6.5 (investments aggregate), header status.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 0 (F.4 merged, F.5 in progress).
- `docs/architecture/07_API_STANDARDS.md` §15.8 — investment routes audit.
- `docs/architecture/03_DATA_MODEL.md` §N.4 — F.5 `INVESTMENT_*` audit actions.
- `docs/changelog/CHANGELOG_2026_05_20.md` — this entry.

## Session: Phase 12 Track F.6 — Onboarding two-way sync (superannuation domain)

Branch: `claude/track-f6-super-sync-NL4XV`

### Scope

- **Type:** Feature — onboarding wizard ⇄ real-table two-way sync, superannuation domain. `SuperannuationAccount` is a flat entity — mirrors the F.3 accounts layer.
- **Refs:** `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` §5 (write contract), §6.6 (super).

### What was done

**1. `lib/onboarding/superSync.ts` — NEW (~290 LOC)**

- `readSuper()` — GET `/api/tax/super` → maps the `accounts` array to `SuperRecord`s (name / fundName / currentBalance — the three minimum-viable wizard fields).
- `diffSuper()` — PURE idempotency core; create/update/delete classification.
- `syncSuper()` — applies the diff via the super API; re-reads.
- Mappers + `isPersistedId`. Quality guard: an unpersisted account with no fund name AND 0 balance is dropped (matches bulk-create's skip).

**2. `prisma/schema.prisma` + migration — `SUPER_*` audit actions**

- 3 new `AuditAction` values: `SUPER_CREATED/UPDATED/DELETED`.
- Migration `20260520200000_phase_12_track_f6_super_audit_actions/migration.sql` — additive `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.

**3. `app/api/tax/super/[id]/route.ts` — NEW**

- PUT (partial update — name/fundName/currentBalance; other `SuperannuationAccount` columns untouched) + DELETE, both ownership-guarded (`verifyOwnership`) + audited. The parent `/api/tax/super` had GET + POST only.

**4. `app/api/tax/super/route.ts`** — `createAuditLog()` (`SUPER_CREATED`) added to POST.

**5. `components/onboarding/wizard/steps/SuperStep.tsx` — rewired**

- New optional `registerStepCommit` prop. Reads the real table on open (merges real + unsynced accounts), commits the delta on Continue/Back. Loading + error banner.

**6. `components/onboarding/wizard/WizardContainer.tsx`** — passes `registerStepCommit` to `<SuperStep>`.

**7. `app/api/onboarding/bulk-create/route.ts`** — §4a super loop → no-op.

**8. `tests/onboarding/superSync.test.ts` — NEW (11 tests)**

Re-entry idempotency, mapper round-trip, create/update/delete, quality guard, `isPersistedId`.

### Build status

- [x] `npm run lint:financial-surfaces` — ✓ 0 new violations
- [x] `npx tsc --noEmit` — ✓ clean
- [x] `npm run build` — ✓ succeeds
- [x] `npx vitest run tests/onboarding/superSync.test.ts` — ✓ 11/11 pass

### Documentation updated

- `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` — §6 table (F.5 → done, F.6 row), new §6.6 (super), header status.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 0 (F.5 merged, F.6 in progress).
- `docs/architecture/07_API_STANDARDS.md` §15.8 — new `/api/tax/super/[id]` route + audit.
- `docs/architecture/03_DATA_MODEL.md` §N.4 — F.6 `SUPER_*` audit actions.
- `docs/changelog/CHANGELOG_2026_05_20.md` — this entry.

## Session: Phase 12 Track F.7 — Onboarding two-way sync (assets domain)

Branch: `claude/track-f7-assets-sync-NL4XV`

### Scope

- **Type:** Feature — onboarding wizard ⇄ real-table two-way sync, assets domain. The `Asset` + its `Expense`s **aggregate**, mirroring F.2's property aggregate.
- **Refs:** `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` §5 (write contract), §6.7 (assets aggregate).

### What was done

**1. `lib/onboarding/assetsSync.ts` — NEW (~410 LOC)**

- `readAssets()` — GET `/api/assets` (includes expenses) → `AssetsSnapshot`.
- `diffAssets()` — PURE idempotency core; per-asset `AssetOp` carrying nested `expenseOps`.
- `syncAssets()` — CREATE POSTs the asset then its expenses; UPDATE PUTs the asset (if core changed) + applies expense ops; DELETE removes the asset's expenses FIRST (`Expense.asset` is `onDelete: SetNull` — avoid orphans) then the asset.
- Mappers + `isPersistedId`. Quality guards: an expense with `amount<=0` is dropped; an unpersisted asset with no `purchaseDate` is dropped.

**2. `prisma/schema.prisma` + migration — `ASSET_*` audit actions**

- 3 new `AuditAction` values: `ASSET_CREATED/UPDATED/DELETED`.
- Migration `20260520220000_phase_12_track_f7_asset_audit_actions/migration.sql` — additive `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.

**3. `app/api/assets/route.ts` + `[id]/route.ts`**

- `createAuditLog()` on POST/PUT/DELETE (`ASSET_*`). `purchasePrice` / `currentValue` validated/written as *present* (not *truthy*) on POST + PUT — `0` is a legitimate value.

**4. `components/onboarding/wizard/steps/AssetsStep.tsx` — rewired**

- New optional `registerStepCommit` prop. Reads the real tables on open (merges real + unsynced assets), commits the delta on Continue/Back. Loading + error banner.

**5. `components/onboarding/wizard/WizardContainer.tsx`** — passes `registerStepCommit` to `<AssetsStep>`.

**6. `app/api/onboarding/bulk-create/route.ts`** — §5 assets loop → no-op (removed the now-dead `getAssetName` helper); §5a (CAR-debt → vehicle-asset link) rewired — both `data.debts[i].id` and `data.debts[i].linkedAssetId` are real post-F.7, so it wires the link directly, ownership-verifying both rows.

**7. `tests/onboarding/assetsSync.test.ts` — NEW (11 tests)**

Re-entry idempotency, mapper round-trip, asset create/update/delete, nested expense create+update+delete, expenses-deleted-first-on-asset-delete, quality guards, `isPersistedId`.

**8. `.audit/financial-math-baseline.json` — re-keyed**

F.7's `AssetsStep.tsx` edits shifted a pre-existing grandfathered financial-math entry (`asset.purchasePrice - asset.currentValue`, an inline depreciation calc) from line 195 → 224. Regenerated the baseline (`BASELINE_REGENERATE=1`) — only that one entry's line number changed, no entries added/removed (count stays 28). The §835 line-shift pattern.

### Build status

- [x] `npm run lint:financial-surfaces` — ✓ 0 new violations (after baseline re-key)
- [x] `npx tsc --noEmit` — ✓ clean
- [x] `npm run build` — ✓ succeeds
- [x] `npx vitest run tests/onboarding/assetsSync.test.ts` — ✓ 11/11 pass

### Documentation updated

- `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` — §6 table (F.6 → done, F.7 row), new §6.7 (assets aggregate), header status.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 0 (F.6 merged, F.7 in progress).
- `docs/architecture/07_API_STANDARDS.md` §15.8 — assets route audit + validation.
- `docs/architecture/03_DATA_MODEL.md` §N.4 — F.7 `ASSET_*` audit actions.
- `docs/changelog/CHANGELOG_2026_05_20.md` — this entry.

---

## Session: Phase 12 Track F.8 — Onboarding two-way sync (income/expenses domain)

Branch: `claude/track-f8-income-expenses-sync-NL4XV`

### Scope

- **Type:** Feature — onboarding wizard ⇄ real-table two-way sync, income/expenses domain. The **LAST** Track F domain. The wizard's Income & Expenses step captures two flat lists; F.8 syncs both `Income` + `Expense` (F.3-shaped, two flat entities — not an aggregate).
- **Scope boundary — GENERAL only:** F.8 owns only **general** (non-property, non-loan, non-asset, non-investment) income + expenses. Property-attached rows are F.2's; asset expenses F.7's; INVESTMENT-type income stays with `bulk-create`.
- **Refs:** `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` §5 (write contract), §6.4 (budget-vs-actuals invariant), §6.8 (income/expenses scope).

### What was done

**1. `lib/onboarding/incomeExpensesSync.ts` — NEW (~450 LOC)**

- `readIncomeExpenses()` — GET `/api/income` + GET `/api/expenses` in parallel. **Filters to GENERAL rows only** — `isGeneralIncome()` / `isGeneralExpense()` require `sourceType === 'GENERAL'` AND every FK link field null (`propertyId`/`investmentAccountId` for income; `propertyId`/`loanId`/`assetId`/`investmentAccountId` for expenses). Reads ONLY the raw budget `amount` — never the transaction-reconciled actuals (budget-vs-actuals invariant, design doc §6.4).
- `diffIncomeExpenses()` — PURE idempotency core. Holds two lists (`incomes` + `expenses`); a shared generic `diffList()` produces create/update/delete ops for each.
- `syncIncomeExpenses()` — applies the diff via `/api/income` + `/api/expenses` (per-id PUT/DELETE); re-reads.
- Mappers (`snapshotToWizardIncome` / `snapshotToWizardExpenses` / `wizardToSnapshotIncomeExpenses`) + `isPersistedId`. Writes create rows with `sourceType: 'GENERAL'`. Quality guard: an unpersisted row with `amount <= 0` is dropped (matches `bulk-create` sections 6/7); a persisted row is always kept.

**2. No schema change**

F.2 already added `createAuditLog()` to `/api/income` + `/api/expenses` (generic `CREATE/UPDATE/DELETE`, `entityType: 'Income'` / `'Expense'`). F.8 reuses the route surface unchanged — no new `AuditAction` values, no migration (like F.4).

**3. `components/onboarding/wizard/steps/IncomeExpensesStep.tsx` — rewired**

- New optional `registerStepCommit` prop. Reads the real tables on open (merges real GENERAL rows + unsynced in-session rows for both income + expenses), commits the delta on Continue/Back. Loading + error banner. Track F.8 header JSDoc.

**4. `components/onboarding/wizard/WizardContainer.tsx`** — passes `registerStepCommit` to `<IncomeExpensesStep>`.

**5. `app/api/onboarding/bulk-create/route.ts`** — sections 6 (income) + 7 (expenses) → no-op for GENERAL rows. Section 6 preserves the INVESTMENT-income path (INVESTMENT income is not general income — it links to an `InvestmentAccount`). Section 7 → `never[]` placeholder.

**6. `tests/onboarding/incomeExpensesSync.test.ts` — NEW (17 tests)**

Re-entry idempotency (both lists), mapper round-trip, create/update/delete classification for income AND expenses, quality guards, `isPersistedId`.

### Build status

- [x] `npm run lint:financial-surfaces` — ✓ 0 new violations (28 grandfathered, unchanged)
- [x] `npx tsc --noEmit` — ✓ clean
- [x] `npm run build` — ✓ succeeds
- [x] `npx vitest run tests/onboarding/incomeExpensesSync.test.ts` — ✓ 17/17 pass

### Documentation updated

- `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` — §6 table (F.6/F.7 → done, F.8 row), new §6.7 (assets) + §6.8 (income/expenses + GENERAL filter), header status.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 0 (F.6/F.7 done, F.8 in progress).
- `docs/architecture/07_API_STANDARDS.md` §15.8 — F.7 + F.8 notes (F.8 reused the already-audited income/expense routes).
- `docs/changelog/CHANGELOG_2026_05_20.md` — this entry.

---

## Session: Onboarding chat agent — Sonnet upgrade

Branch: `claude/chat-ai-model-upgrade-NL4XV`

### Scope

- **Type:** Fix — the conversational onboarding agent ("chat mode") repeatedly failed to understand answers.
- **Root cause:** the agent (`lib/ai/onboarding-agent/gateway.ts`) FORCES a structured tool call and validates the result against the strict `wizardStateDeltaSchema` discriminated union. It ran on **Haiku**, which frequently emits output that fails that validation → the gateway returns `SCHEMA_VIOLATION` / `NO_TOOL_USE` → the user sees "Could not understand the answer." Even trivial replies ("yes", "move on") flaked. Haiku is the codebase's cheap-triage model — it does not do forced structured extraction reliably.

### What was done

- `lib/ai/anthropic.ts` — added a **`SONNET`** tier (`claude-sonnet-4-6`) to `ANTHROPIC_MODELS`. Mid-tier — reliable structured tool-call extraction; far cheaper than Opus (which is reserved for synthesis work, never per-message). Header + cost-control comments updated.
- `lib/ai/onboarding-agent/gateway.ts` — the onboarding extraction now uses `ANTHROPIC_MODELS.SONNET`. Onboarding is once-per-user and daily-capped (200 extractions/user/day), so the cost delta over Haiku is negligible.
- `app/api/onboarding/chat/extract/route.ts` — warmer copy on the extraction-failure path (warm-words rule, CLAUDE.md §14): "Sorry — I didn't quite catch that. Could you put it another way?"
- `.gitignore` — ignore `.claude/worktrees/` (ephemeral background-agent worktrees; never part of the repo).

### Build status

- [x] `npm run lint:financial-surfaces` — ✓ 0 new violations
- [x] `npx tsc --noEmit` — ✓ clean
- [x] `npm run build` — ✓ succeeds

### Follow-up (not in this PR)

A natural-answer / count-handling improvement (e.g. "yes 6 properties" — the user gives a count, but the properties schema has no count field and every entry needs a name) is a separate chat-script + schema change. The Sonnet upgrade alone makes the extraction far more capable; the count-handling refinement is queued.

---

## Session: Phase 12 Track F — F-reconcile-handoff (post-onboarding reconciliation handoff)

Branch: `claude/track-f-reconcile-handoff-NL4XV`

### Scope

- **Type:** Feature — the post-onboarding reconciliation handoff. Closes the Track F decision (Reza, 2026-05-20): the wizard NEVER surfaces transaction-reconciled actuals; instead a completion-screen message bridges the user to reconciliation when they imported transactions during the wizard.
- **Refs:** `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` §6.4 (budget-vs-actuals invariant + the DECIDED handoff).

### What was done

**`components/onboarding/wizard/steps/ReviewStep.tsx` — handoff card added**

- The wizard's final `ReviewStep` (the confetti / "your TRAIL begins" completion screen) now renders a closing card **only when** the user connected or file-imported accounts during the wizard — `data.accounts.some(a => a.source === 'BASIQ' || a.source === 'IMPORT')`.
- The signal is already in wizard state (`AccountInput.source`), so the card costs **zero new fetch, no API endpoint, no schema change** — purely presentational.
- The card explains that real transactions are flowing in, frames the wizard amounts as the *starting budget*, and names `My Budget → Cashflow` (`/cashflow`) as where to see plan vs reality. It never shows an actual figure.
- **Not a hyperlink** — by design. Navigating away from `ReviewStep` would skip the footer's completion handler (`onComplete` → `onboardingCompleted`). Naming the destination keeps "see plan vs reality" a *deliberate* post-onboarding action.
- No card for MANUAL-only setups (nothing imported to reconcile against) — matches the §6.4 decision. The "connect your bank" nudge alternative was deliberately not built (different CTA / different page — out of scope for F-reconcile-handoff).

**`.audit/financial-math-baseline.json` — re-keyed**

The ReviewStep edits shifted a pre-existing grandfathered financial-math entry (`summary.annualExpenses + summary.annualLoanRepayments`, an inline metric in `MetricCard`) from line 201 → 221. Regenerated the baseline (`BASELINE_REGENERATE=1`) — only that one entry's line number changed, no entries added/removed (count stays 28). The §835 line-shift pattern.

### Build status

- [x] `npm run lint:financial-surfaces` — ✓ 0 new violations (after baseline re-key)
- [x] `npx tsc --noEmit` — ✓ clean
- [x] `npm run build` — ✓ succeeds

### Documentation updated

- `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` — header status (F.8 done, F-reconcile-handoff done), §6 table (F.8 → done + new F-reconcile-handoff row), §6.4 "✅ BUILT" implementation note.
- `docs/IMPLEMENTATION_PLAN.md` — Up Next row 0 (F.8 merged, F-reconcile-handoff done, remaining F.9 → F.10 → F.11).
- `docs/changelog/CHANGELOG_2026_05_20.md` — this entry.

---

## Session: Phase 12 Track G — Unified Conversational Onboarding (G.0 — companion prototype)

Branch: `claude/track-g-unified-onboarding-NL4XV`

### Scope

- **Type**: Feature (design + prototype) — Phase 12 Track G G.0.
- **Driver**: Reza, 2026-05-20 — the form wizard and the standalone AI chat are two implementations of one job; the chat "is clunky, doesn't get the questions, and breaks", the form is "dry, old-school". Decision: merge into one surface — the form stays the system of record, an AI **companion** lives alongside it (narrates each step, reads what the user entered, reacts with warm advice-free reflection).
- **This session**: the design doc for the whole track + the **G.0 prototype** — the companion wired to the household step only, so Reza can evaluate the concept before the full build.

### Design

New design doc `docs/blueprint/PHASE_12_TRACK_G_UNIFIED_ONBOARDING.md` — problem, the guide-only-v1 decision, target architecture (keep the 12-step wizard spine + Track F sync layers; evolve `AIHelper`; add the companion; delete the chat state-machines in G.2), the companion contract, the build sequence G.0–G.5, risks.

**F.10 / F.11 disposition** (the redundancy check Reza asked for):
- **F.10 (conversational enrichment) — SUPERSEDED.** It was scoped as enrichment states bolted onto the chat script state-machines, which Track G deletes. Its *intent* (progressive optional-field enrichment) folds into the Track G companion.
- **F.11 (document upload) — RE-HOMED, not redundant.** Re-parented from "mid-chat" to "mid-onboarding companion" as G.5.
- **F.9 (retire bulk-create) — RE-SEQUENCED** into Track G as G.3 (the chat write path is removed in G.2; doing F.9 first would be wasted motion).

### Files added

- `lib/ai/onboarding-agent/companionGateway.ts` — `generateCompanionReflection()`: a warm, bounded, **advice-free** reflection LLM call (Haiku). Separate concern from the extraction gateway. Sees a counts/flags-only snapshot — never names, never CDR values.
- `app/api/onboarding/companion/route.ts` — `POST`, `withPermission('settings.write')`, the standard `{success,data,error,meta}` envelope. Validates the snapshot is counts/flags only (rejects string values → enforces the no-PII contract server-side). Shares the daily `ONBOARDING_AGENT_EXTRACTION` cap (no new `AuditAction` → no schema migration); audits with snapshot KEY names only (CDR §13.3).
- `components/onboarding/wizard/CompanionPanel.tsx` — the docked companion. Scripted household intro (instant, never fails) + an auto-fetched reflection that reads the de-identified household snapshot. The companion is **never a dependency** — every failure path is silent, the form is untouched.
- `docs/blueprint/PHASE_12_TRACK_G_UNIFIED_ONBOARDING.md` — the Track G design doc.

### Files modified

- `components/onboarding/wizard/WizardContainer.tsx` — renders `CompanionPanel` above `HouseholdStep` ("the form opens underneath"); suppresses the header `AIHelper` trigger on the household step (the companion is the help there).
- `docs/blueprint/PHASE_12_ONBOARDING_TWO_WAY_SYNC.md` — header + §6 table + §10: F.10 superseded, F.11 re-homed, F.9 re-sequenced.
- `docs/IMPLEMENTATION_PLAN.md` — row 0 (Track F remaining queue superseded) + new row 0G (Track G).

### Build status

- [x] `npx tsc --noEmit` — ✓ clean
- [ ] `npm run build` — pending
- [ ] `npm run lint:financial-surfaces` — pending

### Notes

G.0 is deliberately household-only — a deployable proof of the concept for Reza to evaluate before G.1 rolls the companion to all 12 steps. The standalone chat (`ConversationalSetup`, the 8 script state-machines, the mode-selector) is **not** touched in G.0 — its removal is G.2.

---

## Session: Phase 12 Track G — G.0 HOTFIX (companion fetch logged the user out)

Branch: `claude/track-g-companion-auth-hotfix-NL4XV`

### Changes Made

- **Type**: Fix (production hotfix).
- **Scope**: `components/onboarding/wizard/CompanionPanel.tsx`.
- **Root cause**: The G.0 `CompanionPanel` fetch to `/api/onboarding/companion` shipped **without an `Authorization: Bearer` header**. The route is `withPermission('settings.write')`, so a tokenless request returns **401**. `SessionExpiryHandler` interprets any 401-from-a-tokenless-fetch as a dead session and **logs the user out**. The household step pre-loads the user's existing household members on open (`readHousehold()`), so `memberCount > 0` immediately → the companion's reflection fired ~2.2s after the step opened → 401 → logout. Reza hit this every time on PROD. This is the same class as PR #798 / Tech Debt #20 ("never assume the wrapped `fetch` adds the header").
- **Solution**: `CompanionPanel` now reads `token` from `useAuth()` (the canonical onboarding pattern — `HouseholdStep`, `ConversationalSetup` and the `*Sync.ts` layers all do this) and (a) sends `Authorization: Bearer ${token}` on the fetch, (b) skips the reflection entirely while `token` is null — so the route is never hit unauthenticated. The companion is never a dependency, so skipping is harmless.

### Files Modified

- `components/onboarding/wizard/CompanionPanel.tsx` — `useAuth()` token; `Authorization` header on the fetch; `if (!token) return` guard; `token` added to the effect deps.

### Build Status

- [x] `npx tsc --noEmit` — ✓ clean
- [x] `npm run build` — ✓ succeeds

### Lesson

A new client→API fetch is never complete until it carries the Bearer token. The wrapped `window.fetch` does NOT auto-inject it outside admin surfaces. This should have been caught in G.0 review — added to the mental checklist for G.1 (every step's companion fetch).

---

## Session: Phase 12 Track G — G.1a (the conversational guide — household step)

Branch: `claude/track-g1-conversational-guide-NL4XV`

### Scope

- **Type**: Feature — Phase 12 Track G, G.1a.
- **Driver**: Reza feedback on the G.0 prototype, 2026-05-21 — G.0's companion "doesn't have the conversation feel anymore, the AI is only feedback". **Scope sharpened**: the onboarding companion should *guide* the user through setup ("now let's create your accounts", "tell me about your properties") — it is **push-only**; it does NOT field free-form questions. The full conversational AI (talk-with-it Q&A) belongs to **My Guide**, a separate surface, out of Track G scope. (An interim proposal to add a Q&A composer to the onboarding companion was considered and rejected.)
- **This session**: documented the corrected scope + the guided-conversation model in the Track G doc, and rebuilt the **household step** in that style for Reza to merge + evaluate before G.1b rolls it to all 12 steps.

### The guided-conversation model

Onboarding is reframed from "a 12-step form with a helper" into "a guided conversation the companion hosts". Each step is a *beat* with three companion moves: a scripted **invitation** (warm, instant, never fails), an LLM **reaction** (reads a counts-only snapshot), and a scripted **bridge** that names the next step — the connective tissue that turns 12 forms into one conversation. G.1b adds cross-step **memory** (deterministic, from `WizardData`) + **adaptive narration**.

### Files modified

- `components/onboarding/wizard/CompanionPanel.tsx` — reworked from a static intro+reflection panel into the step's **host**: a staggered greeting + invitation (the companion introduces itself + the journey, then invites the first action), the LLM reaction (kept from G.0, still auth'd with the Bearer token), and a forward **bridge** that names the next step. Messages render as conversational turns with a fade-in.
- `components/onboarding/wizard/WizardContainer.tsx` — passes `nextStepLabel` (`steps[currentStepIndex + 1]?.title`) to `CompanionPanel` so the bridge is concrete.
- `styles/wizard-animations.css` — new `companion-bubble-enter` keyframe (fade + rise; respects `prefers-reduced-motion`).
- `docs/blueprint/PHASE_12_TRACK_G_UNIFIED_ONBOARDING.md` — rewritten §3 (scope: companion guides, does not chat; full AI = My Guide), §5 (the guided-conversation model — invitation/reaction/bridge/memory/adaptive), §6 (revised sequence — G.1a/G.1b), §9 (what G.1a ships).
- `docs/IMPLEMENTATION_PLAN.md` — row 0G updated (G.0 done + hotfix; G.1a in progress; revised sequence).

### Build status

- [x] `npx tsc --noEmit` — ✓ clean
- [x] `npm run lint:financial-surfaces` — ✓ 0 new violations
- [x] `npm run build` — ✓ succeeds

### Notes

No backend change — the reaction reuses the G.0 `companionGateway` + `/api/onboarding/companion`; invitation and bridge are scripted/deterministic. Scope is the household step only; `AIHelper` stays on the other 11 steps until G.1b removes it. The companion fetch carries the Bearer token (G.0 hotfix lesson applied).

---

## Session: Phase 12 Track G — G.1a pacing iteration (paced, one-line-at-a-time companion)

Branch: `claude/track-g1a-conversation-pacing-NL4XV`

### Scope

- **Type**: Fix / UX iteration on G.1a (PR #847).
- **Driver**: Reza feedback 2026-05-21, with a screenshot — on login with existing household data the companion conversation "jumped to the end" (greeting + invitation + reaction + bridge all stacked at once); and the stacked-bubble layout was a "text message feel". Reza: *"the conversation needs to reset on the page and be on time"* and *"have a one line ai and 1 line user and they replace with new ones rather than a text message feel."*

### Changes Made

- **`components/onboarding/wizard/CompanionPanel.tsx`** — reworked from a stacked thread into a **paced, one-line-at-a-time** exchange:
  - A **phase machine** (`greeting → invitation → reaction → bridge`) that **always starts at the greeting on mount** and advances on timers/events. This is the "reset on the page and be on time" fix — a returning user with existing data now sees the conversation play out in order, paced, instead of jumping to the end.
  - **One companion line + one "you" line**, both swapped *in place* (not appended). The "you" line is a compact deterministic summary of what the user entered (e.g. "2 adults · 3 pets · 3 cars"), right-aligned. No stacked thread.
  - A typing-dots indicator covers the reaction fetch.
- **`lib/ai/onboarding-agent/companionGateway.ts`** — reaction prompt capped at **one short sentence** (≤18 words) so the companion line stays one line.
- **`styles/wizard-animations.css`** — added `companion-typing-dot` keyframe (the typing indicator); both companion animations respect `prefers-reduced-motion`.
- Docs: Track G doc §5 (new "Presentation — paced, one line at a time" subsection), §8, §9; `IMPLEMENTATION_PLAN.md` row 0G.

### Build status

- [x] `npx tsc --noEmit` — ✓ clean
- [x] `npm run lint:financial-surfaces` — ✓ 0 new violations
- [x] `npm run build` — ✓ succeeds

### Notes

`WizardContainer` already passes `nextStepLabel` (from #847) — no change needed there. The companion remains push-only, never a dependency, counts-only snapshot, and carries the Bearer token.

---

## Session: Phase 12 Track G — G.1a accent + typewriter iteration

Branch: `claude/track-g1a-companion-accent-NL4XV`

### Scope

- **Type**: UX iteration on G.1a.
- **Driver**: Reza feedback 2026-05-21, with a screenshot — *"the ai box is not visible enough. It is the same font size and shape and it is blending into the whole page. This feature needs to be accent and bold. It should be the same design as apple-like websites that feels modern when the text is typing."*

### Changes Made

- **`components/onboarding/wizard/CompanionPanel.tsx`**:
  - **Accent glow.** The companion card now sits inside an Apple-Intelligence-style **glow halo** (a soft blurred gradient that gently breathes) on a crisp, lifted surface (indigo-tinted shadow + ring) — so it reads as *the* AI surface, not a soft card that blends into the page.
  - **Typewriter.** Each companion line now **types out** character-by-character (`useTypewriter`, ~22ms/char) with a blinking caret — the modern-AI "typing" feel. The reaction is still preceded by typing-dots (think → speak).
  - **Bolder line.** The companion line is larger (`text-[15px]`, medium weight) and rendered directly on the card surface (no inner bubble that mushed into the background).
- **`styles/wizard-animations.css`** — `companion-glow` (halo breathe) + `companion-caret` (caret blink) keyframes; both respect `prefers-reduced-motion`.
- Docs: Track G doc §5 (visual treatment) + §9 (accent iteration note); `IMPLEMENTATION_PLAN.md` row 0G.

### Build status

- [x] `npx tsc --noEmit` — ✓ clean
- [x] `npm run lint:financial-surfaces` — ✓ 0 new violations
- [x] `npm run build` — ✓ succeeds

### Notes

No backend change. All new motion (glow, caret, typing dots, bubble-enter) honours `prefers-reduced-motion` — reduced-motion users get the full text instantly with no animation.

---

## Session: Phase 12 Track G — G.2 (retire the standalone chat)

Branch: `claude/track-g2-retire-chat-NL4XV`

### Scope

- **Type**: Refactor — dead-code removal (§12.1).
- **Driver**: Reza 2026-05-21 — *"I can still see the toggle between chat and form and also switch to chat option which are both redundant now — remove those."* The unified in-wizard companion (Track G.1) replaced the standalone chat path; keeping it was a §12.1/§12.3 violation (two onboarding implementations).

### Changes Made

**Deleted (24 files):**
- `components/onboarding/wizard-chat/` — the entire chat UI + the 8 per-topic script state-machines (`householdScript`, `propertiesScript`, `debtsScript`, `accountsScript`, `investmentsScript`, `superScript`, `assetsScript`, `incomeExpensesScript`), `ConversationalSetup`, `ChatThread`, `ChatComposer`, `AgentMessage`, `UserMessage`, `TopicRecapCard`, `draftHydration`, `PresenceOrb`, the `design/` tokens.
- `components/onboarding/ConversationalModeToggle.tsx`, `components/onboarding/OnboardingModeSelector.tsx`.
- `lib/featureFlags/conversationalOnboardingGate.ts`, `lib/featureFlags/ConversationalOnboardingGateContext.tsx`.
- `app/api/feature-flags/conversational-onboarding/route.ts`.

**Edited:**
- `app/onboarding/page.tsx` — rewritten: no mode-selector, no `?mode=` handling, no flag check, no `Suspense`/`useSearchParams`. Always renders `<WizardContainer mode="page" />`.
- `app/onboarding/layout.tsx` — removed the `ConversationalOnboardingGateProvider` wrapper (kept `BasiqGateProvider`).
- `app/api/admin/feature-flags/[key]/route.ts` — removed the `CONVERSATIONAL_ONBOARDING` import block + the cache-invalidation `if` branch.
- `prisma/seed-feature-flags.ts` — removed the `CONVERSATIONAL_ONBOARDING` flag entry (only `BASIQ_INTEGRATION` remains). Any existing DB flag row is harmless + inert.
- `lib/ai/onboarding-agent/tools/extractWizardStepDelta.ts` — header comment updated (the chat client it referenced is gone).

**Kept dormant (per Track G §4 — re-used by G.4):** the extraction gateway (`lib/ai/onboarding-agent/gateway.ts`), the delta schemas, the extract tools, and `app/api/onboarding/chat/extract/route.ts`. These are intentionally retained, not dead code — G.4's "describe it in your own words" accelerator re-uses them.

### Build status

- [x] `npx tsc --noEmit` — ✓ clean (after a clean `.next` rebuild — stale generated route types)
- [x] `npm run lint:financial-surfaces` — ✓ 0 new violations
- [x] `npm run build` — ✓ succeeds

### Notes

`/onboarding` is now always the form wizard with its companion — no chat, no mode choice. No schema migration: the `CONVERSATIONAL_ONBOARDING` `GlobalFeatureFlag` row (if present in a DB) is simply never read again.

---

## Session: Phase 12 Track G — G.1b (companion on all steps) + AIHelper cleanup

Branch: `claude/track-g1b-companion-all-steps-NL4XV`

### Scope

- **Type**: Feature — Phase 12 Track G, G.1b.
- **Driver**: Reza 2026-05-21 — *"lets build the rest of the steps with the same design"* + *"delete the legacy onboarding wizards that you hide for cleanup."*

### Changes Made

**Companion rolled to all 9 entity-collection steps:**
- `components/onboarding/wizard/CompanionPanel.tsx` — generalised from household-only to a per-step `STEP_CONFIG` (invitation + counts-snapshot + you-summary) covering household, entities, properties, debts, accounts, investments, super, assets, income-expenses. Exports `isCompanionStep()`. The greeting shows only on the first companion step (household). `welcome` + `review` have no companion (welcome is a quick picker; review is the celebration screen).
- `lib/ai/onboarding-agent/companionGateway.ts` — `CompanionStep` widened to the 9 ids; new `COMPANION_STEPS` runtime list; per-step `STEP_BRIEF` (the LLM context for each step's reaction); reaction prompt phrasing tidied.
- `app/api/onboarding/companion/route.ts` — validates the incoming `step` against `COMPANION_STEPS` (was hard-coded to `household`); passes the real step to the gateway.
- `components/onboarding/wizard/WizardContainer.tsx` — `CompanionPanel` lifted out of the household case into the shared Body, rendered above every companion-eligible step, **keyed by step id** so it remounts and replays that step's beat on navigation.

**Legacy cleanup (the "hidden" onboarding helper):**
- Deleted `components/onboarding/wizard/AIHelper.tsx` — a passive Q&A drawer with **mocked** (fake) responses; suppressed on the household step in G.0, fully superseded by the companion. Removed its barrel export + the `WizardContainer` header trigger.

### Build status

- [x] `npx tsc --noEmit` — ✓ clean
- [x] `npm run lint:financial-surfaces` — ✓ 0 new violations
- [x] `npm run build` — ✓ succeeds

### Legacy onboarding code — flagged, not deleted

While scanning for legacy onboarding code, found the disabled `lib/services/onboardingEstimateService.ts` (throws `OnboardingDisabledError`) + 6 orphaned `/api/onboarding/estimates/*` routes — genuinely dead (no live caller; only a stale comment in `chat/extract/route.ts` mentions them). **Not deleted on this PR** — flagged to Reza for a separate, focused cleanup PR (deleting a 7-file subsystem deserves its own verified change).

### Notes

Cross-step memory ("you mentioned two kids earlier…") + adaptive narration are deferred to a later polish pass — G.1b delivers the companion on every step in the established paced / accent / typewriter design.
