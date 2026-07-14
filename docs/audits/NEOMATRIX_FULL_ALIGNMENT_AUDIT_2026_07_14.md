# Neomatrix ↔ Monitrax full-alignment audit — kickoff + machine-printed baseline (2026-07-14)

> **Reza directive (2026-07-14):** *"Perform a detailed and full audit on Monitrax code and documents, align that to graphify, and make sure Neomatrix covers all of Monitrax and is up to date — so you can always know what Monitrax is by reviewing Neomatrix."*
>
> **Framing (CLAUDE.md Part 22 — no parallel platforms):** this is NOT a new census system. It is the execution + widening of the EXISTING canonical plan — `docs/blueprint/NEO_INVENTORY.md` (NI-1→NI-4) + the §21.2.1 zero-drift rule — with one genuine scope extension (§4 below). Coverage below is quoted from the BUILD GATES verbatim (§22.2.4: coverage is a build output, never a claim).

## 1. The machine-printed state today (from `npm run neomatrix:check`, 2026-07-14)

```
Neomatrix: 262 nodes, 347 edges (verified 347).
Layer 0 coverage: 1101 .ts(x) on disk · 1092 in graph · 11 allowlisted · 0 uncovered
✓ Layer 0 complete — every source file under lib/+app/ is represented or allowlisted.
L0 structural (Graphify): 1092 files · 8736 nodes — whole codebase, gated
Proven (calc-audit registry): 83 engines
Modelled (semantic Neomatrix): 145 engines · 262 nodes
Semantic→L0 binding: 159/159 file anchors resolve
Neomatrix census gate: 193 proven · 215 modelled · 0 uncovered · 49 excluded (allowlist)
```

**What this honestly means:** the WHOLE codebase is structurally mapped (L0/Graphify, gated in CI); every financial calc is proven or modelled with resolving `file:line` anchors; **but** "Neomatrix covers all of Monitrax" is only true at the STRUCTURAL layer today — the SEMANTIC layer (formulas, lineage, authority) deliberately covers the financial domain only (CLAUDE.md §21.5 honest-scope rule).

## 2. The verified gap list (each from a gate warning or allowlist — nothing assumed)

| # | Gap | Evidence | Owning plan step |
|---|---|---|---|
| G1 | **11-file L0 allowlist** — files added while the graphify binary is offline in cloud sessions (each entry: a verified reason + "self-prunes on next graphify run") | `docs/financial-logic/graph/structural/coverage-allowlist.json` | **Graphify refresh session** (NI-1 mechanics): run `npm run neomatrix:graphify` where the binary is available → commit the refreshed structural graph → allowlist shrinks toward the 3 permanent tool-limitation entries |
| G2 | **155 semantic nodes not bound to an `astHash`** — the drift sentinel (body changes but node doesn't → build fails) is pending | gate warning A2 | NI-2/N3 binding pass |
| G3 | **10 unit-transition edges** without full conversion enforcement | gate warning A4 | N3 |
| G4 | **3 production-unwired tax engines** (`applyDiv152`, `classifyFteIeeDistributions`, `classifyPsi`) — real MISSes: designed as masterTaxPosition step-3 overlays, wiring never completed | gate warnings A6 (reviewed islands) | Each is its own wiring workstream (like MON-045's `applyNegativeGearing`); financial builds, full pipeline |
| G5 | **Proven↔modelled reconciliation** — 193 proven vs 215 modelled with a reviewed 49-entry exclusion list; exact 1:1 reconciliation + fixture re-homing pending | gate note "NI-3" | NI-3 (incl. closing the held #1250–#1257 per NEO_INVENTORY §7) |
| G6 | **Semantic scope = financial only.** Auth/CDR/infra/routes/pure-UI are L0-structural-only — you cannot yet "know what Monitrax IS" from the semantic graph alone | CLAUDE.md §21.5 (by design, until now) | **NEW — §4 below (the one genuine extension in this directive)** |
| G7 | **Docs alignment** — architecture/blueprint docs are not cross-checked against the graph (a doc can describe a flow the graph contradicts) | no gate exists today | §4 phase D (doc-alignment pass + a freshness check) |

## 3. Execution plan (each phase = its own PR/session, machine-gated; no phase claims completion — the gate printout does)

- **A. Graphify refresh (G1)** — run the offline graphify binary against current `main`, commit the structural graph, prune the allowlist. *Requires an environment with the binary; first candidate for a local/desktop session.*
- **B. astHash binding (G2) + unit enforcement (G3)** — extend `neomatrix:generate` to compute `astHash` from each bound symbol's source range; flip A2/A4 from warning to failure once bound. This turns "is the map current?" from discipline into a red build.
- **C. NI-3 reconciliation (G5)** — the printed `proven vs modelled` deltas become a worklist (`docs/audits/NEO_INVENTORY_BACKFILL_WORKLIST.md` already tracks the earlier pass); re-home held Trust-Engine properties as calc-audit fixtures; close #1250–#1257.
- **D. Semantic widening (G6) + doc alignment (G7)** — see §4. Gated by Reza's scope sign-off.
- **E. Wire the three tax islands (G4)** — separate financial workstreams, MON-045-class rigor each (queued behind MON-045 stage 2).

## 4. The scope decision Reza's directive implies (surfaced, not guessed — §20.5)

*"Always know what Monitrax is by reviewing Neomatrix"* requires widening the SEMANTIC layer beyond financial logic — new node domains for: **routes/pages** (what surfaces exist and what each renders), **auth/CDR boundaries** (guards, consent gates), **services/infra** (jobs, integrations), and **doc-links** (each architecture doc section bound to the nodes it describes, so doc-drift becomes checkable). This amends the CLAUDE.md §21.5 honest-scope rule (from "financial only, Part 10 governs the rest" toward "whole-product map") — a CLAUDE.md change requiring Reza's explicit sign-off, plus a size/maintenance trade-off: every widened domain inherits the zero-drift obligation (§21.2.1) on every future PR.

**Recommendation (3× reviewed):** widen incrementally by consumption value — (1) routes+surfaces first (immediately useful to every session and to NeoAudit parity), (2) auth/CDR boundaries second (compliance value), (3) doc-link bindings third (kills doc-drift), infra last. Each increment lands with its own generator support + gate, so coverage remains a build output.

## 5. Status ledger

| Phase | Status |
|---|---|
| Baseline snapshot (this doc) | ✅ 2026-07-14 |
| A — graphify refresh | ⬜ queued (needs binary-capable environment) |
| B — astHash + unit enforcement | ⬜ queued |
| C — NI-3 reconciliation | ⬜ queued |
| D — semantic widening + doc alignment | 🚧 **awaiting Reza's §4 scope sign-off** |
| E — wire div152 / fteIee / psi | ⬜ queued (after MON-045 stage 2) |

*Update this ledger in the same PR as each phase; quote the new gate printout as the evidence of progress.*
