# Changelog — 2026-07-13

## Session: chat-audit-findings-issues-m9518i (continued) — Ring-3 brief: explicit MON-030 check

### Change: fold the MON-030 score/grade convergence check into the canonical Chrome-relay brief

- **Type**: Docs (verification brief) — NeoAudit Ring-3 (Part 23 §23.2 rule 4)
- **Scope**: `docs/verification/VERIFICATION_PLAYBOOK.md` §3.3 (the canonical run
  brief) + `docs/verification/baselines/BASELINE.md` (the regression diff slot)
- **Why**: MON-030 (health/CFO/Safety "three scores for one health") is fixed in
  code (#1380/#1381) but stays FIXING until Reza confirms on his LIVE data that
  My Guide's CFO score now equals Home's health score. He said he wasn't sure
  what to look at — so the check belongs in the brief the Ring-3 relay runs,
  verbatim, not in chat. §23.2 rule 4: improving the brief = editing the
  playbook in a PR, never improvising.
- **Solution**:
  - Part C gains an explicit `[MON-030]` line: My Guide (CFO) overall score AND
    letter grade must be IDENTICAL to the Home "Health" score AND grade (both now
    from the ONE health engine — any gap is a FAIL), and the CFO bars should be
    the SEVEN warm categories (Cash on hand / Cash flow / Debt health /
    Investments / Property / Protection / Long-term outlook), not a different set
    of six CFO metrics.
  - Part E's same-metric invariant line now names the health-score LETTER GRADE
    alongside the number, with the MON-030 equality called out.
  - Part F regression JSON gains `healthGradeHome` / `healthGradeCfo` so the
    grade convergence is captured in every snapshot.
  - Baseline gains the two grade keys (null — VR-001 didn't capture them) and its
    MON-030 annotation flips from "BROKEN — multiple producers" to "FIX SHIPPED
    (#1380/#1381)" with the expected next-run convergence (CFO===Home for both
    score and grade; Safety Net stays deliberately distinct).

### Files Modified
- `docs/verification/VERIFICATION_PLAYBOOK.md` — Part C MON-030 line, Part E grade
  note, Part F grade keys
- `docs/verification/baselines/BASELINE.md` — Part F grade keys + MON-030
  annotation flipped to "fix shipped / expected convergence"

### Build Status
- [x] Doc-only — no code, no test surface touched (grep confirmed no test
  snapshots the brief or baseline)

### Gate (§20.6)
- Document 10/10 (doc: VERIFICATION_PLAYBOOK.md §3.3 — the change IS the canonical
  brief, edited in a PR per §23.2 rule 4) · Requirements 10/10 (adds exactly the
  MON-030 score+grade+bars check Reza asked to "check later", plus the Part F
  capture) · Logic 10/10 (no math; the expected CFO===Home convergence is grounded
  in the shipped #1380/#1381).
- **Coverage boundary (honest — §22.2.4):** this brief change *instructs* the
  Ring-3 human/Chrome-relay run to check MON-030 on live data; it does NOT itself
  verify any number. MON-030 stays FIXING.

## Session: chat-audit-findings-issues-m9518i (continued) — §8 step-6: Tier 3 metamorphic invariants

### Change: metamorphic laws over the real master snapshot (NEOAUDIT §2 Tier 3)

- **Type**: Test infra (NeoAudit Ring 2/3) — §8 step-6 (first of 6 sub-PRs)
- **Scope**: `tests/golden/ring3.metamorphic.test.ts` (new) + `tests/golden/goldenHousehold.ts`
  (`createGoldenDbFrom` capability)
- **Why**: Tier 1 scenarios and the Ring-0-gen property tests each pin ONE
  derivation. Metamorphic laws assert a RELATION between two runs of the WHOLE
  service on inputs that differ by a controlled perturbation — "change X, Y must
  move by exactly f(X), Z must not move at all." These catch the combination bugs
  no single enumerated example can: a flow leaking into a stock, a ratio that
  isn't scale-invariant, a sale that discontinuously drops the whole asset value
  instead of its equity.
- **Solution** — four laws, fast-check-driven over the perturbation amount/scale,
  each run through the REAL `getMasterFinancialSnapshot` on a perturbed clone of
  the Golden Household:
  1. **expense is a flow** — add $X/mo expense ⇒ Δcashflow −X, Δexpenses +X,
     ΔnetWorth 0 (a monthly flow must never move the net-worth stock).
  2. **income is a flow** — add $X/mo income ⇒ Δincome +X, Δcashflow +X,
     savingsRate ↑, ΔnetWorth 0.
  3. **scale invariance** — scale ALL amounts by k>0 ⇒ netWorth/income/expenses/
     cashflow ×k, savingsRate unchanged (a pure ratio). Rounding-aware tolerance
     `0.05 + 1e-6·|b|` — cashflowOrchestrator rounds cashflow to 2dp, so
     scale-then-round ≠ round-then-scale by ≤0.005·(1+k) ≤ 0.045 for k≤8; netWorth/
     income/expenses are exact sums.
  4. **sale continuity** — sell the property (asset + secured loan + rent +
     property expenses) ⇒ ΔnetWorth = −equity (300,000), NOT −value (800,000);
     monthly cashflow improves by exactly 400 (the golden property is −400/mo).
  - Harness capability: `createGoldenDbFrom(rows)` (createGoldenDb now wraps it) so
    the snapshot runs on an arbitrary perturbed rows object. No cache
    (masterFinancialService.ts:1853) → the two runs are independent.
  - Two negative controls prove the harness can fail (a should-move metric moved;
    k=1 is the identity).

### Files Modified
- `tests/golden/ring3.metamorphic.test.ts` — new (6 tests: 4 laws + 2 controls)
- `tests/golden/goldenHousehold.ts` — `createGoldenDbFrom(rows)` extracted;
  `createGoldenDb` wraps it (no behaviour change to existing callers)
- `docs/blueprint/NEOAUDIT.md` — §8 step-6 Tier 3 marked landed + backlog listed

### Build Status
- [x] `npx vitest run tests/golden` — 15 files, 101 tests pass (incl. the new 6
      and every existing golden test through the refactored harness)
- [x] `npm run neomatrix:check` — OK (no graph node touched; this PR adds no
      engine/number, it RUNS the existing engines and asserts relations)

### Gate (§20.6)
- Document 10/10 (doc: NEOAUDIT.md §2 Tier 3 + §8 step-6 — the laws match the
  documented Tier-3 examples; step order respected, Tier 3 is a named step-6
  component) · Requirements 10/10 (implements the Tier-3 metamorphic laws; the
  transfer-invariance law is honestly deferred, not silently dropped) · Logic
  10/10 (each law verified to run GREEN on the real service; the scale tolerance
  is derived from the actual 2dp rounding, not guessed; SSOT — reuses the ONE
  golden harness + the ONE master snapshot, no parallel test platform per §22).
- **Coverage boundary (honest — §22.2.4):** verifies FOUR metamorphic laws on the
  DECLARED-basis golden book through the real snapshot service. Does NOT exercise
  the ACTUALS path (the transfer-invariance law needs an actuals-basis fixture —
  tracked follow-up), and does NOT verify any rendered page (R2-vis).
