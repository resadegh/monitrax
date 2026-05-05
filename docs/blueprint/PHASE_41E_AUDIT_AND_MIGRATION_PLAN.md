# Phase 41e — Audit & Migration Plan
### *Pre-flight audit of existing tax/calc surface before Phase 41e (entity-aware tax engine) implementation*

---

> **Status:** v1 — PR 1/4 (foundation: existing-state inventory + critical findings).
>
> **PR sequencing** (incremental sign-off — each PR small enough to review in one sitting):
> - **PR 1 (this PR):** Executive summary, existing-state inventory, critical findings register
> - **PR 2:** Architectural decision (layer 41e on Phase 20, don't rewrite) + multi-entity ownership combinations matrix + cross-entity relationship rules
> - **PR 3:** Per-rule SSOT migration map + per-engine downstream impact analysis
> - **PR 4:** Refined sub-PR sequencing + snapshot-test fixture strategy + constants reconciliation + FY25-26 config gap + UNCOMPUTED additions + Reza sign-off block
>
> **Why this doc exists:** Reza brief 2026-05-05 — *"I want to make sure you stick to the key critical design principles of no duplication of calculations and the single source of truth for the data. Any changes to the calculations should be made carefully to the existing engines considering all aspects of existing rules vs the new ones. I don't want to break something to build a new solution."* Phase 41e (the entity-aware tax engine, 17 sub-PRs per `PHASE_41_REGULATORY_ARCHITECTURE.md` §11) cannot start until this audit is complete and the migration plan is signed off.
>
> **Hard prerequisite for Phase 41e.0** — reviewers reject any 41e sub-PR that lands before all four parts of this audit are signed off. Reza signs the sign-off block in PR 4.
>
> **Last updated:** 2026-05-05.

---

## 1. Executive Summary

### What I found

A **mature Phase 20 tax engine already exists** at `lib/tax-engine/` (3,776 LOC across 14 files). It implements federal AU income tax at user-level — PAYG (ATO NAT 1004 Schedule 1), Medicare Levy + Surcharge, LITO + SAPTO + franking + foreign tax offsets, salary processing, super contribution caps + Division 293, full tax position aggregation. **It is structurally sound within its scope.** Phase 41e is **NOT a rewrite** — it's a new entity-aware orchestration layer that sits ON TOP of this engine, plus net-new modules for rules the existing engine doesn't cover (Div 6, Div 7A, s100A, Div 152, FTE, state taxes, Div 296).

### Three classes of finding

1. **Existing engine is sound — keep, layer on top.** Phase 20 covers federal user-level income tax correctly. Don't break it. 41e wraps it with entity-aware dispatch.
2. **Active regression traps must be fixed before any 41e code lands.** `buildTaxSummary()` in `masterFinancialService.ts:1012-1077` reimplements tax brackets inline (line 1040 admits *"Simplified tax calculation (would use tax engine in production)"* — but it's in production). Aggregators have **zero entity awareness** despite the schema FK existing since Phase 41a. Constants are hard-coded in 7+ places, divergent across modules (CFO module says concessional cap = $27,500, dashboard says $30,000 — same threshold, two truths).
3. **Phase 41e net-new scope is genuine.** No existing code touches Div 6 (trust distributions), Div 7A (private company loans), s100A (reimbursement agreements), Div 152 (small biz CGT concessions), Family Trust Elections, Div 296 (high-balance super), state land tax, state stamp duty, or PSI deep cases. These are real net-new modules per `PHASE_41_REGULATORY_ARCHITECTURE.md` §11.

### Recommendation

**Do not start 41e.0 until a pre-flight cleanup PR** (proposed as a renumbered "41e.−1") replaces `buildTaxSummary()` with delegation to the existing `calculateTaxPosition()`, extracts hard-coded constants to the FY config, adds FY25-26 to `taxYearConfig.ts`, and captures snapshot-test fixtures of current outputs as the parity baseline. Without this, every 41e sub-PR carries silent-divergence risk: a rule lands in the new engine, the master snapshot still uses the old inline math, and they disagree.

**41e.0 (foundation) becomes the entity-aware orchestration layer** — types, FY thresholds extension, AFSL/TPB/NCCP boundaries renderer, entity-aware aggregator wrappers. Sequenced AFTER cleanup, BEFORE any rule modules.

**Snapshot-test before refactor.** Every sub-PR captures pre-refactor outputs against fixture archetypes (Sarah Kim sole-trader / David+Emma family with trust+SMSF / Olivia multi-entity HNW + synthetic edge cases) and asserts numeric parity post-refactor — or documents the diff with ATO authority citation.

---

## 2. Existing-State Inventory

> *Three concurrent audits, consolidated. Precision over brevity — this feeds every sub-PR migration decision.*

### 2.1 The Phase 20 tax engine (`lib/tax-engine/`)

**Total: 3,776 LOC across 14 files. User-level only (no entity awareness). FY24-25 config + FY23-24 historic. ZERO test coverage.**

| File | LOC | Purpose | Key exports |
|---|---|---|---|
| `index.ts` | 103 | Re-export aggregator + `TaxEngine.*` namespace | `TaxEngine.getConfig`, `getCurrentConfig`, `getMarginalRate` |
| `types.ts` | 406 | Canonical type contracts | `TaxYearConfig`, `SuperContributionType`, `IncomeContext`, `TaxPositionInput/Result`, `SalaryInput/Breakdown` |
| `config/taxYearConfig.ts` | 227 | FY thresholds + brackets + medicare + LITO + SAPTO + super | `getTaxYearConfig`, `getCurrentTaxYearConfig`, `getMarginalRate`, `getTaxBracket` |
| `core/incomeTaxCalculator.ts` | 172 | Federal income tax (Div 1-6) | `calculateIncomeTax`, `calculateMarginalTax`, `calculateDeductionSavings` |
| `core/medicareLevyCalculator.ts` | 231 | Medicare Levy + Surcharge | `calculateMedicareLevy`, `getMedicareSummary` |
| `core/paygCalculator.ts` | 267 | PAYG withholding (ATO NAT 1004 Schedule 1, both scales) | `calculatePAYG`, `calculateGrossFromNet`, `getPAYGSummary` |
| `core/taxOffsets.ts` | 299 | LITO + SAPTO + franking + foreign tax | `calculateLITO`, `calculateSAPTO`, `calculateFrankingCreditOffset`, `calculateForeignTaxOffset`, `calculateAllOffsets`, `applyOffsets` |
| `income/salaryProcessor.ts` | 359 | Gross↔net + SG + sacrifice optimisation | `processSalary`, `getSalarySummary`, `calculateOptimalSalarySacrifice`, `compareSalaryScenarios` |
| `income/taxabilityRules.ts` | 317 | Income classification + franking math | `determineTaxability`, `calculateFrankingCredits`, `getTaxCategoryLabel`, `isTaxableCategory`, `getTaxTreatmentSummary` |
| `position/taxPositionCalculator.ts` | 499 | Aggregate tax position (the user-level orchestrator) | `calculateTaxPosition`, `compareTaxPositions`, `calculateQuickTaxPosition` |
| `super/capTracker.ts` | 373 | Super cap tracking + carry/bring-forward + Div 293 | `trackContributionCaps`, `calculateCarryForward`, `calculateBringForward`, `getOptimalContributionStrategy`, `getConcessionalCap`, `getNonConcessionalCap` |
| `super/contributionCalculator.ts` | 462 | SG + sacrifice + Div 293 + co-contribution + spouse offset | `calculateSuperGuarantee`, `calculateSuperContributions`, `calculateDivision293Tax`, `calculateCoContribution`, `calculateSpouseContributionOffset`, `getSuperContributionSummary` |

**AU rules covered** (with primary authority):
- Federal income tax brackets — ITAA 1997 Div 1-6 / s4-10. **FY24-25 only** (Stage 3 cuts baked in: 16% / 30% / 37% / 45% above $190k)
- Medicare Levy — Health Insurance Levy Act 1982 §3, §8 (2% rate, shade-in, surcharge tiers)
- LITO — ITAA 1997 Div 126-H (two-tier phaseout: 5c/$ then 1.5c/$, max $700, cuts at $66,667)
- SAPTO — ITAA 1997 Div 126-L (**simplified — comment admits "actual rules are more complex"**)
- Franking credits — ITAA 1997 Div 207 (30% corporate rate gross-up, refundable)
- Foreign income tax — ITAA 1997 Div 770 (lesser of foreign tax paid or AU tax on foreign income)
- PAYG — ATO NAT 1004 Schedule 1 (Scale 2 + Scale 1 coefficient tables for FY24-25)
- Super Guarantee — Superannuation Guarantee (Administration) Act 1992 (11.5% FY24-25, $62,500/quarter base cap)
- Concessional contribution cap — ITAA 1997 s291-20 ($30,000 FY24-25)
- Non-concessional contribution cap — ITAA 1997 s292-85 ($120,000 FY24-25)
- Carry-forward unused concessional — s291-20(3) (5 years; TSB < $500k threshold)
- Bring-forward non-concessional — s292-85(2) (TSB-tiered: $1.66m / $1.78m / $1.9m)
- Excess contributions tax — ITAA 1997 Div 291 / Div 292
- Division 293 — ITAA 1997 Div 293 ($250k threshold, 15% additional)
- Government co-contribution — Superannuation (Government Co-contributions) Act 2003 (50%, max $500, $45.4k–$60.4k phase-out)
- Spouse contribution offset — ITAA 1997 (18%, max $540, $37k–$40k phase-out)
- CGT discount (50% individuals/trusts, 12-month holding) — ITAA 1997 Div 115 (**config has the structure but no application logic in `taxPositionCalculator.ts`**)

**AU rules NOT covered (Phase 41e net-new):**
- Trust distributions — Div 6 / Div 6E (presently entitled allocation, streaming franked dividends + capital gains to specific beneficiaries)
- Reimbursement agreements — s100A + TR 2022/4 + PCG 2022/2 zone classifier
- Private company loans — Div 7A + s109N MRP + s109Y distributable surplus + sub-trust UPE (TR 2010/3)
- Small business CGT concessions — Div 152 (15-yr exemption, 50% active asset, retirement exemption $500k, rollover; $6m MNAV / $2m turnover basic conditions)
- Family Trust Election + Interposed Entity Election — Sch 2F ITAA 1936; 46.5% TFN withholding
- Trust loss rules — Sch 2F (Income Injection Test, Pattern of Distributions Test)
- Company loss rules — Div 165 (COT), Div 166, Div 175, Div 707
- Personal Services Income — Part 2-42 ITAA 1997; TR 2022/3 (results test, 80% rule, unrelated clients, employment, premises)
- Service entity arrangements — TR 2006/2
- Foreign resident CGT withholding — Sch 1 Subdiv 14-D (12.5% on disposals ≥ $750k)
- HECS/HELP withholding — Div 139A (TODO comment in `paygCalculator.ts:145`)
- State land tax — per-state Land Tax Acts (NSW/VIC/QLD/SA/WA/TAS/ACT/NT)
- State stamp duty — per-state Duties Acts (foreign purchaser surcharge, resettlement risk)
- Division 296 — high-balance super tax ($3m TSB threshold; verify Royal Assent + commencement)
- Negative gearing per-entity rules (only individuals can offset rental losses against salary; trusts/companies trap losses)
- Capital loss netting + ordering rules — s100-50, s115-100

**FY coverage:** FY24-25 (current, complete), FY23-24 (previous, complete). **FY25-26 IS NOT in `taxYearConfig.ts`** but FY25-26 super caps ARE projected in `capTracker.ts:CONCESSIONAL_CAPS / NON_CONCESSIONAL_CAPS`. Inconsistent — must reconcile.

**Test coverage:** **ZERO.** No `.test.ts`, `.spec.ts`, or fixtures. Per `PHASE_41_REGULATORY_ARCHITECTURE.md` §1(4): *"Fixtures come from ATO worked examples … the test suite IS the regulatory evidence."* — currently no evidence exists.

**Entity awareness:** **NONE.** Every function takes scalar inputs (user gross salary, total dividend, etc.) — no `ownerEntityId`, no `entityType`, no aggregation by entity. **Phase 41e blocker.**

### 2.2 Aggregators + master snapshot tax integration

**Files audited:** `lib/calculations/{income,expense,loan,cashflow,netWorth}*.ts`, `lib/services/masterFinancialService.ts`, `lib/utils/calculations.ts`, `lib/cashflow/incomeNormalizer.ts`.

**Tax math performed inline (NOT delegated to tax-engine):**

| File | Inline tax math | Risk |
|---|---|---|
| `lib/services/masterFinancialService.ts:1012-1077` | **`buildTaxSummary()` reimplements FY24-25 tax brackets inline** (5 tiers: $18.2k/45k/135k/190k thresholds; bases $0/$4288/$31288/$51638). No Medicare. No offsets. Comment line 1040: *"Simplified tax calculation (would use tax engine in production)"* — currently used in production. | **REGRESSION TRAP. First fix in 41e cleanup PR.** |
| `lib/calculations/incomeAggregator.ts:80` | Comment *"For non-salary income, we don't deduct tax (calculated at year end)"* — rental/dividend/interest tax liability deferred. | Acceptable simplification but flag for 41e |
| `lib/calculations/loanAggregator.ts:69-70` | Simplified interest: `(rate/100) / 12 × principal`. No amortisation. Comment admits *"Calculated interest portion (simplified)"*. | Out of 41e scope (would need full amortisation engine) |

**Tax math properly delegated to tax-engine:**

| File | Delegation | Notes |
|---|---|---|
| `lib/cashflow/incomeNormalizer.ts:52-61, 232-247` | Calls `TaxEngine.calculatePAYG`, `calculateMedicareLevy`, `calculateAllOffsets` (LITO) for SALARY only | RENT/RENTAL/INVESTMENT income passed through gross — comments note "future: integrate property expense deductions / dividend imputation" |
| `lib/calculations/cashflowOrchestrator.ts:148-154` | Indirectly via `incomeNormalizer.calculateTakeHomePay()` | Only fires for SALARY type; non-salary income NOT tax-adjusted in cashflow |

**Entity awareness:**

| Aggregator | Filters by `ownerEntityId`? |
|---|---|
| `incomeAggregator.ts` | ❌ |
| `expenseAggregator.ts` | ❌ |
| `loanAggregator.ts` | ❌ |
| `cashflowOrchestrator.ts` | ❌ |
| `netWorthCalculator.ts` | ❌ |
| `masterFinancialService.ts` | ❌ — fetches all rows by `userId`, never groups by entity |

**Phase 41e blocker:** every aggregator must accept an optional `ownerEntityId` parameter and filter accordingly. Default = no filter (backward compat for existing call sites). New entity-aware orchestration layer in `lib/calculations/tax/` consumes them with explicit entity scoping.

### 2.3 Tax routes + cross-engine consumers

**6 API routes + 5 cross-engine services + 1 dashboard page = 11 surfaces, 2,991 LOC, ZERO test coverage.**

| Surface | LOC | Tax-engine coupling | Hard-coded risks |
|---|---|---|---|
| `/api/tax/route.ts` | 313 | `calculatePAYG`, `determineTaxability`, `calculateAllOffsets`, `applyOffsets`, `calculateIncomeTax`, `calculateMedicareLevy` | Frequency enum strings hard-coded |
| `/api/tax/salary/route.ts` | 149 | `processSalary`, `calculateOptimalSalarySacrifice` | Frequency enum |
| `/api/tax/super/route.ts` | 282 | `trackContributionCaps`, `getMarginalRate`, `getOptimalContributionStrategy` | **Hard-coded 0.85 (15% super tax)** in DB write path; SuperContributionType enum |
| `/api/tax/super/optimize/route.ts` | 341 | `calculateDivision293Tax`, `calculateIncomeTax`, `calculateMedicareLevy`, `getOptimalContributionStrategy` | **6 occurrences of hard-coded 0.15** (super tax); $60,400 co-contrib threshold; 0.30 / 0.37 marginal rate compares; 0.50 CGT discount |
| `/api/tax/super/contributions/route.ts` | 297 | `SuperContributionType` enum | Hard-coded 0.85 (15% tax assumed); no cap validation call |
| `/api/tax/position/route.ts` | 298 | `calculateTaxPosition`, `calculateQuickTaxPosition` | Tightly coupled to `IncomeItem` / `ExpenseItem` / `DepreciationItem` interface shapes |
| `lib/cfo/decisionSupport/taxIntegration.ts` | 519 | `calculateTaxPosition` | **`27500` concessional cap (WRONG — FY24 stale)**; `250000` Div 293; `60400` co-contrib; `50000`/`100000` CGT thresholds; `$3000`/property depreciation estimate |
| `lib/cfo/scenarios/sellProperty.ts` | 156 | None — flags CGT, doesn't compute | OK (defers to tax tab per comment) |
| `lib/strategy/analyzers/taxAnalyzer.ts` | 136 | None — self-contained | 12-month CGT threshold; 50% discount; **30% marginal rate ASSUMED** (line 129); $1000 loss threshold |
| `lib/reports/generators/taxTime.ts` | 236 | None — pure aggregation | OK (no calc) |
| `lib/cashflow/incomeNormalizer.ts` | 264 | `calculatePAYG`, `calculateMedicareLevy`, `calculateAllOffsets` | Assumes specific response field names (`.annualWithholding`, `.medicareLevy`, `.offsets.lito`) |
| `app/dashboard/tax/page.tsx` | 908 | Calls `/api/tax/position` | **Hard-coded brackets table** (lines 446–470); `30000`/`120000` caps (diverges from CFO `27500`); `11.5%` SG; `30%` marginal threshold for sacrifice CTA; FY24-25 hard-coded in subtitle |

**Phase 41d `MoneyFlowSankey` (just shipped):** uses **proportional tax allocation** across entities (per the v1 caveat). Replaced by 41e.1 (Div 115 + Div 6) + 41e.4 (Div 6E streaming) for correctness. Visual unchanged; numbers change.

---

## 3. Critical Findings — Consolidated Risk Register

> *Sorted by severity. Each finding feeds a specific mitigation in PR 3 (migration map) and PR 4 (sequencing).*

### 🔴 CRITICAL — must fix before any 41e rule code lands

**C-1. `buildTaxSummary()` in master snapshot reimplements tax brackets.**
`masterFinancialService.ts:1012-1077` runs hardcoded FY24-25 brackets instead of calling the existing `calculateTaxPosition()`. No Medicare. No offsets. Comment line 1040 explicitly admits this is a "simplified" placeholder, but it's in production. Every consumer of `MasterFinancialSnapshot.tax` (dashboard, AI advisor, Sankey) reads divergent values from the canonical `/api/tax/position` route.
*Mitigation:* PR 1 of 41e cleanup replaces `buildTaxSummary()` with delegation to `calculateTaxPosition()`. Snapshot tests assert numerical parity with `/api/tax/position` for the same user.

**C-2. Concessional cap divergence — $27,500 (CFO) vs $30,000 (config + dashboard).**
`lib/cfo/decisionSupport/taxIntegration.ts:350` hard-codes `27500` (FY24 value). Dashboard page hard-codes `30000`. Config has `30000`. Three sources of truth for the same threshold.
*Mitigation:* Cleanup PR removes the hard-codes; both consumers read from `config.concessionalCap`.

**C-3. Aggregators have zero entity awareness.**
`incomeAggregator`, `expenseAggregator`, `loanAggregator`, `cashflowOrchestrator` all filter by `userId` only. The `ownerEntityId` FK has existed since Phase 41a (2026-05-04) but is unused in queries. Phase 41e cannot dispatch entity-specific tax rules without this.
*Mitigation:* 41e.0 (foundation) extends each aggregator with optional `ownerEntityId` parameter. Backward-compatible — existing call sites pass undefined, behaviour unchanged.

**C-4. FY25-26 missing from `taxYearConfig.ts`.**
Only FY23-24 + FY24-25 in the config. FY25-26 super caps are projected in `capTracker.ts` but the main config has no entry. We're 7 weeks from the new FY (1 July 2026 in this fictional timeline) and the canonical config doesn't know about it.
*Mitigation:* Cleanup PR adds `TAX_YEAR_2025_26` (carries forward FY24-25 thresholds; updates only confirmed by ATO data).

### 🟠 HIGH — fix during 41e or accept documented limitation

**H-1. Hard-coded 15% super contributions tax (×7 occurrences).**
`/api/tax/super/optimize/route.ts` lines 100, 113, 122, 161, 264, 313 + `/api/tax/super/contributions/route.ts:267`. Each location independently asserts `0.15` or `× 0.85` (the 15% taxed-in-fund rate). If the rate ever changes (policy reform), all 7 sites must be updated in lockstep — easily missed.
*Mitigation:* Cleanup PR adds `config.superContributionsTaxRate = 0.15` and refactors all 7 sites.

**H-2. Co-contribution threshold hard-coded ($60,400) in 2 places.**
`/api/tax/super/optimize/route.ts:185` + `taxIntegration.ts:185`. Stales annually (income test indexes).
*Mitigation:* Add `config.coContributionIncomeThreshold` to FY config; refactor both sites.

**H-3. 11.5% Super Guarantee rate hard-coded in dashboard.**
`app/dashboard/tax/page.tsx:759` displays the rate as a static reference. ATO schedule already has SG rising to 12% by 2025-26 (verify against current ATO). When the rate changes, the dashboard goes stale.
*Mitigation:* Dashboard reads from `config.superGuaranteeRate` via API.

**H-4. FY24-25 tax brackets hard-coded in dashboard table.**
`app/dashboard/tax/page.tsx:446-470`. Hard-coded for display ("$0–$18.2k nil" etc). Diverges silently if config changes.
*Mitigation:* Dashboard reads brackets from `config.brackets` via API endpoint.

**H-5. `taxAnalyzer.ts` assumes 30% marginal rate.**
Line 129 multiplies CGT × 0.5 × 0.30 to estimate "tax savings." A user in the 37% or 45% bracket sees materially wrong numbers.
*Mitigation:* `taxAnalyzer` calls `getMarginalRate(userTaxableIncome)` instead of assuming 30%.

**H-6. `taxIntegration.ts` $3,000/property depreciation estimate.**
`taxIntegration.ts:426` estimates `propertiesWithoutDepreciation.length * 3000`. Arbitrary. No connection to actual capital works (Div 43) or plant & equipment (Div 40) calculations.
*Mitigation:* Either replace with real Div 40/43 calc (out of 41e v1 scope per UNCOMPUTED) or document the heuristic clearly.

### 🟡 MEDIUM — known limitations to document, address opportunistically

**M-1. SAPTO is "simplified."**
`taxOffsets.ts` comment admits the implementation diverges from real SAPTO eligibility rules. Low impact (small pool of users) but flag.

**M-2. HECS/HELP not in PAYG.**
`paygCalculator.ts:145` TODO. Affects under-50k earners with HECS — Withholding will be too low.

**M-3. Non-salary income not tax-adjusted in cashflow.**
`incomeNormalizer.ts:142-162` comments: rental/dividend/interest treated as gross. Cashflow projections show too-high net income.

**M-4. No interest charge on excess contributions.**
`capTracker.ts:226-233` comment: ATO charges 10% p.a. + indexation on excess concessional contributions, not modelled.

**M-5. No catch-up super beyond carry-forward.**
`contributionCalculator.ts` has carry-forward but not the broader catch-up logic. Edge case.

**M-6. No downsizer contribution support (Div 135).**
`SuperContributionType.DOWNSIZER` enum exists but no calculation logic. Edge case for ages 55+.

### 🔵 LOW — out of scope for 41e v1, document in UNCOMPUTED

- Foreign resident CGT withholding (Sch 1 Subdiv 14-D) — flagged but no calculation
- Foreign loss limitations — `taxOffsets.ts` foreign tax offset doesn't model
- Testamentary trusts / deceased estates — Phase 42+
- GST margin scheme — out of scope
- Payroll tax (state) — out of scope
- FBT (Fringe Benefits Tax) — separate regime; out of scope

---

## 4. Architectural decision — layer 41e on Phase 20 (do not rewrite) — PR 2/4

> **Decision (2026-05-05):** Phase 41e is implemented as a new **entity-aware orchestration layer** that sits ON TOP of the existing Phase 20 tax engine at `lib/tax-engine/`. The Phase 20 engine is preserved as a **calculation primitive library** — its pure functions are reused; its assumptions are not. New net-new modules are built only for AU rules Phase 20 does not cover (Div 6, Div 7A, s100A, Div 152, FTE, state taxes, Div 296).

### 4.1 Why layer instead of rewrite

| Option | Verdict | Reasoning |
|---|---|---|
| **A. Rewrite Phase 20 from scratch as entity-aware** | ❌ Rejected | 3,776 LOC of tested-against-prod federal calc logic (PAYG NAT 1004, Medicare, LITO/SAPTO, franking, Div 293). Throwing it away to "do it properly with entities" is the exact pattern CLAUDE.md §12.8 forbids — *"3 lines of clear code is better than 1 line of clever code."* Rewrite risk: regression on every user's tax estimate during the rebuild window. |
| **B. Fork Phase 20 → entity-aware copy → swap consumers** | ❌ Rejected | Two engines coexisting violates SSOT (CLAUDE.md §12.2). Drift between forks is inevitable — the one not actively maintained will rot, and nobody will know which is canonical. |
| **C. Layer 41e on Phase 20 (this decision)** | ✅ Accepted | Phase 20 stays as the federal-individual primitive. 41e adds entity dispatch, trust streaming, super-fund tax, state taxes, anti-avoidance. Each new module composes Phase 20 primitives where federal calc is needed (e.g. trust beneficiary's tax on distributed income still uses `calculateTaxLiability()`). One source of truth per rule. |

### 4.2 The layer boundary

```
┌─────────────────────────────────────────────────────────────────┐
│  Phase 41e — Entity-Aware Orchestration Layer  (NEW)           │
│  ─────────────────────────────────────────────                  │
│  • entityTaxRouter.ts       — dispatches by LegalEntityType     │
│  • trustDistribution.ts     — Div 6/6E/100A streaming           │
│  • smsfTax.ts               — 15% accumulation / 0% pension     │
│  • companyTax.ts            — 25%/30% base-rate / Div 7A loans  │
│  • cgtDiscount.ts           — entity-aware: 50%/33⅓%/0%/nil     │
│  • smallBusinessConcessions — Div 152 (15-yr / 50% / retire)    │
│  • familyTrustElection.ts   — FTE chain + family-group rules    │
│  • stateTax.ts              — land tax, stamp duty (per state)  │
│  • div296.ts                — $3M super tax (FY25-26+)          │
│  • masterTaxPosition.ts     — household roll-up across entities │
│                                                                 │
│  Composes ↓                                                     │
├─────────────────────────────────────────────────────────────────┤
│  Phase 20 — Federal Individual Tax Calc  (PRESERVED, REUSED)   │
│  ─────────────────────────────────────                          │
│  lib/tax-engine/  — 14 files, 3,776 LOC                         │
│  • taxBracketCalculator.ts  — federal brackets (FY config)      │
│  • medicareCalculator.ts    — Medicare Levy + Surcharge         │
│  • taxOffsets.ts            — LITO/SAPTO/franking/foreign       │
│  • capTracker.ts            — concessional/non-concessional cap │
│  • incomeNormalizer.ts      — frequency → annual, tax-adjusted  │
│  • payrollEngine.ts         — PAYG NAT 1004                     │
│  • ...                                                          │
└─────────────────────────────────────────────────────────────────┘
```

**Consumer rewiring (the only invasive part):**

- `buildTaxSummary()` in `masterFinancialService.ts:1012-1077` (the regression trap — C-1) is replaced with a call to **`calculateMasterTaxPosition(userId)`** in the new 41e layer, which dispatches per-entity, sums up, and returns the same shape (or an extended shape — TBD in PR 3).
- The 11 existing tax routes (audit §2.3) keep their URLs. Their handlers become thin wrappers calling the 41e layer, not Phase 20 primitives directly.
- CFO module hard-coded constants (taxAnalyzer.ts, taxIntegration.ts) are replaced with FY-indexed lookups via the 41e config bridge (PR 3 details).

### 4.3 What this preserves

- **Every existing test fixture, every prod-validated number for individual federal tax stays valid.** No user sees a different number for their PAYG estimate the day this lands. (Snapshot-test strategy in PR 4.)
- **The 14 Phase 20 files keep their public contracts.** They become "calc primitives" — reusable as composition building blocks for the new entity dispatch layer, not deleted.
- **The Phase 20 engine's responsibility shrinks but doesn't change.** Before: tax engine for "the user" (an unstated implicit individual). After: tax engine for "an individual entity in a household" (PERSONAL_NAME or natural-person beneficiary of a distribution).

### 4.4 What this introduces

A small number of canonical entry points that all 41e calc flows through:

| New canonical entry point | Replaces / wraps | Returns |
|---|---|---|
| `calculateEntityTaxPosition(entityId, fy)` | Per-entity dispatch by `LegalEntityType` | Single-entity tax position |
| `calculateMasterTaxPosition(userId, fy)` | `buildTaxSummary()` (C-1 regression trap) | Household-wide roll-up across all entities |
| `calculateTrustDistribution(entityId, fy)` | Net-new (no Phase 20 equivalent) | Per-beneficiary share + character |
| `calculateCgtOnDisposal(asset, owner, fy)` | Net-new (no Phase 20 equivalent) | CGT after entity-aware discount |
| `getStateTaxLiability(entity, state, fy)` | Net-new | Land tax + stamp duty |

Detailed module catalogue + per-route migration in PR 3.

---

## 5. Multi-entity ownership combinations matrix — PR 2/4

> **Reza brief 2026-05-04:** *"There will be accounts and possibly loans connected to companies, trusts or SMSF ... investment platforms connected to SMSF or even properties. So I want to make sure you have considered all possible options and combinations in the design and calc engines."*

The matrix below is the **structural truth** of which entity types can legally own which financial-object types under AU law, and the per-cell **tax dispatch rule** the 41e layer must apply. This is the heart of the cross-entity audit. Every cell that is **schema-permitted but AU-prohibited** is a place the wizard / tree / calc engine must refuse or warn.

### 5.1 Legend

| Symbol | Meaning |
|---|---|
| ✅ | Permitted under AU law + schema permits + 41e calc handles it |
| ⚠️ | Permitted but with material restrictions (rule cited in cell) |
| 🚫 | Prohibited under AU law (calc engine MUST refuse + wizard MUST block) |
| ➖ | Schema does not permit this combination (no FK path exists) |
| 🔄 | Indirect ownership via trustee / custodian — see 5.4 |

### 5.2 Entity × Object type matrix

| Owner ↓ / Object → | Property | Loan (mortgage / personal / Div 7A) | Account (cash) | Investment Account (broker / wrap) | Asset (vehicle / collectible / business) | Income source | Expense |
|---|---|---|---|---|---|---|---|
| **PERSONAL_NAME** (natural person) | ✅ Direct ownership; CGT 50% discount on >12mo holding (s115-25); main residence exemption (Div 118) | ✅ Mortgage interest deductible only if income-producing; PPOR mortgage non-deductible | ✅ Interest income at marginal rates; TFN withholding if not quoted | ✅ Dividends franked/unfranked; CGT on sale; super contributions in own name | ✅ CGT applies; personal-use asset rules (s108-20); collectables threshold $500 | ✅ Salary, wages, business via SOLE_TRADER, investment income | ✅ Deductibility per s8-1 nexus test |
| **SOLE_TRADER** (PERSONAL_NAME with ABN) | ✅ Same as PERSONAL_NAME — tax flows to individual | ✅ Business loan deductible if business-purpose; personal portion apportioned | ✅ Business cash account; same tax as PERSONAL_NAME | ✅ Same as PERSONAL_NAME (no separate legal entity) | ✅ Business assets; depreciation Div 40; instant write-off thresholds (FY-indexed) | ✅ Business income flows to individual return | ✅ Business expenses on individual return; PSI rules s84-87 if personal services |
| **PARTNERSHIP** | ⚠️ Partnership doesn't pay tax; partners taxed on share (s92); **CGT event applies at partner level on partner's interest in asset** | ⚠️ Partnership-level loan; deductibility tested at partnership net-income level | ⚠️ Partnership account; income flows to partners per agreement | ⚠️ Partnership-level investments; distributions retain character | ⚠️ Partnership assets; CGT split per partner share | ⚠️ Distributed per partnership agreement; salary-to-partner is NOT deductible (Pt III Div 5) | ⚠️ Deductible at partnership level before distribution |
| **COMPANY** (Pty Ltd, non-trustee) | ⚠️ Permitted but no CGT discount (s115-10); no main-residence exemption ever; **stamp duty + land tax surcharge in most states** | ⚠️ Director loans = **Div 7A risk** — must be on Div 7A-compliant terms or deemed dividend (s109D); franking implications | ✅ Standard company account; interest at 25%/30% base-rate | ✅ Company can hold shares; **inter-corporate dividend rebate (s46) replaced by franking — only franked dividends fully recovered** | ⚠️ FBT risk if used by shareholder/associate (s136 FBTAA); CGT no discount | ⚠️ Trading income at 25% (base-rate entity ≤$50M) or 30%; PSI rules for service companies | ⚠️ Deductible if `8-1` nexus — directors' fees + super deductible |
| **DISCRETIONARY_TRUST** (family trust) | ⚠️ Trustee holds legal title; CGT 50% discount FLOWS THROUGH to beneficiary (s115-215) if streamed properly; **NSW land tax surcharge unless excluded foreign-person clause** | ⚠️ Trust borrowing must be on commercial terms; **Div 7A risk if beneficiary owes UPE** (TR 2010/3, PCG 2017/13) | ✅ Trustee account; income distributed | ⚠️ Trust holds investments; **streaming of franked dividends + capital gains requires written resolution by 30 June** (s207-58, s115-228) | ⚠️ Same as Property — trustee legal title, beneficial via distribution | ⚠️ All income must be distributed by 30 June or trustee taxed at 47% (s99A); **s100A reimbursement-agreement risk** (TR 2022/4, PCG 2022/2) | ⚠️ Deductible at trust net-income level before distribution |
| **UNIT_TRUST** | ✅ Trustee holds legal title; unit-holder share fixed by units; CGT discount flows through proportionally | ✅ Trust borrowing; **NALI (non-arm's-length income) risk if SMSF unit-holder + non-arm's-length terms** (s295-550) | ✅ Trustee account | ✅ Trust holds investments; distributed pro-rata to units | ✅ Trustee legal title | ✅ Distributed pro-rata to units; **fixed-trust status critical for franking pass-through** (Sch 2F ITAA36) | ✅ Deductible at trust net-income level |
| **SMSF** | ⚠️ **Sole purpose test (s62 SIS Act)** — must be retirement benefit; **in-house asset rule (Pt 8 SIS) — ≤5% of fund value can be related-party**; **LRBA (s67A) — bare trust + non-recourse + Pt 8 exception** | ⚠️ **Only LRBA loans permitted** (s67/67A SIS Act); single acquirable asset; non-recourse to other fund assets; **NALI on non-arm's-length lender** | ✅ SMSF cash account; **no member loans (s65 SIS)** | ✅ SMSF holds shares/wrap; **collectables held under SIS Reg 13.18AA** (insured, stored, not for personal use) | ⚠️ **Business Real Property exception (s71(1)(b) SIS)** — SMSF can hold from related party if BRP; otherwise in-house asset cap | ⚠️ Investment income only; **15% accumulation / 0% pension; Div 296 from FY25-26 on TSB > $3M**; NALI at 45% if non-arm's-length | ⚠️ Deductible against fund income at 15% rate; admin fees + actuarial allowed |

### 5.3 Schema vs AU vs calc-handled — divergence map

The matrix above defines what's **legal**. The Prisma schema today permits broader combinations than AU law allows. The 41e calc engine + wizard must enforce the AU column, not the schema column.

| Combination | Schema permits? | AU permits? | 41e enforcement |
|---|---|---|---|
| `Property.ownerEntityId` → SMSF | ✅ | ⚠️ Only if BRP or via LRBA bare trust | Wizard: warn + ask "Is this a Business Real Property?" / "Is this held via LRBA?". Calc: route via `smsfTax.ts` with sole-purpose flag. |
| `Loan.ownerEntityId` → SMSF | ✅ | ⚠️ Only LRBA loans | Wizard: hard-block "non-LRBA". Calc: `smsfTax.ts` with LRBA-flag; NALI check on terms. |
| `Loan.ownerEntityId` → COMPANY (with PERSONAL_NAME borrower) | ✅ | ⚠️ Div 7A applies | Calc: `companyTax.ts.div7aCheck()` — flag deemed-dividend risk + minimum-yearly-repayment requirement. |
| `Account.ownerEntityId` → SMSF, member name on bank statement | ✅ | 🚫 Asset must be in fund's name (SIS s52B trustee covenants) | Wizard: warn ("Bank account must be in the fund's name"). |
| `Property.ownerEntityId` → DISCRETIONARY_TRUST + main-residence flag | ✅ | 🚫 Main-residence exemption is for individuals only (Div 118 s118-110) | Calc: refuse the main-residence exemption; ignore the flag for trust-owned properties. |
| `InvestmentAccount.ownerEntityId` → DISCRETIONARY_TRUST | ✅ | ⚠️ Streaming requires written resolution by 30 June | Calc: `trustDistribution.ts` requires `streamingResolutionAt` field; if absent → distribute proportionally + warn. |
| `Asset.ownerEntityId` → COMPANY, used by shareholder | ✅ | ⚠️ FBT applies | Calc: flag FBT exposure (calc deferred — UNCOMPUTED in v1; warning only). |
| `Property.ownerEntityId` → COMPANY | ✅ | ⚠️ State stamp duty + land tax surcharge | Calc: `stateTax.ts` applies foreign-person / corporate surcharge per state config. |
| `Income.ownerEntityId` → DISCRETIONARY_TRUST without `streamingResolutionAt` | ✅ | ⚠️ Trustee taxed at 47% (s99A) if not distributed by 30 June | Calc: if FY-end passed without resolution → tax at trustee rate. |

**Wizard implication (Phase 41e.1+):** the entity wizard's "add object to entity" step needs an AU-permits gate, not just a schema gate. Where AU is `⚠️`, the wizard surfaces the question (LRBA? BRP? streaming resolution date?). Where AU is `🚫`, the wizard blocks with a plain-English explanation.

### 5.4 Indirect ownership — corporate trustee + custodian

Several AU structures involve a **legal-title vs beneficial-title** split that the schema models via `LegalEntity.parentEntityId` (self-FK). The 41e calc engine must walk this chain to dispatch to the right tax rule.

| Structure | Legal title | Beneficial title | parentEntityId chain | Tax dispatch |
|---|---|---|---|---|
| **Family trust with corporate trustee** | Pty Ltd (COMPANY) | DISCRETIONARY_TRUST | Property.ownerEntityId → DISCRETIONARY_TRUST.parentEntityId → COMPANY (trustee) | Tax dispatched to **DISCRETIONARY_TRUST** (the beneficial entity); the corporate trustee's only function is asset-protection / land-title / contract-counterparty. The Pty Ltd files no separate income tax for trustee activity (tax-transparent in this capacity). |
| **SMSF with corporate trustee** | Pty Ltd (COMPANY) | SMSF | Account.ownerEntityId → SMSF.parentEntityId → COMPANY (trustee) | Tax dispatched to **SMSF** (15% / 0% / Div 296). Trustee company is a non-operating shell; **must not trade or hold non-fund assets** (sole purpose test). |
| **Service entity (Pt IVA risk)** | COMPANY | PERSONAL_NAME / TRUST (the practitioner) | parent: practitioner entity owns COMPANY shares | Tax dispatched to **COMPANY** for service-company income; service fees deductible to operating entity must be **commercially justified** (Phillips case; PCG 2018/D8). 41e v1: warning only; full Pt IVA dispatch is UNCOMPUTED. |
| **LRBA bare trust (custodian)** | Bare Trust (custodian COMPANY) | SMSF | Property.ownerEntityId → SMSF; bare-trust custodian recorded as a metadata field on Property, not a separate LegalEntity row | Tax dispatched to **SMSF**. Bare trust is tax-transparent (s67A SIS); 41e treats it as a non-entity. |
| **Unit trust held by SMSF (related)** | UNIT_TRUST (trustee Pty Ltd) | SMSF (unit-holder) | UNIT_TRUST.parentEntityId → COMPANY (trustee); SMSF holds units (separate `InvestmentAccount` row pointing to UNIT_TRUST) | Two-step dispatch: UNIT_TRUST income distributed pro-rata → SMSF unit-holder share taxed at 15% / 0%. **NALI risk** if non-arm's-length unit price or distribution. |

**Cycle-detection requirement.** The `parentEntityId` self-FK can in principle form a cycle (A's parent is B, B's parent is A). The entity service (`legalEntityService.ts`) MUST refuse cycle creation at write time. PR 3 specifies the validation.

### 5.5 Cross-entity flow rules — the eight scenarios 41e must dispatch correctly

These are the **dynamic flows** between entities the calc engine needs first-class support for. Each is a calc-engine module in 41e (or a flag on an existing module) — listed here so PR 3's per-engine map can name the module.

| # | Scenario | Pattern | 41e module | Auth & timing rule |
|---|---|---|---|---|
| **1** | **Corporate trustee structure** | Pty Ltd (no trade) holds legal title for Trust | `entityTaxRouter.ts` walks `parentEntityId` and dispatches to beneficial entity | Tax pass-through; trustee company files NIL company return |
| **2** | **Div 7A loans (private company → shareholder/associate)** | Loan from COMPANY to PERSONAL_NAME (or to a trust the shareholder benefits from) | `companyTax.ts.div7aCheck()` | Loan must be Div 7A-compliant (s109N): written agreement, term ≤7 years (or 25 if secured), benchmark interest rate, minimum yearly repayment by 30 June. Otherwise → deemed unfranked dividend. |
| **3** | **Trust-to-trust streaming (chain distribution)** | DISCRETIONARY_TRUST distributes to UNIT_TRUST distributes to PERSONAL_NAME | `trustDistribution.ts` (recursive walk) | Each link requires written resolution before 30 June. Character (franking, capital gain, foreign income) is preserved through the chain only with proper streaming resolution (s207-58, s115-228). FTE chain rules (Sch 2F ITAA36) — the family-group test must hold at every link. |
| **4** | **Trust → PERSONAL_NAME (most common)** | DISCRETIONARY_TRUST distributes to natural-person beneficiary | `trustDistribution.ts` + `entityTaxRouter.ts` (recurse to PERSONAL_NAME) | Distributed share added to beneficiary's individual taxable income; CGT discount + franking credit pass through if streaming resolution exists. **s100A risk** if beneficiary's distribution is reimbursed back to the trustee or another adult (TR 2022/4). |
| **5** | **SMSF receiving member contribution** | PERSONAL_NAME → SMSF (concessional or non-concessional) | `capTracker.ts` (Phase 20, REUSE) + `smsfTax.ts` (NEW) | Concessional cap (FY-indexed); non-concessional cap (3× concessional, FY-indexed); bring-forward triggered if cap exceeded by ≤3× and TSB < $1.66M (FY24-25). Div 293 surcharge if income > $250k. **Carry-forward concessional** if TSB < $500k at start of FY. |
| **6** | **SMSF buying property under LRBA** | SMSF → bare trust → Property (with non-recourse loan) | `smsfTax.ts.lrbaCheck()` + `stateTax.ts` (stamp duty) | Single acquirable asset (s67A SIS); non-recourse; bare-trust custodian holds title; no replacement-asset rule (only repairs/maintenance, no improvements that change character). Land tax + stamp duty per state. |
| **7** | **PSI through Pty Ltd** | Practitioner provides personal services via COMPANY | `companyTax.ts.psiCheck()` | If PSI rules apply (s84-87) and no PSB determination → income attributed to individual at marginal rates regardless of company structure. Tests: results test, ≥80% from one client test, employment test, business-premises test. |
| **8** | **SMSF acquiring Business Real Property from member** | PERSONAL_NAME (member) → SMSF (with BRP exception) | `smsfTax.ts.brpAcquisition()` | Permitted under s71(1)(b) SIS as exception to in-house asset rule. Must be wholly + exclusively used in business at acquisition; market-value transfer; arm's-length. |

**Why these eight specifically.** They cover every cross-entity wealth flow that has a different tax outcome from the obvious "individual receives money" calc. If 41e dispatches them correctly, the household-wide tax position is correct. If 41e gets even one wrong, the user's tax estimate has a silent bias.

### 5.6 What's deliberately NOT in 41e v1 (UNCOMPUTED)

Documented now so PR 3's downstream-impact map can flag the surfaces that surface "UNCOMPUTED" badges instead of numbers:

- **FBT** — flagged on COMPANY-owned Asset used by shareholder/associate; no calc.
- **Pt IVA / general anti-avoidance** — beyond PCG-codified safe-harbour checks.
- **Stamp duty (transactional, non-property)** — only land transfer + foreign-person surcharge in scope.
- **Payroll tax (state)** — out of scope.
- **GST registration / BAS preparation** — out of scope; income figures gross of GST with a flag.
- **CFC / transferor trust regimes** — international anti-deferral rules; out of scope for v1.
- **Testamentary trusts / deceased estates** — Phase 42+.

Full UNCOMPUTED list is consolidated in PR 4.

---

## 6. Per-rule SSOT migration map — PR 3/4

> **Reza brief 2026-05-05 (the SSOT contract):** *"Any changes to the calculations should be made carefully to the existing engines considering all aspects of existing rules vs the new ones. I don't want to break something to build a new solution."*

This section is the **per-file action plan**. Every module from §2.1 + §2.2 + §2.3 gets a verdict: **REUSE** (Phase 20 primitive — keep, leave alone), **EXTEND** (modify in place to add entity awareness or extract a constant), **WRAP** (kept as-is, called from a new 41e module that adds the entity layer), **REPLACE** (delete the inline math, swap to the canonical engine), or **NET-NEW** (no existing code; build in 41e). Every action lists the 41e sub-PR that owns it.

### 6.1 Migration verdict legend

| Verdict | Meaning | Risk |
|---|---|---|
| **REUSE** | Phase 20 primitive is correct as-is; 41e composes it from above | None (preserve untouched) |
| **EXTEND** | Modify the file in place — extract a hard-coded constant to FY config, or add an optional `entityType` param. Backward-compatible. | Low — backward-compat means zero call-site disruption |
| **WRAP** | Phase 20 file kept untouched; new 41e module sits on top and calls it with entity-aware dispatch | None to Phase 20; new 41e module owns the entity logic |
| **REPLACE** | Existing inline math is wrong / duplicated / out-of-sync; delete it, call canonical engine instead | **Highest** — this is where the regression-trap snapshot tests matter most |
| **NET-NEW** | No existing code; 41e builds from scratch per `PHASE_41_REGULATORY_ARCHITECTURE.md` §11 | Medium — fresh code, but isolated to 41e modules, no migration risk |
| **DELETE** | Code is dead or contradictory; remove from codebase | Low after dependency check |

### 6.2 Phase 20 tax engine (`lib/tax-engine/`) — per-file map

| File | LOC | Verdict | Action | 41e sub-PR |
|---|---|---|---|---|
| `index.ts` | 103 | **REUSE** | Keep as-is. 41e imports from here. | — |
| `types.ts` | 406 | **EXTEND** | Add `EntityTaxFacts`, `MasterTaxPosition`, `AuthorityCitation`, `FYReference` types per architecture doc §4. Existing types untouched. | 41e.0 |
| `config/taxYearConfig.ts` | 227 | **EXTEND** | Add `TAX_YEAR_2025_26` entry (resolves C-4). Add config keys for the constants from §6.5 reconciliation table (resolves C-2, H-1, H-2, H-3). Existing FY24-25 untouched. | 41e.−1 (cleanup) + 41e.0 |
| `core/incomeTaxCalculator.ts` | 172 | **REUSE** | Federal Div 1-6 calc is correct as-is. 41e dispatches `entityType === 'PERSONAL_NAME'` flows to this. | — |
| `core/medicareLevyCalculator.ts` | 231 | **REUSE** | Medicare is individual-only (per Health Insurance Levy Act). 41e never calls this for COMPANY/TRUST/SMSF. | — |
| `core/paygCalculator.ts` | 267 | **EXTEND** | Add HECS/HELP withholding (M-2; line 145 TODO). Otherwise REUSE. | 41e.−1 (cleanup, optional) or accept HECS gap as known limitation |
| `core/taxOffsets.ts` | 299 | **REUSE** | LITO/SAPTO/franking/foreign offsets are individual-level. 41e dispatches PERSONAL_NAME flows to this. SAPTO simplification (M-1) accepted as known limitation. | — |
| `income/salaryProcessor.ts` | 359 | **REUSE** | SG calc + sacrifice optimisation. Per-individual. Composed by 41e for SOLE_TRADER + PERSONAL_NAME. | — |
| `income/taxabilityRules.ts` | 317 | **REUSE** | Income classification + franking math. Pure utility. | — |
| `position/taxPositionCalculator.ts` | 499 | **REUSE** + **WRAP** | The user-level orchestrator stays as the federal-individual primitive. New `calculateEntityTaxPosition()` in 41e wraps this for `entityType === 'PERSONAL_NAME'` and dispatches to NET-NEW modules for COMPANY / TRUST / SMSF. | 41e.17 (orchestrator) wraps |
| `super/capTracker.ts` | 373 | **EXTEND** | Move `CONCESSIONAL_CAPS` / `NON_CONCESSIONAL_CAPS` constants into `taxYearConfig.ts` so they're not duplicated. Add interest charge on excess concessional contributions (M-4) — optional. | 41e.−1 (cleanup) + 41e.2 |
| `super/contributionCalculator.ts` | 462 | **EXTEND** | Add downsizer contribution support (M-6) — optional. Otherwise REUSE. | 41e.2 + 41e.11 |
| Phase 20 fixtures (none exist) | 0 | **NET-NEW** | Add Sarah Kim / David+Emma / Olivia archetype fixtures with ATO worked-example numbers. Per architecture doc §1(4). | 41e.−1 (cleanup) — captures pre-refactor outputs as parity baseline |

**Net Phase-20 changes:** 1 EXTEND to `types.ts` (additive, no breaking change), 1 EXTEND to `taxYearConfig.ts` (additive, no breaking change), 1 EXTEND to `capTracker.ts` (constant relocation, behaviour preserved), 1 optional EXTEND to `paygCalculator.ts` (HECS), 1 optional EXTEND to `contributionCalculator.ts` (downsizer). **Eight files preserved untouched** as calc primitives.

### 6.3 Aggregators + master snapshot — per-file map

| File | Verdict | Action | 41e sub-PR |
|---|---|---|---|
| `lib/services/masterFinancialService.ts:1012-1077` (`buildTaxSummary()`) | **REPLACE** | Delete inline bracket math. Call `calculateMasterTaxPosition(userId)` from new 41e orchestration layer. **Resolves C-1.** Snapshot test asserts parity with `/api/tax/position`. | 41e.−1 (cleanup) — first action |
| `lib/calculations/incomeAggregator.ts` | **EXTEND** | Add optional `ownerEntityId?: string` param. Filter `findMany` `where` clause by entity if provided. Default = no filter (backward-compat). **Resolves C-3 (income).** | 41e.0 |
| `lib/calculations/expenseAggregator.ts` | **EXTEND** | Same pattern as incomeAggregator. **Resolves C-3 (expenses).** | 41e.0 |
| `lib/calculations/loanAggregator.ts` | **EXTEND** | Same pattern. Note: simplified interest math (`(rate/100)/12 × principal`) accepted as known limitation — full amortisation engine is out of scope. **Resolves C-3 (loans).** | 41e.0 |
| `lib/calculations/cashflowOrchestrator.ts` | **EXTEND** | Per-entity grouping. Calls extended aggregators with `ownerEntityId`. **Resolves C-3 (cashflow).** | 41e.0 + 41e.8 |
| `lib/calculations/netWorthCalculator.ts` | **EXTEND** | Per-entity grouping. Aggregates assets/liabilities by `ownerEntityId`. | 41e.0 |
| `lib/cashflow/incomeNormalizer.ts:142-162` | **EXTEND** | Add tax-adjustment for non-salary income (rental / dividend / interest) — currently passed through gross (M-3). Optional v1 addition. | 41e.8 (negative gearing + per-entity aggregator) |

**No DELETEs in this layer.** Aggregator extensions are additive — every existing call site continues to work.

### 6.4 Tax routes + cross-engine consumers — per-file map

| File | LOC | Verdict | Action | 41e sub-PR |
|---|---|---|---|---|
| `app/api/tax/route.ts` | 313 | **WRAP** | URL preserved. Handler becomes thin wrapper calling 41e orchestrator. Frequency enums extracted to shared utility. | 41e.17 |
| `app/api/tax/salary/route.ts` | 149 | **REUSE** | Salary processing is individual-level; route delegates correctly to `processSalary`. No change. | — |
| `app/api/tax/super/route.ts` | 282 | **EXTEND** | Replace hard-coded `0.85` with `config.superContributionsTaxRate`. Otherwise correct. | 41e.−1 (cleanup) — resolves H-1 |
| `app/api/tax/super/optimize/route.ts` | 341 | **EXTEND** | 6 hard-coded `0.15` → `config.superContributionsTaxRate`. `60400` co-contrib threshold → `config.coContributionIncomeThreshold`. `0.30` / `0.37` marginal compares → call `getMarginalRate()`. `0.50` CGT discount → `config.cgtDiscountRate`. | 41e.−1 — resolves H-1 + H-2 |
| `app/api/tax/super/contributions/route.ts` | 297 | **EXTEND** | Hard-coded `0.85` → config. Add cap validation call. | 41e.−1 + 41e.2 |
| `app/api/tax/position/route.ts` | 298 | **WRAP** | URL preserved. Handler becomes thin wrapper calling 41e orchestrator. Tightly-coupled `IncomeItem` / `ExpenseItem` interfaces become stable contract for 41e. | 41e.17 |
| `lib/cfo/decisionSupport/taxIntegration.ts:185, 350, 426` | 519 | **EXTEND** + partial **REPLACE** | `27500` (FY24 stale) → `config.concessionalCap` (**resolves C-2**). `250000` Div 293 → config. `60400` co-contrib → config. `50000` / `100000` CGT thresholds → config. `$3000`/property depreciation estimate (H-6) → either real Div 40/43 calc (out of v1 scope) or documented heuristic flag. | 41e.−1 + 41e.0 |
| `lib/cfo/scenarios/sellProperty.ts` | 156 | **REUSE** | Defers to tax tab — correct behaviour. | — |
| `lib/strategy/analyzers/taxAnalyzer.ts:129` | 136 | **EXTEND** | Replace assumed `0.30` marginal rate with `getMarginalRate(taxableIncome)` call. **Resolves H-5.** | 41e.−1 |
| `lib/reports/generators/taxTime.ts` | 236 | **REUSE** | Pure aggregation, no calc. Consumes 41e orchestrator output. | — |
| `lib/cashflow/incomeNormalizer.ts` | 264 | **EXTEND** (covered in §6.3) | Already counted above. | 41e.0 |
| `app/dashboard/tax/page.tsx:446-470, 759` | 908 | **EXTEND** | Hard-coded brackets table → fetch from `/api/tax/config` (new endpoint or piggyback on `/api/tax/position`). `30000` / `120000` caps → API. `11.5%` SG → API. `30%` marginal threshold for sacrifice CTA → `getMarginalRate()`. FY24-25 hard-coded subtitle → `config.label`. **Resolves H-3 + H-4.** | 41e.−1 |

**Phase 41d `MoneyFlowSankey`** (`lib/services/moneyFlowService.ts` + `components/entities/MoneyFlowSankey.tsx`): proportional tax allocation v1 is documented in the inline UI caveat. Replaced post-41e.4 (Div 6E streaming) with correct per-entity dispatch. **No code change in cleanup PR — the v1 caveat is honest. Numbers change, visual unchanged.**

### 6.5 Constants reconciliation — single-source-of-truth map

This table consolidates every hard-coded constant flagged in the audit. Each constant gets ONE canonical home in `taxYearConfig.ts` and every consumer reads from there.

| Constant | Current value(s) | Stale? | Canonical home (post-cleanup) | Resolves finding |
|---|---|---|---|---|
| Concessional super cap | `$27,500` (CFO module) / `$30,000` (config + dashboard) | `$27,500` is FY24 stale | `config.concessionalCap` | C-2 |
| Non-concessional cap | `$120,000` (multiple) | OK FY25 | `config.nonConcessionalCap` | — |
| Super contributions tax rate | `0.15` (×7 sites, hard-coded) | OK | `config.superContributionsTaxRate` | H-1 |
| Co-contribution income threshold | `$60,400` (×2 sites) | Indexes annually | `config.coContributionIncomeThreshold` | H-2 |
| Super Guarantee rate | `11.5%` (dashboard) | Schedule has SG → 12% by 2025-26 | `config.superGuaranteeRate` | H-3 |
| Federal tax brackets table | Hard-coded in dashboard (`page.tsx:446-470`) | OK as display, fragile | `config.brackets` (already exists; dashboard reads via API) | H-4 |
| Marginal rate (assumed) | `0.30` in `taxAnalyzer.ts:129` | Wrong for high-bracket users | Call `getMarginalRate(taxableIncome)` | H-5 |
| CGT discount rate | `0.50` (multiple) | OK for individuals/trusts | `config.cgtDiscountRate` (with entity-aware override: 33⅓% for SMSF, 0% for COMPANY) | — |
| 12-month CGT holding | `12` (taxAnalyzer.ts) | Statutory | `config.cgtDiscountHoldingMonths` | — |
| Div 293 threshold | `$250,000` (CFO) | OK FY25 | `config.div293Threshold` | — |
| Property depreciation heuristic | `$3,000` per property (taxIntegration.ts) | Heuristic, not law | Document as `HEURISTIC` flag in 41e UNCOMPUTED list | H-6 |
| FY label | `"FY24-25"` (dashboard subtitle) | Drifts annually | `config.label` | H-4 |
| FY25-26 entry | **MISSING from `taxYearConfig.ts`** | Imminent | Add `TAX_YEAR_2025_26` config | C-4 |

### 6.6 Non-tax engines — what gets a touch from 41e

The following engines are NOT in scope for direct 41e refactor, but they consume aggregators that ARE refactored. Every consumer needs verification that the entity-aware aggregator extension didn't change its output.

| Engine | File | Touched in 41e? | Verification needed |
|---|---|---|---|
| Cashflow orchestrator | `lib/calculations/cashflowOrchestrator.ts` | **YES** (§6.3) | Snapshot-test fixture asserting cashflow numbers match before/after aggregator extension |
| Net worth calculator | `lib/calculations/netWorthCalculator.ts` | **YES** (§6.3) | Snapshot-test fixture; per-entity net worth = sum of (entity's assets) − (entity's liabilities) |
| AI advisor (Personal CFO) | `lib/cfo/decisionSupport/taxIntegration.ts` + `lib/cfo/scenarios/*` | **YES** (§6.4) | CFO recommendations must remain semantically equivalent for v1 user (no entities = single PERSONAL_NAME). Snapshot-test golden recommendations. |
| Strategy analyzers | `lib/strategy/analyzers/taxAnalyzer.ts` | **YES** (§6.4) | High-bracket user's CGT savings number changes (currently wrong). Document expected diff. |
| Reports / Tax time generator | `lib/reports/generators/taxTime.ts` | **REUSE** — consumes 41e output | Output shape unchanged; numbers may change as 41e fixes downstream errors. |
| MoneyFlowSankey (Phase 41d) | `lib/services/moneyFlowService.ts` | **YES** post-41e.4 | Visual unchanged. Numbers update from proportional allocation → correct Div 6/6E dispatch. |
| Dashboard tax page | `app/dashboard/tax/page.tsx` | **YES** (§6.4) | UI unchanged. Hard-coded constants → API-driven. Test: change a config value, dashboard reflects. |
| Health engine | `lib/health/*` | **NO** direct touch | But health score consumes net-worth + cashflow → indirect dependency. Snapshot-test the health score for fixture users pre/post cleanup. |
| Insights engine (`/api/portfolio/snapshot`) | `lib/intelligence/insightsEngine.ts` | **NO** | GRDCS layer; no tax math. Untouched. |
| Master Financial Service (non-tax fields) | `lib/services/masterFinancialService.ts` | **YES** (§6.3) — `buildTaxSummary()` only | Other fields (`netWorth`, `cashflow.net`, etc.) remain output-equivalent. |

### 6.7 Per-route migration impact — the 6 tax routes

| Route | Migration step | URL preserved? | Response shape preserved? | Caller update needed? |
|---|---|---|---|---|
| `GET /api/tax` | Handler → thin wrapper calling 41e orchestrator | ✅ | ✅ (existing fields preserved; new optional `byEntity` field added) | No |
| `POST /api/tax/salary` | No change (salary is individual-level) | ✅ | ✅ | No |
| `GET/POST /api/tax/super` | Constants extracted to config; handler logic unchanged | ✅ | ✅ | No |
| `POST /api/tax/super/optimize` | Constants extracted; `getMarginalRate()` calls instead of compares | ✅ | ✅ (numbers improve for high-bracket users) | No |
| `POST /api/tax/super/contributions` | Constants extracted; cap validation added | ✅ | ✅ (new `capValidation` field added) | No |
| `GET /api/tax/position` | Handler → thin wrapper calling 41e orchestrator | ✅ | ✅ (existing fields preserved; new optional `entities` field added) | No |

**No URL changes. No breaking response shape changes.** Every existing caller (Dashboard tax page, Sankey, AI advisor, future portal endpoints) continues to work without modification. New optional fields land in 41e.0+ for entity-aware consumers; old consumers ignore them.

### 6.8 New endpoints introduced by 41e

| Endpoint | Sub-PR | Purpose |
|---|---|---|
| `GET /api/tax/master-position?fy=YYYY-YY` | 41e.17 | Household-wide tax position across all entities. Replaces `buildTaxSummary()` consumer. |
| `GET /api/tax/entity/[entityId]?fy=YYYY-YY` | 41e.0 | Per-entity tax position (any LegalEntityType). Used by entity drill-in pages + Sankey. |
| `GET /api/tax/config?fy=YYYY-YY` | 41e.−1 | Returns FY config (brackets, caps, rates) for dashboard read. Replaces hard-coded values. |
| `POST /api/tax/trust-distribution` | 41e.4 | Computes Div 6/6E streaming + per-beneficiary share + character. |
| `POST /api/tax/div7a-check` | 41e.6 | Compliance check on a COMPANY → shareholder loan. |
| `POST /api/tax/cgt-disposal` | 41e.1 | Entity-aware CGT (50% / 33⅓% / 0% / nil discount). |
| `GET /api/tax/state-tax/[entityId]?state=NSW` | 41e.12-14 | Land tax + stamp duty + foreign-person surcharge. |

**All new endpoints use `withPermission('tax_data.read' | 'tax_data.write')`** per CLAUDE.md §12.5. Permission added to `lib/auth/permissions.ts` in 41e.0.

---

## 7. `parentEntityId` cycle-detection validation spec — PR 3/4

> Identified as a structural risk in §5.4. The `LegalEntity.parentEntityId` self-FK can in principle form a cycle (A's parent is B, B's parent is A). Calc engine walks this chain in `entityTaxRouter.ts` to dispatch corporate-trustee structures. A cycle would either crash the walker or recurse infinitely.

### 7.1 Where cycles can be introduced

| Path | Risk |
|---|---|
| `POST /api/entities` (create) | Low — new entity has no children at creation time |
| `PATCH /api/entities/[id]` (update — set `parentEntityId`) | **Highest** — user re-parents an entity that already has children |
| Database direct write (Prisma migration / seed) | Medium — must validate during seed/migration |
| Backfill / data import | Medium — Phase 41f Xero/MYOB import could conceivably introduce |

### 7.2 Validation rules

The validation MUST run in the entity service layer (`lib/services/legalEntityService.ts`), not just at the API route level — because it must protect every write path including future bulk imports.

**Rule 1 — Self-parent forbidden.**
`entity.parentEntityId !== entity.id`. Trivial check.

**Rule 2 — No cycle in the parent chain.**
Walk the parent chain starting from the proposed `parentEntityId`. If we encounter the entity being mutated, reject. Maximum walk depth = configured limit (proposed: 10 — corporate trustee chains in practice are 1-2 levels deep; trust-of-trust-of-trust is rare and 10 is a safety ceiling).

**Rule 3 — Maximum chain depth.**
Independent of cycle detection, refuse to create a chain deeper than the configured limit (10). Catches accidentally-built rabbit-hole structures and suggests the user simplify.

**Rule 4 — Type-compatibility (advisory, not blocking).**
Per the indirect-ownership table in §5.4, sensible parent relationships are:
- DISCRETIONARY_TRUST.parent → COMPANY (corporate trustee)
- UNIT_TRUST.parent → COMPANY (corporate trustee)
- SMSF.parent → COMPANY (corporate trustee)

A PERSONAL_NAME entity having a parent is a structural error (a natural person isn't owned by anything in the LegalEntity sense). Wizard should warn + block; calc engine should treat as `parent = null` if encountered.

A COMPANY having a parent is permitted (subsidiary structures, holding-company-of-trust) but warns: *"This Pty Ltd will be treated as the parent's subsidiary for tax dispatch. Confirm."*

### 7.3 Implementation contract for `legalEntityService.ts`

```typescript
// Pseudocode — final shape lands in 41e.0 sub-PR
async function validateParentChain(
  entityId: string | null,        // null when creating
  proposedParentId: string | null,
  tx: Prisma.TransactionClient,
): Promise<
  | { ok: true }
  | { ok: false; code: 'SELF_PARENT' | 'CYCLE_DETECTED' | 'MAX_DEPTH_EXCEEDED' | 'INVALID_PARENT_TYPE'; message: string }
> {
  if (proposedParentId === null) return { ok: true };
  if (entityId !== null && entityId === proposedParentId) {
    return { ok: false, code: 'SELF_PARENT', ... };
  }
  
  // Walk the chain from proposedParentId upward
  const visited = new Set<string>();
  let current: string | null = proposedParentId;
  let depth = 0;
  const MAX_DEPTH = 10;
  
  while (current !== null) {
    if (depth >= MAX_DEPTH) return { ok: false, code: 'MAX_DEPTH_EXCEEDED', ... };
    if (entityId !== null && current === entityId) return { ok: false, code: 'CYCLE_DETECTED', ... };
    if (visited.has(current)) return { ok: false, code: 'CYCLE_DETECTED', ... };
    visited.add(current);
    
    const parent = await tx.legalEntity.findUnique({
      where: { id: current },
      select: { parentEntityId: true },
    });
    current = parent?.parentEntityId ?? null;
    depth++;
  }
  
  return { ok: true };
}
```

**Where this is called:**
- `createLegalEntity()` — call before `prisma.legalEntity.create`
- `updateLegalEntity()` — call before `prisma.legalEntity.update` IF the update changes `parentEntityId`
- Both calls inside the same transaction as the write, to prevent TOCTOU races.

### 7.4 Database-level safety net (defence in depth)

Cycle detection in application code is the primary guard. As a defence-in-depth measure, the migration adding the `parentEntityId` column (already shipped in Phase 41a) MUST also have a CHECK constraint preventing self-parent at the DB level:

```sql
ALTER TABLE legal_entities
  ADD CONSTRAINT legal_entities_no_self_parent
  CHECK (id <> parent_entity_id OR parent_entity_id IS NULL);
```

If this constraint isn't already in the existing migration, 41e.0 ships a small additive migration to add it (no destructive write checklist needed — pure CHECK constraint addition; rejects only self-parent rows which we've already established shouldn't exist).

### 7.5 Tests required (lands with 41e.0)

| Test | Setup | Assert |
|---|---|---|
| Self-parent rejected | `update(A, parentEntityId: A)` | Service returns `SELF_PARENT` error |
| Direct cycle rejected | A→B exists; `update(B, parentEntityId: A)` | Returns `CYCLE_DETECTED` |
| Indirect cycle rejected | A→B→C exists; `update(C, parentEntityId: A)` | Returns `CYCLE_DETECTED` |
| Max depth enforced | Build 10-deep chain; create 11th | Returns `MAX_DEPTH_EXCEEDED` |
| Valid corporate trustee | Pty Ltd exists; create Trust with `parent = Pty Ltd` | Returns `ok` |
| Valid SMSF corporate trustee | Pty Ltd exists; create SMSF with `parent = Pty Ltd` | Returns `ok` |
| Reparent without cycle | A→B exists; create C; `update(B, parent: C)` | Returns `ok` (chain becomes B→C) |
| Calc walker walks correctly | Three-level chain Trust → Pty Ltd → null; dispatch tax for Trust | Returns Trust dispatch (skips Pty Ltd as legal-title-only) |

Tests live under `__tests__/services/legalEntityService.parentChain.spec.ts` per architecture doc §1(4).

---

## 8. What's Next (PR 4)

This PR (3/4) establishes the **per-rule SSOT migration map**, the **per-engine downstream impact**, and the **`parentEntityId` cycle-detection spec**. Sign off, and PR 4 lands the final deliverable:

- **PR 4** — refined **sub-PR sequencing** (architecture doc §11 list adjusted to insert the cleanup PR + reorder for safety) + **snapshot-test fixture strategy** (Sarah Kim / David+Emma / Olivia archetypes; capture-before-refactor, parity-after) + **constants reconciliation table v2** (executable mapping from §6.5 to PR commits) + **FY25-26 config gap** (resolves C-4) + **UNCOMPUTED additions** (consolidated from §5.6 + new findings) + **Reza sign-off block** that explicitly gates 41e.0.

After PR 4 sign-off, the cleanup PR (proposed "41e.−1") starts. Then 41e.0. Then 41e.1 through 41e.17 per architecture doc §11.

---

*PR 3/4 complete. Awaiting Reza review of the migration map + per-engine impact + cycle-detection spec before PR 4 starts.*
