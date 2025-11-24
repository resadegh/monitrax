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

