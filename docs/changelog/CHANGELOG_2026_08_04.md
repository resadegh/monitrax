# Changelog — 2026-08-04

## Session: `sbpfhc` — D50 answered, and the G7 handout that could not be written

### Changes Made

- **Type**: Registry (scope decision) + a verification handout + a process finding
- **Scope**: `docs/issues/` · `docs/verification/briefs/` · the MON-131 ledger / brief / hub
- **Description**: Reza answered **D50 with option A** — narrow MON-130 to the surface its evidence
  covers, carry the residue as a new issue. Implemented. He then asked for the complete G7 handout;
  writing it exposed that **G7 cannot be run for T2 at all**, for a reason that is a defect in our
  process rather than a task still queued.

### D50 — option A, implemented

**MON-130 narrowed and moved to `VERIFIED`.** Its title and `rootCause` now name the one producer
`#1575` actually migrated: `masterFinancialService`, the service behind Home and the property pages.
Verified on **VR-047** (rendered half — Home's budget tile $12,779 matching `/dashboard/expenses`,
regression cluster byte-identical including `healthScore` 53) plus **VR-047B** (producer half — the
four-expression identity, three leaves byte-equal at `12,779.292814353912` and the fourth that value
rounded at the producer). Neither run was sufficient alone: a correct tile cannot establish that four
expressions agree, and a producer identity cannot establish that a user sees it.

**MON-156 opened, carrying the residue.** Eleven producers across roughly thirty raw `minRepayment`
reads — the CFO score, the risk radar, the debt planner, reports, the CFE input and the money-flow
chart. The producer list is copied verbatim from MON-130's original, with a caveat on the entry that
the line numbers are **provenance, not a current anchor** and must be re-verified against source before
any fix code (§19.2 / FIX_PROTOCOL Stage 1).

The reasoning is recorded on **both** entries so it cannot be re-litigated later: Lever 2 hides the
surfaces those eleven feed, and hiding a surface is an **exposure** control, not a **defect** control.
The numbers are still wrong; they are merely off-screen, and they return the moment a surface is
un-hidden. Folding them into a `VERIFIED` issue would have been exactly the §22.2.4 over-claim.

**T2 reaches G11 ✅** — MON-143 and a narrowed MON-130, each verified on its own numbers.

### MON-157 — the finding that outlives T2

The handout Reza asked for is the `POST /golden-baseline/diff` call that returns
`CLEAN` / `EXPECTED_ONLY` / `STOP`. **It cannot be run.** Three facts, each read in source rather than
inferred:

1. `diffBaselines(oldTree, newTree, expectedMoves)` (`lib/matrix/goldenBaseline.ts:244`) flattens **both
   sides** to numeric leaves. It requires a **tree** on the old side; a hash cannot be diffed.
2. The relay's committable artefact is `?format=hash` (`route.ts:84`), whose own comment states the
   tradeoff exactly: *"a matching treeHash proves nothing moved anywhere. Localising a mismatch still
   needs the full tree."* A tranche that moves declared numbers **necessarily** mismatches, so
   localisation is always required and the tree is always needed.
3. The CLI (`golden-baseline.mjs:97`) **does** write the full tree and prints **"COMMIT IT"** — but
   `git log --all` over `.audit/golden-baseline*` returns **nothing**. No such file has ever been
   committed, on any branch, in this repository's history. The reference for T1's end state exists only
   as the string `347006b9…` in the prose of `VR-045.md`.

The pre-T2 tree cannot be re-captured — the code has changed and the live data has moved on — so
**T2's G7 stands at HALF permanently**: fifteen declared paths verified live (VR-047B A2), whole-tree
question unanswered. This is a §21.2.2 rule-4 failure; the instrument's reference lived in a session
instead of in the repo, and it survived four tranches because a hash is sufficient for the CLEAN case
and nobody hit the localisation case until a tranche moved numbers on purpose.

### The handout that shipped instead

`docs/verification/briefs/MATRIX_G7_REFERENCE_CAPTURE.md` — three calls in one admin session:

1. **`?format=hash`** (~400 bytes) — committed as the reference summary. `captureErrors` must be `[]`;
   a failed capture serialises as a zero-leaf stub, so a tree can be missing an entire producer's
   numeric content while still looking valid (drift-log D8). A reference committed with that tripwire
   lit is worse than none — every future diff would read the absence as "nothing moved there".
2. **The full tree** (~282 KB) returned verbatim, committed as `.audit/golden-baseline-<sha>.json`, and
   split across messages at the eight top-level `file:function` keys if it does not fit one.
   **Reassembly is verified, not assumed**: the reassembled tree is re-hashed and compared to Call 1's
   `treeHash`.
3. **A self-diff** — POST the tree back with `expectedMoves: []`, expecting `verdict: "CLEAN"`. This
   exercises the whole chain (capture → serialise → POST → flatten → verdict) before T3 depends on it.
   Calendar leaves are already filtered, so a leaf that moves between two captures on identical code is
   **non-determinism in a producer** — the MON-134 class — and is a real finding, not noise.

**T3's G7 becomes runnable as designed.** This closes the hole forward; it cannot reopen T2's.

The handout also records, as a pre-declared non-finding, that the `moneyFlowService` capture runs on the
**DECLARED** loan basis and therefore understates by **$3,792.92/month** exactly as MON-156 says. That
is deliberate: a reference must record today's behaviour. One that quietly captured the better number
would make the next tranche's diff report a move that never happened.

### MON-155 — flag corrected

`changesNumbers` true → **false**. It was the auto-raise default. Neither resolution of a dead
`admin_session` branch — deleting it or implementing it — moves any user-facing number. Left true, the
gate would have demanded a cross-surface propagation test and a resolving Neomatrix `semanticKey` before
it could ever reach `VERIFIED`, for an auth branch that produces no number. A gate firing on the wrong
issue teaches sessions to work around gates.

### Files Modified

- `docs/verification/briefs/MATRIX_G7_REFERENCE_CAPTURE.md` — **new**
- `docs/issues/ISSUES.json` + `.md` — MON-130 narrowed + VERIFIED; MON-156, MON-157 opened; MON-155 flag
- `docs/implementation/MON-131_TRANCHE_LEDGER.md` — G7, G11, T2 heading, §6 row, `#1580`/`e3a3715` backfill
- `docs/implementation/MON-131_COMPLETION_BRIEF.md` — §2, §5 (D50 decided), §6 status log
- `docs/IMPLEMENTATION_PLAN.md` — hub

### Testing

- [x] `npm run issues:check` — 144 issues valid
- [x] `npm run issues:generate`
- [x] `npm run neomatrix:check`
- [x] `npm run lint:source-lock` · `npm run lint:financial-surfaces` · producer census (`loanCost` 30)
- [x] `npx tsc --noEmit`
- [x] `npx vitest run`

**Coverage boundary.** This session changes **no code** — no producer, no engine, no rendered number. It
records a scope decision, opens two issues, and ships one handout. It verifies **nothing** on its own;
the handout it produces is what will be verified, by the Matrix, in a later run.
