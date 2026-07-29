# superCap (concessional / non-concessional) — Quantity Contract (MON-131 Phase A)

> Census: 10 sites at seed. Verified at HEAD 2026-07-29. Overlaps MON-133 (legislated constants
> hardcoded outside `TAX_YEAR_CONFIGS`, incl. the STALE 11.5% SG rate — verified live below).
> Read-only Phase A artefact.

## classification

**FACT — a legislated constant, per FY** (D12). The cap is asserted by legislation
(ITAA 1997 s291-20 concessional / s292-85 non-concessional, AWOTE-indexed), not computed. Its ONE
home is `TAX_YEAR_CONFIGS`. Quantities DERIVED on top of it (cap headroom, % used, carry-forward
availability, bring-forward cap) are separate derived quantities with their own producer
(`capTracker`) and are covered here only insofar as they duplicate the constant.

## semantic

- **Concessional cap:** maximum before-tax contributions (SG + salary sacrifice + personal deductible)
  per person per FY taxed at 15% in-fund. $30,000 for FY24-25/25-26/26-27 (config), $27,500 FY21-22..23-24, $25,000 before.
- **Non-concessional cap:** after-tax contribution limit, 4 × concessional. $120,000 FY24-25+.
- **Window:** financial year; the FY selects the constant — never interpolate.
- **Units:** AUD per year. Related but DISTINCT constants (not this quantity): SG rate
  (`superGuaranteeRate` — 0.115 FY24-25, **0.12 FY25-26 and FY26-27**, legislated maximum reached),
  carry-forward TSB threshold ($500k, s291-20(3)), bring-forward TSB tiers (TBC-derived, s292-85(3)-(4)),
  Division 293 threshold ($250k). Each is its own named constant in the same config home.

## canonicalHome

- `lib/tax-engine/config/taxYearConfig.ts` — `concessionalCap` (:110 FY24-25, :195 FY25-26, :299 FY26-27, :401 FY23-24),
  `nonConcessionalCap` (:111/:196/:300/:402), `superGuaranteeRate` (:108/:193/:297/:399),
  `bringForwardThresholds` (:116-120/:205-209/:307/:410-414). Access via `getTaxYearConfig(fy)` / `getCurrentTaxYearConfig()`.
- **Decimal twin: NOT APPLICABLE / NOT ESTABLISHED** — the constant is a plain number; Decimal
  consumers (`trackContributionCapsDecimal`, `concessionalCapHeadroomDecimal`) Decimal-ify at the
  point of use. No twin migration needed for a constant.
- **Derived-quantity producer (cap tracking):** `lib/tax-engine/super/capTracker.ts:trackContributionCaps` (:~200s, reads `config.concessionalCap` :221, `config.nonConcessionalCap` :227) + Decimal twin `trackContributionCapsDecimal` — reads config ✅, EXCEPT the duplicates below.

## callSites

### The 10 census sites (section `superCap`, verified at HEAD)

| Census site | Tag | Actual arithmetic (in words) |
|---|---|---|
| `lib/tax-engine/super/capTracker.ts:getConcessionalCap` (373) | **DUPLICATE (constant home)** | returns from a LOCAL `CONCESSIONAL_CAPS` table (:60-68) with silent `\|\| 30000` fallback (:374); sibling `getNonConcessionalCap` `\|\| 120000` (:381). Table stops at '2025-26' — `getConcessionalCap('2026-27')` silently falls back. Overlapping FYs duplicate config values. |
| `app/dashboard/cfo/what-if/[lever]/page.tsx:buildRequest` (326) | **DUPLICATE (hardcode)** | unit spans :419-425 — `const sgRate = 0.12; const concessionalCap = 30_000;` headroom = cap − proposed; over-cap flag. Values currently correct, but typed into a page (D12 violation; the brief's ":419-ish 30000 + 0.12" claim VERIFIED at :419-420, plus Decimal `'0.12'` at :469). |
| `app/dashboard/cfo/what-if/[lever]/page.tsx:ResultPills` (1081) | **DUPLICATE (hardcode)** | :1095 `Math.round((totalConcessional.after / 30_000) * 100)` — cap-used % against a literal. |
| `app/api/cashflow/intelligence/route.ts:buildTaxOptimization` (431) | **DUPLICATE (STALE hardcode)** | :464 `Math.min(27500, annualGrossIncome * 0.05) * 0.34` — potential-saving recommendation caps at **$27,500, the FY21-22..23-24 cap** (current $30,000) with an invented 34% rate. WRONG-INPUT live path. |
| `lib/tax-engine/super/capTracker.ts` (via `getConcessionalCap`) | — | see row 1; also `BRING_FORWARD_THRESHOLDS` fallback (:80-85) holds STALE FY24-25 tiers ($1.66M/$1.78M/$1.9M) — config (preferred at :162 via `??`) has FY25-26+ $1.76M/$1.88M/$2.0M. Fallback fires only if `config.bringForwardThresholds` is absent (all 4 configs have it → dormant, but a drift trap). |
| `lib/tax-engine/super/capTracker.ts:242` | **DUPLICATE (invented rate — found by adversarial pass 2026-07-29)** | `excessContributionsTax += concessionalExcess * 0.32; // Approximate additional tax` — excess concessional contributions are actually taxed at the individual's MARGINAL rate (less 15% offset); 0.32 is an invented proxy typed into the derived-quantity producer this contract's own canonicalHome covers. D12-class hardcode. |
| `components/DashboardLayout.tsx:DashboardLayout` (53) | FALSE POSITIVE | :284 `pollingInterval: 30000` — milliseconds, not a cap. Census pattern `\b30[_,]?000\b` noise. |
| `lib/services/accountDeletion.ts:deleteUserAccount` (73) | FALSE POSITIVE | :135 `{ timeout: 30_000 }` — ms. |
| `lib/calc-audit/engines/decimal-cfo-decision-support.ts:makeProperty` (80) | FALSE POSITIVE | :90 fixture `annualRentalIncome: 30_000`. |
| `lib/calc-audit/engines/decimal-cfo-decision-support.ts:maxConcentrationFloat` (314) | FALSE POSITIVE | :414 fixture `currentValue: 30_000`. |
| `lib/calc-audit/engines/decimal-cfo-scenarios.ts:makeLoan` (157) | FALSE POSITIVE | :363 fixture `liquidCash: 30_000`. |
| `lib/calc-audit/engines/decimal-cfo-score-risk.ts:builders` (209) | FALSE POSITIVE | :492 fixture `currentValue: 30_000`. |

(11 rows because capTracker hosts two findings. 6 of the 10 census sites are false positives — the
`superCap` signature needs a context guard in the census v2.)

### Producers the census MISSED (blind spots — top-level consts escape the unit splitter)

| Site | Tag | Actual arithmetic |
|---|---|---|
| `lib/marketing/benchmarks.ts:122` `CONCESSIONAL_CAP_ANNUAL = 30_000` | **DUPLICATE (constant home)** | a second exported home for the cap. ⚠ **Brief-claim correction:** the brief said "`lib/wealthCheck/lever.ts:88` has its own `CONCESSIONAL_CAP_ANNUAL`" — **STALE at HEAD**: `lever.ts` now IMPORTS it (:22) from `benchmarks.ts`; uses at :89 (headroom = cap − annual SG), :166, :190. The duplicate constant moved, it did not die. |
| `lib/cashflow/savingOpportunities.ts:56` `SUPER_CONCESSIONAL_CAP_FY27 = 30_000` | **DUPLICATE (constant home)** | comment says "canonical cap (taxYearConfig.ts)" but it is a re-typed literal, not an import. |
| `lib/cashflow/savingOpportunities.ts:162` `const sgRate = 0.115` | **WRONG (STALE SG rate)** | MON-133 VERIFIED at HEAD: estimates current concessional as gross × **11.5%** when the legislated FY25-26+ rate is **12%** (`taxYearConfig.ts:193/:297`). Overstates the salary-sacrifice wedge on the live /cashflow saving-opportunities tile. |
| `app/dashboard/income/page.tsx:357` `annualAmount * 0.115`; `:566` `superGuaranteeRate = 0.115`; `:2407` fallback `\|\| 0.115`; `:1988` copy "11.5%" | **WRONG (STALE SG rate)** | MON-133's second live path VERIFIED at HEAD — :566 stamps 11.5% onto SALARY income rows at submit (a stale constant written into FACT data); :357 previews SG at 11.5%. |
| `lib/help/tooltips.ts:134` | CONSUMER (copy) | states "FY24-25 rate: 11.5%. Rises to 12% from 1 July 2025" — accurate but date-fragile copy. |

### CONSUMERS (correct — read config; the pattern Phase B migrates the duplicates onto)

- `lib/tax-engine/super/capTracker.ts:221/:227` (`config.concessionalCap`/`.nonConcessionalCap`), `:162` (config bring-forward preferred)
- `lib/tax-engine/super/contributionCalculator.ts:92` (SG = earnings × `config.superGuaranteeRate`), `:412-413`, `:453-461` (headroom/percentages from config) — ⚠ but `0.15` contributions tax hardcoded at :173/:186/:261 instead of `config.superContributionsTaxRate` (MON-133 rootCause cites :186)
- `lib/cfo/scenarios/salarySacrificeToSuper.ts:119` (SG from config), `:133` headroom, `:351/:484` (labels from config)
- `app/api/tax/super/route.ts:149-296` (cap tracking + `config.concessionalCap` serialized) → `/dashboard/investments/super`
- `lib/tax-engine/position/taxPositionCalculator.ts:465` (`config.concessionalCap − concessional` in salary-sacrifice recommendation)
- AI advisor tools `getContributionCapHeadroom` / `runContributionScenario` (via capTracker/config)

**Verdict: MULTIPLE (4 duplicate constant homes: capTracker local tables, benchmarks.ts, savingOpportunities.ts, what-if page) + WRONG (stale $27,500 at intelligence route :464; stale 11.5% SG at savingOpportunities :162 and income page :357/:566 — MON-133 confirmed live).**

## invariants

1. For any configured FY, every surface's concessional cap == `getTaxYearConfig(fy).concessionalCap` (single constant test; FY24-25/25-26/26-27 → $30,000).
2. `nonConcessionalCap == 4 × concessionalCap` for every configured FY (legislative link; holds: 120,000 = 4 × 30,000).
3. SG rate rendered/applied anywhere for FY25-26+ == **0.12** (== `config.superGuaranteeRate`); FY24-25 == 0.115.
4. Cap headroom: `remaining == cap + carryForwardAvailable − used`, never negative alongside `isExceeded=false` (capTracker property).
5. Bring-forward tiers must equal the config tiers for the resolved FY (the capTracker fallback tiers must never be observable while all configs define `bringForwardThresholds`).
6. `getConcessionalCap(fy)` == `getTaxYearConfig(fy).concessionalCap` for every FY both define — currently untestable for '2026-27' (local table missing the year → silent fallback).

## independentExpectation

- ITAA 1997 s291-20 (concessional cap, AWOTE-indexed in $2,500 steps); ATO "Key superannuation rates
  and thresholds" — config cites it (`taxYearConfig.ts:25`). FY24-25+ = $30,000.
- ITAA 1997 s292-85 (non-concessional = 4× concessional → $120,000).
- SG rate: Superannuation Guarantee (Administration) Act 1992 s19(2) schedule — 11.5% FY24-25, **12% from 1 Jul 2025 (legislated maximum, no further step)** — matches config :193/:297 and the config comment "SG rate reached its legislated 12% maximum".
- Carry-forward TSB $500k: s291-20(3) (config :115). Bring-forward tiers: s292-85(3)-(4) TBC-derived (config :201-209).
- **NOT "NONE FOUND"** — every constant here is independently citable.

## surfaces

| Route | Label |
|---|---|
| `/dashboard/investments/super` | concessional/non-concessional cap, used, remaining, carry-forward (from `/api/tax/super` — config-clean) |
| `/dashboard/cfo/what-if/[lever]` (super contribution lever) | cap pill, headroom, "% of cap used" (HARDCODED 30,000 / 0.12) |
| `/cashflow` (saving opportunities tile) | salary-sacrifice wedge (HARDCODED cap :56 + STALE 11.5% SG :162) |
| `/cashflow` (intelligence tax tile) | salary-sacrifice potential saving (STALE $27,500 :464) |
| `/dashboard/income` | SG preview/stamp on salary rows (STALE 11.5% :357/:566/:1988/:2407) |
| `/dashboard/tax` | salary-sacrifice recommendation (config-clean, taxPositionCalculator :465) |
| `/wealth-check` (public) | lever engine cap headroom (benchmarks.ts duplicate constant) |
| AI tax advisor (chat) | contribution headroom/scenario tools (config-clean via capTracker) |

## expectedMoves

Written BEFORE any Phase B migration (T4 / MON-133):

| pathPrefix | Why | Arithmetic |
|---|---|---|
| `/cashflow` saving-opportunities salary-sacrifice benefit | SG proxy 11.5% → 12% shrinks the estimated wedge | wedge = 30,000 − min(gross × **0.12**, 30,000); e.g. gross $150k: wedge falls **$12,750 → $12,000 (−$750)**; benefit at 15pp falls **~$112.50/yr** *(adversarial correction 2026-07-29 — the original "$18,750 → $12,000 (−$6,750), ~$1,012/yr" was internally impossible: 30,000 − 150,000×0.115 = 12,750)* |
| `/cashflow` intelligence potential saving | 27,500 → 30,000 raises the `Math.min` ceiling ONLY when gross × 0.05 > 27,500 (gross > $550k) | for typical incomes: **NO movement** (min binds on gross × 0.05) — state that prediction explicitly |
| `/dashboard/income` SG figures | 11.5% → 12% on salary rows | SG = annual × 0.12 (was ×0.115): +4.35% relative rise |
| `/dashboard/cfo/what-if/[lever]` super lever | hardcode → config | **NO movement** while FY config says 0.12/$30,000 — pure re-sourcing |
| `/wealth-check`, benchmarks consumers | constant → config | **NO movement** at current values ($30,000 == config) |
| `/dashboard/investments/super`, `/api/tax/super` | already config-fed | **NO movement** |

⚠ **Precondition-class note (MON-135 shape):** `income/page.tsx:566` WRITES `superGuaranteeRate = 0.115`
onto Income rows (FACT storage). Migrating the read paths to config does NOT fix rows already stamped
with 11.5% — Phase B needs a decision on re-stamping/deriving stored `superGuaranteeRate` before the
income-page SG figures can converge. A correct formula over bad stored data is still wrong (brief §6).

## decisionsRequired

1. **Historical caps for carry-forward** (capTracker `CONCESSIONAL_CAPS` :60-68): carry-forward needs
   5 prior FYs (back to 2019-20) but `TAX_YEAR_CONFIGS` holds only 2023-24..2026-27. Options:
   (a) extend `TAX_YEAR_CONFIGS` back to 2019-20 (full config per FY — heavy); (b) add a minimal
   `HISTORICAL_CAPS` block INSIDE `taxYearConfig.ts` as the one home and delete capTracker's tables;
   (c) keep capTracker's table but derive overlapping years from config + fail loud (no `|| 30000`)
   for unknown years. Consequence of (c)-status-quo: '2026-27' already silently falls back.
2. **Stored `superGuaranteeRate` on Income rows** (see precondition above): re-stamp existing rows to
   12%, or derive SG at read time from FY config and stop storing the rate? Storing a legislated rate
   on a FACT row is a derived-value-stored smell (D2) — but changing it moves numbers and is Reza's call.
3. **`benchmarks.ts` constants for public/marketing surfaces:** may the public wealth-check read
   `TAX_YEAR_CONFIGS` directly (bundle weight/coupling), or does marketing keep a mirrored constant
   with a CI equality test against config? Either is defensible; pick one.
4. **Hardcoded 0.15 contributions tax** in contributionCalculator (:173/:186/:261) vs
   `config.superContributionsTaxRate` — migrate in T4 alongside MON-133 (no number movement; same value).

## coverageBoundary

- **Verifies:** all 10 census sites + 5 census-missed sites read and classified at HEAD; config read in
  full; capTracker/contributionCalculator/salarySacrificeToSuper/lever/benchmarks/savingOpportunities/
  income-page/what-if-page anchors verified line-exact; MON-133 registry rootCause cross-checked
  (all its super anchors resolve; `lever.ts:88` claim corrected to benchmarks.ts:122).
- **Does NOT verify:** rendered runtime values (Ring 3); contribution YTD aggregation correctness
  (a separate derived quantity); Division 293 (own family, `div293` census key); whether every AI-tool
  path Decimal-ifies consistently; the ACTUAL SG amounts employers paid (FACT intake).
- **Stale-anchor report:** brief's `lever.ts:88 CONCESSIONAL_CAP_ANNUAL` → moved to
  `lib/marketing/benchmarks.ts:122` (lever imports at :22, uses :89). Brief's `what-if/[lever]/page.tsx:422`
  → the hardcodes sit at **:419-420** at HEAD (near-match). All other cited anchors resolve exactly.

## Adversarial review (§7) — 2026-07-29

- **Claims checked: 38** (anchors 27 · arithmetic 7 · negative-claims 4)
- **REFUTED / CORRECTED: 3**
  1. **expectedMoves arithmetic REFUTED (saving-opportunities row).** The stated
     "gross $150k: wedge falls $18,750 → $12,000 (−$6,750); benefit ~$1,012/yr" is impossible
     under the code's own formula (`savingOpportunities.ts:162-164`): wedge(11.5%) =
     30,000 − min(150,000 × 0.115, 30,000) = 30,000 − 17,250 = **$12,750**; wedge(12%) = $12,000;
     delta **−$750**, benefit delta at 15pp **≈ $112.50/yr**. No gross produces the original pair
     (a −$6,750 delta needs gross ≈ $1.35M, where the cap binds and the delta is $0). Direction
     of the prediction (SG fix shrinks the wedge) is correct; magnitude was ~9× overstated.
     Corrected inline.
  2. Anchor drift: FY25-26 `concessionalCap` is at `taxYearConfig.ts:195` (not :196) and FY25-26
     `nonConcessionalCap` at `:196` (not :197). Fixed inline. All other config anchors
     (:110/:299/:401, :111/:300/:402, SG :108/:193/:297/:399, bring-forward :116/:205/:307/:410)
     resolve exactly.
  3. **Missed hardcode inside the contract's own producer:** `capTracker.ts:242`
     `excessContributionsTax += concessionalExcess * 0.32` — an invented "approximate additional
     tax" rate (the law taxes excess concessional at the marginal rate less a 15% offset).
     The contract audited capTracker's cap tables and bring-forward fallback but not this rate.
     Added to callSites.
- **Verified intact (attack failed):** `CONCESSIONAL_CAPS` table `:59-68` stops at '2025-26' and
  `getConcessionalCap:373` `|| 30000` / `getNonConcessionalCap:381` `|| 120000` byte-exact
  (the '2026-27' silent-fallback finding holds); what-if hardcodes `:419-420` (`sgRate = 0.12`,
  `concessionalCap = 30_000`), Decimal `'0.12'` `:468-469`, `ResultPills:1081` + `/30_000` `:1095`
  all exact; `benchmarks.ts:122` + `lever.ts:22/:89/:166/:190` exact (the contract's own
  brief-correction re lever.ts:88 → benchmarks.ts:122 is CONFIRMED); `savingOpportunities.ts:56`
  + `:162` (0.115) exact; income page `:357/:566/:1988/:2407` exact; intelligence `:464`
  ($27,500 × 0.34) exact; `contributionCalculator` 0.15 at `:173/:186/:261` all three exact,
  SG-from-config `:92` exact; FY25-26 bring-forward config tiers $1.76M/$1.88M/$2.0M `:205-209`
  confirmed; 4× invariant holds on all four configs (incl. FY23-24 110,000 = 4 × 27,500).
  Independent repo-wide hunts for `27,500` and `0.115` found NOTHING beyond the contract's list.
- **Could not verify:** the MON-133 registry entry text (not re-read); ATO/AWOTE figures against
  the legislation itself (config citations are the trail); AI-tool Decimal-consistency
  (contract's own stated gap).
- **Verdict impact:** the MULTIPLE/WRONG verdict is UNCHANGED in kind and slightly WORSE in
  degree (one more invented-rate hardcode inside capTracker). One expectedMoves magnitude
  corrected — Phase B's golden-diff prediction for the /cashflow saving-opportunities tile
  must use −$750 / ~$112.50, or the diff gate would wrongly accept a ~$1,012 move.
