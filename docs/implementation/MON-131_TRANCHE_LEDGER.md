# MON-131 — the Tranche Ledger

**The programme's state of record.** Indexed from `01_ACTIVE_WORKSTREAMS.md` §0·REF, which stays the
workstream entry; this file holds per-tranche **gate state and evidence**.

> **Why a separate file rather than a second tracker.** The workstream entry is the index — status and
> checklist. This is the evidence record it points at. Same relationship as a canonical producer and
> its consumers: one place holds the state, the other reads it. If this file and any other artefact
> disagree about where the programme is, **this file wins**, because every cell here must cite
> evidence and the others may assert.

## §1 The rule that makes this worth having

**No cell is filled without evidence.** A PR number, a VR run doc, a census delta, a deploy id. Not a
judgement, not a recollection, not "should be fine."

**No tranche is marked done by assertion** — the same rule that stops a number reaching VERIFIED on a
passing unit test. Done means the gates in §2 are each satisfied *and cited*.

**An empty cell is information.** It says the thing has not been established. It must never be filled
to make the table look complete.

## §2 The gates

### Start gates — all must be true before a tranche writes code

| Gate | Evidence required |
|---|---|
| **G1 Preconditions clear** | Every §5.2 precondition for this tranche merged and deploy-verified |
| **G2 Contracts approved** | Contract file(s) in `docs/architecture/contracts/`, adversarially reviewed, semantics settled by a D-decision |
| **G3 `expectedMoves` declared** | Committed **before** the first line of migration, with the arithmetic per moved path |
| **G4 Baseline current** | A capture at the tranche's base SHA, or the prior tranche's post-capture |
| **G5 Facts held** | Every fact this tranche needs from Reza recorded — or the tranche is scoped to exclude what depends on them |

### Done gates — all must be true before the next tranche starts

| Gate | Evidence required |
|---|---|
| **G6 Merged + deployed** | PR number, merge SHA, deploy READY |
| **G7 Baseline diff clean** | Verdict `CLEAN` or `EXPECTED_ONLY`. **Any `MOVED-UNDECLARED` = STOP**, and the tranche does not advance |
| **G8 Ring-3 passed** | VR run doc, live production, real data, expectation derived independently |
| **G9 Census published** | Was-and-now count per quantity, split **collapsed** vs **deleted as dead** |
| **G10 Regression cluster intact** | The VR-041 Part-C figures byte-identical unless a declared move says otherwise |
| **G11 Issues closed on own evidence** | Each downstream issue verified live — never assumed closed because the root cause was fixed |

**If G7 or G8 fails: revert the merge. Do not patch forward.**

## §3 The ledger

Status vocabulary — five words only: `BLOCKED` · `READY` · `IN BUILD` · `VERIFYING` · `DONE`.

### Instrumentation — DONE

| Stage | Status | Evidence |
|---|---|---|
| T−1 golden baseline | **DONE** | PR #1525 merged |
| T0 census ratchet + source-lock → `lib/` | **DONE** | PR #1525; seed `.audit/producer-census.json` |
| T−1b Matrix Relay | **DONE** | PR #1526 merged, deploy verified; parity ratchet `tests/matrix/goldenBaselineRelay.test.ts` |
| Baseline captured | **DONE** | 8 trees, 1,767 leaves, at `4e6cdd5c`, user `91b6d7ce`, via relay A2 |
| Phase A inventory + 49 contracts | **DONE** | PR #1534 merged |
| Phase A gate — 28 decisions | **DONE** | PR #1535 merged (D17–D41); PR #1536 open (D42 corrections + D43–D47) |

### MON-134 — health-trend determinism — DONE

| Gate | State | Evidence |
|---|---|---|
| G6 merged + deployed | ✅ | PRs #1529, #1530, read-path PR |
| G7 baseline diff | ✅ | Relay A3 self-diff **`verdict: CLEAN`**, 1,767 leaves identical, 0 unexpected |
| G8 Ring-3 | ✅ | Capture confirms `direction: "INSUFFICIENT_HISTORY"`, `changePercent` **absent from the object** — not zero |

*Recorded because it is the acceptance precedent: the fix was verified by the instrument it unblocked.*

### MON-135 — categoriser precondition — READY

**Blocks Tranche 3.** `aiCategorisation.ts` stamps `isRecurring: false` unconditionally; the one-off
gate would zero every AI-categorised expense.

| Gate | State | Evidence |
|---|---|---|
| G2 contract / brief | ✅ | PR #1531 brief |
| G3 expectedMoves | — | **Declares NO movement.** This PR changes what a default means, not what a number is |
| G6 merged | — | |
| G8 Ring-3 | — | Acceptance: recurring expenses on `/dashboard/expenses` **unchanged**. Any movement is itself the finding |

### Tranche 1 — income (MON-128) — BLOCKED

| Gate | State | Evidence / what's missing |
|---|---|---|
| G1 preconditions | ✅ | MON-134 done; MON-135 does not gate T1 |
| G2 contracts | ✅ | Semantics settled: D17 banked income · D20 layered engines · D18 savings rate |
| G3 expectedMoves | — | **Not yet written.** Must include: income $41,303 → ~$24,250 · savings rate · health score 54 · debt-to-income 416% |
| G4 baseline | ✅ | `4e6cdd5c` capture |
| G5 facts | ❌ | **Salary component** (D33) · **HELP repayment income from the notice of assessment** (D42 C2/C3) · which of $121,227 vs $121,881 rental is gross (D31) |
| G7–G11 | — | |

**Day-one invariant:** `netTotal ≤ grossTotal`, Float and Decimal.

### Tranche 2 — loan cost (MON-130) — BLOCKED

| Gate | State | Evidence / what's missing |
|---|---|---|
| G2 contracts | ✅ | D21 interest net of offset; D26 equity on full balance (the deliberate asymmetry) |
| G3 expectedMoves | — | Must include: Home budget tile Loans $8,817 → $12,779 · per-loan principal/interest split (**not established** — derive, never guess) |
| G5 facts | ❌ | Cross-collateralised loans? · fixed loans? · mixed-purpose loans? |
| G7–G11 | — | |

**Also in scope:** the Q1 rate-unit bug at `EntityCashflowSummary.tsx:693` — see the drift log, §4 D3.

### Tranche 3 — expense run-rate (MON-129) — BLOCKED

| Gate | State | Evidence / what's missing |
|---|---|---|
| G1 preconditions | ❌ | **MON-135 must merge first.** Non-negotiable |
| G2 contracts | ✅ | D22 committed vs essential |
| G3 expectedMoves | — | **The trap:** T3 legitimately lowers expenses, so a broad "expenses fall" entry would absorb MON-135's loss as expected. Declare **per-path** arithmetic, never a directional prefix |
| G7–G11 | — | |

### Tranche 4 — tax constants + depreciation — BLOCKED

| Gate | State | Evidence / what's missing |
|---|---|---|
| G2 contracts | ✅ | D33 SG per period + MCB · D35 PAYG coefficients · D44 Div 43/40 split, method locked per asset · **D41 regime versioning** |
| G3 expectedMoves | — | Must include: SG 11.5% → 12% · PAYG on FY26-27 coefficients · depreciation (~4× divergence today) |
| G5 facts | ❌ | **QS depreciation schedules** — if they exist, ingest as facts rather than compute (D44) |
| G7–G11 | — | |

**Carries the architectural change:** the config must hold per-period **rules**, not just values. Seven
regime switches in eight years are already identified.

### Tranche 5 — balance sheet — BLOCKED

| Gate | State | Evidence / what's missing |
|---|---|---|
| G2 contracts | ✅ | D27 accessible at market · D28 realisable derived · D29 cash classification · D26 equity + RENTAL split |
| G3 expectedMoves | — | Must include: cash tile · accessible funds · property equity per property |
| G5 facts | ❌ | Which properties are owned-and-rented-out vs tenanted residence (D26) · **any co-owned property held as a rental *business*** (D42 C1 — changes the attribution rule) |
| G7–G11 | — | |

**Never floored:** negative equity carries through to the portfolio total.

### Tranche 6 — rates, scores, runway — BLOCKED

| Gate | State | Evidence / what's missing |
|---|---|---|
| G2 contracts | ✅ | D30 two runway quantities + INDEFINITE · D31 gross flows · D32 health score re-founded · D47 insurance 70 removed |
| G3 expectedMoves | — | Must include: 11.6 mo retired → ~21 and ~73 · health score 54 → moves · insurance 70 → absent |
| G5 facts | ❌ | Availability and available-days per property (D43) |
| G7–G11 | — | |

**Trap:** `INDEFINITE` is a state. Any downstream score that averages runway months must handle the
state, not a sentinel — that is how 999 got there.

### Tranche 7 — budget remainder (MON-127) — BLOCKED

| Gate | State | Evidence / what's missing |
|---|---|---|
| G2 contracts | ✅ | D24 two-basis remainder · D23 variance survivor · D25 ABS relabel · D45 assumptions config |
| G3 expectedMoves | — | Must include: suggested budget $4,442 → planning ~$10,000 and an actual figure |
| G5 facts | ❌ | Total super balance · Division 293 exposure (both gate the growth mode) |
| G7–G11 | — | |

**Compliance:** modes are scenarios with consequences, never recommendations. ASIC assumption
framework applies where any projection touches super.

### Closing stages — BLOCKED

| Stage | Gate | Note |
|---|---|---|
| Number Ledger, MON-131 scope | — | 23 quantities × every surface × three axes. **MON-131 closes here, on evidence** |
| MON-136 | — | Every remaining quantity, same machinery |
| Number Ledger, MON-136 scope | — | |
| **The complete Matrix sweep** | — | Reza's explicit requirement. The only thing that closes the programme |
| Everything else | — | **HELD.** The 36 issues producer collapse won't touch |

## §4 Drift log

**Where a reported state diverged from repo reality.** This section exists because the Matrix's status
page was maintained by hand, outside the repo, and drifted within a day. Every entry is a case for
deriving state from evidence rather than asserting it.

**D1 — census counts stale in the Matrix's reporting.** The status page and several Matrix messages
cited **564 sites across 13 quantities**. Phase A0 extended the census to **1,307 sites across 40
quantities**, plus a 424-function unattributed sweep bucket. *Corrected: the ledger and status page now
cite the Phase A0 figures. Root cause: the Matrix quoted the Tranche 0 seed after Phase A superseded
it.*

**D2 — quantity count conflated.** The Matrix reported **49 quantities**. 49 is the number of
**contracts**; the inventory names **68 quantities**. *Corrected. Root cause: contract count read as
quantity count.*

**D3 — the Q1 100× bug was reported as LIVE on Home; it is not rendered.** `01_ACTIVE_WORKSTREAMS.md`
§0·REF and `NUMBER_INVENTORY.md` describe *"a LIVE 100× bug on Home at `EntityCashflowSummary:693`"*.
The unit error is real and confirmed at both ends — the schema stores `interestRateAnnual` as a decimal
(`0.0625`), `snapshot/route.ts:852` passes it through, and the widget divides by 100 again. **But the
value only reaches a screen through a per-loan "Tax Benefit (est.)" row at `:488`, and Home mounts
`GlassEntityCashflow`, which renders six summary rows from `data.summary.standaloneLoansCost` and never
touches `taxBenefit`. `EntityCashflowSummary` is imported and never mounted.** *Verdict: real defect,
fix in Tranche 2, **no rendered surface**. The "LIVE on Home" framing is an over-claim that did not
survive tracing — Phase A's own headline finding. Root cause: code-path analysis without a mount check.*

**D4 — "Phase B blocked, 5 decisions open" outlived its truth by hours.** The register consolidated
from session logs written before decisions 17, 20, 21, 22 and 25 were settled. *Corrected in PR #1536.
Root cause: consolidation from a snapshot rather than from the live decision state.*

**Pattern across all four: state asserted from a stale read.** The mitigation is this ledger — cells
cite evidence, and the status page renders from here rather than being written independently.

## §5 What this ledger deliberately does not do

It does not track Code's internal task list, and it does not duplicate the contracts — the contracts
hold call sites and `expectedMoves`; this holds whether they were satisfied.

It does not assert progress the census can't confirm. **The census count is the only objective
progress measure in the programme**, because it cannot be talked up — and per D46 it must publish
*collapsed* separately from *deleted as dead*, or removing code nobody ran reads as progress.

And it does not claim the safety net is complete. Known limits, restated so no one relies on more than
exists: the baseline covers **8 orchestrator trees, not all leaf producers** · it captures **values, not
rendered screens**, so a component that stops rendering would not appear in a diff · and **a declared
move can mask an undeclared one**, which is precisely MON-135's shape and why `expectedMoves` must be
per-path rather than directional.

---
*Opened by The Matrix, 30 July 2026, at Reza's direction — "build anything that makes you keep on track
and avoid drifts from the plan." Indexed from `01_ACTIVE_WORKSTREAMS.md` §0·REF. Companion to
`NUMBER_INVENTORY.md`, `REFERENCE_NUMBERS_DECISIONS.md`, `decisions/D42_VERIFICATION_CORRECTIONS.md`
and `PROTOCOL_NUMBER_LEDGER.md`.*
