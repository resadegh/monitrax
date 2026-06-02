# Changelog — 2026-06-02

## Session: brave-shannon-mr1ye — Phase 39.5 Super vs SMSF model

### Changes Made
- **Type**: Feature + architecture decision + schema migration
- **Scope**: Superannuation data model, net worth, tax/super APIs, My Wealth → Super UI, onboarding.
- **Origin**: Reza — "implement the required relationships for superannuation accounts vs SMSF investment accounts… note the tax implications… continue the build. How are you going to handle the onboarding section for super?" Resolved via architect-mode (seven-lens) + three deep-research sweeps.

### Decision (Open Question #8 — DECIDED)
- **SMSF = `LegalEntity(type=SMSF, role=SUPERANNUATION)`** that OWNS its assets (investment accounts / property / cash via `ownerEntityId`) — NOT a `SuperannuationAccount`, NOT an `InvestmentAccount(type=SUPERS)`.
- **Retail/industry super = `SuperannuationAccount`** (external APRA fund, userId-scoped).
- Research confirmed `InvestmentAccountType.SUPERS` is dead (UI-label-only, never read for tax/net-worth) and SMSF already exists as a first-class `LegalEntityType` with owning relations.

### What shipped (Phase 39.5 — connect-and-classify slice)
1. **Schema:** `SuperannuationAccount.fundType` (`SuperFundType` INDUSTRY/RETAIL/SMSF, default INDUSTRY) + nullable `ownerEntityId`→`LegalEntity` (`onDelete: SetNull`) + back-relation. Additive migration `20260602100000_phase_39_5_super_fund_type_smsf_link` (new enum + 2 columns + index + FK; no DROP).
2. **Net-worth double-count guard:** `netWorthCalculator` excludes `fundType=SMSF` from the super sum (value flows through entity assets); threaded `fundType` via `masterFinancialService`.
3. **APIs:** `/api/tax/super` GET returns `fundType`+`ownerEntityId`; POST/PUT accept them with an **ownership-guarded** entity link (`ownerEntityId` must reference a `LegalEntity` owned by the caller).
4. **UI:** Super page "Add fund" fund-type selector + conditional SMSF→My Structure entity link (with create-in-My-Structure fallback); `SuperAccountTile` type badge; detail-dialog SMSF banner + "View structure" link.
5. **Onboarding:** removed `SUPERS` from `InvestmentsStep` picker (dead enum; Prisma value retained for back-compat + graceful fallback); `SuperStep` SMSF hint → "Your structure".

### Tax implications (documented; no new tax math this phase)
- **Retail/industry super:** contributions taxed 15% in (concessional), fund earnings taxed 15% internally (invisible to member), tax-free after 60. Member surface = caps (concessional $30k / non-concessional $120k FY25-26), Div 293, salary-sacrifice (marginal − 15%). All pre-built; unchanged.
- **SMSF:** separate taxpayer (own TFN/ABN, lodges SMSF return). Fund earnings 15% (accumulation) / 0% ECPI (pension phase) / 45% NALI; CGT 1/3 discount (>12mo); franking credits refundable. `calculateSmsfIncomeTax` (Div 295/ECPI/NALI) is **built but staged** — not yet surfaced. Member-balance allocation, franking refunds, separate-return lodgement, per-member TBC = deferred (engine flags UNCOMPUTED).

### Files Modified / Created
- `prisma/schema.prisma` — `SuperFundType` enum, `SuperannuationAccount.fundType`+`ownerEntityId`+relation, `LegalEntity.superannuationAccounts` back-relation.
- `prisma/migrations/20260602100000_phase_39_5_super_fund_type_smsf_link/migration.sql` — NEW (additive).
- `lib/calculations/netWorthCalculator.ts` — SMSF exclusion guard + `fundType` on `SuperInput`.
- `lib/services/masterFinancialService.ts` — `fundType` through raw type, select, net-worth map.
- `app/api/tax/super/route.ts` — GET expose + POST accept fundType/ownerEntityId (ownership-guarded).
- `app/api/tax/super/[id]/route.ts` — PUT accept fundType/ownerEntityId (ownership-guarded).
- `app/dashboard/investments/super/page.tsx` — fund-type selector, SMSF entity link, detail banner.
- `components/wealth/SuperAccountTile.tsx` — type badge.
- `components/onboarding/wizard/steps/InvestmentsStep.tsx` — remove SUPERS.
- `components/onboarding/wizard/steps/SuperStep.tsx` — SMSF hint.

### Documentation Updated
- `docs/architecture/03_DATA_MODEL.md` — Phase 39.5 super/SMSF note in the Entity Layer section.
- `docs/blueprint/PHASE_39_MY_WEALTH_REDESIGN.md` §3.4.1 — full Phase 39.5 model + tax table.
- `docs/IMPLEMENTATION_PLAN.md` — Open Question #8 → DECIDED; Dead Code #27 → CLOSED; Recently Completed (2026-06-02).

### Build Status
- [x] `tsc --noEmit` — 0 errors
- [x] `lint:financial-surfaces` — exit 0 (no new violations)
- [x] `next build` — ✓ Compiled (`/dashboard/investments/super` 7.29 kB)

### Destructive write checklist (CLAUDE.md §12.11)
- `PUT /api/tax/super/[id]` → `prisma.superannuationAccount.update`: single row by verified `id` after `verifyOwnership`; only request-body fields written (now incl. fundType/ownerEntityId). The `ownerEntityId` link is itself ownership-validated against the caller's `LegalEntity`. Migration is additive (no DROP/ALTER DROP). User confirmation: NOT REQUIRED.

### Phase 41E reform-awareness (CLAUDE.md §12.14)
- No new `lib/tax-engine/*` function; no CGT/neg-gearing/trust/FBT/PAYG calc added. Column added to `SuperannuationAccount` (NOT `Property`/`Investment`/`LegalEntity`) — FW-3 trigger N/A. `fundType` does not gate any post-reform branch (SMSF CGT reform is computed via the entity tax router, untouched here). SMSF tax engine left as-is.

### PR
- Branch: `claude/brave-shannon-mr1ye`
- Status: Draft (pending review)
