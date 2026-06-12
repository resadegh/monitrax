# Admin Portal Completion Plan

**Version:** 1.0
**Created:** 2026-03-03
**Status:** Ready for implementation
**Purpose:** Step-by-step plan for completing the admin portal with real data, GCP integrations, and CDR compliance features
**Context:** The admin portal is a SEPARATE application from the Monitrax user web app. All admin, logging, security, and CDR compliance features should be accessed through this portal.

---

## Before Starting — Read These Documents

1. `CLAUDE.md` — ALL parts, especially §12 (Code Quality) and §13 (CDR Compliance)
2. `docs/blueprint/PHASE_33_ADMIN_PORTAL.md` — Original admin portal specification
3. `docs/blueprint/PHASE_34_CDR_SECURITY_HARDENING.md` — CDR security requirements
4. `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` — Full compliance tracking
5. `docs/blueprint/CDR_IMPLEMENTATION_PLAN.md` — Overall CDR implementation sequence
6. `prisma/schema.prisma` — Data models for admin entities

---

## Current State Summary

### What Works (Real Data)
- **Login page** (`/admin/login/`) — Authenticates against `AdminUser` table
- **Dashboard page** (`/admin/dashboard/`) — Fetches real stats from `/api/admin/dashboard`
- **Audit logs page** (`/admin/audit-logs/`) — Real data from `AuditLog` table with filtering/export

### What Has Mock/Dummy Data (Needs Fixing)
- ~~**Organizations page** (`/admin/organizations/`)~~ ✅ real data
- ~~**Users page** (`/admin/users/`)~~ ✅ real data
- ~~**Billing page** (`/admin/billing/`)~~ ✅ real data
- ~~**Analytics page** (`/admin/analytics/`)~~ ✅ real data
- ~~**Feature Flags page** (`/admin/feature-flags/`)~~ ✅ real data

> **2026-06-12 full-portal re-audit.** This inventory only listed top-level
> pages — the two DETAIL pages slipped through and stayed on Phase 33
> scaffold mock data long after the steps above shipped:
>
> - ~~**User detail page** (`/admin/users/[userId]`)~~ ✅ **FIXED 2026-06-12**
>   — rewired to `GET /api/admin/users/:userId`; suspend/reactivate now
>   enforced via GCP Identity Platform disable (see
>   `docs/operational/security/01_AUTHENTICATION.md` § User Suspension).
> - **Organization detail page** (`/admin/organizations/[orgId]`) — ⚠ STILL
>   FULLY MOCK ("Acme Accounting", stub handlers). Backend GET/PATCH +
>   license routes exist; fix is frontend wiring (queued in
>   `IMPLEMENTATION_PLAN.md` Up Next).
> - **Impersonation** — `/admin/support/impersonate` calls
>   `POST /api/admin/users/[userId]/impersonate` which **does not exist**
>   (404). Needs a design pass before building (queued).

### What Needs Building
- Support tools page (impersonation, error logs)
- Admin settings page (admin user management, MFA configuration)
- GCP service integration panels
- CDR compliance dashboard

---

## Architecture Rules

1. **Admin portal is separate from user app** — different auth, different routes, different layout
2. **Admin auth uses `AdminUser` table** — NOT the regular `User` table or Firebase Auth
3. **Admin sessions use `admin_session` cookie** — verified by `verifyAdminAuth()`
4. **All admin API routes** are under `/api/admin/` — use `verifyAdminAuth()` + `hasPermission()`
5. **Feature flags gate access** — each page/feature controlled by `ADMIN_*` feature flags
6. **GCP-First** (CLAUDE.md §12.7) — pull data from GCP services where possible, not custom queries
7. **SSOT** (CLAUDE.md §12.2) — admin pages call admin API routes, which call canonical services
8. **CDR data protection** (CLAUDE.md §13.3) — never display raw CDR data in admin portal

---

## Admin Auth System

**File:** `lib/admin/auth.ts`

| Function | Purpose |
|----------|---------|
| `verifyAdminAuth(request)` | Extract token from cookie/header, validate session, return `AdminAuthContext` |
| `createAdminSession(adminId, ip, userAgent)` | Create session with 30-min expiry, store hashed token |
| `hashPassword(password)` | bcrypt(12) hashing |
| `verifyPassword(password, hash)` | bcrypt comparison (+ legacy SHA256 fallback) |
| `isAccountLocked(admin)` | Check `lockedUntil` timestamp |
| `recordFailedLogin(adminId)` | Increment `failedLoginCount`, lock after 5 attempts (15 min) |

**Admin Roles:**

| Role | Access Level |
|------|-------------|
| `SUPER_ADMIN` | Full access to everything |
| `BILLING_ADMIN` | Billing + read-only org/user/analytics |
| `SUPPORT_ADMIN` | User lookup + impersonation + logs |
| `VIEWER` | Read-only analytics |

**Permission Check Pattern:**
```typescript
const authContext = await verifyAdminAuth(request);
if (!authContext) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
if (!hasPermission(authContext.role, 'resource:action')) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

---

## STEP 1: Replace Organizations Page Mock Data

**Priority:** High
**Files to modify:**
- `app/admin/organizations/page.tsx` — Replace mock array with API call
- `app/api/admin/organizations/route.ts` — Verify it returns correct data

**Current problem:** Lines 21-27 in organizations page have a hardcoded array of 5 mock organizations.

**What to do:**
1. Read `app/admin/organizations/page.tsx` fully
2. Read `app/api/admin/organizations/route.ts` fully
3. Remove mock data array
4. Add `useEffect` to fetch from `/api/admin/organizations` on mount
5. Handle loading, error, and empty states
6. Wire search/filter to API query parameters
7. Ensure the API route uses `verifyAdminAuth()` + `hasPermission('organizations:list')`

**Data model:** `Organization` + `OrganizationLicense` + `OrganizationMember` counts

**Expected response shape:**
```typescript
{
  success: true,
  data: {
    organizations: [{
      id: string,
      name: string,
      slug: string,
      plan: string,        // from OrganizationLicense.tier
      status: string,      // active, suspended
      clientCount: number,
      staffCount: number,
      mrr: number,         // calculated from license tier
      createdAt: string
    }],
    total: number,
    page: number,
    pageSize: number
  }
}
```

---

## STEP 2: Replace Users Page Mock Data

**Priority:** High
**Files to modify:**
- `app/admin/users/page.tsx` — Replace mock array with API call
- `app/api/admin/users/route.ts` — Verify it returns correct data

**Current problem:** Lines 20-27 in users page have a hardcoded array of 6 mock users.

**What to do:**
1. Read `app/admin/users/page.tsx` fully
2. Read `app/api/admin/users/route.ts` fully
3. Remove mock data array
4. Add `useEffect` to fetch from `/api/admin/users` with pagination
5. Wire search/filter to API query parameters (tier, status, search)
6. Handle loading, error, empty states
7. Ensure API route uses `verifyAdminAuth()` + `hasPermission('users:list')`

**Data model:** `User` + `UserSubscription` + `OAuthAccount` (for provider info)

**Expected response shape:**
```typescript
{
  success: true,
  data: {
    users: [{
      id: string,
      name: string,
      email: string,
      tier: string,          // from UserSubscription
      status: string,        // active, suspended
      mrr: number,           // calculated from tier
      lastLogin: string,     // last API request or auth event
      joinedAt: string,
      mfaEnabled: boolean,
      authProvider: string   // from OAuthAccount
    }],
    total: number,
    page: number,
    pageSize: number
  }
}
```

---

## STEP 3: Replace Billing Page Mock Data

**Priority:** High
**Files to modify:**
- `app/admin/billing/page.tsx` — Replace mock metrics and transactions
- `app/api/admin/billing/overview/route.ts` — Verify returns real metrics
- `app/api/admin/billing/transactions/route.ts` — Verify returns real transactions

**Current problem:** Lines 19-43 have hardcoded billing metrics and transaction arrays.

**What to do:**
1. Read `app/admin/billing/page.tsx` fully
2. Read all billing API routes (`overview`, `subscriptions`, `transactions`, `failed-payments`)
3. Remove mock data
4. Fetch from `/api/admin/billing/overview` for revenue metrics
5. Fetch from `/api/admin/billing/transactions` for transaction list
6. Wire period selector to API query parameter
7. Ensure all billing API routes use `verifyAdminAuth()` + `hasPermission('billing:view')`

**Revenue metrics to display:**
- MRR (Monthly Recurring Revenue) — sum of active subscription values
- ARR (Annual Recurring Revenue) — MRR × 12
- Churn Rate — cancelled subscriptions / total subscriptions
- ARPU — MRR / active users
- Subscription breakdown by tier
- Recent transactions with status

---

## STEP 4: Replace Analytics Page Mock Data

**Priority:** High
**Files to modify:**
- `app/admin/analytics/page.tsx` — Replace mock analytics data
- `app/api/admin/analytics/` routes — Implement or verify real data

**Current problem:** Lines 18-44 have hardcoded active users, feature usage, and growth data.

**What to do:**
1. Read `app/admin/analytics/page.tsx` fully
2. Read analytics API routes (`growth`, `feature-usage`, `active-users`, `retention`)
3. Determine which analytics can come from database queries vs GCP services

**GCP-First approach:**
- **Active users:** Query `AuditLog` table for unique users with `API_REQUEST` actions in time windows (DAU/WAU/MAU)
- **Feature usage:** Query `AuditLog` by endpoint patterns to determine feature adoption
- **Growth metrics:** Query `User` table with `createdAt` grouping (daily/weekly/monthly)
- **Retention:** Cohort analysis from `User.createdAt` + `AuditLog` activity

**GCP services to consider:**
- **Cloud Logging** — If app logs are routed there, query for usage patterns
- **BigQuery** — For complex analytics queries (future)
- **Cloud Monitoring** — For infrastructure metrics (latency, errors, uptime)

**For now, use database queries.** Migrate to BigQuery/Cloud Logging when GCP services are enabled.

---

## STEP 5: Replace Feature Flags Page Mock Data

**Priority:** Medium
**Files to modify:**
- `app/admin/feature-flags/page.tsx` — Replace mock flags with API calls
- `app/api/admin/feature-flags/route.ts` — Verify CRUD operations work

**Current problem:** Lines 19-26 have a hardcoded mock flags array.

**What to do:**
1. Read `app/admin/feature-flags/page.tsx` fully
2. Read feature flags API routes (CRUD + overrides)
3. Read `lib/admin/featureFlags.ts` for the service layer
4. Remove mock data, fetch from `/api/admin/feature-flags`
5. Wire toggle switches to PUT/PATCH API calls
6. Wire "Create Override" form to POST API call
7. Ensure all routes use `verifyAdminAuth()` + `hasPermission('featureFlags:manage')`

**Data model:** `GlobalFeatureFlag` + `FeatureFlagOverride`

---

## STEP 6: CDR Compliance Dashboard (NEW)

**Priority:** High (CDR requirement)
**Files to create/modify:**
- `app/admin/cdr-compliance/page.tsx` — NEW page
- `app/api/admin/cdr/compliance/route.ts` — NEW or extend existing compliance endpoint
- `components/admin/layout/AdminSidebar.tsx` — Add CDR Compliance nav item

**Purpose:** Central dashboard for monitoring CDR compliance status.

**What to display:**

### 6a. Consent Status Overview
- Total active consents (from `PortalClient.consentStatus = 'GRANTED'`)
- Consents expiring in next 30 days
- Revoked consents (last 90 days)
- Expired consents (last 90 days)

### 6b. CDR Data Audit Trail
- Recent CDR data access events (from `AuditLog` where action involves CDR data)
- CDR data deletion events (`CDR_DATA_DELETED` audit entries)
- Failed access attempts on CDR data routes

### 6c. Compliance Checklist Status
- Extend existing compliance check from `/api/admin/audit/compliance`
- Show: auth logging ✅, CDR metadata sanitization ✅, RBAC enforcement status, MFA enforcement status
- Red/amber/green indicators for each Basiq requirement category

### 6d. GCP Service Health
- Status of required GCP services (Cloud Armor, KMS, Logging, etc.)
- Pull from GCP APIs where possible (Cloud Monitoring health checks)

**GCP-First approach:**
- Consent data: Database query (this is app-specific data)
- Audit trail: Database query → consider migrating to Cloud Logging for retention
- GCP service status: Query via GCP Admin SDK / Cloud Monitoring API

---

## STEP 7: Security Monitoring Panel (NEW)

**Priority:** High (CDR requirement)
**Files to create/modify:**
- `app/admin/security/page.tsx` — NEW page
- `app/api/admin/security/route.ts` — NEW endpoint
- `components/admin/layout/AdminSidebar.tsx` — Add Security nav item

**Purpose:** Monitor security events, failed auth attempts, rate limiting.

**What to display:**

### 7a. Authentication Events
- Login attempts (success/failure) from `AuditLog`
- MFA challenge results
- Account lockouts (current and recent)
- **GCP-First:** Pull Firebase Auth events from GCP Cloud Logging if enabled

### 7b. Rate Limiting Events
- `RATE_LIMIT_HIT` events from `AuditLog`
- Top IPs hitting rate limits
- Blocked requests

### 7c. Access Violations
- `UNAUTHORIZED_ACCESS` events
- `FORBIDDEN_ACCESS` events
- Routes with most auth failures

### 7d. Active Sessions
- Currently active admin sessions from `AdminSession` table
- Active user sessions (from token activity in `AuditLog`)

**GCP-First approach:**
- Firebase Auth events → Cloud Logging → query via Cloud Logging API
- Rate limiting → Current `AuditLog` queries (adequate for now)
- Active sessions → Database query

---

## STEP 8: Admin User Management (Settings Page)

**Priority:** Medium
**Files to modify:**
- `app/admin/settings/page.tsx` — Add admin user management section
- `app/api/admin/users/admins/route.ts` — NEW: CRUD for admin users

**Purpose:** Manage admin accounts from within the portal.

**What to implement:**
1. List all admin users with role, status, last login
2. Create new admin user (SUPER_ADMIN only)
3. Change admin role
4. Deactivate/reactivate admin accounts
5. Force password reset
6. View admin activity log
7. 90-day inactivity flagging (CDR §1.7)

**Permission:** Only `SUPER_ADMIN` can manage other admins.

---

## STEP 9: Support Tools Page

**Priority:** Medium
**Files to create/modify:**
- `app/admin/support/page.tsx` — Implement support tools
- `app/api/admin/users/[id]/impersonate/route.ts` — Verify impersonation endpoint

**What to implement:**
1. User lookup by email/ID
2. View user's subscription, login history, recent actions
3. Impersonation (with audit trail)
4. Error log viewer for specific user
5. Account unlock tool

**CDR Protection:** Never display raw CDR data (account numbers, balances, BSBs) in support view. Use `sanitizeCdrMetadata()` pattern.

---

## STEP 10: GCP Integration Layer

**Priority:** Medium (enables future GCP-First features)
**Files to create:**
- `lib/admin/services/gcpIntegration.ts` — NEW: GCP API client for admin portal

**Purpose:** Centralized service for fetching data from GCP managed services.

**Functions to implement:**

### 10a. Cloud Logging Queries
```typescript
// Query Firebase Auth events from Cloud Logging
async function getAuthEvents(timeRange: DateRange): Promise<AuthEvent[]>

// Query application errors from Cloud Logging
async function getErrorEvents(timeRange: DateRange): Promise<ErrorEvent[]>
```

### 10b. Cloud Monitoring Metrics
```typescript
// Get uptime check results
async function getUptimeStatus(): Promise<UptimeCheck[]>

// Get error rate metrics
async function getErrorRateMetrics(timeRange: DateRange): Promise<MetricData>
```

### 10c. Firebase Admin SDK
```typescript
// List Firebase Auth users (for reconciliation)
async function listFirebaseUsers(pageToken?: string): Promise<FirebaseUserList>

// Get user's Firebase auth status
async function getFirebaseUser(uid: string): Promise<FirebaseUserRecord>
```

**Dependencies:** Requires GCP service accounts and appropriate IAM roles.
**Environment variables needed:**
- `GOOGLE_APPLICATION_CREDENTIALS` or `GCP_SERVICE_ACCOUNT_KEY`
- `GCP_PROJECT_ID`
- `GCP_LOG_BUCKET` (for Cloud Logging)

---

## STEP 11: Audit Logs Enhancement

**Priority:** Medium
**Files to modify:**
- `app/admin/audit-logs/page.tsx` — Already exists, enhance with:

**Enhancements:**
1. **GCP Cloud Logging integration** — Show both local audit logs AND GCP Cloud Logging events in a unified view
2. **Real-time streaming** — Consider WebSocket or polling for live audit feed
3. **Advanced filtering** — Filter by user, action category, IP address, time range
4. **Anomaly highlighting** — Flag unusual patterns (e.g., bulk delete operations, late-night access)
5. **Export improvements** — JSON export in addition to CSV

**GCP-First:** If Cloud Logging is enabled, prefer querying it over local database for historical logs (better retention, search, and alerting).

---

## STEP 12: Navigation & Layout Updates

**Priority:** Low (do alongside other steps)
**Files to modify:**
- `components/admin/layout/AdminSidebar.tsx` — Add new nav items

**New sidebar items to add:**
```
Dashboard        ← exists
Organizations    ← exists
Users            ← exists
Billing          ← exists
Analytics        ← exists
Feature Flags    ← exists
CDR Compliance   ← NEW (Step 6)
Security         ← NEW (Step 7)
Audit Logs       ← exists
Support Tools    ← exists
Settings         ← exists (enhance in Step 8)
```

**Feature flag gating:** Each new page should be gated by the appropriate `ADMIN_*` feature flag.

---

## Execution Sequence

```
STEP 1: Organizations (mock → real)  ─── Quick win, real data
STEP 2: Users (mock → real)          ─── Quick win, real data
STEP 3: Billing (mock → real)        ─── Quick win, real data
STEP 4: Analytics (mock → real)      ─── Requires query design
STEP 5: Feature Flags (mock → real)  ─── Quick win

STEP 6: CDR Compliance Dashboard     ─── NEW page, CDR requirement
STEP 7: Security Monitoring Panel    ─── NEW page, CDR requirement
STEP 8: Admin User Management        ─── Settings page enhancement
STEP 9: Support Tools                ─── Feature completion

STEP 10: GCP Integration Layer       ─── Enables GCP-First for all above
STEP 11: Audit Logs Enhancement      ─── Polish, GCP integration
STEP 12: Navigation Updates          ─── Do alongside other steps
```

**Dependencies:**
- Steps 1-5 are independent (can run in any order)
- Step 6 depends on CDR Data Lifecycle Service (see `CDR_IMPLEMENTATION_PLAN.md` Phase D)
- Step 7 is independent
- Step 10 is independent but enhances Steps 6, 7, 11
- Step 12 should be done incrementally as new pages are added

---

## Key API Routes Reference

| Route | Method | Auth | Permission | Status |
|-------|--------|------|------------|--------|
| `/api/admin/dashboard` | GET | `verifyAdminAuth` | Any role | ✅ Real data |
| `/api/admin/organizations` | GET | `verifyAdminAuth` | `organizations:list` | ✅ Built, needs page wiring |
| `/api/admin/organizations/[id]` | GET | `verifyAdminAuth` | `organizations:view` | ✅ Built |
| `/api/admin/users` | GET | `verifyAdminAuth` | `users:list` | ✅ Built, needs page wiring |
| `/api/admin/users/[id]` | GET | `verifyAdminAuth` | `users:view` | ✅ Built |
| `/api/admin/billing/overview` | GET | `verifyAdminAuth` | `billing:view` | ✅ Built, needs page wiring |
| `/api/admin/billing/transactions` | GET | `verifyAdminAuth` | `billing:view` | ✅ Built, needs page wiring |
| `/api/admin/billing/subscriptions` | GET | `verifyAdminAuth` | `billing:view` | ✅ Built |
| `/api/admin/analytics/growth` | GET | `verifyAdminAuth` | `analytics:view` | ⚠️ May need implementation |
| `/api/admin/analytics/feature-usage` | GET | `verifyAdminAuth` | `analytics:view` | ⚠️ May need implementation |
| `/api/admin/analytics/active-users` | GET | `verifyAdminAuth` | `analytics:view` | ⚠️ May need implementation |
| `/api/admin/feature-flags` | GET/POST | `verifyAdminAuth` | `featureFlags:manage` | ✅ Built |
| `/api/admin/feature-flags/[id]` | PUT/DELETE | `verifyAdminAuth` | `featureFlags:manage` | ✅ Built |
| `/api/admin/audit` | GET | `verifyAdminAuth` | `audit:view` | ✅ Real data |
| `/api/admin/audit/export` | GET | `verifyAdminAuth` | `audit:export` | ✅ Real data |
| `/api/admin/audit/compliance` | GET | `verifyAdminAuth` | `audit:view` | ✅ Real data |
| `/api/admin/cdr/compliance` | GET | `verifyAdminAuth` | `audit:view` | 🔲 NEW (Step 6) |
| `/api/admin/security` | GET | `verifyAdminAuth` | `audit:view` | 🔲 NEW (Step 7) |

---

## Database Models for Admin Portal

All admin models are already defined in `prisma/schema.prisma`:

| Model | Purpose | Fields (key) |
|-------|---------|-------------|
| `AdminUser` | Admin accounts | email, name, role, passwordHash, mfaEnabled, lastLoginAt, isActive |
| `AdminSession` | Login sessions | tokenHash, expiresAt, isRevoked, ipAddress, lastActivityAt |
| `AdminAuditLog` | Admin actions | action, category, targetType, targetId, metadata, timestamp |
| `ImpersonationSession` | User impersonation | targetUserId, reason, actionsPerformed, startedAt/endedAt |
| `GlobalFeatureFlag` | Feature toggles | key, name, enabled, enabledForPercent, enabledForTiers |
| `FeatureFlagOverride` | Per-user/org overrides | targetType, targetId, enabled, reason, expiresAt |
| `UserSubscription` | User billing | tier, status, stripeCustomerId, currentPeriodStart/End |
| `OrganizationLicense` | Org billing | tier, status, clientLimit, staffLimit |
| `BillingTransaction` | Revenue tracking | type, amount, currency, status, stripePaymentId |

---

## GCP-First Decision Matrix for Admin Portal

| Data Need | Use Database | Use GCP Service | Recommendation |
|-----------|-------------|----------------|----------------|
| Admin sessions | ✅ `AdminSession` | — | Database (admin-specific data) |
| Admin audit trail | ✅ `AdminAuditLog` | Cloud Logging (backup) | Database primary, Cloud Logging for retention |
| User list/search | ✅ `User` table | Firebase Admin SDK (reconcile) | Database primary |
| Auth events (login/MFA) | ✅ `AuditLog` | Firebase Auth + Cloud Logging | Both — Firebase for real-time, DB for search |
| Error tracking | ❌ Not collected | Cloud Error Reporting ✅ | **GCP service** — enable Error Reporting |
| Uptime monitoring | ❌ Not collected | Cloud Monitoring ✅ | **GCP service** — enable uptime checks |
| Revenue metrics | ✅ `BillingTransaction` | — | Database (app-specific data) |
| Feature usage | ✅ `AuditLog` analysis | BigQuery (future) | Database for now, BigQuery when scale demands |
| CDR compliance | ✅ `PortalClient` consent | — | Database (app-specific data) |
| Infrastructure health | ❌ Not collected | Cloud Monitoring ✅ | **GCP service** — enable Cloud Monitoring |

---

## Verification Checklist (After All Steps)

- [ ] All admin pages show real data (zero mock arrays)
- [ ] All admin API routes use `verifyAdminAuth()` + `hasPermission()`
- [ ] CDR Compliance dashboard shows consent status and audit trail
- [ ] Security monitoring panel shows auth events and rate limiting
- [ ] Admin user management supports CRUD with audit logging
- [ ] Feature flags page integrates with API for real-time toggles
- [ ] GCP integration layer provides Cloud Logging + Monitoring data
- [ ] All new pages are feature-flag gated
- [ ] CDR data is NEVER displayed raw in admin portal
- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Documentation updated (Phase 33, Master Blueprint, Changelog)

---

*Last Updated: 2026-03-03*
*Reference: PHASE_33_ADMIN_PORTAL.md, CDR_IMPLEMENTATION_PLAN.md*
