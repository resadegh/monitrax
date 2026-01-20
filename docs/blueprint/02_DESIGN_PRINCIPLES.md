# 📘 **02 — DESIGN PRINCIPLES**  
### *Monitrax System Design Philosophy & Product Doctrine*

---

## **1. Purpose**

This document defines the **design principles**, **product philosophy**, and **core rules** that govern every decision in the Monitrax ecosystem — UI, backend, intelligence, navigation, and data structures.

These principles ensure that the system stays:

- consistent  
- predictable  
- scalable  
- extensible  
- secure  
- future-proof  
- AI-compatible  

This is the **north star** for all design and engineering work.

---

## **2. Design at Monitrax — Foundational Themes**

Monitrax follows five foundational design themes:

### **2.1 Intelligence-First**
Every feature must elevate the user’s financial intelligence.

- Default screens show insights, not raw data.  
- Numbers are converted into meaning.  
- We treat *clarity* as a feature.

### **2.2 Relationship-Driven**
The system is built around **how financial entities relate to each other**, not isolated modules.

- All modules feed into GRDCS.  
- Cross-module navigation is first-class.  
- The relational graph is the brain of the system.

### **2.3 Canonical Everything**
There must always be exactly **one canonical representation** of truth for:

- entities
- relations
- paths
- IDs
- navigation
- financial metrics
- **documentation** (`docs/blueprint/` is the single source)

Duplicated logic is an architectural failure.
Duplicated documentation is a maintenance nightmare.

### **2.4 Predictable By Design**
No hidden mutations, no inconsistent behaviours, no “magic.”

- Same action → same outcome, everywhere.  
- Every component follows strict rules.  
- Every module uses shared engines.  
- Navigation is deterministic.

### **2.5 Extensibility as a Requirement**
Nothing should be built in a corner.

- Every feature must be extendable.  
- No design dead-ends.  
- Modules must operate independently and together.  

---

## **3. Product Experience Principles**

### **3.1 Zero Dead-Ends**
Every screen leads somewhere.  
Every insight has an action.  
Every warning has a resolution path.

### **3.2 Everything is a Drill-Down**
Users must be able to move:

property → loan → expense → transaction → account → holding → income → property

This is the core promise of Monitrax.

### **3.3 Minimise Cognitive Load**
We display:

- the **minimum data** needed for understanding  
- the **maximum clarity** possible  

This means:

- summarise aggressively  
- hide noise  
- emphasize what matters  
- automate rote tasks  

### **3.4 Consistent Interaction Patterns**
All dialogs share:

- the same layout  
- tabs on top  
- linked data tab  
- insights tab  
- consistent CTAs  
- the same button placement  
- universal close & back rules  

The user should never have to “relearn” anything.

---

## **4. UI & UX Design Principles**

### **4.1 Layout Hierarchy**
Monitrax UI uses a **4-tier hierarchy**:

1. Global: header, breadcrumbs, health indicator  
2. Module level: tables, summary blocks  
3. Entity level: dialogs  
4. Insight level: inline cards, warnings  

### **4.2 Visual Language**
Monitrax follows a visual language based on:

- clarity  
- minimalism  
- structured whitespace  
- subtle elevation  
- distinct severity colours  
- neutrals for data, colours for meaning  

### **4.3 Motion Rules**
Animation must:

- be intentional  
- support understanding  
- never distract  
- reinforce navigation context  

Examples:

- breadcrumb transitions  
- modal expansion  
- hover states  
- severity badges pulsing on critical insights  

### **4.4 Responsiveness**
Rules:

- 3 breakpoints minimum  
- Every table must degrade gracefully  
- Sidebar collapses to top-bar  
- Dialogs become full-screen on mobile  

---

## **5. Technical Design Principles**

### **5.1 Never Duplicate Logic**
If logic appears twice, it must become:

- a utility
- an engine
- or a shared component

**Canonical Utility Locations:**

| Logic Type | Location | Functions |
|------------|----------|-----------|
| Currency formatting | `lib/utils/formatters.ts` | `formatCurrency()` |
| Frequency conversion | `lib/utils/frequencies.ts` | `toAnnual()`, `toMonthly()`, `periodsPerYear()` |
| Ownership validation | `lib/utils/ownership.ts` | `verifyOwnership()`, `verifyRelatedOwnership()` |
| Net worth calculation | `lib/calculations/netWorthCalculator.ts` | `calculateNetWorth()`, `calculateTotalAssets()` |
| Cashflow calculation | `lib/calculations/cashflowOrchestrator.ts` | `calculateCashflow()`, `calculateMonthlyCashflow()` |
| Expense aggregation | `lib/calculations/expenseAggregator.ts` | `aggregateExpenses()`, `aggregateExpensesByCategory()` |
| Income aggregation | `lib/calculations/incomeAggregator.ts` | `aggregateIncome()` |
| Loan aggregation | `lib/calculations/loanAggregator.ts` | `aggregateLoanRepayments()`, `calculateLVR()` |

**Before adding ANY calculation logic to a file, check if it exists in these locations.**  

### **5.2 API Responses Must Be Canonicalised**
Every API route must:

- use GRDCS  
- return canonical entity shapes  
- include linkedEntities  
- include relational metadata  

### **5.3 Engines Must Be Pure**
Domain engines must:

- accept data  
- compute outputs  
- NEVER mutate global state  
- NEVER fetch  

### **5.4 Navigation Must Be Stateless**
No persistent client memory except:

- navStack  
- tabState  
- scrollState  

Everything else must be ephemeral.

### **5.5 React Components Must Be Stateless or Minimally Stateful**
No derived state.  
No unnecessary re-renders.  
Hooks handle all data fetching.

### **5.6 Strict Module Boundaries**
Properties cannot fetch Loans.  
Loans cannot fetch Accounts.  
All modules request from:

- snapshot engine  
- insights engine  
- or their own API  

Nothing else.

---

## **6. Data & Intelligence Principles**

### **6.1 GRDCS is the Backbone**
All engines depend on:

- consistent IDs  
- consistent shapes  
- predictable relations  

### **6.2 Snapshot Engine is the Single Source of Financial Truth**
Everything requiring financial numbers must come from:

- /api/portfolio/snapshot  

### **6.3 LinkageHealth is the Single Source of Relational Truth**
Missing or invalid relationships must always be detected there.

### **6.4 Insights Engine is the Single Source of Meaning**
Other modules must *not* compute their own heuristics.

---

## **7. Documentation Principles**

### **7.1 Single Source of Truth**
The `docs/blueprint/` folder is the **canonical source** for all system documentation.

- All architectural decisions, specifications, and design patterns MUST be documented in `docs/blueprint/`
- External references MUST point to the blueprint folder, never duplicate content
- Blueprint documents are versioned and authoritative

### **7.2 Documentation Hierarchy**

| Location | Purpose | Examples |
|----------|---------|----------|
| `docs/blueprint/` | **Canonical specifications** | Architecture, API standards, design principles |
| `docs/` (root) | **Operational documents** | Audit reports, setup guides, changelogs |
| `README.md` | **Entry point** | Links to blueprint, quick start |
| Code comments | **Implementation notes** | Why, not what |

### **7.3 Never Duplicate Blueprint Content**
If documentation exists in `docs/blueprint/`, it MUST NOT be duplicated elsewhere.

- ❌ Don't create `docs/MASTER_BLUEPRINT.md` (duplicate)
- ✅ Reference `docs/blueprint/MASTER_BLUEPRINT.md` instead
- ❌ Don't copy API specs into README
- ✅ Link to `docs/blueprint/07_API_STANDARDS.md`

### **7.4 Document Types**

| Type | Location | Update Frequency |
|------|----------|------------------|
| **Specifications** | `docs/blueprint/*.md` | On design changes |
| **Phase Docs** | `docs/blueprint/PHASE_*.md` | On feature completion |
| **Changelogs** | `docs/blueprint/CHANGELOG_*.md` | Per release |
| **Audit Reports** | `docs/AUDIT_*.md` | Per audit cycle |
| **Setup Guides** | `docs/*-SETUP.md` | On dependency changes |

### **7.5 AI/LLM Context Rule**
When providing context to AI assistants (Claude, Copilot, etc.):

- Always reference `docs/blueprint/` as the authoritative source
- Include the blueprint folder URL for full context
- Never summarize blueprint content into separate documents

---

## **8. Security Principles**

### **8.1 Defense in Depth**
Security enforced at every layer:

- Authentication (JWT tokens)
- Authorization (ownership validation)
- Input validation (Zod schemas)
- Output sanitization
- Rate limiting
- Audit logging

### **8.2 Principle of Least Privilege**
Every component has minimum required access:

- API routes validate ownership
- Database queries scoped to user
- Feature flags control access
- Admin roles are granular
