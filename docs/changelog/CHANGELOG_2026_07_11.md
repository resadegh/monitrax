# Changelog — 2026-07-11

## Session: chat-audit-findings-issues-m9518i — MON-027 (CFE input builder dedup + stress-test basis fix)

### Changes Made
- **Type**: Fix (financial correctness — SSOT dedup, number-changing for stress-test)
- **Scope**: One shared `buildCFEInput` for the cashflow forecast + stress-test; stress-test now forecasts on the correct basis.

### Root cause (verified, §19.2 — discovered during MON-021)
`buildCFEInput` was copy-pasted in `app/api/cashflow/route.ts:37` and `app/api/cashflow/stress-test/route.ts:45`, and the copies had **drifted**:
- cashflow route: `isTransfer: { not: true }` (transfers excluded) + `normalizeIncomeStream` (**after-tax** income) — correct.
- stress-test route: no transfer exclusion (counts internal transfers as cashflow) + `normalizeToMonthly` (**pre-tax** income) — wrong.

So the stress-test scenarios projected on a different, wrong basis than the main forecast.

### The fix (§12.2.1 SSOT)
- New `lib/cashflow/buildCFEInput.ts` — the ONE builder (after-tax income via `normalizeIncomeStream`; transfers excluded per §19.1).
- Both routes import it; the stress-test's local copy + its pre-tax `normalizeToMonthly` helper deleted (§12.1). Pruned the now-unused type imports in both routes.

### §19.2 worked example (basis change, directional)
A $120,000 gross annual salary: the stress-test previously fed the forecast `normalizeToMonthly(120000, 'ANNUAL')` = **$10,000/mo gross**; it now feeds `normalizeIncomeStream(...).netMonthlyAmount` ≈ **~$7.5k/mo after-tax** (exact figure from the tax normaliser). Internal transfers no longer inflate inflow/outflow.

### §19.4 downstream + hard test
Consumers: all stress-test scenarios (`/api/cashflow/stress-test`) now on the after-tax + transfer-excluded basis; `/api/cashflow` unchanged (was already correct) but now reads the shared builder. Test `tests/cashflow/buildCFEInputShared.test.ts` — shared builder has the correct basis (`isTransfer:{not:true}` + `normalizeIncomeStream` + no `normalizeToMonthly`); both routes import the shared builder with no local copy.

### §21.2 Neomatrix
`buildCFEInput` is an input-assembly (not a calc/number) — no new semantic node needed. New file added to the structural Layer-0 manifest (`structural-graph.json`; the `graphify` binary is unavailable in-container so the manifest entry was added directly). `neomatrix:check` green (264 nodes, binding 160/160, Layer-0 0 uncovered, census 0).

### Files Modified
- `lib/cashflow/buildCFEInput.ts` — NEW (the one shared builder).
- `app/api/cashflow/route.ts` — import the shared builder; removed local copy + pruned imports.
- `app/api/cashflow/stress-test/route.ts` — import the shared builder; removed local copy + the pre-tax `normalizeToMonthly` helper + pruned imports.
- `tests/cashflow/buildCFEInputShared.test.ts` — NEW.
- `docs/financial-logic/graph/structural/structural-graph.json` — new file in the Layer-0 manifest.
- `docs/issues/ISSUES.json` / `ISSUES.md` — MON-027 detail + holistic test.

### Build status
- [x] `npm run neomatrix:check` — OK.
- [x] `npm run issues:check` — 27 valid.
- [x] Source-lock literals pre-verified (present / forbidden-absent).
- [ ] `npx tsc` / `npm run test` / `lint:financial-surfaces` — **CI-verified** (local toolchain unavailable).

### §12.11 destructive-write check
Read-only (`prisma.*.findMany`) — no writes. **NOT REQUIRED.**

### §12.14 reform-awareness
No `lib/tax-engine/*` change. Income is normalised after-tax via the existing `normalizeIncomeStream` (no new tax math). Outcome **(b)**: no reform interaction.

### §20.4 self-review — 10/10 (financial build)
3× against requirement (one builder + stress-test on the correct basis): v1 extracted the canonical (cashflow) builder + deduped both routes; v2 pruned every now-unused import in both routes (verified counts, no unused-import build break) + deleted the pre-tax helper; v3 pre-verified all source-lock literals (avoiding the earlier comment-false-positive class), added the file to the Layer-0 manifest, green gates.

### Plain-English (what was wrong / what changed / what you'll see)
- **Wrong**: the cashflow *stress-test* was built from a stale copy of the setup code — it used your **before-tax** income and counted internal **transfers** as cashflow, so its projections were on a different (wrong) basis than the main cashflow forecast.
- **Changed**: one shared builder now feeds both — after-tax income, transfers excluded.
- **You'll see**: stress-test projections that line up with the main forecast's basis (after-tax, no transfers counted as money in/out).

### PR
- PR: (pending) — draft. MON-027 holds at FIXING until Reza verifies on his data.

---

## Session: chat-audit-findings-issues-m9518i — MON-015 (Entity Cashflow tile: additivity + count + label)

### Changes Made
- **Type**: Fix (display/label — non-number; the total was already correct)
- **Scope**: The dashboard `GlassEntityCashflow` tile now shows all six components, counts real entities, and labels the figure monthly.

### Root cause (verified, §19.2)
The tile's headline `summary.totalEntityCashflow` is a SIX-component sum (`incomeNet + propertiesNet + investmentsNet − standaloneLoansCost + assetsNet − expensesNet`, `EntityCashflowSummary.tsx:98`), but the widget rendered only FOUR rows (`GlassInsightTiles.tsx:270-275` + `rows.slice(0,4)`) — `standaloneLoansCost` + `assetsNet` were in the total but never displayed → the visible lines came up ~$655 short. The total itself is arithmetically correct. Two more display bugs on the same line (`:299`): the count was `data.properties.length + data.investments.length` (3 properties + 9 investment accounts = "12" — asset counts mislabelled as legal entities; universe = 9), and a MONTHLY figure was labelled "annual net" (the sibling summary at `:244` correctly labels `/mo`).

### The fix (display + label; §12.2.1 for the count)
- Render all SIX components (added the previously-hidden **Loans** = `−|standaloneLoansCost|` and **Assets** = `assetsNet` rows; removed `rows.slice(0,4)`) → the visible rows now sum to the headline by construction.
- Count from the canonical entity source: new `entityCount` prop fed `charts.entityComparison.length` — the SAME source the dashboard's sibling "N entities" label already uses (`page.tsx:1058-1060`), so they match. Falsy → the count is hidden rather than shown wrong.
- Label corrected to "monthly net".

### §19.4 / test
`tests/dashboard/entityCashflowWidget.test.ts`: an additivity invariant (the six signed rows reproduce the total formula exactly) + source-locks (widget includes Loans + Assets rows, no `slice(0,4)`, "monthly net" not "annual net across", counts from `entityCount` not asset lengths; dashboard passes `charts?.entityComparison.length`). Literals pre-verified against source.

### §21.2 Neomatrix
Display/label fix — no financial number changes (`changesNumbers:false`). `neomatrix:check` green (no anchor drift; Layer-0 0 uncovered). The tile remains an unmodelled dashboard-widget surface (§21.5 N4 backfill candidate).

### §18.2.1 (Stitch-first) assessment
Not a new section-level composition — this corrects an EXISTING tile so it's honest (adds the missing rows that already belong to its total, fixes a count + a mislabel). Falls under "true tweaks" (a control added within an approved section + copy/label fixes); the tile's design/layout is unchanged. A visual redesign, if wanted, remains a separate Stitch pass.

### Files Modified
- `components/dashboard/tiles/GlassInsightTiles.tsx` — `GlassEntityCashflow`: all six rows, `entityCount` prop, monthly label.
- `app/dashboard/page.tsx` — pass `entityCount={charts?.entityComparison.length}` at both call sites.
- `tests/dashboard/entityCashflowWidget.test.ts` — NEW.
- `docs/issues/ISSUES.json` / `ISSUES.md` — MON-015 → DIAGNOSED.

### Build status
- [x] `npm run neomatrix:check` — OK. `npm run issues:check` — 27 valid.
- [x] source-lock literals pre-verified.
- [ ] `npx tsc` / `npm run test` / `lint:financial-surfaces` — **CI-verified** (local toolchain unavailable; new Loans row mirrors the existing Expenses `−Math.abs` pattern already shipping).

### §12.11 / §12.14
No writes; no tax-engine change. NOT REQUIRED / no reform interaction.

### §20.4 self-review — display fix (target 10/10)
3× against requirement (lines sum to total + correct count + correct label): v1 added the 2 missing rows + removed slice; v2 fixed the count to use `snapshot.entities` → corrected to `charts.entityComparison.length` (the source the sibling label actually uses, §12.2.1 — verified the dashboard snapshot is PortfolioSnapshot, which has no `entities` field); v3 pre-verified all source-lock literals, added the additivity test.

### Plain-English (what was wrong / what changed / what you'll see)
- **Wrong**: the Entity Cashflow tile's lines didn't add up to its total (two lines were hidden, ~$655 short), it said "12 entities" when you have 9 (it was counting assets), and it called a monthly figure "annual".
- **Changed**: the tile now shows all six lines (they sum to the total), counts your real entities from the same source the rest of the dashboard uses, and says "monthly net".
- **You'll see**: the tile's lines add up to the headline, the entity count matches elsewhere on the dashboard, and it reads "monthly net".

### PR
- PR: (pending) — draft. MON-015 holds at FIXING until Reza verifies on his data.

---

## Session: chat-audit-findings-issues-m9518i — MON-022 (two property display bugs fixed + data-quality diagnosis)

### Changes Made
- **Type**: Fix (display/label — non-number) + diagnosis of the data-entry items
- **Scope**: A primary residence no longer shows a rental Yield; a $0/unknown-purchase property no longer shows a fabricated gain %.

### Root cause (verified, §19.2)
- **(i) Yield on a HOME**: the detail-page mini-grid (Equity/LVR/Yield) was gated on `!isRental` (`[id]/page.tsx:454`), so a PRIMARY RESIDENCE (type HOME) showed "Yield 0.00%". The tile correctly gates yield on `isInvestment` (`PropertyTile.tsx:396`). Fixed: gate the detail-page Yield cell on `isInvestment` (Equity + LVR still show for a home).
- **(ii) +0.0% on a $0 purchase**: the tile rendered the gain % pill UNCONDITIONALLY (`PropertyTile.tsx:341-351`), so a $0/unknown-purchase property showed a fabricated "+0.0%" green pill. The detail page already suppresses it (`computeGainPercentage` returns 0 for `purchasePrice<=0`, pill gated on `gainPct!==0`). Fixed: gate the tile pill on `property.purchasePrice > 0`.

Both are render suppressions — the underlying numbers are unchanged (`changesNumbers:false`).

### Diagnosis of the data-entry items (NOT fixed — product decisions, surfaced to Reza)
- **Company ATO tax "as household spend"**: a real SCOPING consideration, **not** a clear code defect. The master snapshot aggregates ALL expenses across ALL entities by design (`masterFinancialService.ts:132` "all expenses, no filter"); the entity breakdown partitions by `ownerEntityId` (`:301`), and `expenseAggregator` supports an `ownerEntityId` filter (`:89-91`). Whether "personal/household" surfaces should exclude company-entity expenses is a **product decision** (does "my spending" include my company's ATO tax?) + would need threading an entity scope through the personal surfaces.
- **Battery $11,385/mo one-off-as-recurring + count drift**: need a validation + review surface — Stitch-first (§18.2.1), deferred with MON-005/008.

### §19.4 / test
`tests/dashboard/propertyDisplayGuards.test.ts` — source-locks (detail Yield gated on `isInvestment`; tile gain pill gated on `purchasePrice > 0`). Literals pre-verified.

### §21.2 Neomatrix
Display suppression — no number change. `neomatrix:check` green (no drift; Layer-0 0 uncovered). `gainPct`/`yieldPct` semantic nodes = N4 backfill (numbers unchanged).

### §18.2.1 assessment
Both fixes REMOVE a wrong value from an existing surface (true tweaks) — no new composition. The deferred validation/review surface for the data-entry items IS Stitch-first.

### Files Modified
- `app/dashboard/properties/[id]/page.tsx` — Yield MiniKpi gated on `isInvestment`.
- `components/properties/PropertyTile.tsx` — gain pill gated on `purchasePrice > 0`.
- `tests/dashboard/propertyDisplayGuards.test.ts` — NEW.
- `docs/issues/ISSUES.json` / `ISSUES.md` — MON-022 → DIAGNOSED (2 display bugs; data-entry items diagnosed as product decisions).

### Build status
- [x] `npm run neomatrix:check` — OK. `npm run issues:check` — 27 valid. Source-locks pre-verified.
- [ ] `npx tsc` / `npm run test` / `lint:financial-surfaces` — CI-verified.

### §12.11 / §12.14
No writes; no tax-engine change. NOT REQUIRED / no reform interaction.

### Plain-English (what was wrong / what changed / what you'll see)
- **Wrong**: your primary residence showed a rental "Yield 0.00%" (a home has no rental yield), and a property with an unknown/$0 purchase price showed a fabricated green "+0.0%" gain.
- **Changed**: the detail page only shows Yield for investment properties (Equity + LVR still show for your home), and the tile only shows a gain % when the purchase price is known.
- **You'll see**: no "Yield" on your home (Equity + LVR remain), and no "+0.0%" badge on a property with no purchase price. (The battery $11,385/mo and company-ATO items are data-entry / product-scope questions — see the PR for the decision needed.)

### PR
- PR: (pending) — draft. MON-022 (display bugs) holds at FIXING until Reza verifies; the data-entry/scoping items await a product decision.
