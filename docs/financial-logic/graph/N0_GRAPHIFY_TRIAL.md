# Neomatrix N0 — Graphify Trial Report & Go/No-Go

> **Phase 53 N0 deliverable** (`docs/blueprint/PHASE_53_MONITRAX_NEOMATRIX.md` §7).
> Trial of **Graphify** as the Neomatrix **Layer 0** (structural skeleton): does its
> auto-extracted AST call/import graph reproduce the hand-verified edges in
> [`../00b_RELATIONSHIPS_AND_LINEAGE.md`](../00b_RELATIONSHIPS_AND_LINEAGE.md), and
> what (if anything) leaves the machine during extraction (CLAUDE.md §13.6)?
>
> **Every claim below was produced by running Graphify on this repo and reading
> the output — nothing is assumed (CLAUDE.md §19.2).** Reproduce with the commands
> in §6.

---

## 0. Recommendation — **GO (conditional)**

**Adopt Graphify for Layer 0 in CODE-ONLY / OFFLINE mode**, scoped to the
TypeScript source under `lib/` (and later `app/`), with the operational
guardrails in §5. It supplies the structural `feeds`/`depends-on`/`imports`
edges accurately and at exact `file:line`, eliminating the hand-tracing-and-drift
risk those edges otherwise carry. It does **not** replace Layer 1 — it cannot
derive a single formula, law, unit, or data-flow edge. Bones, not meaning.

| Gate | Result |
|---|---|
| **Security (§13.6) — does code leave the machine?** | **No, in code-only mode.** 100% of nodes were AST-extracted locally; no LLM/API key was set; no network egress. ✅ |
| **Accuracy — reproduces `00b §2` verified edges?** | **8 / 8** orchestration call-edges reproduced, at line numbers **matching `00b`'s citations exactly**. ✅ |
| **False edges on the core slice?** | None found. Outbound `calls` of the 4 core engines are all real. ✅ |
| **Node identity / collisions?** | File-scoped node IDs — name collisions (3× `calculateNetWorth`) stay distinct nodes. ✅ |
| **Drift control?** | Graph pinned to `built_at_commit`; `graphify update` re-extracts with no LLM. ✅ |

---

## 1. What Graphify is (verified, not from memory)

- **Package:** `graphifyy` (PyPI, double-y), installed via `uv tool install graphifyy`.
  Trial used **graphify 0.8.45**.
- **Engine:** local **tree-sitter** AST parsing — ships `tree-sitter-typescript`
  among 36 language grammars. Code parsing is local by design; the project's own
  docs state *"Code files — processed locally via tree-sitter. Nothing leaves your
  machine."*
- **LLM use is for NON-code only.** Docs/PDFs/images are sent to a configured LLM
  backend (Anthropic/Gemini/OpenAI/…) for *semantic concept extraction*. **A
  code-only corpus requires no API key and runs fully offline.** Video/audio use
  local `faster-whisper`.
- **Output:** `graphify-out/graph.json` (nodes + typed edges, node-link format),
  `GRAPH_REPORT.md`, and an interactive `graph.html` (skipped here — 6120 nodes
  exceeds the 5000-node HTML viz limit). Exports to Neo4j/GraphML/SVG/Obsidian.

---

## 2. Security pre-check (§13.6) — the gate that had to pass first

**Question:** during extraction of Monitrax's financial engines, does any source
code leave the machine?

**Method.** Ran the extraction with **all LLM API keys explicitly unset**
(`env -u ANTHROPIC_API_KEY -u GEMINI_API_KEY -u GOOGLE_API_KEY -u OPENAI_API_KEY
-u DEEPSEEK_API_KEY`) over `lib/` (539 `.ts` files). Then inspected every node's
provenance and scanned the cache for API hosts.

**Findings — provably code-only:**

| Check | Result |
|---|---|
| Node provenance | **6120 / 6120 nodes `_origin: "ast"`, `file_type: "code"`** — zero LLM-extracted concept nodes. |
| Edge provenance | 12855 `EXTRACTED` (AST) + **11 `INFERRED`** (cross-module call resolution); zero LLM-semantic edges. |
| API key required | None — extraction completed and the tool printed *"no LLM needed"*. |
| Egress evidence | No `anthropic`/`openai`/`googleapis`/`generativelanguage` host found in `lib/graphify-out/cache`. |

**Conclusion.** In code-only mode, Graphify is a **local static analyser** — it is
no more an egress risk than `tsc` or `eslint`. The only path to egress is feeding
it **non-code** files (docs/PDFs/images) **with an API key set**; the Neomatrix
build MUST NOT do that. The §5 guardrails make that structural (no key in env,
code-only inputs).

> **No CDR/user data is ever in scope** — the graph models code structure +
> symbols, never balances/transactions/PII (Phase 53 §9). Confirmed: every node is
> a file/symbol, no value literals.

---

## 3. Accuracy — does it reproduce the hand-verified `00b` edges?

`00b_RELATIONSHIPS_AND_LINEAGE.md` §2 lists the verified orchestration edges:
`getMasterFinancialSnapshot()` calling each core engine, with cited line numbers.
Graphify's AST `calls` graph reproduced **all of them**, and its line anchors
**match `00b`'s citations exactly**:

| `00b §2` edge (caller → callee) | `00b` cited line | Graphify result | Line |
|---|---|---|---|
| → `calculateNetWorth` | :1767 | **FOUND** | L1767 ✅ |
| → `calculateCashflow` | :1819 | **FOUND** | L1819 ✅ |
| → `aggregateLoanRepayments` | :1831 | **FOUND** | L1831 ✅ |
| → `computeActualCashflow` | :1857 | **FOUND** | L1857 ✅ |
| → `aggregateExpenses` | :874+ | **FOUND** (via `buildExpenseBreakdown`) | L874 ✅ |
| → `aggregateIncome` | :1005+ | **FOUND** (via `buildIncomeBreakdown`) | L1005 ✅ |
| → `buildEmergencyFundMetrics` | :1910 | **FOUND** | L1910 ✅ |
| → `buildHealthScore` | :1916 | **FOUND** | L1916 ✅ |
| `getCanonicalMonthlyCashflow` → `resolveCanonicalCashflow` | (rule delegation) | **FOUND** | L119 ✅ |

**Score: 9/9 structural edges reproduced** (8 orchestration + the canonical-rule
delegation), each at an exact, citable `file:line`. Graphify also correctly
attributed the expense/income calls to the *inner* helpers
(`buildExpenseBreakdown`/`buildIncomeBreakdown`) rather than the snapshot root —
which is more precise than `00b`'s `:874+`/`:1005+` shorthand.

The 4 core engine symbols were located with anchors matching an independent
`grep`: `calculateNetWorth` L217 · `calculateCashflow` L302 ·
`computeActualCashflow` L104 · `getCanonicalMonthlyCashflow` L114 ·
`resolveCanonicalCashflow` L78 · `buildEmergencyFundMetrics` L1287 ·
`buildHealthScore` L1311.

### 3.1 What Graphify CANNOT derive (this is the whole point of Layer 1)

The `00b` map contains edges and facts that are **not** function calls and that an
AST tool will never produce — confirming the Phase 53 §4 division of labour:

| `00b` knowledge | Why Graphify can't derive it | Whose job |
|---|---|---|
| `UnifiedTransaction.amount/direction/isTransfer` **feeds** `computeActualCashflow` | DB field → engine is a *data dependency*, not a call edge | **Layer 1** (`depends-on` / `governed-by`) |
| Emergency fund **falls-back-to** declared expenses when `!hasActualData` | A conditional data-flow semantic, not a static call | **Layer 1** (`falls-back-to`) |
| The **formula** `net/inflow*100`, the **authority** (CLAUDE.md §19.1 / ATO refs), input **units** | Pure meaning — absent from the AST | **Layer 1** (verified, never guessed) |
| `domain` / `TRAIL` / `regime` slicing | Graphify's 253 communities ≈ structural clusters, **not** Monitrax's domains | **Layer 1** classification |
| raw-field → route → **UI tile** lineage (`00b §3`) | UI/routes live in `app/`, outside this `lib/` slice | Layer 1 over a wider corpus |

---

## 4. False-edge & noise analysis

- **Outbound `calls` of the core engines are all real:**
  `calculateNetWorth` → `calculateTotalAssets`, `calculateTotalLiabilities`
  (the exact sub-functions `01_CORE_CALCULATIONS.md` §1 documents);
  `computeActualCashflow` → `monthKey` (its real local helper);
  `resolveCanonicalCashflow` → none (a true pure leaf). No phantom edges.
- **Name collisions handled:** three different `calculateNetWorth` symbols exist
  (`netWorthCalculator`, `intelligence/portfolioEngine`, `testing/exporter`).
  Graphify keeps them as **distinct file-scoped nodes**, so a naive name-join
  false-merge does not occur. Edge attribution used the file-scoped IDs.
- **`INFERRED` edges (11 / 12866):** cross-module calls the AST couldn't bind
  statically (re-exports/indirection), e.g.
  `feedbackService.respondToFeedbackThread → anthropic.generateAnthropicCompletion`.
  These are plausible but **must be flagged `source: "inferred"`** in the Neomatrix
  and **never promoted to `verified`** without a source read (Phase 53 §5 rule).
- **Relation mix** (12866 edges): `contains` 5452 · `calls` 2386 · `imports` 2198 ·
  `re_exports` 1108 · `imports_from` 976 · `references` 550 · `method` 169 ·
  `inherits` 19 · `implements` 8. For Neomatrix `feeds`/`depends-on` we consume
  primarily `calls` (+ `imports`/`imports_from` for module wiring); `contains` is
  the symbol-tree scaffold.

---

## 5. Adoption guardrails (conditions of the GO)

1. **Code-only, no API key.** Never set an LLM API key in the Neomatrix extraction
   environment, and never feed Graphify non-code (docs/PDFs/images). This keeps
   egress structurally impossible. Run via `graphify update lib` (re-extract, no
   LLM) — not the doc/semantic path.
2. **Graphify output is a regenerable working artifact, NOT the canonical store.**
   `graph.json` is 6 MB and rebuilds from source in seconds. **Do not commit it**
   — it is `.gitignore`d (`graphify-out/`). The canonical store is the curated,
   hand-verified `financial-graph.json` (Layer 1, N1); Graphify edges are
   *imported into* it flagged `source: "graphify"` (Phase 53 §5), only for the
   structural edges, only after the symbol is confirmed.
3. **Graphify edges enter the audited graph as `source: "graphify"`**, distinct
   from `source: "verified"` (read in source) and `source: "inferred"`. The audit
   (Layer 3) treats `verified` as the gold standard; `graphify` edges are
   trusted-but-labelled; `inferred` are not audit-load-bearing.
4. **Pin to commit.** Use the emitted `built_at_commit` for the freshness check —
   if the graph's commit lags HEAD on a financial-engine file, CI flags staleness
   (Layer 3, N3).
5. **No new runtime dependency.** Graphify is a build/dev tool (Python/uv), not an
   app dependency. It never ships to Vercel and is not in `package.json`.

---

## 6. Reproduce this trial

```bash
# 1. Install (network: PyPI only)
uv tool install graphifyy            # -> graphify 0.8.45

# 2. Extract CODE-ONLY, offline, no key can leak code
cd /path/to/monitrax
env -u ANTHROPIC_API_KEY -u GEMINI_API_KEY -u GOOGLE_API_KEY \
    -u OPENAI_API_KEY -u DEEPSEEK_API_KEY \
    graphify update lib                # -> lib/graphify-out/graph.json (no LLM)

# 3. Verify provenance + the 00b edges (see this report's §2–§4)
python3 -c "import json,collections as c; g=json.load(open('lib/graphify-out/graph.json')); \
print(c.Counter(n['_origin'] for n in g['nodes']))"   # -> {'ast': 6120}
```

Result on `built_at_commit 2a5e0f5…`: **6120 nodes · 12866 edges · 253 communities**.

---

## 7. Open decision for Reza (the go/no-go)

**Adopt Graphify as Layer 0 in code-only mode (recommended GO), under the §5
guardrails?** If yes, N1 proceeds and the structural edges it produces are
imported into `financial-graph.json` flagged `source: "graphify"`, while the
formulas/laws/units/data-flow remain hand-verified Layer 1. If no, N1 still
proceeds — Layer 1 is independent — but every `feeds`/`depends-on` edge is then
hand-traced (the drift risk Phase 53 set out to remove).

---

*N0 trial executed 2026-06-23. Documentation/model only — no financial logic
changed. Part of `0·NEOMATRIX` (Phase 53).*
</content>
</invoke>
