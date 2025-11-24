# 🛡️ **PHASE 05 — BACKEND INTEGRATION & SECURITY ENGINE (ENTERPRISE IAM MODEL)**  
### *Authentication, Authorization, Access Control, MFA, Audit Logging & Zero-Trust Architecture*

---

# **1. Purpose of Phase 05**

Phase 05 introduces a full **Identity & Access Management (IAM)** framework into Monitrax, upgrading the system from a single-user app into a **secure, multi-tenant, enterprise-ready financial platform**.

This phase implements:

- End-to-end authentication (email/password, OAuth, passwordless, MFA)  
- Authorization (RBAC baseline, support for ABAC expansion)  
- Tenant-level separation  
- Session & token lifecycle  
- Secure backend integration  
- Audit logging for all sensitive actions  
- Zero-trust security posture  
- Secure-by-default API architecture  
- Integration with future phases (AI Advisor, Collaboration Mode, Notifications, External Connectors)

This is one of the most critical pillars of the system.

---

# **2. Security Principles & Global Objectives**

All design decisions follow these principles:

## **2.1 Zero-Trust by Default**
- No request is trusted.
- Every request must be authenticated & validated.
- Authorization is evaluated *per resource*.

## **2.2 Least Privilege**
- Users are granted only the minimum access required.

## **2.3 Defense-in-Depth**
Layers of defense:

- IAM  
- Secure tokens  
- Rate limiting  
- WAF / CDN edge protection  
- Input validation  
- Database hardening  
- Monitoring & audit logs  

## **2.4 Secure-by-Default APIs**
All API endpoints:
- Require auth unless explicitly marked public  
- Validate schema  
- Apply rate limits  
- Log access patterns  

## **2.5 Observability & Traceability**
- Every sensitive action is logged  
- All logs are tamper-resistant and immutable  

## **2.6 Future Integration Readiness**
This security layer must support:

- AI Advisor (Phase 11)  
- Multi-user households (Phase 12)  
- External integrations (bank feeds, brokers, etc.)

---

# **3. Identity Architecture (IAM)**

Monitrax uses a hybrid IAM model:

```
Internal Identity Provider (Monitrax IDP)
       + External Providers (Google, Apple, Microsoft)
       + Optional Enterprise SSO (OIDC/SAML)
```

Identity types:

| Identity Type | Notes |
|---------------|-------|
| **LocalUser** | Email/password managed internally |
| **PasswordlessUser** | Magic links or OTP |
| **OAuthUser** | Google/Apple sign-in |
| **SSOUser** | Enterprise SAML/OIDC |

Each identity has a **principal**:

```
principal_id: UUID
email: string
verified: boolean
auth_methods: [...]
mfa_enabled: boolean
roles: [...]
permissions: [...]
tenant_id: string
```

---

# **4. Authentication Flows**

Monitrax supports **four authentication families**:

---

## **4.1 Email + Password (Internal IDP)**

Flow:
1. User registers with email/password  
2. Password hashed with Argon2id  
3. Verification email sent  
4. User signs in → JWT/Session issued  

Requirements:
- Argon2id hashing  
- Password strength rules  
- Login throttling  
- Email verification  

---

## **4.2 Passwordless (Magic Link / OTP)**

Magic link flow:
1. User enters email  
2. A one-time token is generated  
3. Link valid for 10 minutes  
4. Token redeemed → Session created  

OTP flow:
- TOTP or email OTP  
- 6-digit code  
- 3 attempts allowed  

---

## **4.3 OAuth2 / OIDC Providers**

Support:

- Google  
- Apple  
- Microsoft (optional)  

Data pulled from provider:
- Email  
- Name  
- Verified status  

OAuth accounts must map to an internal **principal**.

---

## **4.4 MFA Options**

Monitrax supports a pluggable MFA engine:

| Type | Description |
|------|-------------|
| **TOTP** | Authenticator app (Google Authenticator, Authy) |
| **Email OTP** | Basic fallback |
| **SMS OTP** | Optional external provider |

MFA is enforced for:
- High-value endpoints  
- Tenant administrators  
- Unknown devices  
- Suspicious sessions  

---

# **5. Token & Session Lifecycle**

Monitrax uses hybrid token/session security:

### **5.1 Access Token**
- Short-lived (15 minutes)
- Signed JWT
- Contains minimal claims:
  - principal_id  
  - tenant_id  
  - roles  

### **5.2 Refresh Token**
- Long-lived (7–30 days)
- Stored secure & HttpOnly
- Rotated on use
- Bound to device fingerprint

### **5.3 Session Record**
Stores:
- IP, device, user agent  
- MFA state  
- Risk level  
- Expiration  

### **5.4 Idle Timeout**
Session expires after 1 hour idle.

### **5.5 Active Session Management**
Users can:
- View sessions  
- Revoke sessions  
- Require re-auth on sensitive actions  

---

# **6. Authorization Model (RBAC + ABAC-ready)**

Monitrax uses **Role-Based Access Control** with future support for **Attribute-Based Access Control**.

---

## **6.1 Baseline Roles**

| Role | Description |
|------|-------------|
| **Owner** | Full access, manage tenant |
| **Admin** | Manage data + users |
| **Member** | Standard user, restricted access |
| **Viewer** | Read-only |

---

## **6.2 Permissions Matrix**

Every action belongs to a permission group:

```
property.read
property.write
income.read
income.write
loan.read
loan.write
investment.read
investment.write
settings.manage
user.manage
```

Roles map to permissions.

---

## **6.3 Optional ABAC Layer**

Future extension allows:

- Resource ownership  
- Time-based access  
- Relationship-based access (e.g., parent-child entity)  
- Context-aware access (e.g., location, risk score)

---

# **7. Tenant Isolation Model**

Monitrax supports **multi-tenant isolation**:

- Every user belongs to a tenant  
- All entities belong to tenant  
- Queries automatically filter by tenant_id  
- No cross-tenant access possible  

---

# **8. Secure API Architecture**

All API endpoints must enforce:

### **8.1 Authentication**
- Validate access token  
- Check token expiration  
- Validate session state  

### **8.2 Authorization**
- Check roles  
- Check permissions  
- Check tenant boundary  

### **8.3 Schema Validation**
Use zod or equivalent:

- Request payload  
- Path parameters  
- Response shape  

### **8.4 Rate Limiting**
Two layers:
- Global  
- Per-route  

### **8.5 Input Hardening**
- Reject large payloads  
- Block unrecognized fields  
- Sanitize user-provided strings  

### **8.6 Logging & Auditing**
All sensitive actions logged:
- Login / logout  
- Failed authentication  
- Entity creation/update/delete  
- Permission changes  
- MFA enrollment/disabling  

---

# **9. Audit Logging Architecture**

Monitrax uses an append-only audit log.

Audit record contains:

```
{
  event_id: UUID,
  event_type,
  principal_id,
  tenant_id,
  target_entity_id,
  timestamp,
  ip,
  user_agent,
  severity,
  metadata
}
```

Audit log destinations:
- Primary DB table  
- Optional secure external log sink  
- Optional monitoring dashboard  

---

# **10. Email Verification Engine**

Email verification is mandatory.

Workflow:
1. Generate verification token  
2. Store with TTL  
3. Send with template  
4. User clicks → Verified  

Resend rules:
- Max 5 per hour  
- Rate limiting global  

---

# **11. Security Settings UI (Phase 9/10/11 Integration)**

A unified Security Center UI includes:

- MFA setup  
- Password change  
- Session management  
- Device management  
- Login history  
- Tenant user management  
- Permission overview  

---

# **12. Environment & Deployment Security**

### **12.1 Secrets Management**
Use:
- Docker secrets  
- Environment variable encryption  
- Optional Hashicorp Vault  

Secrets:
- JWT signing keys  
- OAuth client secrets  
- Email provider keys  
- Database credentials  

### **12.2 Network Security**
- HTTPS everywhere  
- HSTS  
- TLS 1.2+  
- No mixed content  

### **12.3 Database Security**
- Per-tenant row filtering  
- Prisma safe queries  
- Parameterized SQL only  

### **12.4 Server Security**
- Minimal attack surface  
- Auto-updates  
- Disabled unnecessary services  

---

# **13. Threat Model**

Monitrax must defend against:

- Credential stuffing  
- Session hijacking  
- CSRF  
- XSS  
- SQL injection  
- Token replay  
- Supply-chain compromise  
- SSRF  
- Misconfigured ACLs  
- IDOR (Insecure Direct Object Reference)  

---

# **14. Acceptance Criteria**

✔ Full IAM framework implemented  
✔ Local + OAuth + passwordless auth  
✔ MFA ready  
✔ RBAC implemented  
✔ Tenant isolation enforced  
✔ Secure API layer in place  
✔ Audit logging operational  
✔ Email verification flow complete  
✔ Zero-trust principles enforced  
✔ All endpoints protected  
✔ UI security settings surfaced  
✔ Fully compatible with Phase 9, 10, 11

---

# **IMPLEMENTATION STATUS**

**Last Updated:** 2025-11-24
**Overall Completion:** 20% (CRITICAL GAPS)

---

## **Status Summary**

| Component | Status | Notes |
|-----------|--------|-------|
| Principal Model | ❌ MISSING | No principal architecture |
| Email + Password Auth | ✅ COMPLETE | `/lib/auth.ts` |
| OAuth Integration | ❌ MISSING | No Google/Apple/Microsoft |
| Passwordless Auth | ❌ MISSING | No magic links or OTP |
| MFA (TOTP/Email/SMS) | ❌ MISSING | Not implemented |
| Access Tokens (JWT) | ✅ COMPLETE | 7-day expiry |
| Refresh Tokens | ❌ MISSING | No refresh token rotation |
| Session Management | ❌ MISSING | No session records |
| RBAC Permissions | ❌ MISSING | Roles in schema only |
| Tenant Isolation | ❌ MISSING | No tenant filtering |
| Rate Limiting | ❌ MISSING | No rate limits |
| Audit Logging | ❌ MISSING | No audit trail |
| Email Verification | ❌ MISSING | No verification flow |
| Security Settings UI | ❌ MISSING | No settings page |

---

## **Existing Implementation Files**

### Authentication
```
/lib/auth.ts                    # JWT token generation, validation
/lib/context/AuthContext.tsx    # React auth context
/app/api/auth/login/route.ts    # Login endpoint
/app/api/auth/register/route.ts # Registration endpoint
```

### User Schema (Prisma)
```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  firstName String?
  lastName  String?
  role      UserRole @default(OWNER)
  // ... relations
}

enum UserRole {
  OWNER
  PARTNER
  ACCOUNTANT
}
```

---

## **CRITICAL GAPS**

### GAP-05-01: RBAC Permission System (CRITICAL)

**Blueprint Requirement:** Section 6 - Authorization Model

**Required Implementation:**

```typescript
// /lib/auth/permissions.ts
export const PERMISSIONS = {
  'property.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'property.write': ['OWNER', 'PARTNER'],
  'loan.read': ['OWNER', 'PARTNER', 'ACCOUNTANT'],
  'loan.write': ['OWNER', 'PARTNER'],
  'settings.manage': ['OWNER'],
  'user.manage': ['OWNER'],
} as const;

export function hasPermission(
  userRole: UserRole,
  permission: keyof typeof PERMISSIONS
): boolean {
  return PERMISSIONS[permission].includes(userRole);
}

// Middleware
export async function withPermission(
  permission: keyof typeof PERMISSIONS,
  handler: (req: Request) => Promise<Response>
) {
  return async (req: Request) => {
    const user = await getAuthUser(req);
    if (!hasPermission(user.role, permission)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    return handler(req);
  };
}
```

---

### GAP-05-02: Tenant Isolation (CRITICAL)

**Blueprint Requirement:** Section 7 - Tenant Isolation Model

**Required Implementation:**

```typescript
// All Prisma queries must include tenant filter
const properties = await prisma.property.findMany({
  where: {
    userId: tenantId, // REQUIRED on every query
  },
});

// Middleware to extract tenant from token
export async function getTenantId(request: Request): Promise<string> {
  const token = extractToken(request);
  const payload = verifyToken(token);
  return payload.userId;
}
```

---

### GAP-05-03: Audit Logging (CRITICAL)

**Blueprint Requirement:** Section 9 - Audit Logging Architecture

**Required Schema:**

```prisma
model AuditLog {
  id           String   @id @default(cuid())
  eventType    String   // LOGIN, LOGOUT, CREATE, UPDATE, DELETE
  principalId  String
  tenantId     String
  targetEntity String?
  targetId     String?
  timestamp    DateTime @default(now())
  ip           String?
  userAgent    String?
  severity     String   @default("INFO")
  metadata     Json?
}
```

**Required Implementation:**

```typescript
// /lib/audit/logger.ts
export async function logAuditEvent(event: {
  type: AuditEventType;
  principalId: string;
  tenantId: string;
  target?: { entity: string; id: string };
  metadata?: Record<string, unknown>;
  request?: Request;
}) {
  await prisma.auditLog.create({
    data: {
      eventType: event.type,
      principalId: event.principalId,
      tenantId: event.tenantId,
      targetEntity: event.target?.entity,
      targetId: event.target?.id,
      ip: getClientIp(event.request),
      userAgent: event.request?.headers.get('user-agent'),
      metadata: event.metadata,
    },
  });
}
```

---

### GAP-05-04: Rate Limiting (HIGH)

**Blueprint Requirement:** Section 8.4 - Rate Limiting

**Required Implementation:**

```typescript
// /lib/security/rateLimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(100, '1 m'),
});

export async function checkRateLimit(identifier: string): Promise<boolean> {
  const { success } = await ratelimit.limit(identifier);
  return success;
}
```

---

## **Acceptance Criteria Checklist**

| Criterion | Status |
|-----------|--------|
| Full IAM framework | ❌ |
| Local + OAuth + passwordless auth | ⚠️ Local only |
| MFA ready | ❌ |
| RBAC implemented | ❌ |
| Tenant isolation enforced | ❌ |
| Secure API layer | ⚠️ Basic |
| Audit logging operational | ❌ |
| Email verification flow | ❌ |
| Zero-trust principles | ❌ |
| All endpoints protected | ⚠️ Basic auth only |

---

## **Priority Actions**

1. **IMMEDIATE**: Implement tenant isolation (query filtering)
2. **IMMEDIATE**: Add RBAC permission checks to API routes
3. **HIGH**: Create audit logging infrastructure
4. **HIGH**: Implement rate limiting
5. **MEDIUM**: Add OAuth providers
6. **MEDIUM**: Implement MFA

---