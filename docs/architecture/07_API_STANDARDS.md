# 🔌 **07 — API STANDARDS**  
### *Monitrax Unified API Contract, Versioning Rules & Integration Architecture*

---

# **1. Purpose of This Document**

This section defines the **backend API standards** used across Monitrax.  
It ensures:

- Every endpoint behaves consistently  
- Every module exposes predictable CRUD patterns  
- Snapshot, Insights, Navigation & Health services all align  
- Frontend and backend evolve without breaking releases  

This is the architectural contract between the Monitrax backend and all consuming clients (web, mobile, AI agents).

---

# **2. Architectural Principles**

### **2.1 Predictable, Stable, Self-Describing APIs**
Every API must be:

- Consistent across all modules  
- Fully typed  
- Self-documenting via schema validation  
- Never ambiguous  

### **2.2 Response Shape Uniformity**
All API responses follow the same shape:

```
{
  "success": boolean,
  "data": {},
  "error": null | {
      "code": string,
      "message": string,
      "details": any
  },
  "meta": {
      "timestamp": ISO8601,
      "durationMs": number
  }
}
```

### **2.3 API Consumers Are Not Trusted**
Backend must validate every single request using:

- Zod schemas  
- TypeScript types  
- Access control middleware (Phase 10)  

### **2.4 “Backend Is The Source of Truth”**
No business logic is allowed in the frontend.

---

# **3. Directory Structure**

Monitrax uses a modular file pattern:

```
app/api/
   {module}/
      route.ts
   {module}/{id}/
      route.ts
api/_utils/
api/_schemas/
api/_middleware/
```

Consistency matters more than flexibility.

---

# **4. HTTP Methods & Their Rules**

### **4.1 CRUD Standardization**
Each module implements the following:

| Operation | HTTP | Route Pattern | Description |
|----------|------|----------------|-------------|
| List     | GET  | /api/{module} | Return all items |
| Get      | GET  | /api/{module}/{id} | Return single entity |
| Create   | POST | /api/{module} | Create entity |
| Update   | PUT  | /api/{module}/{id} | Full update |
| Patch    | PATCH | /api/{module}/{id} | Partial update |
| Delete   | DELETE | /api/{module}/{id} | Soft delete |

If a module only supports read operations, the same structure still applies.

---

# **5. Schema Validation (Zod)**

Every route must:

- Import a matching Zod request schema
- Validate before executing
- Generate typed results

Minimum required schema pattern:

```
import { z } from "zod";

export const CreateSchema = z.object({
  name: z.string().min(1),
  value: z.number().nonnegative(),
});
```

Backends must never assume client correctness.

---

# **6. Error Handling Contract**

Every API error must follow a strict format:

### **6.1 Validation Error**
```
{
  success: false,
  error: {
    code: "VALIDATION_ERROR",
    message: string,
    details: zodErrors
  }
}
```

### **6.2 Not Found**
```
{
  success: false,
  error: {
    code: "NOT_FOUND",
    message: "Resource not found."
  }
}
```

### **6.3 Server Error**
```
{
  success: false,
  error: {
    code: "SERVER_ERROR",
    message: "Unexpected server issue occurred."
  }
}
```

No stack traces are ever leaked to the client.

---

# **7. Authentication & Security Requirements**

> **Updated February 2026**: GCP Identity Platform is the sole identity provider.
> All API routes authenticate using GCP/Firebase ID tokens.

### **7.1 GCP Identity Platform Token Authentication**

All API routes verify GCP/Firebase ID tokens. Three entry points are available:

```typescript
// Option 1: verifyToken() — lightweight, returns { userId, email }
import { verifyToken } from '@/lib/auth';
const user = await verifyToken(token);

// Option 2: getAuthContext() — full context with role, name, tenantId
import { getAuthContext } from '@/lib/auth/context';
const context = await getAuthContext(request);

// Option 3: withAuth() — middleware wrapper with auto-sync
import { withAuth } from '@/lib/middleware';
return withAuth(request, handler);
```

**Token flow:**
1. Client obtains Firebase ID token via Firebase SDK (`onIdTokenChanged`)
2. Client sends `Authorization: Bearer <firebase-id-token>` with every request
3. Server verifies token via `verifyGCPIdToken()` (Google public certs, RS256)
4. Server looks up local user by GCP UID or auto-syncs on first request

**Key rules:**
- No Monitrax JWTs are issued for API authentication
- Tokens expire after 1 hour (Firebase SDK auto-refreshes)
- RBAC permissions checked via `getAuthContext()` or route guards

### **7.2 Rate Limiting Hooks**
All endpoints must expose a wrapper:

```
withRateLimit(handler, { max: X, windowMs: Y })
```

### **7.3 Audit Logging**
All mutations are logged:

- Who changed data (userId from GCP token)
- When (timestamp)
- Old vs new values
- IP address and user agent  

---

# **8. Versioning**

Monitrax uses implicit versioning rules:

### **8.1 Breaking Changes → New Endpoint**
Example:
```
/api/properties-v2
```

### **8.2 Non-Breaking Changes → Extend Schema**
Never rename, remove, or repurpose an existing field.

### **8.3 Additive-only Policy Until v1.0**
All public clients depend on predictability.

---

# **9. Performance Rules**

### **9.1 Snapshot APIs**
Must respond in:

- **< 200ms** for standard snapshot  
- **< 300ms** for extended snapshot  

### **9.2 Insights APIs**
Must precompute heavy operations server-side.

### **9.3 Pagination Required When > 100 Items**
All list endpoints must enforce server-side pagination.

---

# **10. Caching Rules**

### **10.1 Server Cache**
Snapshot 2.0 requires:

- Smart dependency-based invalidation  
- Cached GRDCS outputs  
- Cached linkage-health metrics  

### **10.2 No Client Cache Assumptions**
Frontend must never assume a previous response is valid.

---

# **11. Standards for Complex Modules**

### **11.1 Portfolio Snapshot**
One endpoint, total platform state:

```
/api/portfolio/snapshot
```

Must include:

- All GRDCS entities  
- Relational map  
- Insights feed  
- Linkage-health metrics  
- Summaries  
- Totals  

---

### **11.2 Insights Engine API**
```
/api/insights
```

- Returns grouped insights  
- Includes recommended actions  
- Includes affected entities  

---

### **11.3 Linkage Health Service**
```
/api/linkage/health
```

Returns:

- completenessScore
- orphanCount
- missingLinks[]
- module breakdown

---

### **11.4 Categories API**
```
/api/categories
/api/categories/{id}
```

Manages user-defined custom categories for expenses and income.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/categories` | GET | List all categories (system + user custom) |
| `/api/categories` | POST | Create a new custom category |
| `/api/categories/{id}` | GET | Get single category by ID |
| `/api/categories/{id}` | PUT | Update a custom category |
| `/api/categories/{id}` | DELETE | Soft delete or force delete category |

**Query Parameters (GET /api/categories):**
| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `EXPENSE` \| `INCOME` | Filter by category type |
| `includeSystem` | `boolean` | Include system categories (default: true) |

**System Category Prefixes:**
System categories are returned with special IDs:
- `system:expense:HOUSING`, `system:expense:UTILITIES`, etc.
- `system:income:SALARY`, `system:income:RENT`, etc.

System categories cannot be modified or deleted.

**Response Shape (GET list):**
```json
{
  "success": true,
  "data": [
    {
      "id": "system:expense:HOUSING",
      "code": "HOUSING",
      "name": "Housing",
      "type": "EXPENSE",
      "isSystem": true,
      "isActive": true,
      "sortOrder": 0,
      "color": null,
      "icon": null,
      "description": null
    },
    {
      "id": "uuid-here",
      "code": "PET_CARE",
      "name": "Pet Care",
      "type": "EXPENSE",
      "isSystem": false,
      "isActive": true,
      "sortOrder": 0,
      "color": "#FF5733",
      "icon": "paw",
      "description": "Vet bills, food, supplies"
    }
  ],
  "_meta": {
    "totalCount": 25,
    "systemCount": 19,
    "customCount": 6
  }
}
```

---

# **12. Logging Rules**

### **12.1 API Log Format**
Each request logs:

- IP  
- Auth user  
- Method  
- Path  
- Status code  
- Duration  
- Error codes (if any)  

### **12.2 Error Log File**
Monitrax MUST maintain:

```
/ERROR_LOG.md
```

This file stores:

- All audit issues  
- Fix timelines  
- Cross-system references  

---

# **13. Testing Standards**

### **13.1 Required Automated Tests**
- Schema validation tests  
- API contract tests  
- Error format tests  
- Snapshot contract tests  
- Data consistency validation tests  

### **13.2 Manual Regression Suite (Phase 9.7)**
Must be run before merge to main.

---

# **14. Acceptance Criteria**

The API layer is correct when:

- All endpoints follow consistent CRUD patterns  
- All responses follow the unified envelope format  
- Every mutation is validated using Zod  
- No unhandled exceptions leak to clients  
- Snapshot + Insights + Health endpoints are contract-stable  
- Future phases (auth, AI engine) plug in without breaking changes  

---

# **15. Phase 41e — Entity-aware tax endpoints**

Per `docs/blueprint/PHASE_41E_AUDIT_AND_MIGRATION_PLAN.md` §6.8. New endpoints landing in 41e.0 slice D + 41e.−1 cleanup, all using the `tax_data.*` permission family (Phase 41e.0 slice A).

| Endpoint | Method | Sub-PR | Permission | Purpose |
|---|---|---|---|---|
| `/api/tax/config` | GET | 41e.0 slice D | `tax_data.read` | Returns the canonical FY config (`TaxYearConfig`) for `?fy=YYYY-YY` (default current FY). Replaces hard-coded thresholds. |
| `/api/tax/entity/[entityId]` | GET | 41e.0 slice D | `tax_data.read` | Returns per-entity tax position via the `entityTaxRouter`. PERSONAL_NAME / SOLE_TRADER → real Phase 20 result + boundary footnote; COMPANY / TRUST / SMSF / PARTNERSHIP → null result + UNCOMPUTED flag (per audit §10.3). Caller must own the entity. |
| `/api/tax/entity/[entityId]` | POST | 41e.1 slice D-1 | `tax_data.read` | Same response shape as GET, accepts a JSON body to drive slice-specific dispatch paths (e.g. `{ "trustDistribution": { "trustNetIncome": 100000, "beneficiaries": [...] } }`). For DISCRETIONARY_TRUST / UNIT_TRUST entities, providing `trustDistribution` flips the response from UNCOMPUTED to a real Div 6 allocation. Caller must own the entity. |
| `/api/tax/master-position` | GET | 41e.17 (queued) | `tax_data.read` | Household-wide tax position roll-up. Replaces the `buildTaxSummary()` adapter from cleanup PR C. |
| `/api/tax/trust-distribution` | POST | 41e.4 (queued) | `tax_data.write` | Computes Div 6/6E streaming + per-beneficiary share + character. |
| `/api/tax/div7a-check` | POST | 41e.6 (queued) | `tax_data.write` | Compliance check on a COMPANY → shareholder loan. |
| `/api/tax/cgt-disposal` | POST | 41e.1 (queued) | `tax_data.write` | Entity-aware CGT (50% / 33⅓% / 0% / nil discount). |
| `/api/tax/state-tax/[entityId]?state=NSW` | GET | 41e.12-14 (queued) | `tax_data.read` | Land tax + stamp duty + foreign-person surcharge. |

### Response shape — boundary footnote

Per architecture doc §1(5) + §5, every endpoint returning a tax-shaped figure surfaces a `boundary` field alongside the data, computed by `lib/tax-engine/boundaries/index.ts:renderBoundaryFootnote()`:

```json
{
  "success": true,
  "data": {
    "entityPosition": { ... },
    "boundary": {
      "computedPer": "Computed per ITAA 1997 s4-10, ITAA 1997 Div 1-6.",
      "uncomputedNotes": [
        "FBT not computed for personal-use Pty Ltd assets."
      ],
      "boundary": "These figures are general information only — not personal financial, tax, or credit advice. Confirm with a registered tax agent (TPB), financial adviser (AFSL), or credit assistant (NCCP) before acting.",
      "fyContext": "Figures for FY24-25."
    }
  }
}
```

UI consumers render this via `<BoundaryFootnote citations={...} uncomputed={...} fyLabel="FY24-25" />` (component at `components/tax/BoundaryFootnote.tsx`). One source of truth for legal copy across every tax surface.

---

