# CODE BRIEF — MON-131 PHASE A: the complete census, then Quantity Contracts

**Model: Fable 5. Branch off `main`.**
**changesNumbers: NO.** Phase A is **READ-ONLY**. Not one production line changes.
**Decision D14 governs:** Phase A specs → **Reza's gate** → Phase B migration. An agent that edits
a producer in this phase has violated the brief.

---

## §0 Reza's direction, 2026-07-29 — read this first, it sets the whole shape

> *"I want to cover all numbers. nothing is out of scope — the logic you have designed for reference
> numbers and derived numbers and calculation engines should apply to the whole app. I don't want to
> fix some and leave the rest. But these numbers can be fixed straight after MON-131. So in the plan
> I want MON-131 to be fixed, checked completely, and after that the remaining numbers to be fixed,
> checked — and when all are done, a complete and full sweep by the Matrix to check if you have
> captured all of the violating numbers and engines. Before we move to fixing any other issues."*

Two instructions that must not be conflated:

1. **Coverage is total and immediate.** The FACT/DERIVED law, the one-producer-per-quantity rule and
   the enforcement ratchets apply to **every** number in the app. Nothing is exempt.
2. **Remediation is sequenced.** MON-131's 23 quantities are fixed and **fully verified** first.
   The remainder follows immediately after, as **MON-136**, through the same machinery. Then a
   complete Matrix sweep. Only then any unrelated issue.

**The census is NOT sequenced.** It covers the whole app in this phase, because you cannot plan
"all of it" until you know what all of it is. Sequencing the *census* is how the sixteen-family
blind spot below came to exist in the first place.

---

## §1 State of the programme

Merged: Tranche −1 (golden baseline), −1b (Matrix Relay), 0 (census ratchet + source-lock extended
to `lib/`). **The enforcement exists. The specification it is meant to enforce does not.**

Migrating a producer means deleting other producers. That is only safe once the survivor's exact
semantic is written down — because the most dangerous failure in this programme is deleting a
function that computes a **legitimately different number nobody ever named**.
`REFERENCE_NUMBERS_DESIGN.md` §3.1 already documents four distinct quantities all called "monthly
spending": $1,482 · $14,261 · $25,973 · $170. All four are correct. Collapsing them to one would
destroy three real figures.

### 1.1 The known blind spot

The census behind "~336 producers across 23 quantities" scanned 23 named families. It did **not**
scan these, recorded as out of scope at the time:

stamp duty · GST · CGT · PSI attribution (Part 2-42) · Div 293 · tax offsets and franking credits ·
FTE/IEE elections · loan amortisation schedules · investment returns · superannuation projections ·
property valuation growth · insurance adequacy · budget variance · LVR and gearing ·
freedom-horizon projection · money-story margin

That list is **what was known to be missing.** Phase A0 must not treat it as the complete remainder
— it is a starting point for a sweep that finds what nobody has named yet.

Compounding it: the CI ratchet measures **13** quantities. **11 of the original 23 are UNMEASURED**
(the script lists them honestly). Those 11 are inside MON-131's own scope and currently unguarded.

---

## §2 Phase A0 — the complete census (runs first, covers everything)

**Goal: every number the app computes or displays is named, counted and classified. No exemptions.**

Method — extend `scripts/census/producers-census.mjs`. **Do not write a second census.** A second
counting method would be a MON-131 violation inside the MON-131 tooling, and would make the two
counts unreconcilable.

1. **Bring the 11 unmeasured quantities under the ratchet.** They are inside MON-131 and currently
   unguarded. This is the highest-priority census work — a quantity MON-131 claims to fix but does
   not measure cannot be verified as fixed.
2. **Census the sixteen families in §1.1.** Per family: is it a distinct quantity or an alias of an
   existing one (fold only on an *identical* semantic — a near-match is a separate quantity); how
   many producers; canonical home or `NOT ESTABLISHED`; legislated? if so cite Act and section and
   flag any constant outside `TAX_YEAR_CONFIGS` (D12 — expect overlap with MON-133).
3. **Then sweep for what neither list names.** Walk `lib/`, `app/api/`, `app/dashboard/`,
   `components/` for money-shaped computation not attributable to any catalogued quantity — a
   currency-formatted value, a rate, a ratio, a projection, a threshold comparison. Every one either
   maps to a named quantity or **becomes a new one**. This step is what makes "nothing is out of
   scope" true rather than aspirational.
4. **Classify each: FACT or DERIVED** (D1), and for DERIVED whether it is `MULTIPLE` or `SINGLE`.

**Deliverables:** extended census seed and ratchet · `REFERENCE_NUMBERS.md` covering every quantity
found · and a stated count: **N quantities total · M with a canonical home · P single-sourced · Q
still unmeasured.**

**Publish the totals even when they make the programme look larger. The honest number is the
deliverable.** If a family does not exist in the code, say so — a documented capability that was
never built is a finding, not an empty result.

**Then split the register in two, explicitly:**
- **MON-131 scope** — the original 23. Fixed and verified first.
- **MON-136 scope** — everything else the census found. Fixed immediately after, same machinery.

Raise **MON-136** in the registry: *"Reference Numbers, wave 2 — apply the one-producer law to every
remaining quantity"*, severity critical, `changesNumbers: true`, blocked-by MON-131.

---

## §3 Phase A1 — Quantity Contracts

One agent per quantity, **parallel, read-only**. Partition by quantity is safe **only here**, because
nothing is written. Phase B partitions by **file** (D14) — one file hosts many quantities, so
quantity-partitioned writers would collide.

**Full-depth contracts for MON-131's 23 now.** For MON-136's quantities, a register entry plus
producer count and canonical-home verdict is enough at this stage; their full contracts are written
when MON-136 starts, so that they can consume whatever MON-131 settles.

Each contract states:

| Field | Rule |
|---|---|
| `name` | Where the census found genuinely different semantics under one name, **produce a separate contract per semantic, with distinct names.** A primary deliverable, not an edge case. |
| `classification` | FACT or DERIVED (D1). |
| `semantic` | basis · window · inclusions · exclusions · units. Precise enough that two engineers could not implement it differently. |
| `canonicalHome` | `file:function` of the survivor **plus its Decimal twin** — they migrate together, always. |
| `callSites[]` | Every site tagged **CONSUMER** (reads the producer) · **DUPLICATE** (re-derives; to be deleted) · **DIFFERENT-QUANTITY** (computes something else; gets its own name and survives). |
| `invariants[]` | Checkable properties that become permanent tests: `netTotal ≤ grossTotal` · `Σ per-loan rows == stated aggregate` · `liquid + accessible + locked == net worth` · an interest-only loan is never `$0` · the same depreciation schedule yields the same annual figure through every path. |
| `independentExpectation` | How it is checked **without reading another screen** — legislation, a canonical formula, or an arithmetic identity. `NONE FOUND` is required where none exists; that quantity is recorded UNVERIFIABLE in the Number Ledger rather than given an invented test. |
| `surfaces[]` | Every route that renders it, `route → label`. The browser checklist for Axis B. Exhaustive — a missed surface makes the ledger silently under-cover. |
| `expectedMoves[]` | **Written BEFORE migration:** `pathPrefix`, why, and the arithmetic. Where a contract predicts **no** movement, say so — that is the strongest prediction and the easiest to falsify. |

**The `DIFFERENT-QUANTITY` tag is this phase's highest-value output.** Every Phase B deletion must
cite the contract entry authorising it.

### 3.1 Hard rules

1. **Read-only. No production file changes.**
2. **Never invent.** `NOT ESTABLISHED` / `NONE FOUND` beat a plausible guess every time.
3. **Cite `file:line` for every claim.** Roughly a third of the registry's anchors have drifted —
   re-verify at HEAD and report stale ones.
4. **Two agents disagreeing on a meaning = stop and escalate.** A semantic disagreement is a product
   decision and belongs to Reza.
5. D5, D8, D9, D10, D11, D12, D13, D15 are **settled inputs**, not open questions. Read
   `REFERENCE_NUMBERS_DESIGN.md` §6 before writing a contract that touches one.
6. A decision not already in §6 goes to a **Decisions Required** list with options and the accounting
   or legislative consequence of each. **Do not choose.**

---

## §4 The gate — what Reza receives

Not 40 documents. A decision pack:

1. **The count** — quantities, producers, canonical homes, single-sourced, still-unmeasured; before
   and after the complete census.
2. **The MON-131 / MON-136 split** — which quantities are in which wave, and why.
3. **Decisions Required** — one per line, phrased for a non-engineer, with consequences. He reads
   this first.
4. **The DIFFERENT-QUANTITY register** — producers that look like duplicates but aren't, with the
   number each actually computes. These need names.
5. **`NONE FOUND` list** — which of his numbers cannot be independently proven.
6. **Revised tranche plan** — publish the revision rather than forcing new quantities into the
   existing seven.
7. **Preconditions found** — anything of the MON-135 class: a migration that is *harmful* until
   something else is fixed first. **Actively hunt for these.** Each one found before Phase B is worth
   more than the whole document set.

---

## §5 The full plan this brief sits inside

| # | Stage | Gate |
|---|---|---|
| 1 | **MON-134** — determinism. Blocks the baseline lock, which blocks every diff. | in build |
| 2 | **Phase A** — complete census + contracts (this brief). | **Reza's gate** |
| 3 | **Baseline lock** — relay self-diff returns CLEAN. | — |
| 4 | **MON-131 Tranches 1–7** — income, loan cost, expense run-rate, tax constants + depreciation, balance sheet, rates/scores/runway, budget remainder. One PR each, Ring-3 each, merged before the next. **MON-135 gates Tranche 3.** | Reza merges each |
| 5 | **Number Ledger — MON-131 scope.** All 23 quantities × every surface × three axes. **MON-131 closes here, on evidence.** | — |
| 6 | **MON-136** — every remaining quantity, same machinery, same tranche discipline. | Reza merges each |
| 7 | **Number Ledger — MON-136 scope.** | — |
| 8 | **The complete Matrix sweep** — the whole app re-walked to confirm no violating number or engine remains anywhere. Reza's explicit requirement, and the only thing that closes the programme. | — |
| 9 | Only now: any unrelated issue. | — |

**Nothing at stage 9 is touched before stage 8 passes.** Preconditions found inside the programme
(MON-134, MON-135, MON-001) are not exceptions to this — they are part of it.

---

## §6 Preconditions on Phase B — do not lose these

- **MON-134** — `generateHealthReport` must be deterministic before any tranche diff can be trusted.
- **MON-135** — `aiCategorisation.ts` must stop stamping `isRecurring: false`. **Blocks Tranche 3.**
  Without it the one-off gate zeroes every AI-categorised expense, and the golden baseline would
  absorb the loss as an expected downward move — it cannot distinguish *one-offs correctly excluded*
  from *recurring costs wrongly excluded*.
- **MON-001** — fortnightly rent stored or treated as monthly. **Upstream of every producer.** Each
  contract must state whether its own FACT inputs are trustworthy; a correct formula over bad data is
  still wrong.

Expect to find more of this shape.

---

## §7 Verification of Phase A itself

It produces no numbers, so it is verified by review:

- Every `canonicalHome` and `callSites[]` anchor resolves at HEAD.
- Census counts reproduce on a re-run — same input, same output.
- **Adversarial pass:** a separate agent per contract, briefed to **refute** that the stated semantic
  matches the code, and to find one `DUPLICATE` that is really a `DIFFERENT-QUANTITY`. A contract
  that survives a hostile reader is worth ten that were only written.
- `census:producers:check`, `lint:source-lock`, `neomatrix:check`, `issues:check` green — they should
  be untouched, since no code changes.
- **Coverage boundary stated explicitly, per file and per quantity.** What was not read matters as
  much as what was. Under a "nothing is out of scope" directive, an unstated gap is the one failure
  that cannot be tolerated.

## §8 Neo-sync (§21.2.2)

Contracts and the register live **in the repo** — `docs/architecture/REFERENCE_NUMBERS.md` and
`docs/architecture/contracts/<quantity>.md`. Nothing sandbox-only; that failure has already cost this
programme one design record and one verification run. Changelog + `0·REF` workstream entry. Neomatrix
gains no symbols (no code change) — state that positively rather than leaving it ambiguous.

Record in `REFERENCE_NUMBERS_DESIGN.md` §6:

> **D16** — The reference-number law applies to **every** number in the app; nothing is out of scope.
> Remediation is sequenced — MON-131's quantities first, fully verified, then MON-136 for the
> remainder, then a complete Matrix sweep. No unrelated issue is worked before that sweep passes.
> *Reza, 29 Jul — DECIDED.*

---
*Prepared by The Matrix, 2026-07-29. Inputs: `REFERENCE_NUMBERS_DESIGN.md` (decisions D1–D16) ·
`PROTOCOL_NUMBER_LEDGER.md` (the three-axis verification this phase feeds) · the MON-131 subsumption
sweep (14 of 58 live issues close, 7 partial, 36 unrelated — the traced figure, replacing an earlier
over-generous estimate of ~19).*
