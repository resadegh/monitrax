# Neomatrix — Financial Logic Knowledge Graph

> The machine-readable + navigable + auditable evolution of the markdown
> [Financial Logic Index](../00_INDEX.md). Spec:
> [`docs/blueprint/PHASE_53_MONITRAX_NEOMATRIX.md`](../../blueprint/PHASE_53_MONITRAX_NEOMATRIX.md).
> Workstream `0·NEOMATRIX`.

## Layers (Phase 53 §4)

| Layer | Artifact | Status |
|---|---|---|
| **L0** — structural skeleton (bones) | Graphify AST call/import graph (code-only, **regenerable**, gitignored) | ✅ trialled — see [`N0_GRAPHIFY_TRIAL.md`](N0_GRAPHIFY_TRIAL.md) |
| **L1** — semantic graph (the truth) | `financial-graph.json` — nodes + typed edges + formula/authority/units/lineage | ✅ **N1 proof slice** — 4 core engines + lineage, schema `schema/financial-graph.schema.md` |
| **L2** — views (the window) | markdown generated FROM the JSON · 2D explorer · optional 3D | 🟡 2a done (`GENERATED_CORE.md`); 2D/3D = N2 |
| **L3** — audit (the guarantee) | CI checks: `file:line` resolves · every number→engine · no bypass · freshness | 🟡 seed live in `tests/neomatrix/` (schema · A3 invariants · file:line · freshness); full gate = N3 |

## Files here

- **`financial-graph.json`** — the canonical semantic graph. **This** is the
  Neomatrix; everything else renders from it. Schema: [`schema/financial-graph.schema.md`](schema/financial-graph.schema.md).
- **`GENERATED_CORE.md`** — generated view (DO NOT EDIT). `npm run neomatrix:generate`.
- **`N0_GRAPHIFY_TRIAL.md`** — Layer 0 trial: security pre-check (code-only, no
  egress) + edge-accuracy comparison vs `00b` + go/no-go.

## Commands

```bash
npm run neomatrix:generate   # render GENERATED_CORE.md FROM the JSON
npm run neomatrix:check      # validate schema + invariants + freshness (exits 1 on failure)
```
The same checks run in the vitest suite (`tests/neomatrix/financialGraph.test.ts`),
so the model is enforced in CI today (full N3 build-gate to follow).

## Rules (Phase 53 §10 — read before editing)

1. **Documentation/model only** — never change a formula/law/threshold. Suspected
   bug → `status: "suspected-issue"` + raise with Reza.
2. **Never guess** — every `verified` node/edge cites `file:line` read in source
   (CLAUDE.md §19.2). Unverifiable → `status: "unverified"` with the reason.
   Graphify-derived edges are flagged `source: "graphify"`.
3. **Derive, don't hand-maintain** — markdown renders from the JSON; CI checks
   freshness.
4. **No CDR/user data** ever enters the graph — code structure + formulas only.

> **Graphify output is NOT committed** — `graphify-out/` is gitignored. Regenerate
> with `graphify update lib` (code-only, no API key). The canonical store is the
> in-repo `financial-graph.json`.
</content>
