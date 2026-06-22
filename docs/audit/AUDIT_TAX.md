# AUDIT — Tax Engine Correctness (READ-ONLY)

**Date:** 2026-06-22
**Auditor:** Claude (Opus 4.8), automated read-only audit
**Scope:** `lib/tax-engine/**`, `app/api/tax/**`, `lib/ai/tax-advisor/**`
**Method:** Per-formula code read + numeric replication (`node`) + ATO source verification (WebSearch, June 2026) + worked examples. No app code was modified.

> **Headline:** The reform architecture (Phase 41E) is genuinely well-built — every post-reform measure is correctly gated behind `commencementVerified` flags and returns UNCOMPUTED rather than silently applying unenacted math (§12.14 compliant). The hardcoded FY24-25 rates/caps/thresholds all match the ATO. **BUT the single most-used calculator — `calculateIncomeTax` (progressive brackets) — contains two real bugs that produce wrong tax for users whose taxable income lands on or just above a bracket boundary, including a catastrophic ~$4,400 under-statement at exactly $135,001.** This is a P0. It is in the live API path and is replicated identically in the Decimal sibling.

---

## 1. P0 — RANKED (wrong numbers a user would see)

### P0-1 — `calculateIncomeTax` bracket-boundary bug: tax computes to $0 (or grossly wrong) at exact bracket minimums
**File:** `lib/tax-engine/core/incomeTaxCalculator.ts:48-77` (Float) and `:195-216` (Decimal sibling — identical logic).
**Live path:** `app/api/tax/route.ts:152,256`, `app/api/tax/super/optimize/route.ts` (×4), `app/api/tax/position/route.ts` (via `calculateTaxPositionDecimal`).

Two interacting defects:

**(a) The early-`break` on `taxableIncome <= bracket.min`.** The brackets are defined with `min: 45001 / 135001 / 190001` (config `taxYearConfig.ts:42-46`). The walk does:
```ts
for (const bracket of config.brackets) {
  if (taxableIncome <= bracket.min) break;   // <-- fires AT the next bracket's min
  if (taxableIncome <= bracketMax) { ...compute...; break; }
}
```
At `taxableIncome === 45001`: bracket 2 (`18201–45000`) fails `45001<=45000`, falls through; bracket 3 has `min:45001`, so `45001 <= 45001` is **true → break with tax still 0**. The function returns **$0 tax** on a $45,001 income (correct ≈ $4,288).

At `taxableIncome === 135001`: it matches bracket 4 but computes off bracket 4's base — returns **$26,888** vs correct **$31,288** (a **$4,400** under-statement).

**(b) The `+1` term:** `incomeInBracket = taxableIncome - bracket.min + 1` (line 57). Because `bracket.min` is already 1 above the true boundary (45001 not 45000), the `+1` taxes one extra dollar at the marginal rate everywhere except the boundary holes — a few cents of systematic over-tax in the interior of each bracket.

**Numeric proof (replicating the engine's exact code in `node`):**
| Taxable income | Engine output | Correct (ATO) | Error |
|---|---|---|---|
| $45,000 | $4,288.00 | $4,288.00 | ✅ 0 |
| **$45,001** | **$0.00** | **$4,288.30** | **−$4,288** |
| $45,002 | $4,288.60 | $4,288.60 | ✅ 0 |
| $60,000 | $8,788.00 | $8,788.00 | ✅ 0 |
| $135,000 | $31,288.00 | $31,288.00 | ✅ 0 |
| **$135,001** | **$26,888.45** | **$31,288.37** | **−$4,400** |
| $135,002 | $31,288.74 | $31,288.74 | ✅ 0 |
| $190,001 | $51,638.45 | $51,638.45 | ✅ 0* |

(\* $190,001 happens to land right because the prior-bracket break does not fire there — the hole is specifically at incomes equal to a bracket's `min`, i.e. $45,001 and $135,001; the $190,001 `min` row's break is shadowed by the top-bracket `max:null` match.)

**Impact:** Any user with taxable income of exactly $45,001 sees $0 income tax. Any user at exactly $135,001 is under-taxed by ~$4,400. Off-boundary incomes are over-taxed by a few cents from the `+1`. The probability of landing on an exact dollar boundary is low for organic salaries but **non-trivial for scenario/what-if tools** that step income by round numbers, and any `$135,001` salary is a real, plausible figure.

**Correct formula (ATO published, 2024-25 resident):**
```
0–18,200:      0
18,201–45,000: (TI−18,200)×0.16
45,001–135,000: 4,288 + (TI−45,000)×0.30
135,001–190,000: 31,288 + (TI−135,000)×0.37
190,001+:        51,638 + (TI−190,000)×0.45
```
**Fix:** Define brackets with true boundaries (`min: 45000/135000/190000`), use `incomeInBracket = taxableIncome - bracket.min` (no `+1`), and use a strict `taxableIncome < bracket.min` (or restructure to a cumulative band sum). Apply the same fix to the Decimal sibling (`:199` uses `taxableDec.lte(bracketMin)` — same break defect — and `:203` has the same `.plus(1)`).

---

### P0-2 — SG cap is hardcoded to the wrong value and ignores config (SSOT violation + wrong number for FY24-25)
**File:** `lib/tax-engine/super/contributionCalculator.ts:52,69` (Float) and `:497` (Decimal `ANNUAL_MAX_SUPER_BASE`).

```ts
const MAX_SUPER_CONTRIBUTION_BASE_2024_25 = 62500; // Quarterly
const annualMaxBase = MAX_SUPER_CONTRIBUTION_BASE_2024_25 * 4;   // 250,000
const eligibleEarnings = Math.min(grossSalary, annualMaxBase);
```
The maximum super contribution base for **FY24-25 is $65,070/quarter** (ATO-verified), not $62,500 (that is the **FY25-26** figure). The config already carries the correct per-FY value (`superGuaranteeQuarterlyCap: 65070` for FY24-25, `62500` for FY25-26) but **the calculator ignores `config` entirely and uses the module constant**, so:
- For a high earner in FY24-25, SG is capped at `$250,000 × rate` instead of `$260,280 × rate` — **SG understated** for salaries between $250k and $260,280.
- It is a CLAUDE.md §12.2 SSOT violation: the canonical value lives in config but a second hardcoded copy is the one actually used.

**Worked example (FY24-25, salary $300,000, SG 11.5%):** engine SG = `min(300000, 250000)×0.115 = $28,750`. Correct = `min(300000, 260280)×0.115 = $29,932.20`. **Understated by $1,182.20.**

**Fix:** use `config.superGuaranteeQuarterlyCap * 4`.

**Severity:** P1 (affects only salaries above the $250k cap; capped-out high earners). Listed near P0 because it is a wrong, user-visible number with a trivial fix and a clean canonical source already present.

---

## 2. Full findings table

| Calc / formula | file:line | Implemented basis | Correct? | Evidence | Severity | Fix |
|---|---|---|---|---|---|---|
| Income tax — progressive brackets | `core/incomeTaxCalculator.ts:48-77`, Decimal `:195-216` | Bracket walk with early `break` at `<= bracket.min` + `incomeInBracket = TI − min + 1`; brackets `min:45001/135001/190001` | ❌ | `node` replication: $45,001→$0 (should $4,288); $135,001→$26,888 (should $31,288); interior +$0.xx over-tax from `+1` | **P0** | True boundaries + drop `+1` + strict `<` |
| Resident bracket rates/thresholds (16/30/37/45; 18,200/45k/135k/190k) | `config/taxYearConfig.ts:42-46` | Stage-3 FY24-25 values | ✅ | ATO "Tax rates – Australian resident" — 16% $18,201–45,000, 30% to $135k, 37% to $190k, 45% above | — | — |
| FY26-27 bracket (16%→15% from 1 Jul 2026) | config — no FY26-27 entry | `getTaxYearConfig` falls back to latest (FY25-26) | ⚠️ | ATO: bottom rate drops to 15% from 1 Jul 2026; config has no FY26-27 and serves FY25-26's 16% as "current" after 1 Jul 2026 | P1 | Add FY26-27 config (documented as deferred to Basiq prep) |
| Medicare levy 2% + shade-in (10% of excess) | `core/medicareLevyCalculator.ts:95-133` | Below threshold $0; shade-in 10%×(TI−threshold) to 125%; then 2% | ✅ | ATO low-income reduction method; matches single $27,222 / family $45,907 | — | — |
| Medicare low-income thresholds FY24-25 (27,222/45,907/4,216) | `config:62-66` | FY24-25 indexed values | ✅ | ATO Medicare levy reduction page (single <$27,222) | — | — |
| MLS tiers FY24-25 (97k/113k/151k @ 0/1/1.25/1.5%) | `config:74-79` | Singles tiers | ✅ (single only) | ATO MLS thresholds 2024-25 | P2 | Family MLS tiers not modelled (documented gap, not wrong) |
| MLS income base | `medicareLevyCalculator.ts:172,187` | Uses `taxableIncome` | ⚠️ | ATO MLS uses "income for MLS purposes" (TI + reportable fringe benefits + reportable super + net investment loss + exempt foreign income). Understates MLS for users with those add-backs | P2 | Accept a separate MLS-income input |
| LITO two-tier phase-out ($700; 5c 37.5k–45k; 1.5c to 66,667) | `core/taxOffsets.ts:36-91`, `config:85-97` | ATO two-tier | ✅ | Matches ATO LITO ($700 max, out at $66,667). Verified $40k→$575, $50k→$250 by hand against code | — | — |
| LITO applied against gross tax incl. Medicare | `position/taxPositionCalculator.ts:242-243`, `taxOffsets.ts applyOffsets` | Non-refundable offsets reduce `grossTax = incomeTax + medicare` | ⚠️ | LITO/SAPTO legally cannot reduce Medicare levy. Harmless in practice (LITO ≤ income tax wherever LITO>0), but structurally wrong | P2 | Apply non-refundable offsets to income tax only |
| Offset application order (non-refundable then franking) | `taxOffsets.ts:434-479` | LITO/SAPTO/foreign first, franking (refundable) last | ✅ | Correct ordering — non-refundable wasted-to-zero before refundable franking | — | — |
| Franking credit gross-up (×0.30/0.70) | `income/taxabilityRules.ts:250-262` | `div×(pct/100)×(0.30/0.70)` = ×0.4286 | ✅ | ATO franking formula; explicit credits preferred over recompute (audit fix in-code) — correct for 25% base-rate entities | — | — |
| Division 293 (15% on lesser of excess>$250k and CC) | `super/contributionCalculator.ts:239-258`, `super/highIncomeSuperTax.ts:84-98` | s293-15 lesser-of test, threshold from config | ✅ | $250k threshold ATO-verified. Worked: TI $260k + CC $30k → excess $40k, lesser(30k,40k)=30k×15%=$4,500 ✓ | — | — |
| Concessional cap $30,000 FY24-25/FY25-26 | `config:106`, `capTracker.ts:66-67` | $30,000 | ✅ | ATO contributions caps (general CC $30k from 1 Jul 2024) | — | — |
| Non-concessional cap $120,000 | `config:107` | $120,000 | ✅ | ATO NCC cap $120k FY24-25/25-26 | — | — |
| Carry-forward (5yr, TSB<$500k, FIFO) | `capTracker.ts:96-142` | Correct eligibility + window | ✅ | ATO carry-forward rules | — | — |
| Bring-forward TSB tiers | `config:112-116,200-204`, `capTracker.ts:148-200` | Nil at general TBC, 1yr/2yr/3yr bands derived from TBC−n×NCC | ✅ | s292-85; FY25-26 tiers (1.76M/1.88M/2.00M) derive from $2.0M TBC − NCC ✓. **Note** module fallback constant `BRING_FORWARD_THRESHOLDS` (`:81-85`) is stale ($1.66M) but config wins; dead-ish fallback | P2 | Remove stale module constant |
| SG rate 11.5% (FY24-25) / 12% (FY25-26) | `config:104,188` | Correct | ✅ | ATO super guarantee schedule | — | — |
| SG maximum contribution base | `contributionCalculator.ts:52,69,497` | Hardcoded $62,500/qtr, ignores config | ❌ | FY24-25 is $65,070/qtr (ATO). Understates SG for $250k–$260k earners | P1 | Use `config.superGuaranteeQuarterlyCap` |
| Excess-contributions tax (32% CC / 47% NCC) | `capTracker.ts:237-253` | Approximations, labelled "Approximate" | ⚠️ | Excess CC is actually taxed at marginal rate − 15% offset + interest; 32% is a rough proxy. NCC excess is not a flat 47% (release option / associated earnings). Acknowledged in comments | P2 | Document as estimate-only; don't surface as exact $ |
| Co-contribution ($45,400/$60,400, 50c, $500 max) | `contributionCalculator.ts:268-324` | FY24-25 thresholds | ✅ | ATO co-contribution FY24-25 ($45,400 lower / $60,400 upper) | — | — |
| Spouse contribution offset ($37k/$40k, 18%, $540) | `contributionCalculator.ts:334-381` | Correct | ✅ | ATO spouse offset rules | — | — |
| Div 296 ($3M TSB, +15%) | `config:129-131`, `highIncomeSuperTax.ts:100-130` | Gated behind `div296CommencementVerified:false` → returns 0 + UNCOMPUTED | ✅ | Correctly NOT applied pre-Assent (§12.14 FW-2). Proportional earnings method matches the proposed Bill | — | — |
| Transfer Balance Cap ($1.9M FY24-25 / $2.0M FY25-26) | `config:128,217` | Indexed | ✅ | ATO TBC indexed to $2.0M from 1 Jul 2025 | — | — |
| CGT discount (50% individ/trust, 33⅓% SMSF, 0% company, 12-mo gate) | `divisions/cgtDiscount.ts:130-295` | Per-entity dispatch, holding gate | ✅ | s115-25/100/10. Worked: $200k gain, individual, 18mo → 50% → $100k taxable ✓; SMSF → 1/3 → $66,667 ✓; company → $200k ✓; 6mo → no discount ✓ | — | — |
| CGT reform — indexation (Measure 2) | `divisions/cgtIndexation.ts` | Returns UNCOMPUTED until `cgtIndexationCommencementVerified`; Stage-2 throws | ✅ | §12.14 FW-2 — no silent post-reform numbers. Defensive throw if flag flipped without mechanic | — | — |
| CGT reform — 30% min rate (Measure 2) | `divisions/cgtMinimumRate.ts` | Gated, UNCOMPUTED, throws on flag-without-mechanic | ✅ | §12.14 FW-2 compliant; floor const 0.30 correct | — | — |
| CGT discount post-reform routing | `cgtDiscount.ts:199-226` | Only flips to POST_REFORM when flag=true AND contract>cut-over AND disposalFY≥2027-28 | ✅ | Grandfathering uses `REFORM_CUT_OVER_UTC` (2026-05-12T09:30:00Z) ✓; inclusive boundary correct per Treasury fact sheet | — | — |
| Reform cut-over timestamp | `config/reformConstants.ts:46` | `2026-05-12T09:30:00Z` (7:30pm AEST = UTC+10) | ✅ | AEST UTC+10 in May (post-DST) correct; matches §12.14 canonical | — | — |
| Negative gearing (entity-aware loss offset) | `divisions/negativeGearing.ts:152-304` | Individuals offset other income; trusts/companies trap+carry-fwd; Measure 1 regime gate | ✅ | Div 8/36 correct; POST_REFORM_RESTRICTED quarantines loss; UC_* falls back conservatively pre-reform | — | — |
| Trust min-tax (Measure 3, 30%) | `divisions/trustMinimumTax.ts` | Scope-gated to DISCRETIONARY; UNCOMPUTED until `trustMinTaxCommencementVerified` | ✅ | §12.14 FW-2 compliant; excluded trust types correct | — | — |
| PAYG withholding (NAT 1004 Schedule 1, y=a·x−b, x=floor+0.99) | `core/paygCalculator.ts:62-231` | FY24-25 Scale 2/1 coefficients, formula method | ✅ (spot) | Formula structure + `+0.99` matches ATO Schedule 1; coefficients are FY24-25 NAT 1004. Continuous across integer band bounds. Not exhaustively re-derived against NAT 1004 table | P2 | Re-verify each coefficient against current NAT 1004 at next FY review |

---

## 3. §12.14 reform-awareness compliance — PASS

Every post-reform measure checked applies the FW-1/FW-2 discipline correctly:
- **CGT indexation / min-rate / trust-min-tax**: return UNCOMPUTED while `*CommencementVerified === false`; throw a loud error if the flag is flipped without the Stage-2 mechanic (`cgtIndexation.ts:114`, `cgtMinimumRate.ts:104`, `trustMinimumTax.ts:173`). This is the *correct* "fail loudly, never silent" behaviour.
- **Negative gearing**: defaults `regime` to `PRE_REFORM_GRANDFATHERED`; only restricts when explicitly post-reform; surfaces UNCOMPUTED for unknown contract date / new-build status and falls back conservatively (benefit-to-user).
- **Div 296**: gated; 0 + UNCOMPUTED until Royal Assent.
- **Grandfathering** uses the single canonical `REFORM_CUT_OVER_UTC` everywhere checked; inclusive-of-cut-over boundary matches Treasury.

No instance of a reform measure silently applying unenacted post-reform numbers was found. This part of the engine is genuinely solid.

---

## 4. SSOT findings (CLAUDE.md §12.2)

- **SG cap duplicated + diverged**: `contributionCalculator.ts:52` hardcodes `62500` while the canonical `config.superGuaranteeQuarterlyCap` holds the correct per-FY value. The calculator uses the wrong copy (P0-2/P1 above).
- **Div 293 computed in two places**: `super/contributionCalculator.ts:239` AND `position/taxPositionCalculator.ts:313` (`calculateDivision293TaxAmount`) AND `super/highIncomeSuperTax.ts`. Three implementations of the same s293-15 lesser-of test. They currently agree numerically, but it is triplication — consolidate to one.
- **Bring-forward thresholds duplicated**: module constant `capTracker.ts:81-85` (stale $1.66M) vs config (`bringForwardThresholds`). Config wins via `??`, so the stale constant is effectively dead — flag for removal.
- **Stale module constant** `CONCESSIONAL_CAPS`/`NON_CONCESSIONAL_CAPS` (`capTracker.ts:60-78`) duplicate per-FY caps that also live in config; used only by `getConcessionalCap`/`getNonConcessionalCap` helpers — verify those callers and prefer config.

No tax math was found re-implemented inside React components. API routes correctly call the engine (thin-wrapper pattern) — except they call the **buggy** `calculateIncomeTax`, so the bug propagates from one canonical (but wrong) source rather than being duplicated. Fix once, fixes everywhere.

---

## 5. Worked examples (engine vs hand)

1. **Income tax $90,000 (FY24-25):** engine $17,788 = hand `4288 + (90000−45000)×0.30 = 4288 + 13500 = 17,788` ✅
2. **Income tax $135,001:** engine **$26,888.45** vs hand **$31,288.37** ❌ (P0-1).
3. **Div 293, TI $260,000 + CC $30,000:** combined $290k, excess $40k, lesser(30k,40k)=$30k × 15% = **$4,500** — engine matches ✅
4. **CGT, individual, $200,000 gain, held 18 months:** 50% discount → **$100,000** taxable gain — engine matches ✅; same gain in SMSF → 1/3 discount → **$66,667** ✅; in a company → **$200,000** (no discount) ✅
5. **SG, $300,000 salary FY24-25 @ 11.5%:** engine `min(300k,250k)×0.115 = $28,750` vs correct `min(300k,260.28k)×0.115 = $29,932.20` ❌ (P0-2).
6. **LITO $50,000:** `700 − (45000−37500)×0.05 − (50000−45000)×0.015 = 700 − 375 − 75 = $250` — engine matches ✅
7. **Franking, $7,000 dividend 100% franked:** `7000 × 1.0 × 0.30/0.70 = $3,000` credits; grossed-up $10,000 — engine matches ✅

---

## 6. Recommended fix priority

1. **P0-1** — fix `calculateIncomeTax` bracket walk (Float + Decimal). One file, ~10 lines, fixes every downstream route. Add a unit test asserting exact boundary values ($45,000/45,001/135,000/135,001/190,000/190,001).
2. **P0-2 / P1** — make `calculateSuperGuarantee` read `config.superGuaranteeQuarterlyCap`.
3. **P1** — add a FY26-27 config (16%→15% bottom rate) before 1 Jul 2026 traffic, or accept honest-stale fallback knowingly.
4. **P2** — MLS income base; LITO-vs-Medicare offset scoping; consolidate the 3× Div 293 + stale cap constants; family MLS tiers.

---

## 7. Rates / thresholds checked against ATO (source URLs)

| Item | Config value | ATO value | Source |
|---|---|---|---|
| Resident brackets 2024-25 (16/30/37/45) | 18,200/45k/135k/190k | same | https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents |
| Bottom rate 1 Jul 2026 | (no FY26-27 config) | 16%→15% | https://www.ato.gov.au/tax-rates-and-codes/tax-rates-australian-residents |
| Medicare low-income single 2024-25 | $27,222 | $27,222 | https://www.ato.gov.au/individuals-and-families/medicare-and-private-health-insurance/medicare-levy/medicare-levy-reduction/medicare-levy-reduction-for-low-income-earners |
| Concessional cap 2024-25/25-26 | $30,000 | $30,000 | https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/contributions-caps |
| Non-concessional cap | $120,000 | $120,000 | https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/contributions-caps |
| Division 293 threshold | $250,000 | $250,000 | https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/division-293-tax |
| SG rate 2024-25 / 2025-26 | 11.5% / 12% | 11.5% / 12% | https://www.ato.gov.au/tax-rates-and-codes/key-superannuation-rates-and-thresholds/super-guarantee |
| Max super contribution base 2024-25 (qtr) | **$62,500 (used)** / $65,070 (config) | **$65,070** | https://www.ato.gov.au/businesses-and-organisations/super-for-employers/payday-super/paying-super-on-payday/what-payments-are-qualifying-earnings/maximum-contributions-base |
| Max super contribution base 2025-26 (qtr) | $62,500 | $62,500 | (same) |

---

*Audit complete. No app code modified. Numeric replication script lived in scratchpad (not committed).*
