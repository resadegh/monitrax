# Health Check Procedures

> **Audience:** BAU support team
> **Last Updated:** 2026-04-09

---

## Quick Health Check (Daily)

Run these checks to verify the system is operating normally:

| # | Check | How | Healthy | Unhealthy |
|---|-------|-----|---------|-----------|
| 1 | API health | `GET /api/health` | `{"status":"healthy","database":"connected"}` | 503 or timeout |
| 2 | Cloud SQL PROD | GCP Console → SQL → monitrax-db-prod | Green tick, "Running" | Red, "Stopped" |
| 3 | Vercel deployment | Vercel Dashboard → latest deployment | Green "Ready" | Red "Error" |
| 4 | Firebase Auth | Firebase Console → Authentication | Active, users listed | Error state |

---

## Detailed Health Checks

### 1. API Health Endpoint

```bash
curl -s https://monitrax.com.au/api/health | jq .
```

**What it checks:** Database connectivity (runs `SELECT 1`).

**Retry behaviour (since 2026-06-03):** the route attempts `SELECT 1` up to
**2 times** with a **150 ms** backoff before returning 503. This absorbs
single-probe transients (cold-start auth-chain jitter, momentary pool
contention / Postgres `53300`) so they don't page a false P0. It does **not**
mask a real outage — the A1 alert needs ~2 consecutive minutes of failed
probes, and a genuine DB-unreachable window fails every attempt. Worst-case
added latency on the failure path is ~150 ms (well inside the uptime-check
timeout). Source: `app/api/health/route.ts`.

| Response | Meaning |
|----------|---------|
| `200 {"status":"healthy","database":"connected"}` | All good |
| `503 {"status":"unhealthy","database":"disconnected"}` | DB connection failed (both attempts) |
| Timeout / no response | Vercel or network issue |

### 2. Cloud SQL Instance Status

**GCP Console → SQL → Click instance**

| Metric | Healthy | Investigate |
|--------|---------|-------------|
| Status | Running (green) | Stopped, Maintenance |
| CPU utilization | < 80% | > 80% sustained |
| Memory utilization | < 80% | > 80% sustained |
| Storage used | < 80% of allocated | > 80% (auto-resize should handle) |
| Active connections | < 80% of max | Near max (default 100 for micro) |
| Failed connections | 0 | Any non-zero |

### 3. Vercel Deployment Status

**Vercel Dashboard → Deployments**

| Status | Meaning |
|--------|---------|
| Ready (green) | Successfully deployed |
| Error (red) | Build or runtime failure |
| Building | Deployment in progress |
| Cancelled | Build was cancelled |

### 4. Firebase Auth Status

**Firebase Console → Authentication → Users**

- Can you see the user list? → Auth service is running
- Check https://status.cloud.google.com for GCP Identity Platform status

### 5. Cloud Storage (Documents)

```bash
# Check if the GCS bucket is accessible
gcloud storage ls gs://YOUR_BUCKET_NAME/ --limit=1
```

### 6. Basiq API (Open Banking)

Check Basiq status: https://status.basiq.io

If Basiq is down, bank account syncing will fail but the rest of the app works normally.

---

## Monitoring Schedule

| Check | Frequency | Who |
|-------|-----------|-----|
| API health endpoint | Every 5 minutes (automated) | Cloud Monitoring uptime check |
| Cloud SQL metrics | Continuous (automated alerts) | Cloud Monitoring |
| Vercel deployment status | After each merge to main | BAU team |
| Full health check (all items above) | Daily (business hours) | BAU team |
| Audit log review | Weekly | BAU team |
| Backup verification | Monthly | BAU team |

---

## Setting Up Automated Monitoring

### Cloud Monitoring Uptime Check

> **CRITICAL — target the `www` host, NOT the apex.** `monitrax.com.au`
> (apex) **308-redirects** to `www.monitrax.com.au` since `www` became the
> canonical domain (Firebase auth-domain work). An uptime check pointed at the
> apex with a `"healthy"` content match **fails** because it evaluates the
> `308 "Redirecting..."` body, which does not contain `"healthy"`. This caused
> the 2026-06-05 P0 false-page storm (the check was created 2026-05-19 against
> the apex, before `www` became canonical; the Cloud Scheduler jobs were
> migrated to `www` at the time but the uptime check was missed). The hostname
> of an existing GCP uptime check is **not editable** — delete and recreate
> against `www`.

1. GCP Console → Monitoring → Uptime Checks → Create
2. Hostname: `www.monitrax.com.au` · Path: `/api/health` (**not** the apex)
3. Protocol: HTTPS (port 443) · Check frequency: 1 minute · Regions: all
4. Response must contain: `"healthy"`
5. Alert channel: `Reza-Email` + `Reza-SMS`

### Cloud SQL Alert Policies

Set up in GCP Console → Monitoring → Alerting → Create Policy:

| Metric | Condition | Threshold |
|--------|-----------|-----------|
| CPU utilization | Above | 80% for 5 minutes |
| Memory utilization | Above | 80% for 5 minutes |
| Disk utilization | Above | 80% |
| Active connections | Above | 80% of max_connections |
