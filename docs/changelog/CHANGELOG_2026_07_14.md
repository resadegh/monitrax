# Changelog — 2026-07-14

## Session: chat-audit-findings-issues-m9518i (continued) — VR-002 + two-phase Ring-3 brief

### Change: VR-002 real-data run (fixes verified) + restructure the Ring-3 brief into Phase 1 (capture) / Phase 2 (staged analysis)

- **Type**: Docs (NeoAudit Ring-3) — verification record + brief restructure (Part 23 §23.2 rule 4)
- **Scope**: `docs/verification/runs/VR-002.md` (new), `docs/verification/VERIFICATION_PLAYBOOK.md`
  (§3.3 brief + §3.5 Phase-2 procedure + new §3.6 two-phase model),
  `docs/implementation/01_ACTIVE_WORKSTREAMS.md` (decision + VR-002 result)
- **Why**:
  1. Reza ran the Chrome-relay brief on his PRODUCTION account — this captures the
     result (VR-002) and its comparison vs BASELINE.md. **Headline: every baseline
     delta is an expected fix-shipped convergence — MON-028/029/030/017 confirmed
     working on live data.** MON-030 (the one pending his live eyeball) is confirmed:
     CFO 50/C == Home 50/C, bars = the 7 warm categories.
  2. Reza's holistic insight (2026-07-14): *"Monitrax is a holistic tool, so all
     numbers are meaningful as a whole … after a complete sweep you can perform
     checks in stages (considering holistic numbers)."* A single agent task that
     captures AND analyses the whole app shortcuts on a long sweep (VR-002 nearly
     skipped sidebar items). The fix is NOT to chunk the sweep (that breaks the
     cross-surface comparisons) — it's to split by KIND of work.
- **Solution**:
  - **VR-002.md** — the run + a Part-F diff table (every delta bucketed) + verdicts
    (MON-028/029/030/017 verified) + the Phase-2 findings (F1–F7: MON-031 still open;
    new HOME home-tile cashflow + HOME yield triple-discrepancy; one-offs-as-monthly
    critical; 104% refinance; Month-End Δ68; minor display items) + disposition.
  - **Playbook two-phase restructure:** Phase 1 (the Chrome relay, §3.3) is now framed
    as COMPLETE CAPTURE only — open everything, record every number, fill a mandatory
    `coverage` checklist (per-sidebar true/false + `skipped[]`) so any skip is visible;
    the MACHINE REPORT is the primary deliverable (human MISMATCH judgments are a
    secondary signal — Phase 2 recomputes). Phase 2 (§3.5) is the comparing session's
    STAGED holistic analysis over the complete dataset (net-worth ties → cross-surface
    parity → story convergence → edge cases → baseline diff + MON verdicts). New §3.6
    documents the model + the rule: capture is whole/one-pass, staging happens in the
    analysis, never the capture.
  - **Implementation plan:** the two-phase model recorded as a DECISION ("DO NOT
    DRIFT") + the VR-002 result on the NeoAudit workstream.

### Files Modified
- `docs/verification/runs/VR-002.md` — new (run + comparison + verdicts + findings)
- `docs/verification/VERIFICATION_PLAYBOOK.md` — §3.3 capture framing + `coverage` schema
  field; §3.5 Phase-2 staged procedure; §3.6 two-phase model
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — two-phase decision + VR-002 result

### Build Status
- [x] Doc-only — no code/test surface touched

### Gate (§20.6)
- Document 10/10 (doc: VERIFICATION_PLAYBOOK.md §3.6 + NEOAUDIT §3–§4 — the two-phase
  split matches Reza's holistic directive; brief edited in a PR per §23.2 rule 4;
  VR-002 follows the §3.4 baseline-diff discipline) · Requirements 10/10 (delivers the
  two-phase brief Reza asked for + documents the plan in the implementation plan before
  handing over the brief, exactly as instructed) · Logic 10/10 (the baseline diff is
  arithmetic against the recorded BASELINE.md; verdicts cite the captured figures;
  capture stays one-pass/holistic — the coverage checklist enforces completeness without
  chunking).
- **Coverage boundary (honest — §22.2.4):** VR-002 VERIFIES the fixes on the numbers
  Chrome actually read on Reza's account this run; it does NOT re-derive every figure
  from first principles (that's the Phase-2 per-property recompute, done for the
  flagged ones). The brief restructure changes the METHOD; it verifies nothing itself.
  The registry follow-through (flip MON-028/029/030 → VERIFIED, file F2/F3, investigate
  F4/F5/F6) is a separate PR that cites VR-002.

## Session: chat-audit-findings-issues-m9518i (continued) — VR-002 registry disposition

### Change: flip the verified fixes → VERIFIED; file the new findings as MON tickets

- **Type**: Issue registry (NeoAudit §19.5) — documenting the VR-002 outcome
- **Scope**: `docs/issues/ISSUES.json` (+ generated `ISSUES.md`)
- **Why**: Reza directive 2026-07-14 — *"document all these issues and the fixes."* The
  registry is the ONE issue list (§19.5 SSOT), so VR-002's outcome is recorded there,
  not in a parallel doc.
- **Solution**:
  - **VERIFIED (Ring-3 confirmed on Reza's live data, VR-002 is the §23.2-rule-3
    evidence):** MON-028 (property detail cashflow/yield == list == Home), MON-029
    (savings rate one value −30.5%), MON-030 (CFO 50/C == Home 50/C, 7 warm bars),
    MON-017 (Positive Cashflow 8/15, Safety 70→63). Each already carried the §19.4
    holistic test + a resolving Neomatrix semanticKey + downstream sweep + fix PRs — the
    registry gate enforces that a number-changing issue cannot reach VERIFIED without
    them (validated: `npm run issues:check` = 39 valid; `tests/issues` = 16 pass).
  - **Still FIXING:** MON-031 (liquid-savings $2,496 gap — VR-002 confirms still
    present); MON-021 (a $68 Month-End residual noted, F6 — pending investigation).
  - **New OPEN findings filed via `npm run issues:raise`:** MON-035 (F2 — HOME
    home-tile cashflow Δ6,040), MON-036 (F3 — HOME yield triple-discrepancy), MON-037
    (F4 — **critical**: one-offs shown as monthly + apparent Battery duplicate), MON-038
    (F5 — refinance offered on 104% LVR), MON-039 (F7 — minor display cluster). Each is
    OPEN with the VR-002 evidence in `notes`; rootCause + semanticKeys get the §19.2
    investigation in the rectification phase.

### Files Modified
- `docs/issues/ISSUES.json` — 4 → VERIFIED, MON-021 residual note, 5 new OPEN (MON-035..039)
- `docs/issues/ISSUES.md` — regenerated

### Build Status
- [x] `npm run issues:check` — 39 issues valid (the VERIFIED gate enforced test+key+sweep+PR)
- [x] `npx vitest run tests/issues` — 16 pass

### Gate (§20.6)
- Document 10/10 (registry follows §19.5 lifecycle + §23.2 rule 3 — VERIFIED cites the
  VR-002 Ring-3 run; findings filed in the ONE registry, not a parallel list) ·
  Requirements 10/10 (does exactly "document all these issues and the fixes"; keeps the
  unfixed ones open) · Logic 10/10 (VERIFIED flips are gate-valid — proven by
  issues:check + the registry vitest; new findings are OPEN pending §19.2 diagnosis).
- **Coverage boundary (honest — §22.2.4):** this DOCUMENTS the VR-002 disposition in the
  registry; it FIXES nothing (rectification is a later phase, after NeoAudit is finished
  and VR-003 compiles the complete list). The VERIFIED flips rest on VR-002's live-data
  confirmation, not on a re-derivation of each number here.

## Session: chat-audit-findings-issues-m9518i (continued) — §8 step-6: Tier 2 combinatorial oracle

### Change: Tier 2 — mutate golden fixtures + compare the real snapshot to an INDEPENDENT Decimal oracle

- **Type**: Test infra (NeoAudit §2 Tier 2) — §8 step-6 (4th of 6)
- **Scope**: `tests/golden/tier2/snapshotOracle.ts` + `mutations.ts` + `tier2Oracle.test.ts` (new)
- **Why**: NEOAUDIT §2 Tier 2 — the engine must never be checked against itself. A
  second, independent derivation compared across many mutated fixtures catches the
  COMBINATION / composition / mapping bugs no single enumerated example can.
- **Solution**:
  - `snapshotOracle.ts` — `deriveOracle(rows)`: a from-scratch **Decimal** re-derivation
    of the snapshot headline numbers (net worth + asset/liability components, monthly
    income/expenses/repayments/cashflow, savings rate). Shares NO code with the service
    — re-encodes the documented rules directly (SMSF/SOLD exclusions; recurring-only
    monthly expenses; frequency factors from periods-per-year). `@/lib/decimal`.
  - `mutations.ts` — ~30 deterministic mutations across freq × ownership × loan type ×
    one-offs × negative equity × entity-mix, plus a combined case.
  - `tier2Oracle.test.ts` — (1) ANCHOR: `deriveOracle(golden)` == the hand-computed
    `EXPECTED` (ties the oracle to the §19.2 hand computation *before* it judges the
    engine — not a §22 hidden mini-engine); (2) production == oracle on the golden base;
    (3) production ≈ oracle on every mutation; (4) two negative controls.
  - **§19.2 finding during the build:** the oracle first modelled a CREDIT_CARD *account*
    as a liability; reading `netWorthCalculator.ts:216-221` proved the engine treats all
    accounts as assets and takes credit-card DEBT from CREDIT_CARD *loans* — the ORACLE
    was corrected to match (engine confirmed correct, not a bug). Verified in source, not
    guessed.

### Files Modified
- `tests/golden/tier2/{snapshotOracle,mutations}.ts` + `tier2Oracle.test.ts` — new (41 tests)
- `docs/blueprint/NEOAUDIT.md` — §8 step-6 Tier 2 landed + backlog trimmed

### Build Status
- [x] `npx vitest run tests/golden` — 16 files, 142 tests pass (incl. the new 41)
- [x] `npm run neomatrix:check` — OK (no graph node touched; runs the existing engine + an independent oracle)

### Gate (§20.6)
- Document 10/10 (doc: NEOAUDIT §2 Tier 2 — independent oracle + mutation axes exactly as
  specified; §8 step-6 named component) · Requirements 10/10 (implements Tier 2; honest
  scope stated) · Logic 10/10 (oracle anchored to the §19.2 manifest THEN to the engine;
  the credit-card discrepancy was root-caused in source and fixed in the ORACLE, not
  papered over; SSOT — reuses the ONE golden harness, no parallel platform per §22;
  negative controls prove it can fail).
- **Coverage boundary (honest — §22.2.4):** verifies the HEADLINE snapshot numbers agree
  between the real service and an independent Decimal derivation across the mutation
  matrix. Does NOT cover PAYG-gross income, rental fragmentation, actuals, tax, or the
  GRDCS relational layer (other rings/harnesses).

## Session: chat-audit-findings-issues-m9518i (continued) — §8 step-6: full Release Scorecard CLI

### Change: `npm run neoaudit:scorecard` — the publish-gate readout, gateable in CI

- **Type**: Tooling (NeoAudit §6 Release Scorecard) — §8 step-6 (5th of 6)
- **Scope**: `scripts/neoaudit/scorecard.ts` (new) + `package.json` (`neoaudit:scorecard`)
- **Why**: the Scorecard existed only as an in-panel summary (`summarizeScorecard`,
  rendered at `/admin/neoaudit`). §6 wants a single generated publish readout that a
  release workflow can gate on. This makes it a CLI with a real exit code.
- **Solution** — a ts-node CLI (same pattern as `lint:financial-surfaces`) that:
  - **reuses the ONE producer** `summarizeScorecard` from `lib/verification/scorecard.ts`
    (no second producer — §12.2.1); it reads `docs/issues/ISSUES.json`, computes the
    registry half (OPEN number-issues, listed), and NAMES the external signals it can't
    self-verify (Rings 0–2 CI · R3-self on live data · latest VR run vs baseline ·
    Stryker) — §22.2.4 gate output, never a bare "safe to publish";
  - **exits 1 when the registry half is unclean, 0 when clean** — so a release job that
    `needs:` the ring jobs (only runs once Rings 0–2 are green) turns the whole picture
    into one go/no-go;
  - points at the newest `docs/verification/runs/VR-*.md` for the VR-clean check.
  - The gate logic (`summarizeScorecard`) is already locked by
    `tests/verification/scorecard.test.ts` (4 tests); the CLI is a thin, run-validated
    formatter over it.

### Files Modified
- `scripts/neoaudit/scorecard.ts` — new (the CLI)
- `package.json` — `neoaudit:scorecard` script
- `docs/blueprint/NEOAUDIT.md` — §8 step-6 Scorecard landed + backlog trimmed (Stryker only left)

### Build Status
- [x] `npm run neoaudit:scorecard` — runs; exits 1 on the current registry (24 OPEN
      number-issues incl. the VR-002 findings), 0 when clean (verified via summarizeScorecard)
- [x] `npx vitest run tests/verification/scorecard.test.ts` — 4 pass

### Gate (§20.6)
- Document 10/10 (doc: NEOAUDIT §6 — reuses the ONE `summarizeScorecard`, names externals
  per §22.2.4; §8 step-6 component) · Requirements 10/10 (makes the panel-only summary a
  CI-gateable publish check; no gold-plating) · Logic 10/10 (SSOT — no second producer;
  exit-code contract verified both paths; the gate logic is already unit-tested).
- **Coverage boundary (honest — §22.2.4):** the CLI COMPUTES only the registry half; the
  four external signals are NAMED for the operator/CI to confirm, never self-reported
  green. It does not itself run the rings, the R3-self invariants, the VR diff, or Stryker.

## Session: chat-audit-findings-issues-m9518i (continued) — §8 step-6: Stryker weekly (NeoAudit COMPLETE)

### Change: Stryker weekly mutation job — the last step-6 item; NeoAudit core build complete

- **Type**: CI tooling (NeoAudit §7 Guard-tests node) — §8 step-6 (6th of 6)
- **Scope**: `stryker.conf.json` (new) + `.github/workflows/stryker-weekly.yml` (new)
- **Why**: NEOAUDIT §7 — prove the test suite would actually catch a broken formula in
  the canonical financial engines. A surviving mutant is a test gap → a MON ticket.
- **Solution**:
  - `stryker.conf.json` — SCOPED to `lib/calculations` + `lib/tax-engine` + `lib/health`;
    **command runner `npm test`** (deliberately reuses the known-good
    `vitest run --no-file-parallelism` invocation — sidesteps the vitest-runner
    peer-compat question AND the Prisma concurrent-construction flake documented in
    tests.yml); incremental; **report-only (`break: null`)** so it NEVER blocks a PR.
  - `.github/workflows/stryker-weekly.yml` — weekly Sunday cron + `workflow_dispatch`;
    Stryker installed **ad-hoc at job time** (`npm i --no-save`) so it stays OUT of
    package.json / package-lock.json (zero main-build impact); uploads the report;
    prints the surviving-mutant → `issues:raise` triage command.

### Files Modified
- `stryker.conf.json` + `.github/workflows/stryker-weekly.yml` — new
- `docs/blueprint/NEOAUDIT.md` — §8 step-6 Stryker landed + **step-6 COMPLETE (6/6)**

### Build Status
- [x] Static validation: `stryker.conf.json` valid JSON (command runner, break null,
      6 mutate globs matching 26 real engine files); workflow YAML well-formed (no tabs)
- [ ] Mutation RUN — NOT executed in-session (minutes–hours); first run is the weekly
      cron or a manual `workflow_dispatch` kick. **This is the honest boundary.**

### Gate (§20.6)
- Document 10/10 (doc: NEOAUDIT §7 — scoped to the named engines, surviving-mutant→MON,
  weekly/non-blocking exactly as the tooling register specifies) · Requirements 10/10
  (implements the approved Stryker adoption; ad-hoc install keeps the main build
  untouched) · Logic 10/10 (command runner reuses the known-good test invocation — the
  robust choice; report-only can't block a PR; validated what's validatable in-session).
- **Coverage boundary (honest — §22.2.4):** the config + workflow are AUTHORED and
  statically validated; the mutation run is NOT executed here. Kick `workflow_dispatch`
  once to validate the toolchain end-to-end before relying on the weekly cadence.

### NeoAudit build status
**§8 steps 1–6 COMPLETE — the NeoAudit core build is done.** Step 7 (Argos/axe/
DevTools-MCP/Checkly) stays deferred by design (only on a §7 trigger). Next: VR-003 —
the comprehensive two-phase Chrome sweep to compile the complete issue list.

## Session: chat-audit-findings-issues-m9518i (continued) — NeoAudit is a LIVE system (the growth loop)

### Change: codify "every Chrome/Ring-3 finding is promoted into the NeoAudit structure; NeoAudit is never done"

- **Type**: Governance / docs — a standing principle (plan + handbook + law)
- **Scope**: `docs/blueprint/NEOAUDIT.md` (new §10 + §0 pointer + §9(g)) + `CLAUDE.md`
  (§23.2 rule 6) + `docs/implementation/01_ACTIVE_WORKSTREAMS.md` (LIVE workstream + decision)
- **Why**: Reza directive 2026-07-14 — *"any issue found through the Claude Chrome brief
  needs to be added to the NeoAudit structure for future tests. As planned NeoAudit is a
  live system that needs to keep getting better and more complete for auditing Monitrax."*
  The mechanism already existed (the Ratchet), but the LIVING-SYSTEM framing — NeoAudit is
  never "closed", every Chrome finding grows the permanent structure, coverage marches to
  100% — needed to be explicit in the plan, the handbook, and the law.
- **Solution**:
  - **Handbook (`NEOAUDIT.md`)** — new **§10 "The growth loop — NeoAudit is a LIVE system,
    never done"**: the mandatory feedback loop (file → root-cause → **PROMOTE into the
    lowest permanent ring via the Ratchet** → model + grow coverage), the consequence
    (automated rings GROW, the Chrome brief SHRINKS), and "the workstream is standing,
    never closed." A §0 operator-guide pointer + a §9(g) reviewer-rejection (fix without
    promotion = incomplete).
  - **Law (`CLAUDE.md` §23.2 rule 6)** — the living-system rule, quoting the directive:
    every Chrome/Ring-3 finding is ADDED TO THE STRUCTURE for future tests; a finding fixed
    but not promoted is an incomplete fix; NeoAudit's coverage only grows for the life of
    the product. (§23.3(b) already rejects "closes a Ring-3 bug without its Ratchet test".)
  - **Plan (`01_ACTIVE_WORKSTREAMS.md`)** — the NeoAudit workstream is now **STANDING/LIVE,
    never closed**; the directive recorded as a DO-NOT-DRIFT decision.

### Files Modified
- `docs/blueprint/NEOAUDIT.md` — §10 growth loop + §0 pointer + §9(g)
- `CLAUDE.md` — §23.2 rule 6 (living system)
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — LIVE workstream + growth-loop decision

### Build Status
- [x] Doc/governance only — no code/test surface touched

### Gate (§20.6)
- Document 10/10 (the growth loop = the existing Ratchet made explicit as a living-system
  principle; placed in plan + handbook + law exactly as Reza asked; no new mechanism
  invented — reuses issues:raise + the Ratchet + the parity coverage ratchet) ·
  Requirements 10/10 (adds it to the plan and the handbook, and reinforces the law for
  "always followed") · Logic 10/10 (consistent with §23.2 rule 2 + §5 coverage ratchet +
  §21.2.1; no duplication — points at the one finding bus + the one Ratchet).
- **Coverage boundary (honest — §22.2.4):** this is a governance/doc change — it codifies
  the standing principle; it adds no test itself. The principle is ENFORCED by the existing
  §23.3(b) reviewer rule + §9(g) + the registry gate (a number-changing issue can't reach
  VERIFIED without its holistic test).

## Session: chat-audit-findings-issues-m9518i (continued) — VR-003 (Phase 2) + complete list + rectification plan

### Change: VR-003 comprehensive sweep analysed; 4 new findings filed; root-cause-clustered rectification plan

- **Type**: Docs (NeoAudit Ring-3) — verification record + registry + rectification plan
- **Scope**: `docs/verification/runs/VR-003.md` (new), `docs/verification/baselines/BASELINE.md`
  (accepted VR-003 as the new post-fix baseline), `docs/issues/ISSUES.json` (+ `ISSUES.md`)
  (4 new MONs), `docs/implementation/01_ACTIVE_WORKSTREAMS.md` (rectification workstream)
- **Why**: Reza ran the comprehensive two-phase Chrome sweep (VR-003, `coverage.everyEntityOpened:
  true`). This is the Phase-2 analysis + the complete issue list + the root-cause-clustered
  plan to rectify he asked for.
- **Solution**:
  - **VR-003.md** — Phase-2 staged analysis: **the fixes HOLD** (MON-028/029/030/017 still
    converged, no regression vs VR-002); re-confirmed the open findings (MON-031/035/036/037/038);
    the §19.4 downstream note that **MON-037 is the hub** (one-offs/duplicate expenses inflate
    HOME cashflow, tax deductions → understated tax, and the expense-card basis).
  - **4 new findings filed** (`issues:raise`): MON-040 (tax recommendations "save 3685%"/$6.27M),
    MON-041 (vehicle depreciation % / appreciation mislabelled), MON-042 (household vehicle count
    4 vs 5), MON-043 (income basis Home/Activity/Tax). Known/accepted items ($1 rounding, savings
    −31% display, totalMonthlyExpenses basis = a MON-037 symptom) NOT re-filed.
  - **BASELINE.md** — accepted VR-003 as the new post-fix baseline (all open items annotated).
  - **Rectification plan** — a new `0·RECTIFY` workstream: 6 root-cause clusters in fix order,
    highest-leverage first (① expense-frequency/one-offs/duplicates = MON-037+023+025 hub;
    ② cashflow cross-surface; ③ yield; ④ liquidity; ⑤ tax/recommendation sanity; ⑥ display).
    Each fix REMOVES the culprit + PROMOTES a lower-ring test (growth loop) + Ring-3 re-verify.

### Files Modified
- `docs/verification/runs/VR-003.md` — new (run + Phase-2 analysis)
- `docs/verification/baselines/BASELINE.md` — VR-003 accepted as baseline
- `docs/issues/ISSUES.json` (+ `ISSUES.md`) — MON-040..043 filed
- `docs/implementation/01_ACTIVE_WORKSTREAMS.md` — 0·RECTIFY workstream (clustered fix order)

### Build Status
- [x] `npm run issues:check` — 43 issues valid

### Gate (§20.6)
- Document 10/10 (VR-003 follows §3.4/§3.5 two-phase discipline; complete list = the ONE
  registry; clusters grounded in the captured findings) · Requirements 10/10 (delivers the
  Phase-2 analysis + complete issue list + rectification plan Reza asked for) · Logic 10/10
  (baseline diff is arithmetic; new-vs-existing disposition avoids double-filing; clusters
  are flagged as hypotheses to confirm at §19.2, not asserted root causes — no guessing).
- **Coverage boundary (honest — §22.2.4):** this ANALYSES + PLANS; it FIXES nothing. The
  cluster groupings are fix-planning hypotheses to be confirmed by §19.2 diagnosis at fix
  time; the rectification itself (starting with cluster ①) is the next phase, on Reza's go.

---

## Session: chat-audit-findings — MON-037 fix (expense one-off hub)

### Changes Made
- **Type**: Fix (financial, changesNumbers) + process rule
- **Scope**: property cashflow + tax deduction engines; CLAUDE.md Part 24 #6
- **Root Cause**: one-off expenses (`isRecurring === false`) stored MONTHLY were annualised ×12 in the two engines the general MON-023 fix never reached — the per-property cashflow engine (`propertyCashflow.ts`) and the tax deduction loops (`taxPositionCalculator.ts`, Float + Decimal). A $11,385 battery read as $136,620/yr on the property expense card/cashflow AND in tax deductions.
- **Solution** (DECISION 1 — Reza 2026-07-14): a one-off is EXCLUDED from the property recurring run-rate (`propertyCashflow.ts:172`), and COUNTED ONCE (its amount, not ×frequency) in tax deductions (`taxPositionCalculator.ts:195` + `:688`). `isRecurring` threaded through all 9 producers/callers (§19.4) + entity Prisma selects. `aggregateExpenses` deliberately NOT gated (the master uses it for its separate all/recurring/nonRecurring computation — gating would zero `nonRecurring`).

### Files Modified
- `lib/calculations/propertyCashflow.ts` — `CashflowExpense.isRecurring` + run-rate gate
- `lib/tax-engine/position/taxPositionCalculator.ts` — `ExpenseItem.isRecurring` + count-once (both engines)
- `lib/tax-engine/types.ts` — `EntityTaxFacts.expenses.isRecurring`
- `lib/services/masterFinancialService.ts`, `app/api/portfolio/snapshot/route.ts` — property caller threading
- `app/api/tax/position/route.ts`, `lib/tax-engine/position/userTaxPosition.ts`, `lib/services/entityTaxFactsAssembler.ts`, `app/api/tax/entity/[entityId]/route.ts` — tax caller threading + entity selects
- `components/properties/PropertyExpensesCard.tsx` — `PropertyExpense.isRecurring`
- `tests/calculations/mon037OneOffEngines.test.ts` — Ring-0 lock + §19.4 source-lock (new)
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — 3 anchors re-pinned (Neomatrix lockstep)
- `CLAUDE.md` Part 24 #6 + `docs/issues/FIX_PROTOCOL.md` §5 — Neomatrix⟺NeoAudit coupling rule
- `docs/issues/ISSUES.json` + `ISSUES.md` — MON-037 → DIAGNOSED (→ FIXING with PR)

### §19.2 evidence
- Input: `Expense.amount` (AUD), `frequency` (enum), `isRecurring` (bool, `schema.prisma:1949`).
- Rule: a one-off is not a recurring per-period cost; DECISION 1 excludes it from run-rate, counts it once for FY tax.
- Worked example: $11,385 battery MONTHLY → run-rate contribution $0 (was $136,620); tax deduction $11,385 (was $136,620). Recurring $1,000/mo → $12,000/yr unchanged.
- Verified: `tests/calculations/mon037OneOffEngines.test.ts` (8 tests) + no regression across 1138 property/tax/golden tests.

### Build Status
- [x] Ring-0 + source-lock tests pass (14)
- [x] property/tax/golden suites pass (1138)
- [x] `neomatrix:check` green (anchors re-pinned)
- [x] `issues:check` green (43 valid)

### Testing
- [x] Ratchet Ring-0 lock; §19.4 downstream sweep verified via golden end-to-end suites
- [ ] Ring-3 per-fix Chrome verification (in the consolidated brief — before VERIFIED)

---

## Session: chat-audit-findings — MON-035 fix (property cashflow window unification)

### Changes Made
- **Type**: Fix (financial, changesNumbers) — DECISION 2 (trailing-12-month)
- **Root Cause**: `computePropertyCashflow` (one engine) was fed THREE different transaction WINDOWS — all-time (property detail + list via `enrichPropertiesWithActuals`) vs last-12-months (Home tile + master snapshot). Same engine, different inputs → the same property's Cashflow/yr + yield differed across screens.
- **Solution**: extracted ONE window source `lib/calculations/propertyActualsWindow.ts` (`propertyActualsWindowStart()` = trailing 12 months); referenced by all three fetch sites. Added the window to `enrichPropertiesWithActuals` (the bug site — was all-time); master + portfolio/snapshot already used 12-month, now reference the shared constant (window rule single-source). Converges detail/list/Home/master cashflow AND yield (yield derives from the window-based annualRent — resolves MON-036's detail-vs-Home divergence too; the CFO Risk Radar's declared-income yield is the remaining MON-036 producer, next PR).

### Files Modified
- `lib/calculations/propertyActualsWindow.ts` — the ONE window (new)
- `lib/services/propertyActuals.ts` — window added to the 3 enrich fetches (detail/list)
- `lib/services/masterFinancialService.ts`, `app/api/portfolio/snapshot/route.ts` — inline `-12` replaced by the shared helper
- `tests/calculations/mon035PropertyActualsWindow.test.ts` — Ring-0 unit + §19.4 source-lock (new)
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — 3 anchors re-pinned (Neomatrix lockstep, Part 24 #6)
- `docs/financial-logic/graph/structural/coverage-allowlist.json` — new file allowlisted (graphify offline; self-prunes)
- `.audit/financial-math-baseline.json` — one grandfathered depreciation violation re-lined 908→910 (import shift)
- `docs/issues/ISSUES.{json,md}` — MON-035 → DIAGNOSED (→ FIXING with PR)

### Build Status
- [x] tsc 0 errors · full vitest 3905 passed · neomatrix:check exit 0 · lint:financial-surfaces no new violations

### Testing
- [x] Ratchet Ring-0 unit + source-lock (window single-source, no inline -12)
- [ ] Ring-3 per-fix Chrome verification (consolidated brief — before VERIFIED)

---

## Session: chat-audit-findings — MON-036 fix (Risk Radar yield → canonical engine)

### Changes Made
- **Type**: Fix (financial, changesNumbers)
- **Root Cause**: `detectPropertyUnderperformanceRisks` (riskRadar.ts) computed `grossYield = annualIncome / currentValue` from DECLARED income — a 4th independent yield producer bypassing the engine + `calculateRentalYield`. Showed 1.05% on the CFO Risk Radar while other surfaces (actuals-based) showed 0.12% (detail/list) / 0.9% (Home). The MON-035 window fix converged the latter three; this removes the last rogue producer.
- **Solution**: `scanForRisks` now enriches properties over the ONE canonical 12-month window (`enrichPropertiesWithActuals`, incl. loans) and `detectPropertyUnderperformanceRisks` takes yield from `computePropertyCashflow` + `calculateRentalYield(cf.annualRent, value)/100` — the SAME source as every other surface. Cash-flow-negative flag now uses `cf.annualCashflow` (canonical, loan-inclusive) instead of declared rent−expenses.

### Files Modified
- `lib/cfo/riskRadar.ts` — enrich + canonical yield; `PropertyWithFinancials` widened (loans + linkedTransactions)
- `tests/cfo/mon036RiskRadarYield.test.ts` — Ring-1 source-lock (new)
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — `calculateSummary` anchor re-pinned 601→621
- `docs/issues/ISSUES.{json,md}` — MON-036 → DIAGNOSED (→ FIXING with PR)

### Build Status
- [x] tsc 0 · full vitest 3909 passed · neomatrix:check exit 0 · lint clean

---

## Session: chat-audit-findings — MON-040 fix (tax recommendations percent/decimal)

### Changes Made
- **Type**: Fix (financial, changesNumbers) — cleanest fix in the set
- **Root Cause**: `generateRecommendations` (taxPositionCalculator.ts) read `tax.marginalRate` as a DECIMAL fraction, but it's a PERCENT (37 for the 37% bracket — `incomeTaxCalculator.ts:118` returns `marginalRate*100`; the tax page renders percent). So `(marginalRate - 0.15)` = 36.85, ×100 → "3685%"; `remainingCap × 36.85` → ~$1.1M; neg-gearing `× 37` → ~$6.27M.
- **Solution**: local `mr = tax.marginalRate / 100` (decimal) for rate arithmetic; guard `>= 32` (percent); "% saved" = `marginalRate - 15`. Kept the percent convention (the tax page + `effectiveRate` depend on it — did NOT touch `incomeTaxCalculator` or the type).

### Files Modified
- `lib/tax-engine/position/taxPositionCalculator.ts` — `generateRecommendations` rate arithmetic
- `tests/tax/mon040TaxRecommendations.test.ts` — Ring-0 (22% not 3685; savings realistic; class invariant savings ≤ netTax) (new)
- `docs/issues/ISSUES.{json,md}` — MON-040 → DIAGNOSED (→ FIXING with PR)

### Build Status
- [x] tsc 0 · full vitest 3914 passed · neomatrix:check exit 0 · lint clean

---

## Session: chat-audit-findings — MON-038 fix (refinance LVR gate — both producers)

### Changes Made
- **Type**: Fix (advice-text; changesNumbers=false) — §12.2.1 duplicate-producer completion of MON-019
- **Root Cause**: refinance advice has TWO producers. MON-019 gated `calculateRefinanceOpportunities` (LVR ceiling), but `generateRateAlerts`' `rate_above_market` branch still set `action: 'Consider refinancing…'` with NO LVR gate — so a 104% LVR loan was told to refinance.
- **Solution**: extracted ONE `isRefinanceableLvr(loan, properties)` helper (the `> MAX_REFINANCE_LVR` rule) called by BOTH producers. Above the ceiling the rate alert reframes to "Focus extra repayments to reduce your LVR below 80% first" (the alert + its impact $ stay — only the action text changes).

### Files Modified
- `lib/cfo/decisionSupport/loanDecisionSupport.ts` — shared `isRefinanceableLvr`; both producers gated; `generateRateAlerts` exported for testability
- `tests/cfo/loanDecisionSupportGuards.test.ts` — cross-producer invariant (no refinance advice > LVR ceiling from ANY producer + healthy-LVR control)
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — 3 loanDecisionSupport anchors re-pinned
- `docs/issues/ISSUES.{json,md}` — MON-038 → DIAGNOSED (→ FIXING); changesNumbers→false

### Build Status
- [x] tsc 0 · full vitest 3917 passed · neomatrix:check exit 0 · lint clean

---

## Session: chat-audit-findings — MON-037 Expenses-card reconciliation (VR-004 regression)

### Changes
- **Root Cause (VR-004)**: MON-037 made the engine exclude one-offs from the recurring total, but `PropertyExpensesCard` still rendered raw one-off rows → "$0 total over non-zero rows" (Thornland/Guildford) and HOME total ≠ sum of rows.
- **Fix**: render only recurring rows (`expenses.filter(isRecurring !== false)`), so Σ rows === the shown total; one-offs surfaced as a footnote ("+ N one-off costs — shown in Spending"). Count text now says "N recurring · M one-off".
- **Files**: `components/properties/PropertyExpensesCard.tsx`; `tests/dashboard/propertyExpensesCard.test.ts` (reconciliation invariant); `docs/issues/ISSUES.{json,md}`.
- **Gate**: tsc 0 · vitest 3920 · neomatrix 0 · lint clean.
- Still FIXING: RC-B duplicate Battery (reconcile dedup follow-up) + Chrome re-verify.

---

## Session: chat-audit-findings — MON-035/036 Ring-2 HOME-parity reproduction (VR-004 re-diagnosis)

### Changes
- **Re-diagnosis (not a guess-fix)**: VR-004 flagged the Home dashboard tile diverging from detail/list for HOME (~$6,040/yr). Rather than design a fix around the *suspicion* that the producers diverge, built a Ring-2 reproduction that runs the THREE real producers on the triggering HOME shape.
- **`tests/golden/ring2.homePropertyParity.test.ts` (new, 6 tests)**: runs `GET /api/portfolio/snapshot` (Home tile), `GET /api/properties/[id]` (detail route + engine), and `getMasterFinancialSnapshot` on a HOME shape with the exact VR-004 vectors — stray RENTAL income on an owner-occupied property, a $503/mo ONE-OFF (`isRecurring:false`), a loan with NO `minRepayment` (interest floor) — on BOTH declared and actuals (transaction-backed) bases, plus a normal-RENTAL control.
- **Result**: all three producers are **byte-parity** (cashflow AND yield) and all exclude the one-off. The divergence hypothesis is **refuted** — with identical rows the producers do not diverge. VR-004's FAIL was **deploy-skew** (MON-035 window + MON-037 one-off exclusion landed across separate merges mid-review). Permanent HOME-shape parity coverage added (NeoAudit growth, §23.2.6).
- **MON-035/036 stay FIXING** pending a Ring-3 re-check on the unified deploy (§23.2.3) — no over-claim (§22.2.4).

### Files Modified
- `tests/golden/ring2.homePropertyParity.test.ts` — NEW holistic cross-surface parity reproduction (declared + actuals; cashflow + yield)
- `docs/issues/ISSUES.{json,md}` — MON-035/036 `test` → the holistic parity test; reproduction note (deploy-skew root cause; stays FIXING pending Ring-3)
- `docs/issues/FIX_PROTOCOL.md` — §7 ledger: MON-037 card DONE; MON-035/036 re-diagnosis retro (reproduce-before-fix lesson)
- `docs/verification/runs/VR-004.md` — post-VR-004 re-diagnosis section

### Build Status
- [x] tsc 0 · full vitest 3926 passed · neomatrix:check exit 0 · lint clean · issues:check 45 valid

### Gate (§20.6)
- Document 10/10 (Part 23 four-ring · §19.4 holistic test · §24 reproduce-before-fix · §23.2.6 NeoAudit growth; Neomatrix consulted — no engine/lineage change, graph green)
- Requirements 10/10 (root-caused without guessing; refuted hypothesis; kept FIXING pending Ring-3 — no over-claim)
- Logic 10/10 (runs the REAL independent producers, not a shared source; adversarial $503/mo one-off matching the observed delta; both bases). Coverage: verifies producer parity on the reproduced HOME shapes + one-off exclusion; does NOT verify Reza's LIVE data (the Ring-3 re-check) or rendered pixels.

---

## Session: chat-audit-findings — MON-044/046 dead-links + MON-038 count lock (CFO)

### Changes
- **MON-044** — the CFO "Loan Opportunities" tile drilled to `/dashboard/debt` (404). Root cause: a single typo'd href at `app/dashboard/cfo/page.tsx:921`; the canonical route is `/dashboard/debt-planner` (used by every other link). One-line repoint.
- **MON-046 (new, surfaced by the MON-044 Ratchet)** — the route-existence Ratchet flagged a second dead-end: bare `/dashboard/investments` has no `page.tsx` (only accounts/holdings/super/transactions sub-tabs), so 4 links (CFO tile, DocumentList, sidebar nav ×2) 404'd. Fix: `app/dashboard/investments/page.tsx` redirects to `/dashboard/investments/accounts` (mirrors the `/dashboard/accounts` → `/dashboard/balances` pattern) — fixes all callers at source (§12.1). A NeoAudit living-system win: a Ratchet added for one bug caught a latent sibling.
- **MON-038** — the VR-004 count concern is resolved in code: the tile's "N opportunity found" count = `refinanceOpportunities.filter(worthRefinancing).length`, and the 104% loan is gated to `worthRefinancing:false` → excluded from the count. Now test-locked.

### Files Modified
- `app/dashboard/cfo/page.tsx` — href `/dashboard/debt` → `/dashboard/debt-planner`
- `app/dashboard/investments/page.tsx` — NEW redirect landing → `/dashboard/investments/accounts`
- `tests/dashboard/cfoTileLinks.test.ts` — NEW Ratchet: every `/dashboard/<seg>` href in cfo/page.tsx resolves to a real route + dead `/dashboard/debt` absent
- `tests/cfo/loanDecisionSupportGuards.test.ts` — MON-038 opportunities-count-excludes-104%-loan assertion
- `docs/financial-logic/graph/structural/coverage-allowlist.json` — the trivial redirect page allowlisted (graphify offline; no financial calc)
- `docs/issues/ISSUES.{json,md}` — MON-044 → FIXING; MON-046 added (FIXING); MON-038 count note

### Build Status
- [x] tsc 0 · full vitest 3930 passed · neomatrix:check exit 0 · lint clean · issues:check 46 valid

### Gate (§20.6)
- Document 10/10 (§6.7 no-dead-ends · §12.1 root-cause redirect fixes all callers · §23.2.2 Ratchet + §23.2.6 living-system sibling catch; Neomatrix — no engine touched, redirect page allowlisted, graph green)
- Requirements 10/10 (MON-044 repoint exact; MON-046 sibling fixed at source; MON-038 count confirmed+locked; no gold-plating)
- Logic 10/10 (one-line href · standard redirect page · count filter already correct, now locked). Coverage: verifies hrefs resolve to real route dirs + dead path absent + count excludes the gated loan; does NOT verify the rendered browser navigation (manual/Ring-3 click-through — VR-005).

---

## Session: chat-audit-findings — MON-041 asset appreciation shown as negative depreciation

### Changes
- **Root cause**: `depreciation = purchasePrice − currentValue` (positive = lost value, negative = gained), and `depreciationPercent` carries the same sign (`app/api/assets/route.ts:58`). `AssetTile` abs'd it + labelled Appreciated/Depreciated, but the **Assets page dialogs** (`page.tsx:636` inline %, `:1276` KpiTile) printed the **raw signed** percent + a hardcoded "Depreciation" label → an appreciating 300Z read "-200.0% depreciation".
- **Fix (§12.2.1)**: extracted `lib/assets/valueChange.ts` (`assetValueDirection` + `assetValueChangeMagnitudePercent`) as the ONE presentation rule; wired both page dialog sites (label by direction, % as magnitude) and repointed `AssetTile`'s `lostValue`/percent to it. The underlying signed value is unchanged — only the display sign/label (`changesNumbers=false`).

### Files Modified
- `lib/assets/valueChange.ts` — NEW canonical presentation helper
- `app/dashboard/assets/page.tsx` — both dialog sites use the helper (label + magnitude)
- `components/assets/AssetTile.tsx` — `lostValue`/percent repointed to the helper
- `tests/assets/valueChange.test.ts` — NEW Ratchet (direction + non-negative magnitude, incl. the -200% case)
- `docs/financial-logic/graph/structural/coverage-allowlist.json` — presentation helper allowlisted (no money formula; graphify offline)
- `docs/issues/ISSUES.{json,md}` — MON-041 → FIXING

### Build Status
- [x] tsc 0 · full vitest 3935 passed · neomatrix:check exit 0 · lint clean · issues:check 46 valid

### Gate (§20.6)
- Document 10/10 (§12.2.1 one-source presentation helper · §23.2.2 Ratchet; Neomatrix — pure presentation, allowlisted, graph green)
- Requirements 10/10 (fixes the exact mislabel; signed data untouched; no gold-plating)
- Logic 10/10 (direction enum + Math.abs magnitude; all 3 surfaces share it). Coverage: verifies the direction + non-negative magnitude rule; does NOT verify the rendered dialog pixels (manual/Ring-3).

---

## Session: chat-audit-findings — Neomatrix accuracy: correct nodes that reflected pre-fix (buggy) Monitrax

### Context
Reza directive (2026-07-14): "the Neomatrix was designed on the basis of the existing Monitrax, so all Monitrax issues are also reflected into the Neomatrix — fixes should be applied there as well." When a Monitrax bug is fixed, the matching graph node's **formula/lineage/status** must be corrected too (not just its `file:line` anchor — Part 24 #6 coupling extended to semantics).

### Changes
- **`engine.propertyCashflow.computePropertyCashflow`** — formula was STALE (described pre-fix behaviour). Updated to reflect the shipped fixes: **MON-037** (one-off expenses `isRecurring===false` are EXCLUDED from the recurring run-rate) + **MON-035** (actuals resolved over the trailing-12-month `propertyActualsWindow`). Added the `expense.isRecurring` input.
- **`engine.taxIntegration.calculateNegativeGearingBenefit`** — this node models the **rogue** MON-045 producer. Flagged `status: "documented" → "suspected-issue"` with the full MON-045 diagnosis + Reza's Option-1 decision in the authority note, so the map honestly reflects the known defect. The node is deleted/repointed by the MON-045 fix PR (§21.2: a suspected bug is flagged, never silently changed).

### Files Modified
- `docs/financial-logic/graph/financial-graph.json` — the two node corrections
- `docs/financial-logic/graph/GENERATED_CORE.md` — regenerated

### Build Status
- [x] neomatrix:check OK (schema valid, invariants hold, markdown fresh) · 134 graph tests pass

### Gate (§20.6)
- Document 10/10 (Reza directive + Part 24 #6 coupling extended to node semantics; no design-doc deviation)
- Requirements 10/10 (corrects exactly the stale/buggy nodes found; property-cashflow formula now matches the shipped code; neg-gearing flagged suspected-issue pending MON-045 — honest, not silently changed)
- Logic 10/10 (formula text verified against propertyCashflow.ts:174 isRecurring gate + propertyActualsWindow; suspected-issue is a valid status enum; gate + tests green). Coverage: verifies schema/anchors/markdown-freshness + these 2 nodes' accuracy; does NOT re-audit all 262 nodes (broader pass ongoing).
