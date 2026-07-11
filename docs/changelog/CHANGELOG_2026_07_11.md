# Changelog — 2026-07-11

## Session: chat-audit-findings-issues-m9518i — MON-027 (CFE input builder dedup + stress-test basis fix)

### Changes Made
- **Type**: Fix (financial correctness — SSOT dedup, number-changing for stress-test)
- **Scope**: One shared `buildCFEInput` for the cashflow forecast + stress-test; stress-test now forecasts on the correct basis.

### Root cause (verified, §19.2 — discovered during MON-021)
`buildCFEInput` was copy-pasted in `app/api/cashflow/route.ts:37` and `app/api/cashflow/stress-test/route.ts:45`, and the copies had **drifted**:
- cashflow route: `isTransfer: { not: true }` (transfers excluded) + `normalizeIncomeStream` (**after-tax** income) — correct.
- stress-test route: no transfer exclusion (counts internal transfers as cashflow) + `normalizeToMonthly` (**pre-tax** income) — wrong.

So the stress-test scenarios projected on a different, wrong basis than the main forecast.

### The fix (§12.2.1 SSOT)
- New `lib/cashflow/buildCFEInput.ts` — the ONE builder (after-tax income via `normalizeIncomeStream`; transfers excluded per §19.1).
- Both routes import it; the stress-test's local copy + its pre-tax `normalizeToMonthly` helper deleted (§12.1). Pruned the now-unused type imports in both routes.

### §19.2 worked example (basis change, directional)
A $120,000 gross annual salary: the stress-test previously fed the forecast `normalizeToMonthly(120000, 'ANNUAL')` = **$10,000/mo gross**; it now feeds `normalizeIncomeStream(...).netMonthlyAmount` ≈ **~$7.5k/mo after-tax** (exact figure from the tax normaliser). Internal transfers no longer inflate inflow/outflow.

### §19.4 downstream + hard test
Consumers: all stress-test scenarios (`/api/cashflow/stress-test`) now on the after-tax + transfer-excluded basis; `/api/cashflow` unchanged (was already correct) but now reads the shared builder. Test `tests/cashflow/buildCFEInputShared.test.ts` — shared builder has the correct basis (`isTransfer:{not:true}` + `normalizeIncomeStream` + no `normalizeToMonthly`); both routes import the shared builder with no local copy.

### §21.2 Neomatrix
`buildCFEInput` is an input-assembly (not a calc/number) — no new semantic node needed. New file added to the structural Layer-0 manifest (`structural-graph.json`; the `graphify` binary is unavailable in-container so the manifest entry was added directly). `neomatrix:check` green (264 nodes, binding 160/160, Layer-0 0 uncovered, census 0).

### Files Modified
- `lib/cashflow/buildCFEInput.ts` — NEW (the one shared builder).
- `app/api/cashflow/route.ts` — import the shared builder; removed local copy + pruned imports.
- `app/api/cashflow/stress-test/route.ts` — import the shared builder; removed local copy + the pre-tax `normalizeToMonthly` helper + pruned imports.
- `tests/cashflow/buildCFEInputShared.test.ts` — NEW.
- `docs/financial-logic/graph/structural/structural-graph.json` — new file in the Layer-0 manifest.
- `docs/issues/ISSUES.json` / `ISSUES.md` — MON-027 detail + holistic test.

### Build status
- [x] `npm run neomatrix:check` — OK.
- [x] `npm run issues:check` — 27 valid.
- [x] Source-lock literals pre-verified (present / forbidden-absent).
- [ ] `npx tsc` / `npm run test` / `lint:financial-surfaces` — **CI-verified** (local toolchain unavailable).

### §12.11 destructive-write check
Read-only (`prisma.*.findMany`) — no writes. **NOT REQUIRED.**

### §12.14 reform-awareness
No `lib/tax-engine/*` change. Income is normalised after-tax via the existing `normalizeIncomeStream` (no new tax math). Outcome **(b)**: no reform interaction.

### §20.4 self-review — 10/10 (financial build)
3× against requirement (one builder + stress-test on the correct basis): v1 extracted the canonical (cashflow) builder + deduped both routes; v2 pruned every now-unused import in both routes (verified counts, no unused-import build break) + deleted the pre-tax helper; v3 pre-verified all source-lock literals (avoiding the earlier comment-false-positive class), added the file to the Layer-0 manifest, green gates.

### Plain-English (what was wrong / what changed / what you'll see)
- **Wrong**: the cashflow *stress-test* was built from a stale copy of the setup code — it used your **before-tax** income and counted internal **transfers** as cashflow, so its projections were on a different (wrong) basis than the main cashflow forecast.
- **Changed**: one shared builder now feeds both — after-tax income, transfers excluded.
- **You'll see**: stress-test projections that line up with the main forecast's basis (after-tax, no transfers counted as money in/out).

### PR
- PR: (pending) — draft. MON-027 holds at FIXING until Reza verifies on his data.
