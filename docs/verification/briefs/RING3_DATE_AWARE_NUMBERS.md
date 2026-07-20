# Ring-3 brief — DATE-AWARE NUMBERS, cross-app (MON-089 + MON-090 + Mechanism A)

**For:** the Matrix (Claude-in-Chrome relay, playbook §3 rules apply — capture real rendered numbers, never infer)
**Prepared:** 2026-07-20 · Code session yhm8ug · after merges #1458/#1459/#1461/#1463/#1464/#1465 and the MON-090 PR
**Scope:** every surface that turns transaction runs into monthly figures. The claim under test: *one producer per figure, every figure date + frequency aware, declared-first.*
**Standing caution:** Reza's data is IN FLUX (he deleted and re-categorised salary rows on 2026-07-20). Do NOT pin to pre-2026-07-20 baseline values for income; capture fresh and check INTERNAL CONSISTENCY between surfaces instead. Net worth / liquid / tax guards may also have legitimately moved with his edits — flag deltas, don't auto-fail them.

---

## Part A — Income page (`/dashboard/income`) — the reported defect class

1. **Transportservice (monthly, re-categorised):**
   - Actual column reads the cadence average marked **"avg /mo"**, with **"N payment(s) · last <date>"** beneath. With 2 payments ~29 days apart at $11,074 each the average must read **≈ $11,624** (NEVER ≈ $23,247 — that is the dead ×N/(N−1) bug; any figure > ~1.2× a single payment for a monthly stream = FAIL, reopen MON-089).
   - With only 1 linked payment: average = that payment (reads as one month).
   - **"this month · $X"** line: must equal the sum of transactions dated in the CURRENT calendar month only (July: if no July payment → "$0 so far").
   - Amber **"Nothing since <date>"** chip: appears ONLY when the newest payment is older than 1.5× the row's frequency interval (monthly ≈ 46 days; fortnightly ≈ 21 days). 12-Jun-last-payment on 20 Jul = NO chip yet; from ~27 Jul = chip. Verify the boundary honestly.
2. **Ingeus (fortnightly):** average ≈ payment × 26 ÷ 12 (e.g. $1,875 × 26/12 ≈ $4,063–$4,163 depending on actual amounts); "this month" = sum of July-dated payments only.
3. **Declared-first (Reza's rule):** rows WITH a declared amount → Net Monthly shows the declared figure and Variance compares average-vs-declared. A row with NO declared amount (amount 0) → Net Monthly shows the average marked "avg", Variance shows "—".
4. **Group headers (Salary/Wages, Rental, Other):** "per month" = declared plan sum (unchanged); NEW "received this month · $X" = Σ of member rows' this-month actuals. Cross-check: expand the group and hand-sum the rows' "this month" values — must match the header line exactly.
5. **One row per source (Mechanism A guardrail, live-proven):** re-categorising more transactions to an existing employer must NEVER create a new row — source count stable across the exercise.

## Part B — Spending page (`/dashboard/expenses`) — new coverage

6. New **Actual** column (list view): same anatomy — "avg /mo" + "N payments · last <date>" + "this month · $X"/chip. Spot-check 2 recurring expenses with linked transactions: avg sane vs cadence; "this month" = July-dated sum only.
7. Declared Monthly column and Total Monthly footer are UNCHANGED by this PR — pin them before/after refresh to prove no regression.

## Part C — Cross-surface consistency (the SSOT claim)

8. **Property detail vs list vs income page:** for one rental with linked deposits, the actual-monthly figure on the property page must equal the income page's "avg /mo" for that stream (same producer `calculateMonthlyAverage`).
9. **Dashboard headline vs income page:** the dashboard's actual-cashflow tiles read the CALENDAR-MONTH canonical (actualCashflow). The income page's "received this month" figures for July must be consistent with the dashboard's current-month income actual (sum over income streams ≤ dashboard inflow — the dashboard also counts unlinked IN transactions; flag only if income-page July receipts EXCEED the dashboard's month inflow, which would be a contradiction).
10. **Link dialog banner:** open a transaction with ≥3 same-vendor payments → the "Monthly Average" banner figure must match the income/expense row's "avg /mo" for that source (same producer since #1465).

## Part D — Guards (regression watch, flux-aware)

11. Tax page: still renders; per-member rows present (Part A #1461); no error toasts.
12. Safety Net "Liquid savings" and months-of-cover: still netting credit cards (VR-018 class) — capture, compare to Balances.
13. Loans list: `resolvedCost` figures unchanged (this PR only ADDED payload fields).
14. Admin → Intake Duplicates: loads without auth error (#1463); if Ingeus fortnightly ×3 or Cienna Lot-1 rows remain, they appear as groups (same-property rental now visible, #1464); cross-property Lot-1 vs Lot-2 must NEVER appear in one group.

**Report format:** per numbered item — PASS/FAIL + the captured numbers + screenshot refs. Any FAIL → issues:raise with the captured evidence. File the run as VR-0NN under docs/verification/runs/.
