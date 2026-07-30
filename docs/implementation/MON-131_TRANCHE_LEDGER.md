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
| Baseline captured | **BLOCKED** | ❌ **No committed artefact exists** — the relay A2 capture (8 trees, 1,767 leaves, at `4e6cdd5c`, user `91b6d7ce`) was reported but never persisted; nothing lives under `.audit/golden-baseline-*.json`. The previous **DONE** here violated this ledger's own §1 rule (drift log **D5**). Re-capture + COMMIT at current main before any code-touching merge — main has been docs-only since `4e6cdd5c`, so a fresh capture still represents the pre-code state. Capture requires relay (admin session) or CLI + `DATABASE_URL` — neither exists in the Code sandbox; the Matrix produces it, Reza/Code commits it |
| Phase A inventory + 48 contract files | **DONE** | PR #1534 merged. Count corrected (drift log **D6**): **48** files on main = 45 full-depth quantity contracts + 3 register/index documents (`mon136-register` · `mon136-unattributed-sweep` · `forecast-flows-index`); "49" was an over-count |
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
| Build | ✅ | **PR #1538 (draft, open)** @ `1f80286c` — tri-state prediction (null = no determination) · evidence-based recurrence via `getRecurringPatterns` + the ONE ≤10% tolerance · two `aiIsRecurring` columns nullable · Wall-B2 Float+Decimal tri-state fixtures + never-emits-false guards (vitest 434/434; all seven `=== false` gates in `lib/` verified strict). Migration incident CLOSED: v1 used model names not `@@map`'ped tables (lesson in the migration file); v2 pushed; Reza ran the dev-DB `migrate resolve --rolled-back` 2026-07-30 ~06:21 (output: "marked as rolled back", host `35.189.31.209`); preview REBUILT GREEN at `68dcd899` (deploy `7s94FmhV…` READY — v2 applied cleanly) |
| G3 expectedMoves | ✅ | **Declares NO movement.** This PR changes what a default means, not what a number is |
| G6 merged | ✅ | PR #1538 merged 2026-07-30; prod deploy `dpl_48fktuyb…` READY at `b1af5021` (migration v2 applied to PROD cleanly) |
| G8 Ring-3 | — | Acceptance: recurring expenses on `/dashboard/expenses` **unchanged**. Any movement is itself the finding. **Merged before a pre-capture existed** — accepted paths: (a) the Matrix persists its in-session `4e6cdd5c` capture if still held (STILL a valid BEFORE — no code-touching merge landed between `4e6cdd5c` and #1538) and diffs against a fresh capture; or (b) fresh capture NOW + compare the Part-C money surfaces against the committed `rendered-baseline-8700b1d7.json` + VR-041 figures. Either way the fresh capture becomes T1's baseline of record |

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

**D5 — the "Baseline captured — DONE" cell cited a relay call, not a committed artefact.** This
ledger's own §1 rule is "no cell is filled without evidence"; the evidence for a baseline is the
committed capture file, and nothing exists under `.audit/golden-baseline-*.json` — the 1,767-leaf
capture at `4e6cdd5c` was sandbox-only and is unrecoverable as a "before" state once any code-touching
merge lands. *Corrected 2026-07-30 (this PR): cell flipped to BLOCKED; recapture-and-commit at current
main required before MON-135 or T1 merge (main is docs-only since `4e6cdd5c`, so a fresh capture still
represents the pre-code state). Root cause: the ledger's opening entry was written from the Matrix's
session memory of the capture, not from the repo — the exact failure the ledger exists to stop, in the
ledger's own first table.*

**D6 — the contract count was off by one everywhere it was cited.** "49 contracts" appears in
`NUMBER_INVENTORY.md`, this ledger's instrumentation row, and D2's own correction. **48** files exist
on main: 45 full-depth quantity contracts + 3 register/index documents (`mon136-register.md`,
`mon136-unattributed-sweep.md`, `forecast-flows-index.md`). *Corrected 2026-07-30 (this PR) in both
files. Root cause: the count was quoted from the assembling session's running tally, never re-derived
from `ls | wc -l` at HEAD.*

**Pattern across all six: state asserted from a stale read.** The mitigation is this ledger — cells
cite evidence, and the status page renders from here rather than being written independently.

## §4b The register gap — MON-112…124 is deliberate, not lost

`docs/issues/ISSUES.json` holds 123 issues, runs to MON-136, and is missing exactly **MON-112…124**.
The gap is accounted for, id by id:

- **MON-112 / 113 / 114** — reserved for the three issues the `vr038-039-advance` script raises.
  The script merged in #1521 and was **executed via `registry-reconcile.mjs` in #1529** for the
  MON-104…110 advancement, but the 112–114 raise portion has not run; the ids stay reserved for it.
- **MON-115…124** — VR-040's ten findings (`docs/verification/runs/VR-040.md`, committed by this PR).
  **Seven of the ten were demoted to observations** under the holistic-verification law (an untraced
  cross-surface difference is an observation, not a finding — D3 in the drift log is the type
  specimen) and are **re-filed only after re-tracing**, under NEW ids if they survive. The remaining
  three were re-filed during reconciliation under new ids (MON-125/126 among them — the brief's
  "MON-115" became MON-126 after an id collision).
- **Ids are never reused.** The gap is the record that these numbers were allocated and their claims
  re-examined — a register that silently compacted would erase that history.

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
