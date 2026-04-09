# Incident Response Runbook

> **Audience:** BAU support team
> **Last Updated:** 2026-04-09

---

## Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **P0 — Critical** | System down, data loss risk | Immediate | Database unreachable, CDR data breach |
| **P1 — High** | Major feature broken | Within 1 hour | Auth failures, API errors for all users |
| **P2 — Medium** | Feature degraded | Within 4 hours | Slow performance, one module failing |
| **P3 — Low** | Minor issue | Next business day | UI glitch, non-critical log errors |

---

## Scenario 1: Database Unreachable

**Symptoms:** `/api/health` returns 503, all API calls fail, dashboard shows loading forever

**Diagnosis:**
1. Check Cloud SQL instance status: GCP Console → SQL → `monitrax-db-prod`
2. Check if instance is running (green tick)
3. Check connection count (may have hit limit)
4. Check authorized networks (Vercel IPs may have changed)

**Resolution:**
1. If instance stopped → Start it from GCP Console
2. If connection limit hit → Restart instance or increase `max_connections` flag
3. If network issue → Verify authorized networks include `0.0.0.0/0` (or Vercel IPs)
4. If maintenance in progress → Wait for completion (check maintenance window)

**Escalation:** GCP Support ticket if instance won't start

---

## Scenario 2: Authentication Failures

**Symptoms:** Users can't sign in, 401 errors on API calls, token verification fails

**Diagnosis:**
1. Check Firebase Console → Authentication → is service healthy?
2. Check if GCP Identity Platform has issues: https://status.cloud.google.com
3. Check Vercel logs for token verification errors
4. Verify `GCP_PROJECT_ID` env var is set correctly

**Resolution:**
1. If Firebase outage → Wait for Google to resolve, inform users
2. If token verification fails → Check public certificate cache (may need redeployment)
3. If env var issue → Fix in Vercel dashboard → Redeploy

---

## Scenario 3: API Errors (500s)

**Symptoms:** Specific API routes return 500 errors

**Diagnosis:**
1. Check Vercel deployment logs: Vercel Dashboard → Deployments → Runtime Logs
2. Identify which route is failing
3. Check if it's a database query issue (connection timeout, constraint violation)
4. Check recent deployments (was new code just deployed?)

**Resolution:**
1. If bad deployment → Rollback: Vercel Dashboard → Deployments → promote previous
2. If database issue → Check Cloud SQL status and connection
3. If code bug → Create fix on feature branch, test on preview, merge

---

## Scenario 4: Slow Performance

**Symptoms:** Dashboard takes >5 seconds to load, API responses are slow

**Diagnosis:**
1. Check Cloud SQL metrics: CPU, memory, active connections
2. Check Vercel function duration in logs
3. Check for N+1 queries or large data fetches
4. Check if automated backups or maintenance are running

**Resolution:**
1. If DB overloaded → Scale up Cloud SQL instance temporarily
2. If specific query slow → Check for missing indexes
3. If Vercel cold starts → May resolve on its own (serverless warm-up)

---

## Scenario 5: CDR Data Breach (P0)

**Symptoms:** Unauthorized access to CDR-protected data detected in audit logs

**Immediate Actions:**
1. **Contain:** Revoke affected user sessions
2. **Assess:** Check AuditLog table for unauthorized `cdr_data.read` actions
3. **Notify:** Inform the data holder (Basiq) within 24 hours
4. **Document:** Record all findings in incident log
5. **Remediate:** Fix the vulnerability, rotate credentials if needed

**Post-Incident:**
1. Update security controls
2. Review and tighten permissions
3. File CDR breach notification if required by regulation

---

## General Escalation Path

```
1. BAU team member investigates using this runbook
2. If unresolved in 30 min → Escalate to development team
3. If infrastructure issue → Open GCP Support ticket
4. If Vercel issue → Check status.vercel.com, contact Vercel support
5. If CDR-related → Follow CDR incident response (Scenario 5)
```
