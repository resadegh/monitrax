# Changelog — 2026-08-02

## Session: g8kra5 (cont.) — G3 CLEARED: the T2 contract is declared

### What was wrong / What changed / What you'll see

- **What was wrong:** nothing in the app. T2's migration was blocked because its contract — the exact
  list of numbers allowed to move — did not exist yet.
- **What changed:** the Matrix's third relay capture came back valid at `915704f0`, and its measured
  output is now committed as `.audit/expected-moves-t2.json` (13 paths) with the raw payload beside it.
- **What you'll see:** nothing yet. This declares what the migration is allowed to do; the migration
  itself is the next PR.

### The capture

`GET /api/admin/matrix/golden-baseline/t2-loan-cost?userId=91b6d7ce…` · `200` · `loanCount === 5`
asserted · sha `915704f0` (contains the sweep #1561 AND the MON-143 fix #1562).

The Matrix **withdrew its own earlier capture** — it was stamped `8bed66b6`, before `f7b685de`, and so
failed the brief's §1 build precondition. Values were identical, which is itself the MON-143 evidence.

**The sweep worked.** All five paths that three rounds of hand-written lists had missed appear in
`paths[]` without having been named, plus `quickMetrics.monthlyLoanRepayments` — 13 in total.

### MON-143 confirmed from the other side

Guildford's `monthlyInterestFloor` 1,964.67 → **384.45** = (377,821.91 − 303,889.96) × 6.24% ÷ 12, and
**no per-loan `newMonthly` moved** between the two captures. The one loan carrying an offset is also the
one that resolves via ACTUALS and never reaches its floor — which is why the fix was latent and why
closing it before the migration was the right order. MON-143 stays `FIXING`; its Ring-3 evidence is the
migration run (§23.2.3).

### Two findings the capture forced — both would have failed the tranche

**1. The unrounded-feed constraint.** The sweep feeds `calculateCashflow` the UNROUNDED canonical cost
per loan. The per-loan costs rounded to cents sum to **12,779.28** — a full cent below the **12,779.29**
the engine produced. Rounding per loan before summing cascades into `annualLoanRepayments` (×12),
`annualCashflow`, `savingsRate` and `debtServiceRatio`. Written into the contract as a build constraint,
not left as an assumption.

**2. The rounding-convention correction (§19.2 — read in source, not recalled).**
`cashflowOrchestrator.ts:259-266` computes every annual leaf as `round(UNROUNDED monthly × 12)`. It does
**not** derive from annual components. T1's contract records *"Derive from annual components, never
rounded-monthly×12"* — the second half is the real T1 lesson, but the first half was never the engine's
rule; it merely coincided at T1 (both give 180,572.50). **At T2 they diverge by a cent:** annual
components give 133,020.79, the engine emits **133,020.78**. Declaring .79 from the T1 phrasing would
have failed G7 against the engine's own output. The T2 contract takes the measured value, and a
non-value-changing `conventionClarification` was added to the T1 file so no later tranche inherits it.

The Matrix raised this as observation D1 and was right to; the resolution came from reading the engine.

### Files Modified
- `.audit/expected-moves-t2.json` — **NEW.** The T2 contract: 13 measured paths with arithmetic, the
  feed constraint, the rounding convention, `mustNotMove` (screen-confirmed), acceptance + coverage boundary
- `.audit/captures/t2-loan-cost-915704f0.json` — **NEW.** The verbatim payload, committed as the
  contract's provenance (§21.2.2 rule 4)
- `.audit/expected-moves-t1.json` — `conventionClarification` added; **no T1 value changes**
- `app/api/admin/matrix/golden-baseline/t2-loan-cost/route.ts` — `notes[5]` corrected; it still asserted
  the MON-143 breach in the present tense
- `docs/implementation/MON-131_TRANCHE_LEDGER.md` — T2 gate table G3 → ✅; §6 rows for #1564 and this PR
- `docs/IMPLEMENTATION_PLAN.md` — hub summary: G3 cleared, D49 the only thing left before the migration

### Also recorded: #1564's post-merge verification
Merged `997e0d99`. Production deploy `dpl_Fzg1tk8uK3tBUj6H94xyFiZXvdQn` → **READY**. §17.2 satisfied —
deploy state only; no runtime logs, the change was documentation.

### Build Status
- [x] `mon131:check` · `check-plan-freshness` — PASS
- [x] `neomatrix:check` — PASS (route `notes` string only; no modelled symbol moved, no anchor to re-pin)

### Coverage — stated precisely
Declares what the migration may move and pins what it may not. Verifies **nothing** about the migration —
that code does not exist yet. The capture verified the *current* state on live data; the after-values are
engine-computed predictions of the post-migration state, and G7 plus a Ring-3 run are what confirm them.
