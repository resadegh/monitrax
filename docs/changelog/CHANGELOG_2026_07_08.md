# Changelog — 2026-07-08

## Session: eloquent-archimedes — MON-025 frequency/recurring logic investigation + plan

### Investigation (agent-verified, file:line)
- Annual QBE car insurance shows $216/mo (should ~$18/mo). Root causes:
  - Reconcile defaults `frequency = body.frequency || 'MONTHLY'` (`link/route.ts:345`); "Where your money goes" trusts the stored declared frequency verbatim (`insights/route.ts:245`). Cadence is NEVER read from the transaction dates.
  - AI/bulk mass-categorisation sets CATEGORY only — hard-codes `isRecurring:false`, `suggestedFrequency:null` (`aiCategorisation.ts:248-250`). No recurring/frequency classification exists.
  - A good cadence detector (`recurringExpenseDetection.ts` — buckets to weekly…annual) is DEAD CODE (no importers).
  - Exact-name dedup misses spelling variants (`link/route.ts:596-607`) → same insurer split into two records with two frequencies.
- Reza requirements (2026-07-08): (a) frequency picker at reconcile; (b) confirm/correct the auto-detected recurring frequency (suggest-and-confirm, never silent).

### Plan (MON-025 — multi-PR workstream)
- Code-first: wire the MON-009 monthly resolver into "Where your money goes"/monthly totals (≥2-payment expenses auto-correct cadence from dates); wire the detector to PROPOSE frequency at reconcile; fuzzy merchant dedup.
- Stitch-first (§18.2.1): frequency picker in the reconcile dialog + a "confirm/change detected frequency" control on auto-detected recurring transactions. Design + ≥9/10 gate + Reza sign-off before build.

SHIPPED (pt.1+2, PR #1345): fuzzy merchant dedup (`lib/bank/merchantNormalize.ts` — QBE two-spelling collapse), detected-frequency suggest-and-confirm pre-fill in the reconcile dialog, and "Where your money goes" now reads each expense's cadence from its transaction dates via the MON-009 resolver. Remaining: link-path frequency editor + inline Activity confirm chip + Stitch backfill. MON-025 → FIXING.

## Session: chat-audit-findings-issues-m9518i

### MON-017 — Safety Net score was fiction on real data → pure engine on canonical inputs

- **Type**: Fix (financial — safety score / emergency fund / recovery)
- **Scope**: new `lib/calculations/safetyScore.ts`; `app/api/safety-net/route.ts`
- **Root cause (verified §19.2)**: the inline safety score awarded "Positive Cashflow 15/15" from a MIXED source (`monthlySurplus = qm.monthlyIncome (declared) − totalMonthlyOutgoings (actual)`, route:58) that read positive while the canonical cashflow was −$6,073/mo; "Bills on time 30/30" for ZERO tracked bills (route:82, `totalBills>0 ? … : 30`); and measured the emergency fund against a hardcoded 3-month target (route:52) while the master snapshot uses 6 — so a fragile position scored ~100/100. Recovery times showed a finite figure only because the mixed surplus read positive.
- **Fix (§12.2.1 / §19.4)**: extracted a pure, tested engine `computeSafetyScore` on CANONICAL inputs only — cashflow dimension reads `qm.monthlyCashflow` (actuals-aware net → a real deficit scores 0), zero tracked bills scores 0 (earn it by tracking bills, not a fabricated 30), emergency-fund coverage + target read from `snapshot.emergencyFund` (6-month target, one source). `monthlySurplus = qm.monthlyCashflow`, so `recoveryWeeks`/`weeksToTarget` return null (not a fabricated timeframe) when cashflow ≤ 0. Recommendation text de-hardcoded (targetMonths).

### §19.2 worked example (verified)

Reza's real case — 11.7 months covered, 0 tracked bills, −$6,073/mo cashflow, 6-month target → emergencyFund `min(11.7/6×40,40)=40` + bills `0` + noNewDebt `15` + cashflow `0` = **55 (FRAGILE)**, not ~100. Marginal deficit (−$200 < cf ≤ 0) → 8; positive → 15. 3 months / 6 target → 20/40. Genuinely strong (6mo, bills, +cashflow) → 100 STRONG.

### §19.4 downstream sweep + convergence

The safety score's cashflow dimension now reads the SAME canonical `monthlyCashflow` as the /cashflow hero + dashboard tile → they converge. Modelled in the Neomatrix: new `engine.safetyScore.computeSafetyScore` + `ui.safetyNet.safetyScore` nodes + `number.monthlyCashflow → computeSafetyScore` feeds edge (A3). Locked by `tests/calculations/safetyScore.test.ts` (7 worked-example asserts + a route drift guard). Builds on MON-013/MON-018 (net worth + cashflow correct at source).

### Known remaining placeholder (flagged, not fabricated by this fix)

`noNewDebt` stays 15/15 (optimistic "assume no new consumer debt") — transaction-based new-debt detection is a separate feature with no data source yet. The 4-colliding-scores labelling (Safety/Health/CFO/Cashflow-health) is a separate cross-surface UX issue. Both flagged as follow-ups, not silently kept as fiction.

### Files Modified

- `lib/calculations/safetyScore.ts` (NEW) — pure `computeSafetyScore` engine.
- `app/api/safety-net/route.ts` — canonical inputs (`snapshot.emergencyFund`, `qm.monthlyCashflow`) + `computeSafetyScore`; removed inline scoring; de-hardcoded target text.
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` + `structural/structural-graph.json` — engine + ui nodes, convergence edge, L0 coverage.
- `tests/calculations/safetyScore.test.ts` (NEW).
- `docs/issues/ISSUES.json` / `ISSUES.md` — MON-017 → FIXING.

### Build status

- [x] `npx tsc --noEmit` — 0 errors. `neomatrix:check` — OK (L0 complete, binding 155/155, census 0 uncovered). `issues:check` — 24 valid. Worked examples independently verified.
- [ ] `npm run test` / `lint:financial-surfaces` — run in CI.

### §12.11 / §20.4

Reads only (`getMasterFinancialSnapshot` + `recurringPayment.findMany`). No destructive write — **NOT REQUIRED**. Self-review **10/10**: v1 fixed the cashflow source; v2 converged the emergency-fund target + bills-on-zero + recovery honesty by extracting one canonical engine; v3 modelled it in the Neomatrix + added worked-example tests, and flagged (not fabricated) the remaining noNewDebt placeholder.

### Plain-English (what was wrong / what changed / what you'll see)

- **Wrong**: your Safety Net scored ~100/100 — it gave full "positive cashflow" marks while you were actually −$6,073/mo, full "bills on time" marks for zero tracked bills, showed a recovery time that wasn't real, and used a 3-month target while Home used 6.
- **Changed**: one honest scoring engine that reads your real (actuals-aware) cashflow and the same 6-month emergency-fund target as everywhere else.
- **You'll see**: the score drops to reflect reality (your case ≈ 55 "Fragile", not 100); "positive cashflow" scores 0 while you're in deficit; bills score 0 until you track bills; recovery shows honestly (no made-up weeks when you're not saving); and the target reads 6 months on both Home and Safety Net.

### PR
- PR: (pending) — draft. MON-017 holds at FIXING until Reza verifies on his data.

---

### MON-018 — My Guide "Monthly Progress" ×0.98 net-worth placeholder → real history

- **Type**: Fix (financial — net-worth trend / savings rate / debt reduction)
- **Scope**: `lib/cfo/intelligenceEngine.ts` `calculateMonthlyProgress`; `app/dashboard/cfo/page.tsx` render; `lib/cfo/types.ts`
- **Root cause (verified §19.2)**: `calculateMonthlyProgress` FABRICATED the card. `lastMonthNetWorth = currentNetWorth × 0.98` (intelligenceEngine.ts:176) → algebraically `(0.02/0.98)×100 = +2.04%` **every month regardless of the user's data**. It also computed `currentNetWorth` inline (omitting investment-account cash + super, holdings at cost), hardcoded `savingsRateChange = 0.5`, and `debtReduction = totalDebt × 0.005`. The savings rate came from declared records (the −39.1% that disagreed with the −30.5% KPI).
- **Fix (§12.2.1 / §19.4)**: net-worth Δ + debt reduction now come from the stored `NetWorthSnapshot` history via the ONE canonical reader `getNetWorthHistory(userId, 2)` — the SAME source as the Home Net Worth Trend tile, so the two converge — and the savings rate comes from the canonical master snapshot (`quickMetrics.savingsRate`, actuals-aware), matching the KPI. `savingsRateChange` is now `null` (honest — no stored savings-rate history to compare) and the UI hides the sub-line. Removed the inline rogue net-worth calc + 5 now-dead record types (§12.1).

### §19.2 worked example

- **Placeholder proof**: `(currentNetWorth − 0.98·currentNetWorth)/(0.98·currentNetWorth)×100 = 0.02/0.98×100 = +2.0408%` — constant, data-independent. Removed.
- **Real Δ**: with stored snapshots [lastMonth nw = N₀, thisMonth nw = N₁], `netWorthChange = N₁ − N₀`, `netWorthChangePercent = (N₁ − N₀)/|N₀|×100`. `debtReduction = liabilities₀ − liabilities₁`. Both **0** (honest) when <2 months of history — no fabricated curve (`getNetWorthHistory` empty-state contract).

### §19.4 downstream sweep + convergence

- The Home Net Worth Trend tile (`app/api/dashboard/charts/route.ts:95`) and the My Guide Monthly Progress card now BOTH read `getNetWorthHistory` → they cannot diverge. Modelled in the Neomatrix: new `ui.cfo.monthlyProgress` node sharing `semanticKey: netWorthTrend` with the Home tile + edge from `number.netWorthTrendDelta` (A3 convergence). Locked by `tests/cfo/monthlyProgressCanonical.test.ts` (placeholders gone + both surfaces read the canonical reader).
- Net worth itself is now correct at source (MON-013 — investment cash included), so the trend is honest end-to-end.

### Files Modified

- `lib/cfo/intelligenceEngine.ts` — rewrote `calculateMonthlyProgress` onto `getNetWorthHistory` + `getMasterFinancialSnapshot`; removed inline net-worth calc + 5 dead record types; updated the Decimal-sibling JSDoc (now a legacy parity fixture).
- `lib/cfo/types.ts` + `app/dashboard/cfo/page.tsx` — `savingsRateChange: number | null`; UI hides the "vs last month" sub-line when null.
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — `ui.cfo.monthlyProgress` node + convergence edge; 2 drifted anchors re-pinned.
- `tests/cfo/monthlyProgressCanonical.test.ts` — new drift guard.
- `docs/issues/ISSUES.json` / `ISSUES.md` — MON-018 → FIXING.

### Build status

- [x] `npx tsc --noEmit` — 0 errors in changed files.
- [x] `npm run neomatrix:check` — OK (schema + A3 invariants + coverage).
- [x] Test assertions verified against source (0 forbidden placeholder patterns; canonical sources present).
- [ ] `npm run test` / `lint:financial-surfaces` — run in CI (local ts-node/vitest unavailable in this container).

### §12.11 destructive-write check

Reads only (`getMasterFinancialSnapshot`, `getNetWorthHistory`). No update/upsert/delete. **NOT REQUIRED.**

### §20.4 self-review — 10/10 (financial build)

3× against requirement (stop fabricating the monthly-progress card; make it match reality + converge with the Home tile): v1 replaced the ×0.98 with `getNetWorthHistory`; v2 also converged savings rate onto the canonical snapshot (killing the −39.1% vs −30.5% split) + real debt-reduction from snapshot liabilities + honest null `savingsRateChange`; v3 removed the dead inline calc/types, modelled the convergence in the Neomatrix, added the drift guard. Every number traced to a source.

### Plain-English (what was wrong / what changed / what you'll see)

- **Wrong**: My Guide showed "net worth +2%" every single month — a placeholder (`this month × 0.98`), not your real trend — plus a fake "+0.5%" savings-rate change and a made-up debt-paydown, and a savings rate that disagreed with your dashboard KPI.
- **Changed**: the card now reads your real saved month-to-month history (the same source as the Home net-worth trend) and your canonical savings rate.
- **You'll see**: the monthly change matches the Home Net Worth trend tile (and your real ~+0.2%, not a fixed +2%); the savings rate matches the dashboard KPI; the "+0.5% vs last month" line is gone until there's real history to compare; a brand-new account honestly shows 0 change, not +2%.

---

### MON-011 — Portfolio equity summed FLOORED per-property equities → overstated by exactly $37,076

- **Type**: Fix (financial — property equity / portfolio equity total)
- **Scope**: `lib/utils/calculations.ts` `calculateEquity`; `app/dashboard/properties/page.tsx` (dedup); Neomatrix
- **Root cause (verified §19.2)**: `calculateEquity` floored at 0 — `return Math.max(0, propertyValue - loanBalance)` (calculations.ts:25, pre-fix). A property that owes more than it's worth (equity −$37,076) counted as **$0**. Because `propertyPortfolioEquity = propertyMetrics.reduce((sum,p)=>sum+p.equity,0)` (masterFinancialService.ts:1961) SUMS per-property equity, the total was overstated by exactly the floored shortfall. It disagreed with net worth (which uses global unfloored Σvalue − Σmortgages at netWorthCalculator.ts:236) and with the properties page (already signed via a local closure), and left `sellProperty`'s `equity < 0` branch dead behind the floor.
- **Fix (§12.2.1 / §19.4)**: `calculateEquity` is now SIGNED — `return propertyValue - loanBalance` — equity is value − loan by definition. `propertyPortfolioEquity` is now signed → converges with net worth's property equity (Σvalue − Σmortgages, always unfloored) and the properties-page total. Deduped the properties page's local equity closure onto the canonical (one source, §12.2.1).

### §19.2 worked example

- **Reza's data**: 6 lots summing to **$2,992,178** floored (Lot 1's −$37,076 clamped to $0). True signed sum = **$2,955,102**. Diff = **$37,076** exactly.
- **Test fixture**: 3 props incl. one −$37,076 underwater → floored sum **900,000** vs signed **862,924** (diff exactly **37,076**); `calculateEquity(750_000, 787_076) === −37_076` (was 0).

### §19.4 downstream sweep + convergence

- **Consumers of the signed number**: `propertyPortfolioEquity` (masterFinancialService.ts:1961) feeds Home My-Wealth equity tiles, `/dashboard/balances`, `/dashboard/cfo`, `app/api/dashboard/hidden-wealth/route.ts`, `lib/cfo/decisionSupport/propertyDecisionSupport.ts`, and MON-012's `lockedLongTerm` bucket. All now read the signed value.
- **Convergence proof (holistic test)**: `tests/calculations/propertyPortfolioEquity.test.ts` asserts `nw.breakdown.propertyEquity === Σ signed per-property equity` — the portfolio total and net worth's property equity are ONE number and cannot diverge.
- **Bonus §19.4 wins**: `sellProperty`'s `equity < 0` warning (DEAD behind the floor) now fires for underwater properties; `insightsEngine` leverage (>200k) correctly never triggers on negative equity.

### Files Modified

- `lib/utils/calculations.ts` — `calculateEquity` floored → signed; expanded MON-011 JSDoc.
- `app/dashboard/properties/page.tsx` — deduped the local equity closure onto the canonical `calculateEquity`.
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — `calculateEquity` node floored→signed (line 24→33); modelled `number.propertyPortfolioEquity` (was a §21.5 blind spot) at masterFinancialService.ts:1961 with feed edge from `calculateEquity`; re-pinned `calculateRentalYield` 34→43.
- `tests/calculations/propertyPortfolioEquity.test.ts` — new §19.2 + §19.4 convergence guard.
- `docs/issues/ISSUES.json` / `ISSUES.md` — MON-011 → FIXING.

### Build status

- [x] `npx tsc --noEmit` — 0 errors in changed files.
- [x] `npm run neomatrix:check` — OK (schema + A3 invariants + coverage; census 0 uncovered, binding 156/156).
- [x] `npm run issues:check` — 25 issue(s) valid.
- [x] Test arithmetic verified via node (−37,076; 900,000 vs 862,924 diff 37,076; convergence).
- [ ] `npm run test` / `lint:financial-surfaces` — run in CI (local ts-node/vitest unavailable in this container).

### §12.11 destructive-write check

Pure calc change (`calculateEquity`) + a render dedup. No update/upsert/delete. **NOT REQUIRED.**

### §20.4 self-review — 10/10 (financial build)

3× against requirement (stop overstating portfolio equity; one signed source that converges with net worth + the properties page): v1 made `calculateEquity` signed; v2 proved the convergence (net worth already unfloored) and deduped the properties-page closure; v3 modelled the blind-spot `number.propertyPortfolioEquity`, added the holistic convergence test, confirmed the two dead-code branches now live correctly. Every number traced to a source.

### Plain-English (what was wrong / what changed / what you'll see)

- **Wrong**: your total property equity read **$37,076 too high** (Home, My Guide, Balances). A property that owes more than it's worth (equity −$37,076) was clamped to $0 before the total was added up, so the negative never subtracted.
- **Changed**: equity is now the true signed value (value − loan) everywhere; the portfolio total, net worth, and the Properties page all read the one source.
- **You'll see**: portfolio equity reads **$2,955,102** everywhere (matching the Properties page), not **$2,992,178**; an underwater property correctly shows negative equity instead of $0.

### PR
- PR: (pending) — draft. MON-011 holds at FIXING until Reza verifies on his data.
