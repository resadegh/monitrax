# Phase 41E reform 2026-27 — Australian tax-law changes from the 12 May 2026 Budget

> **What this is:** the engineering design for incorporating the eight tax-law changes announced in the 2026–27 Federal Budget (handed down 12 May 2026, 7:30pm AEST) into the Monitrax tax engine, advisor, and UI.
>
> **What this is not:** legislation, advice, or final spec. This is a Budget *announcement* — the exposure drafts + Bills are forthcoming. The plan is intentionally staged so we ship the *safe* pieces (data scaffolding, advisory copy, AI knowledge pack) now, and the rule-mechanics modules when the exposure-draft text is final.

**Status:** 🟢 **Stage 1 COMPLETE (2026-05-16)** — all 6 sub-PRs shipped: #763 design + governance · #764 41E.0 foundation · #765 41E.1 engine skeletons · #766 41E.2 AI advisor · #767 41E.3 UI surfaces · #768 41E.4 form UI · #769 41E.5 wizard + docs consolidation. Stage 2 per-measure rule-mechanic implementation queued (each measure's `commencementVerified` flag flips when Treasury exposure draft + Royal Assent confirm). Stage 3 = Royal-Assent flip per measure.
**Owner:** Reza (regulatory sign-off) + Claude (architecture).
**Anchors:** `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §5 (D-2 — structural AFSL boundary), §9 (versioning protocol), §10 (UNCOMPUTED register), §11.1 (Phase 41h tool registry); `PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §10 (tax-engine SSOT); `PHASE_41F_BOOKKEEPING_INTEGRATION.md` (trust-deed extracted rules — intersects with Measure 3); `docs/architecture/AI_PROVIDER_STRATEGY.md` (sibling doc — LLM choice for the advisor); CLAUDE.md §0 (advisory mindset), §12.2 (SSOT), §12.12 (migrations), §13.3 (CDR sanitisation), §14 (TRAIL).
**Precedent decisions this doc honours (do not re-litigate):** **D-1** (full regulatory scope ships in demo cut — no demo/PROD split; reform measures ship like everything else); **D-2** (structural AFSL/TPB/NCCP boundary via the AI advisor tool registry, not prompt disclaimers); **HR-1** (numbers come from the app, never from the AI); **HR-2** (claims come from Australian law, never AI memory); **HR-3** (user-visible calc errors unacceptable — silent admin-side via Phase 41i.6 surface audit).
**Relationship to existing phases:** Phase 41e is **COMPLETE** (41e.0 through 41e.17, all 18 sub-PRs shipped). Phase 41h is **COMPLETE** (41h.0 through 41h.7). Phase 41f (Xero bookkeeping integration, in flight) intersects with Measure 3 — the discretionary-trust reform changes the case for distributions, and `TrustDeedExtractedRules` (Phase 41f.4) is the canonical input for Phase 41e.4 (Div 6E) and 41e.5 (s100A zone). Phase 41E reform 2026-27 layers atop a complete engine; it does not refactor it.
**Last updated:** 2026-05-16 (Stage 1 closed).

---

## 1. Why this phase exists

The 12 May 2026 Federal Budget introduced eight tax-law changes — some marginal (PAYG cadence), some structural (negative gearing restricted to new builds; the 50% CGT discount replaced with cost-base indexation + a 30% minimum tax floor; a 30% minimum tax on discretionary-trust *taxable income*). For Monitrax — a financial-position platform whose **whole value proposition** is "your numbers, accurately, under the actual rules" — these reforms cut directly through:

- **The tax engine** (`lib/tax-engine/*`) — the calc that produces every projected tax position, refund, and after-tax cashflow figure.
- **The AI advisor** (`lib/ai/tax-advisor/*`) — the conversational surface where users ask "should I…?" and the gateway is HR-1/HR-2/D-2 bound to cite real authority.
- **The CFO Guide / TRAIL Stage 5** (`/dashboard/cfo`) — forward-looking recommendations that depend on tax projections.
- **The property + investment surfaces** (`/dashboard/balances`, `/dashboard/properties`) — per-asset tax-treatment badges.
- **The entity surface** (`/dashboard/entities`) — Phase 41's structural view; the trust-tax change reshapes the comparative case for discretionary trusts.
- **The compliance archive** (Phase 32C 7-yr conversations) — adviser ↔ client conversations referencing reform-affected positions must capture the cited rule snapshot at the time of advice.

A botched implementation of these reforms in the engine is worse than no implementation — it would produce numbers users plan with that are wrong by tens of percent. The plan below is built around that risk.

---

## 2. The eight measures — operational summary

| # | Measure | Status (12 May 2026) | Commences | Cut-over for grandfathering | Engine impact |
|---|---|---|---|---|---|
| 1 | **Negative gearing restricted to new builds** (residential property) | Announced | 1 Jul 2027 (FY 2027–28) | 7:30pm AEST 12 May 2026 | **Tier 1** — `negativeGearing.ts` + asset metadata |
| 2 | **CGT — 50% discount replaced** with cost-base indexation + 30% minimum tax rate (individuals / trusts / partnerships / complying super) | Announced | 1 Jul 2027 | 7:30pm AEST 12 May 2026 | **Tier 1** — `cgtDiscount.ts` + new `cgtIndexation.ts` + `cgtMinimumRate.ts` |
| 3 | **30% minimum tax on discretionary-trust *taxable income*** (broader than just capital gains) | Announced | 1 Jul 2028 | Rollover relief 1 Jul 2027 – 30 Jun 2030 | **Tier 1** — new `trustMinimumTax.ts` |
| 4 | **Foreign-resident CGT regime strengthened** — TARP broadened in Div 855; PAT becomes 365-day; >$50M notification to ATO; renewables 50% concession to 30 Jun 2030 | **Exposure draft published 10 Apr 2026; consultation closed 24 Apr 2026** | TBC (Royal Assent) | TARP expansion has retrospective reach to CGT events from 12 Dec 2006 | **Tier 1** — `lib/tax-engine/boundaries/foreignResidentCgt.ts` (new) |
| 5 | **Loss refundability** — companies <$1B turnover can carry-back losses 2 yrs (from FY 2026–27); start-up loss refundability up to FBT+withholding (from FY 2028–29); R&D Tax Incentive reworked (from FY 2028–29) | Announced | Carry-back: FY 2026–27 (already this FY); start-up: 1 Jul 2028; R&DTI: 1 Jul 2028 | n/a | **Tier 1** (carry-back is current FY) — new `lib/tax-engine/divisions/lossRefundability.ts` |
| 6 | **Foreign-purchase ban on established dwellings extended** | Already law — extended | Ban runs until 30 Jun 2029 | n/a | **Tier 2** — advisor/UI flag, not a calc |
| 7 | **Venture-capital incentive caps lifted** (VCLP investee asset cap $250M→$480M; ESVCLP investee asset cap $50M→$80M, total cap $200M→$270M) | Announced | 1 Jul 2027 (new + existing funds) | n/a | **Tier 2** — config update in `taxYearConfig.ts`, surfaced in advisor knowledge pack |
| 8 | **Electric-car FBT** phased transition (full exemption ≤ 31 Mar 2027; then ≤$75k full + $75k–LCT 25% discount; then 25% discount only from 1 Apr 2029) | Announced | Phase 2 from 1 Apr 2027; Phase 3 from 1 Apr 2029 | n/a | **Tier 3** — `fbtConfig.ts` per-FY tiering |
| 9 | **Dynamic PAYG instalments** (monthly opt-in for SMEs via accounting-software-embedded calc) | Announced | 1 Jul 2027 | n/a | **Tier 3** — cashflow forecast UX + config flag |

> **Tier discipline:** Tier 1 = touches the calc; Tier 2 = touches advisor knowledge + UI flags; Tier 3 = touches FBT/PAYG configs + cashflow UX. We do Tier 1 carefully and in order.

---

## 3. What's NOT yet operationally clear (open questions for each exposure draft)

The Budget-night summaries give the headline but not the load-bearing detail. Each item below is a question we *cannot* resolve from memory or commentary — we resolve it from the exposure draft + Explanatory Memorandum text. **None of these are pedantry — each one changes the SQL/calc one-to-one.**

### Measure 1 (negative gearing)
1. Asset-class scope — confirmed residential property; **confirm** whether shares / units / crypto with associated interest deductions are out of scope (universally assumed but not in the headline).
2. "New build" definition — public detail so far: not previously sold (unless first owner = builder + ≤12 months unoccupied) OR built on vacant land OR off-the-plan. Demolition+rebuild qualifies only if net-additional dwellings. Open: when does newness *expire* on resale to the first non-builder owner? Off-the-plan held by speculators?
3. Refinancing of a grandfathered property post-2027 — does it disturb grandfathering?
4. Capital improvements / extensions on a grandfathered property — partial loss of grandfathering?
5. Entity-type scope — applies to individuals + trusts + partnerships in the head announcement; **confirm** companies (which don't get a discount anyway) and SMSF (which have separate borrowing rules under LRBA / s67A) treatment.

### Measure 2 (CGT — indexation + 30% floor)
1. Which index — almost certainly CPI All-Groups Quarterly (matches pre-1999 regime) but confirm.
2. Index calculation cadence — quarter of acquisition vs quarter of disposal? Mid-quarter?
3. Treatment of Div 43 capital-works deductions in the indexed cost base — does the indexed amount reduce by the deductions claimed (current rule), or is the indexation applied to the pre-reduction cost?
4. Incidental costs — indexed from the date *they* were incurred, or pooled to acquisition?
5. The "30% minimum" mechanic — floor on the discounted gain only, or on the gross gain? Capital losses applied *before* or *after* the floor?
6. Interaction with Div 152 small-business CGT concessions (which already produce 0%–50% effective rates) — preserved as-is or layered?
7. Foreign-resident proportional rule (Subdiv 115-D) — preserved as-is, abolished, or recomputed?

### Measure 3 (discretionary trust 30% min)
1. Excluded trust types named: fixed/unit/widely-held/complying super/charitable/deceased estates/special disability/fixed testamentary. **Confirm** the exclusion test (is it the *deed* terms or the *behaviour* — i.e. a trust that *can* sprinkle vs one that *does*?).
2. Beneficiary credit mechanic — non-corporate beneficiaries get non-refundable credits. **Confirm** rates of integration (top-up vs lost-credit pathways across the marginal brackets).
3. Corporate beneficiaries — confirmed NO credit ⇒ double-tax. Will this be tested under any specific anti-avoidance lens (Part IVA) for transitions?
4. Primary production / vulnerable-minor income exclusions — what's the asset/income test?
5. The 3-year rollover relief — what asset transfers qualify (corporate restructure rollover Subdiv 615 / Subdiv 124-N analogue)? Stamp-duty interaction (state-by-state)?

### Measure 4 (foreign-resident CGT — exposure draft already published)
1. **Lower uncertainty here** — exposure draft text is what we'd implement against. Open: final retrospective scope (the 12 Dec 2006 reach generated industry pushback; final law may temper it).
2. "Renewable energy infrastructure" definition for the 50% concession — boundary list.
3. The $50M notification threshold — gross vs net of liabilities; aggregated vs per-deal.

### Measure 5 (loss refundability)
1. Loss carry-back already exists in policy (it ran FY 2020–21 to FY 2022–23 as COVID stimulus). Confirm whether the new measure resurrects that mechanic verbatim or modifies it.
2. Start-up "FBT + withholding paid on wages" cap — gross or net of refunds; per-FY or cumulative.
3. R&D Tax Incentive — the offset-rate uplift (+4.5pp) applies to "core" R&D; intensity threshold drop 2%→1.5% — confirm the activity-eligibility test changes (or just the rates).

### Measures 6–9
- Foreign-purchase ban: already law, just an extension — no draft needed.
- VC caps: just numbers in a config — but confirm whether the cap applies *at investment time* or *throughout the holding period*.
- EV FBT: confirm the LCT fuel-efficient threshold figure for each FY's calc.
- Dynamic PAYG: implementation detail — confirm how the "ATO-approved accounting-software calc" reaches our cashflow forecast.

> **Rule:** every Stage 2 module ships with an `UNCOMPUTED` marker for any open question above that the exposure draft fails to resolve. We do not guess in the calc.

---

## 4. Architecture — how the engine + advisor absorb this

We are not rebuilding. The current architecture is already shaped for this:

### 4.1 Tax engine (`lib/tax-engine/`)

Existing modules and their extension points:

| Module | What it does today | What changes |
|---|---|---|
| `divisions/cgtDiscount.ts` | Per-entity Div 115 rate dispatch (50% / 33⅓% / 0%) with ITAA citations + UNCOMPUTED for foreign-resident edge | Add an FY-keyed branch — pre-FY 2027-28 = current rules; FY 2027-28+ = `cgtDiscount` returns 0% for individuals/trusts/general, with the new-build opt-in + the SMSF rule per the final law. Per-entity-type matrix gains a row for the discretionary-trust FY 2028-29 cut-over. |
| `divisions/negativeGearing.ts` | Current "loss against other income" treatment | Add a branch: post-cut-over residential acquisitions that aren't `isNewBuild` → loss quarantined (or disallowed — depends on final law). UNCOMPUTED on the contract-vs-settlement-date ambiguity. |
| `divisions/cgtIndexation.ts` *(new)* | — | Implements the indexation formula against `getTaxYearConfig(fy).cpiQuarterlyIndex`. Citations: the new ITAA amendments. |
| `divisions/cgtMinimumRate.ts` *(new)* | — | Implements the 30% floor logic (interaction with marginal rate, capital losses, the pensioner exemption). |
| `divisions/trustMinimumTax.ts` *(new)* | — | The 30% trust-taxable-income minimum (Measure 3). Excluded-trust-type check, beneficiary-credit computation, corporate-beneficiary double-tax flag. |
| `divisions/lossRefundability.ts` *(new)* | — | Carry-back logic (FY 2026–27 onwards), start-up loss refundability (FY 2028–29), R&DTI rate uplift. Branches by company turnover + age. |
| `divisions/foreignResidentCgt.ts` *(new)* | — | Div 855 TARP expansion + 365-day PAT + >$50M notification flag + renewables 50% concession. Implements against the published exposure draft. Replaces the conservative `UC-FOREIGN-RESIDENT-CGT-DISCOUNT-APPORTIONMENT` flag currently surfaced inside `divisions/cgtDiscount.ts` (Subdiv 115-D apportionment is not computed in v1) — once the reform rule is on, the discount module flips its proportional dispatch onto this module. |
| `config/taxYearConfig.ts` | Year-keyed AU tax thresholds (current FY 2024-25; FY 2025-26 next) | Add `TAX_YEAR_2027_28` with the new rule keys (`cgtRegime: 'INDEXATION_PLUS_FLOOR'`, `cgtMinRate: 0.30`, `cpiQuarterlyIndex: ATO_CPI_TABLE`, `negativeGearingNewBuildOnly: true`, etc.). FY 2026-27 stays on current rules. |
| `entity/` | Per-`LegalEntity` rule dispatch (Phase 41) | Trust type refinement: `DISCRETIONARY` / `FIXED` / `UNIT` / `TESTAMENTARY_FIXED` / `CHARITABLE` / `DECEASED_ESTATE` / `SPECIAL_DISABILITY` (drives the FY 2028-29 30%-min branch). |
| `orchestrator/masterTaxPosition.ts` | The canonical tax orchestrator | Picks up the new modules transparently — no changes to the orchestrator interface, only to the dispatch table. |

**Pattern:** every new module follows the existing Phase 41e shape — pure function, no DB, no fetch, ITAA citation in the header, UNCOMPUTED flags for edges, full unit tests pinning the transition cases.

### 4.2 Data model (`prisma/schema.prisma`)

Additive only. The reform is **timing-critical** — getting `contract date` vs `settlement date` wrong by even a single day around the 7:30pm AEST 12 May 2026 cut-over puts a user in the wrong regime (grandfathered forever vs post-reform restricted forever). Treat this section as load-bearing.

**The cut-over moment (verbatim from Treasury fact sheet):**

> Acquisitions where the **contract was signed** at or before **7:30pm AEST on 12 May 2026** are grandfathered under the pre-reform rules indefinitely (50% CGT discount + negative gearing offset against other income). Acquisitions where the contract was signed **after** that moment fall under the post-reform regime once each measure commences.

In UTC: **`2026-05-12T09:30:00Z`** (AEST is UTC+10; AEDT does NOT apply on 12 May because daylight saving ends the first Sunday in April). This is the single canonical timestamp; every grandfathering test in the engine uses it. Stored as a constant in `lib/tax-engine/config/reformConstants.ts` (Stage 1 new file).

**`Property`** (existing) gains:
- `acquisitionContractDate DateTime?` — the **contract** date (CGT event A1 per s109-5 ITAA 1997). Distinct from existing `purchaseDate` (which is ambiguous — could be either contract or settlement date). The reform cut-over is contract-based; **`acquisitionContractDate` is the load-bearing column**.
- `acquisitionSettlementDate DateTime?` — for clarity + edge cases (e.g. off-the-plan where contract is years before settlement). Not used for the cut-over test.
- `isNewBuild Boolean?` — user-confirmed. UNCOMPUTED on post-cut-over acquisitions if unset (we cannot guess from address alone).
- `newBuildEvidence NewBuildEvidence?` enum — `NEVER_SOLD` / `BUILDER_FIRST_OWNER_UNDER_12M` / `VACANT_LAND_BUILD` / `OFF_THE_PLAN` / `DEMO_REBUILD_NET_ADD`. Audits the `isNewBuild` claim so future review can verify.
- Existing `purchaseDate` is **kept as-is** — already widely used in the codebase; renaming would touch ~40 files. Treat it as "best-available date" for backwards-compatible UI; the engine reads `acquisitionContractDate` first, falls back to `purchaseDate` with an UNCOMPUTED flag.

**One-time backfill rules** (idempotent, additive — runs in the same migration):
- `acquisitionContractDate := purchaseDate` where `purchaseDate < '2026-05-12T09:30:00Z'`. These properties are unambiguously grandfathered — the only failure mode is "we said grandfathered when actually post-reform", which is impossible if the existing `purchaseDate` predates the cut-over by any margin.
- `acquisitionContractDate := NULL` where `purchaseDate >= '2026-05-12T09:30:00Z'`. The user must confirm the actual contract date (because `purchaseDate` for these rows could be either contract or settlement, and around the cut-over the difference matters). UI nudges these properties for user confirmation; the engine returns `UC-PROPERTY-CONTRACT-DATE-UNKNOWN` until confirmed.

**`Investment`** (existing — `InvestmentHolding` + `InvestmentTransaction` + `PurchaseLot`):
- `PurchaseLot.purchaseDate` already exists (Phase 23). For CGT purposes this is the per-lot acquisition date. **No new column needed for grandfathering** — the cut-over test reads `purchaseLot.purchaseDate < '2026-05-12T09:30:00Z'` directly.
- Stage 2 (CGT indexation mechanic) may add per-lot `costBaseIndexed Float?` cache field — defer the schema decision until the exposure draft pins the indexation cadence.

**`LegalEntity`** (Phase 41 existing) gains:
- `trustType TrustType?` enum — `DISCRETIONARY` / `FIXED` / `UNIT` / `TESTAMENTARY_FIXED` / `CHARITABLE` / `DECEASED_ESTATE` / `SPECIAL_DISABILITY` / `OTHER`. Drives the Measure-3 dispatch (only DISCRETIONARY trusts are subject to the 30% minimum). Nullable + defaults to NULL for existing non-trust entities; for existing `type === 'DISCRETIONARY_TRUST'` entities, backfill sets `trustType := 'DISCRETIONARY'` (these are unambiguous — Phase 41a's `LegalEntityType.DISCRETIONARY_TRUST` means *exactly* a discretionary trust). Other trust subtypes (fixed/unit/etc.) need user confirmation via the entity-detail UI; until set, the engine treats them as `OTHER` and surfaces `UC-TRUST-TYPE-UNKNOWN`.

**Migration shape:** purely additive (`ADD COLUMN IF NOT EXISTS`), all new columns nullable, all enum values additive. §12.11 N/A — backfill UPDATE statements only run on rows where the new column is NULL and the WHERE clause is unambiguous (the cut-over date test is a stable timestamp); no risk of clobbering user-entered data because the columns being written did not exist before this migration.

**Indexes:** add `@@index([acquisitionContractDate])` on `Property` — the grandfathering test runs on every snapshot computation; a btree on the column makes the "any post-cut-over property?" query O(log n).

### 4.3 AI advisor (`lib/ai/tax-advisor/*`) — the bigger surface

The current advisor is already gateway-bound (`lib/ai/tax-advisor/gateway.ts`) and has 11 tools in the registry (FACT_LOOKUP × 7 — `getCgtExposure`, `getContributionCapHeadroom`, `getDiv7aRisk`, `getEntityTaxPosition`, `getInHouseAssetRatio`, `getLandTaxPosition`, `getTrustDeedRules`; SCENARIO_RUN × 4 — `runCgtScenario`, `runContributionScenario`, `runDiv7aRefinanceScenario`, `runLandTaxScenario`). The `ToolKind` discriminant is a closed set (`FACT_LOOKUP | SCENARIO_RUN` — no `RECOMMENDATION` kind exists; the registry literally cannot contain a recommendation tool — see `lib/ai/tax-advisor/registry.ts`). To carry the reform changes through to the advisor:

**New tools** (each is a FACT_LOOKUP or SCENARIO_RUN — never a recommendation surface):
- `getReformedTaxRegimeStatus(propertyId | investmentId)` — returns `{regime: 'PRE_REFORM_GRANDFATHERED' | 'POST_REFORM_NEW_BUILD' | 'POST_REFORM_RESTRICTED' | 'UNKNOWN', commencementDate, citation}` so the AI can explain a property's status without inventing it.
- `runReformedCgtScenario({ propertyId, hypotheticalSaleDate, hypotheticalSalePrice, indexation? })` — produces deltas: pre-reform CGT vs post-reform CGT (the indexation route + the 30% floor), with citations. The user-facing surface for "what if I sell on / before / after 1 July 2027?"
- `runStructuringScenario({ assets, candidateStructure: 'PERSONAL' | 'DISCRETIONARY_TRUST' | 'COMPANY_BUCKETED' | 'UNIT_TRUST' | 'SMSF' })` — produces the comparative tax projection across structures *given the reform* (Measure 3 changes the discretionary-trust case fundamentally). **NEVER recommends a structure** — surfaces the deltas + the Ask-a-Pro routing.
- `getTrustReformImpact(entityId)` — returns the projected Measure-3 impact for a specific `LegalEntity` of type `DISCRETIONARY_TRUST`, including the 3-year rollover-relief window and the assist for restructure-out timing.
- `getEvFbtRegime(vehicleId, fy)` — Measure 8 phased transition.
- `getCarryBackEligibility(entityId)` — Measure 5 for company entities.

**New knowledge pack** — `lib/ai/tax-advisor/knowledge/reform-2026-27.ts` (or similar) — a structured set of facts + citations the gateway injects into the system prompt when a question is detected as touching reform-affected territory. Examples:
- Cut-over: 7:30pm AEST 12 May 2026.
- Commencement dates per measure.
- "New build" definition (verbatim from Treasury fact sheet) + ATO link.
- Trust exclusion list (verbatim).
- Citations to ITAA section amendments (filled in once the Bills are introduced).

The knowledge pack is **versioned** — every entry has `as-of` date + a `status: 'announced' | 'exposure-draft' | 'bill' | 'assented'` field. The system prompt instructs the AI to surface the status when citing (so a user asking "what's the rule?" sees "Announced in the 12 May 2026 Budget; final law TBC" rather than "the rule is…"). This is non-negotiable per the financial-adviser lens.

**No gateway-mechanic change** — the new tools register in `lib/ai/tax-advisor/index.ts` like the existing 11, and the same `executeTool` callback + `policy/validators.ts` HR-1/HR-2/D-2 chain applies. Validators already block: bare numbers not traceable to a tool result (HR-1 leak), authority text not traceable to a citation (HR-2 leak), recommendation verbs like *"you should" / "I recommend" / "transfer to" / "salary sacrifice"* (D-2 leak — auto-routed to `BLOCKED_RECOMMENDATION` → Ask-a-Pro). The new tools must pass the same boundary-check at PR review.

> Provider selection (Gemini vs Claude) for the structuring-advice surface is a separate decision — see `docs/architecture/AI_PROVIDER_STRATEGY.md`.

### 4.4 UI surfaces

| Surface | Change |
|---|---|
| **Property detail dialog** (`/dashboard/balances`, `/dashboard/properties`) | New "Tax treatment" line: `Grandfathered (pre-12 May 2026 7:30pm AEST)` / `Post-reform — new build` / `Post-reform — restricted; negative gearing not available from FY 2027-28` / `Acquisition date unknown — confirm to compute`. Warm-words framing (CLAUDE.md §14). |
| **CFO Guide / `/dashboard/cfo`** | One-time "Tax rules are changing" card surfaced once per user, calm tone, *lead with the good news* (existing investors grandfathered), *then* explain forward implications. Per-user dismissable. |
| **CFO Guide → Tax Planning Scenarios** | New scenario template: "What changes for me under the 2026–27 reforms?" Runs `runReformedCgtScenario` + a per-property `getReformedTaxRegimeStatus` + a structure comparison if the user has trust/company entities. Output cites every number to the engine + cites the rule status (announced / exposure draft / law). |
| **Entity detail (`/dashboard/entities/[id]`)** | For trusts: a new "Trust-tax reform impact" card showing the Measure-3 projection (FY 2028-29+), the rollover-relief window (1 Jul 2027 – 30 Jun 2030), and an Ask-a-Pro CTA if the projection suggests structural rethinking is warranted. **No "you should change your structure" copy — ever.** |
| **Investment dialogs** | Add `acquisitionDate` field if not present; surface the FY 2027-28 CGT regime cut-over for forward-looking sale scenarios. |
| **Vehicle / FBT surface** | Phase 2/3 EV FBT tiering surfaced on the vehicle detail (Measure 8). |
| **Cashflow forecast** | Dynamic-PAYG opt-in flag (Measure 9) — surfaced as an option, not auto-applied. |
| **Compliance archive** | Conversation archive (Phase 32C, 7-yr retention) — for any adviser↔client message referencing a reform-affected position, the citation snapshot at the time of advice is preserved automatically (this matters when the law changes between the conversation and a future audit). |

---

## 5. Staging — per §9 versioning protocol (Phase 41 §9)

Phase 41 §9 is explicit:
> *"New Federal legislation: don't enable the rule until Royal Assent + commencement date confirmed. Until then the module exists but returns `uncomputedReasons: ['Awaiting Royal Assent of [Bill]']`."*

So the staging follows that pattern verbatim. **All module *files* ship in Stage 1.** What gates per-measure is the *rule mechanic* — which we can implement as the exposure draft text drops, and flip on Royal Assent.

### Stage 1 — Scaffold + module skeletons (one PR, ship now)

Every Tier 1 measure gets a module *file* in this PR — but each returns the appropriate `uncomputedReasons` flag until the exposure draft is final and Royal Assent is verified.

1. **Schema migration** — additive columns on `Property`, `Investment`, `LegalEntity` (per §4.2). One-shot backfill flags pre-cut-over properties as `PRE_REFORM_GRANDFATHERED` where the contract date is known; UNCOMPUTED otherwise.
2. **Module skeletons** for each Tier 1 measure:
   - `divisions/cgtIndexation.ts` (Measure 2 — returns `UC-CGT-INDEXATION-PENDING-EXPOSURE-DRAFT` until Treasury text lands).
   - `divisions/cgtMinimumRate.ts` (Measure 2 — `UC-CGT-MIN-RATE-PENDING-EXPOSURE-DRAFT`).
   - `divisions/trustMinimumTax.ts` (Measure 3 — `UC-TRUST-MIN-TAX-PENDING-EXPOSURE-DRAFT`).
   - `divisions/foreignResidentCgt.ts` (Measure 4 — **exposure draft already published**, so this one can implement the rule mechanic in Stage 1, gated only by Royal Assent: `UC-FR-CGT-PENDING-ROYAL-ASSENT`).
   - `divisions/lossRefundability.ts` (Measure 5 — carry-back is *current FY*, so this implements + gates on Royal Assent only).
3. **`taxYearConfig.ts` extension** — `TAX_YEAR_2027_28` skeleton with the reform-keyed fields present but flagged. FY 2026-27 stays on current rules.
4. **AI advisor reform-2026-27 knowledge pack** — versioned facts + citations; surfaced via system-prompt injection when a tax-reform-touching question is detected. Every entry has `status: 'announced' | 'exposure-draft' | 'bill' | 'assented'` + `commencementVerified: boolean`.
5. **AI advisor `getReformedTaxRegimeStatus` tool** — FACT_LOOKUP only (per §11.1 / 41h.0 — `FACT_LOOKUP | SCENARIO_RUN` are the only `ToolKind`s; no `RECOMMENDATION`). Wraps the existing engine's per-asset regime computation.
6. **UI per-asset "Tax treatment" badge** — read from the computed `negativeGearingRegime` / `cgtRegime`.
7. **CFO Guide one-time card** — "Tax rules are changing" calm explainer; warm-words framing per CLAUDE.md §14.
8. **`UNCOMPUTED.md` register entries** — one per measure, per the Phase 41 §10 convention. Each names: the canonical authority (when known), the reason for the gate (no draft / no Bill / no Assent), the test fixture path (when populated), the planned removal trigger.
9. **This design doc** + updates to `IMPLEMENTATION_PLAN.md`, `MASTER_BLUEPRINT.md` §4, and a changelog entry.

**What Stage 1 deliberately does NOT do:** ship a calc that uses the reform rules to compute post-reform numbers. Every reform-keyed branch returns `UNCOMPUTED` until the exposure draft (or Royal Assent, for Measure 4) is in.

**Effort:** ~5–7 days of engineering. One PR (with the schema migration + the module skeletons + the AI tool + the UI badge + the CFO card + the docs).

### Stage 2 — Rule-mechanic implementation, as each exposure draft drops

Per measure, per draft. Each Stage-2 sub-PR replaces the `UC-*-PENDING-EXPOSURE-DRAFT` return with the implemented rule + flips to `UC-*-PENDING-ROYAL-ASSENT` (still gated until the Bill assents, per §9). The module file is already in `main` from Stage 1 — Stage 2 just fills in the mechanic.

Likely sequencing (driven by Treasury's exposure-draft schedule):

- **Measure 4 (foreign-resident CGT)** — **can ship in Stage 1** since the exposure draft was published 10 Apr 2026 (consultation closed 24 Apr 2026). Module file + actual rule mechanic + tests against fixtures lifted verbatim from the exposure draft. ~5 days included in Stage 1's PR if scope allows; otherwise the immediate follow-up PR.
- **Measure 5 (loss refundability — carry-back)** — carry-back is *current FY 2026–27*, so this is the next-most-urgent. Wait for the implementing Bill if one's already in the parliamentary pipeline; otherwise ship the module returning `UC-LOSS-CARRYBACK-PENDING-BILL`. ~3–4 days when the Bill text is final.
- **Measure 1 + 2 (negative gearing + CGT)** — biggest measure; depends on the exposure draft. Likely Q4 2026 / Q1 2027. ~10–15 days when the draft is final.
- **Measure 3 (discretionary-trust 30% min)** — likely Q1 2027 exposure draft. ~5–7 days. **Intersects with Phase 41f.4 (trust-deed extracted rules)** — CONFIRMED deed rules from Phase 41f feed the beneficiary-credit computation.
- **Measure 8 (EV FBT phased)** — Phase 2 commences 1 Apr 2027. The mechanic is purely config (per-FY thresholds), so this is the smallest module. ~2–3 days when the implementing Bill is final.
- **Measures 6, 7, 9** — Tier 2/3 config/knowledge-pack updates. ~1 day each.

**Each Stage-2 sub-PR ships:** the module's rule-mechanic implementation + unit tests pinning the rule against ATO worked-example fixtures (per Phase 41 §1 principle 4 — "Fixtures come from ATO worked examples") + the AI advisor scenario tool (where applicable) + the knowledge-pack status bump (`exposure-draft` → `bill`) + UNCOMPUTED register update + Phase doc + changelog.

### Stage 3 — Royal Assent flip + polish (per measure)

When each Act assents:
- Module's UNCOMPUTED flag flipped off via the per-measure `commencementVerified` flag in `taxYearConfig.ts` — the exact pattern proven in 41e.3's `highIncomeSuperTax.ts` (Div 296: when `div296CommencementVerified === false` the calc returns `0` and surfaces `UC-DIV-296-PENDING`; flipping the flag activates the rule with zero further code change).
- Citation database: `bill` → `assented` (with the actual Act + section number).
- UI copy strips any remaining "based on the announcement; final law TBC" caveats.
- CFO Guide one-time "law just changed — here's what it means for *your* book" notification card.
- Compliance archive: the citation snapshot for any conversation in the previous 7 years that references the reform-affected rule is preserved (the snapshot doesn't change, but the live citation is now `assented` not `announced`).

---

## 6. The structuring-advice surface — the boundary-critical case

Reza's question 2026-05-13: *"if a user asks the AI bot on suggestions on if they should sell an investment property due to negative cash flow and based on the recent law changes… or even AI to suggest changing the structure like trust or company of the user based on the financials"*.

This is **squarely** in the territory of personal financial advice (AFSL — Corporations Act s766B) and personal tax advice (TASA / TPB registration). The AI **cannot** give it. It can, however, do useful things adjacent to it — and the Phase 41 architecture is already built for that boundary.

### What the AI CAN do (HR-1 / HR-2 / D-2 compliant)

1. **Quantify scenarios from the deterministic engine.** `runReformedCgtScenario({ propertyId, hypotheticalSaleDate, hypotheticalSalePrice })` returns: "If you sell on 15 Jun 2027 at $X, projected after-tax proceeds = $A under the current 50% discount. If you sell on 15 Aug 2027 at the same price, projected after-tax proceeds = $B under the new indexation + 30% floor regime. Delta = $C. Source: Monitrax CGT scenario engine; rule status: announced — final law TBC."
2. **Quantify *current* cashflow and tax position.** "Your Brunswick property is currently negatively geared by $X/month; the negative gearing is grandfathered under the pre-12 May 2026 rules — that won't change. The CGT discount on sale, however, *will* change for sales after 1 Jul 2027."
3. **Surface structural comparisons.** `runStructuringScenario({ assets, candidateStructure: 'DISCRETIONARY_TRUST' })` returns: "If your portfolio were held in a discretionary trust today, the projected tax position would be $X under current rules. Under the Measure 3 reform (30% minimum tax on trust taxable income, FY 2028-29 onwards), the projected position would be $Y. The 3-year rollover-relief window for restructuring out of discretionary trusts runs 1 Jul 2027 – 30 Jun 2030. **Restructuring decisions are personal advice — Ask a Professional.**"
4. **Route to Ask-a-Pro.** Existing `askAProRouting.ts` maps the question → the right discipline: structuring → `TAX_AGENT` (TPB-registered) + optionally `FINANCIAL_ADVISOR` (AFSL); the Phase 32C marketplace surfaces verified professionals.

### What the AI MUST NOT do

1. **Recommend a sell or hold.** Even with all the numbers in front of it. The decision depends on the user's personal circumstances (cashflow needs, opportunity cost, family situation, alternative investments, debt structure, etc.) — and the AI has only a fragment of those, and even with all of them, the *advice* requires an AFSL/TPB licence.
2. **Recommend a structure change.** Same logic — moving an asset into a trust or company has stamp duty, CGT-event, FIRB (foreign-investor), corporate-governance, and ongoing-compliance implications the AI can't weigh.
3. **Project numbers from its own reasoning.** Every number must come from the deterministic engine (HR-1 — the gateway validator enforces this). If the engine can't produce a number, the AI says "I can't compute this — Ask a Professional" rather than estimating.
4. **Quote tax-law text the engine doesn't anchor.** Citations come from the knowledge pack only (HR-2). If a user asks about a rule the pack doesn't cover, the AI says "I don't have that on file — the ATO page is the canonical source: [link]" rather than recalling.

### How the boundary is structurally enforced

- **Gateway validator chain** (`policy/validators.ts` — already exists): every AI response is post-validated for HR-1 (no fabricated numbers — must trace to a tool call's result), HR-2 (no free-form authority text — must trace to a citation), D-2 (no recommendation surface — phrases like "I recommend" / "you should" / "consider doing X" trigger `BLOCKED_RECOMMENDATION` → automatic Ask-a-Pro route).
- **System prompt** (`policy/systemPrompt.ts` — already exists): the persona is *educational explainer*, not adviser. Surfaces the boundary explicitly on every response.
- **Tool registry** (`registry.ts` — already exists): a finite, code-reviewed list. No tool can emit a recommendation. New reform tools added in §4.3 inherit this discipline.
- **Audit log** (`audit/auditLogger.ts` — already exists): every advisor call writes a row to `AdminAuditLog` capturing: tool calls made, citations surfaced, validator outcomes, response status. CDR-sanitised (§13.3). This is the 7-yr compliance record.

> **Test of the architecture:** if you give the gateway a question "Should I sell my Brunswick property because of the new rules?", the response is *forced* (by `BLOCKED_RECOMMENDATION` → Ask-a-Pro route) to be: "I can show you the projected numbers under the current and post-reform rules. Selling decisions are personal advice — here's how to connect with a registered professional: [Ask-a-Pro card]. Here are the numbers: [scenario output]." This already works for non-reform tax questions; the reform-aware tools slot in without changing the boundary.

---

## 7. CDR / compliance posture (CLAUDE.md §13)

- The reform doesn't change *what* CDR data we hold — same Basiq connections, same accounts and transactions. It changes the *calculations* we run on it.
- The AI advisor never sends CDR data to the LLM provider verbatim — tools return aggregates (e.g. `getEntityTaxPosition` returns the *position*, not the transactions). This is already enforced and is unchanged by the reform.
- The compliance archive (Phase 32C 7-yr conversations) now needs to capture the *rule status* at the time of advice (announced / exposure draft / bill / assented). Added to the knowledge-pack versioning. Audit trail unchanged in shape; just one more field.

---

## 8. Sources

The Budget-night canonical sources (ATO + Treasury). My WebFetch hits these with 403 — content read via WebSearch summaries of advisory-firm analyses (Baker McKenzie, Pitcher Partners, BDO, William Buck, KPMG, EY, PwC, Clayton Utz, Ashurst, Grant Thornton, RSM); the URLs are the canonical references reviewers should consult directly.

**Cross-cutting**
- [Tax reform | Budget 2026–27](https://budget.gov.au/content/04-tax-reform.htm)
- [BUDGET MEASURES BUDGET PAPER NO. 2 (Budget 2026-27) (PDF)](https://budget.gov.au/content/bp2/download/bp2_2026-27.pdf)
- [Latest news on tax and superannuation law and policy | ATO](https://www.ato.gov.au/about-ato/new-legislation/latest-news-on-tax-law-and-policy)

**Measures 1 + 2 — Negative gearing + CGT**
- [Tax reform – Boosting home ownership – Reforming negative gearing and capital gains tax | ATO](https://www.ato.gov.au/about-ato/new-legislation/in-detail/individuals/tax-reform-boosting-home-ownership-reforming-negative-gearing-and-capital-gains-tax)
- [Negative Gearing and Capital Gains Tax Reform — Treasury fact sheet (PDF)](https://budget.gov.au/content/factsheets/download/tax-explainers-negative-gearing-capital-gains-tax.pdf)
- [Australia: Budget Bites — CGT Discount and Negative Gearing | Baker McKenzie](https://www.bakermckenzie.com/en/insight/publications/2026/05/australia-budget-bites-cgt-discount-and-negative-gearing)
- [Federal Budget 2026–27: Negative gearing | Pitcher Partners](https://www.pitcher.com.au/insights/federal-budget-2026-27-negative-gearing/)

**Measure 3 — Discretionary-trust 30% minimum**
- [Tax reform – introducing a minimum tax on discretionary trusts | ATO](https://www.ato.gov.au/about-ato/new-legislation/in-detail/businesses/tax-reform-introducing-a-minimum-tax-on-discretionary-trusts)
- [Australian Budget 2026-27: sweeping tax changes | Clayton Utz](https://www.claytonutz.com/insights/2026/may/australian-budget-2026-27-sweeping-tax-changes-to-bring-foreseeable-and-unintended-consequences-for-investors)
- [30 per cent minimum tax on discretionary trusts | BDO](https://www.bdo.com.au/en-au/insights/budget/2026/30-per-cent-minimum-tax-on-discretionary-trusts)

**Measure 4 — Foreign-resident CGT**
- [Strengthening the foreign resident capital gains tax regime | ATO](https://www.ato.gov.au/about-ato/new-legislation/in-detail/businesses/strengthening-the-foreign-resident-cgt-regime)
- [Strengthening the foreign resident capital gains tax regime | Treasury Consultation (exposure draft)](https://consult.treasury.gov.au/c2026-755475)
- [Draft law: Proposals to broaden Australia's foreign resident CGT regime | EY Australia](https://www.ey.com/en_au/technical/tax/tax-alerts/2026/draft-law-proposals-to-broaden-australias-foreign-resident-cgt-regime)

**Measure 5 — Loss refundability + R&D**
- [Tax reform – loss refundability reforms for businesses and start-ups | ATO](https://www.ato.gov.au/about-ato/new-legislation/in-detail/businesses/tax-reform-loss-refundability-reforms-for-businesses-and-start-ups)
- [Federal Budget Analysis 2026 | R&D and Technology | William Buck](https://williambuck.com/tools/federal-budget-2026/rd-and-technology/)

**Measure 6 — Foreign-purchase ban**
- [Banning foreign purchases of established dwellings | ATO](https://www.ato.gov.au/about-ato/new-legislation/in-detail/international/banning-foreign-purchases-of-established-dwellings)
- [Changes to foreign purchases of established dwellings | foreigninvestment.gov.au](https://foreigninvestment.gov.au/news-and-reports/news/changes-foreign-purchases-established-dwellings)

**Measure 7 — Venture capital**
- [Tax reform – expanding venture capital incentives | ATO](https://www.ato.gov.au/about-ato/new-legislation/in-detail/businesses/tax-reform-expanding-venture-capital-incentives)
- [Expansion of venture capital tax incentives | BDO](https://www.bdo.com.au/en-au/insights/budget/2026/expansion-of-venture-capital-tax-incentives)

**Measure 8 — EV FBT**
- [Electric car discount – more sustainable FBT treatment of electric cars | ATO](https://www.ato.gov.au/about-ato/new-legislation/in-detail/businesses/electric-car-discount-more-sustainable-fbt-treatment-of-electric-cars)
- [Farewell to the full FBT exemption on Electric Vehicles | BDO](https://www.bdo.com.au/en-au/insights/budget/2026/farewell-to-the-full-fbt-exemption-on-evs)

**Measure 9 — Dynamic PAYG**
- [Dynamic pay as you go instalments – making tax simpler for businesses | ATO](https://www.ato.gov.au/about-ato/new-legislation/in-detail/businesses/dynamic-pay-as-you-go-instalments-making-tax-simpler-for-businesses)

---

## 9. Decision points + next-PR shape

**Decisions Reza needs to make before Stage 1 ships:**
1. Confirm the staging — Stage 1 (scaffold + advisory + knowledge pack) now, Stage 2 (per-measure rule modules) as exposure drafts drop. Or do everything in one big PR when all drafts are out.
2. Confirm the *order* within Stage 2 — Measure 4 (foreign-resident CGT, draft already published) is the first code-ready one. Should it go *before* Stage 1 (since the draft is here) or *after* (so we have the scaffold in place)?
3. Confirm the AI provider strategy — `docs/architecture/AI_PROVIDER_STRATEGY.md` (sibling doc this PR adds) — for the structuring-advice surface specifically.

**Next-PR shape (Stage 1) — see §10 for the per-measure implementation spec:**
- Schema migration (additive columns on `Property`, new `TrustType` enum on `LegalEntity`, no `Investment` schema change yet).
- New `lib/tax-engine/config/reformConstants.ts` (the 2026-05-12 09:30 UTC cut-over moment as a single canonical constant + helpers).
- Five module skeletons under `lib/tax-engine/divisions/` (Measures 1, 2, 3, 4, 5) — each returns its measure's `UC-*-PENDING-*` flag per §10.
- `taxYearConfig.ts` extension — eight new `*CommencementVerified: boolean` flags + `TAX_YEAR_2027_28` skeleton.
- Reform-2026-27 knowledge pack in `lib/ai/tax-advisor/knowledge/reform-2026-27.ts`.
- One new advisor tool: `getReformedTaxRegimeStatus` (FACT_LOOKUP).
- UI badges on the property detail dialog + one-time CFO Guide "Tax rules are changing" card.
- Tests pinning the per-property + per-asset regime computation against ATO worked examples.
- ~5–7 days. One PR.

If Reza approves the staging + ordering + Q-AI-PROVIDER (sibling doc), I'd open the Stage 1 PR next.

---

## 10. Per-measure implementation spec with timing logic — the load-bearing detail

> **This section is the contract for Stage 1.** Each measure below maps to exactly one engine module + one set of schema columns + one knowledge-pack entry + one (or more) AI tools + one UI surface. The timing/grandfathering logic is the most easily-broken piece of the reform; this section pins it explicitly so an engineer can pick up Stage 1 from the document alone.
>
> **Grandfathering principle (uniform across measures 1 + 2):** The test is **contract date**, not settlement date, not registration date, not occupancy date. Per s109-5 ITAA 1997 the CGT event A1 date for an acquisition is the contract date — the same convention we follow for the reform cut-over. Storing `acquisitionContractDate` separately from `acquisitionSettlementDate` is the only way to be right on the day-of-cut-over edge.

### 10.1 Measure 1 — Negative gearing restricted to new builds (residential property)

**Commencement:** 1 July 2027 (start of FY 2027-28). Until then, **all** existing rules apply (Div 8 + Div 36 unchanged).

**Cut-over for grandfathering:** **7:30pm AEST 12 May 2026 = `2026-05-12T09:30:00Z` UTC**. A residential property whose **contract was signed at or before** that moment is grandfathered under the pre-reform negative-gearing rules **indefinitely** — even if disposed and re-acquired by a new owner, the new owner does NOT inherit the grandfathering (per Treasury fact sheet; the grandfathering attaches to the contract, not the asset).

**Asset/entity scope:**
- **Affected:** Residential property held by individuals + sole traders + partnerships + discretionary trusts + unit trusts.
- **Excluded** (announcement is silent → confirmed via §3 Measure 1 open question 1): commercial property, industrial property, shares/units/crypto with associated interest deductions, business-loan negative gearing.
- **TBC** (§3 Q5): companies (already trapped, no discount; Treasury silent on whether the new rule layers on top); SMSFs (LRBA borrowing has its own s67A regime — the reform may carve them out).

**The mechanic:**

```ts
// New file: lib/tax-engine/divisions/negativeGearingRegime.ts (Stage 1)
export type NegativeGearingRegime =
  | 'PRE_REFORM_GRANDFATHERED'      // contract <= 2026-05-12T09:30:00Z → unchanged
  | 'POST_REFORM_NEW_BUILD'          // contract > cut-over + isNewBuild === true → offset allowed
  | 'POST_REFORM_RESTRICTED'         // contract > cut-over + !isNewBuild → loss quarantined
  | 'UC_PROPERTY_CONTRACT_DATE_UNKNOWN'    // missing data → UNCOMPUTED
  | 'UC_NEW_BUILD_UNCONFIRMED';            // post-cut-over + isNewBuild unset → UNCOMPUTED

export function deriveNegativeGearingRegime(input: {
  propertyType: PropertyType;
  contractDate: Date | null;
  isNewBuild: boolean | null;
  fy: string;  // "2027-28" etc.
  config: TaxYearConfig;
}): NegativeGearingRegime {
  // Pre-commencement FY → existing rules apply regardless of contract date.
  if (!isPostCommencementFy(input.fy, input.config)) return 'PRE_REFORM_GRANDFATHERED';
  // Non-residential → out of scope (reform only touches residential).
  if (!isResidential(input.propertyType)) return 'PRE_REFORM_GRANDFATHERED';
  // Missing contract date → cannot determine regime.
  if (!input.contractDate) return 'UC_PROPERTY_CONTRACT_DATE_UNKNOWN';
  // Pre-cut-over → grandfathered for life.
  if (input.contractDate.getTime() <= REFORM_CUT_OVER_UTC) return 'PRE_REFORM_GRANDFATHERED';
  // Post-cut-over → newness gates the regime.
  if (input.isNewBuild === null) return 'UC_NEW_BUILD_UNCONFIRMED';
  return input.isNewBuild ? 'POST_REFORM_NEW_BUILD' : 'POST_REFORM_RESTRICTED';
}
```

**Engine wiring:** `applyNegativeGearing` (existing in `divisions/negativeGearing.ts`) gains a new `regime` parameter. When `regime === 'POST_REFORM_RESTRICTED'`, the function flips the existing `ENTITY_OFFSETS_OWN_INCOME` map's "true" branches to false for the per-property loss — the loss carries forward against that property's future income instead of offsetting other income. Behaviour for `PRE_REFORM_GRANDFATHERED` + `POST_REFORM_NEW_BUILD` is byte-for-byte the current behaviour. **No behaviour change for any property whose contract was signed by 2026-05-12T09:30:00Z** — that's the whole psychological promise of grandfathering.

**Stage 1 — what ships:**
- Module file `divisions/negativeGearingRegime.ts` with `deriveNegativeGearingRegime()` + the typed regime union.
- `applyNegativeGearing` signature extended with `regime` param (defaults to `'PRE_REFORM_GRANDFATHERED'` so existing call sites are byte-for-byte unchanged).
- `Property` schema gains `acquisitionContractDate` + `acquisitionSettlementDate` + `isNewBuild` + `newBuildEvidence`.
- Returns `UC-NEG-GEARING-REFORM-PENDING-EXPOSURE-DRAFT` until the exposure draft pins refinancing + capital-improvement edge cases (§3 Measure 1 Q3, Q4).
- `taxYearConfig.ts`: new `negativeGearingReformCommencementVerified: false` flag (gates the regime branch).

**Stage 2 — what fills in:**
- Exposure draft resolves §3 Q1-Q5 (asset-class scope confirmation, new-build definition precision, refinancing behaviour, capital-improvement behaviour, entity-type carve-outs).
- The loss-quarantine mechanic specifics — does the loss carry forward at the property level only (most likely) or at the entity level? Affects how `lossCarriedForward` is bucketed in the existing `NegativeGearingResult`.

**Test fixtures:** ATO will publish worked examples once the Bill is introduced. Pin against those verbatim. Minimum fixture set for Stage 1: (a) property contracted 11 May 2026 → grandfathered; (b) property contracted 13 May 2026 + isNewBuild=true → POST_REFORM_NEW_BUILD; (c) property contracted 13 May 2026 + isNewBuild=false → POST_REFORM_RESTRICTED; (d) property contracted 13 May 2026 + isNewBuild=null → UC_NEW_BUILD_UNCONFIRMED.

### 10.2 Measure 2 — CGT 50% discount → cost-base indexation + 30% minimum tax rate

**Commencement:** 1 July 2027 (start of FY 2027-28). CGT events A1 (disposal) **on or before** 30 June 2027 use the existing 50% discount rules; events **on or after** 1 July 2027 use the new regime.

**Cut-over for grandfathering:** **Same `2026-05-12T09:30:00Z` cut-over as Measure 1, on the acquisition contract date.** Assets acquired (contract signed) at or before the cut-over keep the 50% discount even on disposals after 1 July 2027 (per Treasury fact sheet — "existing investments are grandfathered"). Assets acquired after the cut-over use the new regime on any disposal from 1 July 2027 onwards.

**Asset/entity scope:** All CGT assets held by individuals + sole traders + partnerships + discretionary trusts + unit trusts + complying super funds. Companies unchanged (already get no discount per s115-280). Foreign-resident apportionment (Subdiv 115-D) — same UNCOMPUTED treatment as today, **unless** Measure 4 (foreign-resident CGT) ships first and replaces it.

**The mechanic** (per Treasury fact sheet; precise formula awaits exposure draft):

1. **Indexed cost base** = original cost base × (CPI at disposal quarter ÷ CPI at acquisition quarter).
2. **Indexed gain** = sale price − indexed cost base.
3. **Discounted gain** = indexed gain (no 50% knockdown — replaced by the indexation).
4. **Minimum tax floor** = max(indexed gain × 0.30, indexed gain × marginal tax rate). I.e. the **effective tax rate** on a capital gain is at least 30%, regardless of the user's marginal rate (the floor only bites for users in the 16% / 30% brackets; above 30% the marginal rate already exceeds 30%).
5. **Capital losses** — the announcement is silent on whether losses are applied before or after the floor (§3 Q5 open). Treat as UNCOMPUTED until exposure draft resolves.

**Engine wiring:** **Three new modules + one edit:**
- `lib/tax-engine/divisions/cgtIndexation.ts` (new) — computes indexed cost base from `(costBase, acquisitionQuarter, disposalQuarter)` against a CPI table in `taxYearConfig.cpiQuarterlyIndex`.
- `lib/tax-engine/divisions/cgtMinimumRate.ts` (new) — applies the 30% floor given `(indexedGain, marginalRate)`.
- `lib/tax-engine/divisions/cgtDiscount.ts` (existing) — gains a regime branch at the top: when `cgtIndexationCommencementVerified === true && acquisitionContractDate > cutOver && disposalFy >= '2027-28'`, returns `discountRate: 0` with `reason: 'POST_REFORM — see cgtIndexation + cgtMinimumRate'`, leaving the existing 50%/33⅓%/0% dispatch in place for all grandfathered + pre-FY-2027-28 cases. **Backwards-compatible**: behaviour for any disposal before 1 July 2027, or any asset contracted before 2026-05-12T09:30Z, is byte-for-byte unchanged.

**Stage 1 — what ships:**
- Module skeletons for `cgtIndexation.ts` + `cgtMinimumRate.ts`, each returning `UC-CGT-INDEXATION-PENDING-EXPOSURE-DRAFT` + `UC-CGT-MIN-RATE-PENDING-EXPOSURE-DRAFT` respectively.
- `cgtDiscount.ts` gains a regime-aware top-of-function guard that, when the reform flags are off, is a no-op (byte-for-byte today's behaviour).
- `taxYearConfig.ts`: `cgtIndexationCommencementVerified: false` + `cgtMinRateCommencementVerified: false` flags + a `cpiQuarterlyIndex` field placeholder (empty record; populated in Stage 2 from ATO's published CPI table).
- **Critically: zero behavioural change on Stage 1 deploy.** Every CGT calc continues producing the same number it does today. The gate is the `commencementVerified` flags + the FY check, both of which fail until Stage 2.

**Stage 2 — what fills in:**
- Resolves §3 Q1-Q7 (which index — almost certainly CPI All-Groups Quarterly; cadence — quarter of acquisition vs disposal; Div 43 interaction; incidental costs; floor mechanic; Div 152 SBC interaction; foreign-resident apportionment).
- Populate `cpiQuarterlyIndex` from ATO's historical CPI table (published quarterly; one-time data import).
- Flip `cgtIndexationCommencementVerified := true` + `cgtMinRateCommencementVerified := true` on Royal Assent.

**Test fixtures:** Worked examples come from the exposure draft Explanatory Memorandum. Stage 1 fixture set: (a) asset acquired 1 Jul 2020, disposed 1 Jul 2026 → existing 50% discount (FY 2026-27 = pre-commencement); (b) asset acquired 1 Jul 2020, disposed 1 Jul 2027 → existing 50% discount (grandfathered by acquisition date); (c) asset acquired 1 Jul 2027, disposed 1 Jul 2028 → POST-REFORM regime, returns UNCOMPUTED in Stage 1.

### 10.3 Measure 3 — 30% minimum tax on discretionary-trust taxable income

**Commencement:** 1 July 2028 (start of FY 2028-29). Pre-commencement FYs unchanged.

**Cut-over for grandfathering / rollover relief:** Rollover relief window runs **1 July 2027 – 30 June 2030**. During this 3-year window, restructuring assets out of a discretionary trust qualifies for a corporate-restructure-style rollover (no CGT event A1 on the transfer). The trust-tax measure itself has no grandfathering of in-trust assets — the 30% minimum applies to **all** discretionary-trust *taxable income* from FY 2028-29 onwards, regardless of when the trust was settled or assets acquired.

**Asset/entity scope:** **DISCRETIONARY trusts only** — fixed, unit, widely-held, complying super, charitable, deceased-estate, special-disability, and fixed-testamentary trusts are explicitly excluded per the Treasury announcement.

**The mechanic:**

1. Compute trust's **taxable income** per existing Div 6 + Div 6E rules (Phase 41e.4 already does this).
2. Compute **minimum tax** = trust taxable income × 0.30.
3. Compute **actual tax** = sum of beneficiaries' marginal tax on distributed income (which is what gets paid today; corporate beneficiaries pay 25%/30%, individuals pay marginal).
4. **Trust pays the difference** if `actualTax < minimumTax`. Corporate beneficiaries receive **no franking credit** for the top-up tax (per Treasury — this is the integrity measure that makes the rule bite); non-corporate beneficiaries receive a **non-refundable credit** for the top-up.

**Engine wiring:** `lib/tax-engine/divisions/trustMinimumTax.ts` (new). Reads from `MasterTaxPosition.entities[trustId]` (Phase 41e.17) — the trust's computed taxable income + the per-beneficiary marginal allocation. **Intersects with Phase 41f.4** — when `TrustDeedExtractedRules.status === 'CONFIRMED'`, the deed rules tell us whether each beneficiary is corporate or non-corporate (affects credit treatment) + whether income streaming is permitted (affects the actualTax computation).

**Stage 1 — what ships:**
- Module skeleton `divisions/trustMinimumTax.ts` returning `UC-TRUST-MIN-TAX-PENDING-EXPOSURE-DRAFT`.
- `LegalEntity` schema gains `trustType TrustType?` enum (the dispatch input).
- One-time backfill: every existing `LegalEntity.type === 'DISCRETIONARY_TRUST'` gets `trustType := 'DISCRETIONARY'` (unambiguous mapping). Other trust types (unit, charitable, etc.) need user confirmation in the entity-detail UI.
- `taxYearConfig.ts`: `trustMinTaxCommencementVerified: false` flag.

**Stage 2 — what fills in:**
- Resolves §3 Q1-Q5 (excluded-trust-type test — deed vs behaviour; beneficiary credit integration rates; corporate beneficiary double-tax under Part IVA; primary-production / vulnerable-minor exclusions; rollover-relief asset transfers).
- Wire `TrustDeedExtractedRules` (Phase 41f.4 CONFIRMED rules) into the dispatch so corporate-beneficiary detection is data-driven, not estimated.

**Test fixtures:** ATO worked examples from the Bill EM. Stage 1 fixture: (a) discretionary trust with $200k taxable income distributed entirely to two individual beneficiaries at the top marginal rate → actualTax ≈ $94k (47%) → 30% min = $60k → no top-up. (b) same trust distributed entirely to a Pty Ltd bucket company → actualTax = $50k (25% small-business rate) → 30% min = $60k → trust pays $10k extra, NOT franked.

### 10.4 Measure 4 — Foreign-resident CGT regime strengthened (Div 855)

**Commencement:** TBC — exposure draft published 10 April 2026, consultation closed 24 April 2026. Royal Assent expected late 2026 or early 2027. Once enacted, applies to CGT events from the commencement date.

**Cut-over / retrospective reach:** The **TARP expansion** (Taxable Australian Real Property — Div 855 indirect-interest test) has **retrospective reach to CGT events from 12 December 2006**. The PAT (Principal Asset Test — the 365-day measurement window) and the >$50M notification threshold apply prospectively. The renewables 50% concession runs to 30 June 2030.

**Asset/entity scope:** Foreign-resident taxpayers + Australian entities with foreign-resident beneficiaries/shareholders. Domestic-only structures unaffected (most Monitrax users).

**The mechanic** (from the exposure draft — therefore code-ready, not memory):
1. **TARP test (s855-25) expanded** — the "real property" definition broadened to include mining/quarrying/prospecting rights regardless of physical extraction stage, plus options + leases over land + similar in-substance interests.
2. **Principal Asset Test (s855-30) becomes 365-day** — replaces the existing point-in-time test. A foreign resident must measure their "TARP-vs-non-TARP" ratio across the **365 days ending on the disposal date**, not on the day of disposal alone. Stops same-day asset shuffling.
3. **>$50M notification (new s855-A)** — disposing of an indirect interest valued >$50M (gross, before liabilities — §3 Q3 open) requires written notice to the ATO at least 14 days before settlement.
4. **Renewables 50% concession** — TARP capital gain on a qualifying renewable-energy-infrastructure asset receives a 50% concession until 30 June 2030. "Qualifying" boundary list TBC (§3 Q2 open).

**Engine wiring:** `lib/tax-engine/divisions/foreignResidentCgt.ts` (new). Sits adjacent to (not inside) `divisions/cgtDiscount.ts` — when Subdiv 115-D applies, the discount module delegates to this new module rather than surfacing `UC-FOREIGN-RESIDENT-CGT`. Reads from the new schema field `LegalEntity.isForeignResident: boolean` (Stage 1 add — defaults false; user confirms in entity wizard if applicable).

**Stage 1 — what ships:**
- Module file `divisions/foreignResidentCgt.ts` with the **actual rule mechanic implemented** (exposure draft text is final). Gated on `foreignResidentCgtCommencementVerified: false` until Royal Assent — flag flip on commencement.
- `LegalEntity` gains `isForeignResident Boolean?` (Stage 1 column add — defaults to NULL, set via wizard).
- `Property` gains `isRenewablesInfrastructure Boolean?` (for the 50% concession dispatch).
- Test fixtures from the exposure draft worked examples (these exist; cite the Treasury Consultation page).

**Stage 2 — what fills in:**
- The retrospective application — for any user with a foreign-resident entity that had CGT events between 12 Dec 2006 and now, the engine needs to re-evaluate the TARP test under the expanded definition. UNCOMPUTED for v1; user must confirm via professional review.
- The "Qualifying renewable-energy-infrastructure asset" boundary list (§3 Q2) — populated when ATO publishes the determination.

**Test fixtures:** Lift verbatim from the exposure draft EM (Treasury Consultation paper §3-§5).

### 10.5 Measure 5 — Loss refundability + carry-back + R&DTI rework

**Commencement (three sub-measures, different dates):**
- **Loss carry-back for companies < $1B turnover** — current FY (FY 2026-27 onwards). **Most urgent of all reform measures** — happening this FY.
- **Start-up loss refundability** (up to FBT + withholding paid) — FY 2028-29 onwards.
- **R&DTI rework** (offset-rate uplift +4.5pp for "core" R&D; intensity threshold drop 2% → 1.5%) — FY 2028-29 onwards.

**Cut-over:** None for carry-back (no grandfathering — applies to FY 2026-27 losses prospectively). None for start-up + R&DTI (FY-based commencement).

**Asset/entity scope:** Companies only (carry-back + start-up R&D). Excludes individuals, trusts, sole traders.

**The mechanic — loss carry-back** (resurrects the 2020-22 COVID stimulus mechanic, per Treasury):
1. A company with a tax loss in current FY (e.g. FY 2026-27) can elect to **carry back** that loss against the prior 2 years' tax paid (FY 2024-25, FY 2025-26).
2. **Refund cap** = lesser of (the loss carried back × prior year's rate) and the prior year's franking account balance.
3. The carry-back is **elective** — the company chooses whether to use it.

**Engine wiring:** `lib/tax-engine/divisions/lossRefundability.ts` (new). Reads from `MasterTaxPosition.entities[companyId]` (existing) + a new `CompanyTaxHistory` model (small additive — `{ entityId, fy, taxablePosition, taxPaid, frankingAccountBalance }` keyed per entity per FY).

**Stage 1 — what ships:**
- Module file `divisions/lossRefundability.ts` implementing the carry-back mechanic against the COVID stimulus precedent (no exposure draft for this one — Treasury intends to mirror the 2020-22 mechanic). Gated on `lossCarryBackCommencementVerified: false` until the implementing Bill assents.
- `CompanyTaxHistory` schema model + helper to read.
- UI: on company entity detail, a "Carry-back election" affordance that, when the engine returns a `refundEligible > 0` projection, surfaces the option (warm-words: "You may be able to claim back $X from prior years" — never "you should claim").

**Stage 2 — what fills in:**
- Start-up loss refundability (FY 2028-29) — new sub-module.
- R&DTI rate-table updates in `taxYearConfig.ts` (the rate changes are config, not code).

**Test fixtures:** Lift the COVID-era loss-carry-back fixtures from existing 2020-22 ATO worked examples — the mechanic is verbatim per the Treasury announcement.

### 10.6 Measure 6 — Foreign-purchase ban on established dwellings extended (already law)

**Commencement:** Already law. Extended ban runs **until 30 June 2029**.

**Cut-over:** N/A — already in force.

**Asset/entity scope:** Foreign residents purchasing established (i.e. not new build) residential property.

**Engine wiring:** **Tier 2 — no calc change.** Advisor knowledge pack gains an entry; UI gains a flag on property-purchase scenarios when the user is foreign-resident.

**Stage 1 — what ships:** Knowledge-pack entry + an advisor `getForeignPurchaseEligibility(entityId)` tool (FACT_LOOKUP).

### 10.7 Measure 7 — Venture-capital incentive caps lifted

**Commencement:** 1 July 2027 (new + existing funds).

**Cut-over:** Existing funds benefit too (per Treasury) — no grandfathering complication. **Open question (§3 Q3)** — does the cap apply at investment time or throughout the holding period? Resolves with the implementing Bill.

**Engine wiring:** **Tier 2 — config-only change.** `taxYearConfig.ts` gains `vclpInvesteeAssetCap`, `esvclpInvesteeAssetCap`, `esvclpTotalCap` fields keyed per FY. Advisor knowledge pack gains an entry.

**Stage 1 — what ships:** Config fields with FY-2027-28+ values populated (announced numbers: VCLP $250M → $480M, ESVCLP $50M → $80M + $200M → $270M total) + the `Q3 holding-period` question UNCOMPUTED until clarified.

### 10.8 Measure 8 — Electric-car FBT phased transition

**Commencement (three phases):**
- **Phase 1** (existing, until 31 Mar 2027): full FBT exemption on eligible EVs ≤ LCT threshold.
- **Phase 2** (1 Apr 2027 – 31 Mar 2029): full exemption ≤ $75k value; 25% discount $75k–LCT-threshold.
- **Phase 3** (from 1 Apr 2029): 25% discount only (no full exemption).

**Cut-over:** FY-based commencement; no contract-date grandfathering. EVs novated in Phase 1 retain Phase 1 treatment **for the life of the novation** (per ATO position on existing novated arrangements — confirm via implementing Bill).

**Engine wiring:** **Tier 3 — config-only.** Existing `fbtConfig.ts` (if present, else new) gains per-FY EV exemption tier table.

**Stage 1 — what ships:** Config fields per FY 2026-27 + FY 2027-28 + FY 2028-29 + FY 2029-30, gated on `evFbtPhase2CommencementVerified` / `evFbtPhase3CommencementVerified` flags. Vehicle detail UI gains an FBT-tier badge per FY.

### 10.9 Measure 9 — Dynamic PAYG instalments (monthly opt-in for SMEs)

**Commencement:** 1 July 2027.

**Cut-over:** None — opt-in only.

**Engine wiring:** **Tier 3 — cashflow forecast UX + config flag.** The existing cashflow forecast (`lib/calculations/cashflowOrchestrator.ts`) gets an `paygCadence: 'QUARTERLY' | 'MONTHLY'` option that affects the timing of tax-instalment outflows. No new calc engine — just a forecast distribution change.

**Stage 1 — what ships:** Config flag + a `Dynamic PAYG opt-in` toggle on the business-entity Settings (surfaced as an option, never auto-applied per CLAUDE.md §14 warm-words).

### 10.10 AI advisor — "Reform impact for me" summary surface (cross-measure)

> **Reza directive 2026-05-16:** *"The AI advisor should also provide a summary of the law changes and the impact on each individual users, and should provide a realistic suggestions based on the same."* This sub-section operationalises that directive within the existing D-2 AFSL boundary (no recommendations — only facts, scenarios, and Ask-a-Pro routing).

**What the user gets:** A single ask — *"How do the new tax laws affect me?"* — produces a structured AI response with three parts, all driven by the deterministic engine + the knowledge pack, never by LLM memory:

1. **Summary of the law changes** (HR-2 — knowledge-pack-driven, fact-only). The AI narrates the eight measures + their commencement dates + their grandfathering cut-over, citing Treasury / ATO sources. Every claim carries the knowledge-pack `status` field — *announced / exposure-draft / bill / assented* — so the user sees the rule's maturity.
2. **Personalised impact** (HR-1 — numbers from the engine). For *this* user, the AI calls the engine to enumerate which measures affect them and by how much: per-property regime classification (`getReformedTaxRegimeStatus`), per-discretionary-trust 30%-min projection (`getTrustReformImpact`), per-company carry-back eligibility (`getCarryBackEligibility`), per-EV FBT-phase impact (`getEvFbtRegime`), foreign-resident exposure (`getForeignResidentTarpExposure`). Where a measure's mechanic isn't yet live (Stage 1 ships M4 + M5 mechanics; M1/M2/M3 are skeleton-only), the surface returns the regime classification + an explicit `UNCOMPUTED — Monitrax will compute your projected impact once the exposure draft + Royal Assent are confirmed`.
3. **Realistic suggestions** (D-2 — within the AFSL boundary). The AI surfaces SCENARIOS via existing scenario tools ("if you sold Brunswick on 15 Jun 2027 at $X, projected after-tax proceeds = $A under the current 50% discount; on 15 Aug 2027 = $B under indexation + 30% floor; delta = $C"), TIMING FACTS ("the 3-year discretionary-trust rollover-relief window runs 1 Jul 2027 – 30 Jun 2030"), and ASK-A-PRO routing ("the decision of whether to sell or restructure is personal advice — here's a TPB-registered tax agent who can help"). **NEVER recommends** sell/hold/restructure/transfer/timing — the validator chain catches recommendation verbs and routes to `BLOCKED_RECOMMENDATION` → Ask-a-Pro card.

**New AI tool — `getReformImpactSummaryForUser`** (SCENARIO_RUN — composes the other reform tools):

```ts
// lib/ai/tax-advisor/tools/getReformImpactSummaryForUser.ts (Stage 1)
export const getReformImpactSummaryForUserTool: TaxAdvisorTool<{ userId: string }> = {
  name: 'getReformImpactSummaryForUser',
  kind: 'SCENARIO_RUN',
  description:
    'Returns the per-measure reform impact for the requesting user, ' +
    'composed from per-asset / per-entity regime status + scenario deltas ' +
    'where each measure\'s mechanic is live. Returns UNCOMPUTED for ' +
    'measures whose mechanics are not yet enabled (commencementVerified=false). ' +
    'Output is FACT — never a recommendation. The narrative surface uses ' +
    'this tool to answer "how do the new tax laws affect me?" without the ' +
    'LLM inventing numbers (HR-1) or claims about AU law (HR-2).',
  // ... input schema + executor that calls the per-measure tools + aggregates
};
```

**Where the user encounters this surface:**
- **CFO Guide "Tax rules are changing" card** — the calm one-time card (per the 5-point confirmation 2026-05-16) is the entry point. The CTA on the card is *"Show me my position"* — opens `/dashboard/cfo/ask` with the prefilled question *"How do the 2026-27 tax reforms affect me?"*.
- **`/dashboard/cfo/ask` direct prompt** — user can ask the question at any time. The new tool composes the answer.
- **Per-asset detail dialog** — the existing tax-treatment badge gets a *"What does this mean for me?"* link that opens the same surface scoped to that single asset.

**Stage gating for this surface:**

| Stage | What the user-asked summary returns |
|---|---|
| **Stage 1** (this PR family) | Summary of the eight measures (full narrative from knowledge pack) + per-property regime classification + per-entity trust-type display + per-vehicle EV-FBT phase + per-company carry-back eligibility (Measure 5 — current FY, mechanic is live). For M1/M2/M3 measures with skeleton-only modules: regime classification + "Monitrax will compute your projected impact once Treasury publishes the exposure draft" UNCOMPUTED narration. **No dollar projections yet for the post-reform CGT or restricted-loss math.** |
| **Stage 2** (per-measure follow-ups) | Each Stage-2 PR populates its measure's dollar projections + scenario tool. By the time M1+M2 mechanics land, the surface answers fully — "your property contracted 13 May 2026 (post-cut-over) will lose negative-gearing offset against other income from 1 Jul 2027; projected impact on your FY 2027-28 cashflow = $X based on the current loss of $Y/month, all else equal." Each Stage-2 PR adds a UI fixture pinning the surface's per-measure output. |
| **Stage 3** (Royal Assent flip) | Knowledge-pack status flips `bill` → `assented`; the surface narration upgrades from *"announced — final law TBC"* to *"in force from \[date\]"*. No code change for this transition — just the flag flip in `taxYearConfig.ts` (the `commencementVerified` boolean) + the knowledge pack's `status` field. |

**What this surface deliberately does NOT do** (load-bearing — protects the AFSL boundary):
- ❌ Never says *"you should sell"* / *"you should restructure"* / *"consider transferring to a trust"* — the validator chain rejects these verbs and auto-routes to Ask-a-Pro.
- ❌ Never projects numbers for a measure whose mechanic is not live — returns UNCOMPUTED, never a guess.
- ❌ Never quotes AU law text that's not in the knowledge pack — HR-2 enforcement.
- ❌ Never sends CDR data verbatim to the LLM — the tool result aggregates the user's position; transactions/balances stay in the engine.
- ❌ Never sets up *manufactured urgency* — the 3-year rollover window is a fact ("runs 1 Jul 2027 – 30 Jun 2030"), not a *"act now before…"* push. Behavioural-psychologist guard (per §11.2 dissent ruling).

**How this surface earns its place** (alignment with TRAIL + CLAUDE.md §14):
- TRAIL Stage 5 (Live) — once the user has Track / Reduce / Anchor / Invest in hand, the reform-impact surface helps them stay calm + informed about how the rules around their position are changing. It belongs under "My Guide" alongside the existing AI advisor (already in Stage 5).
- Warm-words framing — *"How do the new tax laws affect me?"* not *"Calculate your tax-reform exposure"*; *"Things to ask a professional about"* not *"Recommended actions"*.
- One Clear Action — every measure that affects the user surfaces ONE concrete next step: either *"Confirm the contract date for X"* (data gap), or *"Run the sell-on-vs-sell-after scenario"* (scenario CTA), or *"Ask a tax agent about Y"* (Ask-a-Pro). Never multiple equal CTAs.

---

## 11. Risks + dissent + decision points

### 11.1 Risks (load-bearing)

| Risk | Lens | Mitigation |
|---|---|---|
| **Contract-date confusion** — engineer treats `Property.purchaseDate` as the cut-over test instead of `acquisitionContractDate`. A user's property contracted 10 May 2026 + settled 20 May 2026 ends up POST_REFORM_RESTRICTED instead of grandfathered. Wrong by tens of $k in tax/year for the life of the property. | Financial Adviser | (a) Schema names the field `acquisitionContractDate` (unambiguous). (b) `deriveNegativeGearingRegime` typescript signature requires it explicitly; falling back to `purchaseDate` is a *separate* code path that surfaces UNCOMPUTED. (c) Test fixtures explicitly cover the 12 May 2026 boundary day. (d) UI nudges users with post-cut-over `purchaseDate` to confirm the actual contract date. |
| **One-time backfill clobbers user data** — the rule writes `acquisitionContractDate := purchaseDate` on all rows with pre-cut-over `purchaseDate`. If the user had manually entered a different contract date previously (impossible today — the column doesn't exist), this would overwrite it. | System Architect | The new column doesn't exist before the migration — there's no prior data to clobber. §12.11 N/A by structural argument: `UPDATE ... WHERE acquisitionContractDate IS NULL AND purchaseDate < cutOver`. The WHERE clause guards against accidental re-runs. |
| **CGT discount module silent-flip on Stage 2 deploy** — the existing `divisions/cgtDiscount.ts` gains a top-of-function regime guard. If the guard logic is wrong, every CGT calc silently returns 0% discount instead of 50%. User-facing numbers go wrong by tens of percent. | System Architect + Financial Adviser | (a) Stage 1 ships the guard with `cgtIndexationCommencementVerified: false` — the guard is a no-op until Stage 2 flips the flag. (b) Phase 41i.6 surface audit (HR-3) catches the drift the moment it ships (rendered tile ≠ canonical engine output). (c) Existing 45+ CGT fixtures stay green throughout Stage 1; any failure blocks the merge. |
| **Knowledge pack drift** — Stage 1 ships the AU-law knowledge pack with `status: 'announced'` everywhere. As exposure drafts land + Bills introduce + Royal Assent passes, the pack must be updated. If it isn't, the AI advisor narrates outdated reform status (and the citation footer says "announced" when the law is now "assented"). | Behaviour Psychologist + Financial Adviser | (a) Each pack entry has a `lastReviewed` date + the §16 doc-sync rule forces an update on every status transition. (b) An admin dashboard surface (`/admin/reform-knowledge-pack`) lists every entry + its current status + last-reviewed date — a single screen tells Reza what's stale. (c) Phase 41i.6 surface audit doesn't catch this directly (knowledge ≠ numerics), but the routine review cadence per `reviewSchedule.nextReviewBy` on `taxYearConfig` already exists. |
| **"Tax rules are changing" copy lands as anxiety, not reassurance** — most users are grandfathered. A scary banner makes them panic-sell or restructure unnecessarily. | Behaviour Psychologist + Designer | Copy spec (CLAUDE.md §14 warm-words):  **Headline:** "Tax rules are changing — and you're already protected." **Body:** "If you bought your properties before 12 May 2026, the old rules keep applying — your negative gearing and 50% CGT discount don't change. For investments you make from now on, the rules are different. Tap below for a personal summary." **CTA:** "Show me my position" (opens the per-property regime badge view + the Ask-a-Pro card if structuring is involved). **Never** lead with "you may pay more tax." **Never** auto-show on every login — one-time, dismissable, accessible later via the CFO Guide. |
| **AI advisor recommends a restructure** — a user asks "should I move my properties into a trust before Measure 3 hits?" — without the validator chain, the AI could narrate the structuring scenario *and* slip a "yes, you should" into the conclusion. AFSL violation. | Security & Compliance + System Architect | Structural defence already in place (D-2): `runStructuringScenario` returns the comparative numbers; the validator chain rejects recommendation verbs ("you should", "I recommend", "transfer to", "move into") and auto-routes to Ask-a-Pro. No new architecture for the reform — the existing boundary holds. PR review of every new reform tool must verify no `RECOMMENDATION` kind sneaks in. |
| **CDR sanitisation slip** — the new reform tools return per-property data (contract dates, regimes). If audit metadata captures the property address by accident, it's CDR-relevant. | Security & Compliance | Existing `sanitizeCdrMetadata()` in `lib/security/cdrAuditCompliance.ts` strips known CDR fields. Reform tools return aggregates + IDs only — no balance / no transaction / no address in tool results. Audit row schema unchanged. |

### 11.2 Load-bearing dissent

The architect-mode synthesis had one genuine pull. The **Growth & Marketing Strategist lens** wanted the "Tax rules are changing" card to lean into urgency — "Time-limited opportunity: 3-year rollover relief ends 30 June 2030" — because it converts the moment into a marketing hook ("we'll help you optimise the rollover window — book a session with an Ask-a-Pro adviser"). The **Behaviour Psychologist lens** + the **Financial Adviser lens** overrule this: manufactured urgency on a 3-year window for users who are mostly grandfathered = anxiety-as-funnel, which is the exact CLAUDE.md §0 / §14 anti-pattern. The architect lens picked the calm copy. If the marketplace conversion rate turns out to be insufficient, the marketing surface lives elsewhere (in the marketplace listing, not on the user's dashboard).

### 11.3 Decision points Reza needs to make (extends §9)

1. **Staging order** — confirm Stage 1 (all 5 module skeletons + schema + knowledge pack + 1 AI tool + UI badges) ships in one PR, with Measures 4 + 5 carrying their actual rule mechanics in Stage 1 since their text is either final (Measure 4 exposure draft) or precedent-matched (Measure 5 carry-back mirrors 2020-22).
2. **Backfill aggressiveness** — should the migration write `acquisitionContractDate := purchaseDate` for ALL pre-cut-over rows (the recommended path), or only for rows where the user has explicitly confirmed `purchaseDate` was the contract date? Default recommendation: write it — the failure mode (declaring grandfathered when actually grandfathered, with the wrong precision of date) is benign.
3. **"Tax rules are changing" card timing** — does it surface on the first login after Stage 1 deploys (recommended — calm framing), or wait until at least one user-affecting commencement date is within 12 months (more conservative — but then the grandfathered users never see it)?
4. **Q-AI-PROVIDER** (sibling doc) — required before any reform-aware AI tool ships, but only weakly — the new tools are provider-agnostic. **DECIDED 2026-05-16: keep Gemini default, pilot Claude on capacity-Q&A.**

---

*If Reza signs off on the staging + the backfill recommendation, the Stage 1 PR opens immediately. The remaining decisions in §11.3 (1-3) can be confirmed at PR review.*

---

## 12. Cross-cutting surface impact matrix — every surface × every measure

> **Why this section exists:** the primary surface per measure is well-covered in §10, but each measure ripples through *secondary* surfaces that consume the engine's output. This matrix is the definitive checklist — every cell is either *unchanged*, a new field, a regime-aware variant, or a brand-new section. An engineer (or a future session) can verify reform completeness by walking the matrix.
>
> Cell legend: `—` = no change; **F** = new field/column; **S** = new section/component; **R** = existing surface gains a regime-aware branch (pre/post-reform); **N** = nudge / warning surface; **V** = new view.

### 12.1 Tier 1 measures (touches the calc)

| Surface | File / route | M1 NegGear | M2 CGT | M3 Trust | M4 FR-CGT | M5 LossRefund |
|---|---|---|---|---|---|---|
| **`getMasterFinancialSnapshot()`** — the canonical SSOT | `lib/services/masterFinancialService.ts` | **F** per-property regime + aggregate `restrictedLossThisFy` | **F** per-asset regime + `cgtRegime` aggregate | **F** per-trust `trustMinTaxImpact` | **F** per-entity `isForeignResident` + TARP exposure | **F** per-company `carryBackEligible` |
| **Cashflow forecast** | `lib/calculations/cashflowOrchestrator.ts` | **R** restricted-property after-tax rental yield drops | **R** CGT realisation outflow timing | **R** trust top-up tax outflow FY 2028-29+ | — | **R** carry-back refund inflow timing |
| **Wealth projection (long-term)** | `lib/services/wealthProjectionService.ts` *(if exists; new if not)* | **R** projection beyond 1 Jul 2027 must apply restricted-loss treatment | **R** projected CGT under indexation regime | **R** trust projections post FY 2028-29 | — | — |
| **Tax report** | `app/dashboard/reports/tax/page.tsx` | **S** "Negative-gearing regime" grouping | **S** "CGT regime" grouping + grandfathering footnote | **S** "Trust minimum tax" line | **S** "Foreign-resident CGT" line | **S** "Loss carry-back" line |
| **CGT report** (Phase 23) | `app/dashboard/reports/capital-gains/page.tsx` *(may need creation)* | — | **R** per-disposal regime + indexed-vs-discount comparison | — | **R** TARP-vs-non-TARP split | — |
| **Property detail dialog** | `components/dashboard/PropertyDetailDialog.tsx` | **S** Tax-treatment badge | **S** CGT regime badge | — | — | — |
| **Investment detail dialog** | `components/dashboard/InvestmentDetailDialog.tsx` *(or holdings drill-in)* | — | **S** CGT regime badge per `PurchaseLot` | — | — | — |
| **Entity detail dialog** | `app/dashboard/entities/[id]/page.tsx` | — | — | **S** "Trust minimum tax impact" card + rollover-window timer | **F** Foreign-resident toggle + warning | **S** "Loss carry-back" affordance for COMPANY entities |
| **Vehicle detail dialog** | (Phase 21 asset detail) | — | — | — | — | — |
| **Onboarding wizard** | `components/onboarding/wizard/*` | **F** `acquisitionContractDate` + `isNewBuild` for post-cut-over property step | — | **F** `trustType` selector on Entities step (already partial — extends Phase 41b) | **F** `isForeignResident` on Entities step | — |
| **CFO Guide** | `app/dashboard/cfo/page.tsx` | **S** one-time "Tax rules are changing" calm-tone card | (same card) | (same card) | (same card) | (same card) |
| **CFO Guide scenarios** | `app/dashboard/cfo/scenarios/*` | **V** "What changes for me under the 2026-27 reforms?" | (same) | (same) | (same) | (same) |
| **Practice portal / adviser overlay** | `app/portal/dashboard` + `app/portal/clients/[id]/view` | **V** "Affected clients" lens — clients with post-cut-over restricted properties | **V** Same lens — clients with material post-cut-over CGT exposure | **V** Same lens — clients with discretionary trusts | **V** Same lens — foreign-resident clients | **V** Same lens — companies with carry-back eligibility |
| **Practice portal alerts** | `lib/portal/alerts/alertEngine.ts` | **R** new trigger `REFORM_RESTRICTED_LOSS_DETECTED` (informational only — never recommendation) | **R** new trigger `REFORM_CGT_ROLLOVER_WINDOW_OPEN` | **R** new trigger `TRUST_REFORM_ROLLOVER_WINDOW_OPEN` (1 Jul 2027 – 30 Jun 2030) | — | **R** new trigger `CARRY_BACK_OPPORTUNITY` |
| **Money Flow Sankey** | `components/wealth/MoneyFlowSankey.tsx` | — | — | **R** trust → beneficiary node flow recomputed post FY 2028-29 (top-up tax becomes a sibling outflow) | — | **R** carry-back creates a new "Tax refund" inflow node for affected companies |
| **Entity Tree** | `components/wealth/EntityTree.tsx` | — | — | **N** affected discretionary-trust nodes carry a subtle indicator + tooltip | **N** foreign-resident entity nodes carry an indicator | — |
| **Health Score** | `lib/health/*` | **R** if "negative-gearing reliance" is a component → re-weight for restricted properties | **R** if "CGT exposure" is a component → re-weight under indexation regime | **R** trust-structure score (if exists) re-weights for FY 2028-29+ | — | — |
| **Document Intelligence / OCR** | `lib/ai/gemini.ts` document extraction | **F** extractor learns to find `acquisitionContractDate` in contract-of-sale uploads | — | **F** trust-deed extractor (Phase 41f.4) already pulls beneficiary types → feeds Measure-3 credit dispatch | — | — |
| **AI advisor knowledge pack** | `lib/ai/tax-advisor/knowledge/reform-2026-27.ts` *(new)* | **F** versioned entry per measure (status + commencement + citation) | (same) | (same) | (same) | (same) |
| **AI advisor tools** | `lib/ai/tax-advisor/tools/*` | **F** `getReformedTaxRegimeStatus` (Stage 1) | **F** `runReformedCgtScenario`, `runStructuringScenario` (Stage 2) | **F** `getTrustReformImpact` (Stage 2) | **F** `getForeignResidentTarpExposure` (Stage 2) | **F** `getCarryBackEligibility` (Stage 2) |
| **AI advisor "Reform impact for me" surface** (§10.10) | `lib/ai/tax-advisor/tools/getReformImpactSummaryForUser.ts` + `/dashboard/cfo/ask` prefilled prompt + CFO Guide card CTA | **V** composes per-property regime status into narrative | **V** composes scenarios + regime status; Stage-2 fills in dollar projections | **V** composes trust-type impact; Stage-2 fills in projections | **V** composes foreign-resident exposure | **V** composes carry-back eligibility |
| **Compliance archive** (Phase 32C 7-yr) | `lib/services/conversationService.ts` | **F** rule-status snapshot per message — citations frozen at the time of advice | (same) | (same) | (same) | (same) |
| **Adviser drill-in canonical client view** (Phase 32B PR3) | `app/portal/clients/[id]/view/page.tsx` | **R** per-property tax-treatment badge visible to adviser | **R** per-asset CGT regime visible | **R** trust-tax impact visible | **R** foreign-resident exposure visible | **R** carry-back opportunity visible |

### 12.2 Tier 2 + Tier 3 measures (advisor + config, no calc engine)

| Surface | File / route | M6 ForeignBan | M7 VC caps | M8 EV FBT | M9 PAYG |
|---|---|---|---|---|---|
| **Property purchase wizard** | onboarding + add-property modal | **N** foreign-resident + established dwelling → warning, no-block | — | — | — |
| **Investment dialog** | investment add/edit | — | **N** VC fund tagged → updated cap awareness in tooltip | — | — |
| **Vehicle detail dialog** | asset detail | — | — | **S** per-FY FBT phase badge + the `firstNovatedDate` field for the "novated in Phase 1 → retains Phase 1 treatment" rule | — |
| **FBT calc / report** | `lib/tax-engine/fbt/*` *(if shipped)* | — | — | **R** per-FY exemption tier table dispatch | — |
| **Cashflow forecast** | `lib/calculations/cashflowOrchestrator.ts` | — | — | **R** salary-sacrificed-EV per-FY cash impact | **R** PAYG cadence option (monthly vs quarterly) |
| **Business entity settings** | entity-detail settings | — | — | — | **F** `paygCadence` toggle (per CLAUDE.md §14 — surface as option, never auto-apply) |
| **AI advisor knowledge pack** | `lib/ai/tax-advisor/knowledge/reform-2026-27.ts` | **F** entry | **F** entry | **F** entry | **F** entry |
| **AI advisor tools** | `lib/ai/tax-advisor/tools/*` | **F** `getForeignPurchaseEligibility` | **F** `getVcCapStatus` (low priority) | **F** `getEvFbtRegime(vehicleId, fy)` | **F** `getPaygCadenceProjection` (low priority) |
| **Tax year config** | `lib/tax-engine/config/taxYearConfig.ts` | — | **F** `vclpInvesteeAssetCap`, `esvclpInvesteeAssetCap`, `esvclpTotalCap` per FY | **F** EV-FBT phase tiers per FY | **F** `paygCadence` per FY |

### 12.3 Stage gating per surface

Not every surface needs to land in Stage 1. Three buckets:

| Stage | Surfaces (from §12.1 + §12.2) |
|---|---|
| **Stage 1 (the foundation PR)** | `getMasterFinancialSnapshot` schema extension; the 5 module skeletons; `taxYearConfig.ts` flags; knowledge pack scaffold; `getReformedTaxRegimeStatus` (1 AI tool); **`getReformImpactSummaryForUser` AI tool (§10.10)** — Stage 1 version returns summary + per-asset regime + Measure 5 carry-back; UNCOMPUTED narration for M1/M2/M3 dollar projections; Property detail tax-treatment badge; Entity detail trust-type field; Vehicle detail EV-FBT-phase badge (config-only); Onboarding wizard new fields; CFO Guide one-time card. **No reports, no projections for M1/M2/M3, no scenarios, no practice-portal lens** — those depend on Stage 2 mechanics being live. |
| **Stage 2 (per-measure rule mechanic PRs)** | Each measure's full engine mechanic + the AI scenario tools for that measure + the report sections + the practice-portal alerts + the entity-tree / Sankey adjustments. Lands as each exposure draft / Bill ships. |
| **Stage 3 (Royal Assent flip PRs)** | Knowledge-pack status bumps to `assented`; UI copy strips the "announced — final law TBC" caveats; CFO Guide "law just changed — here's what it means for *your* book" notification card; compliance archive citation refresh. |

---

## 13. Stage 1 self-check — the discipline (audit existing functions for reform-awareness)

> **Before opening the Stage 1 PR, walk every function in this list and confirm one of three outcomes: (a) the function is reform-aware (takes regime as input), or (b) the function defaults to PRE_REFORM_GRANDFATHERED behaviour with a code comment naming the regime assumption, or (c) the function is gated behind a `commencementVerified` flag in `taxYearConfig.ts` so it returns UNCOMPUTED until reform activates.**
>
> The rule: **no function that touches a CGT calculation, a negative-gearing calculation, a trust-distribution calculation, a company-loss calculation, an FBT calculation, or a PAYG-instalment calculation can stay silent on the reform.** Either it's regime-aware, or it explicitly defaults to grandfathered with a comment.

### 13.1 Functions to audit (Stage 1 reviewer checklist)

| File | Function | Required outcome |
|---|---|---|
| `lib/tax-engine/divisions/negativeGearing.ts` | `applyNegativeGearing` | Add `regime: NegativeGearingRegime` parameter. Default `PRE_REFORM_GRANDFATHERED` for back-compat. |
| `lib/tax-engine/divisions/cgtDiscount.ts` | `calculateCgtDiscount` + `getCgtDiscountRate` | Add regime guard at function top: when `cgtIndexationCommencementVerified && acquisitionContractDate > cutOver && disposalFy >= '2027-28'` → return `{ discountRate: 0, reason: 'POST_REFORM' }` and route caller through `cgtIndexation` + `cgtMinimumRate`. |
| `lib/tax-engine/divisions/negativeGearing.ts` | `entityCanOffsetLossesCurrentFy` | Add overload that takes regime; existing call sites without regime get back-compat behaviour. |
| `lib/tax-engine/divisions/capitalLossNetting.ts` | `applyCapitalLossNetting` | Audit whether loss netting order changes under indexation regime (§3 M2 Q5 open). Until exposure draft, surface UNCOMPUTED for post-reform disposals. |
| `lib/tax-engine/divisions/div152SmallBusinessConcessions.ts` | all functions | Audit interaction with indexation regime (§3 M2 Q6 open). Default: SBC stacks atop the new regime; flag UNCOMPUTED until confirmed. |
| `lib/tax-engine/divisions/trustDistribution.ts` | all functions | Audit for Measure-3 dispatch path. Stage 1 reads `LegalEntity.trustType`; post FY 2028-29 triggers the `trustMinimumTax` consumer. |
| `lib/tax-engine/divisions/companyLossRules.ts` | all functions | Audit for Measure-5 carry-back integration. Stage 1: no change; Stage 2: carry-back module reads from here. |
| `lib/tax-engine/orchestrator/masterTaxPosition.ts` | `computeMasterTaxPosition` | Confirm dispatch picks up new modules (`cgtIndexation`, `cgtMinimumRate`, `trustMinimumTax`, `foreignResidentCgt`, `lossRefundability`) without orchestrator-shape change. New `regime` per asset flows through aggregator. |
| `lib/calculations/cashflowOrchestrator.ts` | `calculateCashflow` + sub-functions | Stage 1 no-op (Stage 2 wires carry-back refund timing + PAYG cadence). Add a comment noting "Phase 41E reform measures may alter cashflow post-2027 — see PHASE_41E_REFORM_2026_27.md §12.1." |
| `lib/services/masterFinancialService.ts` | `getMasterFinancialSnapshot` | Extend the per-property + per-entity snapshot shape with regime fields. Existing consumers see no behaviour change (regime is additive). |
| `lib/cfo/*` | health-score components | Audit whether any score factors CGT exposure or negative-gearing reliance. If so, document the reform-induced re-weighting plan (Stage 2). |
| `lib/portal/alerts/alertEngine.ts` | `computeAlerts` | Stage 1 no-op. Stage 2 adds the 4 new reform-aware triggers per §12.1. |
| `lib/ai/tax-advisor/tools/*` (all 11 existing tools) | each tool's executor | Audit each tool for whether its facts can change under the reform. If yes, the tool's citations must include the reform-status flag (Stage 2). |
| `lib/ai/tax-advisor/tools/getReformImpactSummaryForUser.ts` *(new — §10.10)* | tool executor | Stage 1: composes `getReformedTaxRegimeStatus` per asset + Measure 5 carry-back + summary narration from the knowledge pack. Returns UNCOMPUTED for M1/M2/M3 dollar projections until Stage 2 lands. Output schema MUST pass the same HR-1 (numeric-fields trace to tool results) + HR-2 (citations trace to knowledge pack) + D-2 (no recommendation verbs) validator chain. |
| `lib/services/wealthGraphService.ts` | `classifyDistributionRegime` *(Phase 44 Part 3 Phase 2)* | **FW-1 + FW-2 implemented (2026-05-31).** Returns one of `PRE_REFORM` / `POST_REFORM_VERIFIED` / `POST_REFORM_PENDING` + a verbatim `reformNotice` for the Wealth Universe Money Flow lens. Measure 3 (`TRUST_MINIMUM_TAX`) dispatch only — Measure 3 is the only reform measure that touches trust money-flow ribbons. Aggregator NEVER computes the 30% min-tax amount; the canvas surfaces the gross flow + the notice. Test pin: `tests/wealth-graph/classifyDistributionRegime.test.ts`. |

### 13.2 Test fixtures — the regression wall

The single most-important Stage 1 acceptance criterion: **every existing tax-engine test stays green.** The reform adds capability; it does not change today's behaviour. If a Phase 41e fixture flips from PASS to FAIL during the Stage 1 PR, the change is wrong. Hard rule:

```bash
# Stage 1 PR cannot merge until:
npm test -- lib/tax-engine
# returns: 0 failed, ≥ existing-count passed
```

In addition, the Stage 1 PR adds a **new test suite** `lib/tax-engine/__tests__/reform-2026-27/` with:
- Per-measure regime-derivation tests (the boundary day — 12 May 2026 contract date — must classify correctly to the second).
- Per-module UNCOMPUTED-flag tests (each new module returns the expected `UC-*-PENDING-*` until its `commencementVerified` flag flips).
- A round-trip test that flips each flag → confirms the module activates → flips it back → confirms it deactivates. The activation pathway must be reversible.

---

## 14. Forward-looking discipline — every future build must inherit reform-awareness

> **This section exists because future sessions may not read this Phase doc.** The discipline below ensures that any future engineer (or future Claude session) building on the tax engine, the financial snapshot, the AI advisor, or the entity layer automatically respects the reform's regime + grandfathering logic — not because they remember to, but because the architecture forces them to.

### 14.1 The five forward-looking rules

**FW-1 — Regime is a first-class input.** Any new function that takes a `Property`, an `Investment`, a `PurchaseLot`, or a `LegalEntity` (where the entity is a trust) and computes a tax-relevant output MUST accept a regime parameter (or derive it from the entity's metadata at function entry). Default value, where applicable: `'PRE_REFORM_GRANDFATHERED'` — back-compat preserved.

**FW-2 — No silent post-reform numbers.** Any function that could produce a *different* number under the reform (CGT, negative gearing, trust minimum tax, FBT, PAYG, carry-back) MUST either gate the post-reform branch behind the relevant `commencementVerified` flag in `taxYearConfig.ts` OR return an UNCOMPUTED flag. **Never silently apply post-reform math before Royal Assent is verified.**

**FW-3 — Schema additions to `Property` / `Investment` / `LegalEntity` consider regime impact.** Every PR that adds a column to these models MUST answer: "does this field interact with the reform's grandfathering logic?" If yes, the PR description must list the answer. If unsure, ask before merging.

**FW-4 — AI advisor tools declare their reform-status awareness.** Every new tool in `lib/ai/tax-advisor/tools/` MUST tag its citations with the relevant reform `status: 'announced' | 'exposure-draft' | 'bill' | 'assented'` field when the tool's facts could be affected by the reform. The knowledge pack is the source of truth.

**FW-5 — UI surfaces that display a property / investment / entity tax position MUST surface the regime.** A property detail screen that shows a CGT estimate without naming the regime ("Grandfathered" / "Post-reform — new build" / "Post-reform — restricted") is a CLAUDE.md §16 doc-sync failure: the surface is lying by omission about which rules its numbers are computed under.

### 14.2 PR-template addition (every PR that touches the tax engine, financial snapshot, AI advisor, or entity layer)

```markdown
## Phase 41E reform compliance (CLAUDE.md §12.14 / PHASE_41E_REFORM_2026_27.md §14)

- [ ] Functions/tools added or modified in this PR are listed below.
- [ ] Each is one of: (a) reform-aware (takes regime/derives from entity), (b) explicitly defaults to PRE_REFORM_GRANDFATHERED with a comment, or (c) gated behind `commencementVerified` returning UNCOMPUTED.
- [ ] No existing tax-engine test regressed.
- [ ] If any new field was added to `Property` / `Investment` / `LegalEntity`, the reform-grandfathering impact is documented in the PR body.

Functions/tools touched:
- `path/to/file.ts:functionName` — outcome (a/b/c) — reason: ___________

Reform-status awareness (if AI tool added/modified):
- Tool: ___________ — knowledge-pack entry: ___________ — status flag: ___________
```

### 14.3 Reviewer enforcement

A reviewer (human or Claude in a follow-up session) MUST reject any PR that:
1. Modifies any function in §13.1 above without confirming the §14.2 PR template.
2. Adds a column to `Property` / `Investment` / `LegalEntity` without the reform-grandfathering impact documented.
3. Adds a new AI tool whose facts could be reform-affected without tagging the knowledge-pack status.
4. Adds a UI surface that displays a per-property / per-asset tax position without surfacing the regime badge.

### 14.4 Pointer for future Claude sessions

If you are a future Claude session reading the codebase and you are about to:
- Touch any file under `lib/tax-engine/`, OR
- Add a financial calculation that involves CGT, negative gearing, trust distribution, FBT, PAYG, or company losses, OR
- Add a column to `Property` / `Investment` / `LegalEntity`, OR
- Add a new AI advisor tool, OR
- Build a new property/investment/entity-detail UI surface,

…**STOP and read** `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §10-§14 before writing code. The reform changes how every financial calculation in the app behaves for assets acquired after 7:30pm AEST on 12 May 2026 (UTC: `2026-05-12T09:30:00Z`). A function that ignores this is producing wrong numbers — silently — for a growing fraction of users.

CLAUDE.md §12.14 (added by this PR) enforces this at the project level so it survives across sessions.
