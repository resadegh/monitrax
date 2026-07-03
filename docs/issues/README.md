# Monitrax Issue Registry — a tracking + fixing system that enforces §19.4

> **Why this exists (Reza directive 2026-07-03):** *"I want an issue tracking and fixing system that
> actually works, so we can keep track of all issues and fixes as we go and test each problem
> holistically."* The point isn't tracking — it's making the CLAUDE.md **§19.4 FULL-FLOW VERIFICATION**
> rule *executable*: an issue can't be quietly "closed" while it's still broken somewhere else.

## The three files

| File | Role | Edit? |
|---|---|---|
| `ISSUES.json` | **SSOT** — one entry per issue (machine-readable) | ✅ edit this |
| `ISSUES.md` | human view (generated) | ❌ generated — `npm run issues:generate` |
| `scripts/issues/check-issues.mjs` | the **gate** | ❌ the enforcer |

Enforcement runs in CI via `tests/issues/registry.test.ts` (a required check) and locally via `npm run issues:check`.

## The lifecycle (enforced, not by discipline)

```
🔵 OPEN → 🟡 DIAGNOSED → 🟠 FIXING → 🟢 VERIFIED → ✅ CLOSED     (also: ⚪ WONTFIX · ❌ RETRACTED)
```

The gate **blocks** an invalid transition. Concretely:

| To reach… | You MUST have… |
|---|---|
| **FIXING / VERIFIED / CLOSED** | the **§19.4 downstream-consumer sweep** filled (`downstreamConsumers[]`) **and** a `fixPRs[]` entry |
| **VERIFIED / CLOSED** (when `changesNumbers: true`) | a **linked, existing holistic test** (`test`) — the §19.4 cross-surface propagation test — **and** ≥1 `semanticKeys` that resolves to a real Neomatrix node (forces the number to be modelled — §21.2.1) |
| **CLOSED** | a `closed` date |

Display/UX issues (`changesNumbers: false`) can close without a propagation test (§19.4 governs *number-changing* fixes) — but still need the sweep + a PR.

This is the whole idea: **a number-changing fix cannot be marked done without a test that proves it flowed to every downstream surface.** That's what kills the "fixed the property page, dashboard still broken" whack-a-mole.

## An entry

```jsonc
{
  "id": "MON-001",                 // stable, MON-NNN
  "title": "…",
  "status": "DIAGNOSED",           // the lifecycle
  "severity": "critical",          // critical|high|medium|low
  "changesNumbers": true,          // gates the test requirement
  "opened": "2026-07-03",
  "closed": "2026-07-05",          // required when CLOSED
  "area": "properties",
  "rootCause": ["path/to/file.ts:123"],        // anchors must point at real files
  "semanticKeys": ["engine.x.y"],              // Neomatrix nodes — must resolve
  "downstreamConsumers": ["app/.../page.tsx"], // the §19.4 sweep
  "fixPRs": [1333],
  "test": "tests/…/foo.test.ts",               // the holistic test (path must exist)
  "tracker": "docs/audits/…md#p-1",            // link to the detailed write-up
  "notes": "…"
}
```

## Workflow

1. **New issue** → add an entry, status `OPEN`/`DIAGNOSED`, fill `rootCause` (verified `file:line`, §19.2).
2. **Diagnose** → consult the **Neomatrix** for the number's lineage; list its `semanticKeys` + the `downstreamConsumers` (the §19.4 sweep). If the number isn't modelled, model it first (§21.5) so a `semanticKey` resolves.
3. **Fix** → open the PR (`fixPRs`), set `FIXING`. For a number-changing fix, write the **holistic cross-surface test** and link it in `test`.
4. **Verify** → the test passes across every downstream surface → `VERIFIED` → `CLOSED` (with a date). The gate won't let you close without the test.
5. Always run `npm run issues:generate` so `ISSUES.md` matches, and `npm run issues:check` before pushing.

## Relationship to the rest

- **CLAUDE.md §19.4** is the rule; this registry is the mechanism that enforces it.
- **The Neomatrix** (`financial-graph.json`) is the downstream map — `semanticKeys` tie each issue to it.
- **calc-audit fixtures / `tests/`** are the holistic-test spine (no new test platform — §22).
- **`IMPLEMENTATION_PLAN.md` backlog** stays for strategic/non-bug items; concrete defects live here.
