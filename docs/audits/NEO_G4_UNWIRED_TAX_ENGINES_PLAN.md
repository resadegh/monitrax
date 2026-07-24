# PLAN — Neomatrix G4: wire the 3 built-but-unwired tax overlays (+ the other neo-integrity gaps)

**Owner:** The Matrix (plan + census + Ring-3) · Code/Fable 5 (build) · Reza (schema/scope sign-off, merges) · **Source:** the 2026-07-14 Neomatrix full-alignment audit (G1–G7) + 2026-06-25 coverage-gap audit. **HEAD `896951b`.**

This documents the highest-value remaining work as a tracked plan and starts it per the FIX_PROTOCOL process (STEP-0 census → wire at the canonical producer → Float/Decimal twins → ratchets → cross-surface Ring-3). Each item below is a MON issue to `issues:raise` (Code-side) — the Matrix files the finding, Code raises + builds, Matrix verifies.

## STEP-0 census (verified at `896951b` — the shared finding for all three)
`lib/tax-engine/orchestrator/masterTaxPosition.ts` `buildMasterTaxPosition` (`:186`) + `…Decimal` (`:458`) **document** step 3 as *"Per-entity advanced overlays — Div 152 SBC, PSI, FTE/IEE … with the overlay's citations + UNCOMPUTED flags"* (`:27-30`), **but the actual step-3 code only wires the loss-rule overlays (`:230`) + the trust-deed validation overlay (`:247`)** — the three engines below are **never called**. Their only consumers are `lib/calc-audit/` fixtures (`tax-divisions.ts`, `decimal-tax-engine-beneficiary-concessions.ts`) — proven in the shadow harness, unwired in prod. This is the MON-045 pattern (a built engine that never reached the live position). They are **product-wide** correctness overlays — each fires conditionally on the entity's real data, so wiring them is correct for all users regardless of whether Reza's own data triggers them.

## The three workstreams (each its own PR, MON-045-class rigor; recommended order)

### P1 — PSI (personal services income) · `lib/tax-engine/divisions/psiClassifier.ts:141` `classifyPsi`
- **Fires on:** ordinary income that is mainly a reward for an individual's personal efforts/skills earned through an entity — the broadest trigger (not gated on a CGT event or a trust), so highest likelihood of firing for operating users. Trigger inputs: `totalPsiIncome`, `incomeFromLargestClient` (80%-one-client test), unrelated-clients test (s87-20), + results/business-premises/employment tests.
- **Effect if it fires:** PSI is attributed to the individual (not retained in the entity), and PSI deductions are restricted — changes taxable income. **changesNumbers: yes (conditional).**
- **Recommended first** — broadest applicability + fires on ordinary income.

### P2 — FTE/IEE (family-trust / interposed-entity distributions) · `lib/tax-engine/divisions/fteIeeClassifier.ts:166` `classifyFteIeeDistributions`
- **Fires on:** distributions from a family-trust-election trust; distribution OUTSIDE the family group → **47% TFN/family-trust distribution tax** (highest per-event stakes); s100A / PCG 2022/2 low-risk classification.
- **Effect:** a mis-directed distribution attracts 47% — material. Only relevant where a discretionary/family trust distributes (Reza operates ReNew Holding Pty Ltd + Renew Super SMSF — a company + a fund, not a discretionary trust, so this may not fire for him; still correct product-wide).
- **Second** — highest stakes, narrower trigger.

### P3 — Div 152 (small-business CGT concessions) · `lib/tax-engine/divisions/div152SmallBusinessConcessions.ts:150` `applyDiv152` (+ `…Decimal:355`)
- **Fires on:** a capital GAIN (after the Div 115 50% discount) where MNAV < $6M or turnover < $2M — i.e. only on a CGT EVENT (business/active-asset sale). Episodic, not ongoing.
- **Effect:** the 15-year exemption / 50% active-asset reduction / retirement exemption / rollover can zero or halve a gain — large but only on a sale.
- **Third** — highest single-event value, rarest trigger.

## Wiring pattern (same for all three — the brief spells it per engine)
Wire into `buildMasterTaxPosition` step 3 as a **per-entity overlay** (both Float + Decimal twins), reading the entity's real inputs, emitting the overlay result + **citations + UNCOMPUTED flags** where v1 doesn't aggregate connected entities (the engines already carry those flags — surface them, never silently assume). SSOT: the overlay is the ONE producer of its adjustment; no surface re-derives. Ratchets: Ring-0 worked examples per engine (fires / doesn't-fire / UNCOMPUTED boundary) + Ring-2 the overlay changes the entity position identically on both twins + a "non-triggering entity is byte-unchanged" lock. Neo-sync: model each overlay node + the step-3 edge, flip its Neomatrix status from unwired→wired, close the G4 gate warning. **Reza merges** (tax + number-changing).

## The other neo-integrity gaps (tracked here, sequenced after P1)
- **G2 — Neomatrix drift sentinel (astHash binding).** 155 semantic nodes not bound to an `astHash`; arming it flips the A2 warning to a **red build** when a formula body changes without its node — the integrity lever that protects every verified fix from silent regression. Extend `neomatrix:generate` to compute `astHash` per bound symbol. *(G1 graphify-refresh is its sibling and needs the offline graphify binary → a local/desktop Code session.)*
- **Scenario/what-if modelling gap** (2026-06-25 audit): ~1 of ~20 scenario engines modelled; Float/Decimal pairs without a shared `semanticKey` so A3 can't detect drift. Model the `lib/cfo/scenarios/**` family + assign semanticKeys so the twins converge under A3. High decision-impact surface, thinnest coverage.

## Lower-severity backlog (unchanged, smaller)
MON-006 (cashflow cash-vs-tax basis label), MON-047 (dead `calculateMonthlyProgressNetWorth` cost-basis), MON-049 (document-count mismatch). MON-088 follow-ups: estimate-caller cover consumption; FY-config refresh (family MLS base → $202k). Reza-side: MON-091 write-checks; Housekeeping dark/mobile Stitch backfill.

## Process from here
1. **Code raises** three MON issues (PSI / FTE-IEE / Div152 unwired-overlay) + this plan lands in `docs/audits/`.
2. **Fable 5** builds P1 (PSI) per the delivered STEP-0 brief → Reza merges → **Matrix Ring-3** (VR-0NN) → then P2, P3.
3. G2 (astHash) + scenario modelling run as their own neo-integrity PRs after P1.

---
*Prepared by The Matrix from the Neomatrix full-alignment audit (G4) + a live STEP-0 census (`896951b`). Product-wide tax-correctness overlays, MON-045-class each; PSI first (broadest trigger). All documented for `issues:raise`; nothing sandbox-only.*
