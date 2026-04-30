# WIF + Cloud SQL Connector — Troubleshooting Runbook

Operational runbook for the Workload Identity Federation + Cloud SQL Connector
authentication path used by Monitrax in production.

> **Active path:** `lib/db.ts` → `buildConnectorPrisma()` (selected when
> `USE_CLOUD_SQL_CONNECTOR=true`). Architecture diagram in
> `docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md` §5.5.

---

## 1. Token flow at a glance

```
Vercel runtime
  └── VERCEL_OIDC_TOKEN (auto-injected, ~1h TTL)
        └── google-auth-library IdentityPoolClient
              └── STS token-exchange  (sts.googleapis.com/v1/token)
                    └── Service-account impersonation
                          (iamcredentials.googleapis.com/.../generateAccessToken)
                          └── Short-lived GCP access token (~1h)
                                └── Cloud SQL Connector
                                      └── SQL Admin API: fetch ephemeral cert
                                      └── TLS 1.3 tunnel to instance
                                            └── pg.Pool stream
                                                  └── Postgres IAM auth as
                                                      <SA_EMAIL>@<PROJECT>.iam
```

A failure at any layer surfaces in `lib/db.ts` (cold-start) as a thrown
error before the first query runs. The error message includes the layer.

---

## 2. Required runtime conditions

For the connector branch to work in a Vercel deployment, **all** of the
following must be true. Run through this list whenever the path 500s on
cold start.

| # | Condition | How to check |
|---|---|---|
| 1 | `USE_CLOUD_SQL_CONNECTOR=true` is set in the Vercel env scope being deployed | Vercel → Project → Settings → Environment Variables → filter by env (Production / Preview) |
| 2 | Vercel project-level OIDC federation is enabled | Vercel → Project → Settings → OIDC Federation → "Enabled" toggle |
| 3 | `VERCEL_OIDC_TOKEN` is present at runtime | Add a temporary log: `console.log(!!process.env.VERCEL_OIDC_TOKEN)` in a route handler |
| 4 | `GCP_WORKLOAD_IDENTITY_PROVIDER` env var matches the actual provider resource path in GCP | `gcloud iam workload-identity-pools providers describe vercel-oidc --workload-identity-pool=vercel-pool --location=global --project=monitrax-479700` → `name:` field |
| 5 | The OIDC provider's attribute condition matches Vercel's claims | `... providers describe ...` → `attributeCondition:`. Must include `assertion.project_id == 'prj_UYQF3GpGAkeFo4ZhMhch4Q0btCAU'` |
| 6 | The service account `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com` has `Cloud SQL Client` + `Cloud SQL Instance User` IAM roles at the project level | `gcloud projects get-iam-policy monitrax-479700 --flatten="bindings[].members" --filter="bindings.members:serviceAccount:vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com"` |
| 7 | The WIF principal is bound to the SA with `roles/iam.workloadIdentityUser` | `gcloud iam service-accounts get-iam-policy vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com` |
| 8 | The SA exists as a Cloud SQL IAM user inside the instance | GCP console → SQL → `monitrax-db-prod` → Users → look for `vercel-monitrax-db@monitrax-479700.iam` (note the `.gserviceaccount.com` suffix is stripped) |
| 9 | The IAM Postgres user has `CONNECT` on `monitrax`, `USAGE` on `public`, and `SELECT/INSERT/UPDATE/DELETE` on tables | `psql ... -c "\dp public.*"` or replay the grant SQL from the WIF Phase 3 runbook |
| 10 | `CLOUD_SQL_DB_USER` matches the IAM user name **exactly** (with the `@<project>.iam` suffix, no `.gserviceaccount.com`) | `vercel env ls` |

---

## 3. Common failures

### A. `VERCEL_OIDC_TOKEN not set; ensure Vercel OIDC federation is enabled at the project level`

- **Cause:** condition #2 or #3 above.
- **Fix:** Toggle OIDC Federation ON in the Vercel project settings. Note
  that toggling it requires a re-deploy before the env var is injected
  into running functions. Trigger a redeploy from the Deployments tab.

### B. `Permission denied: workload identity user`

- **Cause:** condition #5, #6, or #7. Either the OIDC token's claims
  don't satisfy the attribute condition, or the WIF principal isn't
  bound to the SA, or the SA doesn't have Cloud SQL IAM roles.
- **Fix:** Re-run the WIF binding command from the Phase 6 runbook. If
  the attribute condition is the issue (e.g. Vercel project ID changed),
  update it via `gcloud iam workload-identity-pools providers update-oidc`.

### C. `pq: password authentication failed for user "..."`

- **Cause:** Connector handshake succeeded but Postgres rejected the
  user — usually condition #8 (the SA isn't a Cloud SQL IAM user) or
  condition #10 (`CLOUD_SQL_DB_USER` typo).
- **Fix:** Add the IAM user via console (SQL → Users → Add → Cloud IAM)
  or re-check the env var. Remember the `.gserviceaccount.com` suffix
  is stripped in the Postgres user name.

### D. `permission denied for schema public` or `permission denied for table ...`

- **Cause:** condition #9 — IAM user exists but lacks grants.
- **Fix:** Replay the grant SQL from the WIF Phase 3 runbook:
  ```sql
  GRANT CONNECT ON DATABASE monitrax TO "<sa-email>@monitrax-479700.iam";
  GRANT USAGE ON SCHEMA public TO "<sa-email>@monitrax-479700.iam";
  GRANT ALL ON ALL TABLES IN SCHEMA public TO "<sa-email>@monitrax-479700.iam";
  GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO "<sa-email>@monitrax-479700.iam";
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "<sa-email>@monitrax-479700.iam";
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "<sa-email>@monitrax-479700.iam";
  ```

### E. Cold start latency spike after enabling the flag

- **Cause:** First request per cold start does the full token-exchange
  + impersonation + connector handshake (~300-700 ms).
- **Fix:** Expected. Subsequent requests on the same warm function reuse
  the pool. If it's a problem, consider a warm-keeper ping endpoint or
  enable Vercel Edge Functions where supported.

### F. Build fails with `Module not found: 'net' / 'tls' / 'dns'`

- **Cause:** A client component is importing a barrel that re-exports
  server-only modules from `lib/db.ts`. We removed the
  `export * from './auth'` in `lib/portal/index.ts` for this reason
  during Phase 8 — if the error returns, look for a similar barrel.
- **Fix:** Import the server-only file directly from API routes /
  server components, never via a barrel that's also used by client code.

---

## 4. Rollback procedure

If something goes wrong after flipping `USE_CLOUD_SQL_CONNECTOR=true` in
production, the rollback is **immediate and zero-downtime**:

1. Vercel → Project → Settings → Environment Variables
2. Edit `USE_CLOUD_SQL_CONNECTOR` → set to `false` for the affected scope
3. Redeploy (or wait for next deploy — running functions will switch on
   their next cold start, which is < 30s in practice)
4. The legacy `DATABASE_URL` path takes over with no code change.

The fallback works because Phase 8 left both branches in `lib/db.ts`.
This fallback will be removed during Phase 10, after the connector path
has been stable in production for 30 days.

---

## 5. Escalation

If the runbook above does not resolve the issue within 15 minutes:

- Bypass: flip the flag back to `false` (see §4) and continue
  investigating with the legacy path serving traffic.
- Open an incident per `docs/policy/INCIDENT_RESPONSE_PLAN.md` if any
  CDR data was unavailable for >5 minutes.
- Add the failure mode to this runbook before closing the incident.

---

*Last Updated: 2026-04-30*
