# Common Operations Runbook

> **Audience:** BAU support team
> **Last Updated:** 2026-04-09

---

## Check System Health

```bash
# API health check
curl https://monitrax.com.au/api/health
# Expected: { "status": "healthy", "database": "connected", "timestamp": "..." }
```

If unhealthy, see [Incident Response](./01_INCIDENT_RESPONSE.md) Scenario 1.

---

## View Deployment Status

1. Go to **Vercel Dashboard** → Project (monitrax)
2. **Deployments** tab shows all deployments with status
3. Green = successful, Red = failed
4. Click a deployment to see build logs and runtime logs

---

## Rollback a Deployment

1. Vercel Dashboard → Deployments
2. Find the last known good deployment
3. Click the three-dot menu → **Promote to Production**
4. This instantly makes that deployment live

---

## Trigger a Manual Redeploy

1. Vercel Dashboard → Deployments
2. Click **Redeploy** on the latest deployment
3. Or push an empty commit to trigger a new build:
   ```bash
   git commit --allow-empty -m "chore: trigger redeploy" && git push
   ```

---

## View Error Logs

1. **Vercel Runtime Logs:** Vercel Dashboard → Project → Logs tab
2. **Cloud SQL Logs:** GCP Console → Logging → Filter by resource type "Cloud SQL Database"
3. **Audit Logs (application-level):** Query the AuditLog table:
   ```sql
   SELECT * FROM "AuditLog"
   WHERE status = 'FAILURE'
   ORDER BY "createdAt" DESC
   LIMIT 50;
   ```

---

## Check Database Size

```bash
psql -h CLOUD_SQL_IP -U monitrax_user -d monitrax \
  -c "SELECT pg_size_pretty(pg_database_size('monitrax'));"
```

---

## View Active Database Connections

```bash
psql -h CLOUD_SQL_IP -U monitrax_user -d monitrax \
  -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"
```

---

## Manually Trigger a Backup

```bash
gcloud sql backups create --instance=monitrax-db-prod --description="Manual backup $(date +%Y-%m-%d)"
```

---

## View Audit Logs

```sql
-- Recent login events
SELECT "userId", action, status, "ipAddress", "createdAt"
FROM "AuditLog"
WHERE action IN ('LOGIN', 'OAUTH_LOGIN', 'REGISTER')
ORDER BY "createdAt" DESC
LIMIT 20;

-- Recent failed actions
SELECT "userId", action, status, "entityType", "createdAt"
FROM "AuditLog"
WHERE status = 'FAILURE'
ORDER BY "createdAt" DESC
LIMIT 20;

-- CDR data access events
SELECT "userId", action, "entityType", "createdAt"
FROM "AuditLog"
WHERE action IN ('CDR_DATA_DELETED', 'CDR_CONSENT_EXPIRED', 'CDR_CONSENT_REVOKED')
ORDER BY "createdAt" DESC;
```

---

## User Account Management

### Check if a user is locked
```sql
SELECT email, "accountLocked", "failedLoginAttempts", "lastLoginAt"
FROM "User"
WHERE email = 'user@example.com';
```

### Unlock a user account
```sql
UPDATE "User"
SET "accountLocked" = false, "failedLoginAttempts" = 0
WHERE email = 'user@example.com';
```

**Note:** Account locks are also managed via the Admin Portal at `/admin/users`.

---

## Check Row Counts (Data Volume)

```sql
SELECT schemaname, relname AS table_name, n_live_tup AS row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```
