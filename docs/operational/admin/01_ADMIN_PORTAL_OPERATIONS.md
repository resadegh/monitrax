# Admin Portal Operations Guide

**Version:** 1.0
**Created:** 2026-04-12
**Audience:** Admin Portal support team
**Depends on:** `docs/blueprint/PHASE_M_ADMIN_PORTAL_GCP_FIRST.md`

---

## 1. Introduction

This guide covers the **day-to-day operations** of the Monitrax Admin Portal. It's the primary reference for support staff performing common administrative tasks.

### Admin Portal URL
- **Production**: `https://www.monitrax.com.au/admin/login`
- **Auth provider**: GCP Identity Platform (Firebase Auth)
- **Auth method**: Email/password, Google Sign-In, or MFA (TOTP/SMS)

### Required Access
Before using the admin portal, an admin must have:
1. A Firebase Auth account (can be created via Cloud Shell — see `04_ADMIN_ONBOARDING_TRAINING.md`)
2. Custom claims: `{ monitraxAdmin: true, adminRole: '<ROLE>' }`
3. **Or** an `AdminUser` record in the database (fallback during migration)

---

## 2. Admin Portal Navigation (GCP-Aligned)

The admin portal is organized into 5 sections:

| Section | Pages | Purpose |
|---------|-------|---------|
| **Overview** | Dashboard | Platform health + metrics |
| **Business Management** | Organizations, Users, Billing, Analytics, Feature Flags | Monitrax business operations |
| **GCP Infrastructure** | Uptime, Errors, Cloud Scheduler, Security Findings | Real-time GCP service status |
| **Compliance & Security** | CDR Compliance, Audit Logs, Security Monitoring | CDR + security oversight |
| **Operations** | Support Tools, Settings | User support + portal config |

**Key principle**: GCP pages read **live data from GCP APIs**. The admin portal never stores a copy — it's a thin control plane.

---

## 3. Common Operations

### 3.1 Managing Users

#### View user list
1. Navigate to **Users** in the sidebar
2. Search by email, name, or filter by tier/status
3. Click a user row to see details (accounts, properties, loans, subscription, activity)

#### Suspend a user
1. Find user in **Users** list
2. Click the user row
3. Click **Suspend** button
4. Enter reason for suspension
5. Confirm

**What happens**:
- User's `status` set to `SUSPENDED` in DB
- User cannot log in via Firebase Auth
- Action logged to `AuditLog` with reason
- User's active session tokens revoked

#### Reactivate a user
1. Same flow, click **Reactivate**
2. Provide reason

#### Change a user's subscription tier
1. User detail page → **Subscription** tab
2. Click **Change Tier**
3. Select new tier (FREE / BASIC / PRO / PREMIUM)
4. Confirm

Changes take effect immediately. Audit log records old → new tier.

#### Impersonate a user (support debugging)
**Requires**: `users:impersonate` permission (SUPER_ADMIN, SUPPORT_ADMIN)

1. Navigate to **Support Tools → User Impersonation**
2. Enter user email or ID
3. Provide reason (required — audited)
4. Click **Start Impersonation**
5. Max duration: 1 hour
6. All actions performed as the impersonated user are logged

**Important**: Never impersonate a user without their knowledge. Document the reason clearly.

### 3.2 Managing Organizations

#### View org list
1. **Organizations** in sidebar
2. Search by name or slug
3. Filter by plan / status

#### Update org license
1. Org detail page → **License** tab
2. Change tier (STARTER / PROFESSIONAL / BUSINESS / ENTERPRISE)
3. Optional: set custom limits (max clients, max staff)
4. Save

#### Suspend an organization
Same pattern as user suspension — cascades to all members.

### 3.3 Billing Operations

#### View revenue metrics
1. **Billing** in sidebar
2. See MRR, ARR, churn, ARPU, LTV
3. Charts show trends over time

#### Process a refund
1. **Billing → Transactions** tab
2. Find transaction
3. Click **Refund**
4. Enter amount and reason
5. Confirm

Refunds go through Stripe API. Audit log captures the action.

### 3.4 Feature Flag Management

#### Toggle a feature globally
1. **Feature Flags** in sidebar
2. Click flag to edit
3. Toggle `enabled`
4. Set percentage rollout if partial
5. Save

#### Add a per-user/org override
1. Flag detail page → **Overrides** tab
2. Click **Add Override**
3. Select target (user or org)
4. Set enabled state
5. Optional: expiration date

### 3.5 CDR Compliance Operations

#### Monitor CDR consent health
1. **CDR Compliance** in sidebar
2. Review:
   - Active consents
   - Expiring consents (next 30 days)
   - Recently revoked
   - Bank connections count
   - CDR complaints (open/resolved/escalated)
3. Click **Refresh** for latest data

#### Revoke a user's CDR consent on their behalf
Only via support ticket — requires explicit user authorization.

1. Use admin CDR consent API: `POST /api/admin/cdr/consent`
2. Body: `{ action: 'revoke_user_consent', userId: '<id>' }`
3. This triggers full CDR data deletion within 24 hours
4. Audited as admin action on behalf of user

#### Resolve a CDR complaint
1. **CDR Compliance → Complaints** (via admin API for now)
2. Add resolution text
3. Mark as RESOLVED or ESCALATE to OAIC

### 3.6 GCP Infrastructure Monitoring

#### Check uptime status
1. **Uptime & Alerts** in sidebar
2. Live data from Cloud Monitoring
3. Shows uptime checks, alert policies, success rate
4. Click **Open in GCP Console** for detailed metrics

#### View error reports
1. **Error Tracking** in sidebar
2. Shows grouped errors from GCP Error Reporting
3. Filter by time range (1h, 6h, 1d, 1w, 30d)
4. Click error to view in GCP Console

#### Manage scheduled jobs
1. **Cloud Scheduler** in sidebar
2. See all jobs (including `monitrax-cdr-lifecycle`)
3. Actions: **Pause**, **Resume**, **Run Now** (SUPER_ADMIN only)
4. Run Now: triggers job manually for testing

#### Check security findings
1. **Security Findings** in sidebar
2. Live data from Security Command Center
3. Severity breakdown: Critical / High / Medium / Low
4. Click finding to view in GCP Console

### 3.7 Audit Log Review

#### View recent audit entries
1. **Audit Logs** in sidebar
2. Filters: action, entity type, date range, user
3. Export to CSV

**Data source**: Dual-write to PostgreSQL + Cloud Logging (365-day retention).

#### Investigate a security event
1. Navigate to **Security Monitoring**
2. Review:
   - Auth failure rate
   - Rate limit hits
   - Access violations (401/403)
   - Active admin sessions
3. If suspicious activity: check Cloud Logging via GCP Console for deeper investigation

---

## 4. Support Operations Workflow

### Receiving a Support Request

1. User contacts support via email or in-app message
2. Capture:
   - User email/ID
   - Description of issue
   - Steps to reproduce
   - Any error messages/screenshots

### Investigating

1. **Admin Portal → Users** → look up user
2. Check:
   - Account status (active/suspended/locked)
   - Subscription tier + limits
   - Recent activity logs
   - Error reports (if related to crashes)
3. **Admin Portal → Support Tools** → recent activity across system
4. **Cloud Logging** (deeper investigation): click "Open in GCP Console" from Audit Logs page

### Resolving

| Issue Type | Action |
|-----------|--------|
| Can't log in | Check Firebase Auth user status; check lockout; reset password via Firebase |
| Data missing | Check audit logs; verify user hasn't accidentally deleted; restore if within retention |
| Billing issue | Billing tab → find transaction → refund if appropriate |
| Feature not working | Check feature flags for user's tier + overrides |
| CDR data concern | Navigate to CDR Compliance; consult `05_CDR_COMPLIANCE_PROCEDURES.md` |
| Bug / error | Check Error Tracking → view stack trace in GCP Console |

### Documentation

After resolving, document in the support ticket:
- Root cause
- Actions taken
- Resolution
- Follow-up required (if any)

---

## 5. Access Control & Permissions

### Admin Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| **SUPER_ADMIN** | Full access | All 60+ permissions |
| **BILLING_ADMIN** | Billing operations | Billing, read-only users/orgs |
| **SUPPORT_ADMIN** | User support | Users (read/update/suspend/impersonate), support tools, logs |
| **VIEWER** | Read-only | View-only access to orgs, users, billing, analytics |

### Permission Matrix

See `lib/admin/permissions.ts` for the canonical definitions.

### MFA Requirements

- **SUPER_ADMIN** and **BILLING_ADMIN**: MFA is **mandatory**
- **SUPPORT_ADMIN** and **VIEWER**: MFA **optional** but strongly recommended
- Enforced via `withMFARequired()` guard and Firebase `sign_in_second_factor` claim

---

## 6. Escalation

### When to escalate

- **Suspected data breach**: Follow `docs/policy/INCIDENT_RESPONSE_PLAN.md`
- **CDR compliance issue**: Escalate to Director + check `05_CDR_COMPLIANCE_PROCEDURES.md`
- **GCP service outage**: Check GCP Status Dashboard, notify Director
- **Unauthorized access detected**: Lock affected account + Director notification
- **Payment dispute > $1000**: Director approval required for refund

### Contacts

| Role | Contact |
|------|---------|
| Director | admin@monitrax.com.au |
| GCP Support | GCP Console → Support |
| Basiq Support | support@basiq.io |
| Firebase Support | Firebase Console → Help |

---

## 7. Related Documents

- **02_ADMIN_TROUBLESHOOTING_RUNBOOK.md** — Common issues and resolutions
- **03_GCP_SERVICE_OPERATIONS.md** — GCP Console navigation and deep diagnostics
- **04_ADMIN_ONBOARDING_TRAINING.md** — New admin onboarding
- **05_CDR_COMPLIANCE_PROCEDURES.md** — CDR-specific procedures
- **ADMIN_PORTAL_BAU_PLAYBOOK.md** — Daily/weekly/monthly BAU tasks

---

*Last Updated: 2026-04-12*
*Review Schedule: Quarterly*
