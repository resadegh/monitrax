# Phase 44 Part 2 — Money-Flow, Transactions & Tax-Engine Rewire

> **Status:** 🟡 DESIGN — not yet built. Code follows only after Reza review of this document.
> **Owner:** Reza (direction + structural/legal review) + Claude (audit, design, build).
> **Created:** 2026-05-22. **Design pass for:** `PHASE_44_ENTITY_GRAPH.md` §11 "Part 2".
> **Depends on:** Phase 44 Part 1 (complete — 1a schema, 1b rules engine + services, 1c canvas + routes, 1d onboarding). 
> **Related:** `PHASE_44_ENTITY_GRAPH.md` §8 (tax treatment + SSOT), `PHASE_41E_REFORM_2026_27.md`, CLAUDE.md §8.3, §12.2/§12.3 (SSOT), §12.14 (reform-awareness), Part 13 (CDR).

---

## §1 — Purpose, and the Part 1 → Part 2 boundary

Phase 44 Part 1 built the **structural graph** — who owns, controls and is eligible-to-benefit-from what. Part 1 was *forbidden* from touching the tax engine (`PHASE_44_ENTITY_GRAPH.md` §11 — "Part 1 does NOT touch the tax engine").

Part 2 is the rewire Part 1 deferred. Its job, in one sentence:

> **Make the tax engine compute real per-entity numbers for trusts, companies and SMSFs from *persisted* data — instead of returning `UNCOMPUTED`, or only computing when fed dispatch data through a `curl` POST body.**

`PHASE_44_ENTITY_GRAPH.md` §8.2 already drew the line this design pass implements:

> Graph = eligibility / control / ownership structure. **Transaction, resolution and distribution models (Part 2) = what actually happened in an income year.** Tax engine = applies the law to graph + transactions + verified metadata.

Part 2 builds the "what actually happened" layer and the assembly that feeds it to the engine. It is **higher legal risk** than Part 1 — wrong tax numbers are a legal-exposure surface (`PHASE_44_ENTITY_GRAPH.md` §9) — which is why it is review-gated and opens with the audit in §2.

---

## §2 — Tax-engine audit (the §11 "full tax-engine audit")

`lib/tax-engine/` is **45 TypeScript modules**, every one a **pure function** — no I/O, no DB calls, deterministic, citation-traced. The engine is invoked through two entry points:

- `calculateEntityTaxPosition(facts: EntityTaxFacts): EntityTaxPosition` — `entity/entityTaxRouter.ts`. Per-entity dispatch by `LegalEntityType`.
- `buildMasterTaxPosition(input): MasterTaxPositionV2` — `orchestrator/masterTaxPosition.ts`. Household-wide: calls the router per entity, then cross-cutting modules (land tax, stamp duty, GST) and per-entity overlays (Div 152, PSI, FTE/IEE, trust/company loss).

### §2.1 — Module catalog (audit findings)

| Group | Modules | What they do | Audit verdict |
|---|---|---|---|
| **Orchestration** | `orchestrator/masterTaxPosition.ts`, `entity/entityTaxRouter.ts` | Per-entity dispatch + household roll-up. Take `EntityTaxFacts[]` in; pure. | ✅ Built + correct. Part 2 does **not** change the dispatch logic — only what *builds* the `EntityTaxFacts`. |
| **Trust / Div 6 / Div 6E** | `divisions/trustDistribution.ts`, `s100aZoneClassifier.ts`, `trustDeedValidation.ts`, `trustLossRules.ts`, `trustMinimumTax.ts` | Allocate trust net income to presently-entitled beneficiaries (s95/s97/s99/s99A); s100A PCG-2022/2 zone classification; deed-validation overlay; Sch 2F loss quarantine; Measure 3 30% min-tax (reform skeleton). | ✅ Compute logic built + correct (s99A 47% on undistributed; present-entitlement honoured). ⚠️ **They are starved of input** — `trustDistribution.ts` runs only when `EntityTaxFacts.trustDistribution` is supplied, and nothing persists it. `trustMinimumTax.ts` is a reform skeleton (correctly `UNCOMPUTED` until Royal Assent). |
| **Div 7A** | `divisions/div7aLoanClassifier.ts` | Private-company loan compliance — minimum yearly repayment (s109N annuity formula), distributable-surplus + sub-trust-UPE flags. | ✅ Built + correct. ⚠️ Runs only when `EntityTaxFacts.div7aLoans` is supplied — no persisted source. The **associate test** (who is a shareholder/associate) is asserted by the caller, not derived. |
| **SMSF / super** | `super/capTracker.ts`, `contributionCalculator.ts`, `highIncomeSuperTax.ts`, `divisions/smsfTriumvirateClassifier.ts` | Contribution-cap headroom + carry/bring-forward; SG + sacrifice; Div 293 / Div 296 (296 reform-gated); sole-purpose / in-house-asset / LRBA / NALI triumvirate. | ✅ Cap + Div 293/296 + triumvirate logic built. ⚠️ **Gap:** there is **no SMSF fund-earnings income-tax module** — the 15% accumulation / 0%-ECPI-exempt / one-third-discount / NALI-top-rate computation `PHASE_44_ENTITY_GRAPH.md` §8.1 calls for is not present. The SMSF router branch returns cap-tracking only. **This is the one genuine engine gap Part 2 must decide on (§7, Q-SMSF).** |
| **CGT** | `cgtDiscount.ts`, `capitalLossNetting.ts`, `cgtIndexation.ts`, `cgtMinimumRate.ts`, `foreignResidentCgt.ts`, `div152SmallBusinessConcessions.ts` | Div 115 discount (entity-aware), s100-50 loss netting + ordering, Div 152 SBC stacking; three reform skeletons (indexation, 30% floor, Div 855). | ✅ Current-law CGT built + correct; reform pieces correctly `UNCOMPUTED`-gated. Part 2 feeds `cgtEvents` from persisted disposals (lower priority — §10). |
| **Negative gearing / losses** | `negativeGearing.ts`, `negativeGearingRegime.ts`, `companyLossRules.ts`, `lossRefundability.ts` | Per-entity loss treatment + Measure-1 regime derivation; Div 165 company-loss tests; Measure-5 carry-back skeleton. | ✅ Built. Regime derivation reform-aware. Caller asserts COT/BCT facts. |
| **PSI / FTE-IEE** | `psiClassifier.ts`, `fteIeeClassifier.ts` | Part 2-42 PSI classification; Family Trust Election + FTDT / TFN-withholding. | ✅ Built; caller asserts facts. |
| **Land tax / stamp duty / GST** | `landTax/*`, `stampDuty/*`, `gst/*` | Per-state land tax + cross-state aggregation; transfer duty + foreign surcharge; BAS. | ✅ Built; cross-cutting (not per-entity). Out of Part 2's primary scope. |
| **Core income tax** | `core/*`, `income/*`, `position/taxPositionCalculator.ts` | Brackets, Medicare, PAYG, offsets; taxability classifier; the Phase-20 individual aggregator. | ✅ Built; the `PERSONAL_NAME` / `SOLE_TRADER` path already produces real numbers today. |
| **Config / boundaries** | `config/taxYearConfig.ts`, `config/reformConstants.ts`, `boundaries/index.ts`, `types.ts` | FY threshold SSOT; reform cut-over + commencement-flag SSOT; AFSL/TPB/NCCP footer; shared types. | ✅ SSOT-clean. All eight Phase 41E reform flags present + gated. |

### §2.2 — How data reaches the engine *today*

The `EntityTaxFacts` contract (`lib/tax-engine/types.ts`) already carries every optional field the rule modules need — `trustDistribution`, `div7aLoans`, `smsfContributions`, `highIncomeSuper`, `cgtEvents`. The **only assembler** is the per-entity route, `app/api/tax/entity/[entityId]/route.ts`:

- **`GET`** reads `Income` / `Expense` rows for the entity and builds `EntityTaxFacts` with **none** of the dispatch fields populated. Result: every `COMPANY` / `DISCRETIONARY_TRUST` / `UNIT_TRUST` / `SMSF` entity returns `UNCOMPUTED`.
- **`POST`** reads `trustDistribution` / `div7aLoans` / `smsfContributions` / `cgtEvents` **from the request body**. The route's own comment is explicit: *"Until a UI captures trust distribution data, this endpoint is the primary way to exercise the slice via curl. Future Phase 41 slices … will populate the body automatically and the GET handler will derive distribution data from persisted state."*

That "future slice" is **Phase 44 Part 2**.

### §2.3 — `parentEntityId` and `TrustDeedExtractedRules` — the two named repoint targets

- **`parentEntityId`** — the audit confirms it is read in exactly **two** places: `lib/tax-engine/types.ts` (the `EntityTaxFacts.parentEntityId` field) and `app/api/tax/entity/[entityId]/route.ts` (which copies it into the facts). **Nothing in the 45 engine modules consumes `facts.parentEntityId`.** It is already inert for tax. Part 2's "repoint" is therefore low-risk: the assembler derives trustee facts from the graph (`getTrusteesOf()`), and the dead `parentEntityId` read is removed from the route. `parentEntityId` stays frozen on the schema (`PHASE_44_ENTITY_GRAPH.md` §10) — Part 2 simply stops referencing it.
- **`TrustDeedExtractedRules`** — a Prisma model already exists (PDF-extraction lifecycle `EXTRACTED → CONFIRMED`, typed-JSON columns: `beneficiaries`, `distributionRules`, `vestingDate`, `trusteePower`, `loanProvisions`). It is read by `divisions/trustMinimumTax.ts` (a reform skeleton — does not yet consume it) and validated by `divisions/trustDeedValidation.ts` via `lib/services/trustDeedRulesService.ts`. Part 2 promotes the JSON columns to a structured `TrustDeedRule` model (§4.4) as the SSOT for deed-derived facts.

### §2.4 — The central finding

> **The tax engine is built, pure, and correct for current law. Part 2 is not an engine rewrite — it is a *data-layer build*. The engine's compute modules barely change; the `EntityTaxFacts` shape barely changes. What changes is the *source* of the dispatch fields: from a `curl` POST body to persisted models assembled through the graph.**

This is the cleanest possible outcome for `PHASE_44_ENTITY_GRAPH.md` §8.3 ("Phase 44 adds ZERO calculation logic… the engine stays the one engine — only its *input shape* changes"). The audit upgrades that: only the input *source* changes.

---

## §3 — Part 2 architecture

```
  Part 1 graph  ─┐
                 │   ┌──────────────────────────────┐
  Part 2 txn  ───┼──▶│  entityTaxFactsAssembler     │──▶ EntityTaxFacts ──▶ tax engine
  models         │   │  (NEW — the canonical        │     (unchanged)        (unchanged)
                 │   │   fact-assembly SSOT)        │
  Income/Expense ┘   └──────────────────────────────┘
```

Four moving parts:

1. **Four new persisted models** (§4) — `DistributionResolution`, `DividendDistribution`, `PrivateCompanyBenefit`, `TrustDeedRule`. The "what actually happened" layer.
2. **Model services** (§5) — the only writers of those models, audited, §12.11-compliant (the Part 1b-ii pattern).
3. **`entityTaxFactsAssembler`** (§6) — a new canonical service: given `(userId, entityId, FY)`, it reads income/expense + the entity graph + the four new models + `TrustDeedRule`, and returns a fully-populated `EntityTaxFacts`. This is the SSOT for "how the engine gets fed."
4. **The repoint** (§6) — `GET /api/tax/entity` calls the assembler (real numbers, not `UNCOMPUTED`); `trustMinimumTax` reads `TrustDeedRule`; the dead `parentEntityId` read is removed; `MoneyFlowSankey` upgrades to actual money-flow.

The tax engine's 45 modules are **not modified** except: (a) `trustMinimumTax.ts` changes its deed-rule *input source* (still reform-gated, still `UNCOMPUTED` until Royal Assent — no math change); (b) the SMSF gap in §7 Q-SMSF, if Reza approves closing it, adds **one** new module.

---

## §4 — The four new models (Part 2a — schema)

All money / percentage / quantity fields use **`Decimal`** (`PHASE_44_ENTITY_GRAPH.md` §7). All additive — no destructive change. Each model is `userId`-scoped (tenancy) and references `LegalEntity` ids. Sketches below; Part 2a finalises + generates the migration (CLAUDE.md §12.12).

### §4.1 — `DistributionResolution` — discretionary/unit trust per-FY resolution

Feeds `EntityTaxFacts.trustDistribution`. One row per trust per FY; `allocations` are the per-beneficiary split.

```prisma
model DistributionResolution {
  id                    String   @id @default(uuid())
  userId                String
  trustEntityId         String                       // the trust LegalEntity
  financialYear         String                       // "2026-27"
  trustNetIncome        Decimal  @db.Decimal(19,4)    // s95 net income
  resolutionDate        DateTime?                     // trustee resolution date — streaming validity (Div 6E)
  frankedDividendPool   Decimal? @db.Decimal(19,4)    // character pool available to stream
  capitalGainPool       Decimal? @db.Decimal(19,4)
  hasFamilyTrustElection Boolean @default(false)
  status                ResolutionStatus @default(DRAFT)   // DRAFT / CONFIRMED
  accountantVerified    Boolean  @default(false)
  verifiedAt            DateTime?
  sourceDocumentId      String?
  allocations           DistributionAllocation[]
  // createdAt / updatedAt / @@index([userId]) @@index([trustEntityId, financialYear])
}
model DistributionAllocation {
  id                       String  @id @default(uuid())
  resolutionId             String
  beneficiaryEntityId      String                      // a BENEFICIARY_OF entity (validated against the graph)
  presentlyEntitledShare   Decimal @db.Decimal(9,6)    // fraction of net income (0..1)
  streamedFrankedDividends Decimal? @db.Decimal(19,4)
  streamedCapitalGains     Decimal? @db.Decimal(19,4)
  // resolution @relation, @@index([resolutionId])
}
```

### §4.2 — `DividendDistribution` — actual company dividend + franking

`PHASE_44_ENTITY_GRAPH.md` §8.2 — franking must be computed from **actual** dividend records, not inferred from shareholding. Today the engine has **no actual-dividend input at all** (franking only arrives via `Income.frankingPercentage`). This model is genuinely new.

```prisma
model DividendDistribution {
  id                   String   @id @default(uuid())
  userId               String
  companyEntityId      String
  financialYear        String
  declaredDate         DateTime
  paymentDate          DateTime?
  totalAmount          Decimal  @db.Decimal(19,4)
  frankingPercentage   Decimal  @db.Decimal(5,2)       // 0..100
  frankingCreditsTotal Decimal  @db.Decimal(19,4)      // explicit — not derived from a rate guess
  status               ResolutionStatus @default(DRAFT)
  accountantVerified   Boolean  @default(false)
  payments             DividendPayment[]
}
model DividendPayment {
  id                     String  @id @default(uuid())
  dividendDistributionId String
  shareholderEntityId    String                        // a SHAREHOLDER_OF entity
  amount                 Decimal @db.Decimal(19,4)
  frankingCredits        Decimal @db.Decimal(19,4)
}
```

### §4.3 — `PrivateCompanyBenefit` — Div 7A loans / payments / forgiveness / UPEs

Feeds `EntityTaxFacts.div7aLoans` (and a v2 superset for payments / debt forgiveness / sub-trust UPEs).

```prisma
enum PrivateCompanyBenefitType { LOAN  PAYMENT  DEBT_FORGIVENESS  UPE  SUB_TRUST_ARRANGEMENT }
model PrivateCompanyBenefit {
  id                    String  @id @default(uuid())
  userId                String
  companyEntityId       String                        // the private company
  recipientEntityId     String                        // shareholder / associate (validated via graph isAssociateOf)
  financialYear         String
  benefitType           PrivateCompanyBenefitType
  amount                Decimal @db.Decimal(19,4)
  // LOAN-specific
  openingBalance        Decimal? @db.Decimal(19,4)
  loanTermYears         Int?
  benchmarkRate         Decimal? @db.Decimal(7,4)
  repaymentsThisFy      Decimal? @db.Decimal(19,4)
  hasComplianceAgreement Boolean @default(false)
  isSubTrustUpe         Boolean @default(false)
  accountantVerified    Boolean @default(false)
}
```

### §4.4 — `TrustDeedRule` — structured deed-derived facts (SSOT)

Promotes the typed-JSON columns of the existing `TrustDeedExtractedRules` to first-class rows. `TrustDeedExtractedRules` is **retained** as the raw-extraction provenance record (the `EXTRACTED → CONFIRMED` PDF lifecycle); `TrustDeedRule` becomes the **structured, queryable SSOT** the tax engine reads.

```prisma
enum TrustDeedRuleType {
  BENEFICIARY_CLASS  DISTRIBUTION_METHOD  DEFAULT_BENEFICIARY
  STREAMING_POWER    VESTING_DATE         INCOME_DEFINITION  SUB_TRUST_UPE_CLAUSE
}
model TrustDeedRule {
  id                  String   @id @default(uuid())
  userId              String
  trustEntityId       String
  sourceExtractionId  String?                          // FK → TrustDeedExtractedRules (provenance)
  ruleType            TrustDeedRuleType
  ruleValue           Json                             // typed per ruleType; Zod-validated by the writer
  effectiveFrom       DateTime
  effectiveTo         DateTime?
  extractedConfidence Decimal? @db.Decimal(4,3)        // 0..1 — AI extraction confidence
  accountantVerified  Boolean  @default(false)
  verifiedAt          DateTime?
}
```

`enum ResolutionStatus { DRAFT  CONFIRMED }` is shared by §4.1/§4.2.

---

## §5 — Model services (Part 2b)

Following the Part 1b-ii pattern exactly: **one service per model family, the only writer of that model**, audited via `logCRUD`, §12.11-compliant (composite `where`, guarded updates). No tax arithmetic in the services (`PHASE_44_ENTITY_GRAPH.md` §8.3).

| Service | Writes | Validates |
|---|---|---|
| `lib/services/distributionResolutionService.ts` | `DistributionResolution` + `DistributionAllocation` | beneficiary entities are `BENEFICIARY_OF`/`UNITHOLDER_OF` the trust in the graph; shares sum ≈ 100% (warn, not reject — digital-twin §6.1). |
| `lib/services/dividendDistributionService.ts` | `DividendDistribution` + `DividendPayment` | shareholders are `SHAREHOLDER_OF` the company; payments sum ≈ `totalAmount`. |
| `lib/services/privateCompanyBenefitService.ts` | `PrivateCompanyBenefit` | recipient is a shareholder/associate (graph `isAssociateOf`). |
| `lib/services/trustDeedRuleService.ts` | `TrustDeedRule` | `ruleValue` Zod-validated per `ruleType`; links provenance to `TrustDeedExtractedRules`. |

Each gets API routes (the Part 1c pattern — thin `withPermission()` handlers, `tax_data.write` / `tax_data.read`).

---

## §6 — The fact-assembly layer + the repoint (Part 2c)

### §6.1 — `entityTaxFactsAssembler` — the new SSOT

A new canonical service `lib/services/entityTaxFactsAssembler.ts`:

```ts
async function assembleEntityTaxFacts(userId, entityId, fy): Promise<EntityTaxFacts>
```

It reads, in parallel:
- `Income` / `Expense` / depreciation for the entity (as the route does today);
- the **entity graph** via `lib/entity-graph/queries.ts` — trustees (`getTrusteesOf`), shareholders/beneficiaries/members, the associate relation (`isAssociateOf`);
- `DistributionResolution` (+ allocations) → builds `EntityTaxFacts.trustDistribution`;
- `DividendDistribution` → franking inputs;
- `PrivateCompanyBenefit` → `EntityTaxFacts.div7aLoans`;
- `SuperContribution` rows → `EntityTaxFacts.smsfContributions`;
- `TrustDeedRule` → deed facts for `trustMinimumTax` + `trustDeedValidation`.

It performs **no tax arithmetic** — it assembles inputs. It is the single place that knows "how the engine gets fed," replacing the ad-hoc body-parsing in the route.

### §6.2 — Repoint `GET /api/tax/entity/[entityId]`

The `GET` handler calls `assembleEntityTaxFacts()` instead of hand-building bare facts. A trust / company / SMSF with persisted resolution / dividend / benefit data now returns **real numbers**. Entities with no such data still return `UNCOMPUTED` (honest — `PHASE_44_ENTITY_GRAPH.md` §9, "never false numbers"). The `POST` body path is retained as an explicit override for scenario modelling + testing, documented as such. The dead `parentEntityId` read is removed.

### §6.3 — Repoint `trustMinimumTax.ts`

Change its deed-rule input from `TrustDeedExtractedRules` JSON to structured `TrustDeedRule`. **No math change** — the module stays a reform skeleton returning `UC-TRUST-MIN-TAX-PENDING-EXPOSURE-DRAFT` until Royal Assent (CLAUDE.md §12.14 FW-2). Only the input shape changes.

### §6.4 — `MoneyFlowSankey` upgrade (Part 2d)

`getMoneyFlow()` today approximates. Part 2d repoints it to actual flows: `DistributionResolution` (trust → beneficiary), `DividendDistribution` (company → shareholder), `SuperContribution` (member → SMSF). The §11A money-flow lens stops being labelled "eligibility, not actual" and becomes actual.

---

## §7 — Correctness gaps the audit surfaced (decisions needed)

| # | Gap | Detail | Recommendation |
|---|---|---|---|
| **Q-SMSF** | **No SMSF fund-earnings income-tax module.** | The engine computes SMSF contribution caps + Div 293/296 + the triumvirate, but **not** the 15%-accumulation / 0%-ECPI / one-third-discount / NALI-top-rate fund-earnings tax (`PHASE_44_ENTITY_GRAPH.md` §8.1). The SMSF router branch returns cap-tracking only. | **Add one module** `super/smsfIncomeTax.ts` in Part 2 (it is genuine current-law, not reform — safe to build). This is the single new *compute* module Part 2 introduces; flag it for Reza's explicit approval as a §8.3 exception (justified — the engine is *incomplete* here, not being *duplicated*). |
| **Q-ASSETSRC** | **Testamentary excepted-income `assetSource` tracking absent.** | `EntityTaxFacts.trustDistribution.isTestamentaryTrust` exists, but per-asset `assetSource` (`PHASE_44_ENTITY_GRAPH.md` §8.1) is not modelled — excepted-income treatment cannot be correctly gated. | Defer to a Part 2 follow-up or Part 3 — testamentary trusts are rare in the user base. Record as an Open Question; do **not** silently mis-compute (return `UNCOMPUTED`). |
| **Q-CGT-FEED** | CGT events are not yet assembled from persisted disposals. | `cgtEvents` still arrives via POST body. | Lower priority — fold into Part 2c if cheap, else Part 2 follow-up. CGT already computes correctly when fed. |

---

## §8 — SSOT & the §8.3 commitment

Part 2 honours `PHASE_44_ENTITY_GRAPH.md` §8.3 / CLAUDE.md §12.2–§12.3:

1. **One tax engine.** `lib/tax-engine/` stays the only tax engine. Part 2 adds **at most one** compute module (`smsfIncomeTax.ts`, §7 Q-SMSF) — and only because the engine is *incomplete* there, never duplicating an existing engine.
2. **One fact-assembler.** `entityTaxFactsAssembler` is the single SSOT for building `EntityTaxFacts`. The route stops hand-assembling.
3. **One writer per model.** Each new model has exactly one service writer (§5).
4. **No financial aggregation outside the canonical services** — net worth / cashflow stay in `getMasterFinancialSnapshot()` + `lib/calculations/*`.
5. **Reviewer-reject:** any Part 2 PR with tax arithmetic outside `lib/tax-engine/` is rejected.

---

## §9 — Phase 41E reform interaction (CLAUDE.md §12.14)

Part 2 squarely triggers §12.14 (it touches CGT, negative gearing, trust distribution, company losses, and adds financial-calculation models). The audit confirms all eight reform measures are already skeletons gated by `commencementVerified` flags in `taxYearConfig.ts`. Part 2's obligations:

- **FW-1** — `DistributionResolution` feeds `trustMinimumTax` (Measure 3). The assembler must derive/pass the trust's regime; the model carries `financialYear` so the engine resolves the right config.
- **FW-2** — `trustMinimumTax` stays `UNCOMPUTED` until `trustMinTaxCommencementVerified`. Part 2 changes its *input source* only — **never flips a reform gate**.
- **FW-3** — Part 2 adds **new models**, not columns on `Property` / `Investment` / `LegalEntity`, so the column-level grandfathering question is N/A — but each Part 2 schema PR states this explicitly.
- Every Part 2 PR carries the §12.14 PR-template block.

---

## §10 — Part 2 build sequence (review-gated sub-parts)

| Sub-part | Scope | Gate |
|---|---|---|
| **2a — Schema** | The four models + enums + the migration (CLAUDE.md §12.12). `03_DATA_MODEL.md` updated. Additive only. | Reza review of this design doc → then build. |
| **2b — Model services + routes** | The four service writers (§5) + thin API routes. Audited, §12.11-compliant. Tests. | Standard PR review. |
| **2c — Assembler + repoint** | `entityTaxFactsAssembler`; repoint `GET /api/tax/entity`; repoint `trustMinimumTax` to `TrustDeedRule`; remove the dead `parentEntityId` read. **If Q-SMSF approved:** `super/smsfIncomeTax.ts`. | **Higher-risk PR** — careful review; the tax-route output changes from `UNCOMPUTED` to real numbers. |
| **2d — Money-flow** | `MoneyFlowSankey` / `getMoneyFlow()` upgrade to actual flows; the §11A money-flow lens becomes "actual". | Standard PR review. |

Each sub-part is its own branch + PR with full doc-sync (CLAUDE.md §16). 2a is blocked on approval of this document.

---

## §11 — Open questions for Reza

| # | Question | Recommendation |
|---|---|---|
| Q-SMSF | Build `super/smsfIncomeTax.ts` (the missing 15%/ECPI/NALI fund-earnings module) inside Part 2? | **Yes** — the engine is incomplete without it; SMSF entities cannot return a real income-tax number otherwise. It is current law, not reform. |
| Q-ASSETSRC | Model testamentary `assetSource` in Part 2, or defer? | **Defer** — rare; record as a tracked Open Question; return `UNCOMPUTED` meanwhile. |
| Q-CGT-FEED | Assemble `cgtEvents` from persisted disposals in Part 2c, or follow-up? | Fold into 2c **if cheap**; otherwise Part 2 follow-up. |
| Q-DEED-MIGRATE | Migrate existing `TrustDeedExtractedRules` JSON into `TrustDeedRule` rows at 2a deploy, or lazily on next confirmation? | **Lazily** — avoids a data migration; `TrustDeedExtractedRules` is retained as provenance regardless. |

---

## §12 — Risks & legal positioning

- **Highest-risk change in Phase 44.** Mitigated by: this audit-first design pass; the review gate on 2a; the §8.3 "one engine" rule (Part 2 is a data layer, not an engine rewrite — the audit *proved* this); `accountantVerified` on every new model; `UNCOMPUTED`-not-false-numbers preserved end-to-end (`PHASE_44_ENTITY_GRAPH.md` §9).
- **The reform wall holds.** Part 2 never flips a `commencementVerified` flag (§9, FW-2).
- **CDR (Part 13).** The new models hold financial amounts → CDR-derived data: sanitised from logs/audit metadata (`sanitizeCdrMetadata`), §12.11 destructive-write discipline on the writers.
- **Deferred:** §7 Q-ASSETSRC; full Div 7A payment/forgiveness/sub-trust coverage beyond loans (the model supports it; the engine consumes loans first); CGT-event assembly if not folded into 2c.

---

*This document is the Part 2 design contract. Build begins only after Reza review. Created 2026-05-22.*
