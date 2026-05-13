# Incident Response Plan

**Version:** 1.1
**Created:** 2026-03-08
**Last revised:** 2026-05-04 — added §10 (WIF & Cloud SQL Auth-Chain Failure Patterns) capturing Phase 9 cutover lessons
**Owner:** Resadegh (Director, Monitrax)
**Review Cycle:** Annual (next review: 2027-03-08)
**Basiq Requirement:** CDR Compliance — Breach Notification
**Legal Basis:** Privacy Act 1988 — Notifiable Data Breaches (NDB) scheme, CDR Privacy Safeguards

---

## 1. Purpose

This document defines how Monitrax identifies, contains, remediates, and reports security incidents, with particular focus on CDR data breaches. It ensures compliance with the Australian Notifiable Data Breaches (NDB) scheme and CDR privacy safeguards.

---

## 2. Scope

This plan covers:

- Unauthorized access to CDR-protected data
- Data breaches involving consumer financial information
- System compromise (application, database, infrastructure)
- Credential theft or exposure
- Device loss or theft with access to production systems
- Third-party vendor incidents affecting Monitrax data (e.g., Basiq, Render, GCP)
- **WIF / Cloud SQL auth-chain failures** — Workload Identity Federation, OIDC token retrieval, IAM database authentication, Cloud SQL Connector. See §10 for failure-pattern playbook.

---

## 3. Incident Classification

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|---------|
| **CRITICAL** | CDR data breach — unauthorized access to consumer financial data | Immediate (< 1 hour) | Database breach, API credential exposure, Basiq token compromise |
| **HIGH** | System compromise without confirmed CDR data access | < 4 hours | Unauthorized admin access, suspicious login patterns, infrastructure breach |
| **MEDIUM** | Security vulnerability discovered (not yet exploited) | < 24 hours | Unpatched dependency with known CVE, misconfigured access control |
| **LOW** | Minor security event with no data impact | < 72 hours | Failed brute-force attempt (blocked), rate limit triggered |
| **HIGH (Availability)** | Production database unreachable due to auth-chain failure (no data breach, but full app outage) | < 1 hour | WIF token retrieval broken, Cloud SQL IAM user revoked, SA permissions removed, mTLS handshake failing, cold-start init wedged. See §10. |

---

## 4. Incident Response Team

### Current (Sole Director)

| Role | Person | Contact |
|------|--------|---------|
| Incident Commander | Resadegh (Director) | Primary contact |
| Technical Lead | Resadegh (Director) | Same |
| Communications Lead | Resadegh (Director) | Same |

### Future (When Team Grows)

| Role | Responsibility |
|------|----------------|
| Incident Commander | Overall coordination, OAIC notification decisions |
| Technical Lead | Investigation, containment, remediation |
| Communications Lead | User notification, regulatory communication |
| Legal Advisor | Regulatory obligations, NDB assessment |

---

## 5. Incident Response Phases

### Phase 1: Identification

**Detect and confirm the incident:**

1. Review alert (automated monitoring, user report, or manual discovery)
2. Assess initial scope — what systems and data are affected
3. Classify severity (see §3)
4. Document the initial findings in an incident log

**Detection sources:**
- Admin audit logs (`/admin/audit-logs`)
- Anomaly detection alerts (`runAnomalyDetection()` in `lib/security/cdrAuditCompliance.ts`)
- GCP Security Command Center alerts (when enabled)
- User reports
- Third-party vendor notifications (Basiq, Render, GCP)

### Phase 2: Containment

**Stop the incident from spreading:**

| Action | Command/Process |
|--------|----------------|
| Revoke compromised sessions | Admin portal → Sessions → Revoke all |
| Disable compromised user accounts | `PATCH /api/admin/admins/[id] { isActive: false }` |
| Rotate API keys/secrets | Render Dashboard → Environment Variables |
| Block suspicious IPs | Rate limiting / Cloud Armor (when enabled) |
| Disconnect Basiq if CDR data at risk | `POST /api/cdr/consent { action: 'revoke_all' }` |
| Take affected systems offline | Render Dashboard → Suspend service |

### Phase 3: Investigation

**Determine root cause and full impact:**

1. Review audit logs for the affected time period
2. Identify all affected users and data
3. Determine how the breach occurred (attack vector)
4. Assess whether CDR data was accessed or exfiltrated
5. Document findings in the incident report

**Key investigation queries:**
- Audit logs: `GET /api/admin/audit/export` (filter by date range)
- Admin audit logs: `AdminAuditLog` table
- GCP Cloud Logging (when enabled)

### Phase 4: Remediation

**Fix the root cause and prevent recurrence:**

1. Patch the vulnerability that caused the incident
2. Rotate all potentially compromised credentials
3. Restore affected systems from known-good backups if needed
4. Deploy fix via standard PR process (emergency hotfix branch if needed)
5. Verify fix addresses root cause

### Phase 5: Notification

**Notify affected parties per legal requirements:**

#### CDR Data Breach Notification

| Recipient | Timeline | Method |
|-----------|----------|--------|
| **OAIC** (Office of the Australian Information Commissioner) | Within 30 days of becoming aware (or as soon as practicable) | NDB statement via OAIC portal |
| **Affected consumers** | As soon as practicable after assessment | Email notification |
| **Basiq** (CDR principal) | Immediately if CDR data involved | Direct contact per Basiq accreditation terms |
| **ACCC** (if CDR-specific) | As directed by OAIC | Formal notification |

#### NDB Statement Must Include

- Identity and contact details of Monitrax
- Description of the breach
- Types of information involved
- Recommendations for affected individuals

### Phase 6: Recovery & Post-Incident Review

1. Confirm all systems are operating normally
2. Verify no residual unauthorized access
3. Conduct post-incident review within 7 days
4. Document lessons learned
5. Update security controls to prevent recurrence
6. Update this Incident Response Plan if gaps identified

---

## 6. Incident Log Template

```markdown
## Incident #[number] — [date]

### Summary
- **Classification:** CRITICAL / HIGH / MEDIUM / LOW
- **Detected by:** [source]
- **Date/time detected:** [timestamp]
- **Date/time contained:** [timestamp]
- **Date/time resolved:** [timestamp]

### Affected Systems
- [system 1]
- [system 2]

### Affected Data
- CDR data: YES / NO
- Number of affected users: [count]
- Data types: [accounts, transactions, etc.]

### Root Cause
[description]

### Actions Taken
1. [containment action]
2. [remediation action]
3. [notification action]

### Notifications
- OAIC notified: YES / NO / NOT REQUIRED
- Users notified: YES / NO / NOT REQUIRED
- Basiq notified: YES / NO / NOT REQUIRED

### Lessons Learned
[description]

### Follow-Up Actions
- [ ] [action 1]
- [ ] [action 2]
```

---

## 7. Escalation Contacts

| Entity | Contact | When to Contact |
|--------|---------|----------------|
| OAIC | oaic.gov.au/privacy/notifiable-data-breaches | CDR data breach confirmed |
| Basiq Support | support@basiq.io | CDR data or Basiq API breach |
| Render Support | support@render.com | Infrastructure compromise |
| GCP Support | GCP Console → Support | GCP service compromise |

---

## 8. Testing & Drills

| Activity | Frequency | Owner |
|----------|-----------|-------|
| Review incident response plan | Annual | Director |
| Tabletop exercise (simulated breach) | Annual | Director |
| Verify notification contact details | Quarterly | Director |
| Review audit log coverage | Quarterly | Director |

---

## 9. References

| Document | Path |
|----------|------|
| CDR Compliance Matrix | `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` |
| CDR Data Retention Schedule | `docs/policy/CDR_DATA_RETENTION_SCHEDULE.md` |
| CDR Data Lifecycle Service | `lib/services/cdrDataLifecycle.ts` |
| Audit Logging | `lib/security/auditLog.ts` |
| Device Security Policy | `docs/policy/DEVICE_SECURITY_POLICY.md` |
| WIF Troubleshooting Runbook | `docs/operational/security/04_WIF_TROUBLESHOOTING.md` |
| WIF Compliance Evidence Pack | `docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md` |
| OAIC NDB guidance | https://www.oaic.gov.au/privacy/notifiable-data-breaches |

---

## 10. Appendix A — WIF & Cloud SQL Auth-Chain Failure Patterns

> **Captured from the Phase 9 production cutover (2026-05-01) and follow-up cold-start hardening (2026-05-01 late). Codified here so future on-call sessions recognise these failure modes and reach for the matching runbook step instead of re-diagnosing from scratch.**

### 10.1 Why this appendix exists

When Production was cut over from `DATABASE_URL` (long-lived password) to Workload Identity Federation + Cloud SQL Connector + IAM database authentication, four distinct failure modes surfaced inside one day. Each one looked like "the database is down" from the user's side, but the actual root cause was at a different layer of the auth chain. The runbook (`04_WIF_TROUBLESHOOTING.md` §3.A–§3.K) captures the technical fixes; this appendix captures the **incident-response framing** so operators answer the right question first ("which layer of the chain failed?") before reaching for a fix.

These are classified **HIGH (Availability)** per §3, NOT data-breach incidents — IAM auth was already enforced, so a failure means the app cannot connect, not that an attacker did. CDR data is not at risk in any of these modes; the OAIC NDB clock does not start.

### 10.2 The auth chain (must hold for any DB query to succeed)

1. **Vercel function** receives a request and reads the OIDC token from the `x-vercel-oidc-token` request header (NOT `process.env.VERCEL_OIDC_TOKEN` — that exists only at build time).
2. **STS exchange:** the function exchanges the OIDC token for a federated Google access token via Workload Identity Pool `vercel-pool` + provider `vercel-oidc`.
3. **SA impersonation:** the federated token impersonates `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com`, yielding a short-lived OAuth access token.
4. **Cloud SQL Connector:** opens a TLS 1.3 tunnel to `monitrax-db-prod` using the SA's IAM Cloud SQL Client role and an ephemeral client cert.
5. **Postgres handshake:** pg sends the SA's access token as the per-connection password (the Connector wraps the socket but does NOT inject a password). Cloud SQL validates the token against the matching IAM database user.
6. **Schema authorisation:** Postgres checks the IAM DB user has `CONNECT` on the database and `USAGE` + table privileges on schema `public`.

A break at any layer manifests as "the DB is unreachable" or "the page is empty". The four observed Phase 9 failures each broke a different layer.

### 10.3 Observed failure patterns (with severity, runbook anchor, and signature)

| # | Pattern | Layer broken | Severity | Signature in logs | Containment | Remediation | Runbook |
|---|---|---|---|---|---|---|---|
| **1** | OIDC token retrieval | Layer 1 | HIGH (Availability) | `VERCEL_OIDC_TOKEN not set; ensure Vercel OIDC federation is enabled at the project level` | None — app already failing closed (no data exposure). Roll back to `USE_CLOUD_SQL_CONNECTOR=false` if outage > 30 min. | Switch token source from env-var read to `getVercelOidcToken()` from `@vercel/oidc`; ensure init runs inside request context (Proxy lazy-init pattern). | §3.A |
| **2** | mTLS handshake / TLS alert 42 | Layer 4 (Cloud SQL Connector) | HIGH (Availability) | `ERR_SSL_SSL/TLS_ALERT_BAD_CERTIFICATE` | None. | Verify Cloud IAM **database** user exists on the instance (`gcloud sql users create ... --type=CLOUD_IAM_SERVICE_ACCOUNT`); run `public`-schema GRANTs as the SQL admin user. | §3.G |
| **3** | SCRAM no-password / SASL error | Layer 5 (Postgres handshake) | HIGH (Availability) | `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` | None. | Add `password: async () => authClient.getAccessToken()` callback to the `pg.Pool` config so pg fetches a fresh access token per connection. | §3.H |
| **4** | Trailing-whitespace on `CLOUD_SQL_DB_USER` | Layer 5 (Postgres handshake) | HIGH (Availability) | `Raw query failed. Code: 28P01. Message: password authentication failed for user "...iam "` (note trailing space inside the quotes) | None. | Trim the env var in Vercel UI; add defensive `.trim()` on all WIF env-var reads in `lib/db.ts`. | §3.J |
| **5** | Cold-start init wedge | Layer 4 init cache | HIGH (Availability, intermittent) | First page load shows empty data; navigating away and back works. Eventually self-heals (5-15 min). | None — partial outage on a single warm instance; other instances unaffected. | `getOrInitConnectorClient()` `.catch`-clears `globalForPrisma.prismaInitPromise` on rejection so the next request re-attempts init from scratch (rather than awaiting a permanently-rejected promise on the warm instance). | §3.K |
| **6** | Stale cached CA after a GCP-side Cloud SQL event (maintenance restart / minor-version upgrade / cert rotation) — same `bad certificate` signature as #2, but **nothing changed on our side** and it came on suddenly with no flag/IAM/env change | Layer 4 (Connector CA cache) | HIGH (Availability) — **full** outage if it affects all warm instances; `/api/health` returns `503 database:disconnected` | `ssl/tls alert bad certificate ... SSL alert number 42` / `ERR_SSL_SSL/TLS_ALERT_BAD_CERTIFICATE` — *identical* to #2. Distinguish from #2 by: nothing was changed on the GCP/Vercel side, it worked recently, and a plain redeploy fixes it. | None — fail-closed (no data exposure). | **A plain Vercel redeploy of the current Production deployment** (Deployments → `•••` → Redeploy) — forces every function instance cold → fresh Connector init → fresh CA + ephemeral-cert fetch from the SQL Admin API. If that doesn't fix it within ~3 min, fall back to #2's checks (flag / SA roles / connection name) and, if still stuck, the legacy-auth rollback (`USE_CLOUD_SQL_CONNECTOR=false` + redeploy — §10.4 step 2). **Observed 2026-05-13** — `/api/health` 503, admin login 500 with `ssl alert 42`; a single redeploy restored it; root cause assumed to be a GCP-side Cloud SQL maintenance event (no Reza-side change). | §3.G (then §3.K) |

### 10.4 First-response playbook for any of the above

1. **Confirm the layer.** Pull recent error lines from Vercel function logs and Cloud Logging — match the signature against the table above. Don't guess; the symptoms overlap.
2. **Decide rollback vs forward-fix.**
   - If outage duration is approaching the **HIGH (Availability)** SLA (1h) AND the fix is not ready, roll back to legacy auth: set `USE_CLOUD_SQL_CONNECTOR=false` in Vercel Production env, redeploy. The legacy `buildStandardPrisma()` branch in `lib/db.ts` will resume using `DATABASE_URL`. (Phase 11 will remove this fallback ≥ 2026-05-31; until then it is the documented rollback.)
   - If the fix is small (env-var trim, SA grant, code patch) and reproducible in the dev DB first, forward-fix is preferred.
3. **Apply the matching runbook step (§3.A–§3.K).** Each step has its own diagnostic command + fix.
4. **Verify end-to-end.** After the fix lands in Production, hit `/api/health` → confirm DB connectivity, then load `/dashboard` → confirm SSR data renders. Do NOT close the incident on the first green health check; the cold-start wedge (#5) requires a forced cold start (`vercel deploy --prod` redeploy, or wait for ~15 min idle) to fully verify.
5. **Post-incident.** No NDB notification (no CDR breach). Add a row to the §10.3 table here if the failure mode is new — that's how this appendix grows.

### 10.5 Containment options if the auth chain breaks while CDR data is being processed

The auth chain failures above are **availability** failures, not breach failures. But if a failure is observed *concurrently* with anomalous query patterns or unexpected log entries, treat as a CRITICAL incident under §3 and follow Phase 2 containment immediately:

- Set `USE_CLOUD_SQL_CONNECTOR=false` (rollback to known-good auth path).
- Revoke the SA's `Cloud SQL Client` role temporarily: `gcloud projects remove-iam-policy-binding monitrax-479700 --member='serviceAccount:vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com' --role='roles/cloudsql.client'`. The Vercel function will fail closed; no further DB access.
- Disable / drop the Cloud IAM database user on the instance (revokes Layer 6 even if Layer 4 is bypassed).
- Then proceed to §5 Phase 3 Investigation with full Cloud Logging review.

### 10.6 What this appendix is NOT

- It is **not** the runbook. Operators in flight should be in `04_WIF_TROUBLESHOOTING.md` (which has the gcloud commands, code snippets, and full diagnostic flow). This appendix is the IRP-side framing: severity classification, rollback decision, post-incident scoping. The two are linked; both stay in sync per CLAUDE.md §16.3.
- It is **not** an exhaustive list. The five patterns above are the ones we observed during cutover. Future failure modes append rows to §10.3 — same format. The runbook captures all known patterns; this table captures only the ones that have actually fired in Production.

---

*Last Updated: 2026-05-04*
*Next Review: 2027-03-08*
