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

---

## Session (continued): MON-045 Ring-3 disposition + MON-037 RC-B

### Registry patch (Part 0 + VR-009 disposition)
- **MON-045 → VERIFIED** (Ring-3 VR-009 PASS, exact to the dollar: deduction rise $108,965 = Σ investment loan interest $61,465 + $32,246 + $15,253; Guildford PR excluded $0; taxable $255,819 / tax $86,373 exact; regression clean). Stage 3 stays deferred (FW-2).
- **MON-075 raised → DIAGNOSED** (medium): standing NeoAudit detector for the one-off fingerprint (recurring row ∧ 1 linked txn ∧ $0 in-window actuals). Owned by the Matrix; gates MON-053 → CLOSED.
- **MON-076 raised → OPEN** (high): duplicate/fragmented income rows (Ingeus ×3, Cienna ×3, Hipcamp ×2).
- **MON-077 raised → DIAGNOSED** (medium): "Potential Missed Deductions" (My Guide) still lists the three investment loans' interest as missed though MON-045 auto-claims it — stale raw-row advisory (`identifyMissedDeductions`, taxIntegration.ts:369); reconcile against the canonical position.
- **MON-053**: VR-008 coverage-sweep note added (8 rows reclassified; source-aware default decision; backfill abandoned).
- **FIX_PROTOCOL §7 retro added**: the one-off class was 4× broader than the diagnosed rows — Stage-1 census must enumerate the full affected POPULATION by defect fingerprint, not just reported instances.

### MON-037 RC-B — near-duplicate expense dedup (the "Battery" class)
- **Root cause (verified)**: both intake dedup guards matched only on (normalised) name EQUALITY / exact-string+exact-amount — so one battery cost existed as "Battery" / "Battery System" / "Battery Replacement" (doc-import estimate + txn-link actual + manual), each minting its own row.
- **Fix**: ONE canonical near-duplicate decision `isNearDuplicateEntry` (lib/utils/reconciliation.ts — name equality OR token-containment `relatedMerchant` + amount within 10%), consumed by BOTH intake paths: the transaction-link route (falls back after the exact match) and doc-import `reconcileSuggestedAction` (replaces the exact findFirst). Plus MON-053 expense-side parity on the doc-import create (`isRecurring` passthrough — a one-off invoice no longer silently minted recurring-MONTHLY).
- **Existing duplicate rows**: user-reviewed remediation (per the abandoned-backfill precedent) — Ring-3 directs; intake can no longer re-create them.
- **Ratchet**: `tests/utils/mon037RcbNearDuplicate.test.ts` (14 — Ring-0 battery fixtures + false-merge guards; Ring-1 source-lock: both paths consume the ONE decision); `tests/documents/reconcileSuggestedAction.test.ts` updated to the new contract (+2 RC-B cases).
- **Neomatrix**: anchor re-pin `engine.utils.reconciliation.detectFrequency` 90→91 (import shift); no financial-number lineage changed (the matcher produces a decision, not a money number).
- **Gates**: tsc clean · 731/731 utils/documents/bank/bookkeeping/calculations/dashboard · neomatrix:check OK · lint:financial-surfaces 0 new · issues:check 77 valid.

---

## Session (continued): MON-078 — the Intake-Integrity keystone (wall Part 1)

### Changes Made
- **Type**: Fix/Refactor (guardrail — foundation; behaviour-preserving)
- **Scope**: intake layer (every Income/Expense producer) + CI build gate
- **Spec of record**: `docs/architecture/INTAKE_INTEGRITY_GUARDRAIL.md` (PR #1428)
- **What shipped**:
  1. **`lib/intake/classifyIntake.ts`** — the ONE canonical intake classifier:
     `classifyIntake(signal) → { frequency, isRecurring, streamMatch }`. Pure
     (§6.4). Frequency: declared (normalised; ANNUALLY→ANNUAL; WEEKLY/FORTNIGHTLY
     preserved) → detected evidence → MANUAL/ONBOARDING throw (never silent) →
     the ONE named `LEGACY_FALLBACK_FREQUENCY='MONTHLY'` for import paths (C1
     target). Recurrence: explicit choice wins; source-default table per spec §3
     (manual/onboarding/detection = recurring; link-expense = one-off #1421;
     link-income + doc-import = recurring, marked LEGACY/C2 targets). Stream:
     'scope-singleton' (MON-009 rental rule) + 'merchant' (MON-011/025 + RC-B
     near-duplicate) policies.
  2. **All 8 production producers routed through it** (re-verified live):
     income POST · expenses POST · expenses bulk · transactions/[id]/link
     (income + expense branches incl. both stream-reuse decisions) ·
     documents/analyze/confirm (income + expense; local frequencyMap +
     `|| 'MONTHLY'` literals deleted) · onboarding/complete · recurring-payments
     link (declared ?? detected pattern) · recurringExpenseDetection.
  3. **R1 source-lock** (`tests/intake/intakeSourceLock.test.ts`): CI census of
     every `prisma.income/expense.create` in app/+lib/ — a new producer file, a
     bypass, or a silent `'MONTHLY'` literal/fallback outside the classifier
     fails the build. Allowlist (reviewed): lib/db/tenant.ts (pass-through, 0
     callers), lib/testing/loader.ts (fixtures). Exempt cadence fields:
     repaymentFrequency/investmentFrequency (not Income/Expense).
  4. **Ring-0 contract tests** (`tests/intake/classifyIntake.test.ts`, 15) pin
     the behaviour-preserving defaults so C1/C2/C3 change them deliberately.
  5. **RC-B source-lock updated to the new topology** (route →
     classifyIntake('merchant') → isNearDuplicateEntry — class still locked).
- **Honest behaviour deltas (all safer-degradation, no number changes)**:
  invalid frequency strings on import paths now degrade to evidence/fallback
  instead of a 500; doc-import accepts ANNUALLY; bulk/onboarding now set
  isRecurring explicitly (= schema default, no change).

### Build Status
- [x] tsc clean · 2142/2142 (intake/utils/documents/bank/income/calculations/tax/golden/cfo/dashboard/bookkeeping)
- [x] neomatrix:check OK · lint:financial-surfaces 0 new · lint:ai-grounding OK
- MON-078 raised → FIXING (registry follow-up commit with the PR number)

### Gate (§20.6)
Recorded in the PR body.

---

## Session (continued, 2026-07-16): MON-001 C1 + D2 — wall Part 2

- **C1 (classifyIntake)**: `transactionDates` evidence — ≥2 valid dates → the ONE
  canonical `detectFrequency`; declared/explicit choice still wins
  (suggest-and-confirm); weekly/fortnightly stored as themselves. Link route
  threads primary+batch txn dates into all 3 classifier calls.
- **Consolidation**: the GET-matches inline cadence block (identical thresholds)
  deleted → canonical. RESIDUAL documented: recurringExpenseDetection keeps its
  private copy (different confidence formula feeds match thresholds — repointing
  is its own follow-up decision).
- **D2 detector**: `lib/intake/detectors.ts` (pure; ≥3 txns, confidence ≥0.7,
  never one-offs) → income GET `cadenceMismatch` per row → amber "Payments look
  weekly" nudge chip on the income list. Review-only, nothing auto-changes.
- Ring-0: evidence tests + weekly census fixture + detectors.test.ts (7).
  L0 allowlist += detectors.ts (graphify offline; self-prunes).
- Gates: tsc clean · 1545/1545 · neomatrix full gate 0 uncovered · linters OK ·
  issues 78 valid. MON-001 → FIXING.

---

## Session (continued, 2026-07-16): MON-075 D1 — wall Part 3

- **D1 detector**: `detectOneOffFingerprint` (pure; recurring ∧ exactly 1 linked
  txn ∧ $0 in-window) → income GET + expenses GET `oneOffFingerprint` flag →
  sky "Single payment — one-off?" nudge chip on the income list (cadence chip
  precedence). Review-only. This is the MON-053 PROMOTION step (gates CLOSED).
- Ring-0: +5 detector tests. Baseline re-lined (income page 2060→2073).
- Gates: tsc clean · intake/income/api suites green · neomatrix 0 uncovered ·
  linters OK · issues 78 valid. MON-075 → FIXING.

---

## Session (continued, 2026-07-16): R3 golden intake-trap fixtures — wall Part 5

- `tests/golden/ring2.intakeWall.test.ts` (10) — the three trap shapes locked
  end-to-end: weekly rent (classifies WEEKLY + D2 flags a mis-stored MONTHLY +
  ×52 Float/Decimal parity), single ATO deposit (one-off classification +
  counted-once parity + D1 flags the leftover shape), fragmented stream
  (exact + near-duplicate reuse, scope-singleton rental rule, no false merges).
  Additive — GOLDEN_DB untouched (its EXPECTED values pin other suites).
- Gates: tsc clean · golden+intake 196/196 · neomatrix 0 uncovered · linters OK.
