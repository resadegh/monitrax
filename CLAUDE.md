# Monitrax - Claude Code Instructions

## CRITICAL: Read Before Any Change

Before making ANY code changes, you MUST:

1. **Read the relevant blueprint document(s)** from `docs/blueprint/`
2. **Verify alignment** with the architecture principles below
3. **Check the Phase document** if working on a specific feature

## Authoritative Documentation

The `docs/blueprint/` folder is the **single source of truth**. Key documents:

| Document | Purpose |
|----------|---------|
| `MASTER_BLUEPRINT.md` | Complete system overview and status |
| `00_OVERVIEW.md` | System overview and guiding principles |
| `01_ARCHITECTURE_OVERVIEW.md` | Technical architecture (7 layers) |
| `02_DESIGN_PRINCIPLES.md` | Design philosophy and rules |
| `03_DATA_MODEL.md` | Entity specifications and relationships |
| `04_GRDCS_SPECIFICATION.md` | Global data consistency rules |
| `06_UI_UX_FOUNDATION.md` | UI/UX standards |
| `07_API_STANDARDS.md` | API contracts and patterns |

---

## Mandatory Architecture Rules

### 1. Master Financial Service (CRITICAL)

**ALL financial calculations MUST use:**
- `lib/services/masterFinancialService.ts` → `getMasterFinancialSnapshot()`
- API endpoint: `/api/master-snapshot`

**NEVER:**
- Calculate expenses/income/cashflow directly in API routes
- Create new calculation logic outside the Master Financial Service
- Aggregate financial data manually in components

### 2. No Duplicate Logic

If logic appears twice, it MUST become a utility, engine, or shared component.

**Canonical Utility Locations:**
| Logic Type | Location |
|------------|----------|
| ALL FINANCIAL DATA | `lib/services/masterFinancialService.ts` |
| Currency formatting | `lib/utils/formatters.ts` |
| Frequency conversion | `lib/utils/frequencies.ts` |
| Ownership validation | `lib/utils/ownership.ts` |
| Net worth | `lib/calculations/netWorthCalculator.ts` |
| Cashflow | `lib/calculations/cashflowOrchestrator.ts` |
| Expense aggregation | `lib/calculations/expenseAggregator.ts` |
| Income aggregation | `lib/calculations/incomeAggregator.ts` |
| Loan aggregation | `lib/calculations/loanAggregator.ts` |

### 3. Module Boundaries (Strict)

- Properties cannot fetch Loans directly
- Loans cannot fetch Accounts directly
- All modules request from: Snapshot Engine, Insights Engine, or their own API

### 4. Financial Engines Must Be Pure

Engines must:
- Accept raw data
- Return structured outputs
- **NEVER** mutate global state
- **NEVER** fetch from external sources

### 5. GRDCS Entity Contract

Every entity MUST have:
```typescript
{
  id: string,        // Format: {module}-{uuid}
  type: string,
  name: string,
  href: string,      // Format: /{module}/{id}
  metadata: Record<string, any>,
  links: GRDCSLink[]
}
```

### 6. API Response Format (Universal)

```json
{
  "success": boolean,
  "data": {},
  "error": null | { "code": string, "message": string, "details": any },
  "meta": { "timestamp": "ISO8601", "durationMs": number }
}
```

### 7. UI/UX Standards

- **Entity dialogs** must have: Overview, Linked Data, Insights, Actions tabs
- **No dead-ends** - every screen leads somewhere
- **No duplicate numbers** - each metric appears in one primary location
- **Severity colors**: Critical=#DC2626, High=#EA580C, Medium=#F59E0B, Low=#3B82F6

---

## Pre-Change Checklist

Before making changes, verify:

- [ ] Read the relevant Phase document (e.g., `PHASE_21_ASSET_MANAGEMENT.md`)
- [ ] Using Master Financial Service for financial data?
- [ ] Maintaining module boundaries?
- [ ] API response follows standard shape?
- [ ] Entities are navigable with canonical hrefs?
- [ ] UI follows dialog/tab standards?
- [ ] Not duplicating logic that should be shared?
- [ ] Engine is pure (no side effects, no fetching)?

---

## Development Rules

1. **Blueprint is authoritative** - all changes must align with phase specifications
2. **No schema changes** without explicit instruction
3. **Small, atomic commits** - reversible patches
4. **Security first** - never compromise auth or data access
5. **Test before deploy** - TypeScript check must pass

---

## Key File Locations

| Purpose | Path |
|---------|------|
| Prisma Schema | `prisma/schema.prisma` |
| API Routes | `app/api/` |
| Dashboard Pages | `app/dashboard/` |
| Shared Components | `components/` |
| Business Logic | `lib/` |
| Blueprint Docs | `docs/blueprint/` |

---

## When In Doubt

1. Read `docs/blueprint/02_DESIGN_PRINCIPLES.md`
2. Check if there's a Phase document for the feature
3. Ask the user to clarify requirements
4. Never assume - verify with existing code patterns
