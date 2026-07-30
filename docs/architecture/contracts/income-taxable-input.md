# incomeTaxableInput (the taxable-income INPUT side of income)

> Phase A Quantity Contract — MON-131 boundary contract. READ-ONLY census at HEAD `fa392b9a`,
> 2026-07-29. **Scope discipline:** this contract covers only where INCOME producers feed the
> tax base (the assembly boundary). The tax engine's own math (brackets, Medicare, offsets,
> taxable income = assessable − deductions) is the tax agent's contract, not this one.

## classification

**DERIVED** (D1) — an annual assessable-income aggregation over FACT `Income` rows.

## semantic

**UNNAMED split — two different "taxable income (input side)" quantities exist:**

**Quantity T-A (the real tax input) — assessable income assembly,**
`taxPositionCalculator.calculateTaxPosition` (:178-227, Decimal :741-743):
- **basis:** declared `Income` rows, per-row annual amount resolved as
  `grossAmount ? grossAmount : (isRecurring === false ? amount : annualize(amount, frequency))`
  (:180-184) — i.e. **grossAmount-first (already-annual), one-off counted ONCE at face value
  (MON-053), else amount×frequency**.
- **window:** the requested financial year (July 1 → June 30; `userTaxPosition.ts` FY bounds).
- **inclusions:** taxability decided by `determineTaxability` with the stored
  `taxCategory` (MON-094: non-assessable rows → $0), franking gross-up for dividends,
  bucketed salary/rental/dividends/interest/capitalGains/other.
- **exclusions:** non-assessable rows (taxCategory), nothing else at this boundary.
- **units:** AUD/year.
- Assembled from FACT rows by `userTaxPosition.getUserTaxPosition` (:86; passes
  `isRecurring` at :192, taxCategory at :199).

**Quantity T-B (legacy flag split) — `aggregateIncome().taxableIncome / nonTaxableIncome`**
(incomeAggregator.ts:169-173, Decimal :311-315):
- gross-basis split by the legacy `isTaxable !== false` boolean — schema comment says
  `taxCategory` **replaces** `isTaxable` (schema :1941-1950) but this path still reads the
  old flag; **no one-off gate** (a one-off annualises ×frequency into "taxable income");
  no franking gross-up; units follow `targetFrequency` (monthly OR annual — a monthly
  "taxable income" is itself a unit trap).

**Quantity T-B′ (same legacy split, re-typed)** — `cashflowOrchestrator.calculateCashflow`
:322/:333 (`taxableIncome += monthlyGross × 12` when `isTaxable !== false`; Decimal
:550/:560): annual figure built from monthly gross ×12, same legacy flag, inherits the
:147 grossAmount-units bug.

Two engineers implementing "taxable income input" today could legitimately pick T-A or T-B
and get different numbers for the same rows. **T-A is the defensible one** (ITAA-aligned,
one-off-correct, taxCategory-aware).

## canonicalHome

For the input-assembly boundary: `lib/tax-engine/position/taxPositionCalculator.ts:calculateTaxPosition`
income loop (:178-227) **+ Decimal twin** `calculateTaxPositionDecimal` (:714, income
resolution :741-743), fed exclusively by
`lib/tax-engine/position/userTaxPosition.ts:getUserTaxPosition` (:86).
(The engine's downstream math: tax agent's contract.) T-B/T-B′ have **NOT ESTABLISHED**
status — they need a decision: retire, or rename to a declared-flag split that no surface
may call "taxable income" (decisionsRequired #1).

## callSites

| file:line | tag | what it actually computes |
|---|---|---|
| lib/tax-engine/position/taxPositionCalculator.ts:180-184 (+:741-743 Decimal) | CANONICAL (T-A) | grossAmount-first, one-off-once, else annualize; → determineTaxability(taxCategory) |
| lib/tax-engine/position/userTaxPosition.ts:192/:199 | CONSUMER (assembler) | passes isRecurring + taxCategory through to T-A |
| lib/services/masterFinancialService.ts:1370 | CONSUMER | `estimatedTaxableIncome = result.tax.taxableIncome` (engine output, rounded) |
| lib/calculations/incomeAggregator.ts:169-173 (+:311-315) | DIFFERENT-QUANTITY (T-B) | gross split by legacy `isTaxable`; no gate, no gross-up |
| lib/calculations/cashflowOrchestrator.ts:333 (+:560) | DIFFERENT-QUANTITY (T-B′) / DUPLICATE of T-B | monthlyGross×12 under legacy flag; inherits :147 units bug |
| lib/intelligence/insightsEngine.ts:749/:759 | CONSUMER (of a snapshot `taxExposure.taxableIncome` — producer NOT EXAMINED; likely T-B lineage via portfolio snapshot) | tax-optimisation insight trigger at >$100k |
| app/api/tax/position/route.ts:35 (`getUserTaxPosition` call; import :18 — anchor corrected §7, was :43) | CONSUMER | serves T-A to the tax page |
| lib/tax-engine/income/salaryProcessor.ts:46 | DIFFERENT-QUANTITY (per-salary taxable) | tax agent's scope |
| lib/tax-engine/orchestrator/masterTaxPosition.ts:245/:588 | CONSUMER/orchestrator | tax agent's scope |
| lib/services/entityTaxFactsAssembler.ts (census hits :82/:120/:1011) | NOT EXAMINED | entity-partitioned tax facts |
| remaining census `taxableIncome` hits (38 heuristic) inside lib/tax-engine/* | out of this contract's scope (tax agent) | — |

## invariants

1. A one-off income row (`isRecurring=false`, amount X) contributes exactly X to the FY
   assessable base — never X × periodsPerYear, never 0 (0 is the RUN-RATE rule; the tax
   side counts it once — the two quantities differ by design).
2. `grossAmount` used at T-A is ANNUAL — same unit contract as the gross contract.
3. taxCategory governs assessability at T-A; the legacy `isTaxable` flag governs nothing
   the user sees labelled "taxable" (post-decision #1).
4. Rental dedup convergence: the pooled rental gross feeding the income breakdown equals
   the rental basis feeding the tax summary (masterFinancialService `adjustPropertyRentalIncome`
   header states this by construction; tests/tax/rentalTaxDedup.test.ts).
5. Float ≡ Decimal parity at :180-184 vs :741-743.
6. Assessable income ≥ 0 per bucket; franking gross-up only on dividend buckets.

## independentExpectation

ITAA 1997 s6-5/s6-10 (assessable = ordinary + statutory income for the FY); franking
gross-up per ITAA 1997 Div 207. Concretely checkable without another screen: hand-build the
FY assessable total from raw `Income` rows applying the :180-184 resolution rule and the
stored taxCategory, per §19.2. For T-B: **NONE FOUND** — the legacy-flag split corresponds
to no legislative concept (it is a declared-flag aggregate, not taxable income); if kept it
is UNVERIFIABLE as "taxable income" and must be renamed.

## surfaces

| route | label |
|---|---|
| /dashboard/tax | tax position assessable-income breakdown (via /api/tax/position :35 → T-A; anchor corrected §7) |
| /dashboard (Home) / CFO tiles | estimated taxable income in master snapshot tax summary (masterFinancialService :1370) |
| /dashboard/cashflow, /api/cashflow | `taxableIncome` field in orchestrator result (T-B′) — any surface rendering it shows the WRONG quantity under the "taxable" label |
| insights surfaces | tax-optimisation insight thresholded on taxExposure.taxableIncome (insightsEngine :749) |
| /dashboard/income | per-item taxable badges (taxCategory display — NOT EXAMINED in detail) |

## expectedMoves

Prefix: `lib/services/masterFinancialService.ts:getMasterFinancialSnapshot`.

| pathPrefix | prediction | arithmetic |
|---|---|---|
| `…tax.estimatedTaxableIncome` (via :1370) | **NO MOVEMENT** from T1 income work — T-A already gates one-offs and reads grossAmount-first; T1 changes the run-rate side only | golden VR-041 figure: taxable $145,426 stays |
| orchestrator `taxableIncome` output (cashflow endpoints, if captured) | MOVES or is DELETED when T-B/T-B′ retire (decision #1); if retained-renamed: NO numeric movement | — |
| `…income.monthly.all.taxableIncome` / `.nonTaxableIncome` (aggregator outputs, if captured) | MOVE to 0 / removed if T-B retired | — |

Any movement in `…tax.*` during T1 is a defect (T-A is untouched by T1).

## decisionsRequired

1. **Retire or rename T-B/T-B′:** the aggregator/orchestrator `taxableIncome` fields are
   not taxable income. Options: (a) delete the fields and point consumers at T-A's FY
   figure; (b) rename (e.g. `declaredTaxableFlaggedGross`) and forbid the "taxable" label.
   Consequence of doing nothing: two numbers named "taxable income" that differ whenever a
   one-off, franking, or taxCategory row exists.
2. **`isTaxable` vs `taxCategory`:** schema says taxCategory replaces the boolean; the
   aggregator still reads the boolean. Decide the single classification authority and
   whether the boolean column is retired (schema change ⇒ §12.12).
3. **grossAmount-first precedence at T-A (:180):** a stored grossAmount bypasses the one-off
   check — a ONE-OFF salary-typed row with grossAmount set would still count grossAmount.
   Also invented grossAmounts (see wrong-inputs in the gross contract: income page fallback
   `annual/0.7`) feed the tax base directly. Decide: sanity-clamp / re-derive stored salary
   FACTs before trusting them at the tax boundary.

## coverageBoundary

Read: taxPositionCalculator :140-230 + gate greps (:691-:828 Decimal anchors),
userTaxPosition :60-150 + :192/:199 greps, incomeAggregator end-to-end, orchestrator
taxable lines (:322/:333/:421/:550/:560/:637), masterFinancialService :1370 context,
insightsEngine grep only. NOT examined: `determineTaxability` internals; taxExposure
producer in the portfolio snapshot; entityTaxFactsAssembler; salaryProcessor;
masterTaxPosition orchestrator; all downstream tax math (tax agent's scope); the 38-hit
census list beyond the rows tabled above.

## Adversarial review (§7) — 2026-07-29

- Claims checked: 21 (anchors 15 · arithmetic 1 · negative-claims 3)
  - Anchors re-verified at HEAD `72b15268`: taxPositionCalculator :177-227 income loop, resolution :180-184 verbatim (`grossAmount ? grossAmount : isRecurring === false ? amount : annualize(...)` — Float truthy-check, so the decision-#3 note "a stored grossAmount bypasses the one-off check" is exactly right); Decimal :714 with resolution :739-743 (note: Decimal uses `!= null` where Float uses truthiness — a $0 grossAmount behaves differently across twins; recorded as a parity nit for the Ring-0 fixture, not a contract error since the contract's :741-743 quote is accurate); userTaxPosition :86, `isRecurring` at :192, `taxCategory` at ≈:200; master :1370 (`estimatedTaxableIncome = Math.round(result.tax.taxableIncome)`); T-B incomeAggregator :169-173 + Decimal :311-315 (legacy `isTaxable !== false`, gross basis, no gate — confirmed); T-B′ orchestrator :331-333 (`taxableIncome += monthlyGross * 12`) + Decimal :550/:560, output :421/:637; insightsEngine :749-760 ($100k threshold on `taxExposure.taxableIncome`); schema :1941-1950 (taxCategory "replaces isTaxable" comment + legacy boolean); salaryProcessor :46; masterTaxPosition :245/:588.
  - **Corrected anchor:** `app/api/tax/position/route.ts:43` → the `getUserTaxPosition` call is at **:35** (import :18). Fixed inline in the callSites table.
  - Negative claim attacked: T-B "corresponds to no legislative concept / NONE FOUND" — fair: it is a declared-flag split with no FY window, no gross-up, no taxCategory; nothing in ITAA maps to it.
- REFUTED / CORRECTED: 1 minor anchor drift (route :43 → :35), fixed inline.
- Could not verify: `determineTaxability` internals, `taxExposure` producer lineage, entityTaxFactsAssembler (declared boundary); the VR-041 $145,426 figure (data claim).
- Verdict impact: none. T-A canonical, T-B/T-B′ NOT-ESTABLISHED/rename-or-retire, and decision #1-#3 all stand. **PASS with 1 anchor correction.**
