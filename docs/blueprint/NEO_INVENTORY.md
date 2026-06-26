# Neo Inventory — the single inventory of every Monitrax calculation & surface

> **Status:** Design / plan (awaiting Reza sign-off). No code yet.
> **Owner:** Reza + Claude. **Created:** 2026-06-26.
> **Supersedes the framing of:** the "Neomatrix coverage %" as a standalone measure.
> **Relates to:** Phase 41i (Calculation Audit System), Phase 53 (Neomatrix), CLAUDE.md §12.2.1 / §12.3 / §19 / §21.

---

## 0. Why this document exists (the problem it solves)

Reza, 2026-06-26: *"I have done similar audits and you came back saying you covered everything, then the next audit finds many missed ones. Why does this happen and how do I make sure (1) 100% of Monitrax is in the Neomatrix and (2) the Trust Engine covers all calculations including complex ones? I don't want another guesswork with multiple PRs."*

**Root cause (verified by code inspection, not assumed):** Monitrax accumulated **four** overlapping systems that each hold a *partial, hand-maintained* list of "what calculations exist," and **none was ever reconciled against the others.** Measuring "coverage" against any one of them gives a number that the next audit contradicts — because the denominator itself was incomplete.

| System | What it holds | Phase | CI-enforced? |
|---|---|---|---|
| **calc-audit** | `calcEngineRegistry` (~90 engines) + `surfaces/registry` (surface descriptors) + **92 fixtures** + differential runner + runtime surface audit + Float⇄Decimal shadow + anomaly/alerting | 41i | ✅ yes (`tests/calc-audit/calcAudit.test.ts` runs `runDifferential`, asserts 0 failures + "no engine without a fixture") |
| **Neomatrix** | the graph map (103 nodes — lineage, authority, `file:line`) | 53 | ✅ `neomatrix:check` |
| **Trust Engine** | verification nodes + `verified-by` edges in the Neomatrix | new (2026-06-25) | ✅ via graph tests |
| **Phase 4 rail + A1 audit + surface linter** | golden-master, invariants, law-referenced golden, `lint-financial-surfaces` | various | ✅ |

The key discovery: **`calc-audit` is already the most complete inventory in the app — and it is already CI-gated by the rule "no engine without a fixture."** The Neomatrix (103 hand-built nodes) is a *subset* of it. The recurring "gaps" were the artefact of comparing against the smaller, hand-built list instead of the larger, enforced one.

> **This is itself a CLAUDE.md §12.2.1 violation at the system level:** multiple sources of truth for "what needs verifying" guarantees drift. The fix is the same as for any duplicate source — **collapse to one.**

---

## 1. What Neo Inventory IS (and is NOT)

**Neo Inventory is the recognition that `calc-audit`'s registry is the ONE canonical inventory of every calculation and surface in Monitrax**, with the Neomatrix as a **generated view** over it and the fixtures as the **verification spine**. It is an *organising principle + a reconciliation gate*, **not a new platform.**

### It is NOT
- ❌ A fifth verification system. (That would be the exact mistake this doc prevents.)
- ❌ A new "census" script that re-enumerates engines. (`calcEngineRegistry` already enumerates them, gate-enforced.)
- ❌ A reason to delete calc-audit, the Neomatrix, the Phase 4 rail, or the surface linter. Each has a distinct, non-overlapping JOB (below). The duplication is only in *the inventory list*, not the jobs.

### It IS
- ✅ **One inventory** (`calcEngineRegistry` + `surfaces/registry`) — the WHAT.
- ✅ **One generated map** (Neomatrix, generated/reconciled from the registry) — the HOW (lineage, law, `file:line`).
- ✅ **One verification spine** (calc-audit fixtures) — the PROOF.
- ✅ **One gate** that reconciles the three and **prints the gap** every build, so "is it complete?" is a build output, never a human claim.

### The three layers — one source each (the SSOT contract)

| Layer | Question it answers | Single source | Exists today? |
|---|---|---|---|
| **Inventory** | *What calculations & surfaces exist?* | `calcEngineRegistry` + `surfaces/registry` | ✅ (CI-gated: no engine without a fixture) |
| **Map** | *How do they connect? What law? Where (`file:line`)?* | Neomatrix — **generated from the inventory** | ⚠️ partial (hand-built today; to be generated) |
| **Proof** | *Is each one correct?* | calc-audit fixtures (+ Trust Engine properties folded in) | ✅ (92 fixtures in CI) |

---

## 2. The distinct job of each existing system (why none is deleted)

This matters because §12.3 forbids competing engines — but these are **not** competing; they do different jobs over a *shared* inventory:

- **calc-audit fixtures** = *"does engine X output the right number for input Y?"* (golden + Float/Decimal shadow + runtime per-user surface audit). The **proof** layer.
- **Neomatrix** = *"how does X's number flow into Y, what law governs it, where does it live?"* (the **map** — lineage, authority, anchors). calc-audit has **no** lineage graph.
- **Phase 4 rail** = broad golden-master + invariants over archetypes (regression safety net).
- **surface linter** = *"is a surface re-deriving a number instead of reading the canonical source?"* (drift prevention at the render layer).

Neo Inventory makes them all read from **one inventory** so they can never disagree about *what the set of calculations is*.

---

## 3. The completeness guarantee (how "100%" becomes provable)

Coverage stops being a claim and becomes three machine-computed, gate-enforced numbers:

1. **Inventory completeness** — *every money-producer in code is registered.* Largely already enforced (41i reviewer rule + the surface linter finds un-canonical render sites). Hardening: a check that flags any `lib/{calculations,tax-engine,health,cfo,services}` exported function returning a number/`Decimal` that is **not** registered, unless on an explicit, reviewed `known-unmodelled` allowlist.
2. **Map reconciliation** — *every registered engine has a Neomatrix node, and vice-versa.* New gate in `neomatrix:check`: `gap = registry − graph`, **printed every build**, fails on an un-allowlisted gap. This is the number that was always missing.
3. **Verification** — *every registered engine has ≥1 fixture* (already enforced) **+** the Neomatrix `verified-by` edge points at that fixture. Assurance % = proven ÷ inventory.

**Honest definition of "100%":** 100% of the *statically-detectable* inventory, plus a **shrinking, reviewed allowlist** of the few that resist static detection (numbers computed inline in a component, dynamic dispatch). The allowlist is visible and challengeable — never a silent drop. *We never again say "100%, trust me"; the build prints `inventory N · mapped M · proven P · gap [list]`.*

---

## 4. Comparison of PRs #1250–#1257 against Neo Inventory

Done by inspecting `lib/calc-audit/engines/*` for each target (not assumed). **The 8 PRs are internally consistent with each other** (one pattern: model-in-graph + verify). The divergence is between their *verification half* and the *existing calc-audit fixtures*.

| PR | Target | calc-audit already fixtures it? | Net-new property (keep) | Verdict |
|---|---|---|---|---|
| #1250 A.1 | model 9 what-ifs + verify sellProperty | `cfo.scenarios.sellProperty.shadow` ✅ | **graph nodes** (map — additive) | HOLD → keep map, re-home verify |
| #1251 A.2 | tenYearProjection + CGT core | tenYearProjection ❌ / CGT `cgtDiscount.shadow` ✅ | tenYearProjection ✅ | PARTIAL |
| #1252 A.3 | addInvestment + redirectToOffset | both ✅ | accounting identities | HOLD → re-home |
| #1253 A.4 | refinanceLoan + payDownLoan | both ✅ | conservation identity | HOLD → re-home |
| #1254 A.5 | cutSpendCategory + salarySacrifice | both ✅ | **refuse-to-compute guards** ✅ (high value) | HOLD → re-home guards |
| #1255 D.1 | LVR/equity/yield + interest/PI | LVR/equity/yield ✅ / interest+PI ❌ | interest+PI ✅, Float⇄Decimal parity ✅ | PARTIAL |
| #1256 D.2 | frequency converters | toAnnual/toMonthly via shadow ✅ | parity ✅ | PARTIAL |
| #1257 D.3 | aggregator additivity | engines ✅ / **additivity ❌** | breakdown additivity ✅ | MOSTLY ADDITIVE |

**Recommendation: do NOT merge #1250–#1257 as-is.** Merging them bakes in the duplication §12.2.1 forbids. Instead, **reconcile** (§5): keep the genuinely-additive **graph modelling** (the map — calc-audit has none), fold the genuinely-new **properties** (identities, refuse-to-compute guards, additivity, parity, interest/PI) into calc-audit as fixtures, and point the Neomatrix `verified-by` edges at the existing fixtures rather than the parallel Trust Engine test files.

---

## 5. The plan — ONE sequenced workstream, no guesswork, no PR sprawl

Each step is a single PR, gated on the previous, **no parallel speculative PRs**:

- **NI-0 (this PR):** this design doc + the CLAUDE.md instruction (§6) + the IMPLEMENTATION_PLAN workstream + this PR comparison. **Docs only.** ← *you are here*
- **NI-1 — Measure the real deltas.** One read-only script that prints `registry vs graph vs fixtures`: every registered engine, whether it has a Neomatrix node, whether it has a fixture. **This is the first time the true denominator is on screen.** Output committed as `docs/audits/NEO_INVENTORY_BASELINE.md`. No production change.
- **NI-2 — Reconcile the map to the inventory.** Generate/add the missing Neomatrix nodes so every registered engine is mapped; wire `verified-by` edges to the **existing** fixtures. Add the `neomatrix:check` reconciliation gate (registry − graph, allowlist for the few exceptions).
- **NI-3 — Re-home tonight's net-new properties.** Fold the identities / refuse-to-compute guards / additivity / parity / interest+PI into calc-audit fixtures; retire the parallel Trust Engine test files that only re-prove existing fixtures. Close #1250–#1257 in favour of this.
- **NI-4 — Harden inventory completeness.** The static check that flags an unregistered money-producer (with the reviewed allowlist).

After NI-2, every future session reads the gap from the build, not from an audit. After NI-4, a new un-inventoried calc cannot merge.

---

## 6. Standing rules (mirrored into CLAUDE.md — the instruction lock)

So no future session repeats the 2026-06-25 mistake of building verification in a parallel silo:

1. **The calc-audit registry is the single inventory.** Before verifying, modelling, or "covering" ANY calculation, **check `calcEngineRegistry` + `lib/calc-audit/engines/*` FIRST** — it is the most complete denominator. (Extends §12.2.1 SEARCH-FIRST to the verification layer.)
2. **Never build a parallel verification platform or test silo.** If a calc needs a new correctness check, **add a fixture to its calc-audit engine** — do not create a separate test file that re-proves it. New *properties* (identities, guards, additivity) are new *fixtures/assertions on the same engine*, not a new system.
3. **The Neomatrix is a generated view over the inventory.** A Neomatrix node without a corresponding registry engine (or vice-versa) is a reconciliation failure, not "more coverage." Model = generate from the inventory.
4. **Coverage is a build output, never a human claim.** Never state "X% covered" or "everything is covered" from memory or a manual audit — cite the gate's printed `inventory N · mapped M · proven P · gap`.
5. **A gap is modelled/registered, never guessed** (unchanged from §19/§21.5).

---

## 7. What this does NOT change

- No financial logic changes (this is inventory/reconciliation only — §19 still governs correctness).
- calc-audit, Neomatrix, Phase 4 rail, surface linter all remain — with their distinct jobs (§2), now reading one inventory.
- The Neomatrix's value (lineage, authority, `file:line`, the 3D explorer) is preserved and *grows* — it just stops being hand-maintained.

---

*Sign-off block (to be completed by Reza):*
- [ ] Neo Inventory model approved (calc-audit registry = single inventory; Neomatrix = generated view).
- [ ] Approve **holding** #1250–#1257 (reconcile via NI-3 rather than merge as-is).
- [ ] Approve the NI-0 → NI-4 sequence (one PR each, gated).
