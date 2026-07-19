# Changelog - 2026-07-19

## Session: yhm8ug (continuation) — MON-031/064 VR-017 re-fix

### Changes Made
- **Type**: Fix (financial correctness — liquidity SSOT)
- **Scope**: liquid-cash producer, emergency fund, CFO emergency-buffer signal
- **Root Cause** (§19.2, executed — corrects the VR-017 hypothesis): #1452 netted `quickMetrics.liquidCash` by subtracting `netWorth.liabilities.creditCards`, which `calculateTotalLiabilities` (`lib/calculations/netWorthCalculator.ts:219`) builds from **LOANS only**. The live Qantas card is a **CREDIT_CARD-typed ACCOUNT** with a −$2,496 balance (VR-007 capture:483), so the subtraction was silently **0** and the canonical figure stayed gross ($304,304) — Safety Net "Liquid savings" and the emergency months (304,304 ÷ 25,973 = 11.7) read it faithfully. Balances' $301,808 was an accident of the buckets' `min(gross, assets.accounts)` (the negative account balance is embedded in `assets.accounts`), which also explains VR-010's inert cards-aware caption. The golden passed because its fixture modelled the card as a **Loan** — F2 (same engine, different inputs) at the fixture level.
- **Solution**: ONE canonical producer `lib/calculations/liquidCash.ts` → `computeLiquidCash(accounts, creditCardLoanTotal)` (+ Decimal sibling): `net = gross(LIQUID_ACCOUNT_TYPES) − [creditCardLoanTotal + Σ max(0, −balance) over CREDIT_CARD accounts]`. Master and the CFO emergency-buffer signal route through it; the inline loans-only netting is **deleted** (culprit removed, §23.2.1). Buckets engine unchanged — its algebra handles account-typed card debt through `assets.accounts` (hand-verified for loan-card / account-card / mixed).
- **§19.2 worked example**: 304,304 − 2,496 = **301,808**; months = 301,808 ÷ 25,973 = 11.62 → **11.6** (was 11.716 → 11.7). §19.1 basis: balances are point-in-time account data; the burn stays actuals-first (`avgMonthlyOutflow`) with declared-recurring fallback — unchanged.

### Files Modified
- `lib/calculations/liquidCash.ts` — **NEW** canonical producer (Float + Decimal), full JSDoc with both-representation rationale + worked example
- `lib/services/masterFinancialService.ts` — inline netting replaced by `computeLiquidCash(data.accounts, netWorth.liabilities.creditCards).net`
- `lib/cfo/scoreCalculator.ts` — emergency-buffer (Float + Decimal) liquid basis via the canonical producer; `LoanData.type` threaded
- `lib/calc-audit/engines/decimal-cfo-score-risk.ts` — frozen Float mirror updated in lockstep; 2 new fixtures (account-typed + loan-typed card netting)
- `lib/calculations/accessibilityBuckets.ts` — param JSDoc: both representations + why only the LOAN component is added back
- `components/balances/HiddenWealthLens.tsx` — stale comment corrected (Safety Net is no longer gross)
- `tests/golden/ring2.liquidCashParity.accountCard.test.ts` — **NEW** Ratchet: the LIVE topology (card as ACCOUNT) with a topology-signature assertion (`liabilities.creditCards === 0`) + I9 months identity on master AND the real safety-net route; **fails on pre-fix code**
- `tests/golden/ring2.liquidCashParity.test.ts` — months-identity + route-months assertions added (the VR-017 blind spot)
- `tests/calculations/liquidCash.test.ts` — **NEW** §19.2 worked examples incl. the exact VR-017 shape
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — `engine.liquidCash.computeLiquidCash` modelled (semanticKey `liquidCash`); `engine.emergencyFund.buildEmergencyFundMetrics` modelled as **CONSUMER**; 4 feed edges; anchors re-pinned (master :1792, buckets :83)
- `docs/financial-logic/graph/structural/coverage-allowlist.json` — new file allowlisted (graphify CLI offline; self-prune note)
- `docs/issues/ISSUES.json` / `ISSUES.md` — MON-031/064: VR-017 retro, corrected root cause, semanticKeys → `engine.liquidCash.computeLiquidCash`, fixPRs += #1455, plain trio refreshed; **both stay FIXING**
- `docs/verification/runs/VR-017.md` — "Addendum — the fix"
- `docs/issues/FIX_PROTOCOL.md` §7 — ledger retro: **fixture-topology F2**; census rule tightened (multi-representation entities: the fixture MUST mirror the live representation and assert its signature)

### Census notes (not changed, recorded)
- `/api/cashflow/intelligence` runway = Σ ALL balances ÷ total outflow — a total-balance runway, different basis by design.
- `lib/health/metricAggregation.ts:129` `calculateLiquidAssets` = positive non-CC cash + shares/ETFs — a scoring-liquidity concept (includes investments); labelling follow-up candidate, untouched (changing it moves health scores with no VR evidence).

### Build Status
- [x] TypeScript compiles (`npx tsc --noEmit`)
- [x] Build passes (`npm run build`)
- [x] Full suite: 4,125 passed / 69 skipped (277 files)
- [x] `lint:source-lock` (81 tracked, unchanged) · `lint:financial-surfaces` (34 grandfathered, 0 new) · `neomatrix:check` + census gate (0 uncovered) · `issues:check` (87 valid)

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (VR-017.md §7 retro + HANDOFF brief + FIX_PROTOCOL §3 — conformed; Neomatrix consulted first) · Requirements 10/10 (brief's "sibling producer" hypothesis corrected to "inert netting input" with executed evidence — recorded, not silently changed) · Logic 10/10 (one producer remains; worked example test-executed; buckets algebra verified across all three topologies)`
Coverage boundary: goldens verify the synthetic account-card + loan-card topologies end-to-end (real master service + real safety-net route) and the exact VR-017 arithmetic; they do NOT verify live rendered numbers — that is the Matrix's Ring-3 re-run. `lib/health` + intelligence-runway bases intentionally NOT converged (different concepts).

### Commit History
| Hash | Message |
|------|---------|
| d32aacbe | fix(liquidity): net BOTH credit-card representations in ONE canonical liquid-cash producer (MON-031/064 VR-017 re-fix) |
| (this) | docs+registry: VR-017 addendum, ledger retro, changelog, plan |

### PR
- PR URL: https://github.com/resadegh/monitrax/pull/1455 (draft — Reza merges → Matrix Ring-3 re-run)
- Status: Open
