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
