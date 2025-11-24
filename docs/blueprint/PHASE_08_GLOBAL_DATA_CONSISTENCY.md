# PHASE 08 — GLOBAL DATA CONSISTENCY & CROSS-MODULE LINKING  
### GRDCS • Linkage Health • Snapshot 2.0 • Insights Integration  
Version: 1.0  

---

# 1. PURPOSE

Phase 08 establishes Monitrax’s **single source of truth** for all data connections across the platform.  
This phase introduces the complete cross-module relational layer, the health engine, and the backbone standards required for later AI phases.

This is the “data nervous system” that makes Monitrax feel intelligent, consistent, and interconnected.

---

# 2. OBJECTIVES

1. **Define one canonical relationship model** across all modules (GRDCS).  
2. **Unify all module relationships** under a single relational schema.  
3. **Ensure data consistency** at every hop across the system.  
4. **Power the Linked Data Panel, Insights Engine v2, and CMNF**.  
5. **Detect broken relationships** using the Linkage Health engine.  
6. **Upgrade the Portfolio Snapshot engine** to 2.0 architecture.  
7. **Enforce data quality and relational completeness** across the backend.  

---

# 3. PHASE SUBCOMPONENTS

Phase 08 contains four major subsystems:

### 3.1 GRDCS  
Global Relational Data Consistency Specification  
→ Defines the relational DNA of Monitrax’s object graph.

### 3.2 Snapshot 2.0  
→ Universal multi-module snapshot aggregator (assets, liabilities, cashflow, net worth).

### 3.3 Linkage Health Engine  
→ Detects broken/missing/unresolvable links; calculates system-wide health score.

### 3.4 Insights Engine v2 Enhancements  
→ Integrates GRDCS + Health + Snapshot signals to generate contextual intelligence.

---

# 4. GLOBAL RELATIONAL DATA CONSISTENCY (GRDCS)

## 4.1 Purpose  
Provide a **unified, deterministic relationship map** for all financial objects.

## 4.2 Design Constraints

- Must be **module-agnostic**  
- Must produce a **canonical chain** for any entity:  
  Example:  
  `Holding → InvestmentAccount → Property → Loan → Transaction → Account`
- Must resolve **all ancestor/child relationships**  
- Must define **standardised entity metadata** (label, type, icon, category, href)  
- Must support **deep linking** (used by CMNF)

## 4.3 GRDCS Output Format (Conceptual)

- `canonicalParentChain[]`  
- `canonicalChildren[]`  
- `primaryParent`  
- `siblingEntities[]`  
- `entityMetadata{}`  
- `relationalCompletenessScore`  

## 4.4 Rules

- No circular references  
- No missing entity metadata  
- All modules must expose canonical IDs  
- All GRDCS computation is backend-only  

---

# 5. PORTFOLIO SNAPSHOT 2.0

Snapshot 2.0 is the **central summarisation engine** for Monitrax.

## 5.1 Responsibilities

- Compute asset, liability, and cashflow summaries  
- Provide multi-module totals (properties, loans, accounts, holdings, transactions)  
- Derive changes, deltas, trends  
- Expose per-entity and global metrics  
- Trigger insights & health updates  
- Provide structured data for UI Sync Engine  

## 5.2 Architectural Requirements

- Entirely backend-driven  
- Immutable per request  
- Based on raw entities and GRDCS  
- Expose timestamp + version  
- Zero UI logic allowed  

## 5.3 Snapshot Consumers

- Dashboard summary blocks  
- Module summary blocks  
- UI Sync Engine  
- Insights Engine v2  
- Linkage Health service  
- AI Strategy Engine (Phase 11)  

---

# 6. LINKAGE HEALTH ENGINE

## 6.1 Purpose  
Provide a **quantified measure of relational integrity** across the system.

## 6.2 Key Metrics

- `completenessScore`  
- `missingLinks[]`  
- `orphanedEntities[]`  
- `crossModuleConsistency`  
- `brokenChains[]`  
- `weakRelations[]` (links that exist but fail GRDCS depth tests)  

## 6.3 Severity Levels

| Score Range | Severity  | Meaning |
|-------------|-----------|---------|
| 85–100      | Healthy   | No major issues |
| 70–85       | Warning   | Minor inconsistencies |
| 50–70       | High Risk | Structural issues |
| < 50        | Critical  | Broken relational system |

These levels map directly to UI components in Phase 09.

## 6.4 Output Format (Conceptual)

- `globalHealthScore`  
- `moduleBreakdown{}`  
- `linkedEntityDiagnostics[]`  
- `recommendedFixes[]`  

---

# 7. INSIGHTS ENGINE V2 ENHANCEMENTS

## 7.1 Purpose  
Give the system contextual awareness derived from:

- GRDCS relations  
- Snapshot 2.0 metrics  
- Linkage Health signals  

## 7.2 Types of Insights

- **Critical** — inconsistent relations, broken data  
- **High** — missing links, risky financial structures  
- **Medium** — financial inefficiencies, optimisation opportunities  
- **Low** — informational or maintenance insights  

## 7.3 Required Modules

- Global Insights Feed  
- Module-level insights  
- Entity-level insights tab  
- Recommended Fixes metadata  
- CMNF deep linking to affected entities  

---

# 8. LINKED DATA PANEL (LDP)

The LDP exposes **all relational context** for any entity.

## 8.1 Responsibilities

- Show all parents, children, and siblings  
- Allow “Open in Context” navigation  
- Expose GRDCS metadata  
- Provide Tab 4 of every entity dialog  
- Ensure consistent UI across modules  

## 8.2 Requirements

- Only GRDCS-derived relationships allowed  
- Zero hardcoded paths  
- Must always support deep linking  
- Must render even if partial data is missing (health engine handles errors)  

---

# 9. CROSS-MODULE NAVIGATION INTEGRATION

Although fully built in Phase 10.8 & Phase 9, Phase 08 defines the foundational rules:

1. All entities MUST supply canonical `href` values  
2. No module defines its own navigation rules  
3. NavigationContext stores relational state  
4. Linked Data Panel uses CMNF exclusively  
5. Entities behave identically across all modules  

---

# 10. SYSTEM REQUIREMENTS

## 10.1 Backend Requirements

- All modules must expose entities in a unified relational shape  
- Snapshot 2.0 must run in < 200ms for baseline data  
- GRDCS processing must not exceed 50ms per entity  
- Health engine must be resilient to partial failures  

## 10.2 Frontend Requirements

- All entity dialogs must support Linked Data Tab  
- All navigation must use CMNF  
- Health + insights must update via UI Sync Engine  
- Dashboard uses snapshot & health values consistently  

---

# 11. ACCEPTANCE CRITERIA

The system passes Phase 08 when:

### GRDCS
- Produces deterministic chains for all entity types  
- Resolves all relationships without ambiguity  
- Zero circular dependencies  
- All entity types have metadata definitions  

### Snapshot 2.0
- Aggregates entire portfolio consistently  
- Provides deltas & trends  
- Fully consumed by dashboard + insights + health  

### Linkage Health Engine
- Produces accurate completeness score  
- No false positives / false negatives  
- Exposes module-level diagnostics  
- Integrates with Insights Engine and UI Sync Engine  

### Insights Engine v2
- Surfaces issues from health, snapshot, and GRDCS  
- Provides actionable, contextual recommendations  
- All UI components pull insights correctly  

### Linked Data Panel
- Shows complete relational context  
- Supports deep linking for all modules  
- Fully integrated with CMNF  

---

# END OF PHASE 08 — GLOBAL DATA CONSISTENCY
