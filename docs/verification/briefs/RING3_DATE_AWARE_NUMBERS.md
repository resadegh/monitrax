# Ring-3 brief — DATE-AWARE NUMBERS, cross-app (MON-089 / 090 / 091 / 092 + Mechanism A)

**For:** the Matrix (Claude-in-Chrome relay; playbook §3 rules — capture real rendered numbers, never infer)
**Prepared:** 2026-07-20 (v2 — supersedes v1 in the same file) · Code session yhm8ug · after merges #1463–#1469 all §17.2-verified
**Scope:** the complete date/frequency-awareness fix chain. The claim under test: *one producer per figure; every figure date + frequency aware; declared-first; one-offs never wear stream clothing; no silent cadence defaults at intake.*
**Standing cautions:** (1) Reza's data is IN FLUX (rows deleted/re-categorised on 2026-07-20) — check INTERNAL CONSISTENCY between surfaces, don't pin to pre-2026-07-20 baselines for income; flag net-worth/tax/liquid deltas rather than auto-failing them. (2) Reza may have already confirmed Fortnightly on Thornland Lot 1 and/or run duplicate-group merges — read the CURRENT declared frequency/plan from the row itself before judging derived figures.

---

## Part A — The average formula (MON-089: ×N/(N−1) killed; MON-092: same-day guard)

1. **Cadence sanity on every "avg /mo" figure**: for any row with N payments at a roughly regular interval, avg /mo must ≈ payment × (payments-per-year ÷ 12) — a monthly stream ≈ one payment; a fortnightly stream ≈ payment × 26/12. Any avg > ~1.2× a single payment for a MONTHLY stream = the dead ×N/(N−1) bug → FAIL, reopen MON-089. (Reference class: Transportservice.)
2. **Same-day payments (MON-092)**: find/construct a row whose linked payments all share ONE date (reference: the Newsha Javaherygift pair, $800+$700 on 18 May). Its figure must be the **TOTAL counted once** ($1,500) — NEVER a per-day extrapolation ($22,830 class). If the row is a one-off, the cell must read "$X **once** · <date>" (see Part C).
3. **Evidence line**: every avg /mo carries "N payment(s) · last <d MMM>" — the count must equal the row's linked transactions; the date must equal the newest one.

## Part B — Date-aware display, declared-first (MON-090)

4. **"this month · $X"** = the sum of ONLY current-calendar-month transactions for that row ($0 so far when none). Hand-verify one row against Activity.
5. **Amber "Nothing since <date>"** appears ONLY when the newest payment is older than 1.5× the row's OWN frequency interval (monthly ≈ 46d; fortnightly ≈ 21d; weekly ≈ 10.5d). Verify a boundary honestly: Transportservice (last 12 Jun, monthly) shows the chip only from ~27 Jul; Ingeus (fortnightly, last 17 Jun) and Broadbeach (weekly, last 1 Jun) should already show it.
6. **Declared-first**: rows WITH a declared amount → Net Monthly = declared; Variance = avg-vs-declared. Rows with NO declared amount → Net Monthly shows the average marked "avg"; Variance "—". Verify in BOTH the list view and the grouped (Salary/Wages etc.) view — parity is part of the fix.
7. **Group headers**: "received this month · $X" must equal the hand-sum of member rows' this-month values, exactly.
8. **Spending page**: the new Actual column has the same anatomy on both recurring and one-off expense rows; the declared Monthly column + Total Monthly footer are unchanged by the chain.

## Part C — One-offs never wear stream clothing (MON-092, all views)

9. **Label**: a row saved with recurring UNTICKED reads "**One-off**" — never "Monthly" — in EVERY rendering: income list, income grouped view, income detail panel, expenses list column, expenses tile view, expenses grouped view. Check all six (the recurrence class was sibling-view drift).
10. **One-off Actual cell**: "$X **once** · <date>" (total received) — NO "avg /mo", NO "this month so far", NO amber chip, NO variance. Net Monthly reads "— ($X once)".
11. **Run-rate exclusion (regression guard)**: one-offs contribute $0 to group headers' "per month", page totals, /cashflow and tax declared gross (Wall B2) — confirm the Salary/Wages "per month" figure excludes the gift rows.

## Part D — Frequency at intake (MON-091) + Mechanism A guardrail

12. **The frequency selector exists for income**: open a payment → Link Transaction → tick "Recurring income" → a Frequency dropdown appears; with ≥2 same-vendor payments it is PRE-FILLED from the detected cadence with a "Detected <cadence> from N payments" note. Rental included.
13. **Explicit confirmation updates the reused stream**: confirming a cadence on a payment linked to an EXISTING row updates that row's frequency (check the row after — e.g. Thornland Lot 1 → Fortnightly → its plan reads declared × 26/12 ≈ $2,590/mo if declared $1,195) — while the declared AMOUNT is untouched.
14. **The clobber guard**: link a further payment WITHOUT touching the frequency selector (and where no cadence is detected) → the row's stored frequency must NOT change. A corrected Fortnightly row must never silently revert to Monthly.
15. **One row per source (Mechanism A, live-proven)**: categorising more payments to an existing employer/stream NEVER creates a new row — source count stable. Cross-scope guard: Lot-1 vs Lot-2 rent stay separate rows always.

## Part E — Cross-surface consistency (the SSOT claim)

16. A rental's actual-monthly on the property detail/list pages ≡ the income page's "avg /mo" for the same stream (one producer).
17. The link dialog's "Monthly Average" banner ≡ the row's "avg /mo" for that source.
18. Income page July "received this month" totals must not exceed the dashboard's current-month inflow (the dashboard also counts unlinked IN txns — flag only a contradiction, not a gap).

## Part F — Guards (regression watch, flux-aware)

19. Tax page renders; per-member rows present (#1461); no error toasts. Declared tax gross must reflect corrected cadences (a Fortnightly-confirmed rent annualises ×26, not ×12) and EXCLUDE one-offs' phantom months.
20. Safety Net "Liquid savings" still nets credit cards (VR-018 class); loans `resolvedCost` unchanged.
21. Admin → Intake Duplicates loads (no auth error); same-property rental duplicates group; cross-property never; page is otherwise the permanent sentinel (expected empty after cleanup).

**Report format:** per numbered item — PASS / FAIL / N-A(reason) + captured numbers + screenshot refs. File as VR-0NN under docs/verification/runs/; any FAIL → issues:raise with the evidence. Items 1, 2, 9, 13, 14 are the class-killers — prioritise them.
