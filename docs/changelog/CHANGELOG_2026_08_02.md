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

---

## Session: g8kra5 (cont.) — the reference-numbers scoreboard

### What was wrong / What changed / What you'll see

- **What was wrong:** Reza asked whether there was a table of the reference numbers and calc engines
  across the app, with before/after on the duplicate-calculator reconciliation. The **data** existed
  and was CI-gated, but in four unjoined places — the producer census, the Neomatrix, the quantity
  contracts, the Number Inventory. No one view. A fair hit.
- **What changed:** `docs/architecture/REFERENCE_NUMBERS_SCOREBOARD.md` — generated, never
  hand-maintained, with a test that fails when it goes stale.
- **What you'll see:** one table: 40 quantities · 1,251 producing sites · seed vs now · Δ · whether the
  Neomatrix models it · whether it has a contract. Plus every dated census snapshot as a matrix.

### The three things it refuses to do

1. **It does not let a Δ read as deleted duplication.** The reading note is the first thing on the page:
   a negative Δ is either a real reconciliation OR a **measurement correction** — the compare relays were
   being counted as producers, and excluding them dropped seven quantities without deleting a single
   duplicate. The census records counts, not causes; the ledger holds causes. Stated up front rather
   than left for someone to discover.
2. **It does not guess a canonical producer.** Quantities join to a Neomatrix `semanticKey` or a contract
   file only on an EXACT key match. Everything else reports as unmapped (§19.2 — never guess).
3. **It does not claim correctness.** A count of 1 means one producer, not a right answer.

### The finding the join surfaced

**Only 5 of 40 census quantities have a matching Neomatrix `semanticKey`** (the graph models 16 keys
total), and **13 of 40** have a same-named contract. The census and the Neomatrix are two vocabularies
for one architecture and they do not reconcile — which is exactly the NI-1→NI-4 reconciliation Part 22
exists to close. A fuzzy name-match would have produced a flattering coverage number and hidden it.

**`loanCost` is still 31.** T2 is the tranche that takes it to one, and that single number is the
fairest test of the programme so far.

### Files Modified
- `scripts/reference-numbers/scoreboard.mjs` — **NEW.** The generator (`--check` mode fails when stale)
- `docs/architecture/REFERENCE_NUMBERS_SCOREBOARD.md` — **NEW, generated**
- `tests/docs/referenceNumbersScoreboard.test.ts` — **NEW.** Freshness enforcement in the existing
  vitest suite (already a required check) rather than a new build gate
- `package.json` — `refnums:scoreboard` · `refnums:check`
- `docs/00_INDEX.md` — the scoreboard indexed, along with four architecture docs that were never
  indexed at all (`REFERENCE_NUMBERS`, `NUMBER_INVENTORY`, `CALC_SSOT_WALL`, `MATRIX_FIX_DISCIPLINE`)

### Build Status
- [x] `refnums:check` — PASS · `vitest tests/docs/referenceNumbersScoreboard.test.ts` — PASS
- [x] `check-index-paths` — the four newly-indexed docs drop off the warning list

### Coverage — stated precisely
Renders the census, the Neomatrix join and the contract join, and fails CI if the rendering goes stale.
It verifies **no number** and proves **no** quantity correct — it counts producers and reports what is
unmapped. Correctness lives in the contracts, the calc-audit fixtures and the Ring-3 runs.

---

## Session: g8kra5 (cont.) — one instrument, one denominator (Matrix instruction, 2026-08-03)

### What was wrong / What changed / What you'll see

- **What was wrong:** three record defects the Matrix found on main. The worst: `REFERENCE_NUMBERS.md`
  carried its own hand-recorded `Census` column, making it a **second instrument** measuring producer
  counts — and it had drifted into contradicting the ratchet on the same quantity names, by up to 5×,
  **in both directions**.
- **What changed:** the column is gone; `.audit/producer-census.json` is the only instrument. Plus two
  stale statuses corrected.
- **What you'll see:** nothing in the app. Two registers can no longer disagree about how many
  producers a quantity has, because there is only one now.

### 1. The Census column — folded onto the ratchet

| Quantity | `REFERENCE_NUMBERS.md` (hand, at `f13368ef`) | `producer-census.json` (ratchet) |
|---|---:|---:|
| medicareLevy | 4 | 20 |
| cashflow | 27 | 57 |
| loanCost | 24 | 31 |
| depreciation | 22 | 15 |
| superCap | 16 | 10 |

**Neither column was lying.** They are different instruments — a one-off manual three-agent pass versus
a pattern-based scan over a wider set of roots. That is precisely why one had to go: §12.2.1 does not
say *keep the accurate one*, it says **one datum, one source**. Two instruments measuring one quantity
is the defect, independent of which is closer to true. Verified before acting rather than taken on
trust: both files read on main, five rows compared, the contradiction confirmed.

The register now answers *"what is the quantity and which producer survives?"* and explicitly does not
answer *"how many producers are there?"* — that has one instrument, rendered by the scoreboard.

### 2. T3 gate G1 — stale ❌ on a merged precondition

The T3 gate table read `G1 preconditions ❌ — MON-135 must merge first. Non-negotiable`. MON-135 merged
in #1538 and is `VERIFIED` (VR-042 §1 PASS). **The same ledger already had a "MON-135 — DONE" section
above it** — a document contradicting itself, which is how a cleared gate keeps reading as a blocker.

### 3. MON-134 — registry stale at `FIXING` since 07-29

The ledger recorded G6 merged + deploy-verified, G7 relay A3 self-diff `CLEAN`, G8 Ring-3 confirming
`INSUFFICIENT_HISTORY` with `changePercent` **absent** rather than zero. The registry still read
`FIXING`, with an unresolved `"#PR-3 (read path — this PR)"` placeholder where a PR number belonged.

Advanced to **VERIFIED** with the real PRs (#1529 / #1530 / #1532). Checked before advancing rather
than asserted: the linked ratchet test exists (`tests/health/mon134TrendFromSnapshots.test.ts`, 11
cases), and the declared `semanticKey` resolves to a real node (`engine.aggregateEngine.generateHealthReport`
@ `lib/health/aggregateEngine.ts:338`). **Not advanced to CLOSED** — §23.2.6 promotion also wants
parity-coverage growth and a baseline update recorded, and neither is evidenced for this issue.
VERIFIED is what the evidence supports.

### Files Modified
- `docs/architecture/REFERENCE_NUMBERS.md` — `Census` column removed from all 29 rows; the header note
  records what was folded, the five contradicting values, and why "keep the accurate one" is the wrong fix
- `docs/implementation/MON-131_TRANCHE_LEDGER.md` — T3 G1 ❌ → ✅ with its evidence
- `docs/issues/ISSUES.{json,md}` — MON-134 → VERIFIED, placeholder PR resolved

### Build Status
- [x] `issues:check` — PASS (130 issues valid) · `refnums:check` · `mon131:check` · `neomatrix:check` — PASS

### Coverage — stated precisely
Removes a duplicate instrument and corrects two stale statuses. Verifies **no number** — no producer was
deleted here, and the counts themselves are unchanged. `loanCost` is still 31; T2's migration is what
moves it.
