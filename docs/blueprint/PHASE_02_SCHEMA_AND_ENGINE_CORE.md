# 🧩 **PHASE 02 — SCHEMA & ENGINE CORE**  
### *Database schema, financial engine foundations, and cross-system data standards.*

---

# **1. Purpose of Phase 02**

Phase 02 establishes the **nervous system** of Monitrax:

- A real database schema (not just placeholders)
- Baseline financial engines
- Referential integrity and relational modelling
- Core calculations used in all future phases
- Standardised data contracts

This is where Monitrax transforms from "UI shell" into an actual **financial system**.

---

# **2. Deliverables Overview**

Phase 02 must deliver:

- Full Prisma schema (v1)
- Complete relational model for all modules:
  - Properties
  - Loans
  - Offset accounts
  - Accounts
  - Income
  - Expenses
  - Investment accounts
  - Holdings
  - Transactions
- Baseline engines:
  - Portfolio engine
  - Income/Expense engine
  - Loan engine
  - Investment engine
  - Depreciation engine
- Entity-level data loaders
- Validation schemas (Zod)
- Contract-first API payloads
- Entity typing + global model definitions
- Snapshot Engine v1 (early foundation)

This is the first “real logic” phase of the system.

---

# **3. Database Schema (Prisma v1)**

The schema defines:

### **3.1 Core Entities**
- Property  
- Loan  
- OffsetAccount  
- BankAccount  
- Income  
- Expense  
- InvestmentAccount  
- Holding  
- Transaction  

### **3.2 Relational Rules**
- Loans may be linked to properties  
- Offset accounts may be linked to loans  
- Income & Expenses may relate to properties or accounts  
- Investment accounts contain holdings & transactions  
- All entities must be **soft-deletable**  
- All entities must have:
  - tenantId
  - createdAt
  - updatedAt

### **3.3 Constraints**
- No orphan entities  
- All relations must cascade appropriately  
- Unique indexes on:
  - (tenantId, externalId)
  - (tenantId, name)

### **3.4 Enum Definitions**
- Frequency  
- LoanType  
- RateType  
- TransactionType  
- HoldingType  

---

# **4. Validation Layer (Zod)**

Every entity must have a Zod schema for:

- CREATE  
- UPDATE  
- DELETE  
- BULK operations  
- API payload validation  
- Internal engine validation  

Each schema must export:

```
TypeNameSchema
TypeNameInput
TypeNameOutput
```

allows:
- strict typing
- contract-first API development  
- predictable engine behaviour  

---

# **5. Engine Core Setup**

### **5.1 Portfolio Engine (v1)**  
Inputs: all entities  
Outputs:
- basic totals  
- value aggregation  
- simple metrics  
- naive performance allocations  

### **5.2 Loan Engine (v1)**  
- interest calculation  
- principal/interest splits  
- repayment schedule generator  
- offset account incorporation  
- fixed/variable logic (basic)  

### **5.3 Income/Expense Engine (v1)**  
- annualised projections  
- frequency harmonisation  
- tax-category mapping (basic)  
- impact attribution  

### **5.4 Investment Engine (v1)**  
- cost base calculation  
- unit balances  
- basic P&L  
- realised/unrealised overview  

### **5.5 Depreciation Engine (v1)**  
- straight-line depreciation  
- diminishing value depreciation  
- per-asset tracking  

---

# **6. Data Loader Layer**

Each module must expose:

```
getEntityById(id)
getEntitiesByTenant(tenantId)
getRelatedEntities(entityId)
```

Rules:

- No logic here — pure loading only  
- All heavy lifting handled in engines  
- Must be fully typed  
- No API route should directly query Prisma  

---

# **7. Snapshot Engine (v1)**

This is the earliest version of the future powerhouse Snapshot Engine (full version delivered in Phase 5 & 8).

### **7.1 Responsibilities**

- Load all data for a tenant
- Normalise shape
- Deduplicate any mismatches
- Hydrate computed fields
- Produce a “portfolio snapshot” object

### **7.2 Output Format (v1)**

```
{
  properties: [],
  loans: [],
  accounts: [],
  offsets: [],
  income: [],
  expenses: [],
  investments: {
      accounts: [],
      holdings: [],
      transactions: []
  },
  meta: {
    tenantId,
    generatedAt
  }
}
```

This standard snapshot is required for engine correctness.

---

# **8. API Contracts (Contract-First Design)**

Each module must define:

```
POST /api/{entity}
PUT  /api/{entity}
DELETE /api/{entity}/{id}
GET   /api/{entity}/{id}
GET   /api/{entity}
```

Each route must use:

- Zod schemas  
- unified API wrapper  
- typed responses  
- documented payload formats  

Strictly no logic within the route.

---

# **9. Acceptance Criteria for Phase 02**

Phase 02 is complete when:

- Full Prisma schema exists  
- All relational models stable  
- All CRUD APIs operational  
- All Zod validations implemented  
- All engines at v1 parity  
- Snapshot Engine v1 functional  
- All entities link correctly  
- No orphan records  
- Full typing across all modules  
- Database migrations fully running  
- Dev + Prod data parity guaranteed

---

# **IMPLEMENTATION STATUS**

**Last Updated:** 2025-11-24
**Overall Completion:** 95%

---

## **Status Summary**

| Component | Status | Notes |
|-----------|--------|-------|
| Full Prisma Schema | ✅ COMPLETE | 9 entities, 15+ enums |
| Relational Model | ✅ COMPLETE | All module relations defined |
| CRUD API Endpoints | ✅ COMPLETE | 27 endpoints operational |
| Zod Validation | ✅ COMPLETE | `/lib/validation/*.ts` - All entities |
| Portfolio Engine v1 | ✅ COMPLETE | `/lib/intelligence/portfolioEngine.ts` |
| Loan Engine v1 | ✅ COMPLETE | `/lib/planning/debtPlanner.ts` |
| Investment Engine v1 | ✅ COMPLETE | `/lib/investments/index.ts` |
| Depreciation Engine v1 | ✅ COMPLETE | `/lib/depreciation/index.ts` |
| Snapshot Engine v1 | ✅ COMPLETE | `/api/portfolio/snapshot` |
| Data Loaders | ⚠️ PARTIAL | No formal `/lib/services/loaders/` |
| Standardized API Envelope | ✅ COMPLETE | `/lib/utils/api-response.ts` |

---

## **Existing Implementation Files**

### Database Schema
```
/prisma/schema.prisma          # Full Prisma schema
/lib/db.ts                     # Prisma client singleton
```

### Engines
```
/lib/intelligence/portfolioEngine.ts    # Portfolio calculations
/lib/planning/debtPlanner.ts            # Loan/debt calculations
/lib/investments/index.ts               # Investment calculations
/lib/depreciation/index.ts              # Depreciation calculations
```

---

## **Implemented: Centralized Zod Validation Layer**

**Implementation Location:** `/lib/validation/*.ts`

All validation schemas have been implemented:
- `/lib/validation/common.ts` - Shared schemas (Id, Currency, Frequency, Pagination)
- `/lib/validation/properties.ts` - Property create/update/query schemas
- `/lib/validation/loans.ts` - Loan create/update/query schemas
- `/lib/validation/accounts.ts` - Account create/update/query schemas
- `/lib/validation/income.ts` - Income create/update/query schemas
- `/lib/validation/expenses.ts` - Expense create/update/query schemas
- `/lib/validation/investments.ts` - Investment account, holding, transaction schemas
- `/lib/validation/index.ts` - Barrel export for all schemas

**API Response Wrapper:** `/lib/utils/api-response.ts`
- Standardized success/error response format
- Zod validation integration with `parseBody()` and `parseQuery()`
- Error handling utilities

---

## **Acceptance Criteria Checklist**

| Criterion | Status |
|-----------|--------|
| Full Prisma schema exists | ✅ |
| All CRUD APIs operational | ✅ |
| All Zod validations implemented | ✅ |
| All engines at v1 parity | ✅ |
| Snapshot Engine v1 functional | ✅ |

---

