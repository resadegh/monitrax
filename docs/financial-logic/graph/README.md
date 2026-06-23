# Neomatrix — Financial Logic Knowledge Graph

> The machine-readable + navigable + auditable evolution of the markdown
> [Financial Logic Index](../00_INDEX.md). Spec:
> [`docs/blueprint/PHASE_53_MONITRAX_NEOMATRIX.md`](../../blueprint/PHASE_53_MONITRAX_NEOMATRIX.md).
> Workstream `0·NEOMATRIX`.

## Layers (Phase 53 §4)

| Layer | Artifact | Status |
|---|---|---|
| **L0** — structural skeleton (bones) | Graphify AST call/import graph (code-only, **regenerable**, gitignored) | ✅ trialled — see [`N0_GRAPHIFY_TRIAL.md`](N0_GRAPHIFY_TRIAL.md) |
| **L1** — semantic graph (the truth) | `financial-graph.json` — nodes + typed edges + formula/authority/units/lineage | ⏳ N1 (schema + 4 core engines) |
| **L2** — views (the window) | markdown generated FROM the JSON · 2D explorer · optional 3D | ⏳ N2 |
| **L3** — audit (the guarantee) | CI checks: `file:line` resolves · every number→engine · no bypass · freshness | ⏳ N3 |

## Files here

- **`N0_GRAPHIFY_TRIAL.md`** — Layer 0 trial: security pre-check (code-only, no
  egress) + edge-accuracy comparison vs `00b` + go/no-go.
- `financial-graph.json` *(N1)* — the canonical semantic graph. **This** is the
  Neomatrix; everything else renders from it.

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
