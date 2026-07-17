# Changelog - 2026-07-17

## Session: mon-080-managed-rental-activation (Code · Fable 5)

### Changes Made
- **Type**: Fix (MON-080, critical, `changesNumbers: true`) — Phase 59's headline capability did not work on real data
- **Scope**: reconciliation engine (D0) + income PUT retroactive pass & gross gate (D1/D2) + income-page claim UX + Stitch backfill
- **Canonical brief**: `docs/issues/handoffs/HANDOFF_MON-080_managed-rental-retroactive-reconcile.md` (PR #1436) + the Matrix execution wrapper
- **Live evidence (VR-010)**: Reza's Broadbeach — $680/wk declared gross, $2,515/mo net disbursement, gap $432/mo ≈ $5,184/yr **uncaptured**; Total Deductions stuck at $148,519

### §19.2 root cause — EXECUTED-verified (corrects the brief's prime suspect)
The handoff suspected missing WEEKLY→MONTHLY normalisation. **Wrong for N≥2**: executed at pinned HEAD, three monthly dates resolve MONTHLY and land gap $431.67 material — normalisation always existed. The real defects:
- **D0** (`rentalReconciliation.ts:118` pre-fix): the **N=1 fallback** compared the WEEKLY gross ($680) against the MONTHLY deposit ($2,515) → gap **−$1,835** → `material=false` → no card on the very first fresh link.
- **D1** (`app/api/income/[id]/route.ts`): no retroactive reconcile when a stream transitions to MANAGED — the natural order (link deposits, mark managed later) dead-ended; the D4 chip was a passive `<span>`.
- **D2** (`app/dashboard/income/page.tsx`): no gross-integrity gate — MANAGED persisted with gross = net (understates assessable income, ITAA s6-5); type-`RENTAL` streams had **no amount field on Edit** at all.

### The fixes (each judged by the ONE engine, §12.2.1)
- **D0 — deposit-size cadence inference** (in the shared cadence resolver, so Float + Decimal inherit identically): with no explicit cadence and no date evidence, the deposit identifies its own period — the one whose implied agent cut lands in `[0, MAX_PLAUSIBLE_AGENT_SHARE=0.35]` (structurally unique; periods scale ≥2×). Broadbeach N=1 → MONTHLY, gap $431.67, material. No plausible period → old conservative fallback (never a guessed card).
- **D1 — retroactive reconcile**: `buildRetroactiveManagedRentalSuggestion` (latest linked IN deposit as representative + sibling cadence evidence + the `existingDerived` idempotency guard); income PUT returns the suggestion on the MANAGED transition (additive response key) → the income page opens the card immediately; `GET /api/rental-reconciliation?incomeStreamId=` powers the chip; the chip is now a **click-to-claim button**.
- **D2 — gross-integrity gate**: a MANAGED save whose declared amount is not materially distinct from the MEDIAN linked deposit is rejected **422 GROSS_REQUIRED**; the form surfaces rejections (was a silent swallow) with the amount pre-filled (confirm-or-correct); the rent amount field now renders for `RENTAL` too, labelled "Full Rent Amount (before agent fees)" when MANAGED, and no longer force-clobbers frequency to WEEKLY.

### Stitch (§18.2.1/§18.8 — Reza directive 2026-07-17: ALL UI/UX through Stitch, self-review >9/10, then his final review)
- `.stitch/designs/mon-080/reconcile-card-desktop-light.{html,png}` — project `1859462351962811110`, screen `67446f21885549c7a696964eb45969f1`. **Gate: v1 8.5** (tertiary action clipped off the card edge) → one `edit_screens` iteration (action-row wrap, 640px card) → **v2 9.3/10** (vocabulary 9.5 · hierarchy 9.5 · psychology 9.5 · typography 9 · premium 9 · completeness 9 · polish 9). Prompt seeded with §18.7.2 principles + spec §8 tokens. Screen ID in the component JSDoc — closes the Phase 59 flagged backfill.
- Dark variant + D2 form-state screens: generated this session (scores recorded below on landing).

### Ratchets (all merged into CI, Part 23 Ratchet)
- **Ring-0 (D0)**: Broadbeach N=1 fixture — MONTHLY inferred, gap ≈ $432, Float===Decimal; inference-refusal + net-equals-gross zero-gap cases; calc-audit fixture on `property.managedRentalGap`.
- **Ring-2 (D1)**: order-independence golden — `manage→link` == `link→manage` yield the **identical** derived row (`tests/golden/ring2.managedRental.test.ts`).
- **Ring-0 (D2)**: the gate probe shape — declared==net → `!material` (rejected); real gross → material (passes).
- **Ring-1**: wiring lock — retroactive + gate + GET stay wired to the ONE engine (`rentalReconciliationSourceLock.test.ts`).

### Registry
- **MON-080 raised → FIXING** (critical, `changesNumbers`, tracker VR-010; full §19.4 sweep + plain trio + holistic test linked).
- **VR-010 verdicts applied**: MON-075/038/044/046/043/022/033/005/008/032/015 → VERIFIED; MON-053 → CLOSED (2026-07-17); MON-031 root-cause note (stays FIXING). `issues:check` green (80 valid).

### Build Status
- [x] tsc clean · lint:financial-surfaces green (one baseline entry re-pinned 2169→2277 after the form insertions — violation untouched) · neomatrix:check green (engine anchor re-pinned 127→192 + edges, §24.2.6 map-moves-with-the-fix) · issues:check green
- [x] Targeted suites 64/64 (engine + goldens + source-locks + intake)
- [ ] Full `vitest run` — recorded in the PR
- [ ] Vercel preview — proven by CI on push

### PR
- PR URL: https://github.com/resadegh/monitrax/pull/1437 (draft — Reza merge gate)
- Status: after merge + deploy READY → hand back to the Matrix for the per-fix Ring-3 on Broadbeach (card fires ≈ $432/mo without unlink/relink; Total Deductions +$5,184/yr; gross unchanged $2,947/mo; net-only stream blocked until real gross) → MON-080 VERIFIED → unblocks MON-079 → VERIFIED → CLOSED → VR re-baseline.

---

## Session: calc-ssot-wall-part1 (Code · Fable 5)

### Changes Made
- **Type**: Fix (financial correctness) + CI gate + process law wiring
- **Scope**: Calc-SSOT Wall Part 1 (brief: freeze drift + remediate recent-fix drift). Parts A (A1 lint · A2 law wiring · A3 registry) + B (B1 loan-cost-$0 · B2 one-off run-rates · B3 managed-rental double-count) in ONE draft PR (single-branch constraint — deviation from per-part PRs surfaced, precedent #1434/#1437).
- **Root Cause** (per `docs/architecture/CALC_SSOT_WALL.md` + `MATRIX_FIX_DISCIPLINE.md` VR-012): surfaces bypassing canonical producers — raw `minRepayment` cost reads ($0 for interest-only), local `toMonthly(amount, frequency)` with no `isRecurring` gate (one-offs ×12), and `computePropertyCashflow` reading NET agent disbursements as rent while ALSO subtracting the derived fee (fee counted twice; tax counted it once — VR-011 verified tax only).
- **Solution**:
  - **B1**: extracted `resolveLoanMonthlyCost()` (lib/calculations/propertyCashflow.ts:180) as THE per-loan monthly cost (declared cadence-normalised, actuals-first, interest floor `principal×rate/12`, never $0); migrated /dashboard/expenses, cashflow summary+intelligence, CFO scenarios run+context, AI debt-analysis, portfolio snapshot.
  - **B2**: `monthlyRunRate()`/`annualRunRate()` (lib/utils/frequencies.ts:45) — `isRecurring === false` → 0; same six surfaces migrated; expenses one-off tile "counted once, not monthly"; detail dialog $0/mo + once-annually; **Mechanism C**: the Add/Edit Expense form hides the Frequency picker for one-offs ("One-off — counted once, on the date it happens") — §18.2.1 true tweak (single control in an approved section), no Stitch pass required; stored frequency on existing rows stays (no blind backfill — MON-053 lesson) and is calc-inert.
  - **B3**: gross-up at the ONE producer — when a MANAGED stream's rent resolves from actuals, add back the recurring derived `PROPERTY_MANAGEMENT` fee(s) so rent reads GROSS (= tax), fee subtracted once, cashflow = net received. DIRECT + declared-driven streams: no add-back. `rentalMode`/`derivedFromIncomeId` threaded through masterFinancialService (selects, Raw types, `adjustPropertyRentalIncome` + both cf calls) + portfolio snapshot maps.
  - **A1**: `scripts/lint-source-lock.ts` (`npm run lint:source-lock`, in `vercel-build`) — fails CI on inline `toMonthly/toAnnual(row.amount, row.frequency)`, raw `minRepayment` cost reads, `.reduce`-sums over raw income/expense/loan arrays in `app/**/page.tsx` + API routes. Exceptions `.audit/source-lock-exceptions.json` seeded at **84 matches / 35 file-pattern pairs**, line-free `{file, pattern, count}` matching, **ratchet-down-only** (over OR under the count fails). Vitest wrapper `tests/calc-audit/surfaces/lintSourceLock.test.ts` (14 tests).
  - **A2**: MATRIX_FIX_DISCIPLINE wired into CLAUDE.md §0.4 (four clauses on every fix) + §12.2.1 (source-lock in the detection kit) + §20.6 (fix PRs need the 5-item checklist for Logic 10/10); FIX_PROTOCOL.md Stage 1 step 0 (holistic SSOT audit before any fix code); `.github/pull_request_template.md` created (gate line + 5-item checklist + plain trio + doc-sync).
  - **A3**: raised MON-081..086 (all DIAGNOSED, verified pre-fix anchors); re-scoped MON-079/080 notes — "VR-011 verified TAX only; cross-surface Ring-3 not met; stays FIXING".

### §19.2 evidence (B3 worked example — Broadbeach)
Declared $680/wk MANAGED → gross 680×52/12 = **$2,946.67/mo**; agent deposits **$2,515/mo** net; derived recurring fee **$431.67/mo**. Pre-fix: rent=2,515 (net) AND fee subtracted → cashflow 2,083.33 (fee twice, −$5,180/yr wrong). Post-fix: rent=2,515+431.67=2,946.67 gross; expenses=431.67 once; cashflow=**2,515** = net received. Cross-surface identity: `cf.monthlyRent×12 = 35,360 = tax.income.rental`; `tax.taxableIncome = 30,180 = cf.monthlyCashflow×12`; Decimal twin agrees. B1: 500,000×0.06/12 = **2,500/mo** floor (was $0); 700 WEEKLY → 700×52/12 = **3,033.33** (was 700). B2: one-off 11,385 MONTHLY → **0** run-rate (was 136,620/yr). All executed in `tests/golden/ring2.calcSsotWall.test.ts` (9 tests green).

### §19.1 basis
Actuals-first preserved everywhere: the gross-up applies ONLY on the actuals path (`rent.usedActuals`); declared paths unchanged; one-off gate is declared-side only (actuals flows already counted transactions directly).

### Files Modified
- `lib/calculations/propertyCashflow.ts` — B1 extraction + B3 gross-up (types += `rentalMode`, `derivedFromIncomeId`)
- `lib/utils/frequencies.ts` — B2 `monthlyRunRate`/`annualRunRate`
- `lib/services/masterFinancialService.ts` — B3 threading (selects, Raw types, `adjustPropertyRentalIncome(+expenses)`, both cf calls)
- `app/dashboard/expenses/page.tsx` — B1+B2 migration (12 convert sites → canonical; local converters deleted), Mechanism C form, one-off tile/dialog copy
- `app/api/{cashflow/summary,cashflow/intelligence,cfo/scenarios/run,cfo/scenarios/context,ai/debt-analysis,portfolio/snapshot}/route.ts` — B1+B2 migrations (+B3 threading in snapshot)
- `scripts/lint-source-lock.ts` + `.audit/source-lock-exceptions.json` + `tests/calc-audit/surfaces/lintSourceLock.test.ts` + `package.json` — A1
- `CLAUDE.md`, `docs/issues/FIX_PROTOCOL.md`, `.github/pull_request_template.md` — A2
- `docs/issues/ISSUES.json` + `ISSUES.md` — A3 (86 issues)
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — 2 new nodes (`engine.propertyCashflow.resolveLoanMonthlyCost`, `engine.frequencies.monthlyRunRate`) + 6 edges; 2 anchors re-pinned (`computePropertyCashflow` 139→204, `getMasterFinancialSnapshot` 1825→1843)
- `.audit/financial-math-baseline.json` — 2 line-shift re-pins (intelligence 448→463, snapshot 893→900)
- `tests/golden/ring2.calcSsotWall.test.ts` — the Wall ratchet (B1/B2/B3 Ring-0 + Ring-2 identities)

### Coverage (precise — §22.2.4)
The ratchet verifies: the interest floor + cadence normalisation + engine≡standalone identity (B1); the one-off→0 rule + engine-gate identity (B2); the Broadbeach gross-up numbers + cf↔tax identity + DIRECT/declared guards (B3); the source-lock detectors + ratchet both directions + live-repo counts (A1). It does NOT verify: rendered pages/routes end-to-end on live data (cross-surface Ring-3 = the Matrix, on Reza's Broadbeach loan / HOME one-offs / Broadbeach managed cashflow), the remaining 84 tracked bypass sites (ratchet queue), or Mechanism A (MON-084/085 — open, next Wall part).

### Build Status
- [x] tsc clean · [x] `lint:financial-surfaces` green (34 grandfathered) · [x] `lint:source-lock` green (84 tracked) · [x] `neomatrix:check` green (270 nodes) · [x] `issues:check` green (86) · [x] targeted vitest green (Wall 9/9, golden+calculations 379/379, source-lock 14/14) · [ ] full suite (running) · [ ] `npm run build` (pre-push)

---

## Session: vr013-loan-cost-actuals-first (Code · Fable 5)

### Changes Made
- **Type**: Fix (financial correctness — cross-surface Ring-3 FAIL handback)
- **Scope**: MON-081 (VR-013 F1+F2) — loan cost actuals-first on every surface; VR-013 registry verdicts applied.
- **Root Cause** (verified §19.2): the #1440-migrated surfaces called `resolveLoanMonthlyCost` with NO transactions (same-engine-different-inputs, FIX_PROTOCOL §1 F2). Property path fed linked repayments → $1,191 actuals; expenses/overview/cashflow/CFO/snapshot fell to the floor → $1,271. NOT an FY filter in the resolver (verified — the FY-scoped "Interest this FY" card is a separate labelled metric feeding nothing).
- **Solution** (ACTUALS-FIRST per Reza 2026-07-17): new `lib/services/loanCosts.ts` — THE transaction feed (linked repayments over the ONE `propertyActualsWindowStart()` trailing-12-month window → the canonical resolver). Fed into: `/api/loans` (attaches `resolvedCost`; expenses page + LoanDetailDialog read it — client fallback only while loading), cashflow summary + intelligence, CFO scenarios run + context, AI debt-analysis, portfolio snapshot. Overview card headlines the actuals-first monthly with basis label ("from linked repayments" / "declared repayment" / "interest floor (no repayment linked or set)"); balance×rate relabelled "contractual estimate". Expenses caption never claims "no repayment set" when repayments are linked.

### §19.2 evidence (executed — tests/golden/ring2.calcSsotWall.test.ts VR-013 describe, 13/13 green)
Broadbeach: 228,000 × 0.0669 / 12 = **1,271.10 floor**; linked repayments 1,131 (18 May) + 1,295 (18 Jun) → (2,426/62)×30.4375 = **1,190.97/mo actuals** — actuals win, `usedActuals=true`, floor stays as `monthlyInterest` reference. Window check: `propertyActualsWindowStart(2026-07-17)` = 2025-07-17 keeps both prior-FY repayments (an FY filter would keep 0 → the VR-013 divergence). Engine≡standalone identity with the same transactions.

### Files Modified
- `lib/services/loanCosts.ts` (NEW) — the feed service (`resolveLoanCostsForUser`, `totalLoanMonthlyCost`)
- `app/api/loans/route.ts` — attaches `resolvedCost` per loan (+ annotated feed line)
- `app/dashboard/expenses/page.tsx` — reads `resolvedCost`; basis-aware caption
- `components/loans/LoanDetailDialog.tsx` — "Monthly Loan Cost" card: actuals-first headline + basis + "contractual estimate" secondary
- `app/api/{cashflow/summary,cashflow/intelligence,cfo/scenarios/run,cfo/scenarios/context,ai/debt-analysis,portfolio/snapshot}/route.ts` — fed via the service
- `tests/golden/ring2.calcSsotWall.test.ts` — VR-013 ratchet (4 tests)
- `.audit/source-lock-exceptions.json` — ratcheted DOWN 84→80 (4 paid-down reduces); 1 annotated feed line
- `.audit/financial-math-baseline.json` — 2 line-shift re-pins (464, 904)
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — `orchestrator.loanCosts.resolveLoanCostsForUser` modelled (+2 edges); portfolioSnapshot.GET anchor re-pinned; `structural/coverage-allowlist.json` += loanCosts.ts (graphify CLI offline — self-prune note)
- `docs/issues/ISSUES.json`/`.md` — MON-079/080/082/086 → VERIFIED (VR-013 PASS); MON-081 FIXING + VR-013 FAIL note + secondary-A folded; MON-083 FIXING + form-check note; test fields normalised to `path#fragment`
- `docs/verification/runs/VR-013.md` (NEW)

### Coverage (precise — §22.2.4)
Verifies: the actuals-vs-floor resolution on the exact Broadbeach vectors, the trailing-12-month (not FY) window semantics, engine≡standalone identity, source-lock ratchet-down. Does NOT verify: the rendered surfaces on live data (the Matrix re-runs the cross-surface Ring-3 after Reza merges — MON-081 stays FIXING until then), the prisma fetch inside `loanCosts.ts` (allowlisted from Layer-0; exercised only via the routes), master's declared-plan aggregates (`calculateCashflow`/`aggregateLoanRepayments` — a documented declared-basis producer, ratchet-queue candidate), or F3/secondary-C (separate PR).

### Build Status
- [x] tsc clean · [x] lint:financial-surfaces green (34 grandfathered) · [x] lint:source-lock green (80 tracked — DOWN from 84) · [x] neomatrix:check green (271 nodes) · [x] issues:check green (86) · [x] golden+calculations+lint suites 472/472 · [ ] full suite + build (pre-push)
