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

### G. `ERR_SSL_SSL/TLS_ALERT_BAD_CERTIFICATE` (TLS alert 42) on `prisma.$queryRaw` / first query

```
PrismaClientKnownRequestError: ... C0D85FC5...:error:0A000412:SSL routines:
ssl3_read_bytes:ssl/tls alert bad certificate:ssl/record/rec_layer_s3.c:912:
SSL alert number 42
code: 'ERR_SSL_SSL/TLS_ALERT_BAD_CERTIFICATE'
```

- **Where in the chain:** Token retrieval, STS exchange, SA impersonation,
  and SQL Admin cert minting **all succeeded**. The failure is at the
  mutual-TLS handshake between the Cloud SQL Connector and the instance.
  Specifically, the **server** (the Cloud SQL instance) is sending TLS
  alert 42, which means it received a client certificate it considers
  invalid for this kind of connection.
- **Cause:** With `authType: AuthTypes.IAM`, the connector mints a
  cert tied to the impersonated SA's IAM identity. The instance rejects
  that cert at TLS layer if any of the following is true:

  1. The instance flag `cloudsql.iam_authentication` is **OFF**. IAM
     authentication is opt-in per instance — without it, the instance
     refuses IAM-issued certs at the handshake.
  2. The SA is missing `roles/cloudsql.instanceUser` at the project
     level. `roles/cloudsql.client` alone is enough to mint the cert
     but not enough for the instance to accept it for IAM-mode auth.
  3. `CLOUD_SQL_CONNECTION_NAME` env var has a typo — the cert was
     minted for instance A but the connector is opening a TCP socket
     to instance B (so the server hostname doesn't match the cert's
     intended target).
  4. The Cloud SQL instance was created **before** IAM authentication
     was supported and never had the flag toggled, OR was restored
     from a backup that lost the flag.

- **Fix — verification commands** (run all of these; whichever fails or
  shows an unexpected value is your culprit):

  ```bash
  PROJECT=monitrax-479700
  SA=vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com
  INSTANCE=monitrax-db-prod  # adjust if different

  # 1. Confirm instance name and connection-name format
  gcloud sql instances describe "$INSTANCE" --project="$PROJECT" \
    --format="value(connectionName,state,ipAddresses[].ipAddress)"
  # Expected: matches CLOUD_SQL_CONNECTION_NAME env var EXACTLY,
  # state=RUNNABLE, has a public IP.

  # 2. Confirm IAM authentication flag is ON
  gcloud sql instances describe "$INSTANCE" --project="$PROJECT" \
    --format="value(settings.databaseFlags)" | tr ',' '\n' | grep -i iam
  # Expected: cloudsql.iam_authentication=on
  # If empty or =off → fix with:
  gcloud sql instances patch "$INSTANCE" --project="$PROJECT" \
    --database-flags=cloudsql.iam_authentication=on
  # NOTE: this restarts the instance (~30-60s downtime).

  # 3. Confirm both required IAM roles on the SA
  gcloud projects get-iam-policy "$PROJECT" \
    --flatten="bindings[].members" \
    --filter="bindings.members:serviceAccount:$SA" \
    --format="value(bindings.role)" | sort -u
  # Expected to include BOTH:
  #   roles/cloudsql.client
  #   roles/cloudsql.instanceUser

  # 4. Confirm the SA exists as a Cloud SQL IAM user on the instance
  gcloud sql users list --instance="$INSTANCE" --project="$PROJECT"
  # Expected to include a row with type=CLOUD_IAM_SERVICE_ACCOUNT
  # and name=vercel-monitrax-db@monitrax-479700.iam
  # (note: .gserviceaccount.com suffix is stripped in the user name)

  # 5. Confirm SQL Admin API enabled
  gcloud services list --enabled --project="$PROJECT" \
    --filter="config.name~sqladmin"
  # Expected: sqladmin.googleapis.com enabled
  ```

- **Most common single fix:** step 2 — toggling
  `cloudsql.iam_authentication=on`. The flag must be set on the
  instance you're connecting to. A `patch` triggers a short instance
  restart, after which the next cold-start cert handshake succeeds.

- **Rollback while diagnosing:** flip
  `USE_CLOUD_SQL_CONNECTOR=false` in Vercel Production env (see §4).
  Site is restored in <30s while you work the GCP side.

### H. `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string`

```
prisma:error SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string
Health check failed: Error: SASL: SCRAM-SERVER-FIRST-MESSAGE: client password
must be a string
```

- **Where in the chain:** TLS handshake succeeded (so §3.G is now
  green). pg has a live encrypted socket to the instance and is
  attempting Postgres-level authentication. It tries SCRAM (the
  default password flow), discovers no password was supplied, and
  fails before even contacting the IAM auth path.
- **Cause:** In Cloud SQL IAM-mode auth, the **password** that pg
  sends to Postgres is the impersonated service account's OAuth
  access token. The connector sets up TLS and certs but does **not**
  inject a password into the pg config — that's the caller's job.
  If `lib/db.ts` constructs `new Pool({ ...clientOpts, user, database })`
  without also providing `password: async () => authClient.getAccessToken()`,
  pg has nothing to send and falls through to SCRAM.
- **Fix:** Provide a `password` callback to `pg.Pool` that calls
  `authClient.getAccessToken()` on the same `IdentityPoolClient`
  used to construct the `Connector`. The callback runs per
  connection, so token expiry (~1h) is handled transparently.

  ```ts
  const pool = new Pool({
    ...clientOpts,
    user: dbUser,
    database: dbName,
    password: async () => {
      const tokenResponse = await authClient.getAccessToken();
      const token = typeof tokenResponse === 'string'
        ? tokenResponse
        : tokenResponse?.token;
      if (!token) throw new Error('IAM auth: empty access token');
      return token;
    },
  });
  ```

  This was the missing piece in WIF Phase 9 after §3.G was resolved
  (2026-05-01). The `Connector` only wraps the socket; the
  application is responsible for the per-connection token.

### I. `Client network socket disconnected before secure TLS connection was established`

- **Cause:** Transient — usually a concurrent request lost the race
  against an instance restart (e.g. immediately after toggling
  `cloudsql.iam_authentication=on`, which restarts the instance).
- **Fix:** Wait 30-60s for the instance to come back, then retry.
  If it persists past a minute, check Cloud Monitoring → Cloud SQL
  → instance state. If the instance is `RUNNABLE` and this still
  recurs, suspect Vercel function timeout or a network-level issue;
  check Vercel function region vs Cloud SQL region (should both be
  in `australia-southeast1` / `syd1`).

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

*Last Updated: 2026-05-01*
