# CODE BRIEF (Fable 5) — MON-088: wire the family Medicare levy / surcharge legs

**Paste into a fresh Claude Code session on FABLE 5** (tax-facing, **changesNumbers: yes**). Completes the tax engine's Medicare correctness — the last diagnosed tax lever after MON-020/060/094/045. The machinery already exists; it is simply never fed the family inputs.

## 0. Boot ritual + hardened guardrails (FIRST, no exception)
1. `git clone`/`pull` resadegh/monitrax → main → pull. Pin HEAD (`b927208`); cite `file:line`; re-verify anchors live.
2. Read `STATE.md` → `CLAUDE.md` (Part 0 laws, §12.2.1 SSOT, §12.11/§12.12 schema-change approval, §12.14 reform-awareness, §19.2 worked example, §20.6 tri-axis, §21.2.2 neo-sync) → `MATRIX_FIX_DISCIPLINE.md` → the MON-088 registry entry → `lib/tax-engine/core/medicareLevyCalculator.ts` + `taxPositionCalculator.ts`.
3. **STEP-0 census FIRST (mandatory):** trace what the Medicare number is *today*. The live tax page shows Medicare Levy **$3,509** on taxable $175,432 = exactly **2.0% base levy** — i.e. **no surcharge (MLS) is currently in the number**. Confirm at source whether MLS is computed-and-zero (because `hasPrivateHealthInsurance` defaults truthy, or the surcharge branch isn't wired into the returned total) or not computed at all. Judge the fix against the CURRENT behaviour, not an assumption.

## The defect (verified at HEAD `b927208`)
- `medicareLevyCalculator.ts` **already accepts** `familyStatus ('SINGLE'|'FAMILY')`, `spouseIncome`, `dependentChildren`, `hasPrivateHealthInsurance` (`:5-9`) and applies the family threshold + per-child increase (`:47-50`).
- **The one caller passes only `{ taxableIncome }`** — `taxPositionCalculator.ts:299` `calculateMedicareLevy({ taxableIncome }, fyConfig)` → every position defaults to **SINGLE / no dependants / (PHI default)**. So a couple is assessed against the **$101k single MLS threshold** instead of the **$202k family** threshold (2025-26, +$1,500/child after the first), the low-income levy reduction never uses family figures, and PHI is never considered.
- **Law (do not re-derive marginal rates):** AU has no joint return — marginal income-tax rates are ALWAYS individual and spouse income NEVER changes them. Family/spouse income changes ONLY: the **MLS combined-income threshold**, the **Medicare levy family reduction** (low-income), and **PHI-rebate tiers**. This fix touches Medicare only — do not touch `calculateIncomeTax`.

## Reza's inputs (confirm before merge — they drive the number)
- **Private hospital cover?** MLS does not apply to anyone with an appropriate level of private *hospital* cover. Monitrax does not capture this yet. **DECISION + DATA:** does Reza (and/or Newsha) hold private hospital cover for the FY? 
- **Dependants:** confirm `HouseholdProfile.childrenCount` reflects dependent children for MLS (+$1,500 threshold per child after the first).
- **Spouse:** Newsha's taxable income is the spouse income for Reza's MLS combined figure (and vice-versa).

## The fix
1. **Add a private-hospital-cover input.** `HouseholdProfile` (or `HouseholdMember`) gains `hasPrivateHospitalCover Boolean @default(false)` — **additive migration, needs Reza's §12.11/§12.12 approval** (do NOT run without it). Add the control to the household-profile form. Default `false` (conservative: MLS applies if over-threshold without cover). *(If Reza prefers not to add schema now, gate the wiring on a safe default and note it — but the correct fix captures it.)*
2. **Feed the household call.** At `taxPositionCalculator.ts:299`, pass `familyStatus` (FAMILY when `adultsCount ≥ 2` / a spouse member exists), `dependentChildren: childrenCount`, `spouseIncome`, `hasPrivateHealthInsurance` — sourced from `HouseholdProfile`. Thread the profile into `calculateTaxPosition` inputs (both assembly paths — `getUserTaxPosition` AND `/api/tax/position` — must pass it, or the Tax page diverges; the MON-020 lesson).
3. **Per-member (Part A #1461).** In `userTaxPosition.ts` `perMember` (`:246`), each member's MLS uses the **combined** family income (self + spouse) and shared dependants — Part A already exposes each member's income to the other, so no new fetch. Each member's base 2% levy stays on their own taxable income; only the SURCHARGE leg uses combined income + PHI.
4. **Reform/config-aware:** read thresholds from `fyConfig.medicareThresholds` (already there) — no hard-coded numbers.

## Ratchets (gates 1-3 + 8)
- **Ring-0/§19.2 worked examples:** (a) a couple with combined income just under $202k + no PHI → **no MLS** (was wrongly applied as SINGLE >$101k); (b) combined over $202k + no PHI → MLS at the correct tier; (c) PHI held → MLS $0 regardless; (d) +1 dependent child raises the family threshold by $1,500; (e) a genuine single is unchanged. Float === Decimal twin.
- **Ring-1 source-lock:** ONE Medicare producer; no surface re-computes MLS.
- **Ring-2 cross-surface:** tax page ≡ /cashflow FY estimate ≡ CFO all read the one `getUserTaxPosition` Medicare figure; per-member positions consistent.
- **Neo-sync (gate 8):** model the family-input lineage on `service.tax.getUserTaxPosition` + `calculateMedicareLevy`; Neobrain updated (household → Medicare); NeoAudit gets the goldens; nothing sandbox-only.
- **10/10 self-review**; the PHI/dependants inputs confirmed by Reza; **Reza merges** (tax + schema).

## Cross-surface Ring-3 (gate 4 — Matrix, after merge)
The Matrix verifies live: with Reza's real household (Reza + Newsha + dependants + PHI answer), the Medicare figure moves correctly — MLS applied/removed per the family threshold + PHI — identically on tax page ↔ /cashflow ↔ CFO; per-member positions each show the right levy; base levy on taxable income unchanged where it should be; income tax + deductions untouched. Run id `VR-0NN`.

---
*Prepared by The Matrix from the MON-088 census (§19.2-verified). The Medicare calculator already supports family/spouse/dependants/PHI — the fix feeds it from HouseholdProfile at both engine paths + per-member. Medicare-only; income-tax rates untouched (no joint AU return). Schema add (PHI) needs Reza's §12.12 approval.*
