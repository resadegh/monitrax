# GCP Service Operations for Admins

**Version:** 1.0
**Created:** 2026-04-12
**Audience:** Admin Portal support team
**Purpose:** How the admin portal interacts with GCP services, and how to navigate GCP Console for deeper investigation

---

## 1. GCP-First Architecture Overview

The Monitrax Admin Portal is a **thin control plane** that reads from and writes to GCP APIs. GCP is always the source of truth — the admin portal never stores a copy.

### When to Use Admin Portal vs GCP Console

| Task | Primary (Admin Portal) | Fallback (GCP Console) |
|------|----------------------|----------------------|
| View uptime checks | `/admin/uptime` | Cloud Monitoring → Uptime checks |
| Review errors | `/admin/errors` | Error Reporting |
| View security findings | `/admin/security-findings` | Security Command Center |
| Manage CDR lifecycle job | `/admin/scheduler` | Cloud Scheduler |
| Search audit logs | `/admin/audit-logs` | Logs Explorer |
| Deep log analysis | — | Logs Explorer (advanced queries) |
| Create new uptime check | — | Cloud Monitoring → Create Uptime Check |
| Modify alert policies | — | Cloud Monitoring → Alerting |
| Rotate encryption keys | — | Cloud KMS |
| View billing | — | Billing console |

**Rule**: If the admin portal has a page for it, use the admin portal first. GCP Console is for deep investigation, new resource creation, and fallback when admin portal is unavailable.

---

## 2. GCP Project Configuration

### Project Details

| Property | Value |
|----------|-------|
| **Project Name** | Monitrax |
| **Project ID** | `monitrax-479700` |
| **Project Number** | `87218209262` |
| **Organization** | `monitrax.com.au` (ID: `451282880218`) |
| **Region** | `australia-southeast1` (Sydney) |

### Key GCP Console URLs

- **GCP Console Home**: https://console.cloud.google.com/home/dashboard?project=monitrax-479700
- **IAM**: https://console.cloud.google.com/iam-admin/iam?project=monitrax-479700
- **Cloud Logging**: https://console.cloud.google.com/logs/query?project=monitrax-479700
- **Cloud Monitoring**: https://console.cloud.google.com/monitoring?project=monitrax-479700
- **Cloud Scheduler**: https://console.cloud.google.com/cloudscheduler?project=monitrax-479700
- **Error Reporting**: https://console.cloud.google.com/errors?project=monitrax-479700
- **Security Command Center**: https://console.cloud.google.com/security/command-center?project=monitrax-479700
- **Cloud SQL**: https://console.cloud.google.com/sql?project=monitrax-479700

---

## 3. Service Account: `monitrax-backend`

### Overview

All GCP API calls from the admin portal use the **`monitrax-backend`** service account. This account has cross-service permissions and is configured via the `GCS_SERVICE_ACCOUNT_KEY` env var on Vercel (base64-encoded JSON).

### Service Account Email
`monitrax-backend@monitrax-479700.iam.gserviceaccount.com`

### Required IAM Roles

**Project-level (on Monitrax project)**:
- `roles/storage.objectAdmin` — Cloud Storage (document storage)
- `roles/cloudsql.client` — Cloud SQL access
- `roles/logging.viewer` — Read Cloud Logging
- `roles/monitoring.viewer` — Read Cloud Monitoring
- `roles/errorreporting.viewer` — Read Error Reporting
- `roles/cloudscheduler.admin` — Manage Cloud Scheduler jobs
- `roles/firebaseauth.admin` — Firebase Auth user management

**Organization-level (on `monitrax.com.au` org)**:
- `roles/securitycenter.findingsViewer` — Read SCC findings

### How to Verify Service Account Roles

1. **GCP Console → IAM → IAM**
2. Filter by principal: `monitrax-backend@monitrax-479700.iam.gserviceaccount.com`
3. Expand to see all granted roles

### How to Add a Missing Role

1. **GCP Console → IAM**
2. Click **Grant Access** (or pencil icon on existing principal)
3. New principal: `monitrax-backend@monitrax-479700.iam.gserviceaccount.com`
4. Select role
5. Save

---

## 4. Service-by-Service Operations

### 4.1 Cloud Logging

**Purpose**: Centralized audit log storage with 365-day retention for CDR compliance.

**Admin Portal View**: `/admin/audit-logs/cloud-logging`

**Dual-write**: `createAuditLog()` writes to both PostgreSQL (fast queries) AND Cloud Logging (authoritative 365-day retention).

#### Navigating Cloud Logging in GCP Console

1. **Logs Explorer**: https://console.cloud.google.com/logs/query?project=monitrax-479700
2. To filter Monitrax audit logs:
   ```
   logName="projects/monitrax-479700/logs/monitrax-audit"
   ```
3. To filter by action:
   ```
   logName="projects/monitrax-479700/logs/monitrax-audit"
   labels.action="CDR_DATA_DELETED"
   ```
4. To filter by userId:
   ```
   logName="projects/monitrax-479700/logs/monitrax-audit"
   jsonPayload.userId="<user-id>"
   ```

#### Retention Policy

- **_Default** bucket: 365 days
- Admin Portal queries recent logs from PostgreSQL
- Historical queries (>90 days) go to Cloud Logging API

#### Log Sinks

Currently no custom sinks. To export to BigQuery or GCS for long-term archival:
1. GCP Console → Logging → Log Router
2. Create sink → select destination

### 4.2 Cloud Monitoring

**Purpose**: Uptime checks, alert policies, metrics.

**Admin Portal View**: `/admin/uptime`

#### Current Uptime Checks

| Check | URL | Frequency | Region |
|-------|-----|-----------|--------|
| Monitrax API Health Check | `https://www.monitrax.com.au/api/health` | 5 min | Multi-region |

#### Creating a New Uptime Check

Admin portal does not currently support creation — use GCP Console:

1. **GCP Console → Monitoring → Uptime checks → Create Uptime Check**
2. Target: HTTPS
3. Hostname: `www.monitrax.com.au`
4. Path: `/api/<endpoint>`
5. Check frequency: 5 minutes
6. Alert: enable email notifications

#### Viewing Alert Policies

1. **Admin Portal → Uptime & Alerts** (lists policies)
2. OR **GCP Console → Monitoring → Alerting**

#### Common Alert Policies to Create

- High error rate (>50 errors/5min)
- Auth failure spike (>20/5min)
- Database connection failures
- Uptime check failures

### 4.3 Error Reporting

**Purpose**: Automatic error grouping and deduplication.

**Admin Portal View**: `/admin/errors`

#### How It Works

- Cloud Logging entries with `severity=ERROR` and a stack trace are automatically imported
- Errors are grouped by stack trace signature
- Each group shows: count, affected users, first seen, last seen

#### Investigating an Error

1. Admin Portal → **Error Tracking**
2. Click error group
3. "Open in GCP Console" → view full stack traces + affected instances
4. Link to Cloud Logging entries that triggered the error

### 4.4 Security Command Center

**Purpose**: Vulnerability scanning, security findings.

**Admin Portal View**: `/admin/security-findings`

#### What SCC Monitors

Standard tier (free) includes:
- **Security Health Analytics** — Configuration vulnerabilities
- **Web Security Scanner** — Web app vulnerabilities
- **Event Threat Detection** — Runtime threats

#### Investigating a Finding

1. Admin Portal → **Security Findings**
2. Click finding → view in GCP Console
3. Review:
   - **Category** (e.g., `OPEN_FIREWALL`, `PUBLIC_BUCKET_ACL`)
   - **Severity** (Critical / High / Medium / Low)
   - **Resource** affected
   - **Recommendation** for remediation
4. Mark as RESOLVED in GCP Console after fixing

#### Common Findings

- `OPEN_FIREWALL` — Too-permissive firewall rule (fix in VPC)
- `PUBLIC_IP_ADDRESS` — Cloud SQL exposed to public internet
- `LOG_NOT_EXPORTED` — Missing log sinks

### 4.5 Cloud Scheduler

**Purpose**: Scheduled jobs (CDR lifecycle, retention, etc.)

**Admin Portal View**: `/admin/scheduler`

#### Current Jobs

| Job | Schedule | Endpoint | Purpose |
|-----|----------|----------|---------|
| `monitrax-cdr-lifecycle` | `0 2 * * *` (daily 02:00 Australia/Sydney (AEST/AEDT)) | `POST /api/cdr/lifecycle` | CDR consent expiry check + data cleanup |

#### Admin Portal Actions

From `/admin/scheduler`:
- **Pause** — temporarily disable a job (SUPER_ADMIN)
- **Resume** — re-enable a paused job
- **Run Now** — trigger immediate execution (for testing)

All actions are audited via `createAuditLog()`.

#### Creating a New Job

Admin portal does not support creation — use GCP Console:

1. **GCP Console → Cloud Scheduler → Create Job**
2. Set name, frequency (cron), target type (HTTP)
3. Set URL and Authorization header (use `CRON_SECRET` as Bearer token)
4. Save

### 4.6 Cloud SQL

**Purpose**: PostgreSQL database (main app + admin portal data store).

**Admin Portal View**: Not directly exposed — data access via Prisma ORM.

#### Database Details

| Property | Value |
|----------|-------|
| **Instance** | `monitrax-db-prod` |
| **Region** | `australia-southeast1` |
| **PostgreSQL Version** | 15 |
| **Backup** | Automated daily, 30-day retention |
| **Point-in-time recovery** | Enabled |

#### Direct DB Access (Emergency Only)

1. **GCP Console → SQL → monitrax-db-prod**
2. Click **Open Cloud SQL Studio** (web-based SQL client)
3. Auth via service account

**⚠️ Rule**: Never run destructive queries without Director approval. Always take a backup first.

### 4.7 Identity Platform (Firebase Auth)

**Purpose**: User + admin authentication.

**Admin Portal View**: Indirectly — admin user management actions eventually call Firebase Admin SDK.

#### Key Operations

**View all users**:
- Firebase Console → Authentication → Users
- Shows UID, email, provider (email/password, Google), creation date, last sign-in

**Disable a user**:
- Via admin portal (calls `admin.auth().updateUser(uid, { disabled: true })`)
- OR via Firebase Console directly

**Revoke all sessions for a user**:
- Via admin portal impersonation support (or Cloud Shell)
- `admin.auth().revokeRefreshTokens(uid)`

**Reset password**:
- Firebase Console → Users → click user → Reset Password
- Sends password reset email

**Set custom claims** (grant admin access):
- Only via Cloud Shell (Firebase Admin SDK) — see `04_ADMIN_ONBOARDING_TRAINING.md`

---

## 5. Deep Investigation Workflows

### Investigating a Login Failure

1. **Admin Portal → Audit Logs** → filter `action=LOGIN, status=FAILURE`
2. Note user email + timestamp
3. **GCP Console → Logs Explorer**:
   ```
   logName="projects/monitrax-479700/logs/monitrax-audit"
   jsonPayload.action="LOGIN"
   jsonPayload.status="FAILURE"
   timestamp>="<ISO date>"
   ```
4. Review stack trace in Error Reporting if available

### Investigating a Slow Request

1. **Admin Portal → Uptime & Alerts** → check latency metrics
2. **GCP Console → Monitoring → Dashboards** → Cloud SQL instance
3. Look for: CPU spike, high query latency, connection pool exhaustion
4. Cross-reference with Cloud Logging (slow query logs)

### Investigating a Data Access Violation

1. **Admin Portal → Security Monitoring** → see "Access Violations"
2. **Audit Logs** → filter `status=FAILURE, action=UNAUTHORIZED_ACCESS`
3. Check: user ID, endpoint accessed, IP address
4. If suspicious: check all recent activity from that user
5. If confirmed attack: disable user, rotate credentials

---

## 6. GCP Cost Monitoring

### Current Tier

- Cloud Logging: Free tier (50GB/month) — sufficient for current volume
- Cloud Monitoring: Free tier — sufficient
- Cloud Scheduler: 3 jobs free — we use 1
- Security Command Center: Standard tier (free)
- Cloud SQL: Billed (us-west1 instance)

### Monitoring Costs

1. **GCP Console → Billing → Reports**
2. Filter by service
3. Set up billing alerts: **Billing → Budgets & alerts**

Recommended budget alerts:
- Monthly spend > $200 → warning email
- Monthly spend > $500 → critical email to Director

---

## 7. Emergency GCP Operations

### Service Account Key Compromised

1. **Immediate**: GCP Console → IAM → Service Accounts → `monitrax-backend` → Keys → Delete compromised key
2. Create new key (if org policy permits) OR rotate via Workload Identity Federation
3. Update Vercel env var `GCS_SERVICE_ACCOUNT_KEY` with new value
4. Redeploy
5. Audit all GCP API calls from the compromised key period via Cloud Audit Logs

### Database Accidentally Modified

1. **Don't panic** — Cloud SQL has point-in-time recovery
2. **GCP Console → Cloud SQL → monitrax-db-prod → Backups**
3. Click **Restore to new instance** (never restore over prod)
4. Pick timestamp just before the bad change
5. Verify data in new instance
6. Coordinate with Director before any further action

### Cloud Scheduler Job Not Running

1. Check GCP Console → Cloud Scheduler → job
2. State should be ENABLED (not PAUSED, DISABLED, UPDATE_FAILED)
3. Check **Last attempt** — should be recent
4. If failing: click **Force run** to trigger immediately
5. Check target URL responds correctly (hit manually with correct Authorization)

---

## 8. Related Documents

- **01_ADMIN_PORTAL_OPERATIONS.md** — Day-to-day admin operations
- **02_ADMIN_TROUBLESHOOTING_RUNBOOK.md** — Common issues
- **04_ADMIN_ONBOARDING_TRAINING.md** — Onboarding + service account setup
- **05_CDR_COMPLIANCE_PROCEDURES.md** — CDR-specific GCP workflows

---

*Last Updated: 2026-04-12*
*Review Schedule: Quarterly*
