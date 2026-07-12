# Changelog — 2026-07-12

## NeoAudit Ring-0-gen: fast-check property tests (Scenario Lab step 3, part 1)

- Added `fast-check@^4.9.0` (core only — the `@fast-check/vitest` wrapper needs vitest 4; we run 1.6, so core + plain `fc.assert` in vitest `it()`).
- `tests/golden/properties.frequencies.test.ts` — frequency laws over any input: annual = monthly×12, linearity, identity anchors, exact ×52/×26/×4/×2 factors, non-negativity. Targets the historical unit-confusion / 100× bug class.
- `tests/golden/properties.engines.test.ts` — metamorphic properties: expense additivity (essential+discretionary=total; Σcategory=total; annual=monthly×12) and computePropertyCashflow decomposition (Σ expenseLines.annual=annualExpenses [MON-005]; Σ loanLines.monthly=monthlyLoanRepayment [MON-032]; annual=12×monthly; annualCashflow=rent−expenses−repayment; loan cost never silently $0).
- These are the R0-gen node (NEOAUDIT.md §1.2): thousands of generated inputs, shrinking counter-examples. No new infra; own PR (independent of #1364).
