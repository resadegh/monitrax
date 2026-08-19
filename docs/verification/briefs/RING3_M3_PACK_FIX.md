# RING-3 HANDOUT — M3 PR-1: the D-12 pack fix (MON-168 · MON-169 · MON-170)

**For:** Matrix HQ (Claude-in-Chrome relay) · **Gate:** these three issues flip FIXING → VERIFIED only on this run's PASS.
**Written:** 2026-08-19, BEFORE the fix code (D-21 condition 1 — movement predicted, never discovered).
**Minimum commit:** the M3 PR-1 merge commit (PR body names it). PROD (or the PR preview) must serve ≥ that SHA before capture.
**Baseline of record:** the Ring-3 FAIL verdict on #1595 (comment 2026-08-19, sha `91a4256`): 387 transactions in FY2025-26 · `perProperty: []` · 8/387 rows and $6,830.50/$192,933.48 in ATO labels · $1,000 transfer inside totals.

## Identity assertion
Same account as the #1595 run (`userId 91b6d7ce-…`), same FY2025-26 window, `transactionCount` still 387 (± any rows Reza added since — record the observed count; every prediction below is stated so it holds at any count).

## Run order (matters)

1. **BEFORE the backfill** — call the backfill dry run (admin):
   `POST /api/admin/maintenance/backfill-transaction-property` with `{}` (dry-run is the default).
   Record the full JSON: `{ dryRun: true, examined, wouldStamp, perProperty: [{propertyId, propertyName, count}], targetNotPropertyScoped, targetMissing }`.
   **P0 (falsifiable):** `examined > 0` on this account (the year is linked; every linked row today has `propertyId = null`), and `wouldStamp > 0` with ≥1 property in `perProperty`. If `examined = 0`, the forward fix's premise is wrong — FAIL.
2. **Apply:** re-POST with `{ "apply": true }`. Record `{ stamped }`. **P1:** `stamped === wouldStamp` from step 1 (nothing changed between the calls), and an immediate second apply returns `examined` reduced by exactly `stamped` (idempotence — re-run stamps 0).
3. **Export the D-12 pack** (JSON first: `GET /api/bookkeeping/tax-pack/export?fy=FY2025-26&format=json`), then XLSX + PDF for rendering checks.

## Predictions (all falsifiable — each can FAIL independently)

| # | Check | Expected |
|---|---|---|
| P2 | `perProperty` | **Non-empty**: one entry per property that has ≥1 stamped row; Σ over properties of `transactionCount` = the reconciliation's `included` count. Was `[]` at baseline. |
| P3 | `reconciliation` block (new) | Present in the JSON and rendered in XLSX Summary + PDF summary: `transactionsTotal`, `included {count,$}`, `excluded { transfers {count,$}, loanRepayments {count,$}, notPropertyScoped {count,$} }`, and labelling counters `{ noCategory {count,$}, noAtoMapping {count,$} }` (payload field `atoLabelling`). |
| P4 | **The identity** | `included.count + transfers.count + loanRepayments.count + notPropertyScoped.count === transactionsTotal` — holds exactly, and the artefact prints it. (The build hard-asserts this; a violated identity throws rather than exporting a wrong pack.) |
| P5 | Transfers out (MON-169) | The baseline $1,000 transfer sits in `excluded.transfers`, NOT in `totals.incomeGross`/`expenseTotal`. Any loan-linked rows sit in `excluded.loanRepayments`. `totals.*` are now **property-scoped**: `incomeGross` ≤ the baseline $73,497.69 and equals Σ perProperty income; `expenseTotal` equals Σ perProperty expenses. |
| P6 | Nothing silent (MON-170) | `noCategory.count + noAtoMapping.count + (rows with ≥1 label)` accounts for every `included` row. At baseline 379 rows vanished with no counter; now every one is in a named bucket with dollars. |
| P7 | ATO labels | Rows already mapped at baseline that are property-scoped keep their label totals; non-property rows (salary etc.) no longer contribute to labels — each such row is counted in `notPropertyScoped`. |

## mustNotMove
- Property pages (list tile · detail · dialog): rental income, cashflow, tax lines — byte-identical to their pre-fix values (the pack fix reads new fields; it does not touch the property engines).
- The legacy Tax-Time report's PR-2-fixed rows: the $11,385 one-off (once), DIV43 depreciation $12,799 @ 2.5%.
- Master snapshot quick metrics (Home tiles).
- The backfill writes ONLY `UnifiedTransaction.propertyId` on rows where it was `null` — no amount, date, category, or link id changes anywhere (P1's idempotence check doubles as this guard).

## Result format
`matrix-result/v1` JSON (validate with `npm run matrix:check -- <file>` before acting on it), posted to the PR. Include the step-1 dry-run JSON verbatim — it is the movement record D-21 requires.

## Coverage boundary
This run verifies the D-12 pack export + backfill on live data. It does NOT verify the legacy Tax-Time report (its calendar-YTD window and non-property income are separate registered issues), the scoreboard (PR-2), or any hidden-module surface.
