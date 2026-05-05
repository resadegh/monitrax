# 🔗 **04 — GRDCS SPECIFICATION**  
### *Global Relational Data & Consistency Service (GRDCS)*

---

# **1. Purpose of GRDCS**

GRDCS is the *central nervous system* of Monitrax.

It ensures:

- **Global relationship consistency**  
- **Cross-module linking**  
- **Canonical entity structure**  
- **Universal IDs & hrefs**  
- **Navigation interoperability**  
- **Snapshot → Insights → UI alignment**  
- **Strict integrity validation**  

Every engine — Snapshot Engine, Insights Engine, Linkage Health, Navigation, Dialogs — relies on GRDCS as the ground truth.

---

# **2. What GRDCS Does**

## **2.1 Creates a Global Entity Graph**
GRDCS builds a full adjacency map:

```
[
  {
    id: "property-1",
    type: "property",
    href: "/properties/property-1",
    links: [
      { type: "loan", id: "loan-55", relation: "property→loan" },
      { type: "expense", id: "expense-22", relation: "property→expense" }
    ]
  }
]
```

GRDCS is **read-only**, deterministic, and regenerated at snapshot time.

---

# **3. Core GRDCS Rules**

## **3.1 All Entities Must Follow the Canonical Contract**

```
{
  id: string,
  type: string,
  name: string,
  href: string,
  metadata: Record<string, any>,
  links: GRDCSLink[]
}
```

If any module produces a non-conforming entity → GRDCS rejects it.

---

## **3.2 Global HREF Standard**
Every entity **must** supply an HREF:

```
/{module}/{id}
```

Hardcoded navigation is **not allowed**.

This powers:

- CMNF (Cross Module Navigation Framework)  
- Breadcrumb builder  
- LinkedDataPanel  
- Back-navigation stack  
- Insights → Entity linking  
- Snapshot cross-module awareness  

---

## **3.3 Relationship Rules (Canonical Edge Map)**

The following are the **only valid** relationships in Monitrax:

### **Property Relationships**
```
property → loan
property → expense
property → income
property → account (offset)
```

### **Loan Relationships**
```
loan → property
loan → account (offset)
loan → transaction
```

### **Account Relationships**
```
account → transaction
account → loan (offset)
```

### **Investment**
```
investmentAccount → holding
investmentAccount → transaction
holding → transaction
```

These are fully encoded in GRDCS’s adjacency tables.

---

# **4. GRDCSLink Structure**

Each relationship is represented as:

```
interface GRDCSLink {
  type: string;           // “loan”, “property”, etc.
  id: string;             // e.g. “loan-991”
  href: string;           // canonical link, not constructed dynamically
  relation: string;       // human-readable relationship label
  strength: number;       // 1 = strong, 0.5 = weak (future use)
}
```

This makes relationships:

- queryable  
- predictable  
- navigable  
- analyzable by Insights  

---

# **5. GRDCS Pipeline (Snapshot Driven)**

GRDCS runs as part of the Portfolio Snapshot process:

```
1. Load all module entities
2. Standardise entities → canonical shape
3. Compute cross-module links
4. Validate relationships
5. Score linkage health
6. Output GRDCS Graph
```

---

## **5.1 Standardisation Layer**

Ensures:

- ID format compliance  
- HREF construction  
- Null-safe field extraction  
- Name derivation when missing  

---

## **5.2 Relationship Extraction**

Pseudocode:

```
if loan.propertyId exists:
    add link(property → loan)
    add link(loan → property)

if expense.propertyId exists:
    property → expense
```

Everything is double-sided unless defined as one-directional.

---

## **5.3 Linkage Validation Rules**

Validation rules include:

- **Orphans**  
  - Entities missing expected parents  
- **Invalid links**  
  - Target does not exist  
- **Broken hrefs**  
  - HREF missing or malformed  
- **Inconsistent dual relationships**  
  - A→B exists but B→A missing  

Violations are surfaced to:

- LinkageHealth service  
- Insights Engine  
- Dashboard global health badge  
- Warning banners  

---

# **6. GRDCS Output Format**

Full snapshot output structure:

```
{
  entities: {
    properties: Property[],
    loans: Loan[],
    accounts: Account[],
    investmentAccounts: InvestmentAccount[],
    holdings: Holding[],
    transactions: InvestmentTransaction[],
    income: Income[],
    expenses: Expense[]
  },
  graph: {
    adjacency: GRDCSLink[][]
  },
  stats: {
    totalEntities: number,
    totalRelationships: number,
    orphanCount: number,
    missingLinks: number
  }
}
```

---

# **7. GRDCS Performance Requirements**

- ≤ 50ms execution for datasets < 3,000 entities  
- Must be synchronous & deterministic  
- Graph must always be fully serialisable  
- No circular loops allowed  
- Must support multi-entity deep drill chain:  
  ```
  property → loan → expense → account → transaction → holding
  ```

---

# **8. GRDCS & Future Phases**

GRDCS supports planned features:

### **Phase 9 – AI Strategy Engine**
- Entity graph used for inference
- Relationship strength used for weighting
- “Confidence-based navigation” layer

### **Phase 12 – Financial Health Engine**
- Upstream/downstream influence scoring
- Stress propagation calculations
- Relationship risk heuristics


---

# **§14 — Phase 41 Entity Layer: GRDCS Extension**

*Added 2026-05-09 (doc-sync catch-up).* Phase 41a-d added a new entity
relationship layer to GRDCS — every owned-row table now carries an
`ownerEntityId` foreign key to a `LegalEntity` row. This deepens the
GRDCS graph from "user → owned object" to "user → entity → owned
object" without breaking the canonical relationship invariants.

## **§14.1 New entity-relationship axis**

Pre-Phase-41:
```
User ──owns──→ Property
User ──owns──→ Loan
User ──owns──→ Account
...
```

Post-Phase-41:
```
User ──has──→ LegalEntity ──owns──→ Property
                          ──owns──→ Loan
                          ──owns──→ Account
                          ──owns──→ InvestmentAccount
                          ──owns──→ Asset
                          ──owns──→ Income
                          ──owns──→ Expense

LegalEntity ──parentEntityId──→ LegalEntity (trustee → trust hierarchy)
```

Every existing edge (User → owned object) is preserved via the
`userId` foreign key on each table; the new `ownerEntityId` adds a
parallel edge that tracks entity-of-record. The migration backfill
created one PERSONAL_NAME entity per existing user and pointed every
existing owned row at that entity, so no relationships were
disrupted.

## **§14.2 GRDCS rules with the entity layer**

The original GRDCS rules from §3-8 still hold. New rules introduced
by Phase 41:

1. **`ownerEntityId` is NOT NULL on every owned-row table.** The
   `LegalEntity` for a user is created on registration (or by the
   41a backfill for legacy users); orphan owned rows are
   structurally impossible.

2. **Cross-entity relationships preserve user ownership.** If
   property X is owned by entity E, and entity E is owned by user U,
   then property X is reachable from user U via two edges. Both
   edges are FK-enforced; deleting U cascades to E and to X.

3. **Trustee→trust hierarchy via self-FK.** `LegalEntity.parentEntityId`
   points to another LegalEntity (typically: a corporate trustee Pty Ltd
   has children that are the trusts it acts trustee for). The
   GRDCS graph respects this hierarchy when computing relationship
   strength + stress propagation.

4. **Entity deletion cascade is RESTRICT, not CASCADE.** Deleting an
   entity that owns rows requires explicit user action to either
   re-assign or delete the owned rows first. GRDCS enforces this at
   the FK level (`@relation(onDelete: Restrict)`), and the
   `lib/services/legalEntityService.ts` `deleteEntity()` function
   surfaces a friendly counts-by-type error before the FK guard
   would fire.

5. **Default-entity fallback** — `getDefaultLegalEntityId(userId)`
   resolves the user's PERSONAL_NAME entity, creating one on demand
   for brand-new registrations between 41a deploy and the next
   onboarding wizard refresh. This means callers in Phase 41 owned-row
   create paths can always resolve an `ownerEntityId` without
   nullable handling.

## **§14.3 GRDCS for the B2B2C surface (Phase 32B/32C)**

The B2B2C surface introduces five new entity relationship paths:

1. **`Organization → ProfessionalListing`** (1-1). The listing is
   the org's public marketplace identity.

2. **`ProfessionalListing → ProfessionalRating`** (1-many). Ratings
   are scoped to the listing they're for.

3. **`User → ProfessionalRequest → ProfessionalListing`** (M:1:1).
   The bridge between a D2C user and an Org listing.

4. **`ProfessionalRequest → ProfessionalConversation`** (1-1, optional).
   Conversation auto-created on request acceptance.

5. **`Organization → StripeCustomer → StripeSubscription`** (1-1-1).
   Lazy-created on first checkout.

GRDCS treats these as read-mostly graphs — they're navigated for
display (e.g. "show me the conversation tied to this accepted
request") but rarely mutated through GRDCS itself. Lifecycle
mutations go through canonical services; GRDCS subscribes to the
state changes for downstream consumers (alerts, audit, etc.).

## **§14.4 Cross-axis invariant preserved**

The pre-Phase-41 GRDCS invariant (every edge is FK-enforced; the
graph is acyclic with respect to ownership) is preserved across both
new axes:

- Entity layer: cycles are structurally impossible because
  `parentEntityId` is unidirectional and the FK requires the parent
  to exist before the child.
- B2B2C layer: the relationship paths (1)-(5) above are all
  unidirectional from the upstream entity to the downstream;
  composing them yields no cycles.

GRDCS-aware UI surfaces (Linked Data panels, entity drill-in
dialogs, the `/dashboard/entities` tree, the `/portal/clients/[id]/view`
adviser drill-in) MUST respect these relationship FKs; they are the
authoritative contract for cross-module navigation.
