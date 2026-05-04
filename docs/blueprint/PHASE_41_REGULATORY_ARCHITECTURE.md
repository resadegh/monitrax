# Phase 41 — Regulatory Architecture
### *AU Tax & Entity Law Mapping for Monitrax's Entity Layer*

---

> **Status:** v1 architectural blueprint. **Doc-only.** Phase 41e cannot start until this doc is approved.
>
> **Why this exists.** Phase 41 is the most regulatory-dense surface in Monitrax — entity structures, trust distributions, SMSF caps, CGT discounts, state taxes, AFSL/TPB boundaries. Without a written authority-mapping, Phase 41e becomes "we asked Gemini and it sounded right." This doc fixes the architecture so every number Monitrax shows traces back to a section of legislation, an ATO ruling, or an explicit "uncomputed" register entry.
>
> **Owner:** Reza (regulatory sign-off) + Claude (architecture).
>
> **Cadence:** updated whenever a new rule is added to the engine, a rule materially changes (ATO TR / TD update), or a state's tax regime changes. Reviewers reject any Phase 41e/h PR that introduces a regulatory rule not represented here.
>
> **Last updated:** 2026-05-04. Concessional cap, non-concessional cap, bring-forward cap, TBC, and Div 296 status need verification against current ATO data before each FY rolls over (see §9 — versioning protocol).

---

## 1. Operating principles

> *These are the contract between the regulatory architecture and the rest of the codebase. Reviewers reject any 41e/h PR that violates them.*

1. **Authority over assumption.** Every rule cites a primary source — a section of the ITAA, the SIS Act, the Corporations Act, a state Land Tax Act, an ATO Tax Ruling (TR), Tax Determination (TD), Practical Compliance Guideline (PCG), or a Practice Statement (PS LA). LLM output, blog posts, "common practice," and undated tax-firm web pages are NEVER the citation. If Gemini surfaces a rule and we can't find the section, the rule doesn't ship.
2. **SSOT per rule.** One rule = one canonical pure function. CLAUDE.md §6.1, §12.2, §12.3. Composed by `lib/calculations/tax/masterTaxEngine.ts`. Route handlers stay thin. No inline tax math anywhere.
3. **Citation in code.** Every rule module's file-header JSDoc names the authority. Reviewers reject any rule without one.
4. **Fixtures come from ATO worked examples.** Each rule has a sibling `.test.ts` whose fixtures are lifted **verbatim** from ATO TRs / TDs / PBR examples. The test suite *is* the regulatory evidence.
5. **AFSL / TPB / NCCP boundary is structural, not editorial.** The AI advisor surfaces *facts* (Div 115 holding period, contribution cap headroom, in-house asset ratio). It does NOT have a tool primitive that emits *recommendations* (transfer asset, salary sacrifice, refinance). Recommendations channel through Ask-a-Pro. The boundary is enforced by the Gemini tool registry — the AI literally cannot emit personal advice because the tool isn't there. CLAUDE.md §13 + RG 244 + RG 36 + Tax Agent Services Act 2009.
6. **"Uncomputed" is documented.** Every rule we deliberately skip (PSI deep cases, deceased estates, cross-border, family trust elections nuance) gets a row in `lib/calculations/tax/UNCOMPUTED.md`. Reviewers know what's out of scope rather than guessing.
7. **Demo vs PROD scoping is honest.** Demo-complete (per `IMPLEMENTATION_PLAN.md` Phase 41e trimmed): Div 115 + trust distribution flow + SMSF contribution caps + TBC. PROD-ready: s100A, Div 7A, family trust elections, full Div 152, Div 296, state land tax, stamp duty, PSI, service entities. The architecture supports both from day one — what defers is *content*, not *shape*.
8. **Versioning.** Caps + thresholds are time-versioned (FY-indexed). The engine reads the relevant FY's table for the user's reference period. No hard-coded `30000` constants — always `CONCESSIONAL_CAP_BY_FY['2025-2026'] === 30_000`.

---

## 2. Regulatory surface — what's in scope

### 2.1 Income Tax Assessment Acts (Cth)

| Rule | Authority | Demo / PROD | Module |
|---|---|---|---|
| Trust net income → presently entitled beneficiaries | ITAA 1936 Div 6, s95–s99B; TR 2012/D1 | Demo | `divisions/div6.ts` |
| Streaming of franked dividends + capital gains | ITAA 1997 Div 6E; TD 2017/D10; ATO TR 2012/D1 | Demo (basic) → PROD (full) | `divisions/div6E.ts` |
| Reimbursement agreements (s100A) | ITAA 1936 s100A; **TR 2022/4** + **PCG 2022/2** (green-zone vs red-zone) | PROD | `divisions/s100A.ts` |
| Private company loans / payments (Div 7A) | ITAA 1936 Div 7A; s109D, s109N, s109Y; TR 2010/3 | PROD | `divisions/div7A.ts` |
| CGT discount (50% indiv/trust, 33⅓% super, 0% company) | ITAA 1997 Div 115; s115-25, s115-100, s115-280 | **Demo headline** | `divisions/div115.ts` |
| Small business CGT concessions (15-yr, 50% active asset, retirement exemption $500k, rollover) | ITAA 1997 Div 152; s152-10 (basic conditions: $6m MNAV / $2m turnover) | PROD | `divisions/div152.ts` |
| Anti-avoidance flag | ITAA 1936 Part IVA; PS LA 2005/24 | Advisory only — flag, never compute | `divisions/partIVA.ts` |
| Trapped trust losses | ITAA 1936 Sch 2F (Income Injection Test, Pattern of Distributions Test, etc.) | PROD | `losses/trustLossRules.ts` |
| Trapped company losses | ITAA 1997 Div 165 (Continuity of Ownership Test), Div 166 (listed cos), Div 175, Div 707 | PROD | `losses/companyLossRules.ts` |
| Negative gearing (rental loss → salary offset for individuals only) | ITAA 1997 Div 8 (general deductions); PS LA 1998/1 | Demo | `divisions/negativeGearing.ts` |
| Personal Services Income | ITAA 1997 Part 2-42; TR 2022/3 (results test, 80% rule, unrelated clients test, employment test, business premises test) | PROD | `psi/psiRules.ts` |
| Service entity arrangements | TR 2006/2 (Phillips arrangement benchmark) | PROD (advisory flag) | `divisions/serviceEntity.ts` |
| Family Trust Election + Interposed Entity Election | ITAA 1936 Sch 2F; 46.5% TFN withholding to non-quoting beneficiaries | PROD | `divisions/familyTrustElection.ts` |
| Capital loss netting (capital losses applied before CGT discount) | ITAA 1997 s100-50, s115-100 ordering rules | Demo | composed inside `div115.ts` |
| Foreign resident CGT withholding | ITAA 1953 Sch 1 Subdiv 14-D; 12.5% on disposals ≥ $750k | PROD | `divisions/foreignCgtWithholding.ts` |

### 2.2 Superannuation — SIS Act + ITAA

| Rule | Authority | Demo / PROD | Module |
|---|---|---|---|
| Sole purpose test | SIS Act 1993 s62 | Demo (flag) | `super/solePurposeTest.ts` |
| In-house asset rule (5% cap) | SIS Act s71, s82–s85 | Demo (calc) | `super/inHouseAsset.ts` |
| Limited Recourse Borrowing Arrangement | SIS Act s67A; **PCG 2016/5** (related-party loan safe-harbour terms) | Demo (flag) → PROD (full safe-harbour calc) | `super/lrba.ts` |
| Concessional contribution cap (FY26 $30,000) | ITAA 1997 s291-20; indexed annually | **Demo headline** | `super/contributionCaps.ts` |
| Non-concessional contribution cap (FY26 $120,000) | ITAA 1997 s292-85; 4× concessional rule | **Demo headline** | `super/contributionCaps.ts` |
| Bring-forward (3-year non-concessional) | ITAA 1997 s292-85(2); $360k FY26 | **Demo headline** | `super/contributionCaps.ts` |
| Carry-forward unused concessional cap (5 years; TSB < $500k) | ITAA 1997 s291-20(3) | PROD | `super/contributionCaps.ts` |
| Excess contribution tax | ITAA 1997 Div 291, Div 292 | PROD | `super/excessContributions.ts` |
| Transfer balance cap ($1.9m FY26, indexed) | ITAA 1997 Div 294; s294-35 | **Demo headline** | `super/transferBalanceCap.ts` |
| Div 293 — additional 15% on concessional contributions for high-income earners (>$250k adjusted) | ITAA 1997 Div 293 | PROD | `super/div293.ts` |
| Div 296 — additional 15% on earnings on TSB > $3m | Treasury Laws Amendment (Better Targeted Superannuation Concessions) Act — verify Royal Assent + commencement | PROD (verify Act status before code) | `super/div296.ts` |
| Pension phase tax-free earnings | ITAA 1997 Div 295-385 | Demo | `super/pensionPhase.ts` |
| Preservation age + condition of release | SIS Reg 6.01–6.04 | Demo | `super/preservation.ts` |

### 2.3 State taxes (per-state SSOT)

| Tax | Per-state authority | Demo / PROD | Module |
|---|---|---|---|
| Land tax — NSW | NSW Land Tax Act 1956; threshold + premium rate; trust surcharge; foreign owner surcharge 4% | PROD | `landTax/NSW.ts` |
| Land tax — VIC | VIC Land Tax Act 2005; trust surcharge; absentee owner surcharge 4% | PROD | `landTax/VIC.ts` |
| Land tax — QLD | QLD Land Tax Act 2010; foreign owner surcharge 2% | PROD | `landTax/QLD.ts` |
| Land tax — SA / WA / TAS / ACT / NT | Per-state Land Tax Acts | PROD | `landTax/{SA,WA,TAS,ACT,NT}.ts` |
| Land tax aggregation | Per-state aggregation rules (some aggregate trust + individual; some don't) | PROD | `landTax/landTaxAggregator.ts` |
| Stamp duty (transfer / acquisition) | Per-state Duties Acts (NSW Duties Act 1997, VIC Duties Act 2000, etc.) | PROD | `stampDuty/{state}.ts` |
| Foreign purchaser surcharge stamp duty | NSW 8%, VIC 8%, QLD 7%, WA 7%, SA 7%, TAS 8% | PROD | `stampDuty/foreignSurcharge.ts` |
| Trust resettlement (CGT event E1/E2 + duty risk) | TD 2012/21 + state revenue rulings | PROD (flag, never auto-recommend) | `stampDuty/resettlementRisk.ts` |

### 2.4 GST + BAS

| Rule | Authority | Demo / PROD | Module |
|---|---|---|---|
| GST registration threshold ($75k turnover, $150k non-profit) | A New Tax System (GST) Act 1999 s23-15 | Demo (flag) | `gst/registrationThreshold.ts` |
| Input tax credits | GST Act Div 11 | PROD | `gst/inputTaxCredits.ts` |
| BAS lodgement cadence | GST Act Div 31 | Demo (flag) | `gst/basCadence.ts` |

### 2.5 Boundary regimes (advisory — never compute)

These regimes are NOT calc engines. They define what the AI advisor and Practice surface are allowed to surface vs. what must channel through Ask-a-Pro.

| Regime | Authority | Effect on architecture |
|---|---|---|
| **AFSL — personal financial advice** | Corporations Act 2001 Ch 7; **ASIC RG 244** (general vs personal advice); **ASIC RG 36** (financial product advice) | The AI advisor's tool registry has NO tool that emits a recommendation about a financial product, asset allocation, or strategic restructure. The Practice surface footer renders the AFSL boundary statement, profession-aware, on every drill-in view (see `lib/portal/practice/professionConfig.ts`). |
| **TPB — tax agent services** | Tax Agent Services Act 2009; TPB(R) 2010/1 | The AI advisor surfaces tax *positions* (cap headroom, holding period, withholding rate) but never represents itself as a tax agent. "This is general tax information, not personal tax advice" disclaimer rendered on every tax-bearing surface. |
| **NCCP — credit advice** | NCCP Act 2009; NCCP Regulations 2010 | Mortgage broker recommendations are licensed. The AI advisor can flag "your fixed rate expires in 4 months" but cannot recommend a specific lender or product. |

---

## 3. Module structure (canonical layout)

```
lib/calculations/tax/
├── README.md                           — index + boundary statement + how to add a new rule
├── UNCOMPUTED.md                       — rules we deliberately skip + why
├── masterTaxEngine.ts                  — single entry point; composes all rules into per-entity tax position
├── types.ts                            — shared types (TaxPosition, EntityTaxFacts, FYReference, etc.)
├── fiscalYear.ts                       — FY resolver + indexed thresholds table
│
├── divisions/
│   ├── div6.ts                         — trust beneficiary income flow
│   ├── div6.test.ts                    — fixtures from TR 2012/D1
│   ├── div6E.ts                        — streaming
│   ├── div6E.test.ts
│   ├── div7A.ts                        — private company loans + s109N MRP
│   ├── div7A.test.ts
│   ├── div115.ts                       — CGT discount
│   ├── div115.test.ts                  — fixtures from ATO TD 2008/29
│   ├── div152.ts                       — small business CGT concessions
│   ├── div152.test.ts
│   ├── partIVA.ts                      — anti-avoidance flag (advisory only)
│   ├── s100A.ts                        — reimbursement agreement zone classifier
│   ├── s100A.test.ts                   — fixtures from PCG 2022/2 zones
│   ├── negativeGearing.ts              — individual-only loss-against-salary
│   ├── familyTrustElection.ts          — FTE / IEE + TFN withholding
│   ├── foreignCgtWithholding.ts
│   └── serviceEntity.ts                — TR 2006/2 benchmark ratios
│
├── super/
│   ├── contributionCaps.ts             — concessional + non-concessional + bring-forward + carry-forward
│   ├── contributionCaps.test.ts
│   ├── transferBalanceCap.ts           — TBC tracking + transition events
│   ├── div293.ts                       — high-income additional 15%
│   ├── div296.ts                       — $3m TSB tax (verify Act status)
│   ├── solePurposeTest.ts              — flag-based rule
│   ├── inHouseAsset.ts                 — 5% cap calculation
│   ├── lrba.ts                         — LRBA structural flag + PCG 2016/5 safe-harbour
│   ├── pensionPhase.ts
│   ├── preservation.ts
│   └── excessContributions.ts
│
├── losses/
│   ├── companyLossRules.ts             — COT / SBT / Div 707
│   └── trustLossRules.ts               — Sch 2F
│
├── psi/
│   ├── psiRules.ts                     — results / 80% / unrelated clients / employment / premises tests
│   └── psiRules.test.ts                — fixtures from TR 2022/3
│
├── landTax/
│   ├── NSW.ts
│   ├── VIC.ts
│   ├── QLD.ts
│   ├── SA.ts
│   ├── WA.ts
│   ├── TAS.ts
│   ├── ACT.ts
│   ├── NT.ts
│   └── landTaxAggregator.ts            — per-state aggregation rules
│
├── stampDuty/
│   ├── {state}.ts                      — per-state transfer duty calculators
│   ├── foreignSurcharge.ts
│   ├── resettlementRisk.ts             — flag-only, never auto-recommend
│   └── stampDutyAggregator.ts
│
├── gst/
│   ├── registrationThreshold.ts
│   ├── inputTaxCredits.ts
│   └── basCadence.ts
│
├── boundaries/
│   ├── afslBoundary.ts                 — RG 244 / RG 36 boundary statement renderer (profession-aware)
│   ├── tpbBoundary.ts                  — Tax Agent Services Act boundary
│   └── nccpBoundary.ts                 — credit advice boundary
│
└── fixtures/
    ├── tr_2022_4_s100A_zones.json      — verbatim from PCG 2022/2 examples
    ├── td_2008_29_div115.json          — verbatim from TD 2008/29
    ├── tr_2022_3_psi.json              — verbatim from TR 2022/3
    ├── pcg_2016_5_lrba.json
    └── (one fixture file per ATO source)
```

---

## 4. Canonical types

The engine speaks one common language. Every rule consumes and produces these types — no rule-local data structures.

```typescript
// FY-indexed reference (e.g. '2025-2026' is the AU financial year ending 30 June 2026)
type FYReference = `${number}-${number}`;

// What the calc engine knows about an entity at a point in time.
interface EntityTaxFacts {
  entityId: string;
  entityType: LegalEntityType;       // From Phase 41a — PERSONAL_NAME | COMPANY | ...
  entityRole: LegalEntityRole;        // From Phase 41a — PERSONAL | HOLDING | OPERATING | SUPERANNUATION | INVESTMENT
  state: AUState;                     // For state taxes
  fy: FYReference;
  // ... per-entity financial facts (income, expenses, capital gains, super contributions, etc.)
  // populated from the canonical SnapshotV2 entity-aware projection
}

// The output of one rule — never raw numbers, always {value, citation, fyReference, confidence}
interface TaxRuleResult {
  ruleId: string;                     // e.g. 'div115.cgtDiscount'
  authority: AuthorityCitation;       // section + ruling references
  fy: FYReference;
  value: number | boolean | TaxRuleResult[];  // composable
  explanation: string;                // human-readable narration (AI uses this verbatim, never paraphrases)
  flags: RegulatoryFlag[];            // e.g. 's100A.redZoneRisk', 'div7A.deemedDividendRisk'
  uncomputedReasons?: string[];       // populated when the rule defers to PROD
}

interface AuthorityCitation {
  primary: string;                    // 'ITAA 1997 s115-25'
  secondary?: string[];               // ['TD 2008/29', 'PCG 2017/5']
  effectiveFrom: string;              // ISO date or FY string
  lastReviewed: string;               // ISO date — flagged for re-review when stale > 12 months
}

// Master entry point return shape
interface MasterTaxPosition {
  userId: string;
  fy: FYReference;
  perEntity: Record<string, EntityTaxPosition>;   // keyed by LegalEntity.id
  household: HouseholdTaxPosition;                 // aggregations across entities
  flags: RegulatoryFlag[];                         // critical/high/info, sorted by severity
  uncomputed: UncomputedRule[];                    // explicit "we did not compute X because Y"
  generatedAt: string;
  authoritySources: AuthorityCitation[];           // every rule that contributed; for audit
}
```

The `authoritySources` array is the audit trail. Every rendered tax number on every Monitrax surface can be traced to the rule that produced it, the authority that justifies it, and the FY-indexed threshold table that supplied its constants.

---

## 5. AFSL / TPB / NCCP boundary — structural enforcement

> *The boundary is the AI's tool registry, not its prompt. A prompt-only boundary is editorial — it can be bypassed by clever phrasing. A tool-registry boundary is structural — the AI literally cannot emit a recommendation because the function isn't defined.*

### 5.1 The two-tier surface

| Tier | What surfaces here | Examples |
|---|---|---|
| **Tier 1 — Facts (AI may surface)** | Numbers + their authority citation + plain-language explanation. Never an action verb directed at the user. | "Your trust holds property X with $300k unrealised capital gain. Holding period is 14 months. ITAA 1997 s115-25 — 50% CGT discount applies on disposal." • "Concessional contributions YTD: $22,000. FY26 cap (s291-20): $30,000. Available: $8,000." • "Your TSB at 30 June was $2.1m. Transfer balance cap (s294-35): $1.9m. Excess: $200k." |
| **Tier 2 — Recommendations (Ask-a-Pro only)** | Actions, comparisons, restructuring options, product choices, timing advice. Routed to a licensed professional via the marketplace. | "Should I transfer property X into a discretionary trust?" • "Should I salary sacrifice to fill my cap?" • "Should I sell property X this FY to use the discount?" • "Should I fix or stay variable on my home loan?" |

### 5.2 How this is enforced in code

- **Gemini tool registry for AI advisor (Phase 40 + 41h):** the toolset includes `runScenario`, `lookupEntityTaxFacts`, `lookupContributionCapHeadroom`, `lookupCgtPosition`. It does NOT include `recommendStructuralChange`, `recommendProduct`, `recommendTiming`. The AI cannot emit a recommendation because the tool isn't there.
- **Practice surface alert library:** alerts surface *triggers*, never product/strategic actions. `LVR_REFINANCE_WINDOW` says "fixed rate expires in 4 months" — not "refinance with Lender X." This is enforced by the alert's text being authored in `lib/portal/practice/professionConfig.ts` under reviewer scrutiny.
- **Boundary footer rendered everywhere personal-advice-shaped data appears.** Profession-aware via `professionConfig.ts`:
  - Adviser surface: *"Acting under AFSL authorisation. This view supports analysis and advice; product recommendations remain a Statement of Advice deliverable."*
  - Broker surface: *"Acting under Australian Credit Licence. Credit recommendations remain a Credit Quote / Credit Proposal deliverable."*
  - Accountant surface: *"Acting under TPB registration. Tax positions surfaced here are general information, not personal tax advice."*

### 5.3 What this enables

The AI can be *aggressively useful* on facts because the boundary is enforced elsewhere. We don't need to gum up the prompt with caveats — the AI can quote `s115-25` and explain Div 115 in plain language without anyone confusing it for personal advice, because (a) the citation is rendered next to the number, (b) the only tool to act on the information is "Ask a Professional," and (c) the boundary footer is on the surface.

---

## 6. Cross-entity rules — where the complexity actually lives

> *Single-entity rules are tractable. Cross-entity rules — Pty Ltd as trustee of a Family Trust whose primary beneficiary is the same person who's the SMSF member — are where we earn or lose adviser trust.*

### 6.1 Trustee → Trust (parent-entity hierarchy)

The `LegalEntity.parentEntityId` self-FK from Phase 41a models the trustee → trust corporate relationship.

| Scenario | Rule fires | Module |
|---|---|---|
| Pty Ltd (corporate trustee) holds property in trust for Family Trust | `landTax/{state}.ts` aggregates land at the **trust** level for surcharge purposes (different from individual aggregation rules) | `landTax/landTaxAggregator.ts` |
| Pty Ltd (corporate trustee) declares dividends to its shareholders | If shareholders are also trust beneficiaries, **Div 7A risk** evaluated against the *shareholder*, not the trust | `divisions/div7A.ts` |
| Trust deed amendment that changes trustee | **Resettlement risk** flag (CGT event E1 + state duty) | `stampDuty/resettlementRisk.ts` |

### 6.2 Trust → Beneficiary (Div 6 / Div 6E)

The trust distribution flow is the single most regulatory-dense calculation in Phase 41. It composes 4 rules:

```
trustNetIncome (after deductions)
  → div6 (presently entitled fraction)
  → div6E (streamed franked dividends + capital gains to specific beneficiaries)
  → s100A flag check (PCG 2022/2 zone classification — green/yellow/red)
  → familyTrustElection check (TFN withholding if non-quoting beneficiary)
  → flow into beneficiary's personal income tax position
```

`divisions/div6.ts` orchestrates this composition. The output for each beneficiary is a `TaxRuleResult` carrying the entitled income, its character (ordinary / franked / capital gain), and any flags raised by s100A or FTE evaluation. The beneficiary's `EntityTaxPosition` then composes this with their personal income to produce the household total.

### 6.3 Pty Ltd → Shareholder (Div 7A)

When a Pty Ltd makes a payment, transfer, or loan to a shareholder/associate:

1. Is it a payment, transfer, or loan? (different rules apply)
2. If a loan: is it on s109N minimum-repayment terms? (term ≤7yr unsecured, ≤25yr if secured by mortgage; benchmark interest rate; minimum repayment formula)
3. If not on s109N terms: is there a sub-trust arrangement? (UPE rules)
4. If neither: deemed dividend for the shareholder, taxed at marginal rate, no franking credit.

`divisions/div7A.ts` evaluates each Pty Ltd loan/transfer/payment against this decision tree and returns either `(safe, [])` or `(deemedDividendRisk, [explanation, citation])`. Phase 41h exposes this as Tier 1 facts ("your loan from Acme Pty Ltd is on s109N terms, MRP for FY26 is $X") — never as a recommendation.

### 6.4 SMSF → Member (sole purpose + in-house asset + LRBA)

The SMSF compliance triumvirate. Each rule independent but all three must pass:

- **Sole purpose test** (`super/solePurposeTest.ts`) — flag check: is the SMSF maintained solely for retirement benefits? Heuristics: any related-party tenancy of fund property, any in-fund collectibles below market rent, any artwork displayed at member's premises, any "personal use" asset.
- **In-house asset 5% cap** (`super/inHouseAsset.ts`) — calc: ratio of (loans to related parties + investments in related parties + leases to related parties) / total fund assets ≤ 5%.
- **LRBA safe-harbour** (`super/lrba.ts`) — for related-party loans, evaluate against PCG 2016/5 safe-harbour terms (interest rate, LVR, repayment schedule, term, security).

Failure on any of these three is a critical flag. Phase 41h surfaces it as: *"In-house asset ratio is currently 6.2%. SIS Act s71 caps this at 5%. Refer to your SMSF auditor."* — never as a recommendation.

---

## 7. FY-indexed thresholds (versioning)

All thresholds, caps, and rates that index annually are stored in a single FY-indexed table. Rules read from this table — they never hard-code a constant.

```typescript
// lib/calculations/tax/fiscalYear.ts
export const FY_THRESHOLDS: Record<FYReference, FYThresholdSet> = {
  '2025-2026': {
    super: {
      concessionalCap: 30_000,
      nonConcessionalCap: 120_000,
      bringForwardCap: 360_000,
      carryForwardTSBThreshold: 500_000,
      transferBalanceCap: 1_900_000,
      div293IncomeThreshold: 250_000,
      div296TSBThreshold: 3_000_000,    // verify Act status
      // ...
    },
    cgt: {
      foreignWithholdingThreshold: 750_000,
      foreignWithholdingRate: 0.125,
    },
    landTax: {
      // per-state nested
    },
    // ...
  },
  '2024-2025': { /* prior FY */ },
  // ...
};
```

When Treasury releases the next FY's caps (typically March/April), a single PR adds the new FY entry to this table — every rule reads the new values without code change. This is the SSOT pattern at the *constant* level, not just the *function* level.

---

## 8. Test fixture provenance

> *The test suite is the regulatory evidence. Every fixture cites its source so future operators can verify against the original document.*

Each rule's `.test.ts` has fixtures lifted **verbatim** from ATO worked examples. The fixture file lives under `lib/calculations/tax/fixtures/` and the test imports from there.

Example structure:

```typescript
// lib/calculations/tax/fixtures/td_2008_29_div115.json
{
  "source": "ATO Tax Determination TD 2008/29",
  "url": "https://www.ato.gov.au/law/view/document?DocID=TXD/TD200829/NAT/ATO/00001",
  "extractedAt": "2026-05-04",
  "examples": [
    {
      "exampleId": "TD2008/29-Example1",
      "scenario": "Individual taxpayer disposes of CGT asset acquired 1 January 2020 for $100,000, sold 15 March 2025 for $250,000.",
      "expected": {
        "capitalGain": 150000,
        "holdingMonths": 62,
        "discountApplies": true,
        "discountRate": 0.5,
        "discountedGain": 75000,
        "citation": "ITAA 1997 s115-25"
      }
    }
  ]
}
```

```typescript
// lib/calculations/tax/divisions/div115.test.ts
import fixtures from '../fixtures/td_2008_29_div115.json';
import { applyCgtDiscount } from './div115';

describe('Div 115 CGT Discount — TD 2008/29 examples', () => {
  for (const example of fixtures.examples) {
    it(`matches ${example.exampleId}: ${example.scenario}`, () => {
      const result = applyCgtDiscount({
        gain: example.scenario.capitalGain,
        holdingMonths: example.expected.holdingMonths,
        entityType: 'PERSONAL_NAME',
      });
      expect(result.discountedGain).toBe(example.expected.discountedGain);
      expect(result.authority.primary).toBe(example.expected.citation);
    });
  }
});
```

If a future ATO ruling supersedes a TD we've baked in, the fixture file's `extractedAt` + `lastReviewed` flag the staleness. Reviewers reject rule changes that don't update the matching fixture.

---

## 9. Versioning protocol — keeping the engine current

| Trigger | Required action |
|---|---|
| New FY (1 July) | New FY entry added to `fiscalYear.ts` thresholds table BEFORE any user-facing FY26 calculation runs. ATO publishes most caps in March/April; cut a PR by 1 June. |
| New ATO Tax Ruling supersedes one we cite | Update the rule module's authority citation; refresh the matching fixture; re-run test suite; PR shipped within 30 days of the ruling becoming final. |
| New Tax Determination | Same as above. |
| State Land Tax Act amendment | Update the affected `landTax/{state}.ts` module + its threshold; flag the change in `IMPLEMENTATION_PLAN.md` for sign-off. |
| New Federal legislation (e.g. Div 296 enabling Act) | Don't enable the rule until Royal Assent + commencement date confirmed. Until then the module exists but returns `uncomputedReasons: ['Awaiting Royal Assent of [Bill]']`. |
| Citation `lastReviewed` > 12 months old | Reviewer flag — stale citation. Refresh against current ATO source before next release. |

A scheduled Cloud Scheduler job runs monthly and surfaces every citation whose `lastReviewed` is > 12 months old via a Practice surface internal alert (not user-facing). This is how the engine stays honest.

---

## 10. UNCOMPUTED register — what we deliberately skip

Lives at `lib/calculations/tax/UNCOMPUTED.md`. Every entry has:

- The rule name
- Why we skip it (edge case prevalence, regulatory complexity, no demand signal yet)
- What the user sees instead (typically a "Refer this to a tax professional" channel through Ask-a-Pro)
- The trigger condition that would move it from UNCOMPUTED to scoped

Phase 41a / 41e / 41h reviewers reject any PR that surfaces a tax position that touches an UNCOMPUTED rule without explicitly returning `uncomputedReasons`.

Initial entries (Phase 41e demo scope):

| Rule | Why skipped at demo | Trigger to scope |
|---|---|---|
| Family Trust Election ordering rules | Edge cases (multiple FTEs, IEE chains) too complex for demo | First user with multi-trust structure |
| Div 7A complex unwind (sub-trust arrangements) | TR 2010/3 sub-trust UPE rules are interpretive | First adviser pitch where this comes up |
| State land tax aggregation across multi-state holdings | Cross-state aggregation interpretive | First Olivia-archetype with properties in 3+ states |
| Foreign-resident trust beneficiary withholding | <1% of demo users | First non-resident beneficiary signs up |
| Deceased estates / testamentary trusts | Phase 41 scope is living-person entities | Phase 42 (estates) or specific demand |
| CGT event K6 (pre-CGT company shares) | Pre-1985 asset edge | Specific demand |
| GST margin scheme | Property developer edge case | Specific demand |
| Stamp duty resettlement quantification | Flag-only at v1; full calc requires deed-text parsing | Phase 41f trust deed parser proves out |

---

## 11. Phase 41e implementation sequence (proposed)

Given the surface area, 41e is not one PR. It's a sequence:

| PR | Scope | Estimate |
|---|---|---|
| **41e.0** | Foundation — `masterTaxEngine.ts` + types + `fiscalYear.ts` FY26 thresholds + `boundaries/*` (AFSL/TPB/NCCP rendering helpers). No rules yet. | 2 days |
| **41e.1 (Demo)** | Div 115 + Div 6 (basic) + capital loss netting. Full test suite from TD 2008/29 + TR 2012/D1 fixtures. | 3 days |
| **41e.2 (Demo)** | SMSF caps — concessional + non-concessional + bring-forward + TBC. | 2 days |
| **41e.3 (Demo)** | Div 6E streaming basics (franked dividends + capital gains to specific beneficiaries). | 2 days |
| **41e.4 (Demo)** | Negative gearing + per-entity tax position aggregator. | 1 day |
| **41e.5 (Demo)** | `MasterTaxPosition` composition + Practice surface tax-position card. | 2 days |
| --- | **DEMO CUT** — sufficient for lighthouse adviser pitch | --- |
| 41e.6 (PROD) | s100A zone classifier (PCG 2022/2 fixtures) | 3 days |
| 41e.7 (PROD) | Div 7A loan classifier + s109N MRP calc | 2 days |
| 41e.8 (PROD) | Div 152 small business CGT concessions | 3 days |
| 41e.9 (PROD) | Div 296 (verify Act status; gated behind feature flag until commencement) | 2 days |
| 41e.10 (PROD) | PSI rules | 3 days |
| 41e.11 (PROD) | Family Trust Election + IEE | 2 days |
| 41e.12 (PROD) | State land tax — NSW + VIC (most-used states) | 3 days |
| 41e.13 (PROD) | State land tax — QLD + SA + WA + remaining | 3 days |
| 41e.14 (PROD) | Stamp duty (transfer + foreign surcharge per state) | 4 days |
| 41e.15 (PROD) | Trust + company loss rules (Sch 2F + COT/SBT/Div 707) | 2 days |
| 41e.16 (PROD) | GST + BAS flagging | 1 day |

Total demo: ~12 days. Total PROD: ~28 additional days.

41h (AI entity-aware diagnosis) cannot start until 41e.0 + 41e.5 land — it composes their output.

---

## 12. Sign-off + maintenance

- **Reza signs off this doc before 41e.0 starts.** The architecture is the contract.
- **Every Phase 41e PR cites this doc** in its description. Reviewers reject 41e PRs that introduce a rule not represented here without first updating this doc.
- **This doc lives next to the code.** When `lib/calculations/tax/divisions/div115.ts` is written, its file-header JSDoc points back to §2.1 of this doc + the authority citation.
- **Quarterly review.** Reza + Claude walk this doc end-to-end every quarter, refresh citations, audit `UNCOMPUTED.md`, plan the next slice.

---

*Last updated: 2026-05-04 — v1 architectural blueprint. Sign-off pending.*
