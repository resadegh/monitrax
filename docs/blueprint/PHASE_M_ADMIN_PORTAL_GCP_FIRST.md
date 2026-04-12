# Phase M: Admin Portal — GCP-First Architecture

**Version:** 1.0
**Created:** 2026-04-12
**Status:** PLANNED
**Depends On:** Phase E (GCP Service Enablement), Phase L (CDR Code-Level Remediation)
**Effort:** ~15-20 dev days across 4 sub-phases
**Source:** CDR Implementation Plan Phase M, CLAUDE.md §12.7 (GCP-First)

---

## 1. Vision & Design Principles

### The Core Rule

> **GCP is the single source of truth for identity, access, security, and observability.
> The Admin Portal is a thin UI layer that orchestrates GCP APIs — it never rebuilds
> capabilities that GCP provides as managed services.**

### Design Principles

| # | Principle | Description |
|---|-----------|-------------|
| 1 | **GCP Identity is the source of truth** | Admin users authenticate via GCP Identity Platform (Firebase Auth) with custom claims. No separate password tables. |
| 2 | **GCP APIs for user operations** | Suspend/disable users calls `admin.auth().updateUser()`. Session revocation calls `admin.auth().revokeRefreshTokens()`. |
| 3 | **GCP for observability** | Audit logs dual-write to Cloud Logging (7-year CDR retention). Admin reads from Cloud Logging API. |
| 4 | **GCP for security** | Vulnerability status from SCC API. Encryption from Cloud KMS API. WAF from Cloud Armor. |
| 5 | **No custom rebuilds** | If GCP provides it, the admin portal calls the GCP API or links to GCP Console. |
| 6 | **GCP IAM for infrastructure** | Admin roles map to GCP IAM roles. No direct database access from dev machines. |

---

## 2. Current State & Problems

### Admin Portal Status: BROKEN

The admin portal is deployed at `monitrax.com.au/admin/` but non-functional:
- **CDR Compliance page:** "No authentication token provided"
- **Security Monitoring page:** "No authentication token provided"
- **Feature Flags page:** "No authentication token provided"
- **Settings page:** "Failed to fetch audit logs", "No admin users found"
- **Support Tools page:** UI renders but API calls fail

### Root Cause

The admin portal uses a completely custom, parallel identity system:
- `AdminUser` table with SHA256 password hashing (not bcrypt)
- `AdminSession` table with custom 64-char hex token management
- Custom `admin_session` httpOnly cookie
- None of this connects to GCP Identity Platform

After the database migration to GCP Cloud SQL, the admin session/token system is not functioning.

### Why This Is a CDR Compliance Risk

| Issue | CDR Impact |
|-------|------------|
| Admin portal broken → no CDR compliance monitoring | §2.5 (log review) not operational |
| Custom admin auth bypasses GCP Identity Platform | Violates GCP-First (CLAUDE.md §12.7) |
| No MFA session verification for admin | §1.3 (MFA enforcement) gap for admin access |
| Audit logs only in PostgreSQL | §2.7 (90-day log retention) not guaranteed long-term |
| GCP service health shows "unknown" | Cannot demonstrate CDR security posture |

---

## 3. Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  GCP IDENTITY PLATFORM                   │
│            Firebase Auth + Custom Claims                 │
│  { monitraxAdmin: true, adminRole: 'SUPER_ADMIN' }      │
│  MFA enforced via sign_in_second_factor claim            │
└────────────────────────┬────────────────────────────────┘
                         │ Firebase ID Token (JWT)
                         │ Verified by verifyGCPIdToken()
┌────────────────────────▼────────────────────────────────┐
│                   ADMIN PORTAL UI                        │
│          Thin control plane for GCP services              │
│                                                          │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌──────────────┐  │
│  │ Business │ │ CDR      │ │ GCP    │ │ GCP          │  │
│  │ Ops      │ │ Consent  │ │ Audit  │ │ Security     │  │
│  │ (Custom) │ │ Mgmt     │ │ Viewer │ │ Status       │  │
│  └────┬─────┘ └────┬─────┘ └───┬────┘ └──────┬───────┘  │
└───────┼─────────────┼───────────┼─────────────┼──────────┘
        │             │           │             │
        ▼             ▼           ▼             ▼
 ┌────────────┐ ┌──────────┐ ┌─────────┐ ┌──────────────┐
 │ Cloud SQL  │ │ CDR      │ │ Cloud   │ │ SCC + KMS +  │
 │ PostgreSQL │ │ Lifecycle│ │ Logging │ │ Cloud        │
 │            │ │ Service  │ │ API     │ │ Monitoring   │
 │ • Billing  │ │          │ │         │ │ APIs         │
 │ • Flags    │ │ • Delete │ │ • 7yr   │ │              │
 │ • Licenses │ │ • Anon   │ │ • Search│ │ • Findings   │
 │ • Orgs     │ │ • Revoke │ │ • Alert │ │ • Key status │
 └────────────┘ └──────────┘ └─────────┘ └──────────────┘
```

---

## 4. What Stays Custom vs What Moves to GCP

### Custom (Monitrax Business Logic — GCP Has No Equivalent)

| Capability | Reason |
|------------|--------|
| Billing & Subscriptions | Stripe integration, tier pricing, MRR/ARR |
| Organization License Management | Multi-tenant business logic |
| Feature Flag System | App-specific rollout control |
| CDR Consent Aggregation | Monitrax CDR-specific metrics from CDRConsent model |
| User Impersonation | Support debugging tool (audited) |
| CDR Complaint Tracking | CDR compliance record-keeping |

### Moves to GCP (Managed Services Replace Custom Code)

| Current Custom Code | GCP Replacement | API |
|---------------------|-----------------|-----|
| `AdminUser` table + SHA256 passwords | GCP Identity Platform with custom claims | Firebase Admin SDK |
| `AdminSession` table + custom tokens | Firebase ID tokens | `verifyGCPIdToken()` |
| Custom account lockout | `admin.auth().updateUser(uid, { disabled: true })` | Identity Platform API |
| Custom session revocation | `admin.auth().revokeRefreshTokens(uid)` | Identity Platform API |
| MFA check = DB flag | Firebase `sign_in_second_factor` claim | Token verification |
| Audit logs in PostgreSQL only | Dual-write: PostgreSQL + Cloud Logging | Cloud Logging API |
| Custom anomaly detection | Cloud Monitoring alert policies | Monitoring API |
| Custom error tracking | GCP Error Reporting | Error Reporting API |
| "GCP health: unknown" | Real GCP API calls | SCC, Monitoring, KMS APIs |
| Custom log retention | Cloud Logging retention policies | Logging API |

---

## 5. GCP IAM Role Mapping

### Admin Portal Roles → GCP IAM Roles

| Admin Portal Role | Firebase Custom Claim | GCP IAM Roles | Purpose |
|-------------------|----------------------|---------------|---------|
| **SUPER_ADMIN** | `{ monitraxAdmin: true, adminRole: 'SUPER_ADMIN' }` | `roles/iam.admin`, `roles/cloudsql.admin`, `roles/logging.admin`, `roles/monitoring.admin`, `roles/cloudkms.admin` | Full platform + infrastructure control |
| **BILLING_ADMIN** | `{ monitraxAdmin: true, adminRole: 'BILLING_ADMIN' }` | `roles/logging.viewer`, `roles/monitoring.viewer` | Financial ops + read-only infra |
| **SUPPORT_ADMIN** | `{ monitraxAdmin: true, adminRole: 'SUPPORT_ADMIN' }` | `roles/logging.viewer`, `roles/cloudsql.viewer` | User support + log review |
| **VIEWER** | `{ monitraxAdmin: true, adminRole: 'VIEWER' }` | `roles/logging.viewer` | Read-only access |

### GCP IAM Enforcement

- Production database accessible **only** via GCP Console/IAM — no direct SSH/tunnel from dev machines
- Cloud SQL connections require IAM database authentication
- Secrets managed via GCP Secret Manager (not `.env` files in production)
- All GCP resource access logged via Cloud Audit Logs

---

## 6. Admin Auth Flow — Before vs After

### Before (Current — BROKEN)

```
Admin → Email/Password → Custom SHA256 check → AdminUser table
  → Custom 64-char hex token → AdminSession table → admin_session cookie
  → verifyAdminAuth() checks custom session token
  → BROKEN after Cloud SQL migration
```

### After (GCP-First)

```
Admin → Firebase Auth (email/password + MFA) → GCP Identity Platform
  → Firebase ID Token (JWT, signed by Google, 1-hour expiry)
  → verifyGCPIdToken() (same as user auth — already implemented)
  → Check custom claim: token.monitraxAdmin === true
  → Check admin role: token.adminRole (SUPER_ADMIN|BILLING_ADMIN|etc.)
  → Proceed with admin API request
```

### Key Benefits

1. **Single identity provider** — No separate admin identity system to maintain
2. **MFA built-in** — Firebase MFA with `sign_in_second_factor` claim verification
3. **OAuth support** — Admins can use Google SSO (tied to company Google Workspace)
4. **Token rotation** — Firebase handles token refresh automatically
5. **Session management** — Revoke via `revokeRefreshTokens()` (server-side)
6. **Audit trail** — Firebase logs all auth events to Cloud Audit Logs

---

## 7. Implementation Sequence

```
Phase M.1 (Admin Auth) ────────────────────────┐
  M.1.1 Set Firebase custom claims              │
  M.1.2 Create verifyAdminGCPAuth() guard       │
  M.1.3 Migrate admin login to Firebase         │
  M.1.4 Migrate admin API routes                │
  M.1.5 User disable via GCP API               │
  M.1.6 Session revocation via GCP API          │
  M.1.7 Deprecate custom AdminUser auth         │
  M.1.8 Fix broken admin portal                 │
                                                │
Phase M.2 (Observability) ← depends on E ──────┤
  M.2.1 Audit log dual-write to Cloud Logging   │
  M.2.2 Admin audit page → Cloud Logging API    │
  M.2.3 CDR dashboard → real GCP health data    │
  M.2.4 Security page → Cloud Monitoring API    │
  M.2.5 Error page → Error Reporting API        │
                                                │
Phase M.3 (Security) ← depends on E ───────────┤
  M.3.1 SCC findings integration                │
  M.3.2 Cloud KMS key status                    │
  M.3.3 Cloud Armor WAF status                  │
  M.3.4 GCP IAM role documentation              │
                                                │
Phase M.4 (CDR Consent Admin) ← depends on L ──┘
  M.4.1 Real consent metrics from CDRConsent
  M.4.2 Admin consent management actions
  M.4.3 CDR complaint management UI
```

---

## 8. Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Firebase Admin SDK adds dependency | Medium | SDK is official, well-maintained, required for Identity Platform |
| Admin users lose existing sessions | Low | Expected — old sessions won't work after migration |
| GCP API rate limits | Low | Admin portal has low traffic; well within free tier |
| Cloud Logging costs | Low | Free tier: 50GB/month; admin logs are small |
| SCC Standard tier limitations | Low | Free for GCP projects; covers Web Security Scanner |

---

## 9. Success Criteria

| Criteria | Verification |
|----------|-------------|
| Admin login works via Firebase Auth | Admin can sign in and access all pages |
| MFA enforced for admin sessions | `sign_in_second_factor` verified on admin routes |
| User suspend calls GCP Identity Platform | `admin.auth().updateUser()` called, user cannot log in |
| Audit logs written to Cloud Logging | `gcloud logging read` returns admin audit entries |
| CDR compliance shows real GCP health | SCC, Monitoring, KMS status no longer "unknown" |
| No custom admin password hashing | Zero references to SHA256 admin password logic |
| Admin portal fully functional | All pages load data — no "token not provided" errors |

---

---

## 10. Post-Implementation: Operational & BAU Support Documentation

**After Phase M implementation is complete**, the following operational documents MUST be created to enable admin portal support team training and ongoing BAU (Business As Usual) operations:

### Required Documents

| Document | Path | Purpose |
|----------|------|---------|
| Admin Portal Operations Guide | `docs/operational/admin/01_ADMIN_PORTAL_OPERATIONS.md` | Step-by-step procedures for all admin operations: user management, org management, billing, consent management, CDR compliance monitoring |
| Admin Portal Troubleshooting Runbook | `docs/operational/admin/02_ADMIN_TROUBLESHOOTING_RUNBOOK.md` | Common issues, error codes, resolution steps, escalation procedures |
| GCP Service Operations for Admins | `docs/operational/admin/03_GCP_SERVICE_OPERATIONS.md` | How admin portal interacts with GCP services (Identity Platform, Cloud Logging, Monitoring, SCC), how to navigate GCP Console for deeper investigation |
| Admin Onboarding & Training Guide | `docs/operational/admin/04_ADMIN_ONBOARDING_TRAINING.md` | New admin setup: Firebase Auth account creation, custom claims assignment, GCP IAM role provisioning, MFA enrollment, first-login walkthrough |
| CDR Compliance Admin Procedures | `docs/operational/admin/05_CDR_COMPLIANCE_PROCEDURES.md` | CDR-specific admin procedures: consent review, data deletion requests, complaint handling, OAIC escalation, breach notification via admin portal |
| Admin Portal BAU Support Playbook | `docs/bau-framework/ADMIN_PORTAL_BAU_PLAYBOOK.md` | Daily/weekly/monthly admin tasks, monitoring checklist, compliance verification procedures, incident response from admin perspective |

### Document Creation Timing

- Documents created **after** Phase M implementation is complete (not before — avoids documenting the old broken system)
- Each sub-phase (M.1-M.4) should update the relevant sections as features are implemented
- Final review and polish after all Phase M sub-phases are complete

---

*Last Updated: 2026-04-12*
*Status: PLANNED — awaiting Phase E completion for GCP service dependencies*
