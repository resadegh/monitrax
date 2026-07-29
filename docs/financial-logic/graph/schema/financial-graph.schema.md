# Neomatrix — `financial-graph.json` schema (Layer 1)

> The canonical contract for the semantic graph (Phase 53 §5 + §14). Enforced by
> `scripts/neomatrix/graphlib.mjs` `validateGraph()` and the vitest suite
> (`tests/neomatrix/financialGraph.test.ts`). **The JSON is the SSOT; the
> markdown views render FROM it.** Documentation/model only — no financial logic.

## Top level

```jsonc
{
  "version": "0.1.0",
  "name": "…",
  "generatedNote": "…",
  "builtAtCommit": null,   // set by the drift sentinel (A2) once AST-hash binding lands (N3)
  "lastReviewed": "YYYY-MM-DD",
  "nodes": [ Node, … ],
  "edges": [ Edge, … ]
}
```

## Node

| Field | Type | Required | Notes |
|---|---|---|---|
| `id` | string | ✅ | Stable unique id. Convention: `{kind-prefix}.{file-or-module}.{symbol}` (e.g. `engine.netWorthCalculator.calculateNetWorth`). The last dot-segment of an engine/orchestrator id is the source symbol **by default**, and the anchor gate resolves it against the Layer-0 symbol table at `file:line`. Where the code symbol legitimately differs from the semantic identity, say so in `symbol` — never rename the code to match the map. |
| `kind` | enum | ✅ | `engine` · `number` · `input-field` · `law` · `route` · `ui-surface` · `orchestrator` · `verification` |
| `label` | string | ✅ | Human label (used in rendered views). |
| `file` | string\|null | ✅* | Source path. Required+non-null `line` for a `documented` engine/orchestrator (§19.2 file:line). |
| `line` | number\|null | — | Anchor line of the symbol. Checked against Layer 0 — see `symbol`. |
| `symbol` | string\|null | — | **Optional anchor override.** The exact extracted symbol at `file:line` when it is not the id's last dot-segment. Added 2026-07-29: the Decimal migration renamed four engines (`calculateMaxConcentration` → `calculateMaxConcentrationDecimal`) while the calc-audit registry keeps the Decimal-stripped name as the engine's semantic identity, so the id and the code honestly differ. Setting `symbol` makes the anchor a **stated fact** rather than a naming coincidence. It is never a way to silence the gate: if the named symbol is absent from the file, or present at a different line, the gate still fails. |
| `layer` | enum | ✅ | `db` · `engine` · `service` · `route` · `ui` · `null` (axis: DB→engine→service→route→ui). |
| `domain` | enum | ✅ | `core` · `tax` · `health` · `cfo` · `intelligence` · `reports` · `neobrain`. |
| `trailStage` | enum | — | `T` · `R` · `A` · `I` · `L` · `null` (never guessed — `null` until verified). |
| `regime` | enum | — | `pre-reform` · `post-reform` · `null` (Phase 41E / B8). |
| `semanticKey` | string\|null | — | For `number`/`ui-surface`: the logical concept (e.g. `monthlyCashflow`). Drives the A3 convergence audit — two tiles of the same key MUST trace to the same engine. |
| `produces` | string | — | What it outputs. |
| `formula` | string\|null | — | The calculation in plain terms. |
| `authority` | string | — | ATO section / standard formula / CLAUDE.md ref. |
| `inputs` | `{name,unit,type,note}[]` | — | Per-param unit + type + convention (§19.2 input contract). |
| `astHash` | string\|null | — | A2 drift sentinel — Graphify's per-symbol `ast_hash`; `null` until bound (N3). |
| `verifiedBy` | string | — | Test/doc evidence. |
| `workedExample` | string\|null | — | A1 fixture: input → expected output (becomes an executable assertion in N3). |
| `verifiedDate` | YYYY-MM-DD | ✅ for `documented` | Freshness contract. |
| `status` | enum | ✅ | `documented` · `pending` · `suspected-issue` · `unverified`. |

## Edge

| Field | Type | Required | Notes |
|---|---|---|---|
| `from` | node id | ✅ | Must exist in `nodes`. |
| `to` | node id | ✅ | Must exist in `nodes`. |
| `type` | enum | ✅ | `feeds` · `depends-on` · `governed-by` · `rendered-at` · `falls-back-to` · `verified-by` (a `verification` node PROVES the engine/number/orchestrator it points from — §21.2.1; the suite rejects an unwired `verification` node and a `verified-by` edge whose target is not one). |
| `source` | enum | ✅ | `verified` (read in source — must cite `evidence`) · `graphify` (auto AST, Layer 0) · `inferred` (**rejected** from the audited graph). |
| `fromUnit` / `toUnit` | string\|null | — | A4 unit typing (e.g. `AUD`, `AUD/month`, `%`). A transition implies a conversion must happen in the target (full enforcement N3). |
| `evidence` | string | ✅ for `verified` | `file:line` or doc ref read in source (§19.2). |
| `verifiedDate` | YYYY-MM-DD | — | |

## Invariants enforced (the Layer-3 seed — §14)

- **Schema** — required fields, enum membership, unique ids, edge referential integrity, `verified` edges cite evidence, `inferred` edges rejected, documented engines cite file:line.
- **A3a (orphan number)** — every `number` node must be reverse-reachable to an `engine` node.
- **A3b (convergence / contradiction — the #1201 class)** — `number` nodes sharing a `semanticKey` must reduce to the same engine-ancestor set.
- **A3c** — a `ui-surface` with a `semanticKey` should render a `number` of that key (warning).
- **A5 (orphan calc)** — a `number`, `engine` or `orchestrator` with ZERO edges is an ERROR. An unwired calc node is a claim without a lineage; model the inputs that `feeds` it and what it `feeds` next.
- **A6 (island)** — A5 only catches zero-edge nodes; an engine wired ONLY to its own law node passes A5 while sitting in a two-node cluster nobody reaches. So every calc node must live in the MAIN connected component. A flagged island is fixed by wiring its REAL lineage, never a faked edge. `A6_ISLAND_ALLOWLIST` (currently empty) is the only escape and takes a verified reason per node — for genuinely production-unwired code, which the graph should then SHOW as an island rather than pretend is connected.
- **verification wiring (§21.2.1)** — a `verification` node with no inbound `verified-by` edge is orphan assurance and fails; a `verified-by` edge must target a `verification` node and originate at an `engine`, `number` or `orchestrator`.
- **file binding** — a node whose `file` is inside the Layer-0 scan scope (the 9 roots in `scripts/neomatrix/roots.mjs`, plus `prisma/schema.prisma`) must appear in the committed Layer-0 map. A node pointing at a file Layer 0 does not have is UNRESOLVED — hard fail.
- **symbol anchor (file:line resolution)** — rewritten 2026-07-29. It used to read "the line in source must contain its symbol", and that is exactly what the old test did: `line.includes(symbol)`, a substring match, over `documented` nodes only. It passed while four engines had been renamed by the Decimal migration and while three anchors sat ~90 lines off the model they describe (MON-116). `check-binding-coverage.mjs` now resolves `engine`, `orchestrator` and `input-field` nodes (and any node carrying an explicit `symbol`) that claim a `line`, in three tiers: **(1)** the Layer-0 symbol table for that file — the symbol graphify actually extracted, matched on label, id, or `…::symbol`; **(2)** an explicit `symbol` field, which overrides the id tail and is checked the same way, never waived; **(3)** for object-literal properties graphify does not emit as symbols (a `taxYearConfig` key, say), the source line text itself, which must carry the name within ±3 lines to allow a multi-line declaration. Two hard fails: **DRIFT** — the symbol is in the file but at a different line, so the code moved and the anchor did not follow; **MISSING** — the symbol is not in the file at all, so the map names code that no longer exists. Both are fixed in the MAP; never rename code to match the map (§21.5 clause 5 — a real disagreement is a `suspected-issue` raised with Reza). `tests/neomatrix/financialGraph.test.ts` asserts this same resolver rather than re-implementing it, so there is ONE definition of anchor truth.
- **coverage + currency** — `check-layer0-coverage.mjs` requires every `.ts(x)` under the roots to be extracted or explicitly allowlisted with a real, stated graphify limitation, and `content-manifest.json` (sha256:16 per file) fails the build when a file's BODY changed since Layer 0 was built, not merely when the set of paths changed.
- **census** — `check-census.mjs` reports every calc-named symbol in the financial directories as PROVEN (calc-audit fixture), MODELLED (semantic node), or UNCOVERED. UNCOVERED is a review queue, and a file with no Layer-0 nodes cannot be counted — which is why an over-broad allowlist entry reads as coverage.
- **Freshness** — `GENERATED_CORE.md` must equal `renderMarkdown(graph)` (derive-don't-hand-maintain).
- **A2 / A4** — informational warnings until N3 (AST-hash binding · conversion-node enforcement).

*Schema v0.1.0 — Phase 53 N1. Extend (do not rewrite) as domains backfill.*
*Last extended 2026-07-29 (`symbol` field · `verified-by` edge type · A5/A6 · the three-tier anchor resolver · coverage/currency/census gates) — this page describes what the gates ACTUALLY enforce today. If it ever describes more than they enforce, the page is the bug.*
