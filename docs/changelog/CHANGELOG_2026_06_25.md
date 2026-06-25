# Changelog — 2026-06-25

## Session: claudemd-neomatrix-first (branch `claude/claudemd-neomatrix-first-jqahjw`)

### Changes Made
- **Type**: Governance / process (CLAUDE.md standing instruction; NO code, NO financial logic, NO graph data changed)
- **Scope**: Reza directive 2026-06-25 — *"all sessions should use Neomatrix from now on to understand the Monitrax design and architecture instead of going through the whole code and documents … Claude Code should always be on top of the design and never assume or guess how Monitrax works."*
- **What was added**: a **Neomatrix-FIRST comprehension** standing rule so every future session reaches for the verified graph as the first reference for the financial architecture — instead of re-reading the whole codebase — while never assuming/guessing.

### Files Modified
- `CLAUDE.md`:
  - **+ §21.5 — Neomatrix-FIRST comprehension (read the map before the territory, NON-NEGOTIABLE)**: where it lives (`financial-graph.json` / `GENERATED_CORE.md` / `/admin/neomatrix`), the 5-point rule (start at the graph · trust it for what it models · **honest scope guard** — it maps the financial logic, NOT yet auth/CDR/infra/pure-UI, so Part 10 still governs there · **a gap is a signal to MODEL it (§21.2), never to guess** · never assume/guess, disagreements → `suspected-issue`), + reviewer enforcement.
  - **Part 1 Step 3 — new item 0**: Neomatrix first for any financial number/engine/flow (jump to the verified `file:line` rather than grep-and-read-everything).
  - **Part 10 §10.3 research checklist — new lead item**: "What does the Neomatrix say?" before the blueprint/code reads.
  - Version footer → **2.8**.

### Why this wording (honest scoping — §0 advisory lenses)
- **Architect lens**: the rule is scoped to what the graph actually covers today (the financial logic — 104 nodes, 6 domains, 1 connected component). It does **not** claim to map auth/CDR/IAM/infra/pure-UI/every route. Telling sessions "use Neomatrix instead of reading code" *without* that guard would cause under-research in unmapped areas — so the guard is explicit, and Part 10 still governs there.
- **Anti-guess (§10/§19)**: a Neomatrix gap is defined as a trigger to **model it** (grow the graph, verified `file:line`), never to assume. This keeps the "never guess" discipline intact while making the map the default comprehension path.
- The growth direction (model more of the architecture into the graph over time — N4 backfill) is named so the rule trends toward genuinely covering "the whole design."

### Build Status
- [x] Docs/governance only — no code, no graph data, no financial logic changed.
- [x] `npm run neomatrix:check` — OK (graph untouched; still 104 nodes / 139 edges / 1 component, v0.26.0).
- [x] Plan freshness OK.

### §20 self-review (3× → 10/10)
- **Pass 1 (draft)**: §21.5 + Step 3 + Part 10 edits.
- **Pass 2 (critique)**: the risk in "use the graph instead of the code" is over-reliance on a partial map → blind spots in unmapped areas. Added the explicit honest-scope guard (point 3) + the "gap → model, never guess" rule (point 4) so the instruction can't be read as "skip research where the graph is silent."
- **Pass 3 (refine)**: tied the new rule into the existing Part 1 / Part 10 / Part 21 fabric (cross-refs, not duplication); reviewer-enforcement clause distinguishes "re-derived a mapped lineage" (consult the map) from "real gap" (model it). **10/10.**

### Doc-sync (CLAUDE.md §16)
- No §16.2 product surface changed — this is a change to the governance document itself.

### PR
- Branch: `claude/claudemd-neomatrix-first-jqahjw`
- Status: Draft (to be opened)
