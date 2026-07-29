# The Number Inventory — report specification

**The Phase A gate deliverable.** Required by Reza, 2026-07-29:

> *"the next brief is going to identify all of the violating numbers and you can give me a full
> report on all numbers — what they are and where the violations are — before moving to fix."*

One document. `docs/architecture/NUMBER_INVENTORY.md`. Written for Reza, not for engineers: he
decides from it, so a line he cannot act on is a line that does not belong in it.

Companion to `CODE_BRIEF_MON-131_PHASE_A_quantity-contracts.md`. The contracts are the engineering
artefact; **this is the decision artefact.** Both are Phase A outputs and neither is optional.

---

## §1 The one-line rule

**Every number the app computes or displays appears exactly once in this report, with a verdict.**

A number that is not in the report is a number nobody has looked at. Under D16 ("nothing is out of
scope") an omission is the single failure that cannot be tolerated — so where coverage is incomplete,
the report says so explicitly in §6 rather than quietly ending.

## §2 Part 1 — the headline table

The whole app on one page. One row per quantity.

| Column | Contents |
|---|---|
| **Number** | The name a user would recognise. "Monthly income", not `quickMetrics.monthlyIncome`. |
| **What it means** | One plain sentence. Basis and window included — "recurring declared expenses per month, one-offs excluded" — because two numbers with the same name and different windows are two numbers. |
| **Fact or derived** | FACT (someone asserted it) or DERIVED (the app computed it). |
| **Producers** | How many places compute it. **1 is the target. Anything else is the violation.** |
| **Canonical home** | The one that should survive, or `NONE — needs a decision`. |
| **Screens** | How many surfaces render it. |
| **Verdict** | One of the five in §3. |
| **Wave** | MON-131 · MON-136 · precondition · out-of-programme (with a reason). |

Sort by severity of verdict, not alphabetically. Reza should read the worst thing first.

## §3 The five verdicts — use these words, no others

| Verdict | Meaning |
|---|---|
| **CLEAN** | One producer, semantic stated, independently checkable. Nothing to do. |
| **MULTIPLE** | More than one producer. They may agree today on this user's data and still be a violation — agreement is a coincidence of the data, not a property of the code. |
| **WRONG** | A producer is demonstrably incorrect against law, a canonical formula, or an arithmetic identity. **Cite the derivation.** An untraced difference between two screens is not WRONG — it is an observation, and belongs in §5. |
| **UNNAMED** | Two or more producers compute genuinely **different** numbers under one name. Not a duplicate — a naming failure. Each needs its own name, and deleting either would destroy a real figure. |
| **UNVERIFIABLE** | No independent check exists. Recorded honestly; **never upgraded to CLEAN because it looks fine.** |

A quantity can carry more than one verdict. Say so — MULTIPLE *and* WRONG is worse than either.

## §4 Part 2 — the violations, in detail

Only for quantities not CLEAN. Per violation:

- **Where** — `file:function:line` for every producer, each tagged **CANONICAL** (survives) ·
  **DUPLICATE** (deletable) · **DIFFERENT-QUANTITY** (survives under a new name).
- **What it computes instead** — for DUPLICATE and DIFFERENT-QUANTITY, the actual arithmetic, in
  words. `gross = net × 1.3`. `a converter with no ANNUAL case`. `skips any loan whose minimum
  repayment is zero`. This column is what makes the report persuasive rather than assertive.
- **What Reza sees today** — the rendered value on each screen, with the route. Where two screens
  disagree, **both figures**, side by side. This is the line he will recognise.
- **What it should be** — derived independently from law, a canonical formula, or an arithmetic
  identity, with the arithmetic shown. **Never "what the other screen says."** Where no independent
  derivation exists, write `UNVERIFIABLE` and stop — do not invent a target.
- **Blast radius** — which downstream numbers, scores and screens consume this one. A wrong income
  figure that feeds the savings rate, debt-to-income and the health score is one violation with four
  symptoms.
- **Fix route** — the tranche or wave that resolves it, and any precondition (see §5).

## §5 Part 3 — the three lists Reza reads first

**5.1 Decisions required.** One per line, plain English, with the consequence of each option. No
engineering vocabulary. Every genuine semantic fork — two producers both defensible under different
definitions — lands here rather than being resolved by the session.

**5.2 Preconditions — fixes that would cause harm if applied in the wrong order.** The MON-135
class: applying the one-off gate before the AI categoriser stops marking everything non-recurring
would zero every AI-categorised expense, and the golden baseline would absorb the loss as an
expected downward move. **Hunt for these deliberately.** One found here is worth more than the rest
of the document.

**5.3 Wrong inputs — where a correct formula sits over bad data.** MON-001 is the archetype:
fortnightly rent stored as monthly. No producer fix reaches it. Every FACT feeding a quantity gets a
trustworthy / not-established verdict, because a perfect engine over a wrong row is still wrong.

## §6 Part 4 — what this report does not cover

Per file and per quantity: what was read, what was not, and why. Include:

- Producers found but not attributable to any named quantity — **these become new quantities, not
  footnotes.**
- Registry line anchors that no longer resolve at HEAD (roughly a third have drifted).
- Any area where the reading was static-only and a behaviour could not be established without
  running it.

**Partial coverage presented as full coverage is the failure this whole programme exists to
prevent.** A short honest boundary is worth more than a long confident one.

## §7 What "done" means for this report

- Every number in the app appears once, with a verdict.
- Every non-CLEAN verdict carries a `file:line`, the arithmetic it actually performs, and either an
  independent expectation or an explicit `UNVERIFIABLE`.
- Every decision Reza must make is in §5.1, in language he can act on without a translator.
- Every precondition is in §5.2 **before** anything is migrated.
- The coverage boundary in §6 is specific enough to be checked.

Reza reads this, makes the calls in §5.1, and only then does Phase B write a single line.

---
*Specified by The Matrix, 2026-07-29. Sibling to
`docs/issues/handoffs/CODE_BRIEF_MON-131_PHASE_A_quantity-contracts.md`. Verdict vocabulary aligns
with `docs/verification/PROTOCOL_NUMBER_LEDGER.md` — the ledger's three axes (Singularity,
Consistency, Correctness) are what later prove each verdict was resolved.*
