# Changelog — 2026-08-03

## Session: g8kra5 (cont.) — D49 decided and implemented; two wrong anchors found by the fix

### What was wrong / What changed / What you'll see

- **What was wrong:** the Neomatrix symbol gate checked an anchor's line against a **frozen snapshot of
  the code** (Layer 0, at `4ae03705`) instead of against the code. Re-pinning an anchor to its true
  current line — which §21.2.1 requires — therefore failed the build.
- **What changed:** Reza chose option A. The gate now finds the symbol's declaration in the **current
  source file** and compares against that.
- **What you'll see:** nothing in the app. The T2 migration is unblocked — it no longer needs a
  hand-patched artefact for each of its seven target files.

### The fix caught two wrong anchors on its first run

Not the outcome expected from a guard change. Resolving against source immediately failed on two nodes
that had passed every build for months:

| Node | Claimed | What is actually there | True line |
|---|---|---|---|
| `input.InvestmentAccount.cashBalance` | `prisma/schema.prisma:2271` | `ELECTRIC` — an enum value inside a **different model** | **2294** |
| `input.NetWorthSnapshot` | `prisma/schema.prisma:3529` | a `createdAt` field, 23 lines above the model it names | **3552** |

Both passed the old gate because the frozen Layer 0 agreed with the stale line — the check was comparing
two copies of the same wrong answer. Re-pinned after reading source (§19.2), gate back to **188/188**.

**And it still bites.** A deliberate +40-line perturbation of
`engine.netWorthCalculator.calculateNetWorth` was caught and named with both lines, then reverted. A
guard change that only ever loosens is not a fix.

### Why narrowing this gate loses nothing

The property worth protecting — *Layer 1 only claims things about code Layer 0 has actually seen* — is
enforced by a **different** gate: `check-layer0-coverage`'s ANCHORED DRIFT check. This gate answers
"does the symbol live at the line the model claims?", and source is the only honest authority for that.
Resolving it against a months-old snapshot answered "did it live there in April?", which nobody asked.

Matching is against **declarations only** — function/class/const/type/interface/enum bindings, exported
forms, object-literal and class-member keys, Prisma model and field lines. A bare mention in a call or a
comment must not satisfy an anchor, or the gate passes on coincidence.

### Also recorded: two decisions and a correction Reza made to Code

- **MON-141 → label both surfaces** (no number moves). Queued.
- **MON-142 reframed.** Code had told Reza to check the stored loan rates with the bank. **Wrong
  instruction**: the repayment transactions that imply ~6.268% are already in the app. Stored rate is a
  FACT, implied rate is DERIVED by one engine, and when they diverge the app's job is to **surface** it —
  overwriting the fact would destroy the evidence they disagreed. The divergence is a data-integrity
  finding Monitrax should raise by itself, which is what MON-142 is. The Matrix confirms it from live
  data; a handout is due.
- **The T4–T7 facts, reframed the same way.** Reza: *"These can be provided by the Matrix by reviewing my
  real personal data through Monitrax."* For each fact, either it has a home in the schema or it does
  not — **and an absent home is itself a MON-131 finding**. Next Code action: audit the schema per fact.

### Files Modified
- `scripts/neomatrix/check-binding-coverage.mjs` — `declarationLines()`; source resolved before the
  Layer-0 lookup, with the Layer-0 and line-text tiers kept as fallbacks
- `docs/financial-logic/graph/financial-graph.json` — two anchors re-pinned; `GENERATED_CORE.md` regenerated
- `docs/implementation/MON-131_TRANCHE_LEDGER.md` — D49 resolved in the drift log
- `docs/implementation/MON-131_COMPLETION_BRIEF.md` — §5 decisions recorded; new §5.1

### Build Status
- [x] `neomatrix:check` — PASS (188/188 symbol anchors, 257/257 file anchors, 0 uncovered)
- [x] Drift-detection re-verified by injection · `mon131:check` · `refnums:check` · `issues:check` — PASS

### Coverage — stated precisely
Proves the gate resolves anchors against source, still fails on drift, and that two specific anchors
were wrong and are now right. It does **not** re-verify the other 186 anchors' semantic correctness —
they resolve to the named symbol at the claimed line, which is what the gate checks and all it checks.

---

## Session: g8kra5 (cont.) — the schema audit behind the four "facts"

### What was wrong / What changed / What you'll see

- **What was wrong:** the brief listed four facts as *"blocked on Reza"*. That framing was Code's, and it
  was wrong in the same way the MON-142 instruction was — it assumed the app couldn't answer.
- **What changed:** audited `prisma/schema.prisma` per fact. **Five of six already have a home.** The
  sixth has none, which makes it a finding rather than a question.
- **What you'll see:** nothing yet. Four tranches stop waiting on you.

| Fact | Home | Verdict |
|---|---|---|
| QS depreciation schedules | ✅ `DepreciationSchedule` (per property: category · assetName · cost · startDate · rate · method) | Matrix reads it. **D11 lives here** — `rate Float` carries no unit, the open 100× ambiguity T4 must close |
| Rented out vs tenanted residence | ✅ `Property.type` — HOME / INVESTMENT / RENTAL | Matrix reads it |
| Per-property availability days | ✅ `Property.genuinelyAvailableForRent` + `availableDaysPerYear` — added by T1 under X7/D43 | Matrix reads whether **populated** (nullable) |
| Total super balance | ✅ DERIVED — Σ `SuperannuationAccount.currentBalance` | Derive, never ask |
| Division 293 exposure | ✅ DERIVED — income + concessional contributions; `TaxPosition.division293Tax` exists | Derive |
| **Co-owned property held as a rental BUSINESS** | ❌ **NONE** — `OwnershipGroup`/`OwnershipStake` hold co-ownership *shares*; nothing records the tax characterisation (D42 C1) | **A MON-131 finding: a FACT the app cannot hold** |

**This is what the instruction was for.** Five facts became reads. The sixth became a defect — strictly
more useful, because a number typed into a chat window is not a source of truth for anything, and D42 C1
changes the tax treatment.

### Also: #1568 merged
D49 shipped. `affa74f3`. The T2 migration is unblocked.

### Files Modified
- `docs/implementation/MON-131_COMPLETION_BRIEF.md` — §5 row resolved; new §5.2 with the audit table

### Coverage — stated precisely
Establishes whether each fact has a **home in the schema**, read in source. It does **not** establish
whether the fields are **populated** on Reza's account — that is the Matrix read, and for
`availableDaysPerYear` (nullable, added recently) empty is the likely answer.

---

## Session: g8kra5 (cont.) — MON-144 raised; the MON-142 verification handout

### MON-144 — a FACT the app cannot hold

The one gap the §5.2 schema audit found is now registered. `OwnershipGroup`/`OwnershipStake` record
co-ownership **shares**; nothing records whether a co-owned property is run as a rental **business**
rather than held passively. D42 C1 says that changes the tax treatment, so **T5 cannot determine it from
data for any property**. `changesNumbers: false` — no number moves today; the defect is that the answer
has nowhere to live. Registry: 131 issues, gate green.

### The MON-142 handout — `docs/verification/briefs/MATRIX_MON142_RATE_DIVERGENCE.md`

First handout written under the §3.0b contract and the §3.0c return format. Carries all seven required
properties: committed location, build precondition (`affa74f3`+), identity assertion before any number is
read, falsifiable predictions, the exact artefact to return, the `mustNotMove` cluster, and the coverage
boundary.

**Part A** confirms the divergence from the app's own data: stored **6.690%** on both Bankwest IO loans
vs an implied **≈6.2697%**. The load-bearing prediction is that the divergence is **−0.42026 pp,
identical on both** — two loans drifting by exactly the same amount is what one lender changing one rate
looks like; two drifting differently would mean something else is wrong, and the handout says to report
that rather than round them together. It also asks whether *anything* surfaces the staleness (predicted
`false` — that absence **is** MON-142).

**Part B** folds in the five schema reads T4–T7 need. These carry **no prediction**: `expected` is the
literal `"UNKNOWN — report observed"`, with an explicit instruction not to invent one. For
`availableDaysPerYear` — nullable and added only in T1 — empty is a legitimate finding.

**What it deliberately cannot settle**, stated in §6: which rate is *correct*. The bank's actual rate is
outside the app. What it settles is that Monitrax holds enough evidence to tell its own user the stored
figure looks stale, and today does not.

### Files Modified
- `docs/issues/ISSUES.{json,md}` — MON-144 raised
- `docs/implementation/MON-131_COMPLETION_BRIEF.md` — §5.2 row now cites MON-144
- `docs/verification/briefs/MATRIX_MON142_RATE_DIVERGENCE.md` — **NEW**

### Also recorded
#1568's production deploy `dpl_6eBsqhFWYJYg9qi1psbkP17nQuCX` → **READY**. D49's gate change is live.

### Build Status
- [x] `issues:check` — PASS (131 valid) · `mon131:check` · `refnums:check` — PASS

### Coverage — stated precisely
Registers one defect and ships one verification instrument. Verifies nothing itself — the handout has not
been run.

---

## Session: g8kra5 (cont.) — "fix the producer, never the number" + a scope correction

### 1. The rule (Reza directive 2026-08-03) — CLAUDE.md §23.2, now rule #1

> *"Not to fix the numbers themselves! Only fix the number producers, rules, engines, etc. The main
> objective here is to remove duplicate derived-number producers."*

A wrong number is a **symptom**; the defect is always the producer, the rule, the engine, or the fact
feeding it. Change the producer and let every number follow.

**Banned outright:** editing a stored value so a screen reads right · a correction/offset/fudge anywhere
downstream · special-casing a surface · "adjusting" a declared `expectedMoves` value to match what
shipped. **If a declared number does not land after a migration, that is a defect in the migration, not
a number to nudge.**

And the objective is sharper than "make the tile correct": a tile that reads correctly while three
engines still compute its value has fixed **nothing** — the next change re-diverges them. One datum, one
producer; the tile only ever reads it.

Placed as **rule #1** of §23.2, ahead of REMOVE-THE-CULPRIT, because it is the more general statement:
the culprit rule says don't wrap the broken producer, this one says don't touch the number at all.

### 2. MON-144 — flag corrected, scope stated

Reza asked whether new MONs are being created while MON-131 is the focus. One was: **MON-144**, raised
today. MON-141/142/143 all predate the focus instruction (07-31).

Checking it surfaced a defect in the entry itself: **`changesNumbers` read `true`, which is wrong.** The
raise CLI received the string `"false"` and its parser only honours a real boolean, so the flag defaulted
to `true`. No number moves for MON-144 — nothing is computed from a field that does not exist. Corrected
to `false`, with the cause recorded in its notes so the CLI gap is visible.

**Scope, stated in the entry:** MON-144 was raised *as part of MON-131 T5 gate work* (the §5.2 facts
audit), not as a new workstream. It stays `OPEN` and untouched until the tranches are done — **filed so
the finding is not lost, not queued for build.** Registry: 131 issues, gate green.

### Files Modified
- `CLAUDE.md` — §23.2 rule #1; the following rules renumbered
- `docs/issues/ISSUES.{json,md}` — MON-144 `changesNumbers` → false + scope note

### Coverage — stated precisely
A rule and a flag correction. No code, no number, nothing verified.

---

## Session: sbpfhc — MON-131 T2: the loan-cost migration (part A)

### What was wrong / What changed / What you'll see

- **What was wrong:** Home said your loans cost **$8,817 a month**; the Spending page said **$12,779** —
  the same five loans, on the same day. `masterFinancialService` built its loan figure by reading the
  "minimum repayment" field and **skipping any loan where that field was empty**. It is empty for an
  interest-only loan, so both interest-only Bankwest loans and the HECS debt counted as costing **$0**
  while interest was charged on them every month. The two that survived were costed from the declared
  *plan* rather than from the repayments actually made.
- **What changed:** Home's loan figure now comes from the one engine the Spending page already used —
  actual repayments where they exist, the declared amount next, the interest actually accruing as the
  floor. The skip rule is **deleted, not widened**: an empty field can no longer make a loan invisible.
- **What you'll see:** Home's `THIS MONTH'S BUDGET` tile reads **$12,779**, matching the Spending page.
  Two figures that follow from it also move, and that is correct: **Saved** falls from about $15,048 to
  **$11,085**, and your saving rate from 59.4% to **43.7%**. Net worth stays **$3,401,782** and the
  health score stays **53**. One thing deliberately does **not** change yet — the entity money-flow
  Sankey still leaves those three loans out, so it will disagree with Home until T2-B lands.

### The declaration was amended BEFORE the migration, and why that mattered

The derivation sweep diffs three blocks: `cashflow.*`, `debt.metrics.*` and the quickMetrics mirrors.
`snapshot.debt` has **two** children — `summary` and `metrics` — and only `metrics` was swept. But
`masterFinancialService` assigns `quickMetrics.monthlyLoanRepayments = debtSummary.totalRepayments`, and
that leaf **is** declared. So `debt.summary.totalRepayments` moved by construction while sitting outside
the contract, and shipping it would have produced a `MOVED-UNDECLARED` at G7 that could not be told apart
from a mistake.

Found by reading the assembly, not by a capture — which is the point: the sweep is complete *for the
blocks it sweeps*, and the failure mode is an unswept sibling. Two paths added (13 → 15) as the PR's
**opening commit**, so the G3 "declare before building" ordering is visible in the history rather than
asserted. The relay's sweep now diffs `snapshot.debt` whole, so the class cannot recur.

`healthScore` was **checked rather than assumed** — `buildHealthScore` is fed the moved figure. Its
savings-rate component is `min(max(rate × 5, 0), 100)`: 59.37 × 5 before, 43.73 × 5 after, both clamping
to 100. Debt-to-income reads principal, emergency fund reads the actuals outflow, net worth is untouched.
So `mustNotMove: healthScore 53` stands — computed, not hoped for.

### Scope: one producer, not thirty-one

`loanCost` goes **31 → 30**, not 31 → 1, and the census history now says so in the entry itself. T2's
contract measures the `masterFinancialService` leaves and nothing else. The other 30 sites feed
`moneyFlow`'s per-entity flow, the CFO score and risk trees, reports, the debt planner and the health
tree — every one a **separate golden-baseline capture** this sweep never touched. Migrating them here
would have moved undeclared numbers by construction, which the completion brief §4 forbids. They are
**T2-B**, and T2-B needs its own capture and its own `expectedMoves` — the same loop, not a shortcut.

### Two instrument findings, both from the gates rather than from reading

1. **The producer census reported phantom producers on my own edits — twice.** A named arrow helper
   (`const canonicalMonthlyCost = (id) => …`) split the census's function unit and re-attributed matches
   across the halves, reading as +1 producer on four unrelated quantities. Then comment prose matched the
   text-based patterns: a line beginning `// 12,779.29` satisfies the frequency-arithmetic regex, and
   naming the quantities in a comment satisfied the identifier-near-arithmetic one. Both were **removed
   rather than seeded** — re-seeding would have locked a phantom rise into the ratchet in the PR whose
   whole purpose is driving that count down. Both traps are recorded in the code at the migration site.
2. **MON-147 — Layer 0 carried a node for a function deleted in T1-B.**
   `adjustPropertyRentalIncome()` was removed in `86f467f` (there is a test asserting the source no longer
   contains it), yet Layer 0 still pointed at `masterFinancialService.ts:1066` with three edges. The
   coverage gate reconciles the **file set** and **per-file hashes**, never symbols, so a false entry
   inside an otherwise-current file is invisible to it. Found by the new patch tool on its first run.

### Files modified

- `.audit/expected-moves-t2.json` — the amendment: 2 paths, `structuralAdditions`, `scopeOfThisTranchesMigration`
- `lib/services/masterFinancialService.ts` — the migration; the filter deleted; one canonical array feeding both loan legs
- `lib/calculations/propertyCashflow.ts` — `ResolvedLoanCost.actualsThroughDate` (VR-046 F1c; no consumer, moves nothing)
- `app/api/admin/matrix/golden-baseline/t2-loan-cost/route.ts` — sweep widened to `snapshot.debt` whole; `type` selected so `byType` is measured
- `tests/golden/ring2.loanCostFeed.test.ts` — **new**, the Ring-2 ratchet
- `scripts/neomatrix/patch-layer0.mjs` — **new**, D49's Layer-0 tax with verification built in
- `docs/verification/briefs/RING3_T2_LOAN_COST.md` — **new**, the §3.0b handout
- `.audit/producer-census.json` · `.audit/source-lock-exceptions.json` · `docs/architecture/REFERENCE_NUMBERS_SCOREBOARD.md` — ratchets
- `docs/financial-logic/graph/*` — Neo-sync: the new edge, 4 re-pinned anchors, the pruned ghost
- `docs/issues/ISSUES.{json,md}` — MON-130 → FIXING (partial, with the full sweep); MON-147 raised + closed
- `docs/implementation/*` · `docs/IMPLEMENTATION_PLAN.md` — ledger row, gate table, brief, workstream

### Gate (§20.6)

`Gate (§20.6): Document 10/10 (MON-131_COMPLETION_BRIEF §3.0/§3.0b · MON-131_TRANCHE_LEDGER §2 · expected-moves-t2.json · MON-131_T2_INPUT_FEED_CENSUS · CLAUDE.md §12.2.1/§19.4/§21.2.1/§23.2) · Requirements 10/10 · Logic 10/10`

The self-review changed the shape of the work twice. The first plan migrated all 31 sites, which the
contract forbids by construction — reading `expected-moves-t2.json` against the golden-baseline registry
showed that `moneyFlow`, the CFO trees and the health tree are separately captured, so the PR would have
stopped its own tranche at G7. The second plan migrated `masterFinancialService` and stopped, which would
have shipped an undeclared `debt.summary` move for exactly the same reason — caught by reading the
assembly rather than trusting the sweep's coverage.

### Coverage — stated precisely

Verifies, at Ring 2 on known data: that an interest-only loan with no declared repayment reaches the
snapshot at its interest floor; that the actuals feed reaches master; that all four loan-cost leaves equal
the canonical resolver's total; that the feed is unrounded; and that the byType split sums to it. Gates
green: `tsc`, `lint:financial-surfaces`, `lint:source-lock`, `census:producers:check`, `neomatrix:check`,
`refnums:check`, `issues:check`, `mon131:check`, and 4,433 vitest tests.

It does **NOT** verify any rendered number on Reza's account — that is the Ring-3 run, and CI green is not
verification (§23.2.3). It does **NOT** verify the declared after-values themselves (that is the derivation
sweep at `915704f0`). It does **NOT** touch the other 30 loan-cost producers, and it does **NOT** close
MON-130, MON-143 or MON-142.
