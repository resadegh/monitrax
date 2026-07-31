# The Matrix — code-brief boot sequence

**Status: binding on every brief and handout the Matrix writes.** Not a style guide. A brief that omits a §2 block is defective and gets reissued, regardless of how good its analysis is.

---

## §1 Why this exists — a named failure, mine

Reza raised, twice, that briefs were shipping without the instructions that make the work traceable. He was right both times, and the second time was worse because the first should have fixed it.

| Brief | CLAUDE.md read | Documentation duty | Ledger in same PR | Neo-sync | Registry discipline |
|---|---|---|---|---|---|
| T1-B — `CODE_BRIEF_MON-131_TRANCHE_1B_flip.md` | ❌ | ❌ | ❌ | ✓ | ❌ |
| T1-C — `CODE_BRIEF_MON-131_TRANCHE_1C_repair.md` | ❌ | ❌ | ✓ §7 | ✓ §8 | ❌ |
| T2 — `CODE_BRIEF_MON-131_TRANCHE_2_loan-cost.md` | ❌ → §-1 added **after** Reza flagged it | ❌ → same | ✓ | ✓ | ✓ (in §-1) |

**The diagnosis is not forgetfulness.** Effort went into evidence, arithmetic and acceptance contracts — the parts that are interesting to write — while process compliance was treated as optional garnish added when it happened to occur to me. That is exactly inverted. The analysis is the part the Matrix does reliably. The process instructions are the part that keeps the work traceable when nobody is watching, and they were the part being dropped.

**A brief is the only thing a cold-start session reads before it starts work.** What is not in it does not happen. Assuming CLAUDE.md compliance rather than requiring it is the same failure class as a producer nobody enumerated: an obligation that exists on paper and is invisible at the point of use.

## §2 The fixed blocks — every brief, in this order, no exceptions

### §2.1 Header
Model · branch · **`changesNumbers: YES|NO`** · who clicks the merge.

### §2.2 Read-first list — `CLAUDE.md` is always item 1
> 1. **`CLAUDE.md` — in full, before anything else.** See §0. This is not a formality.

Then the evidence base: the prior VR run, the contract file, the ledger sections, the predecessor brief.

### §2.3 §0 — CLAUDE.md and the documentation duty
Verbatim obligations, every brief:

1. **Every change documented as it is made**, not reconstructed afterwards — what changed, which file, which decision or contract entry authorises it, what number it moves.
2. **Every deleted producer cites its contract entry.** *Collapsed* and *deleted as dead* are different claims, published separately (D46).
3. **The ledger updates in the same PR as the code**, evidence in every cell. An empty cell is information; a filled cell without evidence is a violation.
4. **Changelog + `0·REF` workstream entry.**
5. **Neo-sync (§21.2.2)** — Neomatrix re-pin, NeoAudit ratchets, census re-run with was-and-now.
6. **Registry moves on evidence** (`FIX_PROTOCOL.md`) — `FIXING` until a Ring-3 run records; never `VERIFIED` on a passing unit test or a formula argument.
7. **The PR body is a deliverable, not a summary** — before/after table in Reza's language, the enumeration, the open questions.
8. **The plan hub and `01_ACTIVE_WORKSTREAMS` §0·REF are updated too.** Added 2026-07-31: Code found the hub five PRs stale and the workstream entry stale from *before T1 began*, while the ledger row was present on every one of those PRs. **Naming only the ledger is how the rest drifts.**

Closing line, every brief: *a tranche that lands correct numbers with no record of how is not done.*

### §2.4 State of play
Where the programme is, cold-start readable. **What the previous tranche got right and must survive** — before what failed. A session told only "it failed, redo it" rebuilds working code.

### §2.5 Evidence base
Measured figures with their SHA, the account they came from, and the arithmetic. Never an assertion where a derivation fits.

### §2.6 Scope — and explicitly NOT scope
Named exclusions with their tranche. Silence about an adjacent defect reads as permission.

### §2.7 `expectedMoves`
Computed not estimated · per path with arithmetic · **never directional** · the `mustNotMove` cluster · annual derived from annual components, never monthly × 12 (VR-045 §2.1).

### §2.8 Acceptance
Numbered, testable, with the revert contract. **The last item is always §0 compliance**, checked by the Ring-3 run alongside the numbers.

### §2.9 Ledger + Neo-sync
Which rows move, which drift-log entry is required.

## §3 Pre-flight — run before any brief is sent or pushed

Answer each in writing. A "no" blocks the send.

1. Is `CLAUDE.md` item 1 of the read-first list?
2. Does §0 carry all eight documentation obligations?
3. Does acceptance include a §0-compliance item?
4. Is every figure sourced to a SHA and an account?
5. Is `mustNotMove` present, and does it name items that must move **onto** existing canonical values rather than away from them?
6. Are out-of-scope defects named with their tranche?
7. **§4's gate question** — answered below?
8. Does the brief say what the previous tranche got **right**?

## §4 The gate-coverage question — every brief must answer it

Added 2026-07-31, from Code's finding on `mon131:check`.

Code built that gate specifically to stop the record drifting. It went **green on five consecutive PRs** while the plan hub and workstream entry drifted badly — because it checked only the ledger, and the ledger row was always present. **The gate worked exactly as written and was still insufficient.**

That is the same class as T1-B's failure: a check narrower than the rule it enforces. So every brief now asks, explicitly:

> **What would this tranche's gates fail to catch?** Name at least one thing. If the answer is "nothing", that answer is wrong — say why the gate's coverage equals the rule's scope, or record the hole.

**Record the hole rather than assume coverage.** An ungated rule written down is safer than an ungated rule believed to be gated.

## §5 What varies, what never varies

**Varies:** the analysis, the evidence, the mechanism, the arithmetic, the scope. That is the Matrix's actual work and it should be different every time.

**Never varies:** §2.2 through §2.3, §2.7's contract shape, §2.8's revert clause, §3, §4.

**The fixed part is fixed precisely because it is the part that gets dropped when the variable part is interesting.**

## §6 Applies to handouts too

Any document the Matrix hands to a Code session — brief, handout, verification instruction — carries §2.2, §2.3 and §4. A one-GET capture request needs no `expectedMoves`; it still needs CLAUDE.md and the documentation duty, because it still produces a record that has to be traceable.

---
*Opened by The Matrix, 31 July 2026, after Reza raised the same gap twice. §1's table is deliberately unflattering: the point of a standard is that it survives the writer's judgement on the day, and the evidence that it needs to is my own last three briefs.*
