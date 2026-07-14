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
