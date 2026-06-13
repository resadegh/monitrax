# Changelog - 2026-06-13

## Session: gallant-gates-kb264m (continued) — trust spot-check fixes

### Driver — Reza spot-check (screenshots, 00:52 UTC)
*"I can't see any selection to nominate myself and Newsha as beneficiary with the ownership share percentage"* — on the wizard's "Who runs what" card for Renew Investment Family Trust.

### Diagnosis (two distinct things)
1. **Real gap — people weren't pickable in the wizard.** `RelationshipsStep` deliberately excludes PERSONAL_NAME from wizard entities and had no way to surface INDIVIDUALs — so neither "You" nor Newsha appeared as candidates for ANY role (his screenshot showed only companies; "Settlor: no-one to choose yet" was the giveaway).
2. **Working-as-the-law-intends — fixed percentages on discretionary beneficiaries don't exist.** In a family (discretionary) trust, beneficiaries hold eligibility, not shares; the split is decided by the trustee each FY via a distribution resolution (Div 6 / Bamford). The engine + API for resolutions shipped in Phase 44 Part 2a — but **no capture UI existed** (curl-only). That's the second real gap.

### Fixes
- **Wizard people candidates**: `RelationshipsStep` now fetches the user's PERSONAL_NAME ("You (name)") + INDIVIDUAL entities with their REAL ids and merges them into every role's candidate pool; `isIndividualType` accepts INDIVIDUAL; an inline "Add a person (e.g. your spouse)" quick-create POSTs an INDIVIDUAL and makes them immediately pickable. Sync unchanged (real ids pass `isPersistedId`).
- **`TrustDistributionsSection` (new)** on the trust Entity File (all distributing trust types): lists per-FY resolutions (status pill, "Reza 50% · Newsha 50%", net income), confirm-in-place for drafts, and the **"Record this year's split"** dialog — per-beneficiary % inputs prefilled equal from the trust's active BENEFICIARY_OF/UNITHOLDER_OF edges, live 100%-sum check, optional net-income estimate, "signed before 30 June" toggle (creates then CONFIRMs — drafts never drive tax numbers). Pure capture over the existing Part 2a service/API; no tax math in UI.
- **Teaching line** under Beneficiaries on discretionary trusts: *"Beneficiaries don't hold fixed shares in a family trust — the trustee decides each year's split. Record it under Distributions."*
- **Stitch (§18.2.1)**: new section designed first — screen `29d8f3b2ac3f43adae74e673bfde4995`, artefact `.stitch/designs/phase47-f2/trust-distributions-mobile-dark.{html,png}`.

### Verify
- tsc / eslint / financial gate green; 1,127 targeted tests green; `npm run build` passes. No schema change; writes via existing audited services only.

### §17.2 — PR #1095 (PR-2 feeds + audit fixes)
- Prod deploy reached `READY` (2026-06-13 ~00:15); corrected super caps + franking maths live.

---

## Session: ad2-implementation-dyaozo — Phase 47 Stage D AD-2 (stake & beneficial attribution)

### Driver
Continue Phase 47 Entity Ownership Fabric → Stage D addendum **AD-2** (binding per `PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` §14, approved by Reza 2026-06-12). PR-2 (the CGT/dividend attribution feed) had shipped, unblocking AD-2.

### Changes Made
- **Type**: Feature (tax data-assembly layer)
- **Scope**: `lib/services/entityTaxFactsAssembler.ts` + new `lib/services/ownershipAttribution.ts`
- **Description**: The assembler attributed income/expense FLAT by `ownerEntityId` — a jointly-held rental's income went 100% to one owner; a bare-trustee/LRBA asset's income stayed with the legal title holder. AD-2 wires the legal-interest split (TR 93/32) and beneficial-ownership redirect:
  - **TR 93/32 co-ownership split** — `OwnershipGroup` + `OwnershipStake`: joint tenants split equally (survivorship, not fractions); tenants-in-common follow `sharePct`. Co-owner weights sum to exactly 1 (additivity preserved).
  - **Beneficial ownership** — `BeneficialOwnershipOverride` (bare-trust / nominee / custodian / LRBA): income + deductions follow the BENEFICIAL owner; the legal title holder is excluded (flagged, never silent).
  - **Honesty fall-back** — an uncomputable TIC split (shares missing / not summing to 100%) reverts to flat-by-legal-owner + `UC-OWNERSHIP-SPLIT-UNKNOWN`; never a guessed split.
  - The assembler now pulls income/expense on assets the entity CO-OWNS or BENEFICIALLY owns (not just `ownerEntityId === entity`), scales every row by its weight, dedups by id, and seeds `assemblerNotes` with the deduped flags.
- **Additive guarantee**: an entity with no group/override on any asset receives byte-for-byte the prior flat mapping (every weight = 1). Verified by the 924-test suite staying green.
- **Blast radius**: `assembleEntityTaxFacts` is consumed only by `GET /api/tax/entity/[entityId]` (per-entity tax page + Stage E reports). The household orchestrator (`masterTaxPosition`) is fed elsewhere — unaffected.

### Files Modified / Created
- `lib/services/ownershipAttribution.ts` (NEW) — pure decision core (`attributeAsset`, `isActiveInFy`).
- `lib/services/entityTaxFactsAssembler.ts` — `loadAttributedIncomeExpense` + pure `resolveIncomeAssetKey` / `resolveExpenseAssetKey`; flat pull replaced with the attributed pull.
- `tests/tax-engine/ownershipAttribution.test.ts` (NEW) — 23 tests (flat/JT/TIC/override/defensive + asset-key resolvers).
- Docs: `PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` §14 AD-2 → ✅; `PHASE_47_ENTITY_OWNERSHIP_FABRIC.md` Stage D + D6; `IMPLEMENTATION_PLAN.md`.

### Build Status
- [x] `tsc --noEmit` — 0 errors
- [x] Targeted tests — `tests/tax-engine` + `tests/ownership` = 924 passed; new attribution suite = 23 passed
- [x] `npm run build`

### §12.14 reform compliance
- Functions touched: `attributeAsset`, `loadAttributedIncomeExpense`, `resolveIncome/ExpenseAssetKey` — outcome **(b)**: regime-neutral DATA ASSEMBLY (computes an attribution fraction, not a tax number). TR 93/32 co-ownership splits apply identically pre/post the 2026-27 reform; no post-reform math branch introduced; no `Property`/`Investment`/`LegalEntity` column added. No existing tax-engine test regressed.

### §12.11 / §12.12
- No destructive Prisma writes (read-only assembler + new pure module). No `prisma/schema.prisma` change → no migration.

---

## Session: ad2-implementation-dyaozo — Phase 47 Stage E1 (per-entity report sections)

### Driver
After AD-2 merged (#1097), Reza chose Stage E — per-entity reports — as the next increment. Stage E1 spec (`PHASE_47_ENTITY_OWNERSHIP_FABRIC.md` §Stage E): *"contextBuilder partitions by entity; financial-overview + tax-time reports gain per-entity sections (entity name, type badge, holdings, net position, engine-computed tax position or honest UNCOMPUTED)."*

### Changes Made
- **Type**: Feature (reporting layer, additive)
- **Scope**: `lib/reports/*` (contextBuilder + financial-overview + tax-time generators)
- **Description**: The financial-overview and tax-time reports now carry a **Per-Entity Breakdown** section — one row per entity (warm type badge, net position, monthly cashflow, holdings count, tax status), totals that reconcile to the household figure, plus a deduped **Per-Entity Tax Notes** block listing every engine caveat in plain English (including AD-2's TR 93/32 split / beneficial-redirect flags).
  - **Net position is SSOT** — read from the master snapshot `byEntity` (the same canonical engines the dashboard uses), never re-aggregated.
  - **Tax status is honest** — `computed` vs caveat list from the per-entity tax engine (`assembleEntityTaxFacts` + `calculateEntityTaxPositionDecimal`). We deliberately do NOT quote a tax dollar from the engine's type-varied `result: unknown` (guessing a field name would risk false precision — financial-adviser lens).
  - **Progressive disclosure** — the section is hidden below 2 entities (a one-entity household's per-entity table would just restate the totals).
- **Additive**: no schema change, no new endpoint, no change to existing report sections; the new section only appears when ≥2 entities hold assets.

### Files Modified / Created
- `lib/reports/types.ts` — `EntityTaxStatus`, `EntityReportData`, `ReportContext.entityBreakdown`.
- `lib/reports/contextBuilder.ts` — `fetchEntityBreakdown` (master-snapshot byEntity + per-entity tax status); wired into financial-overview + tax-time.
- `lib/reports/generators/entityBreakdownSection.ts` (NEW) — pure shared section builder (table + caveat notes).
- `lib/reports/generators/financialOverview.ts` + `taxTime.ts` — render the section.
- `tests/reports/entityBreakdownSection.test.ts` (NEW) — 8 tests.
- Docs: `PHASE_47_ENTITY_OWNERSHIP_FABRIC.md` Stage E1; `IMPLEMENTATION_PLAN.md`.

### Build Status
- [x] `tsc --noEmit` — 0 errors
- [x] `tests/reports` + `tests/ownership` + `tests/tax-engine` = 932 passed (8 new)
- [x] `eslint` clean on changed files
- [x] `npm run build`

### §12.11 / §12.12 / §12.14
- No destructive Prisma writes (read-only report builder). No schema change → no migration. No tax-engine function modified (consumes existing engine output) → no §12.14 reform surface.

---

## Session: ad2-implementation-dyaozo — Phase 47 Stage E2 (universe tax-flow overlay)

### Driver
After E1 merged (#1098), Reza chose to continue → Stage E2, completing Stage E. Spec: *"extend the existing Money Flow lens with the Stage-D tax treatments (per-flow regime already renders; add per-entity tax-position badges to entity tiles)."* §18.2.1 design-process decision (Reza, this session): **code-first + Stitch backfill** (the badge extends the already-shipped per-flow tax overlay + reuses the canvas's emerald/amber vocabulary).

### Changes Made
- **Type**: Feature (in-app design overlay, additive)
- **Scope**: Wealth Explorer canvas (`/dashboard/wealth-explorer`) Money Flow lens
- **Description**: Each entity tile now shows a per-entity **tax-position pip** when the Money Flow lens is active — **emerald ✓** (computed, no caveats) or **amber N** (N items pending/assumed, reusing the canvas's reform-amber). A toolbar **legend pill** ("N computed · N to review") decodes them.
  - **Engine-backed, SSOT-aligned** — `wealthGraphService` computes per-entity `taxStatus` via the same `assembleEntityTaxFacts` + `calculateEntityTaxPositionDecimal` path the reports (E1) + per-entity tax page use, so the canvas badge never disagrees with those surfaces. Computed in parallel across entities (§12.10).
  - **Honest** — status only (`{ computed, caveatCount }`); the engine's type-varied `result` (a tax dollar) stays server-side — no false precision on the pip (§0.3).
  - **Additive** — no schema change, no new endpoint. The `entity.read`-gated `/api/wealth-graph` now also carries the status; since no tax figure is returned, no `tax_data.read` escalation is needed.

### Files Modified
- `lib/services/wealthGraphService.ts` — `EntityTaxStatusSummary` + `WealthGraphEntity.taxStatus`; parallel per-entity computation.
- `lib/data/wealthExplorerTypes.ts` — `WealthNode.taxStatus`.
- `lib/data/wealthExplorerLayout.ts` — carry `taxStatus` onto entity nodes.
- `components/wealth-explorer/WealthUniverseCanvas.tsx` — tile pip (Money Flow lens only) + legend pill + JSDoc with Stitch screen ref.
- `tests/wealth-explorer/semanticZoomLayout.test.ts` — 2 pass-through tests.
- `.stitch/designs/phase47-e2/wealth-universe-tax-flow-overlay.{html,png}` (NEW) — §18.2.1 backfill, screen `8e2871ee0fc64e78a5361d86155c66eb` (project `1859462351962811110`).
- Docs: `PHASE_47_ENTITY_OWNERSHIP_FABRIC.md` Stage E2 ✅; `IMPLEMENTATION_PLAN.md` Stage E COMPLETE.

### Build Status
- [x] `tsc --noEmit` — 0 errors
- [x] `tests/wealth-explorer` 27 + `tests/wealth-graph`/`ownership`/`reports` green
- [x] `eslint` clean on changed files
- [x] `npm run build`

### §18.2.1 / §16 / §12.x
- Stitch backfill committed in this PR (screen ID in component JSDoc) — §18.2.1 satisfied.
- No destructive Prisma writes; no schema change → no migration. No tax-engine function modified (consumes existing engine output) → no §12.14 reform surface.
