# CODE BRIEF — MON-131 PHASE A: Quantity Contracts + the Wave 3 census

**Model: Fable 5. Branch off `main`.**
**changesNumbers: NO.** Phase A is **READ-ONLY**. Not one production line changes. The deliverable
is specification plus two new documents.
**Decision D14 governs this phase:** Phase A specs → **Reza's gate** → Phase B migration. *No
migration writes until Reza approves the contracts.* An agent that edits a producer in this phase
has violated the brief.

> **Reza's directive, 2026-07-29:** *"I want to close out that issue first and cover all of monitrax
> numbers before moving to any other issues."* Phase A exists to make "all of Monitrax's numbers"
> a defined, finite, checkable set — because right now it isn't one.

---

## §1 Why Phase A, and why it is bigger than previously scoped

Tranches −1, −1b and 0 are merged: the golden baseline, the Matrix Relay, the producer-census
ratchet, and the source-lock now scanning `lib/`. The enforcement exists. **What does not yet exist
is the specification the enforcement is supposed to enforce.**

Migrating a producer means deleting other producers. That is only safe when the surviving one's
**exact semantic** is written down first — because the single most dangerous failure in this
programme is deleting a function that computes a *legitimately different number* which nobody ever
named. `REFERENCE_NUMBERS_DESIGN.md` §3.1 already documents four distinct quantities all called
"monthly spending" ($1,482 · $14,261 · $25,973 · $170). All four are correct. Collapsing them to
one would destroy three real figures.

### 1.1 The coverage gap — state it before building on it

The census that produced "~336 producers across 23 quantities" scanned **23 named quantity
families**. It did **not** scan these, and they were recorded as out of scope at the time:

stamp duty · GST · CGT · PSI attribution (Part 2-42) · Div 293 · tax offsets and franking credits ·
FTE/IEE elections · loan amortisation schedules · investment returns · superannuation projections ·
property valuation growth · insurance adequacy · budget variance · LVR and gearing ·
freedom-horizon projection · money-story margin

**Under Reza's directive these are now in scope.** MON-131 cannot be declared closed while a
sixteen-family blind spot sits inside it — that would be exactly the "partial coverage reported as
full coverage" failure the verification protocol exists to prevent.

So Phase A has two halves, and **the census half runs first**, because it determines how many
contracts there are.

---

## §2 Phase A0 — the Wave 3 census (do this first)

For each family above, answer only what the code supports:

1. **Is it a distinct named quantity, or an alias of one of the 23?** Some will fold in — LVR is
   plausibly derived from assets/liabilities; gearing may be too. Fold only where the semantic is
   *identical*, and say which of the 23 it folds into. A near-match is a separate quantity.
2. **How many producers compute it?** Same method as `scripts/census/producers-census.mjs` —
   identifier-near-arithmetic including Decimal methods. **Extend that script; do not write a second
   census.** A second counting method would be a MON-131 violation inside the MON-131 tooling.
3. **Does a canonical home exist?** `NOT ESTABLISHED` is a valid and useful answer.
4. **Is it legislated?** If yes, cite the Act and section as the code does, and flag any constant
   living outside `TAX_YEAR_CONFIGS` (decision D12). Expect overlap with MON-133.

**Deliverable:** the census seed extended, `REFERENCE_NUMBERS.md` extended, and a stated count:
*N quantities total, M with a canonical home, P single-sourced.* Publish the new totals even where
they make the programme look larger — **the honest number is the deliverable.**

If a family turns out not to exist in the code at all, say so. That is a finding (a documented
capability that was never built), not an empty result.

---

## §3 Phase A1 — one Quantity Contract per quantity

One agent per quantity, **parallel, read-only**. Partition by quantity here — this is the one phase
where that is safe, because nothing is written. (Phase B partitions by **file**, per D14, because
one file hosts many quantities and quantity-partitioned writers would collide.)

Each contract states:

| Field | Rule |
|---|---|
| `name` | The quantity's canonical name. Where the census found genuinely different semantics under one name, **produce a separate contract per semantic with distinct names** — this is a primary deliverable, not an edge case. |
| `classification` | FACT or DERIVED (D1). |
| `semantic` | basis · window · inclusions · exclusions · units. Precise enough that two engineers could not implement it differently. |
| `canonicalHome` | `file:function` of the survivor, **plus its Decimal twin** (they migrate together, always). |
| `callSites[]` | Every site, each tagged **CONSUMER** (already reads the producer) · **DUPLICATE** (re-derives; to be deleted) · **DIFFERENT-QUANTITY** (computes something else; gets its own name and survives). |
| `invariants[]` | Checkable properties that become permanent tests. e.g. `netTotal ≤ grossTotal`; `Σ per-loan rows == stated aggregate`; `liquid + accessible + locked == net worth`; an interest-only loan is never `$0`; the same depreciation schedule yields the same annual figure through every path. |
| `independentExpectation` | How the number is checked **without reading another screen** — legislation, a canonical formula, or an arithmetic identity. `NONE FOUND` is required where none exists; that quantity is recorded UNVERIFIABLE in the Number Ledger rather than given an invented test. |
| `surfaces[]` | Every route that renders it, as `route → label`. This is the browser checklist for Axis B. Exhaustive — a missed surface makes the ledger silently under-cover. |
| `expectedMoves[]` | **Written BEFORE migration.** Each entry: `pathPrefix`, why, and the arithmetic. A figure that moves without a matching entry is a defect until proven otherwise. Where a contract predicts **no** movement, say so explicitly — that is the strongest possible prediction and the easiest to falsify. |

**The `DIFFERENT-QUANTITY` tag is the highest-value output of this phase.** Every producer deletion
in Phase B must cite the contract entry authorising it.

### 3.1 Hard rules for Phase A agents

1. **Read-only. No production file changes.**
2. **Never invent.** `NOT ESTABLISHED` / `NONE FOUND` beat a plausible guess every time.
3. **Cite `file:line` for every claim.** Roughly a third of the registry's existing line anchors have
   drifted — re-verify at HEAD, and report anchors you find stale.
4. **Two agents disagreeing on a meaning = stop and escalate.** Do not reconcile it between
   yourselves; a semantic disagreement is a product decision and belongs to Reza.
5. Consume the decisions already made — D5, D8, D9, D10, D11, D12, D13, D15 are settled inputs, not
   open questions. Read `REFERENCE_NUMBERS_DESIGN.md` §6 before writing a contract that touches one.
6. Where a contract needs a decision that isn't in §6, **do not choose.** Add it to a
   *Decisions Required* list with the options and the accounting or legislative consequence of each.

---

## §4 What Phase A must surface to Reza (the gate)

The gate is not "here are 39 documents." It is a decision pack:

1. **The count.** Quantities, producers, canonical homes, single-sourced — before and after Wave 3.
2. **Decisions Required** — each with options and consequences, phrased for a non-engineer, one
   decision per line. This is what Reza reads first.
3. **The DIFFERENT-QUANTITY register** — every producer that looks like a duplicate but isn't, with
   the number it actually computes. These need names.
4. **`NONE FOUND` list** — quantities with no independent check. These will be recorded
   UNVERIFIABLE in the ledger, and Reza should know which of his numbers cannot be independently
   proven.
5. **Revised tranche plan** — Wave 3 may add tranches or re-order them. Publish the revision rather
   than forcing new quantities into the existing seven.
6. **Preconditions found** — anything of the MON-135 class: a migration that would be *harmful*
   until something else is fixed first. MON-135 was found this way and would have silently zeroed
   every AI-categorised expense. **Actively hunt for more.** Each one found before Phase B is worth
   more than the whole document set.

---

## §5 Known preconditions on Phase B (do not lose these)

- **MON-134** — `generateHealthReport` must be deterministic before any tranche diff can be trusted.
  Blocks the baseline lock, which blocks every tranche.
- **MON-135** — `aiCategorisation.ts` must stop stamping `isRecurring: false`. **Blocks Tranche 3.**
  Without it, the one-off gate zeroes every AI-categorised expense, and the golden baseline would
  absorb the loss as an expected downward move.
- **MON-001** — fortnightly rent stored or treated as monthly. **Upstream of every producer.** A
  canonical producer computing on a wrong row still gives a wrong answer. Phase A must state, per
  contract, whether its inputs are trustworthy — a contract whose FACTs are wrong is a correct
  formula over bad data.

Phase A should look for others of this shape and expect to find them.

---

## §6 Verification of Phase A itself

Phase A produces no numbers, so it is verified by review, not by tests:

- Every contract's `canonicalHome` and every `callSites[]` anchor resolves at HEAD.
- Census counts reproduce on a re-run — deterministic, same input same output.
- **Adversarial pass:** a separate agent, per contract, briefed to **refute** that the stated
  semantic matches the code, and to find one `DUPLICATE` that is really a `DIFFERENT-QUANTITY`. A
  contract that survives a hostile reader is worth ten that were only written.
- `census:producers:check`, `lint:source-lock`, `neomatrix:check`, `issues:check` green (they should
  be untouched — this phase changes no code).
- **Coverage boundary stated explicitly**, per file and per quantity. What was not read is as
  important as what was.

## §7 Neo-sync (§21.2.2)

Contracts and the extended register live **in the repo** — `docs/architecture/REFERENCE_NUMBERS.md`
plus `docs/architecture/contracts/<quantity>.md`. Nothing sandbox-only; that failure has already
cost this programme one design record and one verification run. Changelog + `0·REF` workstream
entry. Neomatrix picks up no new symbols (no code change), so note that positively rather than
leaving the checkbox ambiguous.

---
*Prepared by The Matrix, 2026-07-29, at `a2aa0270`. Inputs: `REFERENCE_NUMBERS_DESIGN.md` (design
record, decisions D1–D15) · `PROTOCOL_NUMBER_LEDGER.md` (the three-axis verification this phase
feeds) · the MON-131 subsumption sweep (14 of 58 live issues close, 7 partial, 36 unrelated — the
traced figure, replacing an earlier over-generous estimate of ~19).*
