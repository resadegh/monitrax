# CODE BRIEF — MON-135: the AI categoriser marks everything non-recurring

## ⛔ HARD PRECONDITION FOR TRANCHE 3. T3 MUST NOT MERGE BEFORE THIS LANDS.

**changesNumbers: YES** — expenses currently contributing to run-rates would otherwise stop
contributing.
**Severity: critical.** Not because of what it does today, but because of what Tranche 3 turns it
into.

---

## §1 The trap

Tranche 3 (MON-129) routes every Income/Expense run-rate through the canonical gate:

```ts
// lib/utils/frequencies.ts:45
export function monthlyRunRate(row) {
  if (row.isRecurring === false) return 0;   // the one-off gate
  ...
}
```

That gate is correct and is the whole point of MON-125/126/129 — a one-off purchase must not be
counted every month.

But `lib/ai/aiCategorisation.ts:248-250` stamps every prediction it produces with:

```ts
isRecurring: false,
suggestedFrequency: null,
```

**unconditionally** — the categoriser never attempts a recurrence judgement, so `false` is a
default, not a finding.

Today those two facts are independent and nothing breaks: the ungated producers convert
`amount × frequency` regardless of `isRecurring`, so an AI-categorised recurring cost still counts.
**The moment T3 lands, they compose:** every expense the AI has categorised evaluates
`isRecurring === false` → contributes **$0** to every monthly and annual run-rate, on every
migrated producer at once.

The fix intended to make expenses correct would silently remove a portion of them, across the
whole app, in one merge. And because T3's headline effect *is* "spending goes down when one-offs
stop being counted monthly", the loss would look like the fix working.

## §2 Why the golden baseline would not save us

The baseline diff would flag the movement — but every T3 tranche legitimately moves expense
figures downward, and those movements are pre-declared in `expectedMoves`. A prefix-matched
`expectedMoves` entry covering "expense run-rate falls" would absorb this defect as expected
behaviour. **The instrument does not distinguish "one-offs correctly excluded" from "recurring
costs wrongly excluded" — only the semantic does.** That is precisely why this is a precondition
rather than something to catch afterwards.

## §3 What to build

### 3.1 Stop defaulting the answer

`isRecurring` must be **`null` / absent** when the categoriser has not made a recurrence
determination — never `false`. `false` is an assertion that the row is a one-off; the categoriser
is not entitled to make it.

Confirm the gate's null-handling matches: `frequencies.ts:45` returns 0 only on
`isRecurring === false`, so `null`/`undefined` already flows through as recurring. **Verify this at
source before relying on it** — if any migrated producer treats falsy rather than strictly `false`,
that producer is a second defect of the same class and must be fixed in the same PR.

### 3.2 Determine recurrence where the evidence exists

Where a row has linked transactions, recurrence is an observable fact, not a guess: repeated
similar amounts at a regular cadence. The existing intake matcher already reasons about cadence —
reuse it rather than writing a second recurrence heuristic. **Do not add a producer.**

Where evidence is insufficient, leave it undetermined and surface it for the user to confirm.
An undetermined row must be visibly undetermined, never silently defaulted in either direction.

### 3.3 Remediate the rows already written

Existing `Expense` rows carrying an AI-set `isRecurring: false` are the live exposure. Establish
how many there are and how they were set before deciding the remediation — **and do not overwrite a
value the user set themselves.** A user's explicit one-off marking is a FACT; the categoriser's
default is not. If the two cannot be told apart in the current schema, say so in the PR: that is a
provenance gap, and it is Reza's decision how to resolve it, not a call to make silently.

## §4 Verification

- A fixture: an expense with `isRecurring` unset contributes its full run-rate through
  `monthlyRunRate`; one explicitly marked `false` contributes 0. Both Float and Decimal.
- The categoriser never emits `isRecurring: false` — assert on the output of the prediction path,
  not on a mock.
- **Ring-3 on real data before T3 merges:** recurring expenses on `/dashboard/expenses` must be
  unchanged by this PR. This PR alone should move **nothing** on screen — it changes what a default
  means, not what a number is. If a figure moves, that movement is itself the finding.

## §5 Provenance

Found by the MON-131 subsumption sweep, 2026-07-29, tracing all 58 live issues against the
producer catalogue. Recorded there as *"WORSE — MON-025 × T3"*. MON-025 (expense frequency defaults,
AI sets no recurrence) is the sibling issue and is **upstream of every producer** — it is one of the
three issues the sweep classified as unfixable by producer collapse, because a canonical producer
faithfully computes on wrong inputs.

Register as **MON-135**, severity critical, area `expenses`, and record in
`docs/architecture/REFERENCE_NUMBERS_DESIGN.md` §4 as a stated precondition on the Tranche 3 row.

---
*Prepared by The Matrix, 2026-07-29. The sweep's coverage boundary applies: verdicts are a static
reading of `origin/main`; no tests were run and no database was reachable. Re-verify
`aiCategorisation.ts:248-250` and `frequencies.ts:45` at HEAD before building — roughly a third of
the registry's line anchors have drifted.*
