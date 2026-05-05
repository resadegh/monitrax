# IAM and Permissions Operations Guide

## Overview

Monitrax implements a Role-Based Access Control (RBAC) system with 4 roles and approximately 50 granular permissions. Permissions are enforced at the API boundary using auth guard middleware.

---

## User Roles

### Role Hierarchy

```
OWNER (full control)
  └── ADMIN (manage users, settings, all data)
        └── CONTRIBUTOR (create, edit, delete own data)
              └── VIEWER (read-only access)
```

### Role Capabilities

| Capability | OWNER | ADMIN | CONTRIBUTOR | VIEWER |
|------------|:-----:|:-----:|:-----------:|:------:|
| View all data | Yes | Yes | Own only | Own only |
| Create entities (properties, loans, etc.) | Yes | Yes | Yes | No |
| Edit entities | Yes | Yes | Own only | No |
| Delete entities | Yes | Yes | Own only | No |
| View financial snapshots | Yes | Yes | Yes | Yes |
| Manage users | Yes | Yes | No | No |
| Change user roles | Yes | Yes (not OWNER) | No | No |
| Org settings | Yes | Yes | No | No |
| Enforce MFA | Yes | Yes | No | No |
| CDR consent management | Yes | Yes | No | No |
| View audit logs | Yes | Yes | No | No |
| Delete org / transfer ownership | Yes | No | No | No |
| Billing management | Yes | No | No | No |

### Default Role

New users are assigned the **VIEWER** role on auto-provision. An OWNER or ADMIN must upgrade their role.

---

## Permission System

### How Permissions Are Checked

Permissions are enforced via auth guard functions in API route handlers:

| Guard | Purpose | Example |
|-------|---------|---------|
| `withPermission(req, 'entity.read')` | Requires a single permission | Read a property |
| `withAllPermissions(req, ['entity.read', 'entity.write'])` | Requires ALL listed permissions | Edit with read verification |
| `withAnyPermission(req, ['admin.users', 'org.settings'])` | Requires at least ONE permission | Admin-level pages |
| `withOwnerOnly(req)` | Requires OWNER role | Org deletion, ownership transfer |
| `withMFARequired(req)` | Requires completed MFA | CDR data, admin routes |
| `withActiveConsent(req)` | Requires active CDR consent | CDR data access |

### Permission Naming Convention

```
{domain}.{action}

Examples:
  property.read
  property.write
  property.delete
  loan.read
  loan.write
  cdr_data.read
  cdr_data.write
  cdr_data.delete
  entity.read         # Phase 41a — LegalEntity (Entity Layer) management
  entity.write
  entity.delete
  tax_data.read       # Phase 41e.0 — entity-aware tax dispatch endpoints
  tax_data.write      # Mirrors report.read audience for read; CONTRIBUTOR+ for write
  admin.users
  admin.audit_log
  org.settings
  org.billing
```

**Phase 41e tax-data permissions** — `tax_data.read` gates per-entity tax position queries (`/api/tax/entity/[id]`, `/api/tax/master-position`, `/api/tax/config` — endpoints landing in 41e.0 slice D). `tax_data.write` gates computational mutations like trust-distribution composition and CGT-disposal calc (when 41e.4 / 41e.1 ship them). These permissions gate **route access**; CDR sanitisation rules of CLAUDE.md §13.3 still govern CDR-content visibility. See `lib/auth/permissions.ts` for the canonical role mapping.

### Permission Check Flow

```
1. Request hits API route
2. Auth guard extracts token from Authorization header
3. gcpTokenVerifier.ts validates JWT, extracts Firebase UID
4. User record loaded from database (with role)
5. Role mapped to permission set
6. Required permission checked against user's permission set
7. If permitted: request proceeds
8. If denied: 403 Forbidden returned
9. If no valid token: 401 Unauthorized returned
```

---

## GCP IAM Roles

These GCP IAM roles are required for infrastructure operations:

| GCP Role | Who Needs It | Purpose |
|----------|-------------|---------|
| `roles/cloudsql.admin` | DevOps, DBA | Manage Cloud SQL instances |
| `roles/cloudsql.client` | Application service account | Connect to Cloud SQL |
| `roles/cloudsql.viewer` | Monitoring service account | View instance metrics |
| `roles/iam.serviceAccountUser` | Deployment service account | Deploy Cloud Run services |
| `roles/run.admin` | DevOps | Manage Cloud Run services |
| `roles/logging.viewer` | On-call engineers | Read Cloud Logging |
| `roles/monitoring.viewer` | On-call engineers | Read Cloud Monitoring |
| `roles/secretmanager.secretAccessor` | Application service account | Access secrets |
| `roles/storage.objectViewer` | Application service account | Read GCS buckets |

**Principle of least privilege:** Only grant the minimum IAM roles needed. Review quarterly.

---

## Changing a User's Role

### Via Application (OWNER or ADMIN)

1. Navigate to Settings > Team Management
2. Find the user in the member list
3. Select the new role from the dropdown
4. Confirm the change

**Constraints:**
- Only OWNER can promote someone to ADMIN
- Only OWNER can demote an ADMIN
- OWNER role cannot be assigned -- it must be transferred
- A user cannot change their own role

### Via Database (Emergency)

```sql
UPDATE "User"
SET role = 'ADMIN'
WHERE email = 'user@example.com';
```

**Use only when the application is inaccessible.** Document the change in the audit log manually.

### Audit Trail

Every role change is recorded in the AuditLog table:
- Action: `USER_ROLE_CHANGED`
- Metadata includes: old role, new role, changed by whom

---

## Rate Limiting

### Auth Endpoint Rate Limits

| Endpoint Pattern | Limit | Window | Action on Exceed |
|-----------------|-------|--------|-----------------|
| `/api/auth/*` | 10 requests | 1 minute | 429 Too Many Requests |
| `/api/mfa/*` | 5 requests | 1 minute | 429 Too Many Requests |
| All other API routes | 100 requests | 1 minute | 429 Too Many Requests |

### How Rate Limiting Works

- Implemented in `middleware.ts`
- Keyed by IP address (for unauthenticated requests) or user ID (for authenticated requests)
- Uses in-memory counters (resets on deployment)
- Returns `Retry-After` header with seconds until the limit resets

### Monitoring Rate Limits

- Check Cloud Logging for 429 responses
- Filter: `httpRequest.status = 429`
- High 429 rates may indicate abuse or a misconfigured client

---

## Account Lockout Policy

### Lockout Triggers

| Trigger | Threshold | Lockout Duration |
|---------|-----------|-----------------|
| Failed sign-in attempts | Managed by Firebase Auth | Temporary block (escalating) |
| Rate limit exceeded | See rate limits above | Until window resets |
| Manual lock by admin | Admin action | Until manually unlocked |
| Suspicious activity | Automated detection | Until reviewed |

### Firebase Auth Lockout

Firebase Auth handles brute-force protection automatically:
- After multiple failed attempts, Firebase temporarily blocks the IP/account
- This is not configurable -- it is a Firebase platform feature
- The block is temporary and auto-resolves

### Application-Level Lock

The `User` table has a `lockedUntil` field:
- If `lockedUntil` is set and in the future, the user cannot access the API
- Auth guards check this field during permission verification
- Returns 403 with message indicating the account is locked

### Unlocking an Account

**Via Application (ADMIN/OWNER):**
1. Settings > Team Management
2. Find the locked user
3. Select "Unlock Account"

**Via Database (Emergency):**
```sql
UPDATE "User"
SET "lockedUntil" = NULL
WHERE email = 'user@example.com';
```

### Audit Trail

Account lock/unlock events are recorded:
- Action: `USER_ACCOUNT_LOCKED` / `USER_ACCOUNT_UNLOCKED`
- Metadata includes: reason, locked by whom, duration

---

*Last Updated: 2026-04-09*
