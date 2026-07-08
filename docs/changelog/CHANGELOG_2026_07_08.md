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
