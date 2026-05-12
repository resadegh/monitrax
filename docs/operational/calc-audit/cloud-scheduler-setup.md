# Cloud Scheduler — Calc Audit L2 Anomaly Scan

> **Audience:** Monitrax engineer wiring up the scheduled L2 anomaly scan in production.
> **Per HR-3:** the scheduler triggers an admin-side endpoint that surfaces findings into the existing admin portal queue. No user-facing surface is involved.

---

## What this does

GCP Cloud Scheduler triggers `POST /api/admin/calc-audit/anomaly-scan` on a schedule. The endpoint runs `scanForAnomalies()` over the recent `CalcAuditFinding` history and surfaces:

- **HIGH_FREQUENCY** anomalies — engines producing >5 findings in the last 7 days (suggests structural instability)
- **REGRESSION_AFTER_STABLE_PERIOD** anomalies — engines that were quiet for >30 days then started failing (suggests a recent code change broke a previously-stable surface)

Both pattern types create new `CalcAuditFinding` records with `source: 'L2_ANOMALY'`, severity `MEDIUM` or `HIGH`. The existing alerting layer (41i.4) fires Slack/email when severity ≥ HIGH.

---

## Authentication

The endpoint accepts two auth paths:

1. **Admin session** — for manual triggers from the admin portal (uses `audit:read` permission via `verifyAdminGCPAuth`)
2. **Cloud Scheduler shared secret** — for scheduled runs

For scheduled runs we use a **shared-secret bearer token** rather than a Google service-account OIDC JWT for simplicity. The shared secret lives in two places:

- **Vercel env var** `CALC_AUDIT_SCHEDULER_SHARED_SECRET` (production scope; min 32 chars)
- **Cloud Scheduler job's HTTP target** as a `Authorization: Bearer <secret>` header

---

## Generate the shared secret

```sh
# Cryptographically random 64-char secret
openssl rand -hex 32
```

Save the output as `CALC_AUDIT_SCHEDULER_SHARED_SECRET` in Vercel's production environment scope (Settings → Environment Variables).

---

## Create the scheduler job

```sh
# Replace <SECRET> with the 64-char secret you just generated
# Replace <PROJECT_ID> with the GCP project hosting the scheduler

gcloud scheduler jobs create http calc-audit-l2-anomaly-scan \
  --project=<PROJECT_ID> \
  --location=australia-southeast1 \
  --schedule="0 3 * * *" \
  --time-zone="Australia/Sydney" \
  --uri="https://app.monitrax.com.au/api/admin/calc-audit/anomaly-scan" \
  --http-method=POST \
  --headers="Authorization=Bearer <SECRET>,Content-Type=application/json" \
  --message-body='{"lookbackDays":7,"highFrequencyThreshold":5}' \
  --attempt-deadline=300s \
  --max-retry-attempts=3 \
  --min-backoff=30s \
  --max-backoff=600s
```

**Schedule rationale**: `0 3 * * *` in `Australia/Sydney` = **03:00 Sydney daily** (low traffic; before AU business hours). All Monitrax Cloud Scheduler jobs use the `australia-southeast1` region + the `Australia/Sydney` timezone (see `docs/operational/runbooks/05_RETENTION_SCHEDULERS.md` — Reza decision 2026-05-12). If an older instance of this job was created with `0 17 * * * UTC`, fix it: `gcloud scheduler jobs update http calc-audit-l2-anomaly-scan --location=australia-southeast1 --schedule="0 3 * * *" --time-zone="Australia/Sydney"`.

---

## Verification

```sh
# 1. Trigger a one-off run
gcloud scheduler jobs run calc-audit-l2-anomaly-scan \
  --project=<PROJECT_ID> \
  --location=australia-southeast1

# 2. Check the run's HTTP response in Cloud Logging
gcloud logging read \
  'resource.type="cloud_scheduler_job" AND
   resource.labels.job_id="calc-audit-l2-anomaly-scan"' \
  --project=<PROJECT_ID> \
  --limit=5

# 3. Open the admin portal and look for new L2_ANOMALY findings
#    (https://app.monitrax.com.au/admin/calc-audit)
```

---

## Tuning the parameters

The body accepts four override knobs (all clamped server-side):

| Param | Default | Purpose |
|---|---|---|
| `lookbackDays` | 7 | How far back to scan recent findings. |
| `highFrequencyThreshold` | 5 | Engines with > N findings in the lookback fire HIGH_FREQUENCY. |
| `stablePeriodDays` | 30 | An engine must be quiet for ≥ this long to qualify as "stable" before a regression detection. |
| `regressionGapDays` | 14 | The gap between the engine's prior finding and the new lookback-window finding must be ≥ this. |

Server-side clamps: each value is `Math.max(1, Math.min(365, ...))`.

To change the schedule's body, run:

```sh
gcloud scheduler jobs update http calc-audit-l2-anomaly-scan \
  --project=<PROJECT_ID> \
  --location=australia-southeast1 \
  --message-body='{"lookbackDays":14,"highFrequencyThreshold":3}'
```

---

## Pause / resume / delete

```sh
# Pause (e.g. during a planned engine refactor that will fire many false anomalies)
gcloud scheduler jobs pause calc-audit-l2-anomaly-scan \
  --project=<PROJECT_ID> --location=australia-southeast1

# Resume
gcloud scheduler jobs resume calc-audit-l2-anomaly-scan \
  --project=<PROJECT_ID> --location=australia-southeast1

# Delete (decommission)
gcloud scheduler jobs delete calc-audit-l2-anomaly-scan \
  --project=<PROJECT_ID> --location=australia-southeast1
```

---

## Failure handling

- **Endpoint returns 401**: shared secret mismatch — re-check the Vercel env var matches the gcloud `--headers` value.
- **Endpoint returns 503 + `ADMIN_PORTAL_NOT_ENABLED`**: production env var `NEXT_PUBLIC_ADMIN_PORTAL_ENABLED` is `false`. Enable for production scope.
- **Cloud Scheduler retries hit max attempts**: each scan is idempotent (dedup by engineName + kind) — let the next scheduled run handle it.

The endpoint never throws to the caller — it always returns a JSON body. If the scan crashes mid-run, the response will be 500 with a generic message; the underlying error is in Cloud Logging via the request handler's audit log.

---

## CLAUDE.md compliance

- **§13.3 (CDR sanitisation)**: anomaly findings carry NO user-specific data — only engine names + finding counts + dates. Safe for Slack/email per the existing alerting CDR-safe pattern.
- **§13.6 (env var management)**: the shared secret is a non-secret bootstrap identifier in the same sense as `GCP_SERVICE_ACCOUNT_EMAIL` — it identifies the scheduler caller but doesn't grant access on its own (the endpoint is also gated by `isAdminPortalAccessible()`).
- **§16 (doc sync)**: this runbook ships in the same PR as `lib/calc-audit/anomalyDetection.ts` + the endpoint.
