# RING-3 HANDOUT — M2.2: the pack goes canonical (#1595)

**For:** Matrix HQ (Chrome relay under Matrix direction) · **Cut by:** Code session, 2026-08-19
**Runs against:** the first deployment carrying #1595's merge (minimum commit: the #1595 merge SHA — record it in the run).
**Issues under verdict:** MON-164 · MON-165 · MON-166 (display) · MON-129 kept slice · MON-001 (kept-surface path only). All verdicts land as `matrix-result/v1` JSON per §3.0c and flip registry statuses.

## Identity assertion
The tax-time pack's per-row `annualAmount` is produced by `annualContribution` (lib/reports/contextBuilder.ts): one-off rows count ONCE at their amount; recurring rows with reconciled transactions read the day-span monthly average × 12 (the same figure the property pages show); recurring rows without transactions fall back to declared × frequency. Depreciation everywhere is `calculateDepreciationAnnual` (WDV-aware). Nothing else produces these numbers.

## Falsifiable predictions (expected movements — rule-derived, directions not targets)

| # | Surface | Prediction | Falsified if |
|---|---|---|---|
| P1 | Reports → Tax Time → "Rental Income" | **Equals the property pages' rental figure** for every property whose rent has ≥2 reconciled transactions (pre-fix it read declared-only — up to the full frequency ratio low; the 2026-08-19 worked example was −54%) | the pack and the property page disagree on a reconciled stream |
| P2 | Tax Time → "Total Deductions" | **Falls** by Σ(one-off amount × (periods−1)) wherever one-off expenses carry a stored frequency; a single $11,385 one-off stored MONTHLY drops it by $125,235 | a one-off row still contributes amount × frequency |
| P3 | Tax Time → "Depreciation Claims" + the depreciation page total | **Both equal the property detail page's Depreciation/yr** (ONE producer). For a diminishing-value DIV40 asset ~3 years old at 10%: ≈cost × 0.8³ × 0.2, NOT cost × 0.2 | any of the three surfaces disagrees |
| P4 | Properties list dialog → Depreciation tab | Rate reads as stored (e.g. **2.50% p.a.**, not 250.00%) | ×100 still rendered |
| P5 | Properties list dialog → Details + Cashflow tabs | Annual/monthly cashflow **equals the tile and the detail page exactly** (basis chip states reconciled/declared/mixed) | dialog ≠ tile on the same screen |
| P6 | Pack per-entity section (≥2-entity households only) | Per-entity "Cashflow /mo" **rises (less negative)** by the one-off expense run-rate that no longer counts | one-off expenses still in the run-rate |

## mustNotMove guard
- Property detail page: Rental income /mo · Cashflow /yr · tax-basis line (already canonical pre-fix — the pack CONVERGES to them; they must not shift).
- Balances → loan dialog: interest estimate + repayment figures (untouched).
- Master snapshot quick metrics / Activity Sankey totals (untouched paths).
- Golden baseline self-diff: every delta outside the six predictions above must be explained or it is a STOP.

## Coverage boundary
CI verifies the row rule, the canonical depreciation value, and source topology (`tests/reports/mon164PackCanonicalRows.test.ts`); it does NOT verify the rendered pack on live data — that is THIS run. The pack's per-loan interest line does NOT exist yet (M3.1); nothing here predicts it.
