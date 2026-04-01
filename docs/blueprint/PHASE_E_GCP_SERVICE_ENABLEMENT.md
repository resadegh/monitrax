# Phase E: GCP Service Enablement — Step-by-Step Guide

**Version:** 1.0
**Created:** 2026-03-08
**Status:** Ready for Execution
**GCP Project:** `monitrax-479700`
**Estimated Time:** 3-4 hours total
**Basiq Requirements:** §3.2, §3.5, §5.7, §8.x
**Compliance Impact:** ~87% -> ~93% (+6%)

---

## Prerequisites

- GCP Console access: https://console.cloud.google.com
- Project: `monitrax-479700`
- Billing enabled on the project
- Owner or Editor IAM role on the project

---

## Step E.1 — Enable Security Command Center (P0)

**Basiq:** §3.5 (vulnerability testing), §8.9
**Effort:** 15 minutes
**Cost:** Free tier (Standard) available

### Instructions

1. Go to **GCP Console** > **Security** > **Security Command Center**
   - URL: `https://console.cloud.google.com/security/command-center/overview?project=monitrax-479700`

2. Click **Enable Security Command Center**

3. Select **Standard tier** (free — includes):
   - Security Health Analytics (misconfiguration detection)
   - Web Security Scanner (basic web app scanning)
   - Anomaly detection
   - GCP resource inventory

4. Configure notification:
   - Go to **Settings** > **Notifications**
   - Add email notification channel for CRITICAL and HIGH findings
   - Set recipient: your email address

5. Run initial scan:
   - Go to **Findings** tab
   - Wait for initial scan to complete (~30 minutes)
   - Review and address any CRITICAL findings

### Verification
- [x] Security Command Center enabled
- [x] Standard tier active
- [x] Email notifications configured
- [x] Initial scan completed
- [x] No CRITICAL findings unaddressed

---

## Step E.2 — Enable Cloud Audit Logs (P1)

**Basiq:** §2.1 (critical system events logged), §8.1
**Effort:** 15 minutes
**Cost:** Admin Activity logs = free; Data Access logs = pay per volume

### Instructions

1. Go to **GCP Console** > **IAM & Admin** > **Audit Logs**
   - URL: `https://console.cloud.google.com/iam-admin/audit?project=monitrax-479700`

2. Enable **Data Access audit logs** for these services:
   - **Cloud SQL** — log all database access
   - **Identity Platform** — log all auth events
   - **Cloud Storage** — log all file access
   - **Cloud KMS** (after E.5) — log all key operations

3. For each service:
   - Click the service name
   - Check **Admin Read**, **Data Read**, **Data Write**
   - Click **Save**

4. Verify logs are flowing:
   - Go to **Logging** > **Logs Explorer**
   - Filter: `logName="projects/monitrax-479700/logs/cloudaudit.googleapis.com%2Fdata_access"`
   - Confirm entries appear within 5-10 minutes

### Verification
- [x] Data Access logs enabled for Cloud SQL
- [x] Data Access logs enabled for Identity Platform
- [x] Data Access logs enabled for Cloud Storage
- [x] Logs visible in Logs Explorer

---

## Step E.3 — Enable Cloud Logging + Monitoring + Alerting (P1)

**Basiq:** §2.5 (log review), §2.7 (log retention >90 days), §8.6, §8.7
**Effort:** 45 minutes
**Cost:** 50 GB/month free ingestion; retention beyond 30 days has cost

### Part A: Cloud Logging Configuration

1. Go to **GCP Console** > **Logging** > **Logs Explorer**
   - URL: `https://console.cloud.google.com/logs?project=monitrax-479700`

2. **Set log retention** to 365 days (CDR requires >90 days):
   - Go to **Logging** > **Settings** > **Logs Storage**
   - Click **Edit** on the `_Default` bucket
   - Set **Retention period** to **365 days**
   - Click **Save**

3. **Create a log sink** for long-term CDR audit retention:
   - Go to **Logging** > **Log Router**
   - Click **Create Sink**
   - Name: `cdr-audit-logs`
   - Destination: Cloud Storage bucket (create `monitrax-audit-logs-archive`)
   - Filter: `resource.type="cloud_sql_database" OR resource.type="identitytoolkit.googleapis.com"`
   - Click **Create Sink**

### Part B: Cloud Monitoring Setup

4. Go to **GCP Console** > **Monitoring** > **Overview**
   - URL: `https://console.cloud.google.com/monitoring?project=monitrax-479700`

5. **Create uptime check:**
   - Go to **Monitoring** > **Uptime checks**
   - Click **Create Uptime Check**
   - Protocol: HTTPS
   - Resource type: URL
   - URL: Your production API health endpoint (e.g., `https://your-domain.com/api/health`)
   - Check frequency: 5 minutes
   - Regions: Select 3+ regions
   - Add alert: Notify on failure (2 consecutive failures)

6. **Create alert policies:**

   **Alert 1 — High Error Rate:**
   - Go to **Monitoring** > **Alerting** > **Create Policy**
   - Condition: Metric = `logging.googleapis.com/log_entry_count`
   - Filter: `severity="ERROR"`
   - Threshold: > 50 errors in 5 minutes
   - Notification: Email

   **Alert 2 — Identity Platform Auth Failures:**
   - Condition: Metric = `identitytoolkit.googleapis.com/user/sign_in_count`
   - Filter: `status="FAILURE"`
   - Threshold: > 20 failures in 5 minutes (possible brute-force)
   - Notification: Email

7. **Create monitoring dashboard:**
   - Go to **Monitoring** > **Dashboards** > **Create Dashboard**
   - Name: `Monitrax CDR Compliance`
   - Add widgets:
     - API error rate (last 24h)
     - Auth login success/failure rate
     - Cloud SQL connections
     - Uptime check status

### Verification
- [x] Log retention set to 365 days
- [x] Log sink created for CDR audit archive
- [x] Uptime check active
- [x] Error rate alert configured
- [x] Auth failure alert configured
- [x] Dashboard created

---

## Step E.4 — Enable Error Reporting (P1)

**Basiq:** §3.5 (vulnerability testing), §8.11
**Effort:** 10 minutes
**Cost:** Free

### Instructions

1. Go to **GCP Console** > **Error Reporting**
   - URL: `https://console.cloud.google.com/errors?project=monitrax-479700`

2. Error Reporting is auto-enabled when errors are logged to Cloud Logging

3. **Configure notification:**
   - Click **Settings** (gear icon)
   - Enable **Email notifications for new errors**
   - Set notification frequency: **Every new error** or **Daily digest**

4. If your app is on Render (not Cloud Run), you need to route errors to GCP:
   - Option A: Use the `@google-cloud/logging` npm package to send errors directly
   - Option B: Error Reporting will capture errors from Cloud Audit Logs automatically for GCP services (Identity Platform, Cloud SQL)

### Verification
- [x] Error Reporting accessible
- [x] Email notifications enabled
- [x] Test error visible (if applicable)

---

## Step E.5 — Enable Cloud KMS (CMEK) for CDR Data Encryption (P1)

**Basiq:** §5.7 (CDR data at rest encrypted), §8.5
**Effort:** 30 minutes
**Cost:** $0.06/key version/month + $0.03/10,000 operations

### Important Note

CMEK for Cloud SQL requires the database to be on **GCP Cloud SQL** (not Render PostgreSQL). If your database is on Render, this step documents the target architecture. When you migrate to Cloud SQL, apply CMEK at that time.

**If database is on Render (current):**
- Render PostgreSQL uses encryption at rest (managed by Render)
- Document this in the compliance response: "Database hosted on Render with encryption at rest enabled. CMEK will be applied when migrating to GCP Cloud SQL."
- Skip to Step E.6

**If/when database is on GCP Cloud SQL:**

1. **Enable Cloud KMS API:**
   - Go to **APIs & Services** > **Library**
   - Search for "Cloud Key Management Service"
   - Click **Enable**

2. **Create a key ring:**
   ```
   Region: australia-southeast1 (or your Cloud SQL region)
   Name: monitrax-cdr-keyring
   ```

3. **Create an encryption key:**
   ```
   Name: monitrax-cdr-data-key
   Protection level: Software
   Key purpose: Symmetric encrypt/decrypt
   Rotation period: 90 days (automatic)
   ```

4. **Grant Cloud SQL service account access:**
   - Find your Cloud SQL service account: `service-PROJECT_NUMBER@gcp-sa-cloud-sql.iam.gserviceaccount.com`
   - Grant role: `Cloud KMS CryptoKey Encrypter/Decrypter`

5. **Configure Cloud SQL instance to use CMEK:**
   - Go to **Cloud SQL** > **Instance** > **Edit**
   - Under **Encryption**, select **Customer-managed encryption key**
   - Select the key created above
   - Click **Save**

### Current Status
**Not completed** — Database is currently hosted on Render, not GCP Cloud SQL. CMEK cannot be applied until the database is migrated to Cloud SQL. Render provides its own encryption at rest.

### Verification
- [ ] Cloud KMS API enabled — **Blocked: DB on Render, not Cloud SQL**
- [x] Encryption posture documented in compliance response (Render encryption at rest)
- [ ] Key rotation configured (90 days) — **Pending Cloud SQL migration**

---

## Step E.6 — Review Firebase Password Policy (Quick Win)

**Basiq:** §1.4 (strong passwords)
**Effort:** 10 minutes

### Instructions

1. Go to **GCP Console** > **Identity Platform** > **Settings**
   - URL: `https://console.cloud.google.com/customer-identity/settings?project=monitrax-479700`

2. Navigate to **Password Policy**

3. Verify or set:
   - Minimum password length: **12 characters**
   - Require uppercase letter: **Yes**
   - Require lowercase letter: **Yes**
   - Require numeric character: **Yes**
   - Require non-alphanumeric character: **Yes**

4. Save changes

### Verification
- [ ] Password policy configured with 12+ chars and complexity requirements

---

## Step E.7 — Verify SSL on Database Connection

**Basiq:** §3.3 (data in transit encrypted)
**Effort:** 10 minutes

### Instructions

1. Check your `DATABASE_URL` environment variable in Render:
   - Go to **Render Dashboard** > **Your Service** > **Environment**
   - Find `DATABASE_URL`
   - Verify it contains `?sslmode=require` at the end

2. If `sslmode` is not set:
   - Append `?sslmode=require` to the DATABASE_URL
   - Redeploy the service

3. If using Render's internal database URL, SSL is enforced by default for external connections

### Verification
- [ ] DATABASE_URL includes `?sslmode=require` or uses Render internal connection

---

## Step E.8 — Cloud Armor (WAF + DDoS) — Architecture Note

**Basiq:** §3.2 (network rules), §8.12
**Effort:** Depends on architecture

### Current Architecture Consideration

Cloud Armor requires a **Google Cloud Load Balancer** backend. Since Monitrax uses:
- **Vercel** for frontend (has built-in DDoS protection + WAF via Vercel Firewall)
- **Render** for backend (has basic DDoS protection)

Cloud Armor cannot be directly attached to Vercel or Render.

### Options

| Option | Description | Effort |
|--------|-------------|--------|
| **A. Document existing protections** | Vercel has DDoS protection + Edge Firewall. Render has basic DDoS. Rate limiting middleware exists in app. | Document only |
| **B. Add Cloudflare** | Put Cloudflare in front of Render for WAF + DDoS | 1-2 hours |
| **C. Migrate to Cloud Run** | Move backend to GCP Cloud Run, then attach Cloud Armor | Multi-day project |

### Recommended for now (Option A)

For the Basiq compliance response, document:
- Vercel provides DDoS protection and edge-level security for frontend
- Render provides DDoS protection for backend
- Application-level rate limiting middleware exists (`lib/security/rateLimit.ts`)
- CSP headers configured in middleware
- Cloud Armor will be evaluated when migrating to GCP Cloud Run

---

## Step E.9 — Cloud Scheduler for CDR Consent Expiry (Already Built)

**Basiq:** §5.5 (consent expiry deletion)
**Effort:** 15 minutes

### Instructions

1. Go to **GCP Console** > **Cloud Scheduler**
   - URL: `https://console.cloud.google.com/cloudscheduler?project=monitrax-479700`

2. Click **Create Job**

3. Configure:
   ```
   Name: cdr-consent-expiry-check
   Region: australia-southeast1
   Frequency: 0 2 * * * (daily at 02:00 UTC / 12:00 AEST)
   Timezone: UTC
   ```

4. Configure target:
   ```
   Target type: HTTP
   URL: https://your-production-domain/api/cdr/lifecycle
   HTTP method: POST
   Headers:
     Authorization: Bearer YOUR_CRON_SECRET
     Content-Type: application/json
   ```

5. Set `CRON_SECRET` in your Render environment variables (generate a strong random string)

### Verification
- [ ] Cloud Scheduler job created
- [ ] CRON_SECRET set in production environment
- [ ] Test run successful (check audit logs for CDR_CONSENT_EXPIRED action)

---

## Summary Checklist

| Step | Service | Priority | Status |
|------|---------|----------|--------|
| E.1 | Security Command Center | P0 | [x] Done ✅ |
| E.2 | Cloud Audit Logs | P1 | [x] Done ✅ |
| E.3 | Cloud Logging + Monitoring | P1 | [x] Done ✅ |
| E.4 | Error Reporting | P1 | [x] Done ✅ |
| E.5 | Cloud KMS (CMEK) | P1 | [ ] Blocked — DB on Render, pending Cloud SQL migration |
| E.6 | Firebase Password Policy | Quick | [ ] Done |
| E.7 | SSL on Database | Quick | [ ] Verified |
| E.8 | Cloud Armor / WAF | P0 | [ ] Documented |
| E.9 | Cloud Scheduler (CDR) | P1 | [ ] Done |

### After Completion

1. Update `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` — mark §8.x items as DONE
2. Update `docs/blueprint/CDR_IMPLEMENTATION_PLAN.md` — mark Phase E COMPLETE
3. Create changelog entry
4. Expected score: **~87% -> ~93%**

---

## Compliance Response Templates

When filling out the Basiq checklist, use these responses:

### §3.2 (Network rules enforced)
> "Network security is enforced at multiple layers: Vercel edge-level DDoS protection for frontend, Render DDoS protection for backend, application-level rate limiting middleware, CSP security headers in Next.js middleware, and GCP Cloud Armor evaluation planned for Cloud Run migration."

### §3.5 (Vulnerability testing)
> "GCP Security Command Center (Standard tier) enabled for continuous vulnerability scanning and compliance monitoring. npm audit runs in CI pipeline on every push. Dependabot provides automated dependency vulnerability alerts."

### §5.7 (CDR data at rest encrypted)
> "Database hosted on Render with encryption at rest enabled by the platform. GCP Cloud KMS (CMEK) documented for implementation when migrating to Cloud SQL for customer-managed key rotation."

### §8.x (GCP Tools)
> List all enabled services from the checklist above.

---

*Last Updated: 2026-04-01*
*Execute these steps in GCP Console, then update compliance documentation.*
