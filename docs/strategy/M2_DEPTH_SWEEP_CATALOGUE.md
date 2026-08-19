# M2.6 — Kept-Surface Depth Sweep Catalogue (2026-08-19)

**Method:** static code sweep at `be6ad808` (post PR-1/PR-2 fixes), Opus diagnosis per `BRIEF_M2_CORRECTNESS.md` §E; every claim anchored to `file:line` read at that HEAD. Runtime claims are marked **LIVE-CHECK (Matrix)** — this sweep never rendered a page or touched PROD data.
**Dispositions:** **PR-3** = fixed in #159x (this PR, no numbers move) · **REG** = registered (MON id) for its own fix PR under §23.2.1 · **M3** = depth backlog (M3.6) · **HELD** = hidden-only surface (M2.0/D-20) · **LIVE** = Matrix Ring-3/Chrome item.

## Launch-blocking (Y) findings

| # | Surface | Finding | Sev | Disposition |
|---|---|---|---|---|
| 1 | reconcile→link → pack | `UnifiedTransaction.propertyId` never stamped by any of the 15 link-route update payloads — the D-12 pack's per-property P&L (keyed solely on `tx.propertyId`, `summary.ts:151`) can be EMPTY on a fully-linked year. Property pages unaffected (they key on incomeId/expenseId/loanId) — why it stayed invisible | Critical | **REG MON-168** + LIVE-CHECK 1 |
| 2 | `taxPack/summary.ts` | Pack counts internal transfers + loan repayments as income/expense (`isTransfer` never consulted; canonical `actualCashflow.ts:111` excludes them by design) | Critical | **REG MON-169** + LIVE-CHECK 2 |
| 3 | census scope | The D-12 pack (`buildTaxPackSummary`, the actual launch deliverable) was NOT in the M2.1 census — MON-164 and the Ring-3 handout scoped "the pack" to the legacy `/api/reports` generator only. M2.5 cannot close until the real pack's quantities converge | Critical | **census corrected in this PR** (M2.1 note + handout §Scope-correction) |
| 4 | onboarding wizard | Zero module gating — v1 users were walked through six hidden-module steps (household, entities×2, investments, super, income-expenses), keying data they can never see again | Critical | **PR-3 fixed** (steps carry `moduleKey`, fail-closed filter) |
| 5 | properties/assets/documents/depreciation | API failure rendered the "you have no data yet" empty state (duplicate-entry trap; pain #8) | Critical | **PR-3 fixed** (shared `LoadFailedState`) |
| 6 | wizard `calculateSummary` | A parallel financial engine in the view (net worth/income/expenses/cashflow; raw `minRepayment`, no one-off gate) — the FIRST number a new user sees | High | **REG MON-171** |
| 7 | balances | CASH-type accounts (auto-created by cash quick-add) render in NO section; page Cash total excludes them while canonical `liquidCash` includes them | High | **REG MON-172** + LIVE-CHECK 8 |
| 9 | pack ATO labels | Unmapped/uncategorised rows silently dropped from label totals (`:213/:216`), no "unmapped" bucket — §19.1 breach in the deliverable | High | **REG MON-170** |
| 13 | properties dialog | Local `convertToMonthly` table missing HALF_YEARLY → 6× Budget column | High | **REG MON-173** |
| 14 | property detail | Edit/Delete were dead `<Link>`s to the list page | High | **PR-3 fixed** (Edit deep-link `?edit=` honoured by the list page; Delete = real confirm + DELETE) |
| 15 | OCR loan confirm | Missing rate/term → fabricated 5% / 360 months written to the DB (§19 never-invent breach) | High | **REG MON-174** |
| 16 | documents auto-link | `resolveAutoLinks` is dead code (zero callers); a receipt confirmed from the global scan against a property expense never appeared on that property | High | **PR-3 fixed** (confirm path links doc → PROPERTY via existing `linkDocIfMissing`) |
| 18 | properties dialog loans tab | Raw `minRepayment` per-row next to the engine total (IO = "$0/month" beside a real total) | High | **REG MON-175** |
| 19 | reports page | Two competing pack generators on one page (D-12 pack + legacy tiles routing to the weaker generator); no empty state | High | **PR-3: empty state added.** Tile narrowing = **Reza ruling requested** (D-4 "Reports→one pack" suggests hiding the legacy tiles; flagged as possibly a deliberate transition state) |

## High / not launch-blocking

| # | Surface | Finding | Disposition |
|---|---|---|---|
| 8 | balances `totals` | View-level second producer of liquidCash + loan balance; 2 of 3 reduces invisible to the lint | M3 + lint widening |
| 10 | D-12 pack | Depreciation entirely absent (transaction-driven only) | M3.1 gap |
| 11 | both packs | Per-loan interest exists in NEITHER pack (pain #3) | M3.1 gap |
| 12 | pack builder | N+1: `getMappingsForCategory` inside the per-transaction loop | M3 + LIVE-CHECK 3 |
| 17 | activity | `matchedDocumentId` written but never read by any UI — evidence invisible from the row it substantiates | M3 (M3.2 loop) |
| 20 | properties page | `convertToAnnual` alias + ungated RENTAL sums launder past the lint | **REG MON-176** + lint hardening |
| 21 | LoanDetailDialog | `totalLinkedExpensesAnnual` raw toAnnual, no one-off gate (components/ unscanned) | M3 + lint widening |
| 22 | the lints | Three structural blind spots: components/** unscanned (source-lock), `app/(dashboard)` missing (financial-surfaces), hand-rolled tables/aliases evade both | M3 — the §23.2.2 Ratchet for this class |
| 23 | LoanDetailDialog | `annualInterestFor` = a second (numerically identical) loan-interest producer; M2.1 row "converged" corrected | census corrected; M3 collapse |

## Medium/Low (M3 depth backlog unless noted)

24 detail-page equity/LVR/gain/yield inline (MON-136) · 25 recurring 4.33/2.17 approximations (**REG MON-177**) · 26 /recurring has no nav home · 27 mobile bar = 2 tabs + More (folds into D-16/D-19; LIVE-CHECK 6) · 28 "Recent activity" synthesised, no dates · 29 depreciation breadcrumb ?view= (**PR-3 fixed**) · 30 legacy report ignores its own period window · 31 PDF export stub returns 200 · 32 reports error-parse (**PR-3 fixed**) · 33 activity empty state (**PR-3 fixed**) · 34–36 HELD hidden-only trio (**REG MON-179**: ANNUAL-as-monthly burn ×12, second health score, dual investment valuation) · 37 deductibility assumed true on property link · 38 analyze permission — **corrected: NOT a defect** (the whole documents family rides `report.read`/`report.export`; no `document.*` permission exists) · 39 recurring alert()s + no dark tokens · 40 cash quick-add can't attach a property · 41 retro managed-rental claim stranded on hidden route · 42 property doc-link idempotency (**PR-3 fixed**) · 43 silent write failures on properties (**PR-3 fixed**) · 44 xlsx sheet-name sanitisation gaps · 45 stale GET /api/reports contract · 46 dead computations + "Net Taxable Income" framing (**REG MON-178** for the framing) · 47 Assets step MIXED-only · 48 SIGNED/abs comment (**PR-3 fixed**) · 49 documents folder empty-state CTA.

**(a) Dead links:** clean — the MON-163 guard passes at this HEAD, and a manual check found no kept-reachable file fetching a gated apiPrefix.

## LIVE-CHECK list (Matrix — Ring-3/Chrome)
1. #1 end-to-end: import → link rows to a property → export the pack → is the per-property P&L empty?
2. Pack magnitude of #2/#9: `expenseTotal` vs Σ ATO labels vs transfers-excluded.
3. Pack generation time on Reza's FY volume (the N+1).
4. Vision/OCR live in PROD? (`VISION_NOT_CONFIGURED` path)
5. The empty-state-on-failure class (also verifies the PR-3 fix).
6. Mobile bottom bar at 375px.
7. Onboarding on a fresh v1 account (also verifies the PR-3 gating).
8. Cash FAB → balances page Cash Wallet visibility.
9. Both packs exported side-by-side for one FY, diffed.
10. Global-FAB receipt → property Documents section (also verifies the PR-3 fix).

## Coverage boundary (verbatim from the sweep)
Static read at one commit; no page rendered, no fetch executed, no pack generated, no PROD data touched. Second/third import rings spot-checked, not read line-by-line (`components/bank/*`, `SmartInbox`, `ReviewQueueCards`, settings). Reachability claims rest on import graphs and render conditions read, not clicks. Severity and launch-blocking calls are judgement against D-10/D-12/D-20 — #19 in particular may be a deliberate transition state and is flagged for a ruling, not assumed.
