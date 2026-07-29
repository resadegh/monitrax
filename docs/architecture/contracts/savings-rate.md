# savingsRate — net surplus as % of income (headline selection rule + named variants)

> Quantity Contract — MON-131 Phase A. READ-ONLY census at HEAD `fa392b9a`, 2026-07-29.
> Register row: "Savings rate | 21 | collapses once income + cashflow single-sourced — re-census
> before touching" (REFERENCE_NUMBERS.md T6). This contract confirms the census's expectation:
> most producers collapse WITH the cashflow contracts; what remains is a NAMING problem —
> four windows/bases legitimately coexist (VR-001's three-contradictory-rates finding).

## classification

**DERIVED** (a ratio of two DERIVED quantities). Never stored.

## semantic — the named variants (D6: index the definition, not the function name)

| name | formula | basis | window |
|---|---|---|---|
| `savingsRateHeadline` (the selection rule) | TTM rate when trailing actuals exist, else declared rate | actuals-first | selection |
| `savingsRateTrailing12m` | `annualNet / annualIncome × 100` | actual transactions (transfers excluded) | trailing 12 calendar months |
| `savingsRateCurrentMonthActual` | `net / inflow × 100` (0 when inflow 0) | actual, current calendar month | current month |
| `savingsRateDeclared` | `monthlyCashflow / monthlyNetIncome × 100` | declared (D8 full repayment in the numerator's outflow) | run-rate |
| `savingsRateScoreCFO` | piecewise map of a re-derived declared rate → 0-100 | declared (wrong inputs, see below) | run-rate |

Units: percent (Float); score variant: points 0-100. Negative rates are REAL (deficit), never
clamped on the rate variants; the score clamps at 0 by design.

- **Loan-repayment treatment (D8):** repayments reduce the numerator surplus in FULL on every
  D8-conformant variant. VIOLATED today by `metricAggregation.ts:175` and the income-expense
  report trend (both omit loans — see callSites).
- **Bound:** rate ≤ 100 whenever outflow ≥ 0 and inflow > 0; no lower bound.

## canonicalHome

- **Headline selection rule:** `lib/calculations/canonicalCashflow.ts:157`
  `getCanonicalSavingsRate` (MON-029). Decimal twin: **NOT ESTABLISHED**.
- `savingsRateTrailing12m` producer: `lib/calculations/moneyStoryTrend.ts:88`
  (`savingsRateTrailing`). Decimal twin: NOT ESTABLISHED.
- `savingsRateCurrentMonthActual` producer: `canonicalCashflow.ts:87` (actual branch of
  `resolveCanonicalCashflow`). **Naming collision finding:** this field is ALSO called
  `savingsRate` — a different window than `getCanonicalSavingsRate` in the SAME file (DR-3).
- `savingsRateDeclared` producer: `cashflowOrchestrator.ts:376-377` (+ Decimal twin :599-601).
- `savingsRateScoreCFO`: `lib/cfo/scoreCalculator.ts:326` (+ Decimal twin :628).

## callSites

Anchors re-verified at HEAD `fa392b9a`.

| file:line | tag | arithmetic in words |
|---|---|---|
| `app/api/dashboard/insights/route.ts:358,621,638` | CONSUMER | headline rule for Home KPI + insight (both branches through the ONE accessor — MON-029 fix intact) |
| `lib/cfo/intelligenceEngine.ts:191` | CONSUMER | CFO monthly-progress rate via the accessor |
| `lib/verification/selfAuditInvariants.ts:128,227` | CONSUMER | ring-audit reads |
| `lib/calculations/moneyStoryTrend.ts:88` | DIFFERENT-QUANTITY (named: Trailing12m) | annualNet/annualIncome over 12-mo actual buckets; feeds the accessor's `actual-ttm` branch |
| `lib/calculations/cashflowOrchestrator.ts:376-377,599-601` | DIFFERENT-QUANTITY (named: Declared) | monthlyCashflow/monthlyNetIncome; surfaces as `quickMetrics.savingsRate` (`masterFinancialService.ts:2111`) |
| `lib/cfo/scoreCalculator.ts:326-341` (+:628) | DUPLICATE ratio inside a DIFFERENT-QUANTITY score | re-derives `(income − expenses − loans)/income` from raw reduces — **GROSS `i.amount`** (no PAYG netting → rate understated vs declared-net variant), no one-off gate, raw `minRepayment` (IO → $0). The piecewise 0-100 mapping is its own quantity; the internal ratio should read the declared producer |
| `lib/services/masterFinancialService.ts:1413-1416` | DUPLICATE | buildHealthScore re-types `(income − expenses − loans)/income` inline (then ×5 clamp 0-100) instead of reading `cashflow.savingsRate` — inputs equivalent, formula re-typed |
| `lib/health/metricAggregation.ts:175` | DUPLICATE (wrong inputs) or DIFFERENT-QUANTITY | `(income − expenses)/income` — **omits loan repayments** (violates D8 basis) → health savingsRate metric reads HIGHER than every other surface (DR-1, escalated) |
| `app/api/portfolio/snapshot/route.ts:996-998` | DUPLICATE (hybrid) | `annualNetCashflow/netIncome` on the snapshot's hybrid declared basis (see declared contract DR-6) |
| `lib/intelligence/portfolioEngine.ts:~418` | DIFFERENT-QUANTITY | stress-test rate over interest-only loan basis (documented deliberate; needs a name — canonical contract DR-7) |
| `lib/reports/generators/incomeExpense.ts:41` | DUPLICATE (wrong inputs) | `net/income × 100` as "savings rate" trend where net omits loans (declared contract DR-9) |
| `app/dashboard/page.tsx:458,828-837` | CONSUMER | Home KPI tile reads insights payload (`canonicalKpi.savingsRate`), fallback `declaredCf.savingsRate` (= portfolio/snapshot hybrid) |
| `app/api/cashflow/intelligence/route.ts:602-608` | DUPLICATE (guarded fallback) | inline declared rate, only when master snapshot fetch throws |

Census heuristic list (30) contains known false-positive attributions — e.g. `incomeTaxCalculator`,
`medicareLevyCalculator`, `taxPositionCalculator`, `leakDetector` rows match the formula SHAPE
(x/y×100), not this quantity; spot-checked as not-savings-rate at entry level only.

## invariants

1. On any single basis: `rate === (inflow − outflow) / inflow × 100` exactly, with `rate === 0`
   when `inflow === 0` (never NaN/∞).
2. `savingsRateDeclared === quickMetrics.monthlyCashflow / quickMetrics.monthlyIncome × 100`
   (ties this contract to `monthly-cashflow-declared.md`). *(§7 correction: NOT an identity at
   HEAD — `quickMetrics.savingsRate` is computed against the ORCHESTRATOR's `monthlyNetIncome`
   (`cashflowOrchestrator.ts:376-377`, then 2-dp rounded), while `quickMetrics.monthlyIncome` is
   `buildIncomeBreakdown(...).all.netTotal` (`masterFinancialService.ts:1865,:2100`) — a different
   income producer. The identity holds only once income is single-sourced (T1/T6); pin it as a
   POST-migration invariant, with tolerance for the 2-dp rounding.)*
3. D8: full loan repayment in the numerator's outflow on every conformant variant; an IO loan
   never contributes $0 (post-T2).
4. Headline: `basis === 'actual-ttm'` ⟺ `trailingMonthsWithData > 0` and (annualIncome > 0 or
   annualOutgoings > 0); a declared rate is never displayed unlabelled when trailing data exists.
5. Float ≡ Decimal parity for the declared + score twins.
6. Cross-surface parity: Home KPI rate == CFO progress rate == Home insight rate, same snapshot
   (the VR-001 regression class: 75.4% / −30.5% / 0.0% must be impossible).

## independentExpectation

Arithmetic identity from the cashflow contracts' verified fields: for TTM, hand-sum 12 months of
non-transfer IN/OUT and compute `net/in×100`; for declared, from the declared identity. The
0-100 CFO score has **NONE FOUND** as an external expectation — it is a policy mapping,
verifiable only against its own piecewise table (record UNVERIFIABLE in the Number Ledger for the
mapping itself; its INPUT ratio is verifiable as above).

## surfaces

| route | label |
|---|---|
| `/dashboard` (Home) | "Savings rate" KPI tile + detail (`page.tsx:828-837`) and savings insight copy (:489-498) |
| `/dashboard/cfo` | monthly progress rate; CFO score `savingsRate` component (0-100) |
| health surfaces | savings-rate metric (metricAggregation — currently loans-omitted) + master healthScore component value |
| `/dashboard/reports` | income-expense "savings rate" trend chip |
| `/api/portfolio/snapshot` | `cashflow.savingsRate` JSON |

## expectedMoves (written before any migration)

- **D8 relabel: NO numeric movement anywhere** — no savings-rate producer splits
  principal/interest today; explicitly predicted flat.
- scoreCalculator ratio → declared producer: CFO `savingsRate`/`cashflowStrength` components move
  wherever gross≠net income or IO loans exist (`pathPrefix: cfoScore.components.savingsRate`,
  `.cashflowStrength`; direction at census data: DOWN on the income fix, DOWN on the IO fix).
- metricAggregation loans-in (if DR-1 = bug): health savingsRate metric drops by
  `loanRepayments/income × 100` (≈ 12,779/41,303 ≈ 31 points of rate at census figures);
  risk bands shift accordingly.
- masterFinancialService:1413 → read `cashflow.savingsRate`: predicted NO movement (same inputs) —
  strong, falsifiable.
- DR-3 rename (`savingsRate` → `savingsRateCurrentMonth` on the resolveCanonicalCashflow output):
  predicted NO movement (rename only), but every field-path consumer must be enumerated in the
  Phase B PR.

## decisionsRequired

1. **DR-1** (shared with declared contract) — metricAggregation omits loans: bug or named
   pre-debt-service quantity? Health scores move if bug.
2. **DR-3** — the two `savingsRate` fields in `canonicalCashflow.ts` (current-month actual at :87
   vs TTM-first selection at :157) need distinct names per D6; today a consumer destructuring
   `getCanonicalMonthlyCashflow().savingsRate` gets a DIFFERENT window than
   `getCanonicalSavingsRate().rate` with no signal.
3. **DR-12** — should the CFO score's internal ratio adopt the actuals-first headline basis or
   stay declared (a plan-quality score)? Consequence: actuals basis makes the score volatile
   month-to-month; declared keeps it stable but can contradict the displayed headline rate.
4. Decimal twins for the headline accessor + TTM producer: NOT ESTABLISHED — create at T6 or
   record the gap.

## coverageBoundary

Examined: all files in the callSites table plus the two cashflow contracts' examined set.
NOT EXAMINED from the census savingsRate list (30): `leakDetector` internals, `budgetComparison`,
`loanAggregator:131` (debt-metric shape match), `cutSpendCategory`, `InsightWidgets.tsx:520`
(pct helper — shape match), Sankey internals, tax-engine shape-matches (spot-classified as
false positives at entry level only), `calc-audit` fixture engines (test infra), `exporter`.
Unexamined ≠ cleared.

## Adversarial review (§7) — 2026-07-29

- **Claims checked: 26** (anchors 17 · arithmetic 6 · negative-claims 3). At HEAD `72b15268`
  (production identical to `fa392b9a`). Verified exactly: all five variant producers —
  `getCanonicalSavingsRate :157` (selection rule incl. the exact `hasTrailing` condition of
  invariant 4), current-month rate `:87`, TTM producer `moneyStoryTrend.ts:75-77,:88`
  (`savingsRateTrailing = annualNet / annualIncome × 100` per the interface contract), declared
  `cashflowOrchestrator.ts:376-377` + Decimal `:599-601`, CFO score `scoreCalculator.ts:326-341` +
  Decimal `:628` with gross-`i.amount`/ungated/raw-`minRepayment` reduces confirmed (loan reduce at
  `:334`/`:642`). Consumers: `insights:358,:621,:638` (all through the ONE accessor — MON-029 intact),
  `intelligenceEngine:191`, `selfAuditInvariants:128,:227`, `masterFinancialService:2111` +
  `:1413-1416` (inline re-derive + ×5 clamp), `portfolio/snapshot:996-998` hybrid,
  `incomeExpense:41`, dashboard `page.tsx:458,:828-837` (+ insight copy `:489-498`),
  `intelligence:602-608` fallback, `portfolioEngine ~:418` stress rate. DR-3 collision confirmed in
  source (two `savingsRate` meanings in one file, `:43` vs `:157`). Arithmetic re-run:
  12,779/41,303 = 30.9 ≈ 31 points ✓. VR-001 three-rates figures match the in-source comment
  (`canonicalCashflow.ts:146-149`) verbatim. Negative claims: score-mapping `NONE FOUND` stands
  (piecewise policy, no external authority); headline/TTM Decimal twins absent — confirmed.
- **REFUTED / CORRECTED:**
  1. *Invariant 2* — stated as a current identity; refuted: numerator's rate uses the orchestrator's
     `monthlyNetIncome` while `quickMetrics.monthlyIncome` is `buildIncomeBreakdown` netTotal
     (`masterFinancialService.ts:1865,:2100`) — two income producers, plus 2-dp rounding. Re-scoped
     inline as a post-migration invariant. (This is itself evidence FOR the contract's thesis that
     the family collapses only once income is single-sourced.)
- **Could not verify:** the census-list false-positive spot-checks beyond entry level (contract
  discloses this); `leakDetector`/`budgetComparison`/`loanAggregator:131`/Sankey internals
  (boundary-stated); live rates (Ring-3).
- **Verdict impact: none.** Variant naming, canonical accessor status, DUPLICATE tags, and all
  expectedMoves survive; invariant 2 re-scoped from "current" to "post-migration target".
