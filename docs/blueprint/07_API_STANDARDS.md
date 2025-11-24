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

# **7. Authentication & Security Requirements (Phase 10)**

Even before Phase 10 is implemented, all APIs must be ready for:

### **7.1 Clerk/Supabase/Auth0 JWT Authentication**
Each request must be capable of:

- Parsing bearer tokens  
- Rejecting unauthenticated access  
- Supporting future RBAC  

### **7.2 Rate Limiting Hooks**
All endpoints must expose a wrapper:

```
withRateLimit(handler, { max: X, windowMs: Y })
```

Implementation happens in Phase 10.

### **7.3 Audit Logging**
All mutations will later be logged:

- Who changed data  
- When  
- Old vs new values  

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

