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
