# Changelog — 2026-06-03

## Session: brave-shannon-mr1ye (cont.) — xlsx/SheetJS security migration

### Changes Made
- **Type**: Dependency / security fix
- **Scope**: `xlsx` (report/tax-pack Excel exporters).
- **Origin**: Reza — "ok go ahead" (the recommended next security item: the last production high-severity advisory).

### Research finding (decisive)
- `xlsx` is **write-only** in Monitrax — 2 files (`lib/reports/exporters/xlsx.ts`, `lib/bookkeeping/taxPack/xlsxExporter.ts`), both exporters (`book_new` / `aoa_to_sheet` / `write`-to-buffer). **Zero `XLSX.read`/parsing anywhere.** Both advisories (Prototype Pollution GHSA-4r6h-8v6p-xvw6, ReDoS GHSA-5pgg-2g8v-p4x9) are parse-triggered → **not reachable** in our usage.
- The GHSAs have patched versions (0.19.3, 0.20.2) that aren't on the npm registry (SheetJS publishes to its own CDN) — which is why npm showed "no fix available."

### Fix
- Repointed `xlsx` to the **SheetJS CDN build 0.20.3** (`https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) — the vendor's official patched distribution. **Zero code change** (identical API). 0.20.3 is above both GHSA ranges, so npm audit no longer flags it.

### Verification
- Installed: `xlsx@0.20.3` (lockfile records the CDN URL + integrity hash).
- `npm audit` → `xlsx` no longer listed. Prod (`--omit=dev`): **0 high, 0 critical** (was 1 high = xlsx), 14 moderate.
- `tsc --noEmit` → 0 errors (exporters compile unchanged). `npm run build` → ✓ Compiled.

### Files Modified
- `package.json` — `xlsx` → SheetJS CDN 0.20.3.
- `package-lock.json` — regenerated (CDN tarball + integrity).

### Documentation Updated
- `docs/policy/APPROVED_DEPENDENCIES.md` — xlsx row (version/source/rationale) + §7.1 follow-up marked done.
- `docs/IMPLEMENTATION_PLAN.md` Dead Code #28 — xlsx ✅ done; only vitest 1→4 remains.

### Doc-sync (CLAUDE.md §16)
Surfaces changed: [x] security posture (dependency), [x] deployment / build (dep source = CDN tarball).
Docs updated: `APPROVED_DEPENDENCIES.md`, `IMPLEMENTATION_PLAN.md` #28, this changelog.

### Note for ops
The `xlsx` tarball now resolves from `cdn.sheetjs.com` at install time (recorded in the lockfile with an integrity hash). `npm ci` on Vercel + CI fetches it from there. If a build ever fails to reach the CDN, the lockfile integrity hash still pins the exact artifact — re-run resolves transient network blips.

### PR
- Branch: `claude/brave-shannon-mr1ye`
- Status: Draft (pending review)

---

## Session: brave-shannon-mr1ye (cont.) — Phase 44.2 slice 2: SMSF franking refunds

### Changes Made
- **Type**: Feature + tax-engine extension + schema migration
- **Scope**: SMSF fund-income tax — refundable franking (imputation) credits.
- **Origin**: Reza — "go with slice 2". Franking refunds = the single most material SMSF tax feature (pension-phase funds live off them).

### What shipped
- **Engine** (`lib/tax-engine/super/smsfIncomeTax.ts`): `calculateSmsfIncomeTax` gains optional `frankingCredits` input + returns `frankingCredits`, `netTaxPayable` (gross `tax` − credits; negative ⇒ refund), `frankingRefund` (`max(0, credits − tax)`). Complying → refundable (s67-25); non-complying → non-refundable (floored at 0). Citations: Div 207 + s67-25. Helper `applyFranking()`.
- **Tests** (`tests/tax-engine/smsfIncomeTax.test.ts`): +6 cases — back-compat (no credits → net == gross), offset < tax, excess refund, pension-phase full refund, non-complying non-refundable, UNCOMPUTED-ECPI → null net/refund. **15/15 green.**
- **Schema:** `SmsfAnnualReturn.frankingCredits Float @default(0)` — additive migration `20260603090000_phase_44_2_smsf_franking_credits` (ADD COLUMN only).
- **types.ts / assembler / API:** `frankingCredits` threaded through `EntityTaxFacts.smsfIncomeTax`, `assembleEntityTaxFacts`, and the `smsf-return` PUT body.
- **UI** (`/dashboard/entities/[id]/tax`): headline is now the **net position** — a refund shows in emerald with "+", celebrated, with a "franking credits exceed the fund's tax" note; gross tax + franking credits added to the breakdown grid; a franking-credits input added to the form.

### Build Status
- [x] `tsc --noEmit` — 0 errors
- [x] `vitest` SMSF suite — 15/15 pass
- [x] `lint:financial-surfaces` — exit 0
- [x] `next build` — ✓ Compiled (`/dashboard/entities/[id]/tax` 4.9 kB)

### Schema-change deploy protocol (CLAUDE.md §12.12)
- `prisma/schema.prisma` modified with matching migration `20260603090000_phase_44_2_smsf_franking_credits/migration.sql`. Additive `ADD COLUMN ... NOT NULL DEFAULT 0`. No DROP, no `db push`.

### Destructive write checklist (CLAUDE.md §12.11)
- No new destructive write. The existing `smsf-return` PUT upsert (ownership-guarded, entity+FY key) gains one field in its `data`. Migration additive (ADD COLUMN, existing rows default to 0 = prior behaviour). User confirmation: NOT REQUIRED.

### Phase 41E reform-awareness (CLAUDE.md §12.14)
- Modified `calculateSmsfIncomeTax` (in `lib/tax-engine/super/`). **Reform outcome: reform-neutral.** Franking refundability is NOT one of the 8 reform measures, so the new branch produces the same number under every regime — no regime parameter or `commencementVerified` gate is required (documented in the function). Back-compatible: callers omitting `frankingCredits` get byte-for-byte the prior result. New column is on `SmsfAnnualReturn`, not `Property`/`Investment`/`LegalEntity` → FW-3 N/A.

### PR
- Branch: `claude/brave-shannon-mr1ye`
- Status: Draft (pending review)

---

## Session: phase-45-and-qdec-LIlK9 — Q-DEC PR 1 (additive Decimal schema)

### Changes Made
- **Type**: Schema migration (additive, non-destructive)
- **Scope**: Workstream `0·WI` Stage A PR 1 — the precision-foundation gate for Phase 45 ("What If?" scenarios). Adds `*_decimal` sibling columns of type `DECIMAL(19, 4)` for every money-bearing `Float` column on the 10 core models that Phase 45's 5 levers compose.
- **Origin**: Reza decision 2026-06-01 (`AskUserQuestion`) — block Phase 45 v1 on Q-DEC. Pre-revenue is the cheap time to fix the precision foundation; 10-year horizons compound `Float` error visibly.

### Decision audit (CLAUDE.md §0 advisory mindset)

- **Architect lens drove the scope.** Full Q-DEC scope is ~30+ models / ~80+ money columns (per row 69). Bundling all of it into one PR creates review fatigue — reviewer can't cognitively track 80 ALTER TABLE statements. **Scoped PR 1 to the 10 models Phase 45's levers actually compose** (Property, Loan, Account, Income, Expense, InvestmentAccount, InvestmentHolding, PurchaseLot, SuperannuationAccount, Asset → ~45 columns). The remaining ~50 columns ship in Q-DEC PR 1.5 (same pattern, separate review). Same end state, materially better reviewability.
- **Financial-adviser lens validated the precision choice.** `DECIMAL(19, 4)` handles up to AU$999,999,999,999,999.9999 — overkill for any single user but the right scale for aggregated portfolio sums. Four decimal places is one more than cents because franking-credit and per-unit-cost arithmetic produces 4-decimal intermediates.
- **§12.11 destructive-write checklist N/A by structure.** The migration is additive only. The backfill `UPDATE` writes to NEW columns only — existing `Float` data is read but NEVER overwritten. No row deletion, no column drop. Reviewer can verify by reading the SQL: every UPDATE has `WHERE "x_decimal" IS NULL` (idempotent on re-run) and sets only `"x_decimal"`, never the source column.
- **§12.12 schema-change deploy protocol followed.** `prisma/schema.prisma` change + matching migration file `20260603120000_q_dec_pr1_additive_decimal_columns/migration.sql` in same PR. `prisma migrate deploy` runs on Vercel build for both preview (`monitrax-db-dev`) and production (`monitrax-db-prod`). If migration fails, deploy aborts and previous code keeps running on previous schema.

### Implementation

#### Schema additions (10 models, ~45 columns)

Every new column is `Decimal? @db.Decimal(19, 4)` (nullable until Q-DEC PR 4 drops the Float sibling). Engines still WRITE to the Float columns in PR 1 and PR 2; PR 2 adds the `Prisma.Decimal` adapter layer at engine boundaries; PR 3 cuts engines over (parallel-run with shadow-comparison harness); PR 4 drops Float after 7-day parallel-run shows zero diff.

| Model | Money columns gaining `*Decimal` sibling |
|---|---|
| `Property` | `purchasePrice`, `currentValue` |
| `Loan` | `principal`, `minRepayment`, `extraRepaymentCap` |
| `Account` | `currentBalance`, `lastImportedBalance` |
| `Income` | `amount`, `grossAmount`, `netAmount`, `paygWithholding`, `superGuaranteeAmount`, `salarySacrifice`, `taxableAmount`, `taxExemptAmount`, `frankingCredits`, `budgetedAmount` |
| `Expense` | `amount`, `budgetedAmount` |
| `InvestmentAccount` | `openingBalance`, `cashBalance`, `totalDeposits`, `totalWithdrawals` |
| `InvestmentHolding` | `units`, `averagePrice`, `totalCostBasis`, `currentPrice`, `currentValue`, `unrealizedGain` |
| `PurchaseLot` | `units`, `unitCost`, `totalCost`, `fees`, `unitsRemaining` |
| `SuperannuationAccount` | `currentBalance`, `taxableComponent`, `taxFreeComponent`, `concessionalYTD`, `nonConcessionalYTD`, `concessionalCap`, `nonConcessionalCap`, `carryForwardAvailable` |
| `Asset` | `purchasePrice`, `currentValue`, `salePrice`, `residualValue` |

Excluded fields (intentional, deferred to PR 1.5):
- **Rates** (e.g. `interestRateAnnual`, `interestRate`, `depreciationRate`, `superGuaranteeRate`, `frankingPercentage`) — different precision class. Will migrate to `Decimal(7, 4)` or `Decimal(7, 5)` in a later PR.
- **Scores / ratios** (e.g. `confidenceScore`, `unrealizedGainPct`) — not money.
- **Transaction / Recurring / Budget rows** — large scope; PR 1.5.
- **Phase 41E per-FY tax-engine throughput** (e.g. `CompanyFyTaxPosition`) — PR 1.5.

#### Migration file

`prisma/migrations/20260603120000_q_dec_pr1_additive_decimal_columns/migration.sql`:
- One `ALTER TABLE ADD COLUMN` per new field.
- One `UPDATE` per new field, with `WHERE *_decimal IS NULL` (idempotent).
- Header comment documents the 4-PR cutover plan + §12.11 N/A + §12.12 compliance + scope rationale.
- Tested via `prisma generate` (Prisma client generates cleanly) + full `next build` (type-check passes against the generated client).

### Files modified
- `prisma/schema.prisma` — 58 inserted lines (pure additions; clean diff after avoiding `prisma format`'s file-wide whitespace re-alignment).
- `prisma/migrations/20260603120000_q_dec_pr1_additive_decimal_columns/migration.sql` — NEW migration file.
- `docs/IMPLEMENTATION_PLAN.md` — workstream `0·WI` Q-DEC PR 1 row flipped to `[~]` (in flight); Last touched updated.
- `docs/changelog/CHANGELOG_2026_06_03.md` (this entry).

### Build status
- [x] `npx prisma generate` — Prisma Client v5.22.0 generated cleanly
- [x] `npm run build` — Next.js compiled successfully
- [x] `npm run lint:financial-surfaces` — 0 new violations
- [x] `prisma format` artefacts intentionally NOT committed (file-wide whitespace re-alignment would have inflated the diff to 600+ lines and obscured the real additions)

### Risk profile
**Very low.** Pure additive schema. Engines unchanged, route handlers unchanged, no type contract changed (new columns are nullable). Production migrations of this shape are routine (`prisma migrate deploy` adds the columns + runs the backfills in a transactional unit). Worst case if backfill fails: new columns exist but contain NULLs; engines keep reading Float; no behaviour change for users.

### Next concrete step
Q-DEC PR 1.5 — extend the same additive pattern to the remaining ~50 columns on Transaction / RecurringPayment / BudgetCategory / BudgetActual / DistributionAllocation / DividendPayment / Phase 41E tax-engine tables / InvestmentTransaction / CapitalGainEvent. Same pattern, fresh PR. After PR 1.5, Q-DEC PR 2 (adapter layer) begins.

### PR
- Branch: `claude/phase-45-and-qdec-LIlK9`
- Status: Draft
