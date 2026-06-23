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
| `id` | string | ✅ | Stable unique id. Convention: `{kind-prefix}.{file-or-module}.{symbol}` (e.g. `engine.netWorthCalculator.calculateNetWorth`). The last dot-segment of an engine/orchestrator id MUST be the source symbol (the file:line audit checks the line contains it). |
| `kind` | enum | ✅ | `engine` · `number` · `input-field` · `law` · `route` · `ui-surface` · `orchestrator` |
| `label` | string | ✅ | Human label (used in rendered views). |
| `file` | string\|null | ✅* | Source path. Required+non-null `line` for a `documented` engine/orchestrator (§19.2 file:line). |
| `line` | number\|null | — | Anchor line of the symbol. |
| `layer` | enum | ✅ | `db` · `engine` · `service` · `route` · `ui` · `null` (axis: DB→engine→service→route→ui). |
| `domain` | enum | ✅ | `core` · `tax` · `health` · `cfo` · `intelligence` · `reports`. |
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
| `type` | enum | ✅ | `feeds` · `depends-on` · `governed-by` · `rendered-at` · `falls-back-to`. |
| `source` | enum | ✅ | `verified` (read in source — must cite `evidence`) · `graphify` (auto AST, Layer 0) · `inferred` (**rejected** from the audited graph). |
| `fromUnit` / `toUnit` | string\|null | — | A4 unit typing (e.g. `AUD`, `AUD/month`, `%`). A transition implies a conversion must happen in the target (full enforcement N3). |
| `evidence` | string | ✅ for `verified` | `file:line` or doc ref read in source (§19.2). |
| `verifiedDate` | YYYY-MM-DD | — | |

## Invariants enforced (the Layer-3 seed — §14)

- **Schema** — required fields, enum membership, unique ids, edge referential integrity, `verified` edges cite evidence, `inferred` edges rejected, documented engines cite file:line.
- **A3a (orphan number)** — every `number` node must be reverse-reachable to an `engine` node.
- **A3b (convergence / contradiction — the #1201 class)** — `number` nodes sharing a `semanticKey` must reduce to the same engine-ancestor set.
- **A3c** — a `ui-surface` with a `semanticKey` should render a `number` of that key (warning).
- **file:line resolution** — each documented engine/orchestrator line in source must contain its symbol.
- **Freshness** — `GENERATED_CORE.md` must equal `renderMarkdown(graph)` (derive-don't-hand-maintain).
- **A2 / A4** — informational warnings until N3 (AST-hash binding · conversion-node enforcement).

*Schema v0.1.0 — Phase 53 N1. Extend (do not rewrite) as domains backfill.*
