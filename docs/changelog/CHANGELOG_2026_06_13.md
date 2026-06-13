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
