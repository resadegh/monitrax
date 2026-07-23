# CODE BRIEF (Fable 5) — MON-088: capture family/private-health data + wire the Medicare levy/surcharge legs (ALL USERS)

**Paste into a fresh Claude Code session on FABLE 5** (tax-facing, **changesNumbers: yes**). Completes the tax engine's Medicare correctness for **every Monitrax user**, not a data patch for one household. The Medicare engine already supports the family legs; two things are missing product-wide: (1) Monitrax doesn't **capture** whether a user holds private hospital cover, and (2) the engine is never **fed** the family inputs it already accepts. Build both as first-class features.

## 0. Boot ritual + hardened guardrails (FIRST, no exception)
1. `git clone`/`pull` resadegh/monitrax → main → pull. Pin HEAD (`b927208`); cite `file:line`; re-verify anchors live.
2. Read `STATE.md` → `CLAUDE.md` (Part 0 laws, §12.2.1 SSOT, §12.11/§12.12 schema-change approval, §18.2.1 **Stitch-first for the new form control**, §19.2 worked example, §20.6 tri-axis, §21.2.2 neo-sync) → `MATRIX_FIX_DISCIPLINE.md` → the MON-088 registry entry → `lib/tax-engine/core/medicareLevyCalculator.ts` + `taxPositionCalculator.ts` + the `HouseholdProfile`/`HouseholdMember` models + the household-profile form.
3. **STEP-0 census FIRST (mandatory):** trace what the Medicare number is *today* for a representative user. The live tax page shows Medicare Levy **$3,509** on taxable $175,432 = exactly **2.0% base levy** — i.e. **no surcharge (MLS) is in the number**. Confirm at source whether MLS is computed-and-zero (PHI defaults truthy, or the surcharge branch isn't folded into the returned total) or simply never computed. Judge the fix against the CURRENT behaviour.

## The defect (verified at HEAD `b927208`) — a product-wide gap, not one household
- `medicareLevyCalculator.ts` **already accepts** `familyStatus ('SINGLE'|'FAMILY')`, `spouseIncome`, `dependentChildren`, `hasPrivateHealthInsurance` (`:5-9`) and applies the family threshold + per-child increase (`:47-50`).
- **The one caller passes only `{ taxableIncome }`** — `taxPositionCalculator.ts:299` → **every user's** position defaults to SINGLE / no dependants / (PHI default). So any coupled user is assessed against the **$101k single MLS threshold** instead of **$202k family** (2025-26, +$1,500/child after the first), the low-income family reduction never applies, and PHI is never considered — for all users.
- **`HouseholdProfile` already captures** `adultsCount`, `childrenCount`, `childrenAges[]`, and `members[]` (each with income via Part A #1461) — so **family status, spouse income, and dependants are already available for every user**. The ONLY missing capture is **private hospital cover**.
- **Law (do not re-derive marginal rates):** AU has no joint return — marginal income-tax rates are ALWAYS individual and spouse income NEVER changes them. Family/spouse income changes ONLY the **MLS combined-income threshold**, the **Medicare levy family reduction**, and **PHI-rebate tiers**. Medicare-only fix; do NOT touch `calculateIncomeTax`.

## The fix — build it for all users

**A. CAPTURE private hospital cover (the missing product data — for everyone).**
- Add `hasPrivateHospitalCover Boolean @default(false)` to **`HouseholdMember`** (per-adult — each person's MLS liability turns on their *own* cover) with a household-level derivation where needed. Additive migration → **needs Reza's §12.11/§12.12 approval** before running.
- Add the input to the **household-profile / members form** as a first-class control ("Private hospital cover?" per adult) — this is a **UI change, so it goes through Stitch design-first (§18.2.1)**: the Fable session runs the Stitch pass itself (generate → self-review >9/10 → present to Reza for approval), THEN builds the React control. Every user fills this in; nothing is hardcoded.
- Sensible default `false` (conservative: MLS applies if over-threshold without cover) + a clear "not sure / not entered" state so a blank doesn't silently assert cover.

**B. FEED the engine (both paths — for everyone).**
- At `taxPositionCalculator.ts:299`, pass `familyStatus` (FAMILY when `adultsCount ≥ 2` / a spouse member exists), `dependentChildren: childrenCount`, `spouseIncome`, `hasPrivateHealthInsurance` — all sourced from the user's `HouseholdProfile`/members. Thread the profile into `calculateTaxPosition` inputs on **BOTH** assembly paths — `getUserTaxPosition` AND `/api/tax/position` — or the Tax page diverges (the MON-020 lesson).
- **Per-member (Part A #1461):** in `userTaxPosition.ts` `perMember` (`:246`), each member's MLS uses the **combined** family income (self + spouse) + shared dependants + that member's own PHI flag. Base 2% levy stays on each member's own taxable income; only the SURCHARGE leg uses combined income + PHI.
- Config-driven: read thresholds from `fyConfig.medicareThresholds` (already present) — no hard-coded numbers; reform-aware per §12.14.

## Ratchets (gates 1-3 + 8)
- **Ring-0/§19.2 worked examples (generic users, not Reza's data):** (a) couple, combined < $202k, no cover → **no MLS** (was wrongly applied as SINGLE >$101k); (b) combined > $202k, no cover → MLS at the correct tier; (c) either partner holds cover → that partner's MLS $0; (d) +1 dependent child raises the family threshold by $1,500; (e) a genuine single is unchanged; (f) a blank/unknown PHI does not silently exempt. Float === Decimal twin.
- **Ring-1 source-lock:** ONE Medicare producer; no surface recomputes MLS; the new field read from the profile, not re-derived per surface.
- **Ring-2 cross-surface:** tax page ≡ /cashflow FY estimate ≡ CFO all read the one `getUserTaxPosition` Medicare figure; per-member positions consistent.
- **Neo-sync (gate 8):** model `household.privateHospitalCover → medicare` lineage on `service.tax.getUserTaxPosition` + `calculateMedicareLevy`; Neobrain updated; NeoAudit gets the goldens; nothing sandbox-only.
- **10/10 self-review**; the new capture control's design Reza-approved (§18.2.1); **Reza merges** (tax + schema).

## Cross-surface Ring-3 (gate 4 — Matrix, after merge)
The Matrix verifies live with real household data (whatever any user has entered): the Medicare figure reflects family threshold + dependants + each member's PHI, identically on tax page ↔ /cashflow ↔ CFO; per-member positions each correct; base levy on taxable income unchanged where it should be; income tax + deductions untouched. Run id `VR-0NN`.

---
*Prepared by The Matrix from the MON-088 census (§19.2-verified). A product-wide capability: Monitrax captures private hospital cover (new per-member field, Stitch-first control) and feeds the already-existing family inputs (spouse income, dependants) into the ONE Medicare producer at both engine paths + per-member — correct for every user. Medicare-only; income-tax rates untouched. Schema add needs Reza's §12.12 approval; the form control is design-first.*
