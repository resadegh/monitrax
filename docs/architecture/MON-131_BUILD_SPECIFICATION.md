# MON-131 — Build Specification

**The design of record for all seven tranches. Written before the build, not during it.**

> **Reza's directive, 30 July 2026:** *"it is integral that you have a real comprehensive reference
> document for the design and steps in advance."*

---

## §0 Why this document exists

The Matrix was composing per-tranche briefs as each tranche came up. **That drifts**, and the proof
arrived immediately: while writing the Tranche 1 brief, the Matrix discovered that the **PAYG
withholding coefficient tables had to move forward from Tranche 4** — a banked salary cannot be
computed without them. That is a cross-tranche dependency which should have been visible when the
tranche order was set, not found by accident one tranche in.

**Writing all seven now forces the sequencing conflicts into the open before any code moves.**
Six more were found while writing this, listed in §3.

**Every per-tranche brief is a SLICE of this document.** If a brief and this document disagree, this
document wins and the brief is corrected. A brief that introduces scope not specified here is drift,
and must amend this document first.

## §1 The invariant structure of every tranche

Identical for all seven. A tranche is not done until every line is satisfied *and cited* in
`docs/implementation/MON-131_TRANCHE_LEDGER.md` §3.

1. **Contracts in scope** named, with their governing decisions.
2. **Producer plan** — the survivor, its Decimal twin, and every call site as CONSUMER (leave),
   DUPLICATE (delete, citing the contract entry that authorises it), or DIFFERENT-QUANTITY (rename,
   keep).
3. **New FACT fields**, each with an intake path and an **undetermined state**. No default that
   asserts a position.
4. **Invariants** promoted to permanent tests.
5. **`expectedMoves` computed**, not estimated — run old and new producers over the same real data
   through the relay; the difference *is* the declaration; committed before the migration merges;
   **per path, never directional.**
6. **Regression cluster** unchanged: net worth $3,401,782 · assets $5,461,679 · liquid $301,808 ·
   taxable income $145,426 · tax $37,786 · committed $14,261 · per-loan costs. Undeclared movement
   here stops the tranche.
7. **Census published** as was-and-now, **collapsed separately from deleted-as-dead** (D46).
8. **Ring-3** live, real data, expectation derived from law or arithmetic — never another screen.
9. **Coverage boundary** stated: what was migrated, renamed, deleted, and **what was not touched**.
10. **Neo-sync** and ledger evidence.

**If the baseline diff or Ring-3 fails: revert the merge. Do not patch forward.**

## §2 Which decision governs which tranche

| Tranche | Governing decisions |
|---|---|
| **MON-135** (precondition) | D42 C1 provenance principle; D22's discretionary-flag dependency |
| **T1 income** | D17 banked income · D18 savings rate · D20 layering · D33 per-period resolution · D35 PAYG coefficients *(moved forward)* · D42 C2/C3 HELP cliff and repayment income |
| **T2 loan cost** | D21 net of offset · D26(a) equity on full balance · D18's principal/interest split |
| **T3 expense run-rate** | D22 committed vs essential · MON-135 as a hard precondition |
| **T4 tax + depreciation** | D33 SG · D35 PAYG *(partly consumed by T1)* · D44 Div 43/40 · D41 regime versioning · D12 as extended |
| **T5 balance sheet** | D26 equity + RENTAL split · D27 accessible at market · D28 realisable derived · D29 cash classification · D42 C1 co-owner business carve-out · D42 C4 super thresholds |
| **T6 rates, scores, runway** | D30 two runway quantities · D31 gross flows · D32 health score · D43 availability · D47 insurance |
| **T7 budget remainder** | D24 two-basis remainder · D23 variance survivor · D25 ABS relabel · D45 assumptions config · D46 dead-stack deletion |

D1–D16 are the standing architecture; D19 (provenance) and D6 (named quantities) apply to every tranche.

## §3 Cross-tranche dependency matrix

**The section this document exists for.** Each row is a dependency that would have surfaced mid-build
if the briefs had been written one at a time.

| # | Dependency | Consequence if missed |
|---|---|---|
| **X1** | **PAYG withholding coefficients (D35) must land in T1, not T4.** A banked salary cannot be derived without them, and the current tables are FY24-25 | T1 ships a wrong headline figure and T4 silently corrects it — two number moves for one defect, and the first one looks like the fix |
| **X2** | **HELP repayment income needs the net-investment-loss add-back, which depends on rental losses — a T1 rental output.** So the salary engine consumes a rental figure | Build salary before rental and HELP withholding is computed on an incomplete base. **Within T1, rental must be built before the HELP band is resolved** |
| **X3** | **T2's per-loan principal/interest split is a T1 dependency for the savings rate (D18).** D18 counts principal as saving; that requires the split, which T2 derives | T1's savings rate cannot be final until T2 lands. **Declare the savings rate as moving twice** — once in T1 on the corrected denominator, once in T2 when principal is separated — or T2's move reads as undeclared |
| **X4** | **MON-135 gates T3 absolutely**, and T3's `expectedMoves` must be per-path | A directional "expenses fall" entry absorbs the loss of every AI-categorised expense as expected behaviour. The instrument cannot tell a correct reduction from a wrong one |
| **X5** | **D41 regime versioning is a T4 deliverable but a T5 and T6 dependency.** Property CGT (T5) and projections (T6/T7) both need per-period rules | Build T5 on a value-only config and the CGT engine has no time dimension; it must then be rebuilt when T4's regime work lands |
| **X6** | **The RENTAL type split (D26) is specified in T5 but consumed by T1's rental engine.** A tenanted residence must not produce rental income | T1's rental engine counts a property the user rents *as a tenant* as an income source. **The type split must be brought forward into T1** — specified in T5, but its data model lands earlier |
| **X7** | **D43's availability fact is a T6 deliverable but a T1 rental dependency.** Rental for a vacant property is not simply zero — deductibility and apportionment differ | Without it, T1's rental engine cannot distinguish a genuinely-available vacant property from one not available, and the negative-gearing benefit is undetermined rather than absent |
| **X8** | **The health score (D32) consumes income (T1), expenses (T3) and the runway (T6).** It will move in three separate tranches | Each move must be separately declared. A single "health score moves" entry in T1 would absorb T3's and T6's movements silently |

**X2, X3, X6 and X7 mean Tranche 1 is wider than "migrate `incomeAggregator`".** It carries the
rental type split's data model and the availability fact, and it declares the savings rate as moving
twice. **X8 means no tranche may declare a downstream score's movement as a single entry.**

## §4 The tranches

### MON-135 — categoriser precondition · moves nothing

**Defect:** `lib/ai/aiCategorisation.ts` stamps `isRecurring: false` unconditionally — a default, not
a determination.

**Build:** `isRecurring` is **`null`/absent** where no determination was made, never `false`. Verify
every migrated producer treats **strictly `false`**, not falsy — a falsy check is a second defect of
the same class. Determine recurrence from linked transactions where the evidence exists, **reusing the
intake matcher** — no second heuristic. Remediate existing rows **without overwriting a user's own
marking**: a user's explicit one-off is a FACT, the categoriser's default is not. If the schema cannot
distinguish them, that is a provenance gap and Reza's call.

**Invariants:** the categoriser never emits `isRecurring: false` (assert on the prediction path, not a
mock) · an unset row contributes its full run-rate, an explicitly-false row contributes 0.

**`expectedMoves`: NONE.** This changes what a default means, not what a number is. **Any movement is
itself the finding.**

### T1 — income · moves numbers

**Contracts:** banked income · gross income · net income (renamed) · the four per-source quantities.

**Producer plan.** Layer 1 source engines: **salary** (PAYG withholding per FY schedule + HELP
withholding + salary sacrifice) · **rental** (per-property, agent fees, ownership share) ·
**dividends** (cash only; franking is a Layer 3 offset) · **business distributions** (trust vs
company, PSI). Layer 2 **aggregator**: pure summation. Layer 3 **untouched** — tax stays on the
aggregate.

Delete the `annual × 0.30` PAYG invention (`income/page.tsx:356`). Delete or rename the four rival
income producers, each citing its contract entry. Migrate Decimal twins together.

**HELP withholding.** Nil below $69,528 · 15c per $1 to $129,717 · $9,028 + 17c per $1 over $129,717
to $186,050 · **above $186,050, 10% of *total* repayment income — a cliff.** Repayment income is
**computed**: taxable income (excl. FHSS released) + reportable fringe benefits + total net investment
loss + reportable super contributions + exempt foreign employment income.

**Carried forward by dependency:** X1 the PAYG coefficient tables · X6 the RENTAL type split's data
model · X7 the availability fact.

**Build order within the tranche (X2):** rental → repayment income → HELP band → salary → aggregator.

**New FACT fields:** actual net pay per row · salary sacrifice · HELP-loan-declared flag (absence is
**not** evidence of absence — render undetermined) · property type (owned-and-rented vs tenanted
residence) · availability and available-days per property.

**Invariants:** **`netTotal ≤ grossTotal`** always, Float and Decimal · sources sum to banked income ·
a one-off row contributes 0 to every run-rate · withholding resolves from the row's own period · the
HELP cliff boundary tested in both directions at $186,050 and $186,051.

**Resolve, don't choose:** rental reads $121,227/yr on the Income page and $121,881 on the Tax page.
**Trace both producers.** If they are two quantities, name both.

**Declared moves:** `quickMetrics.monthlyIncome` · savings rate (**and declare it moving again in T2**
per X3) · debt-to-income · health score (**T1's contribution only**, per X8) · the budget
income-sanity guard at `budget-analysis/generate/route.ts:267`.

### T2 — loan cost · moves numbers

**Contracts:** loan monthly interest · per-loan monthly cost · total loan repayments · property equity's
subtrahend.

**Producer plan.** 12 producers reading raw `loan.minRepayment` migrate to
`resolveLoanMonthlyCost` / `totalLoanMonthlyCost`. `moneyFlowService.ts:385`'s
`if (!loan.minRepayment || loan.minRepayment <= 0) continue` is deleted — it is the root of Activity's
"Loans $106K/yr". `buildHealthInput.ts:95` is correct but via its own duplicate interest floor —
migrate it too. **`Loan` has no `isRecurring` field — do not apply the one-off gate to loans.**

**Interest is net of offset (D21).** **Equity subtracts the FULL balance (D26a)** — the asymmetry is
deliberate, because offset cash is already counted as a liquid asset; **write it into the contract so
nobody "fixes" it.** Gross interest survives only as a named scenario input.

**Derive the per-loan principal/interest split.** Never estimate it. This is X3's deliverable and it
makes T1's savings rate final.

**New FACT fields:** deductible portion per loan (mixed-purpose apportionment) · fixed-vs-variable and
break-cost basis · offset-versus-redraw distinction — **a redraw is not an offset**, and treating one
as the other overstates the deduction for the life of the loan.

**Invariants:** Σ per-loan rows == the stated aggregate · an interest-only loan is **never $0** ·
equity uses the gross balance while interest uses the net, both tested · negative equity **never
floored**.

**Declared moves:** Home budget tile Loans $8,817 → the canonical figure · savings rate (X3's second
move) · debt planner · CFO score · risk radar · CFE input · reports · money-flow chart.

### T3 — expense run-rate · moves numbers · **BLOCKED ON MON-135**

**Contracts:** monthly recurring run-rate · monthly committed · monthly essential · expenses by
category.

**Producer plan.** 23 confirmed-exposed Income/Expense reducers across 12 files migrate to
`monthlyRunRate` / `annualRunRate`, Float and Decimal. `contextBuilder.ts:250`'s converter with **no
ANNUAL case** is MON-034's root — delete it. `app/api/safety-net/route.ts:72`'s inline switch goes.

**D22 lands here:** `monthlyCommitted` = all recurring non-loan + canonical loan cost;
`monthlyEssential` = non-discretionary recurring + loan cost, used **only** by the runway. **The
discretionary flag's basis must be defined in the contract** — MON-024 was caused by discretionary and
essential computed on different bases.

**`expectedMoves` per path (X4).** No directional entry. Every category and every consuming surface
declared individually, because a "spending falls" entry is precisely what would hide a wrong reduction.

**Declared moves:** health score (**T3's contribution only**, X8) · risk radar · cashflow orchestrator ·
entity breakdown · reports · money-flow chart · the Home category panel (MON-126's gate never reached it).

### T4 — tax constants + depreciation · moves numbers

**Contracts:** SG rate and contributions · PAYG withholding · income tax · taxable income · Medicare ·
super caps · Div 293 · depreciation (capital works) · depreciation (plant and equipment) · land tax ·
negative gearing.

**The architectural deliverable: regime versioning (D41, extending D12).** The config carries
**per-period RULES, not merely values.** Known switches to model: CGT discount → indexation at
1 Jul 2027 · negative gearing eligibility at 12 May 2026 19:30 with effect 1 Jul 2027 · SG maximum
contribution base quarterly → annual at 1 Jul 2026 · SG payment timing at 1 Jul 2026 · Div 40
second-hand plant at 1 Jul 2017 · vacant land holding costs at 1 Jul 2019 · HELP marginal system at
1 Jul 2026. **Seven switches in eight years — a value-only config will be rebuilt within a year.**

**SG (D33):** re-derive per the row's own period; never store; never re-stamp (0.115 was *correct* for
2024-25). Apply the **maximum contribution base — $270,830 annual for 2026-27**, replacing quarterly
logic. Kill the `|| 30000` fallback; the cap is **$32,500**. Actual contributions from a statement are
FACTS.

**Depreciation (D44):** split into **two named quantities**. Capital works = **2.5% flat over 40
years, straight-line only**, construction from 16 Sep 1987 — **no method choice exists.** Plant and
equipment = a **taxpayer election recorded per asset and LOCKED once made**. Diminishing value uses the
**base-value form**: `base value × (days ÷ 365) × (200% ÷ effective life)`. Immediate deduction at
**$300 or less**; low-value pool **under $1,000**. **Second-hand plant in residential rental: generally
no deduction after 1 Jul 2017** — eligibility is a fact per asset, and it matters more than method.
**Rate-unit contract stated in the type** (the 100× trap). **Where QS schedules exist, ingest them as
FACTS** rather than computing.

**Super thresholds (D42 C4):** bring-forward requires TSB under **$1.84M**; tiering to nil at $2.1M;
carry-forward five years with TSB under $500,000; extend the config to 2021-22 with a **rolling** window.

**Div 293:** threshold $250,000, **computed** with the net-investment-loss add-back — the user is never
asked.

**Invariants:** the same depreciation schedule yields the same annual figure through every path (the
100× guard) · every legislated constant resolves from config, none from a page · a rate's unit is
type-enforced · a regime switch is tested on both sides of its date.

### T5 — balance sheet · moves numbers

**Contracts:** liquid cash · accessible funds · realisable assets · total assets · total liabilities ·
net worth · property equity · per-property equity · LVR and gearing.

**Producer plan.** `computeLiquidCash` canonical (D5). `metricAggregation.ts:129` **stops computing and
starts reading** — renamed to realisable assets, derived as liquid + accessible (D28). Accessible at
**market**, bucketed by **redemption term** (D27). Cash **net of oscillating accounts, gross of credit
cards** (D29, AASB 107 ¶8). Equity on **attached loans at full balance** (D26a).
`portfolioEngine.ts:440` omits personal loans from gearing — fix. `properties/page.tsx:494`'s RENTAL
exclusion is a bug, not a definition (D10/D26b).

**D42 C1 lands here:** co-owner attribution follows **legal interest** *only where the co-owners are
not carrying on a rental property business*. Where they are partners in a business, **the partnership
agreement governs.** Which case applies is a **FACT field**, and the investor case is a *recorded
assumption*, not a silent default (D19).

**Invariants:** liquid + accessible + locked == net worth to the dollar · Σ per-property equity ==
the portfolio hero, negative equity preserved · entity slices + defaults == the total · cost is never
rendered as a value; absent market value renders **VALUE UNKNOWN** (D38).

### T6 — rates, scores, runway · moves numbers

**Contracts:** savings rate · emergency fund months · survival runway · net burn · the four health
scores · insurance adequacy · cashflow · forecast flows.

**Producer plan.** The runway becomes a **pure engine + Decimal twin** — never inside the master
assembler (D30). Two named quantities: **emergency fund months** (liquid ÷ essential, comparable to
Moneysmart's **three-month** benchmark) and **survival runway** (liquid ÷ net burn, banded in its own
units). **Retire the third basis** — liquid ÷ total actual outgoings, today's 11.6. Zero or negative
burn renders **`INDEFINITE`** with its reason; **never 0, 12 or 999**, and downstream scores handle the
**state**, not a sentinel.

Net burn on **gross flows both sides** (D31) — property costs stay in essential, rent enters gross, so
nothing double-counts.

Health score **re-founded on the CBA–Melbourne Institute Observed dimensions** (D32); canonical
producer `generateHealthReport`; the other three map to a dimension or retire; portal snapshot label
retired; **loans count as essential** in CFO buffer months (D4 enforcement). **Licensing for the
framework's name is a legal check before shipping it.**

Insurance: **remove the hardcoded 70** (D47). Rebuild on Moneysmart's needs methodology later, **life
cover only**, named as such.

**Invariants:** runway recomputed by hand from its inputs matches · `INDEFINITE` never enters
arithmetic · savings rate reconciles to banked income and the declared spending basis · no score
averages a sentinel.

### T7 — budget remainder · moves numbers

**Contracts:** budget remainder (planning) · budget remainder (actual) · budget variance · the ABS
benchmark reference · multi-year projection.

**Producer plan.** Remainder on **two bases** (D24), both shown with the gap named. Variance: **one
survivor on the four-tier scale**, V3's blob-key input fixed, V2 pointed at the survivor so **the AI
and the screen read the same number** (D23). ABS benchmark **relabelled on all four surfaces**, vintage
and source displayed, **provenance verified or the figures dropped** (D25). Projections: one survivor,
`forecastEngine.ts:220`'s hardcoded $100,000/$60,000 deleted; **missing user data refuses to compute,
missing forward assumptions get explicit sourced disclosed defaults** (D45). Assumptions config built
to **ASIC RG 276 / Instrument 2022/603** — wage inflation 3.7%, CPI 2.5%, retirement age 67, drawdown
to the later of 92 or five years, today's dollars, user-changeable. **LLM-invented projections deleted**
and added to `lint:ai-grounding`. **The dead forecast stack deleted** (D46) with the census
distinguishing collapsed from deleted-as-dead. **Any projection past 1 Jul 2027 models both regimes.**

**Compliance boundary for Reza, not the Matrix:** a superannuation **calculator** may be provided by
any entity; a **retirement estimate** only by a trustee. Monitrax is not a trustee.

**Invariants:** planning remainder == banked income − committed · actual remainder == banked income −
trailing-12 outgoings · variance is computed against a real budget, never the benchmark · every
projection states its assumptions on the surface.

## §5 Closing stages

**Number Ledger, MON-131 scope** — every quantity × every surface × three axes (singularity,
consistency, correctness). **MON-131 closes here, on evidence.** **MON-136** — every remaining quantity,
same machinery. **Number Ledger, MON-136 scope.** **The complete Matrix sweep** — the whole app
re-walked; the only thing that closes the programme. **Then everything else** — the 36 issues producer
collapse will not touch.

## §6 The permanent test suite this programme leaves behind

`netTotal ≤ grossTotal` on every income path · sources sum to banked income · a one-off contributes 0
to every run-rate · an interest-only loan is never $0 · Σ per-loan rows == the aggregate · liquid +
accessible + locked == net worth · Σ per-property equity == the portfolio hero, negative preserved ·
entity slices + defaults == the total · the same depreciation schedule yields the same figure through
every path · a rate's unit is type-enforced · every legislated constant resolves from config ·
a regime switch is tested on both sides of its date · `INDEFINITE` never enters arithmetic · the
categoriser never emits `isRecurring: false` · no `Math.random()` under `lib/` · `generateHealthReport`
is deterministic for a fixed database state · Float ≡ Decimal parity on every migrated producer ·
census counts ratchet down only.

## §7 What this document deliberately does not specify

**Per-tranche `expectedMoves` values** — they are **computed** at build time from real data, not
authored here. Specifying them in advance would make them estimates, and an estimate cannot verify
anything.

**Contract-level call-site lists** — they live in `docs/architecture/contracts/`, are file-and-line
specific, and must be **re-verified at HEAD** before each tranche: roughly a third of the registry's
older anchors had drifted.

**Anything requiring a fact nobody holds yet** — those become **FACT fields with undetermined states**,
listed per tranche above, never defaults that assert a position.

**And it does not claim the safety net is complete.** The baseline covers 8 orchestrator trees, not all
leaf producers; it captures values, not rendered screens; and a declared move can mask an undeclared
one — MON-135's exact shape, and why `expectedMoves` are per-path.

---
*Written by The Matrix, 30 July 2026, at Reza's direction after he identified brief-by-brief
composition as a drift risk. He was right: X1 was found while writing the Tranche 1 brief; X2 through
X8 were found while writing this. Governed by `REFERENCE_NUMBERS_DECISIONS.md` (D17–D41),
`decisions/D42_VERIFICATION_CORRECTIONS.md` (corrections + D43–D47), the 49 contracts, and
`PROTOCOL_NUMBER_LEDGER.md`. Gate state in `implementation/MON-131_TRANCHE_LEDGER.md`.*
