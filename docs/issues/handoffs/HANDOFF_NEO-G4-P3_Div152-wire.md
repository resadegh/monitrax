# CODE BRIEF (Fable 5) — Neo-G4 · P3: wire the Div 152 overlay into the live tax position

**Paste into a fresh Claude Code session (executed on the Code session regardless of the model header — Reza ruling 2026-07-23). changesNumbers: yes (conditional).** The THIRD and LAST of the Neo-G4 unwired-overlay workstreams — the exact mirror of MON-097 (PSI, #1497 merged) and P2 (FTE/IEE, brief delivered). **Milestone: this closes the A6 island list to EMPTY — every built tax engine reaches the live position.** Raise the MON issue first (`npm run issues:raise` — "Div 152 small-business CGT concessions built but unwired: active-asset capital gains never get the 15-year exemption / 50% active-asset reduction / retirement exemption / rollover in the live tax position"), then build. MON-097-class rigor.

## §0 Standing corrections (carry until the template updates)
1. **Stitch routing:** all Stitch design passes run in THIS Code session (Fable 5) — §18.8 ≥9/10 self-review + final design to Reza. Never route design generation to the desktop/Matrix session.
2. **Model routing:** briefs execute in the Code session regardless of the header.

## 0. Boot ritual + hardened guardrails (FIRST, no exception)
1. `git clone`/`pull` resadegh/monitrax → main → pull. Pin HEAD (`35ec86f6` or later if P2 has merged — re-pin live); cite `file:line`; re-verify anchors live.
2. Read `STATE.md` → `CLAUDE.md` (Part 0 laws, §12.2.1 SSOT, §12.14 reform-awareness, §19.2 worked example, §19.4 downstream sweep, §20.6 tri-axis, §21.2.2 neo-sync, §22 neo-inventory) → `MATRIX_FIX_DISCIPLINE.md` (8 gates) → `docs/audits/NEO_G4_PLAN_unwired-tax-engines.md` → **the MON-097 PSI diff + the P2 FTE/IEE diff as templates** (`masterTaxPosition.ts:287-292` Float / `:579-584` Decimal — the overlays you mirror) → `lib/tax-engine/divisions/div152SmallBusinessConcessions.ts`.
3. **STEP-0 census (extend the Matrix's — mandatory):** confirm at source (a) `buildMasterTaxPosition` step 3 wires loss-rules + trust-deed + PSI (+ FTE/IEE once P2 lands) but NOT `applyDiv152`; (b) the ONLY prod-path consumer of `applyDiv152` is `lib/calc-audit/` (proven in the shadow harness, unwired in prod — the MON-045/097 pattern); (c) HOW a Div 152 input reaches the orchestrator — a **CGT event** on an active asset: capital gain (post-Div 115 50% discount), max-net-asset-value or aggregated-turnover figure, active-asset test, holding months, retirement-exemption-used-to-date, 55+/incapacitated flag — most are UNCOMPUTED today (flag, never assume); (d) **reachability (load-bearing — the census gap 2):** `/api/tax/entity/[entityId]` bypasses `buildMasterTaxPosition`. **If P2 already routed the entity API through the orchestrator, confirm P3 rides it; if P2 deferred, decide here** — either route it through, or document explicitly that all overlays stay tool/test-only until the capture feature ships. State the decision in the PR body.

## The defect
`div152SmallBusinessConcessions.ts:150` `applyDiv152(input: Div152Input): Div152Result` is a complete engine — basic conditions (MNAV ≤ $6M `MNAV_THRESHOLD` OR aggregated turnover ≤ $2M, active asset), **s152-105 15-year exemption** (gain entirely disregarded), **50% active-asset reduction**, **retirement exemption** (lifetime cap, honours `retirementExemptionUsedToDate`), **rollover** — but it is **never called in prod**. `buildMasterTaxPosition` documents step 3 as a Div 152 overlay (`:27-34`) but doesn't wire it. Product-wide: any user with a small-business active-asset capital gain gets NO small-business CGT concession applied — their gain is over-taxed.

## The fix (mirror MON-097 / P2 exactly — wire the ONE producer into step 3, both twins)
1. **Float** — in `buildMasterTaxPosition` step 3, after the PSI block (and the FTE/IEE block once P2 lands), add the Div 152 overlay in the identical shape:
   ```
   if (input.div152ByEntity) {
     crossCutting.div152ByEntity = {};
     for (const [entityId, d152Input] of Object.entries(input.div152ByEntity)) {
       crossCutting.div152ByEntity[entityId] = applyDiv152(d152Input);
     }
     modulesInvoked.push('div152SmallBusinessConcessions');
   }
   ```
2. **Decimal** — mirror in `buildMasterTaxPositionDecimal` (the `applyDiv152Decimal` twin, ~`:355`), same comment precedent (pure number math on plain inputs; report its dollar figure; reuse the result type — the trustDeedValidation/PSI/FTE-IEE precedent).
3. **Types:** add `div152ByEntity?: Record<string, Div152Input>` to the input type (alongside `psiByEntity` `:144`/`:461`) and `div152ByEntity?: Record<string, Div152Result>` to `crossCutting` (alongside `:175`).
4. **Surface, never default:** aggregate the concession dollar figures (15-year / active-asset-reduction / retirement-exemption applied) + citations (ITAA 1997 s152-10/15/105/205/305, Subdiv 152-C/D/E) + any UNCOMPUTED flag (connected-entity aggregation for MNAV/turnover) to the top level — mirror the PSI aggregation (`:381`/`:676`). A naked default is NOT a classification — omit + flag.
5. **SSOT:** the classifier is the ONE producer of the Div 152 adjustment; no surface re-derives. **Reform/config-aware (§12.14):** MNAV_THRESHOLD/turnover/retirement-cap read from the engine's constants/config, never a fresh hard-code.

## Ratchets (gates 1-3 + 8) — mirror `tests/tax/mon097PsiOverlay.test.ts`
- **Ring-0 §19.2 worked examples** in `tests/tax/mon0NNDiv152Overlay.test.ts` (RED pre-fix): (a) active-asset sale, MNAV < $6M, held 15+ yrs, 55+/retiring → **15-year exemption, gain entirely disregarded**; (b) MNAV < $6M, < 15 yrs → **50% active-asset reduction** (on top of the Div 115 50% discount); (c) MNAV > $6M AND turnover > $2M → **NO concession, gain unchanged**; (d) UNCOMPUTED (connected-entity aggregation near threshold) → flagged, not zeroed. **Float === Decimal** on every case; **absent `div152ByEntity` = byte-identical output** (the inertness lock).
- **Ring-1 source-lock:** one Div 152 producer; no surface recomputes it.
- **Ring-2 cross-surface:** an affected entity's gain/tax move identically on tax page ≡ /cashflow ≡ CFO; a non-triggering user is byte-unchanged everywhere.
- **Neo-sync (gate 8):** remove `engine.tax.div152.applyDiv152` from `A6_ISLAND_ALLOWLIST` (`scripts/neomatrix/graphlib.mjs:201`) — **this empties the allowlist (→ A6 fully clean, every built tax engine wired)**; add the `feeds` edge `engine.tax.div152.applyDiv152` → `buildMasterTaxPosition` with the WIRED authority note (financial-graph.json, mirror the PSI node `:4479`/edge `:9813`); re-pin orchestrator anchors; `neomatrix:check` green. NeoAudit gets the goldens; Neobrain unaffected.
- **§19.4 downstream sweep** + **§20.6 10/10 tri-axis self-review**; **Reza merges** (tax + number-changing, conditional).

## After merge → Matrix Ring-3 (VR-0NN) — READ THIS BASELINE
By census, Div 152 fires only on a **CGT event on an active small-business asset** — episodic, the rarest trigger. Reza has **no such disposal**, so this overlay is expected **inert on his data** (the fire path is proven by the Ring-0 worked examples + CI, not his live numbers).

**⚠️ Inertness baseline is the POST-DEPRECIATION one (VR-029/030/031), NOT the old VR-028 numbers.** The live tax cluster is:
- **Total Deductions $172,325 · Taxable Income $145,426 · Tax Owing $26,926 · Net Tax Payable $38,054 · Medicare $2,909 · Total Income $317,751**, converged tax page ≡ /cashflow ≡ CFO.

The Matrix verifies: for a non-triggering user (Reza) the cluster is **byte-identical to the above** with **no Div 152 concession line surfacing**; any movement = FAIL, raise immediately. (Do NOT reuse the stale $142,319 / $175,432 / $49,756 baseline — that pre-dates the depreciation entries; that stale-baseline trap was caught in VR-029.)

## Milestone + follow-ups
- With P3 merged the **A6 island list is empty** — record it in the Neomatrix audit as the Neo-G4 completion.
- Then: **PSI/FTE-IEE/Div152 capture feature** (schema + assembler + UI — Stitch-first, this Code session) — until it ships all three overlays stay inert by construction; **s86-60 PSI net-attribution sub-PR**; **G2 astHash drift sentinel** (needs the offline graphify binary → desktop session); **scenario/what-if modelling** coverage; MON-088 estimate-caller cover consumption; FY-config family MLS base → $202k.

---
*Prepared by The Matrix from the Neo-G4 plan + a live STEP-0 census (`35ec86f6`) + the MON-097/P2 templates. Div 152 is a built, calc-audit-proven engine never wired into the live position — the MON-045/097 pattern; the last one. Conditional number change (small-business CGT concessions on an active-asset gain); twins + citations + UNCOMPUTED flags mandatory; inertness verified against the post-depreciation VR-029 baseline; wiring it empties the A6 island allowlist.*
