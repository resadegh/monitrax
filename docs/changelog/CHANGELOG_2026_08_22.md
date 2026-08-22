# Changelog - 2026-08-22

## Session: m3-punch-pr1 (Code, Fable 5) — BRIEF_M3_PUNCHLIST_AND_CLOSEOUT execution, PR 1 of 2 (§A + §C-1/2/4 + §D)

### Changes Made
- **Type**: Fix (display/gating) + registry/process. `changesNumbers: NO` by contract — no
  producer, engine, or money figure is touched; every change is a display window, a fetch
  param, a render order, or a module key.
- **Scope**: v1 scoreboard punch list + MODULE_HOME re-key sweep (`docs/strategy/BRIEF_M3_PUNCHLIST_AND_CLOSEOUT.md`)
- **Description**:
  - **§A registry** — MON-180…186 registered; MON-168/169/170 → **VERIFIED** citing the
    Ring-3 PASS verdict on #1601 (2026-08-22: backfill 293/46/idempotent-0; identity
    35+39+0+313=387 exact to the cent; perProperty 4 entries; tiles byte-identical).
    MON-185 is REGISTER-ONLY (data duplicates/stray/orphans — the Reza runbook is in the
    issue body; no session ever auto-fixes user data). MON-182/184 stay DIAGNOSED — their
    fixes are punch-list PR-2 (changesNumbers: YES, D-21).
  - **MON-180 (§C-1)** — the EOFY tile read only the CURRENT FY (no `fy` param), so in
    August it rendered "All rows Tax-ready" against a near-empty FY2026-27 while 35
    unmapped FY2025-26 rows sat one window back. The rule now lives in
    `lib/dashboard/scoreboardDisplay.ts` (pure, tested): an empty current FY renders the
    honest "No property rows yet this FY" (never a tax-ready claim), and during the EOFY
    season (July–October, within 4 months of FY start) the tile ALSO fetches the
    just-ended FY via the export route's existing `?fy=` param — same producer, second
    window — and leads with it.
  - **MON-181 (§C-2)** — the intake tile fetched `/api/unified-transactions/review-queue`
    with NO `band` param; the route requires `band=medium|low` and 400s otherwise, so the
    tile rendered "—" always. It now fetches BOTH bands on the SAME route and sums; a real
    0 renders as 0; "—" remains only when both fetches genuinely fail.
  - **MON-183 (§C-4)** — the strip's bare `slice(0, 4)` is gone: ALL properties render,
    ordered worst monthly figure first (stable sort; rule stated in code + locked by test).
  - **MON-186 (§D)** — the 2026-08-22 MODULE_HOME flip changed the key's meaning to "the
    v1 scoreboard", resurfacing legacy surfaces keyed to it. Re-keys (hidden ≠ deleted):
    Financial Overview report tile → `MODULE_CFO` (whole-position wealth-OS story, R4);
    Tax-Time report tile (was UNKEYED, always visible; its calendar-YTD generator is the
    path the M2 Ring-3 FAIL condemned) → `MODULE_TAX` (R2); `/api/money-flow` →
    **`MODULE_ENTITIES`** — a stated DEVIATION from the brief's `MODULE_HOUSEHOLD`
    recommendation, for Reza's eyes: the route's own contract is the per-entity money-flow
    shape built for the entities canvas, and no household surface ever consumed it (the
    activity Sankey reads `/api/master-snapshot`). Guard: `reportTileKeys.test.ts` pins the
    reports-page tile keys + the money-flow gate to an explicit expected map, so a future
    flip cannot silently resurface a legacy tile; the P2.3 source-scan test re-cut to the
    new law (its old assertions encoded the pre-MON-186 state).

### Files Modified
- `docs/issues/ISSUES.json` + `ISSUES.md` — §A registrations + VERIFIED flips
- `lib/dashboard/scoreboardDisplay.ts` — NEW pure display rules (MON-180/183)
- `app/dashboard/ScoreboardClient.tsx` — season-aware EOFY fetch + render states; both-band
  intake fetch; full-set worst-first strip
- `app/dashboard/reports/page.tsx` — MON-186 re-keys (financial-overview, tax-time)
- `app/api/money-flow/route.ts` — MODULE_HOME → MODULE_ENTITIES
- `tests/dashboard/scoreboardDisplay.test.ts` — NEW (12 assertions over the two rules +
  render-site pin)
- `tests/dashboard/reportTileKeys.test.ts` — NEW MON-186 expected-map guard
- `tests/featureFlags/p2Narrowing.test.ts` — re-cut to the MON-186 keys
- `docs/strategy/MONITRAX_V1_MASTER_PLAN.md` — cursor + §5 rows + M3.4 note + §9 line
- `docs/implementation/MON-131_TRANCHE_LEDGER.md` — §6 registry-movement row
- `docs/financial-logic/graph/structural/coverage-allowlist.json` — +3 (graphify
  unavailable in-session; remove at next regeneration)

### Build Status
- [x] `npx tsc --noEmit` clean · new + touched suites green (scoreboardDisplay 9 ·
      reportTileKeys 3 · tileRegistry 8 · p2Narrowing 5)
- [x] `issues:check` (173 valid) · `mon131:check` · `neomatrix:check` (Layer-0 covered,
      anchors current) · `census:producers:check` (all counts AT seed — no phantom) ·
      `lint:source-lock` · `lint:financial-surfaces` — all green
- [x] Full vitest suite: run before push (result in the PR body)

### Coverage boundary
Verifies the pure display rules on fixtures and the static key wiring in source. Does NOT
verify: the rendered tiles on live data (the brief's Ring-3 handout — EOFY tile leading
with FY2025-26, intake count, full strip), the gated 404/503 behaviour on a deployed build,
or any money figure (none moved — changesNumbers: NO).
