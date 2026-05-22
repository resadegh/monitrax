# Phase 44 — Entity Graph & Structure Modelling

> **Status:** 🟡 DESIGN — not yet built. This document is the design deliverable; code follows only after Reza review (and, ideally, an accountant sanity-check of the model).
> **Owner:** Reza (direction + structural review) + Claude (research, design, build).
> **Created:** 2026-05-20.
> **Supersedes nothing. Extends:** Phase 41 (`PHASE_41_REGULATORY_ARCHITECTURE.md`) — the entity *type/role* layer. Phase 44 adds the *relationship* layer Phase 41 explicitly deferred.
> **Related:** `docs/architecture/03_DATA_MODEL.md` §10 (Entity Layer), `04_GRDCS_SPECIFICATION.md`, `PHASE_41E_REFORM_2026_27.md`, CLAUDE.md Part 13 (CDR), §0 (advisory mindset).

---

## §1 — Problem

Phase 41 shipped a solid entity *type* layer: `LegalEntity` rows with a `type` (Personal / Company / Discretionary Trust / Unit Trust / SMSF / Partnership / Sole Trader), a `role`, identifiers (ABN / ACN / encrypted TFN), and the Phase 41E reform inputs (`trustType`, `isForeignResident`). Every owned object — `Property`, `Loan`, `Account`, `InvestmentAccount`, `Asset`, `Income`, `Expense` — attaches to an entity via `ownerEntityId`.

But Phase 41 models **relationships between entities** with exactly one mechanism: a single self-foreign-key, `LegalEntity.parentEntityId`, expressing **one** trustee→trust link per entity. Phase 41 explicitly deferred everything else: shareholding, directorship, beneficiary entitlements, partnership interests, SMSF membership.

Real Australian structures are not trees. They are **directed many-to-many graphs**. A worked example (§2) cannot be entered into Monitrax today — not "is hard to enter", *cannot be represented at all*:

- one company is **trustee of** a trust **and** has its own directors, members, and shareholders;
- one natural person is **director of** several companies, **shareholder of** some, **and** **beneficiary of** multiple trusts and an SMSF;
- a trust is simultaneously a **beneficiary of** one entity, a **shareholder of** another, and **has its own** trustee and appointor.

Each of those is several edges on one node. `parentEntityId` holds one. There is also **no equity model** (who holds how many shares, of what class, paid how much — `SharePackage` is document-sharing, unrelated), **no way to record natural persons who are not Monitrax users** (a spouse, a child beneficiary, a business partner), and **no model of inter-entity money flow** (distributions, dividends, Div 7A loans).

**Why it matters.** Every downstream number — net-worth attribution, the per-entity tax position, the Phase 41E reform dispatch — reads ownership and control off this layer. If the layer cannot represent who owns and who controls what, the calculations are wrong *by construction*. Wrong tax numbers are a legal-exposure surface (§9). And the onboarding wizard cannot ask the right questions if the model cannot store the answers.

---

## §2 — Worked example (the archetype)

The structure that prompted this phase — a real adviser-produced group structure — is the canonical test case. **Anonymised** here (no real ABNs / ACNs / TFNs / DOBs are recorded in Monitrax docs or code; the *shape* is what matters):

```
                 Individual A ──director/secretary──┐         ┌──director──── Individual B
                      │                             ▼         ▼
                      │                      ┌─────────────────────┐
                      ├──shareholder────────▶│  Holding Co Pty Ltd  │
                      │                      └──────────┬──────────┘
                      │                                 │ shareholder
                      ▼                                 ▼
              ┌────────────────┐   trustee-of   ┌──────────────────────┐
              │ Investment Co  │───────────────▶│  Family Trust        │
              │ Pty Ltd        │   ("ATF")      │  (discretionary)     │
              │ (corporate     │                └──────────┬───────────┘
              │  trustee)      │                  beneficiary-of (in)
              └────────────────┘                 ┌─────────┴──────────┐
                                                 ▼                    ▼
                                          Individual A          Individual B
                                                 ▲                    ▲
                                                 │  beneficiary-of    │
                                          ┌──────┴────────────────────┴──────┐
                                          │  SMSF (self-managed super fund)   │
                                          └────────────────┬──────────────────┘
                                                  trustee-of ("ATF")
                                                           ▲
                                                  ┌────────┴────────┐
                                                  │ SMSF Trustee Co │
                                                  │ Pty Ltd         │
                                                  └─────────────────┘
```

Edges present in this **one** example: `director-of`, `secretary-of`, `shareholder-of` (with share parcels), `trustee-of`, `beneficiary-of`, plus the implied `member-of` (SMSF), and the missing-but-legally-critical `appointor-of` (see §5). This is *one sentence*. The model must be the *language* that generates every sentence.

---

## §3 — Core design principle: model the grammar, not the combinations

Reza's brief: *"capture all combinations possible."* The wrong reading is to enumerate structures. The right reading — and the entire architectural thesis of Phase 44:

> **A correctly typed graph is combination-complete by construction.** Define the finite set of **node types** (entity types), the finite set of **directed edge types** (relationship types), and the **validity matrix** (which edge types are legal between which node types, with what cardinality and constraints). Any real structure — Reza's, or one nobody has drawn yet — is then just a set of nodes and edges drawn from that grammar. There is nothing to enumerate.

Consequences that fall out of this principle and are treated as non-negotiable in the design below:

1. **One relationship model, not one model per relationship.** Phase 41's deferral note floated "new first-class models OR a generic junction." Phase 44 chooses the generic typed junction (`EntityRelationship`) — adding a relationship type must never require a schema migration.
2. **Relationships are directed and time-bounded.** Every edge has a direction (`from` → `to`) and an `effectiveFrom` / `effectiveTo` (a director resigns; a trust vests; shares are sold). Tax correctness — CGT acquisition dates, franking periods — depends on this.
3. **Natural persons are nodes.** Not all are Monitrax users. The graph must hold a spouse, a child beneficiary, a business partner who will never log in.
4. **The validity matrix is enforced, not advisory.** A company with zero directors, an SMSF with seven members, a trust with no trustee — these are not just unusual, they are *legally invalid*, and the model must be able to say so.

---

## §4 — Node taxonomy (entity types)

Current `LegalEntityType`: `PERSONAL_NAME`, `COMPANY`, `DISCRETIONARY_TRUST`, `UNIT_TRUST`, `SMSF`, `PARTNERSHIP`, `SOLE_TRADER`. Proposed Phase 44 set (additions marked **NEW**):

| Type | What it is | Identifiers | Notes |
|---|---|---|---|
| `INDIVIDUAL` **NEW** | A natural person as a legal actor — can be a director, shareholder, beneficiary, trustee, member. | TFN (encrypted), DOB | Replaces the overloaded `PERSONAL_NAME` as the *person node*. May optionally link to a `User` and/or a `HouseholdMember`, or stand alone (non-user persons). |
| `PERSONAL_NAME` | **Retained for migration safety** — the existing "assets in my own name" bucket. Post-migration, semantically an `INDIVIDUAL` that is the primary user. | TFN | Kept so the Phase 41a backfill and every `ownerEntityId` pointer stays valid. New UI presents it as the user's `INDIVIDUAL` node. |
| `COMPANY` | A registered company. | ABN, ACN | Sub-type via `companySubtype` (**NEW** field): `PROPRIETARY` (Pty Ltd) / `PUBLIC` (Ltd) / `LIMITED_BY_GUARANTEE` (has **members, not shareholders** — typical NFP) / `UNLIMITED` / `NO_LIABILITY` (mining). **The sub-type changes the §6 validity rule** — a company limited by guarantee must satisfy a members rule, not a shareholders rule. A "corporate trustee" is *not* a type — it is a `COMPANY` with a `TRUSTEE_OF` edge (§5). |
| `DISCRETIONARY_TRUST` | Family / discretionary trust — trustee distributes at discretion each FY. | ABN, TFN | `trustType` already exists (Phase 41E). Subject to the 30% minimum-tax measure. |
| `UNIT_TRUST` | Fixed-entitlement trust — distributes by unit holding. | ABN, TFN | Uses `UNITHOLDER_OF` edges (§5), not discretionary `BENEFICIARY_OF`. |
| `FIXED_TRUST` / `HYBRID_TRUST` **NEW** | Other trust shapes — fixed (non-unit) and hybrid (discretionary + unit features). | ABN, TFN | `trustType` enum already covers `FIXED`; add `HYBRID`. Keeps the engine honest rather than forcing every trust into discretionary/unit. |
| `BARE_TRUST` **NEW** | Holding trust — most importantly the **SMSF LRBA holding trust** (limited-recourse borrowing arrangement). Legal title held bare for a beneficial owner. | ABN (sometimes) | Needed because SMSF property borrowing *legally requires* a separate bare trust; modelling it wrong misattributes the property and the loan. |
| `SMSF` | Self-managed super fund. | ABN, TFN | Must have a trustee (individual-trustee structure *or* a corporate trustee). Member rules in §6. |
| `PARTNERSHIP` | General or limited partnership. | ABN, TFN | Partners via `PARTNER_OF` edges carrying interest % + capital account. |
| `SOLE_TRADER` | ABN-registered individual operating a business. | ABN | Always an extension of one `INDIVIDUAL`; modelled as a role, linked 1:1 to the person. |
| `DECEASED_ESTATE` **NEW** | Estate of a deceased person, administered before distribution. | TFN | `trustType` enum already has `DECEASED_ESTATE`; promote to a node type for estate-planning structures. |
| `TESTAMENTARY_TRUST` **NEW** | A trust created **by a will**, taking effect on death — distinct from the deceased estate itself. | ABN, TFN | **Tax-significant — must not be mistyped.** Income distributed to *minor* beneficiaries of a testamentary trust is "excepted trust income", taxed at ordinary adult marginal rates rather than the punitive Div 6AA minor rates. Mistyping it as `DISCRETIONARY_TRUST` silently loses that concession and produces wrong tax for any minor beneficiary. `trustType` gains `TESTAMENTARY`. |

`LegalEntityRole` (HOLDING / OPERATING / INVESTMENT / SUPERANNUATION / PERSONAL) is retained and gains **`CORPORATE_TRUSTEE`** **NEW** — a company whose function is purely to be a trustee (the "Trustee Company Only" / "Superfund Trustee Company Only" in the worked example). Note: role is a *UX / framing* convenience; the *authoritative* fact that a company is a trustee is the `TRUSTEE_OF` edge. Role must never be the thing a calculation depends on — edges are.

---

## §5 — Edge taxonomy (relationship types)

One enum, `EntityRelationshipType`. Each edge is `from` → `to`, directed, time-bounded. The "money / control consequence" column is what makes each edge load-bearing for calculations.

| Type | Direction (from → to) | Legal meaning | Money / control / tax consequence |
|---|---|---|---|
| `TRUSTEE_OF` | Company **or** Individual → Trust / SMSF / Bare Trust | Legal owner of the trust's assets; administers the trust. "ATF" = *as trustee for*. | The trust's assets are *legally* the trustee's but *beneficially* the trust's. Income is taxed in beneficiaries' hands (Div 6). The trustee files the trust return. |
| `APPOINTOR_OF` **(critical, currently unmodelled)** | Individual (usually) or Company → any Trust or SMSF | Can hire and fire the trustee. | **This is who actually controls the trust.** Control tests (Div 7A associate, land-tax grouping, s100A) turn on the appointor, not the trustee or beneficiaries. Omitting it makes "who controls this structure" wrong. Unit-trust and SMSF deeds carry an equivalent role — the edge is valid against **all** trust types and SMSFs, not discretionary trusts only. |
| `GUARDIAN_OF` **NEW** | Individual or Company → any Trust | A role in many modern deeds (also called *Protector*) whose **consent** the trustee must obtain before certain distributions or before amending the deed. Distinct from — and additional to — the appointor. | A second control lever. s100A and any control determination must consider the guardian alongside the appointor. One edge type covers guardian / protector — deed terminology varies. |
| `SETTLOR_OF` | Individual → Trust | Created (settled) the trust with a nominal sum; then arm's-length. | Must **not** be a beneficiary — if the settlor benefits, adverse tax consequences. Modelled so the system can *warn* if settlor also appears as beneficiary. |
| `BENEFICIARY_OF` | Individual / Company / Trust → Discretionary / Hybrid / Bare Trust, or SMSF | May receive distributions / benefits. Carries a `beneficiaryClass`: `PRIMARY` / `GENERAL` / `DEFAULT` / `NAMED`. | Discretionary trust income flows along these edges *at the trustee's annual discretion* — the split is a per-FY decision, never a fixed %. SMSF benefits flow to member-beneficiaries. |
| `UNITHOLDER_OF` | Any entity → Unit Trust | Holds units — a *fixed* proportional entitlement. | Distributions follow unit % exactly. Carries unit parcels (count, class, paid price, acquisition date) — needed for CGT on unit disposal. |
| `SHAREHOLDER_OF` | Any entity (≠ the company itself) → Company | Holds shares — equity ownership. | Franked dividends flow along these edges by share class + count. CGT on share disposal reads parcels. Div 7A: loans/payments to a shareholder are deemed dividends unless on complying terms. Carries **share parcels** (§7). |
| `DIRECTOR_OF` | Individual → Company | Manages the company; statutory duties; needs a Director ID. | Control test input. No direct money flow, but director identity drives associate/control determinations and PSI/PSB analysis. |
| `SECRETARY_OF` | Individual → Company | Company secretary — statutory compliance role. | No money flow; completeness + ASIC-record fidelity. |
| `PUBLIC_OFFICER_OF` | Individual → Company / Trust | The ATO-facing officer. | No money flow; needed so the digital twin matches the ATO record. |
| `MEMBER_OF` | Individual → SMSF; Individual → Company-limited-by-guarantee | A member of the fund / guarantee company. | SMSF: contributions flow *in* per member; pensions flow *out* per member; the contribution-cap and TBC engine is per-member. Every SMSF member **must** also be a trustee (individual structure) or a director of the corporate trustee — §6 enforces this. |
| `PARTNER_OF` | Any entity → Partnership | A partner. Carries interest % + capital-account balance. | Partnership income/loss flows to partners by interest %. Partnership is a flow-through (lodges a return, pays no tax itself). |
| `NOMINEE_FOR` **NEW** | Any entity → Any entity | The `from` entity holds an asset, shareholding, or unit-holding **as nominee / bare trustee** for the `to` entity — legal title in one name, *beneficial* ownership in another. | Critical for correct attribution. CGT, dividends, distributions, and net worth follow **beneficial** ownership, not legal title. Without this edge a nominee shareholding is silently attributed to the legal-title holder — wrong entity, wrong tax. |

Each edge type also carries: `effectiveFrom`, `effectiveTo?`, `accountantVerified` (§9), and a typed `metadata` payload (e.g. `beneficiaryClass`, `partnerInterestPct`, `directorAppointmentDate`). Equity detail (share / unit parcels) is **first-class**, not JSON — see §7.

> **Why a trust cannot be the `from` of `TRUSTEE_OF`.** A trust is not a legal person — it cannot hold legal title or be appointed to an office. The trustee of a trust is *always* ultimately a company or one-or-more individuals. A layered "trust acts as trustee for another trust" arrangement is therefore modelled at the legal-person level: the company or individuals who are trustee of Trust A simply also hold a `TRUSTEE_OF` edge to Trust B. `TRUSTEE_OF.from` is deliberately restricted to `Company | Individual` — this is legally correct, not a modelling limitation.

> **What the example was missing.** Reza's adviser diagram shows trustee, director, secretary, shareholder, beneficiary, member — but **not the appointor**. That is normal (appointors live in the deed, not the org chart) and exactly why Monitrax must prompt for it: the appointor is the single most control-significant node and the most commonly forgotten.

---

## §6 — The edge-validity matrix (the grammar)

This is the heart of "all combinations, captured *correctly*." A relationship is creatable only if it satisfies the matrix; an entity is *valid* only if its required edges exist. Enforced in `entityRelationshipService.ts` inside the write transaction (the proven Phase 41 `validateParentChain` pattern, extended).

**Edge legality** — `relationshipType` → allowed `from` types → allowed `to` types → cardinality:

| Edge | Allowed `from` | Allowed `to` | Cardinality / constraints |
|---|---|---|---|
| `TRUSTEE_OF` | Company, Individual (never a Trust — see the §5 note) | Any Trust, Testamentary Trust, Bare Trust, SMSF, Deceased Estate | A trust has ≥1 trustee. SMSF trustee arrangement: see the SMSF entity-validity rule below. |
| `APPOINTOR_OF` | Individual, Company | Any Trust, SMSF | 0..n (some deeds have joint appointors). Warn if absent. |
| `GUARDIAN_OF` | Individual, Company | Any Trust | 0..n. |
| `SETTLOR_OF` | Individual | Any Trust | 0..1. **Validation warning** if the settlor also has a `BENEFICIARY_OF` edge to the same trust. |
| `BENEFICIARY_OF` | Individual, Company, Trust | Discretionary / Hybrid / Testamentary / Bare Trust, SMSF | 0..n. An SMSF beneficiary must also be `MEMBER_OF` that fund. |
| `UNITHOLDER_OF` | Any entity | Unit Trust | ≥1 for a valid unit trust. Unit %s across all holders should sum to 100 (warn, with float tolerance). |
| `SHAREHOLDER_OF` | Any entity except the target company | Company — **except `LIMITED_BY_GUARANTEE`** (no share capital) | ≥1 for a valid share-capital company. Issued shares across holders define 100% (warn on over/under-issue, float tolerance). |
| `DIRECTOR_OF` | Individual | Company | A company must have ≥1 director (proprietary: ≥1; public: ≥3). |
| `SECRETARY_OF` | Individual | Company | 0..n (proprietary may have none; public must have ≥1). |
| `PUBLIC_OFFICER_OF` | Individual | Company, Trust, SMSF, Partnership | 0..1. |
| `MEMBER_OF` | Individual | SMSF, Company-`LIMITED_BY_GUARANTEE` | SMSF: 1..6. **Member ⇒ trustee/director is one-directional** — see the SMSF entity-validity rule below. |
| `PARTNER_OF` | Any entity (never the partnership itself) | Partnership | ≥2 partners. Interest %s sum to 100. |
| `NOMINEE_FOR` | Any entity | Any entity (≠ itself) | 0..n. Subject to the ownership-cycle rule below. |

**Entity-validity rules** (an entity is structurally complete only if):

- **Company — the rule branches on `companySubtype`:**
  - `PROPRIETARY` / `PUBLIC` / `UNLIMITED` / `NO_LIABILITY` → ≥1 `DIRECTOR_OF` (in) **and** ≥1 `SHAREHOLDER_OF` (in). Public: ≥3 directors **and** ≥1 secretary.
  - `LIMITED_BY_GUARANTEE` → ≥1 `DIRECTOR_OF` (in) **and** ≥1 `MEMBER_OF` (in), **and zero `SHAREHOLDER_OF`** — it has no share capital. A guarantee company carrying shareholders is invalid.
- **Discretionary / Hybrid / Testamentary Trust** → ≥1 `TRUSTEE_OF` (in); ≥1 `BENEFICIARY_OF` (in); `APPOINTOR_OF` present (warn if not).
- **Unit Trust** → ≥1 `TRUSTEE_OF` (in); ≥1 `UNITHOLDER_OF` (in).
- **SMSF** (SIS Act s17A — *the rule the design review corrected; C1*):
  - 1..6 `MEMBER_OF` (in).
  - **Trustee arrangement — exactly one of:** (a) **corporate trustee** — exactly one `COMPANY` with a `TRUSTEE_OF` edge in; OR (b) **individual trustees** — **≥2** individuals with `TRUSTEE_OF` edges in. The two arrangements never mix.
  - **Member ⇒ trustee/director, strictly one-directional.** Every member must *also* be `TRUSTEE_OF` the fund (individual-trustee structure) **or** `DIRECTOR_OF` the corporate trustee. **The converse is NOT required** — a trustee or corporate-trustee director need not be a member.
  - **Single-member SMSF with individual trustees** — a single-member fund using individual trustees must have **exactly one additional non-member individual trustee** (SIS Act mandates ≥2 individual trustees). That non-member trustee must **not** carry a `MEMBER_OF` edge. A single-member fund with a corporate trustee may have a sole director.
- **Partnership** → ≥2 `PARTNER_OF` (in).
- **Acyclicity — two distinct sub-graphs, both checked (*C4*):**
  - **Control chain** — no entity is its own ancestor through `TRUSTEE_OF`; depth ≤ 10.
  - **Ownership chain** *(NEW)* — no cycle through the ownership sub-graph (`SHAREHOLDER_OF` + `UNITHOLDER_OF` + `BENEFICIARY_OF` + `PARTNER_OF` + `NOMINEE_FOR`); depth ≤ 10. Without this, a circular cross-shareholding (Co A → Co B → Co A) makes every per-entity net-worth and tax attribution non-terminating or double-counted. Load-bearing for calculation correctness, not a nicety.

Validity is **graded, not gating** (psychology + product lenses, CLAUDE.md §14.3): Monitrax surfaces "this trust has no appointor recorded" as a gentle completeness nudge — it never blocks the user from saving. **One exception:** edges that are *legally impossible* (a shareholder on a guarantee company; an SMSF with 7 members) are rejected at write time — recording a structure that cannot exist is not "the user's reality", it is a data error that would poison every downstream calculation.

---

## §7 — Proposed data model

New + changed Prisma models. **Additive throughout** — no destructive change to Phase 41 (§10).

```prisma
// ─── New: the typed relationship edge ───────────────────────────────
enum EntityRelationshipType {
  TRUSTEE_OF
  APPOINTOR_OF
  GUARDIAN_OF        // guardian / protector — review-added
  SETTLOR_OF
  BENEFICIARY_OF
  UNITHOLDER_OF
  SHAREHOLDER_OF
  DIRECTOR_OF
  SECRETARY_OF
  PUBLIC_OFFICER_OF
  MEMBER_OF
  PARTNER_OF
  NOMINEE_FOR        // legal title held bare for a beneficial owner — review-added
}

enum BeneficiaryClass { PRIMARY  GENERAL  DEFAULT  NAMED }

model EntityRelationship {
  id           String                 @id @default(uuid())
  userId       String                 // tenancy scope — every edge belongs to one user's structure
  fromEntityId String
  toEntityId   String
  type         EntityRelationshipType

  // Time-bounding — a director resigns, shares are sold, a trust vests.
  effectiveFrom DateTime  @default(now())
  effectiveTo   DateTime?               // null = current

  // Typed, edge-specific metadata. Kept small + structured; equity detail
  // is first-class below, NOT in here.
  beneficiaryClass     BeneficiaryClass?  // BENEFICIARY_OF only
  partnerInterestPct   Float?             // PARTNER_OF only — a CHANGE in partnership interest is recorded by closing this edge (set `effectiveTo`) and opening a new one, exactly as a share sale closes a parcel. The edge is the point-in-time interest; the history is the chain of edges.
  partnerCapitalAmount Float?             // PARTNER_OF only
  tfnQuoted            Boolean?           // BENEFICIARY_OF / SHAREHOLDER_OF / UNITHOLDER_OF — has the `from` entity quoted its TFN to the `to` entity? (Q2, 2026-05-20.) Drives TFN-withholding: a beneficiary who has not quoted a TFN means the trustee must withhold at the top marginal rate; a shareholder without a quoted TFN triggers dividend withholding. The TFN *value* lives once-per-entity in `LegalEntity.tfnEncrypted` — this is ONLY the per-relationship "quoted?" fact, never the number.
  notes                String?

  // Legal-positioning (§9): has the user / their accountant confirmed this edge?
  accountantVerified Boolean   @default(false)
  verifiedAt         DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user       User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  fromEntity LegalEntity  @relation("RelationshipsFrom", fields: [fromEntityId], references: [id], onDelete: Cascade)
  toEntity   LegalEntity  @relation("RelationshipsTo",   fields: [toEntityId],   references: [id], onDelete: Cascade)
  shareParcels ShareParcel[]   // populated only for SHAREHOLDER_OF / UNITHOLDER_OF

  @@index([userId])
  @@index([fromEntityId])
  @@index([toEntityId])
  @@index([type])
  // Duplicate-edge guard. A naive `@@unique([fromEntityId, toEntityId, type])`
  // is too strict — the same director can resign and be re-appointed, which
  // is two legitimate edges. The service layer (`entityRelationshipService.ts`)
  // instead rejects a new edge whose [from, to, type] matches an existing edge
  // with an OVERLAPPING [effectiveFrom, effectiveTo] window. Without this,
  // duplicate edges silently inflate every §6 cardinality count
  // ("≥1 director" passes with two copies of one director).
  @@map("entity_relationships")
}

// ─── New: first-class equity (shares AND units) ─────────────────────
enum ShareClass { ORDINARY  PREFERENCE  REDEEMABLE_PREFERENCE  A_CLASS  B_CLASS  C_CLASS  OTHER }
enum EquityKind { SHARE  UNIT }

model ShareParcel {
  id             String   @id @default(uuid())
  relationshipId String              // the SHAREHOLDER_OF / UNITHOLDER_OF edge this parcel belongs to
  kind           EquityKind          // SHARE (company) or UNIT (unit trust)
  shareClass     ShareClass @default(ORDINARY)
  quantity       Int                 // number of shares / units
  paidPerUnit    Float               // amount paid per share/unit (cost-base input for CGT)
  unpaidPerUnit  Float    @default(0) // partly-paid shares — calls outstanding
  acquiredAt     DateTime            // CGT acquisition date — Phase 41E reform regime hinges on this
  disposedAt     DateTime?           // null = still held

  relationship EntityRelationship @relation(fields: [relationshipId], references: [id], onDelete: Cascade)

  @@index([relationshipId])
  @@map("share_parcels")
}

// ─── Changed: LegalEntity gains person-node + sub-type fields ────────
model LegalEntity {
  // ... all existing Phase 41 fields unchanged (type, role, abn, acn,
  //     tfnEncrypted, tradingName, establishedDate, trustType,
  //     isForeignResident, parentEntityId — see §10 on parentEntityId) ...

  companySubtype  CompanySubtype?   // NEW — see CompanySubtype enum below (drives the §6 Company validity branch)
  dateOfBirth     DateTime?         // NEW — INDIVIDUAL nodes only
  directorIdEncrypted String?       // NEW — Director ID. Q2 decided 2026-05-20: store the VALUE (not just presence). Sensitive identifier — encrypted at rest via `lib/security/tfnEncryption.ts` (the same swap-point as TFN; upgrades to CMEK when CMEK lands). Never logged, never sent to AI, never returned by default API responses. Read only inside an authorisation boundary.
  householdMemberId String?         // NEW — optional link: this INDIVIDUAL is a known household member
  accountantVerified Boolean @default(false) // NEW — §9

  // NEW reverse relations
  relationshipsFrom EntityRelationship[] @relation("RelationshipsFrom")
  relationshipsTo   EntityRelationship[] @relation("RelationshipsTo")
}

enum CompanySubtype {
  PROPRIETARY          // Pty Ltd — has shareholders
  PUBLIC               // Ltd — has shareholders
  LIMITED_BY_GUARANTEE // has MEMBERS, no shareholders, no share capital (typical NFP)
  UNLIMITED            // unlimited liability company — has shareholders
  NO_LIABILITY         // NL company (mining) — has shareholders
}
```

**Joint / shared ownership of owned objects** — **Q1 decided 2026-05-20: included in Part 1c, and not limited to 50/50 — *any* split across *any* number of co-owners.** Today `Property.ownerEntityId` (and the six siblings) is a *single* FK, so a property co-owned cannot be represented at all. Part 1 keeps the single FK (zero disruption to the 11 files that read it); Part 1c adds an **`OwnershipStake`** junction layered *beside* it:

```prisma
enum TenancyType { JOINT_TENANTS  TENANTS_IN_COMMON  OTHER }

model OwnershipStake {
  id              String   @id @default(uuid())
  userId          String
  ownedObjectType String              // 'property' | 'loan' | 'account' | 'investmentAccount' | 'asset'
  ownedObjectId   String
  entityId        String              // the co-owning LegalEntity
  sharePct        Float               // ANY value 0–100 — supports 70/20/10, 33.3×3, etc.
  tenancyType     TenancyType @default(TENANTS_IN_COMMON)
  user   User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  entity LegalEntity @relation(fields: [entityId], references: [id], onDelete: Cascade)
  @@index([userId])
  @@index([ownedObjectType, ownedObjectId])
  @@map("ownership_stakes")
}
```

`ownerEntityId` becomes the "primary / legal-title" owner; `OwnershipStake` rows carry the full beneficial split — e.g. 70/20/10 across three entities, two individuals as joint tenants, or a person + their family trust as tenants-in-common. The validity check warns when stakes for one object do not sum to 100%. Calculations migrate to read `OwnershipStake` when present, falling back to `ownerEntityId` for single-owner objects (the common case stays a single row).

> **The boundary between `OwnershipStake` and `EntityRelationship` — two different ownership questions, never overlapping.** `OwnershipStake` answers *"who owns this **asset**?"* — a property, a loan, a bank account, an investment account (the financial objects with an `ownerEntityId`). `EntityRelationship` (specifically `SHAREHOLDER_OF` / `UNITHOLDER_OF`) answers *"who owns this **entity**?"* — equity in a company or unit trust. A share *is* equity in a legal entity, so it lives on the relationship graph with first-class `ShareParcel`s; a rental property *is* an asset, so it lives on `OwnershipStake`. They never describe the same thing, so there is no SSOT conflict (§8.3) — but the build (Part 1b/1c) must keep the line crisp: never record a shareholding as an `OwnershipStake`, never record real-estate co-ownership as an `EntityRelationship`.

---

## §8 — Tax treatment by structure, money-flow & the single-engine SSOT commitment

### §8.1 — How tax actually works on each structure

The reason these structures exist is tax. Each entity type operates under a different regime, and a multi-entity group is — bluntly — a legal income-routing machine: income is arranged to land in the lowest-taxed hands. Monitrax's job is to **model the structure so the engine computes each entity's position correctly** — never to design or recommend the arrangement (§9). The regimes the model must serve:

| Structure | Tax regime (AU, current law) | What the graph must supply for a correct number |
|---|---|---|
| **Individual** | Progressive marginal rates + Medicare levy; tax-free threshold; CGT 50% discount on assets held >12 months (being reshaped by Phase 41E Measure 2); negative gearing (Phase 41E Measure 1). | The person node + their `ownerEntityId` holdings + inbound `BENEFICIARY_OF` / `SHAREHOLDER_OF` / `PARTNER_OF` flows. |
| **Company (Pty Ltd / Ltd)** | Flat company tax — **25%** for a *base-rate entity*, else **30%**. A company is a base-rate entity for an FY if **aggregated turnover < $50M** AND **its base-rate-entity passive income is no more than 80% of its assessable income** (ATO test — *not* "must have passive income"). Dividends carry **franking credits** (the franking rate follows the company's tax rate). **No CGT discount for companies.** Div 7A — loans/payments to shareholders or their associates are *deemed dividends* unless on complying terms (max 7-year unsecured / 25-year secured loan, ATO benchmark interest rate, minimum yearly repayment). Loss carry-forward + Phase 41E Measure 5 carry-back. | `SHAREHOLDER_OF` edges + `ShareParcel` (franking distribution, CGT cost base); `DIRECTOR_OF` + `SHAREHOLDER_OF` (Div 7A associate test); inter-entity `Loan` rows. |
| **Discretionary trust** | **Flow-through.** Pays no tax itself *if* all income is distributed; income taxed in beneficiaries' hands at their rates (Div 6). Undistributed income → trustee taxed at the **top marginal rate** (s99A). Can **stream** franked dividends + capital gains to chosen beneficiaries (Div 6E). s100A anti-avoidance on reimbursement agreements. **Phase 41E Measure 3** — 30% minimum tax on discretionary-trust taxable income from FY 2028-29. | `BENEFICIARY_OF` edges + the per-FY `DistributionResolution` (Part 2); `trustType = DISCRETIONARY` (already on `LegalEntity`); `APPOINTOR_OF` (s100A control test). |
| **Unit trust** | Flow-through; distributes strictly by **unit holding %** (fixed entitlement, Div 6). | `UNITHOLDER_OF` edges + unit `ShareParcel`s — the % is computed, not discretionary. |
| **SMSF** | Concessional **15%** on contributions + accumulation-phase earnings; **0%** on earnings (income *and* capital gains) supporting a retirement-phase pension, subject to the Transfer Balance Cap. Capital gains on accumulation-phase assets held **>12 months** get a **one-third CGT discount** → effective **10%**; assets held <12 months are taxed at the full 15%; pension-phase gains are 0%. Div 293 adds 15% for high earners. Contribution caps per member. | `MEMBER_OF` edges (per-member caps, TBC, Div 293); `TRUSTEE_OF` (corporate vs individual trustee — compliance, not rate); `BARE_TRUST` node for any LRBA-held property. |
| **Partnership** | Flow-through — no tax at partnership level; each partner taxed on their share of net income. | `PARTNER_OF` edges + `partnerInterestPct`. |
| **Sole trader** | Taxed inside the individual's return at marginal rates; ABN-level GST/BAS separate. | The `SOLE_TRADER` ↔ `INDIVIDUAL` 1:1 link. |

The recurring theme: **a wrong edge produces a wrong number.** Model a trust distribution as personal income → wrong marginal calc. Miss a `SHAREHOLDER_OF` edge → franking credits vanish. Mistype a trust → the Phase 41E Measure 3 dispatch fires (or fails to). The graph is not cosmetic; it is the tax engine's input contract.

> **Phase 41E reform measures are gated, not live.** The Measure 3 30%-min-tax line above commences **1 Jul 2028 (FY 2028-29)** and every other reform measure has its own date. Per CLAUDE.md §12.14 FW-2, none of them apply until the relevant `commencementVerified` flag in `taxYearConfig.ts` is set (post-Royal-Assent). The table states the *announced* law for completeness — the engine must keep returning the pre-reform number behind each gate until verified. Phase 44 supplies the graph inputs; it never flips a reform gate.

### §8.2 — Money-flow is derived from the graph, not separately stored

Once §7 exists, every flow is a function of the topology — there is no parallel "flows" store to drift out of sync:

| Flow | Derived from | Tax-engine module that consumes it |
|---|---|---|
| Franked dividends | `SHAREHOLDER_OF` + `ShareParcel` class/quantity | franking logic in `masterTaxPosition.ts`, `div7A.ts` |
| Trust distributions (discretionary) | `BENEFICIARY_OF` + per-FY `DistributionResolution` (Part 2) | `trustDistribution.ts`, `div6E.ts`, `trustMinimumTax.ts` |
| Trust distributions (unit) | `UNITHOLDER_OF` — fixed unit % | `trustDistribution.ts` |
| Partnership income/loss | `PARTNER_OF` + `partnerInterestPct` | partnership flow-through in `entityTaxRouter.ts` |
| SMSF contributions / pensions | `MEMBER_OF` | `super/*` — caps, TBC, Div 293 |
| Div 7A loans | inter-entity `Loan` rows; lender = company, borrower = shareholder/associate (associate resolved via the graph) | `div7A.ts` |
| Control tests (s100A, land-tax grouping, Div 7A associate) | the *control* sub-graph: `APPOINTOR_OF` + `DIRECTOR_OF` + `SHAREHOLDER_OF` + `TRUSTEE_OF` | `s100A.ts`, land-tax modules |

### §8.3 — The SSOT & single-calculation-engine rule (non-negotiable)

> **Phase 44 adds ZERO calculation logic. It is a *data layer* — nothing else.**

This is CLAUDE.md §12.2 (SSOT), §12.3 (one calculation engine, no competing implementations) and §6.1 (canonical financial service) applied to this phase, and it is a reviewer-reject rule:

1. **All tax computation stays in the one existing engine — `lib/tax-engine/`.** The orchestrator (`masterTaxPosition.ts`), the per-entity router (`entityTaxRouter.ts`), and the division modules (`trustDistribution.ts`, `div6E.ts`, `div7A.ts`, `s100A.ts`, `super/*`, `trustMinimumTax.ts`, …) remain the *sole* place a tax number is produced. Phase 44 does not add a tax module, does not duplicate one, does not fork one.
2. **Phase 44's job is to give that engine a cleaner input.** Today the engine reads `trustType` / `isForeignResident` off `LegalEntity` and beneficiary/distribution facts off `TrustDeedExtractedRules` JSON. Phase 44 Part 2 lets it read the **typed graph** instead — the same engine, a better-shaped input. The graph *replaces an input format*; it never becomes a second engine.
3. **No tax arithmetic in the entity/relationship layer.** `entityRelationshipService.ts`, the entity API routes, and the entity UI contain *zero* tax math — they create, validate, and read graph edges. A per-entity tax figure is produced *only* by `calculateEntityTaxPosition()`.
4. **No financial aggregation outside the canonical services.** Net worth, income, expense, cashflow per entity flow through `getMasterFinancialSnapshot()` and the `lib/calculations/*` engines exactly as they do today (the 11 files that read `ownerEntityId` are unchanged). Phase 44 entity data *feeds* those services; it never recomputes what they own.
5. **Reviewer-reject:** any Phase 44 PR that introduces tax or financial arithmetic outside `lib/tax-engine/` or `lib/calculations/` — including a "quick" inline calculation in a route or component — is rejected. This keeps every number traceable to one engine, which is also the §9 legal-positioning requirement (a number you cannot trace is a number you cannot defend).

**This phases deliberately.** Part 1 ships the *structural* graph; the tax engine keeps reading `TrustDeedExtractedRules` JSON unchanged. Part 2 rewires the engine's *input* to the graph and adds the per-FY `DistributionResolution` model — still one engine. Part 2 is the higher-legal-risk layer (§9) and gets its own design pass once Part 1 is built and reviewed.

---

## §9 — Legal-positioning strategy (the answer to "what if we get this wrong")

Reza's concern — *"it might cause legal issues if we get this wrong"* — is correct, and the answer is **architecture, not perfectionism.** Trying to be a flawless tax-determination engine for every edge of trust law is impossible and is *itself* the liability. The risk is managed by positioning, baked into the model:

1. **Monitrax is a faithful digital twin, not a determiner.** The adviser's diagram is the source of truth; Monitrax *records and keeps it current*. The model never invents structure or relationships — it stores what the user (and their accountant) assert.
2. **`accountantVerified` is first-class** — on `LegalEntity` and on every `EntityRelationship`. The UI renders verified vs draft state plainly. An unverified structure is shown as "you've told us this — confirm with your accountant." This is the single most important risk control: it makes the provenance of every node and edge explicit.
3. **Every entity-level tax number is an estimate** — conservative, traceable to a canonical engine (CLAUDE.md §6.1, §12.2), explicitly labelled, and never presented as the filing position. Where the engine cannot be confident it returns an `UNCOMPUTED` flag (the existing Phase 41E pattern), never a guessed number.
4. **The structural AFSL / TPB / NCCP boundary is reused, not re-invented.** Phase 41 already enforces it structurally via the tool registry (not prompt disclaimers). Phase 44 entity data flows through the same boundary — the AI Guide may *explain* a structure ("a discretionary trust distributes at the trustee's discretion") but never *advise* on one ("you should distribute to X"). This is the `Q-PRA-1` decision.
5. **An accountant review path.** A share-pass — reusing the *pattern* of the existing `SharePackage` model (opaque-token public link, expiry, revocation), **not** the `SharePackage` model itself (that one is scoped to document bundles) — lets the user send their captured structure to their accountant to confirm, turning `accountantVerified` from a self-assertion into a professional one. (Build deferred to Part 1c; the flag exists from Part 1a.)
6. **Conservative by default.** Where a relationship is ambiguous (is this person a beneficiary or just a potential beneficiary?), the model captures the conservative reading and flags it for confirmation rather than assuming the favourable one.

Net: Monitrax becomes a *record-keeping, organisation and estimation* tool with explicit provenance and explicit deferral to the professional — which is defensible — rather than an *authoritative tax engine*, which is not.

---

## §10 — Migration & backwards compatibility

- **`parentEntityId` → `TRUSTEE_OF` edge.** The migration reads every `LegalEntity` with a non-null `parentEntityId` and writes one `EntityRelationship` of type `TRUSTEE_OF` (`from` = the parent/trustee, `to` = the child/trust). **`parentEntityId` is then FROZEN read-only — it is NOT a cache.** (Design-review correction, C2: it is a *single* self-FK and physically cannot represent one corporate trustee serving multiple trusts — the moment a second trust shares a trustee, a "read-through cache" would be wrong for at least one trust. A field that cannot hold the data is not a cache.) From Part 1b onward: no code writes `parentEntityId`; `EntityTree` and every calculation read the `TRUSTEE_OF` edges; `validateParentChain` is replaced by the §6 acyclicity check on the graph. `parentEntityId` is retained only as a dormant historical column and dropped in a later cleanup once Part 1b confirms nothing reads it.
- **`ownerEntityId` untouched.** All 11 files that read `ownerEntityId` for calculations are unaffected by Part 1. `OwnershipStake` (joint ownership) layers beside it (§7) and is opt-in per object.
- **`PERSONAL_NAME` entities preserved.** Every user's existing `PERSONAL_NAME` entity stays — semantically it becomes their `INDIVIDUAL` node. The Phase 41a backfill promise (`getDefaultLegalEntityId`) is unchanged.
- **Phase 41E reform fields untouched.** `trustType` / `isForeignResident` stay on `LegalEntity`; the reform dispatch is unaffected. New trust sub-types (`HYBRID_TRUST`, etc.) extend `LegalEntityType` additively.
- **`TrustDeedExtractedRules` coexists.** The deed-extraction JSON is not deleted. Part 2 lets it *populate* the graph (extracted beneficiaries → `BENEFICIARY_OF` edges, pending user confirmation) — the graph becomes the SSOT, the extraction becomes one *input* to it.
- Every migration is additive — no `DROP`, no destructive `ALTER`. CLAUDE.md §12.11 N/A by structural argument; §12.12 schema+migration in the same PR.

---

## §11 — Build sequence

**Part 1 — the structural graph (review-gated; ~2-3 PRs).**

- **1a — Schema + migration.** `EntityRelationship` + `EntityRelationshipType` + `BeneficiaryClass`; `ShareParcel` + `ShareClass` + `EquityKind`; `LegalEntity` field additions; `LegalEntityType` / `LegalEntityRole` extensions; the `parentEntityId` → `TRUSTEE_OF` data migration. Additive only.
- **1b — Service layer + migrate calculations off `parentEntityId`.** `entityRelationshipService.ts` — CRUD + the §6 edge-validity matrix + cross-edge rules (SMSF member⇒trustee one-directional, company director floor, the guarantee-company branch) + the duplicate-edge overlap guard + the two acyclicity checks (control chain + ownership chain), all inside the write transaction. Pure functions, SSOT, `logCRUD` audit with sanitised metadata. Plus the `OwnershipStake` service (Q1 = yes). **Critically — and corrected from the original sequencing per design-review C2 — every calculation that currently reads `parentEntityId` is repointed to the `TRUSTEE_OF` edges in *this* step, not 1c.** `parentEntityId` cannot represent a shared corporate trustee, so leaving calculations on it until 1c would produce wrong attribution the moment a real shared-trustee structure is entered.
- **1c — Entity-section UI.** Upgrade `EntityTree` (`components/entities/`) from a `parentEntityId` tree to a true multi-edge graph — edge style/colour per relationship type, the control sub-graph emphasised. Entity-detail view lists all in/out relationships. The accountant-review share-pass.
- **1d — Onboarding wizard.** Extend `EntitiesStep` — after entities are created, a relationship sub-step ("who directs / owns / controls / benefits from each"), kept psychologically light: smart defaults, progressive disclosure, the structure can be finished later in the entity section (the wizard captures the skeleton, not every edge).

**Part 2 — money-flow & tax (separate design pass, after Part 1 ships + is reviewed).**

- `DistributionResolution` (per-FY discretionary splits); rewire `trustDistribution.ts` / `div6E.ts` / `div7A.ts` / `super/*` / `s100A.ts` to read the graph; the `MoneyFlowSankey` upgrade. Higher legal-risk → its own document.

---

## §12 — Open questions — ALL RESOLVED 2026-05-20

| # | Question | Decision (Reza, 2026-05-20) |
|---|---|---|
| Q1 | Joint ownership — Part 1 or deferred? | ✅ **Included in Part 1c — and not 50/50-only: any split, any number of co-owners.** `OwnershipStake` junction with arbitrary `sharePct` + `tenancyType` (joint tenants / tenants-in-common / other). See §7. |
| Q2 | Director ID — store the value or just presence? | ✅ **Store the value, encrypted** (`directorIdEncrypted`, via the `tfnEncryption.ts` swap-point — same treatment as TFN). Reza also asked to capture TFN for tax relationships → added `EntityRelationship.tfnQuoted` (the per-relationship "TFN quoted to this counterparty?" fact, driving TFN-withholding logic; the TFN value itself stays once-per-entity, encrypted). See §7. |
| Q3 | How much does the onboarding wizard capture vs the entity section? | ✅ **Skeleton — but enough to build a working graph.** The wizard captures every entity + the load-bearing edges (trustee, appointor, primary shareholders/beneficiaries) so the graph is genuinely usable on exit; the entity section is where it's refined and completed. Not a bare skeleton, not the exhaustive graph. |
| Q4 | Accountant-review share-pass — Part 1c or defer? | ✅ **Build in Part 1c.** It makes `accountantVerified` meaningful and directly serves the §9 legal-positioning. Reuses the `SharePackage` pattern. |

---

## §13 — Governance & doc-sync

On build, per CLAUDE.md §16: Part 1a updates `03_DATA_MODEL.md` (new §3.10 Entity Graph) + the matching migration (§12.12); Part 1b/1c/1d update `07_API_STANDARDS.md`, `06_UI_UX_FOUNDATION.md`, and this doc's checklist; every PR updates `IMPLEMENTATION_PLAN.md` (§15) and a daily `CHANGELOG`. The §12.14 Phase 41E trigger fires (schema columns on entity-related models) — each PR carries the §12.14 block. The graph touches CDR-relevant data only at the existing TFN boundary (§13) — no new sensitive surface beyond the encrypted-TFN pattern already in place, plus the Director-ID decision (Q2).

**This document is the Part 1 design contract.** No Phase 44 code is written until Reza reviews it — and, given the legal weight, ideally has the structural model (§4 node types, §5 edges, §6 validity matrix) sanity-checked by his accountant. That review *is* the first risk control.

---

## §14 — Design-review record (2026-05-20)

Before this doc went to Reza, an independent adversarial review agent stress-tested it against authoritative ATO + ASIC sources. It found real defects — all now incorporated above. Recorded here for traceability:

| Finding | Severity | Resolution in this doc |
|---|---|---|
| Single-member SMSF with individual trustees was un-representable; the member↔trustee rule was wrongly bidirectional and would reject valid funds | **Critical (C1)** | §6 SMSF rule rewritten — member ⇒ trustee/director is one-directional; ≥2 individual trustees required; single-member fund needs exactly one non-member trustee. |
| `parentEntityId` framed as a "read-through cache" — but a single self-FK cannot hold a corporate trustee shared across multiple trusts | **Critical (C2)** | §10 — `parentEntityId` is FROZEN read-only, explicitly not a cache; §11 — calculations repointed to `TRUSTEE_OF` edges in Part 1b, not 1c. |
| `TRUSTEE_OF.from` excluded `Trust` with no explanation | **Critical (C3)** | §5 — explicit legal justification added: a trust is not a legal person; layered trustee arrangements are modelled at the company/individual level. |
| No acyclicity rule on the *ownership* sub-graph — circular cross-shareholdings would break net-worth / tax attribution | **Critical (C4)** | §6 — second acyclicity check added for `SHAREHOLDER_OF` + `UNITHOLDER_OF` + `BENEFICIARY_OF` + `PARTNER_OF` + `NOMINEE_FOR`. |
| Company-limited-by-guarantee has members, not shareholders — but the Company validity rule required a shareholder | Gap (validity bug) | §4 + §6 — Company validity rule branches on `companySubtype`; guarantee company requires members + zero shareholders. |
| Missing: testamentary trust (minor-beneficiary excepted income), guardian/protector role, nominee/beneficial-owner edge, `UNLIMITED` / `NO_LIABILITY` company subtypes | Gaps | §4 `TESTAMENTARY_TRUST` node + `companySubtype` extended; §5 `GUARDIAN_OF` + `NOMINEE_FOR` edges added. |
| §8.1 base-rate-entity test ambiguous; SMSF "10% on gains" imprecise; reform measures stated without the `commencementVerified` gate | Errors | §8.1 — BRE test reworded to the exact ATO test; SMSF CGT precision added; a `commencementVerified` caveat note added. |
| `EntityRelationship` had no duplicate-edge guard; `partnerInterestPct` history treatment inconsistent with `ShareParcel`; `OwnershipStake` vs `EntityRelationship` boundary unstated; §9.5 contradicted §1 on `SharePackage` | Consistency | §7 — overlap guard documented; `partnerInterestPct` history rule added; the two-ownership-models boundary stated; §9.5 clarified ("pattern, not the model"). |

**Combination-completeness stress-test:** the review ran 9 hard real-world structures (corporate trustee shared across trusts, trust-as-unitholder, single-member SMSF, LRBA bare trust, testamentary trust, company owned by two trusts, partnership of two companies, etc.). With the fixes above incorporated, all 9 are now representable. The §3 "combination-complete by construction" thesis holds — *after* this review, not before it. A second independent AI review and/or an accountant sanity-check of §4–§6 remains recommended (§13) — the AI review verified the grammar; the accountant verifies the grammar matches Reza's actual deeds.
