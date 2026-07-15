# Changelog - 2026-07-15

## Session: chat-audit-findings-issues-m9518i (continued) — MON-045 stage 2

### Changes Made
- **Type**: Fix (financial correctness — §12.2.1 duplicate-producer deletion + §19.1 actuals-first)
- **Scope**: tax engine, CFO tax insights, portfolio intelligence, calc-audit
- **Root Cause** (MON-045, verified): FOUR rogue producers each re-derived a
  negative-gearing figure from raw rows while the canonical tax position never
  auto-deducted property loan interest at all. The CFO benefit ($157,746 —
  Σ principal×rate per property × marginal rate) exceeded TOTAL deductions
  ($39,554), which is mathematically impossible (benefit = loss × rate ≤ loss ≤
  deductions).
- **Solution** (stage 2 of the Reza-approved Option 1, 2026-07-14):
  1. **Engine wiring** — `calculateTaxPosition` (+ Decimal twin) accepts
     `propertyLoans[]` and auto-derives deductible interest per loan via the ONE
     stage-1 helper `deductiblePropertyLoanInterest` (actuals-first Σ
     INTEREST_CHARGED this FY, else (principal − offset) × rate × fraction).
     The ONE deductibility rule lives in the engine: `propertyType !== 'HOME'`
     (a primary residence's interest is never deductible). Loan-linked expense
     rows for auto-derived loans are DE-DUPED (interest never counted twice).
  2. **Callers threaded** — `getUserTaxPosition` and `/api/tax/position` fetch
     property loans + offset accounts + the FY INTEREST_CHARGED groupBy and pass
     `propertyLoans[]` (both Float and Decimal calls).
  3. **P1+P2 deleted** — `calculateNegativeGearingBenefit` +
     `calculateNegativeGearingBenefitDecimal` in
     `lib/cfo/decisionSupport/taxIntegration.ts`. The CFO benefit is now DERIVED
     from the canonical position: `max(0, deductions.property − income.rental)
     × marginalRate/100` — it can no longer exceed the deductions that generate it.
  4. **P3 deleted** — `portfolioEngine.ts` gearing + per-property
     `negativeGearingBenefit` fields (mislabeled raw-loss producers; only
     consumers were the debug route + strategy rows that never read the field).
  5. **P4 deleted** — orphaned `/api/calculate/property-roi` route (zero
     callers; hardcoded 37% rate + duplicate NG/depreciation formulas).
  6. **calc-audit** — removed the deleted producer's shadow trio
     (`negativeGearingBenefitFloat`, `negativeGearingBenefitShadow`, export
     row); the canonical `applyNegativeGearing` shadow untouched.
- **Stage 3 (deferred, unchanged)**: `applyNegativeGearing` loss-quarantine
  wiring — identical numbers today (grandfathered/always-offset;
  `commencementVerified=false`, FW-2).

### Files Modified
- `lib/tax-engine/position/taxPositionCalculator.ts` — `PropertyLoanItem` type, `propertyLoans?` input, Float+Decimal auto-derive loops + de-dup guards
- `lib/tax-engine/position/userTaxPosition.ts` — loans+offset fetch, INTEREST_CHARGED FY groupBy, propertyLoans threading
- `app/api/tax/position/route.ts` — same threading into BOTH engine calls
- `lib/cfo/decisionSupport/taxIntegration.ts` — canonical derivation; P1+P2 deleted
- `lib/intelligence/portfolioEngine.ts` — P3 producers + fields deleted
- `app/api/calculate/property-roi/route.ts` — DELETED (P4, orphaned)
- `lib/calc-audit/engines/decimal-cfo-decision-support.ts` — shadow removal
- `tests/cfo/decision-support.decimal.test.ts` — deleted-producer tests removed
- `tests/tax/mon045PropertyLoanInterest.test.ts` — NEW (14 tests: Ring-0 wiring/HOME-gate/de-dup/actuals-first, Ring-2 Float=Decimal parity, CFO-derivation invariant, Ring-1 source-lock keeping all four producers dead)
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` + `proven-engines.json` — rogue node+3 edges deleted; `engine.tax.deductiblePropertyLoanInterest` + `input.LoanTransaction.interestCharged` modelled with 5 verified edges; drifted anchors re-pinned (calculateTaxPosition :132, calculateUnrealisedCGT :189, portfolioEngine.calculateNetWorth :313)
- `docs/blueprint/PHASE_03_FINANCIAL_ENGINES.md` — property-roi rows marked REMOVED
- `docs/issues/ISSUES.json` / `ISSUES.md` — MON-045 → FIXING (censuses, sweep, plain trio, fix PR)

### §19.2 worked examples (in the test file, all verified by run)
- IP loan 400,000 × 0.06 → **24,000** in `deductions.property`
- HOME loan 947,076 × 0.0649 → **0** (primary residence excluded)
- actuals 18,500 charged → **18,500** (wins over theoretical 24,000)
- (400k − 100k offset) × 0.06 × 0.5 fraction → **9,000**
- de-dup: loan-linked 2,000/mo interest expense SKIPPED → property = 24,000 + 2,000 rates = **26,000** (not 50,000)
- CFO derivation: property 26,000 − rental 24,000 = 2,000 loss × marginal rate; benefit ≤ deductions.total ✓

### §19.1 basis statement
Deductible interest is ACTUALS-FIRST (Σ INTEREST_CHARGED ledger rows this FY);
theoretical (principal − offset) × rate × fraction is the fallback when no
ledger rows exist. Declared loan-linked expense rows are superseded (de-duped)
only when the loan is auto-derived; callers not passing `propertyLoans` keep
pre-MON-045 behaviour exactly (back-compat pinned by test).

### Build Status
- [x] `npx tsc --noEmit` clean
- [x] vitest tax+cfo: 1237/1237 · calculations+golden+intelligence: 349/349
- [x] `neomatrix:generate` + full `neomatrix:check` OK (schema, invariants, anchors, L0, binding, census)
- [x] `lint:financial-surfaces` (0 new) + `lint:ai-grounding` OK

### Gate (§20.6)
Recorded in the PR body — Document 10/10 · Requirements 10/10 · Logic 10/10.

### PR
- PR: #TBD (draft — changesNumbers: Reza's merge approval + Ring-3 re-verify
  against the healed base Total Income $412,768 / Est. tax $141,548)
