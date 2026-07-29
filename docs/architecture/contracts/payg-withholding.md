# payg-withholding — Quantity Contract (MON-131 Phase A)

> Read-only Phase A contract. Anchors verified at HEAD 2026-07-29.
> **Primary finding: "PAYG" is TWO quantities** that the census counts as one. Per brief §3
> (`name` rule: separate contract-sections per semantic), both are specified here with
> distinct names because they share every surface and the same registry row today.

## name(s)

1. **`paygScheduleWithholding`** — what an employer SHOULD withhold on a salary, per ATO
   Schedule 1 (NAT 1004) coefficient formula. DERIVED, computed on demand.
2. **`paygWithheldDeclared`** — what WAS withheld: the stored `Income.paygWithholding`
   row value (a FACT, asserted by the user / payslip / import), and its FY aggregate
   `taxPosition.paygWithheld` (DERIVED sum) feeding `estimatedRefund = withheld − netTax`.

Conflating them is the drift bug: surfaces that fall back from (2) to (1) — or to an
invented 30% — show different PAYG for the same user.

## classification

- `paygScheduleWithholding`: **DERIVED** (from gross salary + frequency + TFT claim).
- `paygWithheldDeclared`: per-row **FACT** (stored once on `Income`, intake-guarded);
  FY aggregate **DERIVED** (one producer, never stored).

## semantic

- **Schedule quantity:** resident individual, Scale 2 (tax-free threshold claimed) or
  Scale 1 (not claimed); weekly-equivalent earnings; ATO formula `y = a·x − b` with
  `x = floor(weeklyEarnings) + 0.99`; weekly result rounded to WHOLE DOLLARS (regulatory,
  NAT 1004); fortnightly/monthly/annual derived from the ROUNDED weekly (annual = weekly×52).
  No HECS (unimplemented, flagged in code). Units AUD per period.
- **Withheld quantity:** `Income.paygWithholding` is an **already-ANNUAL figure**
  (asymmetric with `amount`+`frequency` — contract verified by Phase 41i calc-audit fixture,
  `incomeAggregator.ts:110-119`). Aggregate = Σ over SALARY rows, rounded to dollars.

## canonicalHome

- **Schedule:** `lib/tax-engine/core/paygCalculator.ts:149` `calculatePAYG`
  **Decimal twin** `:344` `calculatePAYGDecimal` (documented ZERO-diff vs Float — the
  regulatory whole-dollar rounding makes the two paths identical).
- **Withheld aggregate:** inside `calculateTaxPosition`
  (`taxPositionCalculator.ts:174,203-206` Float; `:734,760-762` Decimal), assembled by
  `getUserTaxPosition` (`userTaxPosition.ts:86`).
- ⚠ **canonicalHome caveat (wrong-input class):** the Schedule coefficients
  (`paygCalculator.ts:62-85`) are **FY2024-25 constants hardcoded in the file** — NOT in
  `TAX_YEAR_CONFIGS` (D12 gap), and `calculatePAYG` takes NO config parameter at all
  (`calculateGrossFromNet:241` accepts `config` and never uses it — dead parameter).
  FY2026-27's legislated 15% band changes Schedule 1 coefficients; every schedule-derived
  net today withholds at FY24-25 rates while the tax position taxes at FY26-27 rates.

## callSites

| Site | Tag | Actual arithmetic in words |
|---|---|---|
| `lib/tax-engine/position/taxPositionCalculator.ts:174-206,734-762` | canonical (withheld) | Σ stored `paygWithholding` over SALARY rows; `estimatedRefund = withheld − netTax` |
| `lib/tax-engine/income/salaryProcessor.ts:46` `processSalary` (+`processSalaryDecimal:410` region) | C (schedule) | gross→net via `calculatePAYG` + Medicare; NET input reverse-solved via `calculateGrossFromNet` (binary search). Powers `/api/tax/salary` (`app/api/tax/salary/route.ts:60,72`) — the income-page preview |
| `lib/cashflow/incomeNormalizer.ts:49` `calculateNetSalary` (+Decimal `:313`) | C (schedule) | legacy-row fallback: annual PAYG + Medicare via engines → net monthly, when no stored net exists |
| `lib/cashflow/incomeNormalizer.ts:221` `calculateTakeHomePay` (+Decimal `:468`) | C (schedule) | PAYG + Medicare − LITO → net; used by cashflow orchestrator |
| `lib/calculations/incomeAggregator.ts:119` `getPaygAmount` (+Decimal `:271`) | C (withheld) | stored annual figure, /12 for monthly, **0 when null** |
| `app/api/portfolio/snapshot/route.ts:65` `getPaygWithholding` | **D** | stored payg **else `gross − net`** — a SECOND fallback rule diverging from `incomeAggregator`'s (0 when null). Same row, two answers when `paygWithholding` is null and gross/net differ |
| `app/dashboard/income/page.tsx:356` | **D** | **VERIFIED AT HEAD:** `const estimatedTax = annualAmount * 0.30; // Rough 30% estimate` — catch-fallback of the salary preview invents PAYG as a flat 30%. Companion lines `:357` SG `× 0.115` (STALE — legislated 12%), `:359-360` `/0.7`,`×0.7`. D12 violation trifecta |
| `lib/services/moneyFlowService.ts:219` `getMoneyFlow` | C (withheld) | reads stored `paygWithholding` rows for the entity money-flow tax leg |
| `lib/calculations/cashflowOrchestrator.ts:131,302` | C (schedule+withheld) | via `incomeNormalizer` / stored fields — monthly PAYG legs of cashflow |
| `lib/tax-engine/core/paygCalculator.ts:388` `getPAYGSummary` | C | display wrapper over `calculatePAYG` |
| `lib/tax-engine/core/paygCalculator.ts:237,419` `calculateGrossFromNet(Decimal)` | C | iterative inverse of the schedule (unused `config` param noted above) |

**Census remainder NOT EXAMINED:** census `payg` = 64 heuristic sites; ~20 classified
above. Remainder (~44: `duplicateDetection` similarity math, `debt-analysis` formatters,
`riskRadar` subscription creep, `reformConstants.isPostCommencementFy`, calc-audit
adapters, insights/portfolio engine hits triggered by the `× 0.3` pattern or
"withheld" identifiers) spot-read as census false positives, NOT individually audited.

## invariants

- Golden baseline: **PAYG $11,129** (`REFERENCE_NUMBERS_DESIGN.md` §10) — the stored-withheld
  aggregate; `estimatedRefund = 11,129 − 37,786 ≈ −$26,657` (owing) as an arithmetic identity
  `paygWithheld − netTax`.
- Schedule properties (permanent tests): weekly withholding is a WHOLE dollar ·
  `annual = weekly × 52` exactly · withholding($361.99/wk) = $0 (boundary-continuity, audit
  MA.1-002) · every cent value within $X.00–$X.99 of weekly earnings yields the same
  withholding (the +0.99 rule, MA.1-005) · Float ≡ Decimal with ZERO diff (not tolerance) ·
  monotonic non-decreasing in earnings.
- Cross-quantity: on a GROSS-entered salary with stored net,
  `paygWithholding ≈ gross − net − (medicare leg)` only under the schedule's assumptions —
  do NOT assert equality between the two named quantities; they are allowed to differ
  (that difference IS the refund/owing signal).

## independentExpectation

ATO NAT 1004 Schedule 1 "Statement of formulas", FY2024-25 coefficients — cited in the file
header (`paygCalculator.ts:1-37`, retrieved 2026-06-07) with the `x = floor + 0.99`
convention. Check: hand-apply `y = a·x − b` for a chosen band and compare. For FY2026-27
there is **NO independent expectation encodable yet from this repo** — the FY26-27 Schedule 1
coefficients are not in the codebase; until they land, FY26-27 schedule outputs are
**UNVERIFIABLE against the current-year law** (they verify only against FY24-25 NAT 1004).
The stored-withheld quantity's expectation is the user's payslip/PAYG summary — a FACT check,
not a formula.

## surfaces

| Route | Label |
|---|---|
| `/dashboard/income` | salary preview "PAYG withholding" (happy path `/api/tax/salary`; catch-fallback = the ×0.30 duplicate) |
| `/dashboard/tax` | "PAYG withheld" + "Estimated refund/owing" (via `/api/tax/position`) |
| `/dashboard/cashflow` + orchestrator consumers | monthly PAYG leg of net income |
| `/dashboard/activity` | money-flow tax legs (moneyFlowService) |
| `/dashboard` (Home) | income tiles via portfolio snapshot (`getPaygWithholding` fallback rule) |
| `/dashboard/plan` | via cashflow intelligence (paygWithheld pass-through) |

## expectedMoves

- **NO movement:** `getUserTaxPosition → paygWithheld` ($11,129) and `estimatedRefund` — the
  stored-fact aggregate is untouched by any schedule migration.
- **NO movement (schedule, FY-migration deferred):** if Phase B only moves the coefficients
  into `TAX_YEAR_CONFIGS` keyed FY2024-25 with unchanged values, every schedule output is
  bit-identical. When (and only when) FY26-27 coefficients are added and selected,
  `calculateNetSalary` / `calculateTakeHomePay` / `/api/tax/salary` nets move — pre-write
  that arithmetic in the tranche PR from the ATO's published FY26-27 schedule.
- **MOVES:** `/dashboard/income` catch-fallback preview (kill `× 0.30` → route to canonical
  or an honest error state): visible only on API failure. SG line `× 0.115 → 0.12` moves the
  preview SG by 0.5pp of salary (super-cap quantity, noted for MON-133).
- **MOVES:** Home snapshot income tiles IF the `getPaygWithholding` null-fallback
  (`gross − net`) is collapsed to the `incomeAggregator` rule (0 when null) or vice versa —
  only for rows with null stored PAYG and differing gross/net.

## decisionsRequired

1. **FY-aware Schedule coefficients (blocks trusting any FY26-27 schedule number):** move
   `PAYG_SCALE_*` into `TAX_YEAR_CONFIGS` (D12) and add FY25-26/FY26-27 coefficient sets from
   ATO publications — or explicitly label all schedule outputs "FY24-25 basis". Consequence
   of doing nothing: preview/cashflow nets systematically overstate withholding once the 15%
   band applies (order of $268/yr at the affected band, mirroring MON-106's finding).
2. **Null-PAYG fallback rule:** `gross − net` (snapshot route) vs `0` (incomeAggregator) —
   pick ONE. `gross − net` silently treats any gross/net gap as tax; `0` understates. The
   contract cannot choose; it changes displayed income-tile PAYG.
3. **Registry naming:** register `paygScheduleWithholding` and `paygWithheldDeclared` as two
   rows in `REFERENCE_NUMBERS.md` (currently one row "PAYG withholding" pointing at
   `lib/tax-engine`), or one row with two named sub-quantities.

## preconditions (MON-135 class — hunt result)

- **P1 (= decision #1):** FY26-27 Schedule 1 coefficients absent + config-blind
  `calculatePAYG`. Migrating consumers onto the schedule BEFORE fixing the FY basis would
  lock in FY24-25 withholding under an FY26-27 position — a migration that is *harmful
  until something else is fixed first*. Fix the coefficient home first.
- **P2:** dead `config` parameter on `calculateGrossFromNet(Decimal)` misleads readers into
  believing the schedule is FY-aware. Remove or wire it in the same tranche.

## coverageBoundary

READ: `paygCalculator.ts` (full), `incomeNormalizer.ts` (full), `taxPositionCalculator.ts`
PAYG legs, `incomeAggregator.ts:76-145`, `portfolio/snapshot/route.ts:25-110`,
`moneyFlowService.ts:200-260`, `salaryProcessor.ts:40-110`, income page `:300-390`,
`/api/tax/salary` (grep-level only). NOT read: HECS/Study-loan anything (unimplemented),
Scale 1 coefficient verification against NAT 1004 (only Scale 2 boundary spot-checked via
the in-file audit notes), the ~44 unexamined census sites, `calc-audit` PAYG fixtures'
expected values (not re-verified against NAT 1004 this pass).
