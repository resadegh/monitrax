# PHASE 34 — CDR SECURITY HARDENING & RBAC ENFORCEMENT

**Version:** 1.0
**Created:** 2026-02-27
**Status:** Approved — Ready for Implementation
**Branch:** `claude/gcp-identity-migration-phase-V6Y66`
**CDR Requirement Ref:** Australian Consumer Data Right (CDR) — Information Security controls
**Depends On:** Phase 10 (Auth & Security), Phase 24 (Basiq Open Banking), Phase 33 (Admin Portal)

---

## 1. PURPOSE

Phase 34 closes the security enforcement gaps identified in the CDR compliance audit (2026-02-27). The audit found that while Monitrax has well-designed security infrastructure (GCP Identity Platform, RBAC permissions, ownership verification, admin sessions), several critical controls are **defined but not enforced** in runtime code.

This phase does NOT introduce new architectural concepts. It wires up existing systems that are already built but not connected.

### 1.1 What This Phase Does NOT Cover

These items are already documented elsewhere and are NOT duplicated here:

| Topic | Existing Document |
|-------|------------------|
| GCP Identity Platform architecture | `docs/blueprint/PHASE_10_AUTH_AND_SECURITY.md` §3 |
| Firebase client SDK integration | `docs/blueprint/GCP_IDENTITY_MIGRATION_PHASE2.md` |
| Firebase MFA enrollment & challenge | `docs/blueprint/GCP_IDENTITY_MIGRATION_PHASE3_MFA.md` |
| Basiq Open Banking architecture | `docs/blueprint/PHASE_24_OPEN_BANKING_BASIQ.md` |
| Enterprise portal consent model | `docs/blueprint/PHASE_32_ENTERPRISE_PORTAL.md` |
| Admin portal RBAC & sessions | `docs/blueprint/PHASE_33_ADMIN_PORTAL.md` |
| RBAC role definitions | `lib/auth/permissions.ts` (50+ permissions, 4 active roles) |
| Permission guard functions | `lib/auth/guards.ts` (`withPermission`, `withAllPermissions`, etc.) |
| Ownership verification | `lib/utils/ownership.ts` (`verifyOwnership`, `verifyRelatedOwnership`, etc.) |
| Admin permission system | `lib/admin/permissions.ts` (69 admin permissions, 4 admin roles) |

---

## 2. AUDIT FINDINGS SUMMARY

The CDR compliance audit tested 8 controls. Results:

| # | CDR Control | Status | Gap |
|---|-------------|--------|-----|
| 1 | User authentication for CDR data | ✅ FIXED | Session idle timeout aligned to 30min (34.1) |
| 2 | Unique login accounts | PASS | None |
| 3 | No generic/shared accounts | PASS | None |
| 4 | MFA enabled | FAIL | Supported but not enforced (see §3.2) — pending 34.4 |
| 5 | Strong passwords enforced | ✅ FIXED | 12+ chars with complexity, bcrypt 12 rounds (34.1) |
| 6 | Role-based access control | PARTIAL FAIL | Defined but not enforced on ~150 user routes (see §3.4) — pending 34.3 |
| 7 | Least-privilege access | PARTIAL PASS | Undermined by §3.4 gap — pending 34.3 |
| 8 | Admin account review & removal | ✅ FIXED | Audit persistence wired (34.2), admin bcrypt (34.1) — admin lifecycle pending 34.5 |

---

## 3. GAPS — EXACT CODE LOCATIONS

### 3.1 Session Idle Timeout Mismatch

**Blueprint requirement:** 30-minute idle timeout (per `PHASE_10_AUTH_AND_SECURITY.md` §10.2)

| Component | File | Current Value | Required |
|-----------|------|---------------|----------|
| Client-side guard | `components/auth/IdleTimeoutGuard.tsx:19` | `30 * 60 * 1000` (30 min) | 30 min (correct) |
| Server-side session manager | `lib/session/sessionManager.ts:46` | `60 * 60 * 1000` (60 min) | 30 min (wrong) |

**Fix applied:** Changed `lib/session/sessionManager.ts:46` from `60 * 60 * 1000` to `30 * 60 * 1000`. ✅

---

### 3.2 MFA Not Enforced

**Current state:** MFA is fully implemented via Firebase TOTP (see `GCP_IDENTITY_MIGRATION_PHASE3_MFA.md`), but enrollment is voluntary. No server-side check blocks API access for users without MFA.

**Schema fields that exist but are not checked at runtime:**

| Field | Model | File | Purpose |
|-------|-------|------|---------|
| `mfaEnabled` | `User` | `prisma/schema.prisma` | Whether user has MFA enabled |
| `mfaEnforcedByOrg` | `User` | `prisma/schema.prisma` | Whether org requires MFA |
| `mfaEnforced` | `Organization` | `prisma/schema.prisma` | Org-level MFA enforcement |
| `mfaEnabled` | `AdminUser` | `prisma/schema.prisma` | Admin MFA status |

**What is NOT wired up:**
- No middleware checks `user.mfaEnabled` before allowing API access
- `Organization.mfaEnforced` is never read in any auth flow
- Admin portal allows SUPER_ADMIN access without MFA

---

### 3.3 Weak Password Validation

**Current state** (verified from code):

| Component | File:Line | Current Behaviour |
|-----------|-----------|-------------------|
| User registration | `app/api/auth/register/route.ts:19` | Only checks `password.length < 8` — no complexity |
| Password hashing | `lib/auth.ts:27` | `bcrypt.hash(password, 10)` — 10 rounds (OWASP recommends 12+) |
| Admin passwords | `lib/admin/auth.ts` | SHA256 with salt (NOT bcrypt) — weak for passwords |
| Admin validation | `lib/admin/constants.ts` | 12+ chars, upper+lower+number+special (policy defined, enforced) |

**Note:** For users authenticating via GCP Identity Platform (Google OAuth, Firebase email/password), Firebase manages password policy. The `app/api/auth/register/route.ts` is the legacy registration endpoint still in the codebase.

---

### 3.4 RBAC Permissions Defined But Not Enforced on User Routes

**Current state:**
- `lib/auth/permissions.ts` defines 50+ permissions with role mappings (see file for full list)
- `lib/auth/guards.ts` provides ready-to-use guards: `withPermission()`, `withAllPermissions()`, `withAnyPermission()`, `withOwnerOnly()`
- **~150 user API routes use `withAuth()` from `lib/middleware.ts` — authentication only, no permission checks**
- Admin routes (`app/api/admin/*`) correctly use `verifyAdminAuth()` + `hasPermission()` — no changes needed

**Impact:** A user with VIEWER role can call POST/PUT/DELETE endpoints on their own data. The permission system says VIEWER is read-only, but this is not enforced at the API layer.

**Example** (`app/api/properties/route.ts`):
```typescript
// CURRENT — auth only, no permission check:
export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    // Any role can create properties
  });
}

// AFTER Phase 34 — permission enforced:
// Uses withPermission from lib/auth/guards.ts
export const POST = withPermission('property.write', async (request, auth) => {
  // Only OWNER, ADMIN, CONTRIBUTOR can create (VIEWER blocked)
});
```

---

### 3.5 Audit Log Not Persisted

**Current state:**
- `lib/security/auditLog.ts` (450+ lines) — **already persists to DB** via `prisma.auditLog.create()`. This is the active audit system used by auth, session, and passkey modules.
- `lib/audit/logger.ts` — secondary audit logger, was console-only with a TODO at the persistence layer
- `AuditLog` model exists in Prisma schema with all required fields
- Admin audit (`AdminAuditLog`) IS persisted to database (Phase 33, working correctly)

**Fix applied (Phase 34.2):** Wired `lib/audit/logger.ts` `logAuditEvent()` to delegate to `createAuditLog()` from `lib/security/auditLog.ts`, so both audit systems now persist to the same `AuditLog` table. ✅

---

### 3.6 Admin Password Hashing Uses SHA256

**Fix applied:** `hashPassword()` now uses `bcrypt.hash(password, 12)`. `verifyPassword()` is backward-compatible: detects `$2a$`/`$2b$` prefix for bcrypt, falls back to legacy `salt:hash` SHA256 format for existing admin accounts. `prisma/seed-admin.ts` also updated to use bcrypt. ✅

---

## 4. IMPLEMENTATION PLAN — PHASED WITH TEST GATES

Each sub-phase is atomic and independently deployable. A test gate must pass before the next sub-phase starts.

---

### SUB-PHASE 34.1: TRIVIAL FIXES (No Risk) ✅ COMPLETE

**Scope:** Fix configuration values and password hashing. No API signature changes.

| # | Task | File | Change |
|---|------|------|--------|
| 1 | Fix server idle timeout | `lib/session/sessionManager.ts:46` | `60 * 60 * 1000` → `30 * 60 * 1000` |
| 2 | Increase bcrypt rounds | `lib/auth.ts:27` | `bcrypt.hash(password, 10)` → `bcrypt.hash(password, 12)` |
| 3 | Add password strength validation | `app/api/auth/register/route.ts` | Add: min 12 chars, uppercase, lowercase, digit, special char |
| 4 | Switch admin hash to bcrypt | `lib/admin/auth.ts` | Replace SHA256 `hashPassword`/`verifyPassword` with bcrypt |

**Test gate 34.1:**
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Existing admin login still works (test with admin seed account)
- [ ] Registration rejects weak passwords ("test1234" should fail)
- [ ] Registration accepts strong passwords ("MyP@ssw0rd!2026" should pass)

---

### SUB-PHASE 34.2: AUDIT LOG PERSISTENCE ✅ COMPLETE

**Scope:** Wire the existing `logAuditEvent()` function to write to the `AuditLog` database table. No API signature changes.

| # | Task | File | Change |
|---|------|------|--------|
| 1 | Implement DB persistence | `lib/audit/logger.ts` or `lib/security/auditLog.ts` | Replace console-only logging with `prisma.auditLog.create()` |
| 2 | Add error handling | Same file | Wrap DB write in try/catch — never block the request if audit write fails |
| 3 | Verify AuditLog model fields | `prisma/schema.prisma` | Confirm model has: userId, action, status, ipAddress, userAgent, metadata, targetEntityType, targetEntityId, previousValues, newValues, timestamp |

**Note:** The `AuditLog` model already exists in the schema (confirmed in Phase 10 implementation). No schema changes needed.

**Test gate 34.2:**
- [ ] `npm run build` passes
- [ ] Create a property via API → confirm `AuditLog` row created in database
- [ ] Delete a property → confirm audit row with DELETE action
- [ ] Audit write failure does NOT block the API response (test by temporarily breaking the query)

---

### SUB-PHASE 34.3: RBAC ENFORCEMENT ON USER API ROUTES

**Scope:** Replace `withAuth()` with `withPermission()` on all user-facing API routes. This is the largest change.

**Strategy:** Incremental migration by module. Each module is independently deployable.

**Guard function to use:** `withPermission()` from `lib/auth/guards.ts:63-96` (already built, tested, and ready)

**Auth context change:** Routes currently using `withAuth()` from `lib/middleware.ts` receive `authReq.user.userId`. Routes using `withPermission()` from `lib/auth/guards.ts` receive `(request, auth)` where `auth.userId` is the same value. The handler signature changes slightly.

#### 34.3a — Properties Module

| Route | File | Current Auth | New Auth | Permission |
|-------|------|-------------|----------|------------|
| GET /api/properties | `app/api/properties/route.ts` | `withAuth` | `withPermission` | `property.read` |
| POST /api/properties | `app/api/properties/route.ts` | `withAuth` | `withPermission` | `property.write` |
| GET /api/properties/[id] | `app/api/properties/[id]/route.ts` | `withAuth` | `withPermission` | `property.read` |
| PUT /api/properties/[id] | `app/api/properties/[id]/route.ts` | `withAuth` | `withPermission` | `property.write` |
| DELETE /api/properties/[id] | `app/api/properties/[id]/route.ts` | `withAuth` | `withPermission` | `property.delete` |

**Test gate 34.3a:**
- [ ] OWNER can GET, POST, PUT, DELETE properties
- [ ] ADMIN can GET, POST, PUT, DELETE properties
- [ ] CONTRIBUTOR can GET, POST, PUT properties; DELETE returns 403
- [ ] VIEWER can GET properties; POST/PUT/DELETE return 403
- [ ] Build passes

#### 34.3b — Loans Module

| Route | File | Permission |
|-------|------|------------|
| GET /api/loans | `app/api/loans/route.ts` | `loan.read` |
| POST /api/loans | `app/api/loans/route.ts` | `loan.write` |
| GET /api/loans/[id] | `app/api/loans/[id]/route.ts` | `loan.read` |
| PUT /api/loans/[id] | `app/api/loans/[id]/route.ts` | `loan.write` |
| DELETE /api/loans/[id] | `app/api/loans/[id]/route.ts` | `loan.delete` |

**Test gate 34.3b:** Same role matrix as 34.3a but for loans.

#### 34.3c — Accounts Module

| Route | File | Permission |
|-------|------|------------|
| GET /api/accounts | `app/api/accounts/route.ts` | `account.read` |
| POST /api/accounts | `app/api/accounts/route.ts` | `account.write` |
| GET /api/accounts/[id] | `app/api/accounts/[id]/route.ts` | `account.read` |
| PUT /api/accounts/[id] | `app/api/accounts/[id]/route.ts` | `account.write` |
| DELETE /api/accounts/[id] | `app/api/accounts/[id]/route.ts` | `account.delete` |

**Test gate 34.3c:** Same role matrix as 34.3a but for accounts.

#### 34.3d — Income Module

| Route | File | Permission |
|-------|------|------------|
| GET /api/income | `app/api/income/route.ts` | `income.read` |
| POST /api/income | `app/api/income/route.ts` | `income.write` |
| GET /api/income/[id] | `app/api/income/[id]/route.ts` | `income.read` |
| PUT /api/income/[id] | `app/api/income/[id]/route.ts` | `income.write` |
| DELETE /api/income/[id] | `app/api/income/[id]/route.ts` | `income.delete` |

**Test gate 34.3d:** Same role matrix.

#### 34.3e — Expenses Module

| Route | File | Permission |
|-------|------|------------|
| GET /api/expenses | `app/api/expenses/route.ts` | `expense.read` |
| POST /api/expenses | `app/api/expenses/route.ts` | `expense.write` |
| GET /api/expenses/[id] | `app/api/expenses/[id]/route.ts` | `expense.read` |
| PUT /api/expenses/[id] | `app/api/expenses/[id]/route.ts` | `expense.write` |
| DELETE /api/expenses/[id] | `app/api/expenses/[id]/route.ts` | `expense.delete` |

**Test gate 34.3e:** Same role matrix.

#### 34.3f — Investments Module

| Route | File | Permission |
|-------|------|------------|
| GET /api/investments/* | Various | `investment.read` |
| POST /api/investments/* | Various | `investment.write` |
| PUT /api/investments/* | Various | `investment.write` |
| DELETE /api/investments/* | Various | `investment.delete` |

**Test gate 34.3f:** Same role matrix.

#### 34.3g — Basiq/CDR Routes

| Route | File | Permission |
|-------|------|------------|
| GET /api/basiq/connections | `app/api/basiq/connections/route.ts` | `account.read` |
| POST /api/basiq/connections | `app/api/basiq/connections/route.ts` | `account.write` |
| GET /api/basiq/connections/[id] | `app/api/basiq/connections/[id]/route.ts` | `account.read` |
| DELETE /api/basiq/connections/[id] | `app/api/basiq/connections/[id]/route.ts` | `account.delete` |
| POST /api/basiq/sync | Various | `account.write` |

**Test gate 34.3g:** Same role matrix for CDR data access.

#### 34.3h — Remaining Modules

Apply the same pattern to all remaining routes:
- Transactions (`transaction.read/write/delete`)
- Holdings (`holding.read/write/delete`)
- Documents (`property.read/write` or new `document.read/write`)
- Assets (`property.read/write` — reuse property permissions, or add asset-specific)
- Categories (`expense.read/write`)
- Reports (`report.read/export`)
- Settings (`settings.read/write`)

**Full route inventory** will be compiled at implementation time by running:
```bash
find app/api -name "route.ts" | grep -v admin | grep -v portal | grep -v auth | sort
```

**Final test gate 34.3:**
- [ ] `npm run build` passes
- [ ] All VIEWER users are truly read-only across all modules
- [ ] All CONTRIBUTOR users cannot delete (only OWNER/ADMIN can)
- [ ] OWNER has full access
- [ ] No existing functionality broken for OWNER users (regression test)

---

### SUB-PHASE 34.4: MFA ENFORCEMENT MIDDLEWARE

**Scope:** Add server-side MFA verification so that users without MFA cannot access CDR/financial data.

**Approach:** Create a new guard `withMFARequired()` that checks if the authenticated user has MFA enabled.

| # | Task | File | Change |
|---|------|------|--------|
| 1 | Create `withMFARequired` guard | `lib/auth/guards.ts` | New function that wraps `withPermission` + checks `user.mfaEnabled` |
| 2 | Apply to Basiq routes | `app/api/basiq/*/route.ts` | Wrap with `withMFARequired` |
| 3 | Wire org-level enforcement | `lib/auth/guards.ts` | Check `user.mfaEnforcedByOrg` — if true, require MFA |
| 4 | Admin MFA requirement | `lib/admin/auth.ts` | Check `adminUser.mfaEnabled` for SUPER_ADMIN/BILLING_ADMIN roles |

**Implementation detail for `withMFARequired`:**

```typescript
// lib/auth/guards.ts — new function
export function withMFARequired<T = unknown>(
  permission: Permission,
  handler: AuthenticatedHandler<T>,
  options?: GuardOptions
): (request: NextRequest, params?: T) => Promise<Response> {
  return async (request: NextRequest, params?: T) => {
    const auth = await getAuthContext(request);
    if (!auth) return formatErrorResponse(errors.unauthorized());
    if (!hasPermission(auth.role, permission)) {
      return formatErrorResponse(errors.forbidden(`Permission '${permission}' required`));
    }

    // Check MFA requirement
    const user = await prisma.user.findUnique({
      where: { id: auth.userId },
      select: { mfaEnabled: true, mfaEnforcedByOrg: true },
    });

    if (user?.mfaEnforcedByOrg && !user?.mfaEnabled) {
      return formatErrorResponse(errors.forbidden('MFA is required by your organization'));
    }

    return handler(request, auth, params);
  };
}
```

**Deployment consideration:** MFA enforcement should be introduced gradually:
1. First deploy with logging only (warn if MFA not enabled, but don't block)
2. Notify users who access CDR data without MFA
3. After a grace period, enforce blocking

**Test gate 34.4:**
- [ ] `npm run build` passes
- [ ] User with MFA enabled can access Basiq routes
- [ ] User without MFA + org enforcement gets 403 on Basiq routes
- [ ] User without MFA + no org enforcement can still access (enforcement is per-org)
- [ ] Admin SUPER_ADMIN without MFA gets warning (phase 1: warn, phase 2: block)

---

### SUB-PHASE 34.5: ADMIN ACCOUNT LIFECYCLE

**Scope:** Add automated inactive admin detection and review capability.

| # | Task | File | Change |
|---|------|------|--------|
| 1 | Add `lastLoginAt` tracking | `lib/admin/auth.ts` | Update `lastLoginAt` on successful admin login (field exists in schema) |
| 2 | Add admin review API endpoint | `app/api/admin/review/route.ts` | GET endpoint returns admins with `lastLoginAt > 90 days` or `null` |
| 3 | Add admin deactivation audit | `lib/admin/auth.ts` | Log `ADMIN_DEACTIVATED` to `AdminAuditLog` when admin is deactivated |

**Test gate 34.5:**
- [ ] `npm run build` passes
- [ ] Admin login updates `lastLoginAt`
- [ ] Review endpoint returns inactive admins correctly
- [ ] Deactivation creates audit log entry

---

## 5. HANDLER SIGNATURE MIGRATION GUIDE

When migrating routes from `withAuth()` (middleware.ts) to `withPermission()` (guards.ts), the handler signature changes:

```typescript
// BEFORE (withAuth from lib/middleware.ts):
export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    const userId = authReq.user!.userId;
    // ... rest of handler
  });
}

// AFTER (withPermission from lib/auth/guards.ts):
import { withPermission } from '@/lib/auth/guards';

export const GET = withPermission('entity.read', async (request, auth) => {
  const userId = auth.userId;
  // ... rest of handler (same logic, different variable name)
});
```

**Key differences:**
- `withAuth` wraps a function that receives `authReq` with `.user.userId`
- `withPermission` wraps a function that receives `(request, auth)` where `auth.userId` is the user ID
- `withPermission` is a higher-order function that returns the handler directly (use `export const GET = ...`)
- Ownership checks (`verifyOwnership`, `verifyRelatedOwnership`) remain unchanged — they take `userId` from the auth context

---

## 6. FILES AFFECTED (COMPLETE INVENTORY)

### Modified (Phase 34.1 — Trivial Fixes)
- `lib/session/sessionManager.ts` — idle timeout value
- `lib/auth.ts` — bcrypt rounds
- `app/api/auth/register/route.ts` — password validation
- `lib/admin/auth.ts` — password hashing algorithm

### Modified (Phase 34.2 — Audit Persistence)
- `lib/audit/logger.ts` or `lib/security/auditLog.ts` — DB persistence

### Modified (Phase 34.3 — RBAC Enforcement)
- ~150 files in `app/api/` (all user-facing routes)
- Each file: replace `withAuth` import with `withPermission` import, adjust handler signature

### Modified (Phase 34.4 — MFA Enforcement)
- `lib/auth/guards.ts` — new `withMFARequired` function
- `app/api/basiq/*/route.ts` — apply MFA guard
- `lib/admin/auth.ts` — admin MFA check

### Created (Phase 34.5 — Admin Lifecycle)
- `app/api/admin/review/route.ts` — inactive admin review endpoint

### NOT Modified
- `prisma/schema.prisma` — no schema changes needed (all fields already exist)
- `lib/auth/permissions.ts` — permissions already defined correctly
- `lib/utils/ownership.ts` — ownership checks remain unchanged
- `lib/admin/permissions.ts` — admin permissions already correct
- All admin API routes — already use `verifyAdminAuth()` + `hasPermission()`

---

## 7. RISK ASSESSMENT

| Sub-Phase | Risk Level | Blast Radius | Rollback Strategy |
|-----------|-----------|-------------|-------------------|
| 34.1 (Trivial fixes) | LOW | Config values only | Revert commit |
| 34.2 (Audit persistence) | LOW | Write-path only, wrapped in try/catch | Revert commit |
| 34.3 (RBAC enforcement) | MEDIUM | All user API routes | Deploy per-module, revert any failing module |
| 34.4 (MFA enforcement) | MEDIUM | CDR data access | Deploy with warn-only first, then enforce |
| 34.5 (Admin lifecycle) | LOW | New endpoint only | Revert commit |

**Highest risk:** Sub-phase 34.3 (RBAC enforcement). Mitigation:
- Deploy one module at a time (properties first, then loans, etc.)
- If any module breaks, revert just that module's changes
- All current OWNER users are unaffected (OWNER has all permissions)
- Only VIEWER and CONTRIBUTOR users experience new restrictions

---

## 8. ACCEPTANCE CRITERIA

Phase 34 is complete when:

### Authentication & Session
- [ ] Server-side idle timeout matches blueprint (30 minutes)
- [ ] Client-side idle timeout matches blueprint (30 minutes — already correct)

### Password Strength
- [ ] User registration requires: 12+ chars, uppercase, lowercase, digit, special character
- [ ] BCrypt uses 12 rounds minimum
- [ ] Admin passwords use bcrypt (not SHA256)

### RBAC Enforcement
- [ ] All user API routes use `withPermission()` guards
- [ ] VIEWER role is truly read-only (cannot create/update/delete)
- [ ] CONTRIBUTOR role cannot delete entities (only OWNER/ADMIN)
- [ ] OWNER role has full access (no regression)
- [ ] Admin routes remain unchanged (already properly guarded)

### MFA
- [ ] CDR/Basiq routes enforce MFA when org requires it
- [ ] Admin SUPER_ADMIN/BILLING_ADMIN roles require MFA

### Audit
- [ ] User audit events persist to AuditLog database table
- [ ] Audit write failures do not block API responses

### Admin Lifecycle
- [ ] Admin last login tracked
- [ ] Inactive admin review endpoint functional

---

## 9. CROSS-REFERENCES

| Topic | Document |
|-------|----------|
| Auth framework spec | `docs/blueprint/PHASE_10_AUTH_AND_SECURITY.md` |
| GCP token verification | `docs/blueprint/GCP_IDENTITY_MIGRATION_PHASE2.md` |
| Firebase MFA | `docs/blueprint/GCP_IDENTITY_MIGRATION_PHASE3_MFA.md` |
| Basiq/CDR integration | `docs/blueprint/PHASE_24_OPEN_BANKING_BASIQ.md` |
| Enterprise portal consent | `docs/blueprint/PHASE_32_ENTERPRISE_PORTAL.md` |
| Admin portal | `docs/blueprint/PHASE_33_ADMIN_PORTAL.md` |
| Architecture overview | `docs/blueprint/01_ARCHITECTURE_OVERVIEW.md` §6 |
| API standards | `docs/blueprint/07_API_STANDARDS.md` §7 |
| Design principles | `docs/blueprint/02_DESIGN_PRINCIPLES.md` §8 |

### Key Implementation Files

| Purpose | File | Lines |
|---------|------|-------|
| RBAC permissions (50+) | `lib/auth/permissions.ts` | 205 |
| Permission guard functions | `lib/auth/guards.ts` | 216 |
| Auth context (GCP verification) | `lib/auth/context.ts` | 177 |
| Legacy middleware (withAuth) | `lib/middleware.ts` | 113 |
| Ownership verification | `lib/utils/ownership.ts` | 238 |
| User audit logging | `lib/security/auditLog.ts` | 450+ |
| Admin auth & sessions | `lib/admin/auth.ts` | 595 |
| Admin permissions (69) | `lib/admin/permissions.ts` | 433 |
| Password hashing (bcrypt) | `lib/auth.ts` | ~40 |
| Session tracking | `lib/session/sessionTracking.ts` | 200+ |
| Session manager (idle timeout) | `lib/session/sessionManager.ts` | 200+ |
| Client idle timeout guard | `components/auth/IdleTimeoutGuard.tsx` | 100+ |
| Firebase MFA helpers | `lib/firebase/mfa.ts` | 200+ |
| GCP token verifier | `lib/auth/gcpTokenVerifier.ts` | 200+ |
| GCP user sync | `lib/auth/gcpIdentity.ts` | 200+ |
| User registration (legacy) | `app/api/auth/register/route.ts` | 85 |

---

## 10. IMPLEMENTATION ORDER & TIMELINE

```
34.1 (Trivial fixes)     ──→ TEST GATE ──→ DEPLOY
34.2 (Audit persistence) ──→ TEST GATE ──→ DEPLOY
34.3a (Properties RBAC)  ──→ TEST GATE ──→ DEPLOY
34.3b (Loans RBAC)       ──→ TEST GATE ──→ DEPLOY
34.3c (Accounts RBAC)    ──→ TEST GATE ──→ DEPLOY
34.3d (Income RBAC)      ──→ TEST GATE ──→ DEPLOY
34.3e (Expenses RBAC)    ──→ TEST GATE ──→ DEPLOY
34.3f (Investments RBAC)  ──→ TEST GATE ──→ DEPLOY
34.3g (Basiq/CDR RBAC)   ──→ TEST GATE ──→ DEPLOY
34.3h (Remaining RBAC)   ──→ TEST GATE ──→ DEPLOY
34.4 (MFA enforcement)   ──→ TEST GATE ──→ DEPLOY (warn-only first)
34.5 (Admin lifecycle)   ──→ TEST GATE ──→ DEPLOY
```

Each step is independently deployable and reversible. No step depends on a later step.

---

**END OF PHASE 34 — CDR SECURITY HARDENING & RBAC ENFORCEMENT**
