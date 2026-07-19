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

---

## Session: yhm8ug (continuation 2) — Calc-SSOT Wall Mechanism A keystone (Part 1, PR #1458)

### Changes Made
- **Type**: Feature (intake-integrity guardrail — the last unbuilt Calc-SSOT Wall keystone)
- **Scope**: intake classifier + all six Income/Expense mint sites
- **Root Cause** (per CALC_SSOT_WALL.md, anchors re-verified at HEAD `ad1322a9`): reconciliation MINTED new rows instead of updating the canonical one — non-rental income had NO reuse guard (`link/route.ts:474` — Ingeus ×3), expense near-dup was scoped to the exact (property,loan,asset) triple (battery ×3 across scopes), and doc-import income dedup was exact `amount+name+type` (a declared row and its reconciled twin never matched).
- **Solution**: `classifyIntake` gained the `source-signature` stream policy — identity = (kind, type, normalised name, ownerEntityId) over user-wide candidates with the **scope-compatibility rule inside the classifier** (same scope or one side scopeless; two differently-scoped rows never converge — the Reza distinct-sources correction, structural). All six mint sites routed through it; new reuse takes the `:831` update template (amount ← txn, prior → `budgetedAmount`, `lastReconciled`). Manual exact dup → 409 with guidance; onboarding idempotent-skips; doc-import expense stays amount-bounded (pinned doctrine), income converges across amount drift.
- **Recorded deviations** (PR body, not silent): scope-compat instead of blanket unscoped signature; 409-not-silent-update on manual POST (Reza can flip).

### Files Modified
- `lib/intake/classifyIntake.ts` — `source-signature` policy + scopeKey on rows/candidate
- `app/api/transactions/[id]/link/route.ts` — income non-rental signature reuse (update template); expense cross-scope tier
- `lib/documents/intelligence/reconcile/reconcileSuggestedAction.ts` — classifier-driven income/expense dedup (expense amount-bound re-check kept)
- `app/api/income/route.ts` — rental scope-singleton convergence + 409 `DUPLICATE_INCOME_SOURCE` on exact non-rental dup
- `app/api/onboarding/complete/route.ts` — idempotent skip on exact signature
- `tests/golden/ring2.mechanismA.intakeDedup.test.ts` — **NEW** Ring-2 ratchet (real link route; fails pre-fix)
- `tests/intake/classifyIntake.test.ts` — +6 policy unit tests (scope-compat truth table)
- `tests/documents/reconcileSuggestedAction.test.ts` + `tests/utils/mon037RcbNearDuplicate.test.ts` — contract pins re-pointed to the new topology
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — `engine.intake.classifyIntake` + `law.intake.oneRowPerSource` (neobrain domain) + 2 edges
- `docs/architecture/CALC_SSOT_WALL.md` (Mechanism A → BUILT) · `docs/architecture/INTAKE_INTEGRITY_GUARDRAIL.md` §5 (MON-076 brick) · `docs/blueprint/PHASE_54_NEOBRAIN.md` §12.5
- `docs/issues/ISSUES.json`/`.md` — MON-084/085/076 → FIXING (#1458), MON-074 → DIAGNOSED (Part-2 census note)

### Build Status
- [x] TypeScript compiles · [x] Build passes (433 pages) · [x] Full suite 4,137 passed / 69 skipped
- [x] `lint:source-lock` (81, unchanged) · `lint:financial-surfaces` (0 new) · `neomatrix:check` + census (275 nodes, 0 uncovered) · `issues:check` (87 valid)

### Gate (§20.6)
`Gate (§20.6): Document 10/10 (brief + CALC_SSOT_WALL Mechanism A + GUARDRAIL C3 conformed; deviations surfaced) · Requirements 10/10 (six mint sites routed; Part 2 separate + Reza-gated) · Logic 10/10 (one policy one place; truth table unit-tested; real route exercised; the amount-bound doctrine caught by the existing pin and preserved)`
Coverage: golden verifies the link-route create action on a visible in-test mock + the classifier truth table; does NOT verify live rendered counts or browser flows (Matrix Ring-3) and touches NO existing live duplicate (Part 2, per-group Reza approval).

### PR
- PR URL: https://github.com/resadegh/monitrax/pull/1458 (draft — Part 1 guardrail; Part 2 separate after merge)
