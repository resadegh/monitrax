# salaryTakeHomePay (per-salary statutory take-home)

> Phase A Quantity Contract — MON-131 / MON-128 (T1) **DIFFERENT-QUANTITY split** carved out
> of "net income". READ-ONLY census at HEAD `fa392b9a`, 2026-07-29.
> This is the engine-computed take-home for ONE salary stream — a genuinely different
> quantity from the aggregate net run-rate (which sums stored FACT columns). Deleting either
> "because the other exists" would be the exact failure Phase A exists to prevent.

## classification

**DERIVED** (D1) — computed from a gross salary FACT via legislated schedules. Never stored
as the live value. (**Today it IS stored** — the income form writes its output into
`Income.netAmount`/`paygWithholding` FACT columns; that stored copy is the aggregate-net
quantity's input and the MON-080-class desync risk. See decisionsRequired #2.)

## semantic

- **basis:** a single gross salary amount + pay frequency (declared, not actuals).
- **window:** annualised FY schedule, converted back to the input cadence.
- **formula (canonical variant):** annualise gross → PAYG withholding
  (tax-free threshold assumed true) + Medicare levy − LITO, floored at 0 → net = gross − netTax
  → ÷ periodsPerYear back to the input cadence. Also returns paygWithholding, medicareLevy,
  effectiveTaxRate (%).
- **inclusions:** PAYG per `TAX_YEAR_CONFIGS`, Medicare levy, LITO.
- **exclusions:** salary sacrifice (not a parameter), MLS, HELP/HECS, Division 293,
  SAPTO, reportable fringe benefits — none are modelled at this boundary.
- **units:** AUD per the input `frequency`; effectiveTaxRate in percent (0–100).

**UNNAMED split INSIDE the same file:** `calculateNetSalary`
(lib/cashflow/incomeNormalizer.ts:49-76, Decimal :313-334) computes PAYG + Medicare
**without LITO** — a strictly lower net for LITO-eligible incomes (< $66,667 taxable,
FY-dependent) than `calculateTakeHomePay` (:221, which applies LITO at :249-256). Two
"take-home" numbers from one module.

## canonicalHome

`lib/cashflow/incomeNormalizer.ts:calculateTakeHomePay` (:221) **+ Decimal twin**
`calculateTakeHomePayDecimal` (:468). (The LITO-including variant; confirm via
decisionsRequired #1 before Phase B deletes `calculateNetSalary`.)

## callSites

| file:line | tag | what it actually computes |
|---|---|---|
| lib/cashflow/incomeNormalizer.ts:221 (+:468 Decimal) | CANONICAL | PAYG + Medicare − LITO take-home |
| lib/cashflow/incomeNormalizer.ts:49 `calculateNetSalary` (+:313 Decimal) | DUPLICATE (divergent — **omits LITO**) | PAYG + Medicare only; used by `normalizeIncomeStream` legacy fallback (:133/:383) |
| lib/income/netIncomeCalculator.ts:73 | CONSUMER | engine fallback when a GROSS salary has no stored netAmount |
| lib/calculations/cashflowOrchestrator.ts:158 (+:515 Decimal `calculateTakeHomePayDecimal`) | CONSUMER | GROSS-salary net for cashflow endpoints (recomputes even when netAmount stored — see net contract decision #2) |
| lib/health/buildHealthInput.ts:39 | CONSUMER (misused) | applied to EVERY salary regardless of salaryType — double-taxes NET-entered salaries |
| app/api/tax/salary (via income page :328 preview) | NOT EXAMINED (route not read) | the /api/tax/salary processor is presumably `salaryProcessor.processSalary` — tax agent's scope; it, not calculateTakeHomePay, backs the income form's stored FACTs |
| lib/calc-audit fixtures (census hits) | CONSUMER (test) | NOT EXAMINED individually |

## invariants

1. `netAmount + paygWithholding + medicareLevy − litoApplied === grossAmount` at annual
   basis (arithmetic identity of the formula, LITO floored).
2. `netAmount ≤ grossAmount` always; equality only at gross ≤ tax-free threshold.
3. Monotonic: net is non-decreasing in gross (no bracket-boundary cliff — the historic
   $0-at-boundary class).
4. Float ≡ Decimal parity (:221 vs :468) within currency tolerance.
5. Frequency invariance: `takeHome(gross, F).netAmount × periodsPerYear(F)` equals
   `takeHome(annualGross, ANNUAL).netAmount × 1` for equivalent annual gross.
6. Post-decision #1: exactly ONE take-home formula in the codebase (LITO fork eliminated).

## independentExpectation

Legislated: ITAA 1997 marginal brackets + Medicare Levy Act 1986 (2%) + LITO
(ITAA 1997 s61-110 area) via `TAX_YEAR_CONFIGS` — hand-computable worked example per §19.2
for any gross (e.g. FY25-26 rates against an ATO tax-withheld calculator figure). Cite the
FY config, never memory, when writing the Ring-0 fixture.

## surfaces

| route | label |
|---|---|
| /dashboard/income | salary preview card: Gross / Tax (PAYG) / Net / Super (page.tsx:1965-1989) — NOTE: preview values come from /api/tax/salary, not calculateTakeHomePay; same quantity, different producer (NOT EXAMINED) |
| /dashboard/cashflow + /api/cashflow endpoints | embedded in monthlyNetIncome for GROSS-salary rows (orchestrator :158) |
| My Guide / health | embedded in health income input (buildHealthInput :39) |
| not rendered directly anywhere as its own labelled figure otherwise found | — |

## expectedMoves

| pathPrefix | prediction | arithmetic |
|---|---|---|
| any capture path through `normalizeIncomeStream` legacy fallback (streams with GROSS salary and NO stored netAmount) | MOVES UP if `calculateNetSalary` is replaced by the LITO variant, by exactly min(LITO, PAYG+Medicare) ÷ 12 per affected stream | LITO ≤ $700/yr (FY-config) → ≤ ~$58.33/mo per affected stream |
| `lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.*` | **NO MOVEMENT** — the master snapshot path (aggregateIncome) never calls either take-home function | any move = defect |
| cashflow endpoints' monthlyNetIncome | NO MOVEMENT from the LITO unification for rows WITH stored netAmount; MOVES only for engine-fallback rows | — |

If no GROSS-salary-without-netAmount rows exist in Reza's data, prediction is **NO movement
anywhere** — the strongest, most falsifiable form.

## decisionsRequired

1. **LITO in or out of "take-home":** `calculateTakeHomePay` includes it; `calculateNetSalary`
   and the orchestrator's PAYG label ("payg + medicare") treat withholding-style. Accounting
   consequence: LITO is an offset realised at assessment, not withheld — a *withholding*
   take-home excludes it (matches payslips); an *effective* take-home includes it (matches
   full-year cash). Pick which the app's "net" means; the other becomes a named variant or dies.
2. **Stop storing the output as FACT (D2 tension):** `Income.netAmount`/`paygWithholding`
   are derived values stored in a FACT table, written by the income form (including the
   invented ×0.7 / ÷0.7 / 30% / SG 11.5% fallback at app/dashboard/income/page.tsx:356-364,
   submitted at :561-565). Options: (a) derive-on-read (netAmount column retired — schema
   change, §12.12); (b) keep as cache with a re-derivation trigger on every amount/frequency
   edit + a `net ≤ gross` write guard. Consequence of (a): tax engine on every read path;
   of (b): the desync class survives but is guarded.
3. **Salary sacrifice:** not a parameter of either function, but embedded in stored
   netAmounts written via /api/tax/salary. Unifying on engine-recompute silently drops
   sacrifice unless the canonical signature gains it.

## coverageBoundary

Read end-to-end: incomeNormalizer.ts (both variants + Decimal twins). Read targeted:
netIncomeCalculator, orchestrator, buildHealthInput, income page writer path. NOT examined:
`/api/tax/salary` route + `lib/tax-engine/income/salaryProcessor.ts` (the FACT-column
writer's actual engine — tax agent's scope, but decision #2 needs its formula compared to
calculateTakeHomePay); paygCalculator internals; TAX_YEAR_CONFIGS values; calc-audit
fixtures covering these functions; whether LITO's FY cap is $700 at current config (stated
from the FY24+ legislated figure — re-verify against `TAX_YEAR_CONFIGS` before writing the
Ring-0 fixture, per the never-from-memory rule).
