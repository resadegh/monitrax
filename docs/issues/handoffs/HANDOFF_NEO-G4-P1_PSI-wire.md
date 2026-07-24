# CODE BRIEF (Fable 5) — Neo-G4 · P1: wire the PSI overlay into the live tax position

**Paste into a fresh Claude Code session on FABLE 5** (multi-entity tax core; **changesNumbers: yes, conditional**). First of the three Neomatrix-G4 unwired-overlay workstreams (see `docs/audits/NEO_G4_UNWIRED_TAX_ENGINES_PLAN.md`). Raise the MON issue first (`npm run issues:raise` — "PSI classifier built but unwired: personal-services income never attributed in the live tax position"), then build. MON-045-class rigor.

## 0. Boot ritual + hardened guardrails (FIRST, no exception)
1. `git clone`/`pull` → main → pull. Pin HEAD (`896951b`); cite `file:line`; re-verify anchors live.
2. Read `STATE.md` → `CLAUDE.md` (Part 0 laws, §12.2.1 SSOT, §12.14 reform-awareness, §19.2 worked example, §19.4 downstream sweep, §20.6 tri-axis, §21.2.2 neo-sync, §22 neo-inventory) → `MATRIX_FIX_DISCIPLINE.md` (8 gates) → the NEO_G4 plan → `lib/tax-engine/divisions/psiClassifier.ts` + `lib/tax-engine/orchestrator/masterTaxPosition.ts`.
3. **STEP-0 census (extend the Matrix's — mandatory):** confirm at source (a) that `buildMasterTaxPosition` step 3 (`:230-247`) does NOT call `classifyPsi` (only loss-rules + trust-deed validation are wired — verified); (b) the ONLY consumers of `classifyPsi` are `lib/calc-audit/` fixtures (proven, unwired); (c) HOW an entity's PSI inputs are available at the orchestrator (income by entity/source, largest-client, unrelated-client count — some may be UNCOMPUTED and must be flagged, not assumed); (d) whether PSI attribution belongs at the ENTITY position (masterTaxPosition, multi-entity) and/or the personal `getUserTaxPosition` path — wire where the income actually sits, and if BOTH assemble tax, both must see it (the MON-020 divergence lesson).

## The defect
`psiClassifier.ts:141` `classifyPsi(input: PsiInput): PsiClassificationResult` is a complete engine (80%-one-client test, unrelated-clients s87-20, results/premises/employment tests) but is **never called in prod** — so income that is really a reward for an individual's personal efforts earned through an entity is **not attributed to the individual** and PSI deduction restrictions are **not applied**. `buildMasterTaxPosition` (`:186`) documents it as a step-3 overlay (`:27`) but doesn't wire it. Product-wide: any user with personal-services income through an entity gets a wrong position today.

## The fix (wire the ONE producer into step 3 — both twins)
1. **Wire `classifyPsi` into `buildMasterTaxPosition` step 3** (`masterTaxPosition.ts` Float `:230` region) and `buildMasterTaxPositionDecimal` step 3 (`:503`) — as a per-entity overlay, exactly like the existing loss-rule/trust-deed overlays: build the `PsiInput` from the entity's income data, run the classifier, and apply its result (attribute PSI to the individual + restrict PSI deductions) to that entity's position. **UNCOMPUTED inputs** (e.g. connected-entity aggregation the classifier flags) are surfaced with the citation, NEVER silently defaulted.
2. **SSOT:** the classifier is the ONE producer of the PSI adjustment; no surface re-derives PSI. If both `getUserTaxPosition` and `masterTaxPosition` can carry an affected entity, both consume the same overlay (or masterTaxPosition is the single entity-tax producer the personal path reads — confirm at STEP-0 and wire once).
3. **Reform/config-aware** (§12.14): thresholds/tests read from config where they exist; no hard-coded law numbers without a config home.

## Ratchets (gates 1-3 + 8)
- **Ring-0 §19.2 worked examples:** (a) an entity failing the results test with 90% income from one client → PSI attributed to the individual, deductions restricted (fails on pre-fix code — currently $0 adjustment); (b) an entity passing the unrelated-clients test / results test → **no PSI attribution** (personal-services business); (c) a non-PSI entity (product sales) → **byte-unchanged**; (d) an UNCOMPUTED-aggregation case → flagged, not silently zeroed. Float === Decimal twin on every case.
- **Ring-1 source-lock:** one PSI producer; no surface recomputes it.
- **Ring-2 cross-surface:** the affected entity's taxable income + tax move identically on tax page ≡ /cashflow ≡ CFO (all read the one position); a non-PSI user's position is unchanged everywhere.
- **Neo-sync (gate 8):** flip `engine.tax.classifyPsi` from **unwired→wired** in Neomatrix, add the step-3 edge, close the G4-PSI gate warning; NeoAudit gets the goldens; Neobrain unaffected (not intake); nothing sandbox-only.
- **§19.4 downstream sweep** + **10/10 tri-axis self-review**; **Reza merges** (tax + number-changing, conditional).

## After merge → Matrix Ring-3 (VR-0NN)
The Matrix verifies live: for a user whose data triggers PSI, the position reflects the attribution + restriction identically across tax page / /cashflow / CFO, with the citations + any UNCOMPUTED flag visible; for a non-triggering user (e.g. Reza if his income isn't PSI) the tax numbers are byte-identical ($317,751 / $175,432 / $38,628 / $142,319 / $3,509). Then P2 (FTE/IEE) and P3 (Div 152) follow the same pattern.

---
*Prepared by The Matrix from the Neomatrix G4 audit + a live STEP-0 census (`896951b`). PSI is a built, calc-audit-proven engine never wired into the live position — the MON-045 pattern. Product-wide correctness; conditional number change; twins + citations + UNCOMPUTED flags mandatory.*
