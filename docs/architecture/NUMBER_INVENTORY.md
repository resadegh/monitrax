# The Number Inventory — every number, one verdict

**The Phase A gate deliverable** (spec: `NUMBER_INVENTORY_SPEC.md`; brief:
`docs/issues/handoffs/CODE_BRIEF_MON-131_PHASE_A_quantity-contracts.md`). Written for Reza:
every line is something to act on. The engineering depth behind every row lives in
`docs/architecture/contracts/` (48 contract files — 45 full-depth Quantity Contracts + 3 register/index documents; every full-depth contract adversarially reviewed by an
independent second agent trying to refute it — §7 of the brief).

**Method + evidence base.** Production tree read at HEAD `2f9f2e16`/`696ec349` (identical for
`lib/ app/ components/ prisma/` — verified). 13 read-only contract agents (one per quantity
cluster, D14) + 5 adversarial refutation agents. Census: **40 quantities · 1,307 formula-shape
sites · 424-function unattributed sweep bucket** (`npm run census:producers -- --list`). Every
rendered value quoted below traces to the golden baseline (`lib/matrix/goldenBaseline.ts`,
`docs/verification/runs/VR-041.md`) — none is invented. NO production code was changed in Phase A.

**Headline counts:** 40 census quantities → **68 named quantities in this report**
(the census under-names: "monthly spending" is five). Of the 45 MON-131 rows:
**5 carry WRONG · 13 carry UNNAMED · 26 carry MULTIPLE · 7 are UNVERIFIABLE-only · 6 are CLEAN.**
One number is **100× wrong on the Home screen today** (Q1). One promised number **does not exist
at all** (Q13). Four health scores are four different questions wearing one name in the UI.

---

## Part 1 — the headline table (worst first)

Verdicts: CLEAN · MULTIPLE · WRONG · UNNAMED · UNVERIFIABLE (spec §3 — no other words).
"Producers" counts live code paths that compute the number; **1 is the target.**

### Wave MON-131 (the original 23 register quantities, expanded to their true names)

| # | Number | What it means | F/D | Prod. | Canonical home | Screens | Verdict | Wave |
|---|---|---|---|---|---|---|---|---|
| Q1 | Loan monthly interest | interest cost of a loan per month, gross | D | ≥3 | NONE — needs a decision (gross-vs-offset-net fork) | ≥3 | **MULTIPLE + WRONG** (live 100×) | MON-131 T2 |
| Q2 | Super caps (concessional / non-conc.) | the legislated per-FY contribution limits | F (legislated) | 5 constant homes | `taxYearConfig.ts` (D12) | 8 | **MULTIPLE + WRONG** (stale $27,500 + stale SG 11.5% live) | MON-131 T4 |
| Q3 | Income tax | tax on taxable income per FY brackets | D | 1 canonical + inline rate hardcodes | `taxPositionCalculator.ts` + Decimal twin | 6+ | **MULTIPLE + WRONG** (abolished 32.5% band still live in one producer) | MON-131 T4 |
| Q4 | PAYG withholding | employer tax withheld from salary | D | 2 quantities under one name | `lib/tax-engine` from config | 4 | **UNNAMED + WRONG** (FY24-25 coefficients hardcoded — stale for FY26-27) | MON-131 T1/T4 |
| Q5 | Budget variance | actual spend vs budgeted, per category | D | 4 different semantics | NONE — needs a decision | 2 live | **UNNAMED + WRONG** (V3's budget side reads storage-blob metadata keys as categories) | MON-131 T7 |
| Q6 | Negative gearing benefit | tax saved by a rental loss | D | 2 (unnamed, divergent zero-rental edge) | NONE — needs a decision | 4 | **UNNAMED + MULTIPLE** (reform engine dormant, 0 callers) | MON-131 T4 |
| Q7 | Net income (after-tax) | income after tax, all sources | D | 5 variants | NONE — D9 decision | many (feeds savings rate, budget, health) | **UNNAMED + MULTIPLE** | MON-131 T1 |
| Q8 | Multi-year wealth projection | net worth projected years ahead | D | **4** (incl. one LLM-invented) | NONE — needs a decision | 5 | **MULTIPLE + UNNAMED + UNVERIFIABLE** | MON-131 T6 |
| Q9 | Savings rate | surplus ÷ income × 100 | D | 5 variants (different denominators) | collapses after Q7/Q16 fixed | 4 | **MULTIPLE + UNNAMED** | MON-131 T6 |
| Q10 | Accessible funds incl. shares | cash + sellable investments (D5's other quantity) | D | 2 (different valuation bases) | NONE — needs a decision | 0 direct (feeds scores) | **UNNAMED + MULTIPLE** | MON-131 T5 |
| Q11 | ABS benchmark expense estimate | a statistical reference for variable spend | D | 1 | `budget-analysis/aiPrompt.ts:311` | 4 (mislabelled) | **UNNAMED** (clean producer laundered as "your budget" on 4 surfaces) | MON-131 T7 |
| Q12 | Per-entity monthly cashflow | each person/entity's slice of household cashflow | D | 1 mechanism, semantics unfixed | NONE — "home entity" NOT ESTABLISHED | 2 | **UNNAMED + MULTIPLE** (Σ slices < household when rows are unowned) | MON-131 T6 |
| Q13 | Budget remainder | net income − committed, to allocate | D | **0** | NONE — never built | 1 (label only) | **UNVERIFIABLE** (the number does not exist; the screen implies it does) | MON-131 T7 |
| Q14 | Survival runway (emergency fund months) | how long you survive if salary stops | D | 1 canonical + 8 dup + 6 diff-qty | `masterFinancialService.ts:1380` (D3/D4 re-founding pending) | 7 | **MULTIPLE** — shows **11.6**, D3/D4 derivation gives **≈72.6** | MON-131 T6 (MON-132) |
| Q15 | Monthly cashflow — declared basis | income − expenses − loans from declared rows | D | multiple | `cashflowOrchestrator.ts` (post-fix) | 3 | **MULTIPLE** (silently drops IO loans + NULL-frequency loans) | MON-131 T6 |
| Q16 | Monthly cashflow — canonical (actuals) | what actually happened last month(s) | D | 1 canonical + declared leaks | `getCanonicalMonthlyCashflow` | 4 (Home −$6,073/mo) | **MULTIPLE** | MON-131 T6 |
| Q17 | Property cashflow | per-property income − costs, actuals-first | D | 1 canonical + 2 live re-derivations | `computePropertyCashflow` | 5 | **MULTIPLE** (was believed CLEAN; adversarial pass overturned) | MON-131 T5 |
| Q18 | Property rental yield | rent ÷ value % | D | 1 + 4 | `lib/utils/calculations.ts:43` | 6 | **MULTIPLE** | MON-131 T5 |
| Q19 | Property equity | value − attached loans | D | 2 named + 5 inline dup | per-property `calculateEquity:33`; aggregate needs naming | 6 | **MULTIPLE** (+ RENTAL rows forced to $0 value — collides with D10) | MON-131 T5 |
| Q20 | Assets / liabilities breakdown | classed totals behind net worth | D | canonical + 3 dup + 2 wrong-input | `netWorthCalculator.ts` + twins | 5 | **MULTIPLE** | MON-131 T5 |
| Q21 | Net worth | Σ assets − Σ liabilities | D | 1 + 1 dup + 3 diff-qty | `calculateNetWorth:239` + twin | 5 ($3,401,782) | **MULTIPLE** | MON-131 T5 |
| Q22 | Liquid cash (deployable) | cash + at-call only (D5) | D | 1 + 4 gross variants | `liquidCash.ts:63` + twin | 6 ($301,808) | **MULTIPLE** | MON-131 T5 |
| Q23 | Monthly recurring expense run-rate | declared recurring spend per month | D | canonical + dup | `monthlyRunRate` (frequencies.ts) | many | **MULTIPLE** (MON-135 precondition blocks the gate) | MON-131 T3 |
| Q24 | Monthly committed | recurring + loan costs | D | inline producer, no named engine | NONE — needs naming (D-A fork) | 3 | **MULTIPLE** | MON-131 T3 |
| Q25 | Trailing-12-month actual spend | real spend, 12-mo window | D | 2-producer split | `actualCashflow.ts` | 3 | **MULTIPLE** (register row actually traces to a trailing-3 engine — mislabel) | MON-131 T3 |
| Q26 | Current-month actual spend | this calendar month's real spend | D | 1 + sign-divergent sibling | `actualCashflow.ts` | 2 | **MULTIPLE** | MON-131 T3 |
| Q27 | Trailing-3-month average spend | real spend, 3-mo average | D | 1 + a fifth semantic found | `moneyStoryTrend.ts:88` | 3 | **MULTIPLE** | MON-131 T3 |
| Q28 | Income run-rate (gross) | declared pre-tax income per month | D | 2 semantics | `incomeAggregator.ts` (after T1) | 5 | **MULTIPLE** (orchestrator feeds it annual amounts as frequencies) | MON-131 T1 |
| Q29 | Income taxable input | the income figure fed into tax | D | T-A canonical + T-B/T-B′ | `taxPositionCalculator` intake | 3 | **MULTIPLE** | MON-131 T1/T4 |
| Q30 | Salary take-home pay | net pay after tax+levy+offsets | D | 2 formulas in one module (LITO fork) | needs collapse | 2 | **MULTIPLE** | MON-131 T1 |
| Q31 | Taxable income | assessable − deductions | D | 1 canonical + 2 live dup | `taxPositionCalculator.ts:311` + twin | 4 ($172,325) | **MULTIPLE** | MON-131 T4 |
| Q32 | Deductions | per-FY deductible aggregate | D | 1 + 2 dup | `taxPositionCalculator` + twin | 3 | **MULTIPLE** | MON-131 T4 |
| Q33 | Loan monthly cost (resolved) | actuals-first loan repayment cost | D | 1 canonical + dup (census was 5 sites short) | `resolveLoanMonthlyCost` | 7+ | **MULTIPLE** | MON-131 T2 |
| Q34 | Loan required minimum repayment | amortised P&I minimum | D | 5 | `calculatePIRepayment:84` | 3 | **MULTIPLE** (→ MON-136 loanAmortisation) | MON-131 T2 |
| Q35 | Depreciation | Div 40/43 schedule per property | D | canonical + method-divergent sibling (~4×) | D11 contract in the type | 4 | **MULTIPLE** | MON-131 T4 |
| Q36 | Overall financial health score | 7-domain whole-position score (Home's **54**) | D | 1 (+1 breakdown dup) | `aggregateEngine.ts:373` | 3 | **UNVERIFIABLE** (policy score — no external law; engine single-sourced) | MON-131 T6 |
| Q37 | Snapshot health score | 4-ratio A–F report card | D | 1 (+1 dup) | `masterFinancialService.ts:1404` | 3 | **UNVERIFIABLE** (+ UI calls it "Financial health" — collides with Q36's name) | MON-131 T6 |
| Q38 | Cashflow health score | cash-operations gauge | D | 1 | `healthScoreAggregator.ts:248` | 1 | **UNVERIFIABLE** | MON-131 T6 |
| Q39 | Safety net score | shock readiness (Safety Net's **63**) | D | 1 | `safetyScore.ts:59` | 1 | **UNVERIFIABLE** (15 of 100 points are a declared placeholder) | MON-131 T6 |
| Q40 | Daily cash balance forecast (CFE) | day-by-day projected balances | D | 1 cluster | `lib/cashflow/forecasting.ts:42` | **0** — route has no fetcher | **UNVERIFIABLE** (dead route; siblings /insights /strategies also orphaned) | MON-131 T6 |
| Q41 | Next-month spend forecast | predicted next-month outflow | D | 1 | `lib/tie/analytics.ts:378` | **0** — sole fetcher discards the field | **UNVERIFIABLE** (render-dead; honest refuse-to-compute present) | MON-131 T6 |
| Q42 | Medicare levy | 2% levy per config thresholds | D | 1 + twin | `medicareLevyCalculator.ts:55` | 6 ($2,909) | **CLEAN** — the proof the architecture works | done |
| Q43 | Land tax | per-state schedule on land value | D | 1 + twin (×2 named quantities) | `stateLandTax.ts:374` | 3 | **CLEAN** | done |
| Q44 | Loan declared minimum repayment | what the user/bank asserted | **F** | n/a (FACT) | `Loan.minRepayment` row | many | **CLEAN** (reclassified FACT; never derive from it without the resolver) | done |
| Q45 | Projected month-end balance (linear) | balance + net/30 × days | D | 1 (+1 STALE Decimal twin) | `canonicalCashflow.ts:189` | 3 | **CLEAN** (twin drift is a precondition, P4) | done |

Also CLEAN as of this week: **health score trend** — real stored snapshots only (PR #1532);
random-history fabrication deleted; acceptance = Matrix relay A3 CLEAN run (MON-134, still FIXING).

### Wave MON-136 (the 16 blind-spot families — register-entry depth, contracts to come)

| # | Family | Prod. | Canonical home | Verdict | Notes |
|---|---|---|---|---|---|
| R1 | CGT (discount/events) | ≥5 | `cgtDiscount.ts:166` | **MULTIPLE + WRONG** | one path applies the 50% discount with NO 12-month ownership check (`taxIntegration.ts:189-204`) |
| R2 | Insurance adequacy | 0 real | NONE — never built | **WRONG + UNNAMED** | `metricAggregation.ts:447` hardcodes `insuranceGapsScore = 70` and shows it as a scored metric |
| R3 | Investment returns | ≥4 | NONE | **MULTIPLE + UNNAMED** | several conflated return concepts |
| R4 | Property valuation growth | ≥3+1 | NONE / `forecastEngine:244` | **MULTIPLE + UNNAMED** | historical vs projected conflated |
| R5 | Freedom horizon | 4 | NONE | **MULTIPLE + UNNAMED** | four near-match producers |
| R6 | GST (BAS vs receipt) | 2 | `gstCalculator.ts:104`; receipt NOT ESTABLISHED | **MULTIPLE** | two distinct quantities |
| R7 | Tax offsets / franking | 3–4 franking | offsets `taxOffsets.ts:178`; franking NOT ESTABLISHED | **MULTIPLE** | |
| R8 | Loan amortisation | 5 | `calculatePIRepayment:84` | **MULTIPLE** | zero-rate P&I edge diverges between producers |
| R9 | Super projection | 2 | `wealthCheck/calculator.ts:98` | **MULTIPLE** | |
| R10 | LVR / gearing | 4 LVR + 1 | `calculateLVR:9` | **MULTIPLE** | its comment claims "single source" while 3 live re-derivations exist |
| R11 | Stamp duty | 1 | `stateStampDuty.ts:285` | **CLEAN** | shared `value−min+1` off-by-one-dollar quirk in both twins (flagged, not fixed) |
| R12 | PSI attribution | 1 | `psiClassifier.ts:151` | **CLEAN** | |
| R13 | Div 293 | 1 | `highIncomeSuperTax.ts:77` | **CLEAN** | config-driven, D12-compliant |
| R14 | FTE/IEE elections | 1 | `fteIeeClassifier.ts:166` | **CLEAN** | |
| R15 | Money-story margin | 1 trend | `moneyStoryTrend.ts:88`; margin% inline | **CLEAN + UNNAMED** (margin %) | |
| R16 | Budget variance | — | — | — | folded into Q5 (full-depth contract exists) |

### Wave MON-136 — 23 new quantities from the 424-function unattributed sweep

Register-entry only (`mon136-unattributed-sweep.md`); verdicts provisional except the five
verified risky ones:

| Proposed quantity | Provisional verdict | The one-line reason |
|---|---|---|
| Investment account value | **MULTIPLE** (verified) | detail page uses `currentValue ?? units×avgPrice`, list page + risk radar use `units×avgPrice` only — same account, two values (the MON-028 class) |
| Refinance savings | **MULTIPLE** (verified) | flat-$1,500 switching-cost model vs 2%-of-balance model — two break-evens for one loan |
| Dividend yield | **MULTIPLE** (verified) | real grossed-up dividends vs an invented 4%/2% estimate by franking status |
| Transaction match confidence | **MULTIPLE** (verified) | ≥8 independent amount-match scorers, each with private tolerances, despite a declared "THE one tolerance" |
| Debt quality breakdown | **UNNAMED** (verified) | good/bad-debt split + weighted rate computed inside a dashboard component, no `lib/` home |
| 18 further (unrealised gain, parcel cost base, Div7A deemed dividend, trust top-up tax, SMSF exposure, super guarantee, spending volatility, document extracted amount, portal billing, rental agent gap, stress resilience, money leak, wealth-check estimate, budget scenario total, projected month-end, safety score components, distribution sum check, benchmark estimate) | UNVERIFIABLE (register-entry) | named + sited in the sweep; full contracts when MON-136 opens |

---

## Part 2 — the violations, in detail

Compressed to what Reza needs to decide; the full producer maps, invariants and expectedMoves
are in each quantity's contract file. Every `file:line` below was verified at HEAD by a second,
adversarial agent.

### Q1 — Loan monthly interest: 100× WRONG on the Home screen today
- **Where:** `components/dashboard/EntityCashflowSummary.tsx:693` computes
  `principal × (interestRate/100)/12` — but its feed (`app/api/portfolio/snapshot/route.ts:852`)
  passes the schema rate as a **decimal** (0.0625), not a percent.
- **What it computes instead:** divides an already-decimal rate by 100 → the widget's per-entity
  interest estimate and its tax-benefit line are **100× too small**.
- **What Reza sees today:** the Home "Entity Cashflow" widget's interest/tax-benefit figures
  (specific rendered values not captured in the golden baseline — Part F should capture them
  next run).
- **What it should be:** `principal × rate/12` with the decimal rate: a $500k loan at 6.25%
  shows ≈ $2,604/mo, not ≈ $26/mo. Derivation: 500,000 × 0.0625 ÷ 12 = 2,604.17.
- **Blast radius:** that widget only — but it is on Home. The other producers
  (`loanCosts.ts` interest floor; `loanDecisionSupport.ts:713`) use the correct unit, which is
  exactly how MULTIPLE producers hide a WRONG one.
- **Fix route:** Tranche 2 (loan family) — delete the widget's inline formula, read the resolved
  producer. This is also the case for the D11-style **rate-unit contract in the type**.

### Q2 — Super caps: stale legislated constants live in five homes
- **Where (canonical):** `taxYearConfig.ts` (D12). **Duplicates:** capTracker local tables
  (with a silent `||30000` fallback and **no FY2026-27 row**), `benchmarks.ts:122`,
  `savingOpportunities.ts:56`, what-if page `:419-420`. **Stale live:** `$27,500` at
  `intelligence route :464`; **SG 11.5%** at `savingOpportunities.ts:162` and
  `income/page.tsx:357/:566` (current SG is 12%).
- **What Reza sees today:** any surface fed by the stale sites understates caps/SG. The what-if
  super lever's wedge on $150k gross is **$12,750 → $12,000 (−$750, ≈$112.50/yr tax benefit)** —
  the contract's first draft overstated this ~9×; the adversarial pass corrected it, which
  matters because the golden-diff gate must expect the right-sized move.
- **Worse:** `income/page.tsx:566` **writes** the stale 11.5% onto Income FACT rows —
  a data poisoning, not just a display bug (precondition P2).
- **Fix route:** Tranche 4 — one constant home (config), delete the other four, then re-stamp or
  re-derive the poisoned rows (Reza decision D-16 in §5.1).

### Q3 — Income tax: an abolished bracket still computing
- **Where:** canonical engine is correct (`taxPositionCalculator.ts` + twin; golden set
  reconciles: taxable $172,325 → tax $37,786). But `lib/depreciation/schedule.ts:72,145` still
  computes `taxSavingAt32_5Percent` on the **abolished 32.5% band**;
  `investmentDecisionSupport.ts:297` hardcodes `× 0.37`; `tax/page.tsx:749` re-implements
  deduction savings inline.
- **A trap for Phase B, found by the adversarial pass:** `netTax ≥ 0` is **not** a valid
  invariant — refundable franking credits legitimately drive netTax negative
  (`taxOffsets.ts:444-450` floors only non-refundable offsets). A test asserting it would
  reject correct refunds.
- **Fix route:** Tranche 4 — marginal-rate lookups only from the engine; delete the three
  hardcoded sites.

### Q4 — PAYG withholding: two numbers wearing one name, on stale coefficients
- **Where:** the withholding **schedule** quantity and the **estimate** quantity are computed
  as if one; the schedule coefficients are **hardcoded to FY24-25**.
- **What Reza sees today:** PAYG figures on income/tax surfaces ($11,129 in the golden set;
  refund identity 11,129 − 37,786 = −26,657 reconciles) — but computed on last-FY coefficients.
- **Fix route:** Tranche 1/4 — name both quantities; move coefficients into `TAX_YEAR_CONFIGS`
  with the same per-FY discipline as brackets.

### Q5 — Budget variance: four semantics, and the live one reads garbage
- **Where:** V1 `masterFinancialService:983/:1160` (no web consumer) · V2 `cashflow/summary:181`
  (→ Gemini prompt) · V3 `intelligence/route.ts:310/:322` (→ GlassBudgetTile, statuses
  OVER/UNDER/ON_TRACK at ±10% — no WARNING tier) · V4 `lib/bank/budgetComparison.ts:37-46`
  (four-tier scale, dead exports).
- **What V3 computes instead (WRONG at HEAD):** `buildBudgetComparison` runs `Object.entries()`
  over stored analysis **blobs**, so the "budgeted" side of the rendered tile is built from
  blob **metadata keys** (`generatorVersion`, `committedTotal`, …), not per-category amounts
  (route `:268-283` vs generate `:274-293`).
- **What Reza sees today:** the GlassBudgetTile's budget-vs-actual comparison — its budget side
  is not a budget.
- **Fix route:** Tranche 7 — pick the surviving semantic (§5.1), fix the V3 input shape, delete
  V4's dead exports.

### Q6 — Negative gearing: the live number is unnamed and disagrees with itself
- **Where:** live benefit computed at `taxIntegration.ts:114` and (differently at the
  zero-rental edge) inside `taxPositionCalculator.ts` `generateRecommendations:446` — CFO can
  show a benefit while the tax page shows none. The purpose-built reform engine
  (`applyNegativeGearing:152` + twin `:346`) has **zero production callers**.
- **Fix route:** Tranche 4 — name `netRentalLoss` and `negativeGearingTaxBenefit`, single
  producer each; explicitly wire-or-park the dormant engine **before** any reform flag flips.

### Q7 — Net income: five different answers to "what do I earn after tax"
Five variants confirmed distinct line-by-line (contract `income-net-run-rate.md`); the register
invariant `net ≤ gross` is not enforceable until one survives. **This is D9 — Reza's call, §5.1.**
Blast radius: savings rate (Q9), budget (Q13), health inputs, quickMetrics.monthlyIncome.

### Q8 — Multi-year wealth projection: four producers, one of them an LLM
`forecastEngine:101` (8% growth, fabricated defaults: age 35/$100k when data missing —
MON-134 class) · `calculateForecastMetrics:483` (5%, non-compounded) · `timeHorizonAnalyzer:40`
(7%, silent defaults age 30/$5k/25×) · **P6, found adversarially:** `financialAdvisor.ts:356`
has **Gemini invent the projections** in prose (prompt: "property ~5%, investments ~7-8%"),
wired to live `POST /api/ai/advisor`. Fix route: D-F4/D-F5 (§5.1) — one named engine, one
assumptions config, all four disposed of explicitly.

### Q14 — Survival runway: the screen says 11.6 months; the decided definition says ≈72.6
- **What Reza sees today:** Safety Net shows **11.6 months** ($301,808 ÷ $25,973 — liquid over
  ALL monthly spend).
- **What it should be (D3/D4, already decided):** survival = liquid ÷ (essential spend incl.
  loan repayments − salary-independent income) = $301,808 ÷ ($14,261 − $10,102) =
  $301,808 ÷ $4,159 = **72.57 months**. Every input pinned to the golden baseline; recomputed
  independently by the adversarial reviewer.
- **Also:** 8 duplicate + 6 different-quantity producers; zero-burn edge renders **12** on one
  surface (`metricAggregation:171`), **999** on reports (`contextBuilder:236`) — three
  different answers to "you spend nothing".
- **Fix route:** MON-132 (T6). Precondition P7: the $10,102 salary-independent figure must trace
  to a named producer first.

### Q15/Q16 — Monthly cashflow: the declared basis silently drops loans
`masterFinancialService.ts:1927` filters out loans with `minRepayment=0` (every interest-only
loan) — and, found adversarially, also drops `minRepayment>0` rows with NULL
`repaymentFrequency`. Corrected move mechanics: removing the filter alone moves **$0** for IO
loans (`toMonthly(0)=0`); the ≈$3,709/mo correction only lands when the feed adopts the
resolver's interest floor. Home headline −$6,073/mo (VR-041) is the actuals-basis number and
stands.

### Q17 — Property cashflow: "already clean" didn't survive review
The engine is canonical and single — but the properties **list page's detail dialog** (live via
row-click `:641` / Eye `:672`) re-derives annual/monthly cashflow inline
(`properties/page.tsx:1196-1216, :1407-1430`): no one-off exclusion, raw `minRepayment`
(IO→$0), per-row `monthlyAverageActual`. And `portfolioEngine.ts:783-784` is a further live
declared-basis producer. Phase B has real migrations here after all.

### Q19 — Property equity: the definition fight is upstream of the fix
Per-property helper is canonical; 5 inline duplicates. But `properties/page.tsx:812-813`
**forces `currentValue: 0` on RENTAL rows** ("I'm renting" semantics), while D10 says rentals
are included — so applying D10 to form-shaped data moves ≈nothing. The decision is semantic,
not mechanical (§5.1).

### Q31/Q32 — Taxable income & deductions: two missed live duplicates each
Found adversarially after the contracts mis-dismissed one as a false positive:
`portfolio/snapshot/route.ts:964-970 + :1089-1091` re-derives taxable income and deductible
expenses (unfloored, no taxability engine, no one-off gate) inside the snapshot's TAX EXPOSURE
block; `reports/generators/incomeExpense.ts:20-21` re-derives both for the report renderer.

### Q36–Q39 — Four health scores, one label
Four engines, four genuinely different questions (D13 verified: no engine collision) — but the
UI names two of them "Financial health". Home shows **54** (Q36), Safety Net shows **63**
(Q39). Not a bug to reconcile — a naming decision (§5.1). All four are policy scores:
**UNVERIFIABLE is their permanent, honest verdict** — they can be single-sourced and
deterministic, never externally "correct".

### Q40/Q41 — Forecast numbers nobody can see
The CFE daily-balance stack (`/api/cashflow`, `/stress-test`, plus siblings `/insights`,
`/strategies`) has **zero fetchers** — confirmed by hostile grep. `cashflowInsight` rows are
never written. Next-month spend forecast is computed and then **discarded by its only fetcher**
(`activity/page.tsx:624` reads only `transactionCount`, and passes `from=startOfMonth`, which
guarantees the refuse-to-compute state). Keep-or-kill is D-F3 (§5.1).

### R1 — CGT: discount without the ownership test
`taxIntegration.ts:189-204` applies the 50% CGT discount with **no 12-month holding check** —
demonstrably incorrect against Div 115-25 ITAA97. Full contract comes with MON-136; flagged now
because it is a correctness (WRONG) item, not a duplication item.

### R2 — Insurance adequacy: a score that was never computed
`metricAggregation.ts:447`: `const insuranceGapsScore = 70` — a hardcoded placeholder rendered
as a scored metric. The §19 false-number class. Build it or remove it (§5.1).

---

## Part 3 — the three lists

### 5.1 Decisions required (one line each; nothing here was chosen by an agent)

**Definitions (which number is THE number):**
1. **D9 / net income (Q7):** one after-tax definition across all sources, or rename the five
   variants? Consequence: savings rate, budget and health inputs all shift together.
2. **Savings rate (Q9):** which denominator — net income or gross? (Five variants today.)
3. **Home-entity cashflow (Q12):** what does the "household/home" slice mean when rows are
   unowned? (Today unowned rows silently vanish from every slice.)
4. **Loan monthly interest (Q1):** gross interest, or net-of-offset? Both are defensible; each
   needs its own name if both survive.
5. **Monthly committed (Q24):** essential+loans (as implemented) or all-recurring+loans (as the
   register row says)?
6. **Budget variance (Q5):** V1, V2 or V3 semantics survive? (V4 is dead code to delete.)
7. **Budget remainder (Q13):** build it (net income − committed, three allocation modes,
   MON-127) or remove the promise from the screen?
8. **ABS benchmark (Q11):** relabel the four surfaces that present it as "your budget"?
9. **Property equity aggregate (Q19):** mortgage-classified loans or attached-loans as the
   subtrahend? And do RENTAL rows carry value (D10) or stay $0 ("I'm renting")?
10. **Accessible funds (Q10):** shares at cost or at market? Does MANAGED_FUND count?
11. **Liquid-assets naming (Q20/Q22):** rename `breakdown.liquidAssets` or re-found it on D5?
12. **Balances "Cash" tile:** gross accounts or net-of-overdraft?
13. **Runway (Q14):** survivor home — extend the master builder or a pure engine + Decimal twin?
    Does the 6-month target survive the 72.6-month reframe? What does zero-burn render
    (∞/INDEFINITE — killing the 0/12/999 divergence)?
14. **Salary-independent income (Q14):** net or gross rental in the $10,102? (Phase 58 chose
    per-property NET — confirm it binds here.)
15. **Health scores (Q36-39):** four distinct UI names; retire or keep the portal's
    snapshot-score label; CFO buffer months — do loans count as essential (D4 says yes,
    `scoreCalculator:210` says no)?
16. **Super/SG re-stamp (Q2):** stored `superGuaranteeRate=0.115` and writer-derived gross/net
    on Income rows — re-stamp, re-derive on read, or leave-and-flag?
17. **NG zero-rental edge (Q6):** CFO's answer or the tax page's? And wire-or-park the dormant
    reform engine?
18. **Historical caps (Q2):** carry-forward needs FY2019-20+ caps; config starts 2023-24 —
    extend config or refuse-to-compute pre-2023 carry-forward?
19. **PAYG (Q4):** adopt per-FY coefficient tables in config (same discipline as brackets)?
20. **Depreciation method (Q35):** which METHOD default survives (~4× divergence: $474.61 vs
    $2,000 in the worked example)?
21. **Multi-year projection (Q8):** which of the four producers survives; one assumptions
    config (D-F5); fabricated-defaults policy — refuse-to-compute or explicit assumptions
    (D-F6); and the LLM-invented projections (P6) must be disposed of explicitly.
22. **Dead forecast stack (Q40/Q41):** delete the CFE/stress/insights/strategies routes + the
    never-written `cashflowInsight` table, or build the UI? (Its ring2 route test retires with
    it.)
23. **Yield (Q18):** portfolio-average yield feed — declared rent or engine rent? Yield-on-cost
    fallback (purchase price) — keep under its own name or drop? The invented 4%/2% dividend
    yield — delete or replace with real grossed-up data?
24. **Duplicate break-even producer (D-F2):** `cashflow/route.ts:237` vs
    `intelligence/route.ts:509` — name or delete.
25. **Insurance adequacy (R2):** build the metric or remove the hardcoded 70.
26. **Investment account value (sweep):** is `currentValue` authoritative when present, or is
    `units × avgPrice` the rule? (Today: different screens, different answers.)
27. **Refinance savings (sweep):** flat-$1,500 or 2%-of-balance switching costs?
28. **MON-136 wave scope:** confirm the 23 proposed new quantities from the sweep become
    register rows (names are proposals, not decisions).

### 5.2 Preconditions — fixes that cause harm if applied in the wrong order

| # | Precondition | Why the order matters |
|---|---|---|
| P1 | **MON-135** — the AI categoriser writes `isRecurring=false` on everything (`aiCategorisation.ts:90/:203/:249/:365`) | applying the one-off gate first zeroes every AI-categorised expense, and the golden baseline would absorb it as an "expected" downward move |
| P2 | `income/page.tsx:566` **writes** stale SG 11.5% onto Income FACT rows | migrating readers to config doesn't fix already-stamped rows; re-stamp decision (§5.1 #16) comes first |
| P3 | `income/page.tsx:356-364` invents gross=annual/0.7, net=×0.7, payg=×0.30 on save | any income single-sourcing on top of poisoned FACTs launders the poison |
| P4 | Stale Decimal twin `calculateProjectedMonthEndBalanceDecimal` (`intelligenceEngine.ts:365`) + its calc-audit fixture + `tests/cfo/actions-ai-intel.decimal.test.ts:23` encode the pre-MON-021 formula | "Float and Decimal twins migrate together" — this pair is already split; touching the file first re-breaks MON-021 |
| P5 | `save-choice/route.ts:93` stores 'minimum' = recurring + minimumScenario.total (2× committed post-MON-125); `:99` double-counts; `:136` drops discretionary; `latest/route.ts:26-32` serves v1 blobs with no `generatorVersion` gate | budget fixes on top of stored 2×-committed blobs verify against garbage |
| P6 | `getConcessionalCap('2026-27')` silently falls back `||30000` (capTracker tables have no FY26-27 row) | a config migration that misses capTracker "works" while serving the fallback |
| P7 | The runway's $10,102 salary-independent income has no named producer | MON-132 build would hardcode an untraced number — the exact sin the programme exists to kill |
| P8 | `cashflowOrchestrator.ts:147/:505` passes **annual amounts** with a frequency label (`toMonthly(annual, freq)`) | income single-sourcing must fix the feed before pointing more consumers at it |
| P9 | Loan rows have no cadence-plausibility guard (the rent-style `rentCadenceSuspect` guard has no loan sibling) | migrating loan surfaces to declared values inherits mis-cadenced FACTs silently |
| P10 | `forecastEngine.extractCurrentState` fabricates inputs (35yo/$100k) and books `monthlySurplus×12` as a cash asset | it must never be picked as the Q8 survivor as-is |
| P11 | `netTax ≥ 0` is NOT a valid invariant (refundable franking) | a Phase B invariant suite asserting it would reject legitimate refunds |
| P12 | Orchestrator rounds per-field to 2dp | "exact" cross-surface identities must be tolerance-pinned on Float, exact only on Decimal twins |

### 5.3 Wrong inputs — correct formulas over bad data

| # | Wrong input | Where |
|---|---|---|
| W1 | Fortnightly rent stored as monthly (~×2.17) — MON-001, archetype; actuals path guarded, declared fallback + `propertyAnalyzer` exposed | `Income` rows |
| W2 | Income FACT rows carry writer-invented gross/net/payg (P3) and stamped SG 11.5% (P2) | `Income` rows |
| W3 | Snapshot feed passes decimal rate; widget assumes percent (the Q1 100×) | `EntityCashflowSummary:693` |
| W4 | `portfolioEngine.calculateNetWorth` omits `investmentAccounts` entirely (AI/strategy totals miss investment cash) | `portfolioEngine.ts:314-321` |
| W5 | Gearing ratio omits personal loans | `portfolioEngine.ts:444` |
| W6 | `insightsEngine:648` uses gross accounts total as "cash" for buffer months | insightsEngine |
| W7 | Liquid filters omit the `CASH` account type | riskRadar, balances page |
| W8 | availableForDebt understated ≈$12,779/mo by loan double-subtraction; a third net-income producer at `:166-184`; deficit clamped `max(0,…)` | `debt-planner:344`, `ai/debt-analysis:206` |
| W9 | RENTAL property rows forced to `currentValue: 0` | `properties/page.tsx:812-813` |
| W10 | Zero-burn sentinels: 12 / 999 / 100-50 on three surfaces | `metricAggregation:171`, `contextBuilder:236`, `scoreCalculator:208` |
| W11 | 30-year remaining term assumed in stress tests; age-30/$5k/7% defaults in time-horizon | `stressTesting.ts:263`, `timeHorizonAnalyzer` |
| W12 | V3 budget comparison reads blob metadata keys as categories (Q5) | `intelligence/route.ts:268-283` |
| W13 | Stamp duty brackets share a `value−min+1` off-by-one-dollar quirk (both twins) | `stateStampDuty.ts:104+` |
| W14 | CFE input reads raw `minRepayment` as monthly (IO→$0) | `buildCFEInput.ts:115` |

---

## Part 4 — what this report does not cover

**The census heuristic (v1) has known blind spots, now itemised:** single-line `nearArith`
windows miss top-level constants (it missed both live negative-gearing producers); the
`'liquid'` signature missed `loanDecisionSupport.ts:631`; the loan-cost site list was 5 sites
short (`buildCFEInput`, `DebtQualityWidget`, `budget-analysis/generate`, `ai/debt-analysis`,
`propertyActuals`); `portfolioEngine`/`financialAdvisor`/the properties-dialog blocks sat
outside the yield/cashflow site lists; 2 of 6 yield census hits are "cur-RENT" regex false
positives; superCap had 6/10 false positives. Every gap found was added to the relevant
contract; the heuristic itself is Phase A0 §2.3 residual work.

**Read vs not read:** ~75 of the 424 unattributed functions were read in source; ≈95 were
classified by name only; ≈250 are verified false positives; the sweep names every unexamined
cluster. The forecast family has **25 units NOT EXAMINED** (named in
`forecast-flows-index.md`; corrected tally 33·9·3·25 = 70). MON-136 families were examined at
register depth, not full depth — e.g. CGT 12 of 98 census sites read, LVR 8 of 39. The
cashflow-intelligence route's ~600-line HealthScoreInput assembly was not read (flagged for
the Phase B file owner).

**Static-only:** no code was executed; no database was queried. Rendered values quoted are
solely those pinned in the golden baseline / VR-041. Two claims are therefore
behaviour-untested: the CFE dead-route finding (grep-proven, not runtime-proven) and every
"what Reza sees" line for screens without a captured Part-F value.

**Registry anchor drift (the ~⅓ the brief predicted):** confirmed and corrected in contracts —
`aggregateEngine.ts:343→:373`, D13's `masterFinancialService:1434→:1404`,
`lever.ts:88→benchmarks.ts:122`, MON-045's rootCause now a tombstone (`:459`), the calc-audit
shadow citing `intelligenceEngine.ts:240-265` for a formula the code no longer computes,
`PHASE_11_REFERENCE.md` line counts stale. The register's **trailing-12 row is mislabelled** —
it traces to the trailing-3 engine (`moneyStoryTrend.ts:88`; 301,808 ÷ 25,973 = 11.62 evidence
chain in the contract).

**Adversarial coverage:** all 42 full-depth MON-131/forecast contracts were adversarially
reviewed (5 independent agents; ~200 anchors re-verified; 8 contracts materially corrected;
2 verdicts overturned/strengthened). The MON-136 register and the unattributed sweep were
**not** adversarially re-verified (register-entry depth per the brief).

**Not in this report's scope:** non-financial numbers (auth/session/telemetry counts),
formatting-only code, and the Neomatrix's non-financial blind spots (Part 21.5's honest scope).

---

## What "done" looked like (spec §7 checklist)

- Every number: 45 MON-131 rows + 16 MON-136 families + 23 sweep proposals, each with a verdict
  from the five-word vocabulary. ✅
- Every non-CLEAN verdict carries `file:line` + the actual arithmetic + an independent
  expectation or an explicit UNVERIFIABLE. ✅ (depth in the contract files)
- 28 decisions in §5.1, plain English. ✅
- 12 preconditions in §5.2 — **before** anything migrates. ✅
- The §6 boundary is specific enough to be checked. ✅

**Stated counts:** 40 census quantities · 1,307 formula-shape sites · 424-function sweep bucket ·
**68 named quantities** in this report · 48 contract files (45 quantity + 3 register/index; count corrected 2026-07-30, ledger drift log D6) · unmeasured-by-signature: **0**
(structurally empty; the honest boundary is the v1-heuristic misses itemised in Part 4).

Reza reads this, makes the §5.1 calls, and only then does Phase B write a single line.

---
*Assembled 2026-07-29 by the Phase A orchestrating session from 13 contract agents + 5
adversarial agents. Sibling artefacts: `docs/architecture/contracts/*` (the engineering depth),
`docs/architecture/REFERENCE_NUMBERS.md` (the register), `REFERENCE_NUMBERS_DESIGN.md`
(decisions D1–D16).*
