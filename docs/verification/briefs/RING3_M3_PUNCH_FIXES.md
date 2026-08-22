# RING-3 HANDOUT — M3 punch-list PR-2: pack ATO labelling (MON-184) + ONE portfolio-LVR producer (MON-182)

**For:** Matrix HQ (Claude-in-Chrome relay) · **Gate:** MON-182 and MON-184 flip FIXING → VERIFIED only on this run's PASS. The PR-1 display items (MON-180/181/183/186) are verified in the same session via the scoreboard/reports checks below (brief `BRIEF_M3_PUNCHLIST_AND_CLOSEOUT.md` handout).
**Written:** 2026-08-22, BEFORE the fix code (D-21 condition 1 — movement predicted, never discovered).
**Minimum commit:** the punch-list PR-2 merge commit (PR body names it). PROD (or the PR preview) must serve ≥ that SHA before capture.
**Baseline of record:** the Ring-3 PASS verdict on #1601 (comment 2026-08-22, sha `b261d53f`): FY2025-26 · 387 transactions · included 35/$24,980.26 · transfers 39/$55,317.83 · notPropertyScoped 313/$112,635.39 · `incomeGross $14,389.23` · `expenseTotal $10,591.03` · `atoLabelling {labelled: 0, noCategory: 0, noAtoMapping: 35}` · `atoLabels: []` · perProperty 4 entries (Broadbeach 2 · Guildford 12 · HOME 12 · Thornland Lot 1 9) · scoreboard "Portfolio LVR 41.3%" vs properties banner "AVG LVR 40.8%".

## Identity assertion
Same account (`userId 91b6d7ce-…`), FY2025-26 window. If Reza has since imported rows or run the MON-185 data cleanup, the absolute counts may differ — record the observed counts; every prediction below is stated as an invariant that holds at any count. If the data DID move, the mustNotMove comparisons are against a same-data pre/post pair (export once on the old deploy if still reachable, else assert the invariants only).

## Part 1 — §B pack ATO labelling (MON-184)

Export `GET /api/bookkeeping/tax-pack/export?fy=FY2025-26&format=json`.

**Diagnosis being tested (stated for falsifiability):** the 35 included rows carry the UPPERCASE `ExpenseCategory`/`IncomeType` enum values the link route writes as `categoryLevel1` (the #1601 verdict names RATES, INSURANCE, UTILITIES, MAINTENANCE, MODIFICATIONS), level2/subcategory null — while the seed vocabulary was title-case `('Property','Rates')` triples. The fix adds (a) hierarchy fallback `(l1,l2,sub) → (l1,l2) → (l1)` at the ONE lookup in `buildTaxPackSummary`, and (b) seed vocabulary for the legitimate enum values. Ambiguous categories are deliberately NOT force-mapped.

| # | Check | Expected |
|---|---|---|
| B1 | `totals` (incomeGross · expenseTotal · netCashflow · transactionCount) | **Byte-identical** to the #1601 capture (labelling partitions the included rows; it never moves totals). |
| B2 | `reconciliation` identity | Still hard-held: `included + transfers + loanRepayments + notPropertyScoped === transactionsTotal`, dollars too. |
| B3 | `perProperty` | Byte-identical to the #1601 capture (same 4 entries, same counts/dollars — unless Reza's MON-185 cleanup ran, in which case Guildford consolidates and the identity still holds). |
| B4 | `atoLabelling.labelled` | 0 → **N > 0**. Rows whose category is RATES, INSURANCE, UTILITIES or MAINTENANCE now reach a rental-schedule label (21Q / 21V / 21S / 21M). Income rows categorised `RENTAL` reach `Rental income — gross rent` (21F). |
| B5 | `atoLabelling.noAtoMapping` | 35 → **35 − N**, and the residue is EXPLAINABLE: rows whose category is deliberately unmapped — `MODIFICATIONS` (capital-vs-repair is the tax agent's call, never auto-labelled) and `RENT` (the literal collides across the income and expense enums; a direction-blind mapping would mislabel) — plus any category outside the seeded vocabulary. Record the residual rows' distinct `categoryLevel1` values: this listing IS the §B task-1 per-triple diagnosis on live data. |
| B6 | Partition identity | `labelled.count + noCategory.count + noAtoMapping.count === included.count` — still hard-held. |
| B7 | `atoLabels` | [] → populated with rental-schedule lines (21Q council rates · 21V insurance · 21S utilities · 21M repairs/maintenance · 21F rental income if RENTAL rows exist); each label's `totalAmount` = Σ abs amounts of its rows. |

**FAIL conditions:** any B1/B2/B3 byte movement traced to the labelling change · labelled stays 0 · a MODIFICATIONS or RENT row auto-labelled · partition identity broken.

## Part 2 — §C-3 ONE portfolio-LVR producer (MON-182)

**Predicted movement (stated before the code):** the **scoreboard figure moves, the properties-page figure does not.** The canonical basis is the page's: owned properties only (`type !== 'RENTAL'`), property-attached loan principal over owned current value. At the #1601-era capture that is **41.3% → 40.8%** on the scoreboard; the properties banner stays 40.8%. (If Reza's data moved since, the invariant is: both surfaces show the IDENTICAL figure, and hand-recomputing Σ owned-property loan principal ÷ Σ owned currentValue × 100 matches it.)

| # | Check | Expected |
|---|---|---|
| L1 | Scoreboard portfolio tile | LVR figure ≡ the properties banner figure, to the displayed precision. |
| L2 | Properties page banner | Value UNCHANGED from its pre-fix figure (the page's formula became the canonical producer; the arithmetic is identical, only its home moved to `lib`). |
| L3 | Basis labelled | Both surfaces name the basis (owned properties) in their label — no bare "Portfolio LVR" that a reader could mistake for an all-debt ratio. |
| L4 | Hand check | Σ loan principal over owned (non-RENTAL) properties ÷ Σ owned currentValue × 100 = the displayed figure. |

## Part 3 — PR-1 display checks (MON-180/181/183/186; changesNumbers: NO)

1. Dashboard: EOFY tile leads with **FY2025-26** and its not-ready count (35 − N after Part 1's fix — the tile reads the same pack). NOT "All rows Tax-ready".
2. Dashboard: intake tile shows a **number** (0 allowed), not "—".
3. Dashboard: cashflow strip shows **all** properties, worst monthly cashflow first.
4. Reports page: **Financial Overview and Tax-Time tiles GONE**; the accountant-pack card untouched; `/api/money-flow` returns the module-gated 503.

## mustNotMove
- Pack totals / reconciliation identity / perProperty (B1–B3 above are the guard).
- Property pages: list tiles, detail, cashflow figures — byte-identical (no property engine touched).
- Scoreboard: property value + net worth figures (only the LVR mini-stat moves, per Part 2).
- Master snapshot quick metrics.
- Everything in `RING3_M3_PACK_FIX.md`'s mustNotMove list.

## Result format
`matrix-result/v1` JSON (validate with `npm run matrix:check -- <file>` before acting on it), posted to the PR. Include the B5 residual-category listing verbatim — it is the live-data diagnosis record.

## Coverage boundary
This run verifies the pack labelling movement, the LVR convergence, and the PR-1 display fixes on live data. It does NOT verify: XLSX/PDF rendering of the labels (JSON is the contract; rendering follows the same summary object), the M3.1 full ATO-heading restructure (out of scope), hidden-module surfaces (D-20), or the MON-185 data cleanup (Reza's runbook, separate).
