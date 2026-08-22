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

---

## Session: m3-punch-pr2 (Code, Fable 5) — BRIEF_M3_PUNCHLIST_AND_CLOSEOUT execution, PR 2 of 2 (§B + §C-3 + §E)

### Changes Made
- **Type**: Fix (number-moving). `changesNumbers: YES` by contract — D-21 honoured: the
  expected-movement brief `docs/verification/briefs/RING3_M3_PUNCH_FIXES.md` was COMMITTED
  BEFORE any fix code (first commit of the branch).
- **Scope**: D-12 pack ATO labelling (MON-184) + the ONE portfolio-LVR producer (MON-182)
  + §E M2.5 close-out
- **Description**:
  - **MON-184 (§B)** — live evidence (#1601 Ring-3): all 35 property rows carried a
    category yet ZERO reached an ATO label. Diagnosis (verified in source + the verdict's
    category listing): live rows carry the UPPERCASE enum values the link route writes as
    `categoryLevel1` (RATES, INSURANCE, UTILITIES, MAINTENANCE, MODIFICATIONS), while the
    seeds spoke title-case triples and the lookup demanded an EXACT triple match. Fix at
    the ONE producer: `buildTaxPackSummary`'s lookup now falls back
    `(l1,l2,sub) → (l1,l2) → (l1)` (a row is `noAtoMapping` only when NO level is mapped),
    and `SYSTEM_TAX_MAPPING_SEEDS` gains the enum vocabulary → rental-schedule lines
    (RENTAL→21F · RATES→21Q · INSURANCE→21V · UTILITIES→21S · MAINTENANCE→21M ·
    STRATA→21H · LAND_TAX→21W · LOAN_INTEREST→21I · PROPERTY_MANAGEMENT→21G).
    **Deliberately NOT mapped** (they stay honestly unmapped for the tile to surface):
    MODIFICATIONS (capital-vs-repair is the tax agent's call — auto-labelling would hide
    exactly the review the pack exists to prompt) and RENT (the literal collides across
    the income/expense enums; direction-blind mappings would mislabel). D-21 movement:
    totals/identity/perProperty byte-identical; movement confined to the atoLabelling
    partition.
  - **MON-182 (§C-3)** — two live producers disagreed (snapshot all-liabilities /
    all-property-value 41.3% vs page owned-only screen arithmetic 40.8%).
    `lib/calculations/portfolioLvr.ts` is now THE producer: owned properties only,
    property-attached principal, producer-owned 2dp rounding (MON-154 lesson). The
    snapshot's inline basis and the page's arithmetic are DELETED; both surfaces read the
    engine and name the basis ("Portfolio LVR — owned"). D-21: the scoreboard figure moves
    41.3% → 40.8%; the page figure does not move. Hidden-family LVR producers recorded
    HELD under D-20 (portfolioEngine:493 · health metricAggregation:402 · testing
    exporter:334) — untouched, out of kept scope.
  - **§E — M2.5 CLOSED** with per-condition evidence in the plan (census at seed ·
    source-lock/financial-surfaces/A3 green · expectedMoves landed per VR-045/047/047B +
    #1601 · Ring-3 PASS 2026-08-22; honest boundary: PR-2's own movements verify at
    `RING3_M3_PUNCH_FIXES.md`, and condition 5 — the complete Matrix sweep — closes the
    programme, not M2.5).
  - **Census note**: the new lib producer (+1 lvrGearing) was offset by removing a
    TEXT-MATCH PHANTOM — `const lvr = calculateLVR(property)` consumption locals renamed
    `perPropertyLvr` (they derive nothing; the pattern read the lowercase `lvr` as a
    derivation). Ratchet green AT seed — never a reseed of a rise.

### Files Modified
- `docs/verification/briefs/RING3_M3_PUNCH_FIXES.md` — NEW, committed FIRST (D-21)
- `lib/bookkeeping/taxPack/summary.ts` — hierarchy fallback at the one lookup
- `lib/bookkeeping/taxCategoryMapping.ts` — enum seed vocabulary (+9 seeds, 2 stated omissions)
- `tests/bookkeeping/mon169170PackReconciliation.test.ts` — 9-row worked example (fallback + unmapped)
- `lib/calculations/portfolioLvr.ts` — NEW: THE owned-portfolio-LVR producer
- `app/api/portfolio/snapshot/route.ts` — gearing reads the one engine
- `app/dashboard/properties/page.tsx` — screen arithmetic deleted; phantom locals renamed
- `components/properties/PropertiesHero.tsx` + `PropertyTile.tsx` + `ScoreboardClient.tsx` — basis labels + field rename
- `tests/calculations/portfolioLvr.test.ts` — NEW: Ring-0 worked example + Ring-1 one-producer guard
- `docs/financial-logic/graph/financial-graph.json` + `GENERATED_CORE.md` — engine + number + surface modelled; anchors re-pinned
- `tests/golden/parityMatrix.ts` — KNOWN_UNRESOLVED +1 (hero LVR) with growth path
- `docs/strategy/MONITRAX_V1_MASTER_PLAN.md` — M2.5 tick + cursor + §5 + §9
- `docs/issues/ISSUES.json` + `ISSUES.md` — MON-182/184 → FIXING (follow-up commit with the PR number)

### Build Status
- [x] `npx tsc --noEmit` clean · pack suite 6/6 · portfolioLvr 7/7 · golden/neomatrix/issues 371/371
- [x] `neomatrix:check` (anchors current, census gate 0 uncovered) · `census:producers:check`
      (AT seed) · `lint:source-lock` · `lint:financial-surfaces` — all green
- [x] Full vitest suite: run before push (result in the PR body)

### Coverage boundary
Ring-0 proves the fallback + formula on fixtures; Ring-1 proves the one-producer wiring in
source. Does NOT prove the live movement — that is `RING3_M3_PUNCH_FIXES.md` (labelled>0
with the predicted residue; LVR identical on both surfaces at ~40.8%), run by the Matrix
after merge + deploy. XLSX/PDF label rendering follows the same summary object but was not
opened in this session.
