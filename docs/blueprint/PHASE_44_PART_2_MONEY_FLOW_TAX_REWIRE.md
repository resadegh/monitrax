# Phase 44 Part 2 — Money-Flow, Transactions & Tax-Engine Rewire

> **Status:** 🟡 DESIGN — not yet built. Code follows only after Reza review of this document.
> **Version:** v2 (2026-05-22) — external Australian-tax-law conformance review incorporated; see §13.
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

> **A note on the word "built" (external review finding §13-F1/F11).** This audit reports whether each module *exists and is designed to apply the relevant rule*. It does **not** re-assert legal correctness — that rests on the engine's own test suite + the `PHASE_44_ENTITY_GRAPH.md` §14 acceptance criteria, and on fact-sensitive testing against statute. "Built" below means "the rule module exists and dispatches"; it is not a legal-correctness certification.

| Group | Modules | What they do | Audit verdict |
|---|---|---|---|
| **Orchestration** | `orchestrator/masterTaxPosition.ts`, `entity/entityTaxRouter.ts` | Per-entity dispatch + household roll-up. Take `EntityTaxFacts[]` in; pure. | ✅ Built. Part 2 does **not** change the dispatch logic — only what *builds* the `EntityTaxFacts`. |
| **Trust / Div 6 / Div 6E** | `divisions/trustDistribution.ts`, `s100aZoneClassifier.ts`, `trustDeedValidation.ts`, `trustLossRules.ts`, `trustMinimumTax.ts` | Allocate trust net income to presently-entitled beneficiaries; s100A PCG-2022/2 zone classification; deed-validation overlay; Sch 2F loss quarantine; Measure 3 30% min-tax (reform skeleton). | ✅ Compute logic built. ⚠️ **Three law-precision items the design must respect (review §13):** (a) Div 6 is a *proportionate* model — present entitlement is to *trust-law (distributable) income*; that **share** (a fraction) is then applied to the **s 95 net income** (a tax concept). `Bamford`. The design must not conflate the two. (b) Undistributed trust income is **not** universally `s99A` @ 47% — `s99` applies in defined cases (some deceased estates / minors). The engine currently applies `s99A` flat — a **known simplification** (§7 G-S99). (c) Streaming validity needs more than a resolution date — see Div 7A/Div 6E note below + §4.1. ⚠️ **Starved of input** — `trustDistribution.ts` runs only when `EntityTaxFacts.trustDistribution` is supplied, and nothing persists it. `trustMinimumTax.ts` is a reform skeleton (correctly `UNCOMPUTED` until Royal Assent). |
| **Div 7A** | `divisions/div7aLoanClassifier.ts` | Private-company **loan** compliance — minimum yearly repayment (s109N annuity formula), distributable-surplus flag (`UC-DIV7A-DISTRIBUTABLE-SURPLUS`), sub-trust-UPE flag. | ✅ Loan path built. ⚠️ **Div 7A is broader than loans** (review §13-F6): payments (s109C), forgiven debts (s109F), interposed-entity arrangements, and the s109Y distributable-surplus *cap* are **not engine-computed** today — they are gaps (§7 G-DIV7A). ⚠️ **UPE / sub-trust treatment is legally contested** — ATO TD 2022/11 vs the *Bendel* litigation (§7 G-UPE) — the engine must **not** auto-deem a UPE a Div 7A dividend. ⚠️ Runs only when `EntityTaxFacts.div7aLoans` is supplied — no persisted source. The associate test is graph-derived in the Part 2 design (§6.1) — structural inference from user-entered relationships, not ATO-verified status. |
| **SMSF / super** | `super/capTracker.ts`, `contributionCalculator.ts`, `highIncomeSuperTax.ts`, `divisions/smsfTriumvirateClassifier.ts` | Contribution-cap headroom + carry/bring-forward; SG + sacrifice; Div 293 / Div 296 (296 reform-gated); sole-purpose / in-house-asset / LRBA / NALI classifier. | ✅ Cap + Div 293/296 + the existing SMSF-compliance classifier are built. ⚠️ The classifier covers sole-purpose + in-house-asset + LRBA + NALI; SMSF compliance is **broader** (s65 financial assistance, s66 related-party acquisition, etc.) — the doc does not imply completeness (review §13-F10). ⚠️ **Gap:** there is **no SMSF fund-earnings income-tax module** — the 15% accumulation rate, the ECPI exemption (which does **not** extend to assessable contributions or NALI), the segregated-vs-proportionate method for mixed funds, the ⅓ CGT discount, and the NALI top-rate component (`PHASE_44_ENTITY_GRAPH.md` §8.1) are not present. The SMSF router branch returns cap-tracking only. **Part 2 must decide on this (§7 Q-SMSF).** |
| **CGT** | `cgtDiscount.ts`, `capitalLossNetting.ts`, `cgtIndexation.ts`, `cgtMinimumRate.ts`, `foreignResidentCgt.ts`, `div152SmallBusinessConcessions.ts` | Div 115 discount (entity-aware: 50% individual/trust, 33⅓% complying super, 0% company), s100-50 loss netting + ordering, Div 152 SBC stacking; three reform skeletons (indexation, 30% floor, Div 855). | ✅ Current-law CGT modules built; reform pieces correctly `UNCOMPUTED`-gated. ⚠️ For **trust / SMSF** entities CGT is **not peripheral** — capital gains form part of the s 95 net income being distributed, and streaming gains to beneficiaries runs through **Subdiv 115-C**. So CGT-event assembly is in 2c scope for trust/SMSF entities, not deferred (review §13-F13; §7 Q-CGT-FEED revised). |
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

> **The tax engine is built and pure — every rule module exists and dispatches; it is designed to apply current Australian tax law. Part 2 is not an engine rewrite — it is a *data-layer build*. The engine's compute modules barely change; the `EntityTaxFacts` shape barely changes. What changes is the *source* of the dispatch fields: from a `curl` POST body to persisted models assembled through the graph.**

Two qualifications the external law review (§13) requires this finding to carry:

1. **"Built" is not "certified correct".** This audit establishes that the modules *exist and dispatch* — not that every fact-sensitive outcome is legally correct. Legal correctness is established by the engine's own test suite + the `PHASE_44_ENTITY_GRAPH.md` §14 acceptance criteria + ongoing testing against statute — never asserted by a design document. The review surfaced specific law-precision items (s99/s99A, the Bamford proportionate model, streaming validity, Div 7A breadth, the UPE/*Bendel* contest, SMSF ECPI carve-outs) — these are recorded as engine-level gaps/notes in §2.1 and §7, and constrain how Part 2's data layer is shaped so it cannot *feed the engine a number it should not compute*.
2. **The engine has genuine gaps**, not just a starved input — see §7. The largest is the absent SMSF fund-earnings module (Q-SMSF).

This remains the cleanest possible outcome for `PHASE_44_ENTITY_GRAPH.md` §8.3 ("the engine stays the one engine — only its *input shape* changes"). The audit refines that: only the input *source* changes — plus, subject to Reza's call, the one new module that fills the SMSF gap.

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

**Law-precision notes (external review §13 — F2, F4, F5, F20).** These constrain Part 2a's final schema; they do not change the model's role.

- **Bamford proportionate model.** Present entitlement attaches to *trust-law (distributable) income*; the beneficiary's **share** of that is a *fraction*, which is then applied to the **s 95 net income** (a tax concept) — the two are distinct amounts. `presentlyEntitledShare` here is that fraction; `trustNetIncome` is the s 95 figure. Part 2a will decide whether a separate `distributableIncome` field is needed to make the two explicit (Open Question §11 Q-DISTINCOME) — the engine must never treat the s 95 figure *as* the distributable income.
- **Streaming validity is not a date.** A valid stream of franked distributions / capital gains requires (a) trustee **power under the deed** — captured as a `TrustDeedRule` of type `STREAMING_POWER` (§4.4); (b) the beneficiary being **specifically entitled** (Subdiv 115-C for gains, Subdiv 207-B for franked distributions); (c) the resolution recorded by the time the deed / law requires. `resolutionDate` is one input to that test, not the test. The assembler checks all three before passing streaming amounts to the engine; absent any one → the engine streams nothing and may surface `UC-DIV-6E-STREAMING`.
- **Resolution timing + amendments.** A resolution is only operative if made by the deed's deadline (commonly 30 June). The model carries `resolutionDate` + `status` for this; handling of a *later amending* document vs *evidence of an earlier* resolution is **Open Question §11 Q-RESOLUTION-AMEND** — Part 2a resolves it; v1 may simply record the latest `CONFIRMED` row and flag any post-deadline date.
- **Trust-type mechanics differ.** Discretionary (trustee resolution), unit (pro-rata to units held — derivable from `ShareParcel`), fixed (predetermined entitlements), and hybrid (both) trusts allocate differently. `DistributionResolution` represents all four via the `presentlyEntitledShare` fraction, but the *source* of that fraction differs by type — the assembler derives it per type. Recorded as a design constraint for 2a, not a blocker.

### §4.2 — `DividendDistribution` — actual company dividend + franking

`PHASE_44_ENTITY_GRAPH.md` §8.2 — franking must be computed from **actual** dividend records, not inferred from shareholding. Today the engine has **no actual-dividend input at all** (franking only arrives via `Income.frankingPercentage`). This model is genuinely new.

**Law-precision note (review §13-F16).** `DividendDistribution` feeds the imputation regime — **Div 207 ITAA 1997** (gross-up + franking offset, shareholder assessability). Where a *shareholder is itself a trust*, the franked distribution streams to beneficiaries under **Subdiv 207-B** (paired with the §4.1 streaming logic + Div 6E). Recording `frankingPercentage` + `frankingCreditsTotal` is the input; the engine applies Div 207 / 207-B — Part 2 does not re-implement imputation.

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

**Law-precision notes (external review §13 — F6, F7, F8).**

- **Div 7A is broader than loans.** The model's `benefitType` enum already spans `LOAN` / `PAYMENT` / `DEBT_FORGIVENESS` / `UPE` / `SUB_TRUST_ARRANGEMENT` — but the *engine* (`div7aLoanClassifier`) only computes the **loan** limb today. Part 2 persists all five via the model; the engine consumes `LOAN` first. `PAYMENT` (s109C), `DEBT_FORGIVENESS` (s109F), interposed-entity arrangements, and the s109Y **distributable-surplus cap** on the deemed dividend are recorded but return `UNCOMPUTED` until the engine's Div 7A coverage is extended (a Part 2 follow-up, not 2a–2d). The model is forward-built; the engine is honest about what it computes.
- **UPE / sub-trust treatment is legally contested — do not auto-deem.** Whether an unpaid present entitlement held on sub-trust is "financial accommodation" and therefore a Div 7A loan is an area of active legal contest — the ATO's position (TD 2022/11) and recent court authority (the *Bendel* litigation) point different ways. **The engine MUST NOT auto-deem a `UPE` / `SUB_TRUST_ARRANGEMENT` row a Div 7A dividend.** It records the arrangement as a fact and returns `UNCOMPUTED` with the citation, surfacing the contest to the user. Resolving the treatment is **Open Question §11 Q-UPE** — Reza confirms the current legal state before the engine ever computes a number here.
- **Associate status is structural inference, not legal verification.** The assembler derives shareholder/associate status from the entity graph (`isAssociateOf`, built on user-entered `FAMILY_MEMBER_OF` / `ASSOCIATE_OF` / control edges). That is a structural indicator (`PHASE_44_ENTITY_GRAPH.md` §5 — an *indicator*, not proof) — the engine result is conditional on it, not a verified-status determination.

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

**The warn-not-reject boundary (external review §13-F21).** The *service* records an inconsistent resolution (shares not summing to 100%) and *warns* — the digital-twin principle (`PHASE_44_ENTITY_GRAPH.md` §6.1: record the user's reality, don't reject it). But a *tax number* must never be computed from inconsistent entitlements: the **assembler / engine returns `UNCOMPUTED`** for any resolution whose allocation shares do not reconcile. Recorded ≠ computed — the warn-not-reject latitude is for *capture*, never for a final tax figure.

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

`getMoneyFlow()` today approximates. Part 2d repoints it to recorded flows: `DistributionResolution` (trust → beneficiary), `DividendDistribution` (company → shareholder), `SuperContribution` (member → SMSF).

**Law-precision caveat (external review §13-F22).** These are **entitlement / declared** flows, not necessarily **cash** flows — a beneficiary can be presently entitled with no cash paid (an unpaid present entitlement / UPE); a dividend can be declared and paid in different years. The §11A money-flow lens upgrade therefore moves from "eligibility" to "**entitlements & declared distributions**" — it must **not** be labelled or read as "cash movements". Where the model can distinguish (e.g. `DividendDistribution.declaredDate` vs `paymentDate`), the lens shows the entitlement and notes any unpaid portion rather than implying cash changed hands.

---

## §7 — Gaps the audit + the external law review surfaced

### §7.1 — Engine-level law-precision gaps (`G-*`)

These are limitations *in the engine today*. Part 2 does not fix them by itself — but the data layer must be shaped so it **never feeds the engine a number these gaps make unsafe**. Each is enforced by an `UNCOMPUTED` gate, not a silent simplification.

| # | Gap | Law point | Part 2 treatment |
|---|---|---|---|
| **G-S99** | Engine applies `s99A` @ 47% to *all* undistributed trust income. | `s99` (not `s99A`) applies in defined cases — some deceased estates, certain minor scenarios — at a more concessional outcome (`ITAA 1936` ss 99/99A). | The assembler tags the entity as deceased-estate / testamentary where the graph says so; for those, the engine's flat-s99A path returns `UNCOMPUTED` rather than the wrong 47%. Extending the engine to `s99` is a Part 2 follow-up / Part 3. |
| **G-DIV7A** | Engine computes only the Div 7A **loan** limb. | Div 7A also reaches payments (`s109C`), forgiven debts (`s109F`), interposed-entity arrangements, and caps the deemed dividend at the `s109Y` distributable surplus. | `PrivateCompanyBenefit` persists all limbs; the engine consumes `LOAN`, returns `UNCOMPUTED` for the rest until its Div 7A coverage is extended (follow-up). |
| **G-UPE** | UPE / sub-trust Div 7A treatment is **legally contested** (ATO TD 2022/11 vs the *Bendel* litigation). | Whether a sub-trust UPE is "financial accommodation" → a Div 7A loan is unsettled. | The engine **never auto-deems** a `UPE` / `SUB_TRUST_ARRANGEMENT` a dividend — records the fact, returns `UNCOMPUTED` + citation. See §11 Q-UPE. |
| **G-PARTNERSHIP** | Partnership distribution is not engine-computed — the router flags `PARTNERSHIP` `UNCOMPUTED`. | A partnership is tax-transparent: net income/loss flows to partners (`ITAA 1936` Div 5, `s92`). | §11 Q-PARTNERSHIP — decide whether Part 2 assembles partner attribution or explicitly keeps `PARTNERSHIP` `UNCOMPUTED`. |
| **G-RESIDENCY** | Residency is a cross-cutting variable not foregrounded in the assembly design. | Residency drives CGT-discount access, `Div 855` taxable-Australian-property, dividend/interest withholding, Medicare. | The assembler reads `LegalEntity.taxResidencyStatus` (added in Part 1a) and `isForeignResident`, and passes them through on every `EntityTaxFacts`. Residency-sensitive computations return `UNCOMPUTED` when status is `UNKNOWN`. |
| **G-ASSETSRC** | Testamentary excepted-income per-asset `assetSource` not modelled. | Excepted trust income (`ITAA 1936` Div 6AA) for testamentary trusts depends on the source of the asset producing the income. | Return `UNCOMPUTED` for the excepted-income path until `assetSource` is captured (Part 2 follow-up / Part 3). The reason is *missing facts*, not rarity. |

### §7.2 — Decisions for Reza

| # | Question | Recommendation |
|---|---|---|
| **Q-SMSF** | The engine has **no SMSF fund-earnings income-tax module** (15% accumulation; ECPI exemption — which does **not** cover assessable contributions or NALI; segregated vs proportionate method for mixed funds; ⅓ CGT discount; NALI top-rate component). Build `super/smsfIncomeTax.ts` in Part 2? | **Yes.** It is current law, not reform; the engine is *incomplete* without it (it cannot return a real SMSF income-tax number), not being *duplicated* — so it is a sound §8.3 exception. It is the single new *compute* module Part 2 introduces; flag for explicit approval. Scope it to the ECPI carve-outs above. |
| **Q-CGT-FEED** | Assemble `cgtEvents` from persisted disposals — when? | **In 2c for trust / SMSF entities** (revised up from "lower priority", review §13-F13): capital gains are part of the s 95 net income a trust distributes and feed Subdiv 115-C streaming, so the trust path is not real without them. Individual/company CGT-event assembly can be a 2c-or-follow-up call on cost. |
| **Q-UPE** | Given the *Bendel* contest, confirm: the engine returns `UNCOMPUTED` for sub-trust UPE Div 7A — agreed? | **Yes** — never compute a contested number. Reza confirms the current legal state; the gate lifts only on his instruction. |
| **Q-PARTNERSHIP** | Does Part 2 assemble partnership partner-attribution (`Div 5`/`s92`), or explicitly keep `PARTNERSHIP` `UNCOMPUTED`? | Recommend a **lightweight `PartnershipDistribution`** assembly in a Part 2 follow-up (the graph already has `PARTNER_OF` + `partnerInterestPct`); keep `UNCOMPUTED` for 2a–2d. Reza's call on priority. |

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

The decisions **Q-SMSF / Q-CGT-FEED / Q-UPE / Q-PARTNERSHIP** are in §7.2 (they arise directly from the audit + law-review gaps). The questions below are the remaining ones — schema-shape calls for Part 2a, plus the deed-migration call.

| # | Question | Recommendation |
|---|---|---|
| Q-DISTINCOME | Does `DistributionResolution` need an explicit `distributableIncome` (trust-law income) field separate from `trustNetIncome` (s 95), to make the Bamford proportionate model unambiguous (review §13-F2)? | **Lean yes** — carry both; `presentlyEntitledShare` is then visibly "share of distributable income", applied to the s 95 figure. Part 2a finalises. |
| Q-RESOLUTION-AMEND | How does the model treat a *later amending* resolution vs *evidence of an earlier* one (review §13-F5)? | v1: record the latest `CONFIRMED` row; flag (not reject) a `resolutionDate` after the deed / 30-June deadline. A full amendment history is a Part 2 follow-up. |
| Q-ASSETSRC | Model testamentary `assetSource` (Div 6AA excepted income) in Part 2, or defer? | **Defer** — because the *facts are not captured*, not because it is rare (review §13-F17). Return `UNCOMPUTED` meanwhile (§7.1 G-ASSETSRC). |
| Q-DEED-MIGRATE | Migrate existing `TrustDeedExtractedRules` JSON into `TrustDeedRule` rows at 2a deploy, or lazily on next confirmation? | **Lazily** — avoids a data migration; `TrustDeedExtractedRules` is retained as raw-extraction provenance regardless. |

---

## §12 — Risks & legal positioning

- **Highest-risk change in Phase 44.** Mitigated by: this audit-first design pass; the external law-conformance review (§13); the review gate on 2a; the §8.3 "one engine" rule (Part 2 is a data layer, not an engine rewrite — the audit *demonstrated* this); `UNCOMPUTED`-not-false-numbers preserved end-to-end (`PHASE_44_ENTITY_GRAPH.md` §9), including the new §7.1 `UNCOMPUTED` gates (s99/s99A, UPE/*Bendel*, residency-unknown, inconsistent shares).
- **The reform wall holds.** Part 2 never flips a `commencementVerified` flag (§9, FW-2).
- **CDR (Part 13).** The new models hold financial amounts → CDR-derived data: sanitised from logs/audit metadata (`sanitizeCdrMetadata`), §12.11 destructive-write discipline on the writers.
- **`accountantVerified` is a provenance signal, not a safe harbour** (review §13-F23). The flag records that a professional has reviewed the row — useful confidence metadata — but it is **not** a determination of legal correctness and does **not** invoke any Tax Agent Services Act safe harbour. The statutory tests in ITAA / SIS remain determinative; the engine's `UNCOMPUTED` discipline, not the flag, is what prevents a wrong number.
- **Deferred:** §7.1 G-ASSETSRC; the non-loan Div 7A limbs (G-DIV7A); partnership attribution (G-PARTNERSHIP, pending Q-PARTNERSHIP); `s99` (G-S99); individual/company CGT-event assembly if not folded into 2c.

---

## §13 — External law-conformance review (2026-05-22)

This document was put through an external Australian-tax-law conformance review — the same discipline Part 1's design got (`IMPLEMENTATION_PLAN.md` §0·Φ44 records two adversarial reviews of the Part 1 design). The reviewer was scoped **strictly to tax law**: check the document's tax-law statements for accuracy, identify classes of AU tax law missing from scope, and flag incorrect legal assumptions — and **explicitly not** to propose schema fields, code, or architecture (the reviewer had not seen the codebase). Per Reza's directive, **no technical/design direction from the review was adopted** — only the law-alignment findings, each translated into this document by the Monitrax architect against the actual codebase.

23 findings were returned (`F1`–`F23`). Disposition:

| Finding | Law point | Where it landed in v2 |
|---|---|---|
| F1, F11 | "Built + correct" overclaims legal correctness. | §2.1 preamble + §2.4 — "built" softened to "exists and dispatches"; correctness is the test suite's, not asserted. |
| F2 | Div 6 proportionate model — trust-law income vs s 95 net income (`Bamford`). | §2.1 trust row; §4.1 law note; §11 Q-DISTINCOME. |
| F3 | `s99` vs `s99A` — undistributed income is not universally 47%. | §2.1 trust row; §7.1 **G-S99** (`UNCOMPUTED` gate). |
| F4 | Streaming validity = deed power + specific entitlement (Subdiv 115-C/207-B), not a date. | §4.1 law note; §2.1 trust + CGT rows. |
| F5 | Resolution timing / amendments matter. | §4.1 law note; §11 Q-RESOLUTION-AMEND. (Row-count *design* suggestion not adopted.) |
| F6 | Div 7A is broader than loans. | §2.1 Div 7A row; §4.3 law note; §7.1 **G-DIV7A**. |
| F7 | UPE / sub-trust Div 7A is legally contested (TD 2022/11 vs *Bendel*). | §4.3 law note; §7.1 **G-UPE**; §7.2 Q-UPE — `UNCOMPUTED` gate. |
| F8 | Associate status: verified vs assumed. | §2.1 Div 7A row + §4.3 — clarified as structural inference, not legal verification. (Partly a misread — §6.1 already derives it from the graph.) |
| F9 | SMSF ECPI carve-outs (not contributions, not NALI) + segregated/proportionate method. | §2.1 SMSF row; §7.2 Q-SMSF scope. |
| F10 | "Triumvirate" understates SMSF compliance breadth. | §2.1 SMSF row — completeness not implied. |
| F12 | Div 115 discount rates + Subdiv 115-C. | §2.1 CGT row — rates stated; engine catalog already correct. |
| F13 | CGT feed is not "lower priority" for trusts/SMSFs. | §2.1 CGT row; §7.2 Q-CGT-FEED revised up to 2c scope. |
| F14, F15 | Company-loss / PSI / FTE-IEE results are conditional on caller-asserted facts. | Covered by the F1/F11 "built ≠ certified" softening; §2.1 verdicts. |
| F16 | Franking → Div 207 imputation + Subdiv 207-B trust streaming. | §4.2 law note. |
| F17 | Q-ASSETSRC "rare" is not a legal basis. | §7.1 G-ASSETSRC + §11 Q-ASSETSRC reworded — deferred for missing facts, not rarity. |
| F18 | Partnerships omitted from scope. | §7.1 **G-PARTNERSHIP**; §7.2 Q-PARTNERSHIP. |
| F19 | Residency omitted from scope. | §7.1 **G-RESIDENCY** — assembler reads `LegalEntity.taxResidencyStatus`. |
| F20 | Trust types differ (discretionary / unit / fixed / hybrid). | §4.1 law note. |
| F21 | Warn-not-reject is unsafe for a final calc. | §5 — service records (warn); assembler/engine returns `UNCOMPUTED` on inconsistent shares. |
| F22 | Cash flow ≠ tax assessability (UPE; declared vs paid). | §6.4 — Sankey labelled "entitlements & declared distributions", not cash. |
| F23 | `accountantVerified` is not a tax safe harbour. | §12 — reworded as a provenance signal, not a legal determination. |

**Net effect of the review.** No structural change to the Part 2 architecture — the central finding (engine built, gap is the data layer) stood. The review's value was *law precision*: it converted several places where the document was loose into explicit `UNCOMPUTED` gates (§7.1) and open questions (§11), and corrected the document's positioning (it now claims the engine *exists and dispatches*, never that it is *certified legally correct*). That is exactly the outcome an adversarial second eye should produce — and it mirrors how the Part 1 design moved v2→v3.

---

*This document is the Part 2 design contract — v2, external law-conformance review (§13) incorporated. Build begins only after Reza review. Created 2026-05-22.*
