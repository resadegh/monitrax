# Phase 44 — Entity Graph & Structure Modelling

> **Status:** 🟡 DESIGN — not yet built. Code follows only after Reza review (and, ideally, an accountant sanity-check of §4–§6).
> **Owner:** Reza (direction + structural review) + Claude (research, design, build).
> **Created:** 2026-05-20. **Revised:** 2026-05-20 (v3 — incorporates two independent adversarial reviews; see §14).
> **Extends:** Phase 41 (`PHASE_41_REGULATORY_ARCHITECTURE.md`) — the entity *type/role* layer. Phase 44 adds the *relationship* layer Phase 41 deferred.
> **Related:** `docs/architecture/03_DATA_MODEL.md` §10, `04_GRDCS_SPECIFICATION.md`, `PHASE_41E_REFORM_2026_27.md`, CLAUDE.md Part 13, §0, §12.2/§12.3 (SSOT).

---

## §1 — Problem

Phase 41 shipped a solid entity *type* layer: `LegalEntity` rows with a `type`, a `role`, identifiers (ABN/ACN/encrypted TFN), and the Phase 41E reform inputs. Every owned object — `Property`, `Loan`, `Account`, `InvestmentAccount`, `Asset`, `Income`, `Expense` — attaches via `ownerEntityId`.

But Phase 41 models **relationships between entities** with exactly one mechanism: `LegalEntity.parentEntityId`, a single self-FK for **one** trustee→trust link. Everything else — shareholding, directorship, beneficiary entitlements, partnership interests, SMSF membership — was explicitly deferred.

Real Australian structures are **directed many-to-many graphs**, not trees. A worked example (§2) cannot be entered into Monitrax today. There is also **no equity model**, **no way to record natural persons who are not Monitrax users**, and **no model of inter-entity money flow**.

**Why it matters.** Every downstream number — net-worth attribution, the per-entity tax position, the Phase 41E dispatch — reads ownership and control off this layer. If the layer cannot represent who owns and who controls what, the calculations are wrong *by construction*. Wrong tax numbers are a legal-exposure surface (§9).

---

## §2 — Worked example (the archetype)

The structure that prompted this phase — a real adviser-produced group structure, **anonymised** (no real ABNs/ACNs/TFNs/DOBs in Monitrax docs or code; the *shape* is what matters):

```
                 Individual A ──director/secretary──┐         ┌──director──── Individual B
                      │                             ▼         ▼
                      ├──shareholder────────▶│  Holding Co Pty Ltd  │
                      │                      └──────────┬──────────┘
                      ▼                                 ▼ shareholder
              ┌────────────────┐   trustee-of   ┌──────────────────────┐
              │ Investment Co  │───────────────▶│  Family Trust        │
              │ Pty Ltd        │   ("ATF")      │  (discretionary)     │
              └────────────────┘                └──────────┬───────────┘
                                                 beneficiary-of (in)
                                          Individual A · Individual B
                                                 ▲  beneficiary-of  ▲
                                          ┌──────┴──────────────────┴──────┐
                                          │  SMSF (self-managed super fund) │
                                          └────────────────┬────────────────┘
                                                 trustee-of ("ATF")
                                                  ┌────────┴────────┐
                                                  │ SMSF Trustee Co │
                                                  └─────────────────┘
```

Edges in this **one** example: director-of, secretary-of, shareholder-of (with parcels), trustee-of, beneficiary-of, member-of (SMSF), and the legally-critical-but-undrawn appointor. This is *one sentence*; the model must be the *language*.

---

## §3 — Core design principle: model the grammar, not the combinations

The right reading of "capture all combinations" is **not** to enumerate structures — it is to define the grammar that generates them: a finite set of **entity-type nodes**, a finite set of **directed, time-bounded relationship-type edges**, and a **validity matrix**.

> **Scope claim (corrected — v3).** A correctly typed graph is **combination-complete for the supported grammar.** Phase 44 supports the common Australian **private-wealth, family-investment, small-business, company, trust, SMSF, partnership and property-ownership** structures Monitrax exists to serve. It is **not** a universal registry of every Australian legal person or statutory body. Structures outside the grammar (§4 lists the explicit exclusions) are either added to the grammar deliberately or recorded as `OTHER` with an `unsupportedStructure` flag — never silently mismodelled.

Non-negotiable consequences:

1. **One relationship model, not one per relationship** — the generic typed junction `EntityRelationship`; adding a relationship type never needs a migration.
2. **Relationships are directed and time-bounded** — every edge has `effectiveFrom` / `effectiveTo`. CGT acquisition dates, franking periods, director tenure all depend on this.
3. **Natural persons are nodes** — including spouses, children, business partners who never log in.
4. **The validity matrix grades, it does not blanket-reject** — see §6's three-state model.

---

## §3A — Legal title, beneficial ownership, and control are three separate dimensions

The single most important conceptual correction from the design reviews. The model must never silently infer one of these from another:

| Dimension | The question it answers | Where it lives in the model |
|---|---|---|
| **Legal title** | In whose name is the asset / share / unit / property *legally* held? | `ownerEntityId` (primary legal owner) + `OwnershipStake` rows; `SHAREHOLDER_OF` (registered holder). |
| **Beneficial ownership** | Who is *economically* entitled to the value, income, or capital? | `BeneficialOwnershipOverride` when it differs from legal title (nominee, bare trust, custodian); otherwise = legal title. |
| **Control / influence** | Who can *direct, appoint, veto, or influence* decisions? | The control sub-graph: `APPOINTOR_OF`, `GUARDIAN_OF`, `POWER_HOLDER_OF`, `DIRECTOR_OF`, `TRUSTEE_OF`, and shareholding of the controlling entity. |

A nominee company holds **legal title** to shares it does **not beneficially own**. A trust appointor has **control** without **legal title** or **beneficial ownership**. A discretionary beneficiary has neither legal title nor (until a distribution resolution) a fixed beneficial entitlement. **The tax engine must read the correct dimension for the correct rule** — CGT follows beneficial ownership; Div 7A control tests follow control; legal-title questions follow title. The model keeps the three separable; it never collapses them.

---

## §4 — Node taxonomy (entity types)

Current `LegalEntityType`: `PERSONAL_NAME`, `COMPANY`, `DISCRETIONARY_TRUST`, `UNIT_TRUST`, `SMSF`, `PARTNERSHIP`, `SOLE_TRADER`. Proposed Phase 44 set (additions **NEW**):

| Type | What it is | Can hold legal title? | Tax-reporting entity? | Notes |
|---|---|---|---|---|
| `INDIVIDUAL` **NEW** | A natural person as a legal actor. | Yes | Yes | The person node. Optional link to a `User` and/or `HouseholdMember`, or stand-alone. |
| `PERSONAL_NAME` | Retained for migration safety — the user's existing "own name" bucket; semantically an `INDIVIDUAL`. | Yes | Yes | Keeps the Phase 41a backfill + every `ownerEntityId` valid. |
| `COMPANY` | A registered company. `companySubtype`: `PROPRIETARY` / `PUBLIC` / `LIMITED_BY_GUARANTEE` / `UNLIMITED` / `NO_LIABILITY`. | Yes | Yes | Sub-type drives the §6 validity branch — a guarantee company has **members, not shareholders**. |
| `DISCRETIONARY_TRUST` | Family / discretionary trust. | **No** — its trustee does | Yes (lodges a return) | A trust is not a legal person (§3A). |
| `UNIT_TRUST` | Fixed-entitlement trust. | **No** — its trustee does | Yes | Distributes by unit %. |
| `FIXED_TRUST` / `HYBRID_TRUST` **NEW** | Other trust shapes. | **No** | Yes | `trustType` enum extended. |
| `BARE_TRUST` **NEW** | Holding trust — incl. the SMSF LRBA holding trust. | **No** | Usually transparent | Legal title held bare for a beneficial owner. |
| `TESTAMENTARY_TRUST` **NEW** | A trust created by a will. | **No** | Yes | Minor-beneficiary excepted-income concession — but only for deceased-estate-derived assets (§8.1, asset-source tracking). |
| `DECEASED_ESTATE` **NEW** | Estate administered by an executor/administrator before distribution. | Via the executor/administrator | Yes | Beneficiaries are **not** presently entitled until administration completes (§5, §6, §8.1). |
| `SMSF` | Self-managed super fund. | **No** — its trustee does | Yes | Member + trustee rules in §6. |
| `PARTNERSHIP` | General or limited partnership. | **No** — partners or a nominee hold title | Yes (lodges a return, pays no tax) | A partnership is *not* a separate legal person — see §3A + the §6 note. |
| `SOLE_TRADER` | An individual operating under an ABN. | = the individual | = the individual | Not a separate legal person — linked 1:1 to an `INDIVIDUAL` via `OPERATES_AS_SOLE_TRADER` (§5). |
| `FOREIGN_COMPANY` **NEW** | A company incorporated outside Australia (incl. ASIC-registered foreign bodies). | Yes | Per residency | Residency fields (§7) drive treatment. |
| `INCORPORATED_ASSOCIATION` **NEW** | A state-registered incorporated association (clubs, NFPs). | Yes | Yes | State-jurisdiction-specific. |
| `CO_OPERATIVE` **NEW** | A registered co-operative. | Yes | Yes | State-jurisdiction-specific. |
| `STRATA_BODY_CORPORATE` **NEW** | An owners corporation / body corporate. | Yes (common property) | Yes | Appears when a user owns a strata-titled property. |
| `CUSTODIAN_PLATFORM` **NEW** | A custodian / wrap-platform vehicle holding investments as bare custodian. | Yes (as custodian) | Transparent | Always paired with a `BeneficialOwnershipOverride` (§7). |
| `OTHER` **NEW** | Anything outside the supported grammar — recorded, flagged `unsupportedStructure`, never mismodelled. | flag | flag | Explicit honesty per §3. |

**Explicit exclusions (out of scope; recorded as `OTHER`):** Indigenous corporations (CATSI Act), government entities, registered managed-investment schemes / MITs / AMITs, and bankrupt estates. These are not common in personal-wealth structures; adding them is a deliberate future grammar extension, not an accident.

`LegalEntityRole` (HOLDING / OPERATING / INVESTMENT / SUPERANNUATION / PERSONAL) gains **`CORPORATE_TRUSTEE`** **NEW**. Role is a UX convenience — the *authoritative* fact is always the edge, never the role.

**Per-entity metadata (additive `LegalEntity` fields):** `companySubtype`; `regulatoryStatus` (multi-valued — `ACNC_REGISTERED_CHARITY` / `DGR` / `INCOME_TAX_EXEMPT` / `NFP` / `REGISTERED_FOREIGN_BODY` / `AFSL_HOLDER` / `RESPONSIBLE_ENTITY`); the structured residency block (§7, G1); the jurisdiction block (§7, G4); `canHoldLegalTitle` / `taxReportingEntity` / `requiresTrusteeOrNomineeForLegalTitle` capability flags; for trusts: `vestingDate`, `perpetuityPeriod`, `deedDate`, `lastVariationDate`, `trustProperLawJurisdiction`; for estates: `estateAdministrationStatus`.

---

## §5 — Edge taxonomy (relationship types)

One enum, `EntityRelationshipType`. Each edge is `from` → `to`, directed, time-bounded.

| Type | Direction (from → to) | Meaning | Consequence |
|---|---|---|---|
| `TRUSTEE_OF` | Company **or** Individual (never a Trust — see note) → any Trust / Testamentary Trust / Bare Trust / SMSF / Deceased Estate | Holds legal title to the trust's assets; administers it ("ATF"). | Trust income is taxed under Div 6 — to beneficiaries who are *presently entitled*, else to the trustee (s98/s99/s99A). |
| `APPOINTOR_OF` | Individual or Company → any Trust | Deed-specific role — typically can appoint/remove the trustee. | **A strong control *indicator*, not universal proof of control** (corrected v3). Control analysis must also weigh the deed, the trustee's own directors/shareholders, guardians, unitholdings, and accountant overrides. Carries `appointorPower` metadata. |
| `GUARDIAN_OF` | Individual or Company → any Trust | Guardian / Protector — consent required for certain trustee actions. | A second control lever for s100A / control analysis. |
| `POWER_HOLDER_OF` **NEW** | Individual or Company → any Trust | A holder of a specific deed power (veto, consent, investment direction, borrowing approval) not captured by appointor/guardian. | Carries `powerType` (`VETO` / `CONSENT` / `DIRECTION` / `OTHER`) + `powerSubject` (`DISTRIBUTION` / `CAPITAL` / `TRUSTEE_CHANGE` / `DEED_AMENDMENT` / `INVESTMENT` / `BORROWING` / `RELATED_PARTY_TXN` / `OTHER`). |
| `SETTLOR_OF` | Individual → any Trust | Settled the trust; then arm's-length. | Warn if the settlor is also a `BENEFICIARY_OF` the same trust. |
| `BENEFICIARY_OF` | Individual / Company / Trust → Discretionary / Hybrid / Testamentary / Bare Trust, SMSF, Deceased Estate | May receive distributions / benefits. Carries `beneficiaryClass`: `PRIMARY` / `GENERAL` / `DEFAULT` / `NAMED` / `RESIDUARY` / `SPECIFIC_GIFT` / `LIFE_TENANT` / `REMAINDERMAN` (the last four for estates / testamentary trusts). | Eligibility, **not** entitlement. Discretionary income flows at the trustee's per-FY resolution; estate beneficiaries are not presently entitled until administration completes. |
| `EXECUTOR_OF` **NEW** | Individual or Company → Deceased Estate | Administers the estate under a will. | The executor holds + manages estate assets; estate income during administration is assessed to the executor, not beneficiaries. |
| `ADMINISTRATOR_OF` **NEW** | Individual or Company → Deceased Estate | Administers an intestate estate (no will). | As `EXECUTOR_OF`. |
| `LEGAL_PERSONAL_REPRESENTATIVE_FOR` **NEW** | Individual or Company → Individual | An LPR acting for a person — death, incapacity, minor, EPOA. | The mechanism for valid SMSF member/trustee exceptions (§6). Carries `reason` (`DEATH` / `INCAPACITY` / `MINOR` / `EPOA` / `OTHER`) + `sourceDocumentId`. |
| `UNITHOLDER_OF` | Any entity → Unit Trust | Holds units — a *fixed* proportional entitlement. | Distributions follow unit %. Carries unit parcels (§7). |
| `SHAREHOLDER_OF` | Any entity except the target company → Company (not `LIMITED_BY_GUARANTEE`) | The **registered (legal-title)** holder of shares. | Eligibility to receive dividends; not proof of beneficial ownership (a nominee is the registered holder — see `BeneficialOwnershipOverride`). Carries share parcels (§7). |
| `DIRECTOR_OF` | Individual → Company | Manages the company; needs a Director ID. | Control-test input; SMSF corporate-trustee directorship. |
| `SECRETARY_OF` | Individual → Company | Company secretary. | Completeness / ASIC fidelity. |
| `PUBLIC_OFFICER_OF` | Individual → Company / Trust / SMSF / Partnership | The ATO-facing officer. | Digital-twin fidelity. |
| `MEMBER_OF` | Individual → SMSF, Company-`LIMITED_BY_GUARANTEE` | A member. | SMSF: per-member caps / TBC / Div 293. SMSF member ⇔ trustee/director rules in §6. |
| `PARTNER_OF` | Any entity (never the partnership itself) → Partnership | A partner — holds a partnership *interest*, not necessarily direct legal title to each asset. | Partnership income/loss flows by interest %. Carries `partnerInterestPct` + `partnerCapitalAmount`. |
| `OPERATES_AS_SOLE_TRADER` **NEW** | Individual → Sole Trader | Binds the `SOLE_TRADER` node 1:1 to the person. | A sole trader is the individual — taxed in their return. |
| `FAMILY_MEMBER_OF` **NEW** | Individual → Individual | A family relationship. Carries `familyRelation`: `SPOUSE` / `DE_FACTO` / `CHILD` / `PARENT` / `SIBLING` / `OTHER_RELATIVE`. | Feeds the Div 7A "associate" test, SMSF related-party rules, and land-tax grouping. |
| `ASSOCIATE_OF` **NEW** | Any entity → Any entity | An **accountant-confirmed** association where graph inference is insufficient. | A manual override for Div 7A / related-party analysis. `accountantVerified` strongly expected. |
| `NOMINEE_FOR` | — *(removed as an entity-to-entity edge — see note)* | — | Asset-scoped beneficial ownership is modelled by `BeneficialOwnershipOverride` (§7), not a broad edge. |

> **Why a trust / partnership cannot be the `from` of `TRUSTEE_OF` or hold legal title.** A trust and a (general-law) partnership are **not legal persons** — they cannot hold legal title or be appointed to an office. Their trustee / partners / a nominee hold title. Layered "trust as trustee of another trust" arrangements are modelled at the legal-person level: the company or individuals who are trustee of Trust A also hold a `TRUSTEE_OF` edge to Trust B. This is §3A in action — legally correct, not a limitation.

> **Why `NOMINEE_FOR` was removed.** A broad `Company A → Trust X` nominee edge would wrongly attribute *every* asset of Company A to the trust. Nominee / bare-trustee / custodian arrangements are **asset-scoped** — they attach to a specific share parcel, property, or holding. Modelled by `BeneficialOwnershipOverride` (§7).

---

## §6 — The validity matrix & the three-state model

### §6.1 — Three structural states (corrected v3 — was a binary accept/reject)

Per §9, Monitrax is a digital twin — it records the user's asserted reality. Real structures can be defective, non-compliant, or out of date and *still exist*. Every entity and edge therefore resolves to one of:

| State | Meaning | Calculation behaviour |
|---|---|---|
| `VALID` | Legally and logically sound. | Full computation. |
| `NON_COMPLIANT_BUT_RECORDED` | A real / asserted structure that appears legally defective, incomplete, or non-compliant (e.g. a 7-member SMSF; an SMSF whose corporate-trustee directors ≠ members with no exception). **Recorded, prominently flagged.** | Tax confidence downgraded — `UNCOMPUTED` or a high-severity warning where the defect makes the number unsafe. |
| `IMPOSSIBLE_SYSTEM_ERROR` | Logically impossible *inside the data model* — invalid enum, missing referenced entity, a prohibited self-edge. | Rejected at write time. |

Only `IMPOSSIBLE_SYSTEM_ERROR` is rejected. Legal non-compliance is **recorded and flagged, never erased** — erasing it would make Monitrax lie about the user's reality.

### §6.2 — Edge legality

| Edge | Allowed `from` | Allowed `to` | Constraints |
|---|---|---|---|
| `TRUSTEE_OF` | Company, Individual | Any Trust, Testamentary/Bare Trust, SMSF, Deceased Estate | A trust has ≥1 trustee. SMSF: see §6.3. |
| `APPOINTOR_OF` | Individual, Company | Any Trust | 0..n. Warn if absent **for discretionary/hybrid trusts only** — *not* for SMSFs or unit trusts. |
| `GUARDIAN_OF` / `POWER_HOLDER_OF` | Individual, Company | Any Trust | 0..n. |
| `SETTLOR_OF` | Individual | Any Trust | 0..1. Warn if also `BENEFICIARY_OF` the same trust. |
| `BENEFICIARY_OF` | Individual, Company, Trust | Discretionary/Hybrid/Testamentary/Bare Trust, SMSF, Deceased Estate | 0..n. An SMSF beneficiary must also be `MEMBER_OF`. |
| `EXECUTOR_OF` / `ADMINISTRATOR_OF` | Individual, Company | Deceased Estate | ≥1 for a valid estate. |
| `UNITHOLDER_OF` | Any entity | Unit Trust | ≥1 for a valid unit trust; unit %s ≈ 100 (warn, Decimal tolerance). |
| `SHAREHOLDER_OF` | Any entity except the target company | Company except `LIMITED_BY_GUARANTEE` | ≥1 for a valid share-capital company; issued shares ≈ 100% (warn). |
| `DIRECTOR_OF` | Individual | Company | Proprietary ≥1; public ≥3. |
| `SECRETARY_OF` | Individual | Company | Proprietary 0..n; public ≥1. |
| `MEMBER_OF` | Individual | SMSF, Company-`LIMITED_BY_GUARANTEE` | SMSF 1..6 — see §6.3. |
| `PARTNER_OF` | Any entity except the partnership | Partnership | ≥2 partners; interest %s ≈ 100. |
| `OPERATES_AS_SOLE_TRADER` | Individual | Sole Trader | A `SOLE_TRADER` node has **exactly one** inbound edge. |
| `FAMILY_MEMBER_OF` / `ASSOCIATE_OF` / `LEGAL_PERSONAL_REPRESENTATIVE_FOR` | per §5 | per §5 | 0..n. |

### §6.3 — SMSF rule (corrected v3 — the most important fix)

SIS Act s17A. An SMSF is `VALID` only if **all** of:

- **1..6 members** (`MEMBER_OF`).
- **Exactly one trustee arrangement:**
  - **Corporate trustee** — exactly one `COMPANY` with `TRUSTEE_OF` in; OR
  - **Individual trustees** — ≥2 individuals with `TRUSTEE_OF` in.
- **Corporate-trustee SMSF — members and directors must be the same set, both directions:**
  - every `MEMBER_OF` the SMSF is `DIRECTOR_OF` the corporate trustee, **and**
  - every `DIRECTOR_OF` the corporate trustee is `MEMBER_OF` the SMSF.
  - A director who is not a member (or vice versa) is permitted **only** with an explicit `LEGAL_PERSONAL_REPRESENTATIVE_FOR` edge carrying a valid `reason` (death / incapacity / minor / EPOA). Absent that → `NON_COMPLIANT_BUT_RECORDED`.
- **Individual-trustee SMSF** — every member is a trustee; every trustee is a member, with the same LPR exception. A **single-member** individual-trustee fund needs **exactly two trustees** (SIS s17A requires ≥2) — the second is a non-member who must satisfy a permitted condition (a relative not employed by the member, or an LPR); that non-member trustee has no `MEMBER_OF` edge.
- **Single-member corporate-trustee SMSF** — the member may be the sole director, or one of two directors where the second satisfies the permitted conditions.

A fund failing any rule above without a valid exception is `NON_COMPLIANT_BUT_RECORDED`, and the per-entity tax position returns `UNCOMPUTED` with a high-severity structural warning.

### §6.4 — Entity-validity rules

- **Company** — branches on `companySubtype`: share-capital companies (`PROPRIETARY`/`PUBLIC`/`UNLIMITED`/`NO_LIABILITY`) need ≥1 `DIRECTOR_OF` + ≥1 `SHAREHOLDER_OF`; `LIMITED_BY_GUARANTEE` needs ≥1 `DIRECTOR_OF` + ≥1 `MEMBER_OF` + **zero** `SHAREHOLDER_OF`.
- **Discretionary / Hybrid / Testamentary Trust** — ≥1 `TRUSTEE_OF`; ≥1 `BENEFICIARY_OF`; `APPOINTOR_OF` present (warn if not).
- **Unit Trust** — ≥1 `TRUSTEE_OF`; ≥1 `UNITHOLDER_OF`.
- **Deceased Estate** — ≥1 `EXECUTOR_OF` or `ADMINISTRATOR_OF`; `estateAdministrationStatus` set.
- **SMSF** — §6.3.
- **Partnership** — ≥2 `PARTNER_OF`.

### §6.5 — Cycles (corrected v3 — detect, do not blanket-reject)

- **Control chain** (`TRUSTEE_OF`) — no entity is its own trustee-ancestor; depth ≤ 10. A genuine `TRUSTEE_OF` self-cycle is an `IMPOSSIBLE_SYSTEM_ERROR`.
- **Ownership chain** (`SHAREHOLDER_OF` + `UNITHOLDER_OF` + `PARTNER_OF`) — **circular cross-shareholdings are legal** (Co A owns 40% of Co B; Co B owns 20% of Co A). They are **detected and recorded**, not rejected — flagged, and allowed if `accountantVerified` or user-acknowledged. The calculation engine **must not recursively attribute** net worth or tax through an unresolved cycle: it returns `UNCOMPUTED` with a high-severity structural warning until a cycle-resolution method is supplied. Only a prohibited *self-edge* is rejected.

---

## §7 — Proposed data model

New + changed Prisma models. **Additive throughout** (§10). **All money / percentage / quantity / cost-base fields use `Decimal`** (corrected v3 — `Float` rounding is unacceptable in a tax system; `Int` is too coarse for fractional units). See §12 Q-DEC for the codebase-wide Float→Decimal question.

```prisma
enum EntityRelationshipType {
  TRUSTEE_OF  APPOINTOR_OF  GUARDIAN_OF  POWER_HOLDER_OF  SETTLOR_OF
  BENEFICIARY_OF  EXECUTOR_OF  ADMINISTRATOR_OF  LEGAL_PERSONAL_REPRESENTATIVE_FOR
  UNITHOLDER_OF  SHAREHOLDER_OF  DIRECTOR_OF  SECRETARY_OF  PUBLIC_OFFICER_OF
  MEMBER_OF  PARTNER_OF  OPERATES_AS_SOLE_TRADER  FAMILY_MEMBER_OF  ASSOCIATE_OF
}
enum BeneficiaryClass { PRIMARY  GENERAL  DEFAULT  NAMED  RESIDUARY  SPECIFIC_GIFT  LIFE_TENANT  REMAINDERMAN }
enum StructuralState { VALID  NON_COMPLIANT_BUT_RECORDED  IMPOSSIBLE_SYSTEM_ERROR }

model EntityRelationship {
  id            String                 @id @default(uuid())
  userId        String
  fromEntityId  String
  toEntityId    String
  type          EntityRelationshipType
  effectiveFrom DateTime  @default(now())
  effectiveTo   DateTime?

  // Edge-specific metadata (small, structured; equity detail is first-class below).
  beneficiaryClass     BeneficiaryClass?
  partnerInterestPct   Decimal?  @db.Decimal(9,6)   // PARTNER_OF — a change closes this edge + opens a new one
  partnerCapitalAmount Decimal?  @db.Decimal(19,4)
  familyRelation       String?                       // FAMILY_MEMBER_OF — SPOUSE/DE_FACTO/CHILD/PARENT/SIBLING/OTHER_RELATIVE
  lprReason            String?                       // LEGAL_PERSONAL_REPRESENTATIVE_FOR — DEATH/INCAPACITY/MINOR/EPOA/OTHER
  appointorPower       String[]                      // APPOINTOR_OF — CAN_REMOVE_TRUSTEE / CAN_APPOINT_TRUSTEE / ...
  powerType            String?                       // POWER_HOLDER_OF
  powerSubject         String?                       // POWER_HOLDER_OF
  tfnQuoted            Boolean?                       // BENEFICIARY_OF / SHAREHOLDER_OF / UNITHOLDER_OF — TFN-withholding fact
  sourceDocumentId     String?
  notes                String?

  structuralState    StructuralState @default(VALID)
  accountantVerified Boolean   @default(false)
  verifiedAt         DateTime?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user       User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  fromEntity LegalEntity @relation("RelationshipsFrom", fields: [fromEntityId], references: [id], onDelete: Cascade)
  toEntity   LegalEntity @relation("RelationshipsTo",   fields: [toEntityId],   references: [id], onDelete: Cascade)
  shareParcels ShareParcel[]
  @@index([userId]) @@index([fromEntityId]) @@index([toEntityId]) @@index([type])
  // Duplicate guard: the service rejects a new edge whose [from,to,type] overlaps an
  // existing edge's [effectiveFrom,effectiveTo] window — without it, "≥1 director"
  // passes with two copies of one director.
  @@map("entity_relationships")
}

enum ShareClass { ORDINARY  PREFERENCE  REDEEMABLE_PREFERENCE  A_CLASS  B_CLASS  C_CLASS  OTHER }
enum EquityKind { SHARE  UNIT }
model ShareParcel {
  id             String   @id @default(uuid())
  relationshipId String
  kind           EquityKind
  shareClass     ShareClass @default(ORDINARY)
  quantity       Decimal  @db.Decimal(24,8)   // Decimal — fractional units exist
  paidPerUnit    Decimal  @db.Decimal(19,6)
  unpaidPerUnit  Decimal  @db.Decimal(19,6) @default(0)
  acquiredAt     DateTime
  disposedAt     DateTime?
  relationship   EntityRelationship @relation(fields: [relationshipId], references: [id], onDelete: Cascade)
  @@index([relationshipId]) @@map("share_parcels")
}

// Joint vs common ownership — split into group + stake (corrected v3: joint
// tenancy has survivorship; it is NOT fractional ownership).
enum TenancyType { SOLE  JOINT_TENANTS  TENANTS_IN_COMMON  OTHER }
model OwnershipGroup {
  id              String   @id @default(uuid())
  userId          String
  ownedObjectType String              // 'property' | 'loan' | 'account' | 'investmentAccount' | 'asset'
  ownedObjectId   String
  tenancyType     TenancyType
  effectiveFrom   DateTime @default(now())
  effectiveTo     DateTime?
  stakes          OwnershipStake[]
  @@index([userId]) @@index([ownedObjectType, ownedObjectId]) @@map("ownership_groups")
}
model OwnershipStake {
  id                  String   @id @default(uuid())
  ownershipGroupId    String
  entityId            String
  sharePct            Decimal? @db.Decimal(9,6)  // REQUIRED for TENANTS_IN_COMMON (must sum 100); optional/reporting-only for JOINT_TENANTS
  survivorshipApplies Boolean  @default(false)   // true for JOINT_TENANTS — estate engine must NOT pass the interest through the deceased estate
  notes               String?
  group  OwnershipGroup @relation(fields: [ownershipGroupId], references: [id], onDelete: Cascade)
  entity LegalEntity    @relation(fields: [entityId], references: [id], onDelete: Cascade)
  @@index([ownershipGroupId]) @@map("ownership_stakes")
}

// Beneficial ownership ≠ legal title — asset-scoped (replaces the broad NOMINEE_FOR edge).
enum BeneficialOwnershipBasis { BARE_TRUST  NOMINEE  CUSTODIAN  RESULTING_TRUST  OTHER }
model BeneficialOwnershipOverride {
  id                      String   @id @default(uuid())
  userId                  String
  legalOwnerEntityId      String   // who holds legal title
  beneficialOwnerEntityId String   // who is economically entitled
  ownedObjectType         String   // asset / shareParcel / ownershipStake / investmentHolding
  ownedObjectId           String
  basis                   BeneficialOwnershipBasis
  effectiveFrom           DateTime @default(now())
  effectiveTo             DateTime?
  sourceDocumentId        String?
  accountantVerified      Boolean  @default(false)
  verifiedAt              DateTime?
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@index([userId]) @@index([ownedObjectType, ownedObjectId]) @@map("beneficial_ownership_overrides")
}

// LegalEntity additive fields
model LegalEntity {
  // ... all existing Phase 41 fields unchanged ...
  companySubtype       CompanySubtype?
  dateOfBirth          DateTime?
  directorIdEncrypted  String?     // Q2 — encrypted via tfnEncryption.ts; never logged / AI / default API
  householdMemberId    String?
  // Capability flags (§3A / review C8)
  canHoldLegalTitle               Boolean @default(true)
  taxReportingEntity              Boolean @default(true)
  requiresTrusteeOrNomineeForLegalTitle Boolean @default(false)  // true for Trust / Partnership
  // Residency (G1) — replaces the bare Phase 41E isForeignResident boolean (kept, now derived)
  taxResidencyStatus           String?   // AUSTRALIAN_RESIDENT / FOREIGN_RESIDENT / TEMPORARY_RESIDENT / DUAL_RESIDENT / UNKNOWN
  centralManagementControlCountry String?
  placeOfIncorporation         String?
  // Jurisdiction (G4) — state-varying land tax / duty / association law
  governingJurisdiction        String?   // e.g. NSW / VIC / QLD / FEDERAL / FOREIGN
  registrationJurisdiction     String?
  // Trust-specific (G3)
  vestingDate                  DateTime?
  perpetuityPeriod             String?
  deedDate                     DateTime?
  lastVariationDate            DateTime?
  trustProperLawJurisdiction   String?
  // Estate-specific
  estateAdministrationStatus   String?   // EARLY / PARTLY / FULLY_ADMINISTERED / FINAL_DISTRIBUTION_COMPLETE
  // Regulatory + structural state
  regulatoryStatus    String[]           // ACNC_REGISTERED_CHARITY / DGR / INCOME_TAX_EXEMPT / NFP / ...
  unsupportedStructure Boolean @default(false)   // true when type = OTHER
  structuralState     StructuralState @default(VALID)
  accountantVerified  Boolean @default(false)
  relationshipsFrom   EntityRelationship[] @relation("RelationshipsFrom")
  relationshipsTo     EntityRelationship[] @relation("RelationshipsTo")
}
enum CompanySubtype { PROPRIETARY  PUBLIC  LIMITED_BY_GUARANTEE  UNLIMITED  NO_LIABILITY }
```

> **`OwnershipStake` vs `EntityRelationship` — the boundary (§3A).** `OwnershipGroup`/`OwnershipStake` answer *"who owns this **asset**"* (property, loan, account). `SHAREHOLDER_OF`/`UNITHOLDER_OF` answer *"who owns this **entity's equity**"*. `BeneficialOwnershipOverride` answers *"legal title and beneficial ownership differ for this **specific** asset/parcel."* The build must keep these crisp — never record a shareholding as an `OwnershipStake`, never a real-estate split as an `EntityRelationship`.

**Trust deed rules (G2)** — the existing Phase 41f `TrustDeedExtractedRules` (JSON, PDF-extracted) is retained. Part 2 promotes a structured `TrustDeedRule` model (ruleType, ruleValue, extractedConfidence, accountantVerified, effective dates) to SSOT for deed-derived facts (vesting, streaming powers, default-beneficiary clauses, income definition). Detailed in the Part 2 design pass.

---

## §8 — Tax treatment, money-flow & the single-engine SSOT commitment

### §8.1 — How tax works on each structure (current law)

| Structure | Tax regime (AU, current law) |
|---|---|
| **Individual** | Progressive marginal rates + Medicare levy; tax-free threshold; CGT 50% discount (>12 mo); negative gearing. |
| **Company** | **25%** base-rate entity (aggregated turnover < $50M **and** base-rate-entity passive income ≤ 80% of assessable income), else **30%**. **No CGT discount.** Div 7A on loans/payments/benefits to shareholders or associates. *Three separate concepts — keep them distinct:* company **income-tax rate**; **corporate tax rate for imputation purposes**; the **actual franking** attached to a specific dividend (unfranked / partly / fully — depends on the franking account, not just the rate). |
| **Discretionary trust** | Generally **not taxed as a separate taxpayer**. Net income is assessed to beneficiaries who are **presently entitled** or **specifically entitled** (Div 6 / Div 6E). The **trustee** is assessed under **s98** (beneficiary under a legal disability / non-resident), **s99 / s99A** (no beneficiary presently entitled). The engine must never apply a naive "distributed ⇒ beneficiary taxed, else trustee top rate" model without present-entitlement, beneficiary status, residency and the s98/s99/s99A assessment codes. |
| **Unit trust** | Flow-through; distributes by fixed unit %. |
| **Testamentary trust** | Minor-beneficiary income can be **excepted trust income** (adult marginal rates, not penalty minor rates) — **but only** for income from assets of the deceased estate; income from assets injected on/after 1 Jul 2019 unrelated to the estate is **not** excepted. Requires `assetSource` tracking (see below). |
| **Deceased estate** | Income during administration is assessed to the **executor/administrator**. A `BENEFICIARY_OF` edge does **not** by itself create present entitlement — the engine weighs `estateAdministrationStatus`, actual interim distributions, and whether the beneficiary has an indefeasible vested interest. |
| **SMSF** | **15%** on contributions + accumulation-phase earnings. Retirement-phase earnings are **Exempt Current Pension Income (ECPI)** — directionally 0% but with its own calculation (actuarial certificate where applicable, assessable-contribution and NALI exclusions). Accumulation-phase capital gains: one-third discount (>12 mo) → effective 10%. **NALI** is taxed at the top rate; a non-complying fund at the top rate. Per-member: `memberAccountPhase` (ACCUMULATION / RETIREMENT_PHASE / TRANSITION_TO_RETIREMENT); per-fund `smsfIncomeTreatment` (ASSESSABLE_15 / ECPI_EXEMPT / NALI_TOP_RATE / NON_COMPLYING_TOP_RATE). No blanket 0% pension rule. |
| **Partnership** | Flow-through — no tax at partnership level; partners taxed on their share. Legal title to partnership assets sits with partners or a nominee, not the (non-legal-person) partnership. |
| **Sole trader** | Taxed inside the individual's return. |

**Asset-source tracking** (testamentary trusts) — `assetSource` per asset: `DECEASED_ESTATE_ORIGINAL` / `CONVERSION_OF_ESTATE_ASSET` / `ACCUMULATION_FROM_ESTATE_ASSET` / `EXTERNAL_INJECTION_POST_2019` / `OTHER`. Excepted-income treatment applies only where the source qualifies.

> **Announced reforms are NOT current law.** The eight Phase 41E measures (negative-gearing restriction, CGT-discount change, the **30% discretionary-trust minimum tax**, foreign-resident CGT, loss carry-back, etc.) are **announced / proposed** — they sit in a separate "announced reforms" register, never the current-law table. None applies until its `commencementVerified` flag in `taxYearConfig.ts` is set post-Royal-Assent (CLAUDE.md §12.14 FW-2). Phase 44 supplies graph inputs; it never flips a reform gate.

### §8.2 — Money-flow eligibility is derived from the graph; actual money-flow is recorded in transactions

(Heading corrected v3.) The graph answers **"who *can* receive / control / own / act / benefit"** — eligibility and structure. It does **not** record **what actually happened**:

- A discretionary-trust topology shows *eligible* beneficiaries — not the actual per-FY distribution.
- A company's shareholders show *who could* receive a dividend — not whether one was declared, or how it was franked.
- A partnership's `partnerInterestPct` is the default — the agreement can allocate income/capital differently.
- An SMSF's members show *who* — not the contributions, pensions, ECPI, NALI, or TBC amounts.

So: **Graph = eligibility / control / ownership structure. Transaction, resolution and distribution models (Part 2) = what actually happened in an income year. Tax engine = applies the law to graph + transactions + verified metadata.** Part 2 introduces `DistributionResolution` (per-FY discretionary splits), `DividendDistribution` (actual dividend + franking), and `PrivateCompanyBenefit` (Div 7A loans / payments / debt forgiveness / UPEs / sub-trusts) — none of which can be inferred from topology alone.

### §8.3 — The SSOT & single-calculation-engine rule (non-negotiable)

> **Phase 44 adds ZERO calculation logic. It is a *data layer*.**

CLAUDE.md §12.2 / §12.3 / §6.1 applied here, a reviewer-reject rule:

1. **All tax computation stays in the one existing engine — `lib/tax-engine/`.** Phase 44 adds no tax module, duplicates none, forks none.
2. **Phase 44 gives the engine a cleaner input** — the typed graph + (Part 2) the transaction models, replacing the `TrustDeedExtractedRules` JSON input format. The graph never becomes a second engine.
3. **No tax arithmetic in the entity/relationship layer.** The service, routes, and UI create / validate / read edges — a per-entity tax figure comes only from `calculateEntityTaxPosition()`.
4. **No financial aggregation outside the canonical services** — net worth / income / expense / cashflow flow through `getMasterFinancialSnapshot()` + `lib/calculations/*`.
5. **Reviewer-reject:** any Phase 44 PR with tax or financial arithmetic outside `lib/tax-engine/` / `lib/calculations/` is rejected.

### §8.4 — The centralised entity-rules engine (SSOT architecture)

Phase 44's logic is **centralised into canonical modules — each the single source of truth for one concern, consumed everywhere, re-implemented nowhere** (CLAUDE.md §12.2 / §12.3). It is deliberately *not* one mega-engine — a single blob mixing rules, traversal and tax would itself violate separation of concerns. Instead, each concern has exactly one home:

| Concern | Canonical SSOT module | Consumed by |
|---|---|---|
| **The grammar** — node/edge legality, the §6 validity matrix, the corrected SMSF rules (§6.3), the three-state classifier (§6.1), cycle detection (§6.5) | `lib/entity-graph/validityMatrix.ts` — **pure functions, no I/O** | the relationship service (write-time validation); the entity-section UI (live "is this valid / compliant?" feedback); the onboarding wizard; any structural-completeness check |
| **Relationship & ownership writes** | `lib/services/entityRelationshipService.ts` — the **only** writer of `EntityRelationship` / `OwnershipGroup` / `OwnershipStake` / `BeneficialOwnershipOverride`; calls `validityMatrix` inside the write transaction; audited | every API route + UI flow that mutates the graph |
| **Graph traversal / queries** — "who controls entity X?", "the ownership chain of X", "resolve the beneficial owner of asset A", "is X an associate of Y for Div 7A?" | `lib/entity-graph/queries.ts` — **pure functions over the loaded graph** | the tax engine, the calc engines, the entity UI, the AI advisor — all read these, none re-walks the graph itself |
| **Per-entity tax** | `lib/tax-engine/` — the **existing** single engine, unchanged (§8.3) | — (Phase 44 feeds it; never duplicates it) |
| **Financial aggregation** (net worth, income, cashflow) | `getMasterFinancialSnapshot()` + `lib/calculations/*` — **existing**, unchanged | — |

The contract: **no route handler, no React component, no second service ever re-implements a validity rule or a graph traversal.** "A company needs a director", "an SMSF's directors must equal its members", "who controls this trust" — each is exactly one function. When a rule changes (a law change, a deed nuance, a new entity type), it changes in **one place** and every consumer — wizard, entity UI, tax engine, AI advisor — inherits it automatically.

So: the entity graph is a centralised **data layer** + a centralised **rules engine** (`lib/entity-graph/`). It does not *contain* a tax engine or a calc engine — those already exist as their own SSOTs. Three engines, three single sources of truth, one direction of flow: **graph → tax/calc engines → UI**. That is what keeps SSOT valid end-to-end.

---

## §9 — Legal-positioning strategy

The way to not cause legal issues is **architecture, not perfectionism**:

1. **Monitrax is a faithful digital twin, not a determiner.** The adviser's diagram is the source of truth; Monitrax records and keeps it current.
2. **The three-state model (§6.1) is the core control.** `VALID` / `NON_COMPLIANT_BUT_RECORDED` / `IMPOSSIBLE_SYSTEM_ERROR` — non-compliant reality is recorded and flagged, never erased, never silently blessed.
3. **`accountantVerified` is first-class** on entities, relationships, and beneficial-ownership overrides — provenance is explicit.
4. **Every tax number is an estimate** — conservative, traceable, deferrable; `UNCOMPUTED` where the engine cannot be confident (defective structure, unresolved cycle, missing transaction data).
5. **Legal title / beneficial ownership / control are kept separate (§3A)** — the model never infers one from another without a rule or a verified source. This is what stops the graph becoming a "fake legal oracle" producing false certainty.
6. **The structural AFSL / TPB / NCCP boundary is reused** (Phase 41 tool registry, the `Q-PRA-1` decision) — explain a structure, never advise on one.
7. **An accountant-review path** — a share-pass (the `SharePackage` *pattern*, not the model) turns `accountantVerified` into a professional sign-off.

Net: a record-keeping, organisation and estimation tool with explicit provenance and explicit deferral — defensible. Not an authoritative tax engine — which it must never claim to be.

---

## §10 — Migration & backwards compatibility

- **`parentEntityId` → `TRUSTEE_OF` edge**, then `parentEntityId` is **FROZEN read-only** (it is a single self-FK and cannot represent a shared corporate trustee — not a cache). Calculations move to the graph in Part 1b.
- **`ownerEntityId` untouched** — the 11 files reading it are unaffected; `OwnershipGroup`/`OwnershipStake` layer beside it, opt-in per object.
- **`PERSONAL_NAME` entities preserved**; Phase 41a backfill unchanged.
- **`isForeignResident` retained** but becomes derived from the richer `taxResidencyStatus`; the Phase 41E dispatch is unaffected.
- **`TrustDeedExtractedRules` coexists** — Part 2 promotes structured `TrustDeedRule` as SSOT; the extraction becomes one input.
- Every migration additive — no `DROP` / destructive `ALTER`. §12.11 N/A; §12.12 schema+migration same PR.

---

## §11 — Build sequence

**Part 1 — the structural graph (review-gated).**

- **1a — Schema + migration.** `EntityRelationship`, `ShareParcel`, `OwnershipGroup`/`OwnershipStake`, `BeneficialOwnershipOverride`, all enums; `LegalEntity` field additions; `LegalEntityType`/`Role` extensions; the `parentEntityId` → `TRUSTEE_OF` migration. **Decimal** for all financial fields. Additive only.
- **1b — Centralised rules engine + service layer + migrate calculations off `parentEntityId`.** `lib/entity-graph/validityMatrix.ts` (the §6 grammar — pure functions, SSOT) + `lib/entity-graph/queries.ts` (graph traversal — pure functions, SSOT) + `lib/services/entityRelationshipService.ts` (the only writer of the graph; calls `validityMatrix` inside the write transaction; audited). See §8.4 for the SSOT architecture. The `OwnershipGroup`/`OwnershipStake` and `BeneficialOwnershipOverride` services. **All calculations reading `parentEntityId` repointed to the `TRUSTEE_OF` edges (via `queries.ts`) here, not 1c.**
- **1c — Entity-section UI.** `EntityTree` → a true multi-edge graph (control sub-graph emphasised; the three §3A dimensions visually distinct); entity-detail lists all relationships; the accountant-review share-pass; the three-state badges.
- **1d — Onboarding wizard.** Extend `EntitiesStep` — a relationship sub-step capturing a working-graph skeleton (every entity + the load-bearing edges), progressive disclosure, finishable later in the entity section.

**Part 2 — money-flow, transactions & tax-engine rewire (separate design pass — higher legal risk).**

- **Part 1 does NOT touch the tax engine.** During Part 1 the engine keeps reading `TrustDeedExtractedRules` JSON exactly as today (§8.3) — so no tax-engine review is needed to ship the structural graph.
- **Part 2's design pass opens with a full tax-engine audit.** Before any rewire, every existing `lib/tax-engine/` module is audited against (a) the new graph + transaction inputs it will consume, and (b) the correctness points the two design reviews surfaced — trust assessment under s98 / s99 / s99A + present-entitlement (not naive "distributed ⇒ beneficiary"), SMSF ECPI (not a blanket 0%), testamentary excepted-income `assetSource` gating, franking computed from actual `DividendDistribution` records (not inferred from shareholding), and the Div 7A associate determination reading the `FAMILY_MEMBER_OF` / `ASSOCIATE_OF` graph. The audit confirms what the mature Phase 41e engine already handles correctly and pins exactly what the rewire must change.
- **Then the rewire:** new `DistributionResolution`, `DividendDistribution`, `PrivateCompanyBenefit` (Div 7A), structured `TrustDeedRule` models; repoint `trustDistribution.ts` / `div6E.ts` / `div7A.ts` / `super/*` / `s100A.ts` to read graph + transactions; `MoneyFlowSankey` upgrade. The engine stays the one engine (§8.3) — only its *input shape* changes. Captured in its own design document.

---

## §12 — Open questions

| # | Question | Status |
|---|---|---|
| Q1 | Joint / shared ownership in Part 1? | ✅ DECIDED 2026-05-20 — yes, Part 1c; any split, any co-owner count; `OwnershipGroup`+`OwnershipStake` with survivorship for joint tenancy. |
| Q2 | Director ID — value or presence? | ✅ DECIDED — store the value, encrypted. `tfnQuoted` added for the TFN-withholding case. |
| Q3 | Wizard capture depth? | ✅ DECIDED — working-graph skeleton, refined in the entity section. |
| Q4 | Accountant-review share-pass — Part 1c? | ✅ DECIDED — yes, Part 1c. |
| **Q-DEC** | **Codebase-wide `Float` → `Decimal` migration.** Phase 44's new models use `Decimal` (correct for a tax system). But the *entire existing Monitrax schema* uses `Float` for money, and the tax/calc engines work in JS `number`. A full migration is a large separate workstream touching every financial model + every engine. | **OPEN — needs Reza's call.** Phase 44 proceeds with `Decimal` for its new fields regardless. The question is whether/when to commission the codebase-wide migration. Recommendation: schedule it as a dedicated workstream before first paying user — `Float` money bugs are silent and compounding. |

---

## §13 — Governance & doc-sync

On build, per CLAUDE.md §16: Part 1a updates `03_DATA_MODEL.md` (new §3.10) + migration (§12.12); 1b/1c/1d update `07_API_STANDARDS.md`, `06_UI_UX_FOUNDATION.md`; every PR updates `IMPLEMENTATION_PLAN.md` (§15) + a daily `CHANGELOG`; the §12.14 block on each PR (schema columns on entity models). New sensitive surface beyond the encrypted-TFN pattern: only the encrypted Director ID (Q2) — same treatment.

**This document is the Part 1 design contract.** Reza reviewed and approved v3 on 2026-05-20; Part 1 build is authorised. **The accountant sanity-check of §3A–§6 is deferred to Basiq-onboarding prep** (Reza decision 2026-05-20) — the structural model was hardened by two independent adversarial reviews (§14), so the build proceeds now; the accountant confirmation becomes diligence evidence for the Basiq submission and is tracked in `IMPLEMENTATION_PLAN.md` D-Day Bundle row T3.4.

---

## §14 — Design-review record

The doc was stress-tested by **two independent adversarial reviews** before going to build.

**Review 1 (internal review agent, 2026-05-20)** — found 4 critical issues (single-member SMSF rule, the `parentEntityId` cache fallacy, `TRUSTEE_OF` ambiguity, the missing ownership-cycle rule) + gaps + tax-fact errors. All incorporated into v2.

**Review 2 (external AI review, 2026-05-20)** — found that v2 still (a) over-claimed combination-completeness, (b) had the SMSF corporate-trustee rule still too loose (directors must = members both ways), (c) overstated the appointor as universal control, (d) modelled deceased estates, joint tenancy, and nominees too crudely, (e) used `Float` for tax-sensitive values, (f) blurred legal title / beneficial ownership / control, (g) blurred eligibility vs actual money-flow, and (h) had a binary accept/reject model that would refuse to record real-but-non-compliant structures. **All incorporated into this v3** — the §3 claim is narrowed; §3A added; the SMSF rule (§6.3), three-state model (§6.1), cycle handling (§6.5), `Decimal` (§7), `OwnershipGroup` split, `BeneficialOwnershipOverride`, executor/LPR/family/associate/power edges, residency + jurisdiction + estate metadata, and the §8.1/§8.2 tax corrections all land here.

### §14.1 — Combination-completeness acceptance tests

The build is not started until the design (and then the implementation) handles each:

| # | Structure | Required outcome |
|---|---|---|
| 1 | Single-member SMSF, two-director corporate trustee | `VALID` only if the 2nd director satisfies the single-member permitted conditions (§6.3). |
| 2 | Multi-member SMSF, a non-member corporate-trustee director, no exception | `NON_COMPLIANT_BUT_RECORDED`; per-entity tax `UNCOMPUTED`. |
| 3 | SMSF LRBA — property via a bare/holding trust + limited-recourse loan | Representable via `BARE_TRUST` + `BeneficialOwnershipOverride` + (Part 2) LRBA loan metadata. |
| 4 | Testamentary trust, minor beneficiary, later external asset injection | Representable; excepted-income treatment only for estate-derived income (`assetSource`). |
| 5 | Partnership of two discretionary trusts | Representable — `PARTNER_OF`; legal title to assets still via trustee/nominee. |
| 6 | Company limited by guarantee, ACNC-registered charity, DGR, income-tax-exempt | Representable via `companySubtype` + `regulatoryStatus`. |
| 7 | Incorporated association owns property | Representable via `INCORPORATED_ASSOCIATION`. |
| 8 | Nominee shareholder — A on the register, Trust X beneficial owner of those shares | Representable only via `BeneficialOwnershipOverride` scoped to the specific parcel. |
| 9 | Deceased estate mid-administration earning income | Representable via `EXECUTOR_OF`/`ADMINISTRATOR_OF` + `estateAdministrationStatus`; beneficiaries not presently entitled. |
| 10 | Cross-shareholding — Co A owns 40% of Co B, Co B owns 20% of Co A | Recorded (not rejected); attribution returns `UNCOMPUTED` until a cycle-resolution method exists. |

---

## §15 — Acceptance criteria before build

Phase 44 Part 1a does not start until every box is satisfied in this document (all are, as of v3 — listed for the implementer's pre-flight check):

- [x] SMSF corporate-trustee validation handles multi-member (members ⇔ directors) + single-member funds (§6.3).
- [x] SMSF exceptions modelled via `LEGAL_PERSONAL_REPRESENTATIVE_FOR` (§5).
- [x] Appointor described as a control *indicator*, not universal proof; not expected on SMSFs (§5, §6.2).
- [x] Entity taxonomy adds incorporated association / co-operative / foreign company / strata / custodian + `regulatoryStatus`, or narrows the claim — both done (§3, §4).
- [x] Deceased estate has executor/administrator roles + administration status (§5, §7).
- [x] Joint tenants modelled with survivorship, not as fixed-percentage owners (§7).
- [x] Nominee / bare-trust relationships are asset-scoped (`BeneficialOwnershipOverride`, §7).
- [x] `Decimal` for all financial / percentage / quantity fields (§7); codebase-wide question logged (§12 Q-DEC).
- [x] Franking / Div 7A are Part 2 transaction models, not graph-inferred (§8.2, §11).
- [x] Testamentary excepted-income tracks `assetSource` (§8.1).
- [x] SMSF ECPI / pension-phase logic, not a blanket 0% (§8.1).
- [x] Ownership cycles detected + recorded, not blanket-rejected (§6.5).
- [x] `NON_COMPLIANT_BUT_RECORDED` state exists (§6.1).
- [x] §8.2 separates eligibility from actual money-flow.
- [x] Legal title / beneficial ownership / control kept as three separate dimensions (§3A).
- [x] Structured trust-deed-rule model has an explicit Part 2 dependency (§7, §11).
