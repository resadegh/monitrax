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

Duplicated logic is an architectural failure.

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

### **6.5 Data Preservation is Mandatory**

**CRITICAL RULE: Never delete data or database tables without explicit user verification.**

> ⚠️ **INCIDENT (Feb 2026)**: Automated `prisma db push` in build scripts nearly deleted legacy tables with user data. Build scripts were modified to remove automatic schema sync.

This principle applies to:
- Schema migrations that drop tables or columns
- Database cleanup operations
- Deployment scripts that may affect existing data
- Any operation using `--accept-data-loss` or similar flags
- Adding placeholder models for tables you haven't verified

**Requirements:**
1. **NEVER include `prisma db push` in automated build scripts** — Schema changes must be manual
2. Before any schema change that would drop tables or columns, explicitly verify with the user
3. Always back up data before destructive operations
4. Prefer soft deletes over hard deletes for user data
5. If data loss is unavoidable, document what will be lost and get explicit approval
6. Maintain audit trails for all data deletion operations
7. **Verify table structures before adding models** — Don't assume column definitions

**Build Script Configuration (MANDATORY):**
```json
// CORRECT - Database is NEVER touched during build
"build": "prisma generate && next build"

// WRONG - Can accidentally delete tables not in schema
"build": "prisma generate && prisma db push && next build"

// EXTREMELY DANGEROUS - Will delete any table/column not in schema
"build": "prisma generate && prisma db push --accept-data-loss && next build"
```

**Schema Sync Procedure (Manual Only):**
1. Create database backup via Render Dashboard
2. Review what `prisma db push` will do: `npx prisma db push --preview-feature`
3. If it shows DROP statements, STOP and verify with user
4. Only proceed if changes are additive (CREATE, ALTER ADD)
5. Run via Render Shell: `npx prisma db push`
6. Verify application works correctly

**Legacy Tables Policy:**
- Tables in database but not in schema are PRESERVED
- Do not add placeholder models without verifying actual column structure
- Schedule periodic audits to clean up truly unused tables
- Document all legacy tables in `09_INFRASTRUCTURE_AND_DEPLOYMENT.md`

---

## **7. Security Principles**

### **7.1 Defense in Depth**
Security enforced
