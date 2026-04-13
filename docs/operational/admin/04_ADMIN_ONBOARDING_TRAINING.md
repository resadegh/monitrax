# Admin Onboarding & Training Guide

**Version:** 1.0
**Created:** 2026-04-12
**Audience:** New admins + Director (when hiring)
**Purpose:** Step-by-step setup and training for new Monitrax admin portal users

---

## 1. Overview

This guide walks through the complete process of onboarding a new admin to the Monitrax Admin Portal, from creating their Firebase Auth account to granting them the appropriate permissions.

### Admin Account Lifecycle

```
1. Create Firebase Auth user
   ↓
2. Set custom claims (monitraxAdmin + adminRole)
   ↓
3. Optional: Create AdminUser DB record (for legacy compatibility)
   ↓
4. Enable MFA (mandatory for SUPER_ADMIN / BILLING_ADMIN)
   ↓
5. Grant GCP IAM roles (if admin needs GCP Console access)
   ↓
6. First-login walkthrough
   ↓
7. Training on operational procedures
```

---

## 2. Prerequisites

Before onboarding a new admin, verify:

- [ ] You (the onboarding admin) have SUPER_ADMIN role
- [ ] The new admin has a work email address
- [ ] You have access to GCP Cloud Shell (for Firebase Admin SDK commands)
- [ ] You have access to GCP Console IAM (if granting GCP roles)
- [ ] The new admin has been approved by the Director

---

## 3. Step-by-Step Onboarding

### Step 1: Create Firebase Auth Account

Open **GCP Cloud Shell** (console.cloud.google.com → terminal icon top-right).

Ensure `firebase-admin` is installed:
```bash
mkdir -p /tmp/fb-admin && cd /tmp/fb-admin && npm init -y && npm install firebase-admin
```

Create the user (one-line command):
```bash
node -e "const admin = require('firebase-admin'); admin.initializeApp(); admin.auth().createUser({ email: 'NEW_ADMIN_EMAIL@monitrax.com.au', password: 'TemporaryPassword123!', displayName: 'Admin Name' }).then(u => { console.log('Created UID:', u.uid); process.exit(0); }).catch(e => { console.error('ERROR:', e.message); process.exit(1); });"
```

**Output**: Note the UID (e.g., `qbyyfhMW2gbWI7hQzC8zOJzckKl1`) — you'll need it for Step 2.

**Important**: The temporary password MUST be changed by the admin on first login. Email them securely (e.g., via signed message).

### Step 2: Set Admin Custom Claims

```bash
node -e "const admin = require('firebase-admin'); admin.initializeApp(); admin.auth().setCustomUserClaims('NEW_ADMIN_UID', { monitraxAdmin: true, adminRole: 'SUPER_ADMIN' }).then(() => { console.log('Claims set'); process.exit(0); }).catch(e => { console.error(e); process.exit(1); });"
```

Replace:
- `NEW_ADMIN_UID` with the UID from Step 1
- `SUPER_ADMIN` with the appropriate role: `SUPER_ADMIN` | `BILLING_ADMIN` | `SUPPORT_ADMIN` | `VIEWER`

**Verification**:
```bash
node -e "const admin = require('firebase-admin'); admin.initializeApp(); admin.auth().getUser('NEW_ADMIN_UID').then(u => { console.log('Claims:', u.customClaims); process.exit(0); });"
```

Expected output:
```
Claims: { monitraxAdmin: true, adminRole: 'SUPER_ADMIN' }
```

### Step 3 (Optional): Create AdminUser DB Record

For historical compatibility with the legacy AdminUser table, you can create a DB record:

1. **Admin Portal → Settings → Admin Users → Add Admin**
2. Fill in:
   - Email (must match Firebase Auth email exactly)
   - Name
   - Role (must match custom claim)
   - Active: true
3. Save

**Note**: This is a fallback path — the primary source of truth is the Firebase custom claim. The DB record is useful for audit log attribution and some legacy features.

### Step 4: Require MFA Enrollment

For SUPER_ADMIN and BILLING_ADMIN roles, MFA is **mandatory** per `withMFARequired()` guard.

1. Send the admin their login details with instructions:
   - URL: `https://www.monitrax.com.au/admin/login`
   - Email + temporary password
   - **On first login, they MUST**:
     1. Change password
     2. Enroll in MFA via main dashboard settings
2. Direct them to `/dashboard/settings/security-mfa` (main app) to enroll TOTP
3. Once enrolled, their admin portal access requires passing MFA challenge

**Note**: MFA is shared between main app + admin portal because both use GCP Identity Platform.

### Step 5: Grant GCP IAM Roles (if needed)

Most admins don't need direct GCP Console access — the admin portal surfaces everything they need. But for deep debugging or emergency operations, they may need:

| Admin Role | Recommended GCP Roles |
|-----------|----------------------|
| SUPER_ADMIN | `roles/iam.admin`, `roles/cloudsql.admin`, `roles/logging.admin`, `roles/monitoring.admin`, `roles/errorreporting.admin` |
| BILLING_ADMIN | `roles/billing.viewer` |
| SUPPORT_ADMIN | `roles/logging.viewer`, `roles/errorreporting.viewer`, `roles/cloudsql.viewer` |
| VIEWER | `roles/logging.viewer` |

**To grant**:
1. GCP Console → IAM → Grant Access
2. Principal: admin's email
3. Select roles
4. Save

### Step 6: First Login Walkthrough

Schedule a 30-minute walkthrough with the new admin. Cover:

#### Tour (10 min)
1. Navigate to `/admin/login` and log in
2. First-time password change
3. MFA enrollment via main dashboard (15 min break if needed)
4. Return to admin portal — verify MFA challenge works
5. Sidebar tour — walk through 5 sections
6. Dashboard overview — explain KPIs

#### Operational Basics (15 min)
1. How to look up a user (Users page)
2. How to view audit logs
3. How to use Support Tools
4. How to read CDR Compliance dashboard
5. Where to find GCP data (GCP Infrastructure section)

#### Documentation (5 min)
1. Point to `docs/operational/admin/` for all procedures
2. Emphasize Troubleshooting Runbook (`02_ADMIN_TROUBLESHOOTING_RUNBOOK.md`)
3. CDR procedures doc (`05_CDR_COMPLIANCE_PROCEDURES.md`)

---

## 4. Role-Specific Training

### SUPER_ADMIN

**Additional training**:
- Permission management (who can do what)
- Feature flag rollout strategy
- Cloud Scheduler job management
- User impersonation (when appropriate)
- Emergency procedures (account lockdown, session revocation)
- All CDR compliance procedures

**Reading list**:
- `docs/blueprint/PHASE_M_ADMIN_PORTAL_GCP_FIRST.md`
- `docs/policy/INCIDENT_RESPONSE_PLAN.md`
- `docs/compliance/CDR_IMPLEMENTATION_PLAN.md`

### BILLING_ADMIN

**Additional training**:
- Billing dashboard metrics (MRR, ARR, churn, ARPU, LTV)
- Processing refunds (with reason tracking)
- Subscription tier changes
- Failed payment retry workflow
- Stripe integration basics

**Reading list**:
- Billing section of `01_ADMIN_PORTAL_OPERATIONS.md`
- Stripe dashboard overview (external)

### SUPPORT_ADMIN

**Additional training**:
- User lookup workflow
- Reading audit logs for troubleshooting
- User impersonation (ethical guidelines)
- Error Tracking + Cloud Logging deep dives
- Escalation procedures

**Reading list**:
- Full `02_ADMIN_TROUBLESHOOTING_RUNBOOK.md`
- `03_GCP_SERVICE_OPERATIONS.md` (sections 4.1, 4.3)

### VIEWER

**Minimal training**:
- Read-only navigation
- Understanding of what each dashboard shows
- No write operations allowed

---

## 5. Admin User Deactivation

### When to Deactivate

- Admin leaves the company
- Security concerns (suspected compromise)
- Role change (demote to lower role)
- Extended leave (>30 days)

### Deactivation Procedure

1. **Revoke GCP API access**:
   ```bash
   # Remove custom claims
   node -e "const admin = require('firebase-admin'); admin.initializeApp(); admin.auth().setCustomUserClaims('UID', {}).then(() => console.log('Done'));"
   ```

2. **Disable Firebase Auth account**:
   ```bash
   node -e "const admin = require('firebase-admin'); admin.initializeApp(); admin.auth().updateUser('UID', { disabled: true }).then(() => console.log('Done'));"
   ```

3. **Revoke all active sessions**:
   ```bash
   node -e "const admin = require('firebase-admin'); admin.initializeApp(); admin.auth().revokeRefreshTokens('UID').then(() => console.log('Done'));"
   ```

4. **Deactivate AdminUser DB record** (if exists):
   - Admin Portal → Settings → Admin Users → Deactivate

5. **Revoke GCP IAM roles**:
   - GCP Console → IAM → remove principal

6. **Document in audit log**:
   - Add entry manually via admin portal or audit log API
   - Include reason, date, authorizing director

7. **Review admin's recent actions**:
   - Audit Logs → filter by their adminUserId
   - Look for any unusual or unauthorized actions

---

## 6. Regular Admin Account Reviews

### Quarterly Review Checklist

- [ ] List all admin accounts (Admin Portal → Settings → Admin Users)
- [ ] Verify each admin is still active and needed
- [ ] Check MFA enrollment status (should be 100% for SUPER_ADMIN/BILLING_ADMIN)
- [ ] Review last login dates — flag admins inactive for >90 days
- [ ] Verify custom claims match expected roles
- [ ] Review GCP IAM grants for accuracy

### 90-Day Inactivity Deactivation

Per Basiq §1.7 and Phase 34.5:

1. Admin Portal automatically flags admins inactive for >90 days
2. Settings → Admin Users → look for "Inactive" badge
3. Contact admin — if not responding, deactivate per procedure above
4. Audit the deactivation

---

## 7. Emergency Admin Provisioning

### Scenario: All SUPER_ADMIN accounts locked out

**Root cause**: Lost MFA device, forgot password, etc.

**Resolution** (requires Director):

1. Via Cloud Shell (has implicit admin access to the project):
   ```bash
   # Set custom claims on Director's email directly
   node -e "const admin = require('firebase-admin'); admin.initializeApp(); admin.auth().getUserByEmail('admin@monitrax.com.au').then(u => admin.auth().setCustomUserClaims(u.uid, { monitraxAdmin: true, adminRole: 'SUPER_ADMIN' })).then(() => console.log('Done'));"
   ```
2. Director can now log in and restore access
3. Audit the emergency provisioning

---

## 8. Compliance & Audit Trail

All admin account lifecycle events are logged:

| Event | Logged via |
|-------|-----------|
| Admin account created | Manual audit log entry |
| Claims granted/modified | Firebase Auth audit logs (Cloud Audit Logs) |
| First login | `AuditLog` (action: LOGIN) |
| Admin actions | `AuditLog` (all actions via withPermission) |
| Deactivation | Manual entry + Cloud Audit Logs |

Retention:
- PostgreSQL: Indefinite (for fast queries)
- Cloud Logging: 365 days (CDR compliance)

---

## 9. Security Best Practices

1. **Never share admin credentials** — each admin must have their own account
2. **Rotate passwords** every 90 days for privileged roles
3. **MFA is mandatory** for SUPER_ADMIN / BILLING_ADMIN
4. **Audit logs review** monthly by Director
5. **Principle of least privilege** — grant only the minimum role needed
6. **No admin impersonation without user consent** (and always audited)
7. **Never disable MFA** without emergency authorization
8. **Report security incidents immediately** (see INCIDENT_RESPONSE_PLAN.md)

---

## 10. Related Documents

- **01_ADMIN_PORTAL_OPERATIONS.md** — Day-to-day operations
- **02_ADMIN_TROUBLESHOOTING_RUNBOOK.md** — Common issues
- **03_GCP_SERVICE_OPERATIONS.md** — GCP Console deep dive
- **05_CDR_COMPLIANCE_PROCEDURES.md** — CDR-specific procedures
- **docs/policy/INCIDENT_RESPONSE_PLAN.md** — Security incident handling
- **docs/policy/SECURITY_AWARENESS_POLICY.md** — Security training policy

---

*Last Updated: 2026-04-12*
*Review Schedule: Annually or when hiring new admins*
