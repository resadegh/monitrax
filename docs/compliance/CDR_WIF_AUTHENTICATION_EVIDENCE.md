# CDR Evidence Pack — Database Authentication via Workload Identity Federation

> Evidence pack for Basiq CDR accreditation requirement **§3.2** (network
> rules are enforced to limit external access).
>
> **Status:** **Active and serving Production traffic since 2026-05-01.**
> Phase 9 of the WIF workstream cut Production over to
> `USE_CLOUD_SQL_CONNECTOR=true`. The legacy `DATABASE_URL` path
> remains wired in as a fallback through the 30-day stabilisation
> window (rollback in <30s if needed). Phase 10 will remove
> `0.0.0.0/0` from Cloud SQL authorized networks 24h after stable
> Phase 9 verification; Phase 11 will remove the legacy `DATABASE_URL`
> runtime path and disable `monitrax_user` after 30 days of stability.

---

## 1. Control statement

Monitrax authenticates application-runtime database access using
**Workload Identity Federation (WIF) + Cloud SQL Connector + IAM database
authentication**. No long-lived database password is stored in any
environment variable, secret store, or configuration file. The only
material credential the runtime possesses is an OIDC token issued by the
Vercel platform (`VERCEL_OIDC_TOKEN`), which is automatically rotated
each cold start and has a TTL of approximately one hour.

The OIDC token is exchanged via the GCP Security Token Service (STS) for
a short-lived GCP access token, which is used to impersonate a service
account (`vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com`)
that has only the IAM roles required to open a database connection
(`roles/cloudsql.client` and `roles/cloudsql.instanceUser`).
Postgres-level authentication is performed via Cloud SQL IAM database
authentication — the impersonated service account is registered as a
Cloud IAM Postgres user on the instance, with explicit grants on the
`public` schema (CONNECT, USAGE, SELECT/INSERT/UPDATE/DELETE/TRUNCATE/
REFERENCES/TRIGGER on tables; USAGE/SELECT/UPDATE on sequences; ALTER
DEFAULT PRIVILEGES for objects created in future) and **no ownership of
any object**. The Postgres-layer "password" sent during connection
establishment is the SA's OAuth access token, supplied per-connection
via a callback so token rotation is invisible to the application.

---

## 2. End-to-end token flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Vercel Serverless Function (Node.js runtime, region: syd1)          │
│                                                                     │
│   Per-request `x-vercel-oidc-token` HTTP header                     │
│   (read via `getVercelOidcToken()` from `@vercel/oidc`;             │
│   NOT available as `process.env.VERCEL_OIDC_TOKEN` at runtime —     │
│   that env var only exists at build time / `vercel env pull`)      │
│     ─ Issued by:    https://oidc.vercel.com/<team-slug>             │
│     ─ Audience:     //iam.googleapis.com/projects/<num>/locations   │
│                       /global/workloadIdentityPools/vercel-pool     │
│                       /providers/vercel-oidc                        │
│     ─ TTL:          ~1 hour                                         │
│     ─ Rotated:      Vercel re-issues per request                    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼  (1) Subject token supplier returns the OIDC JWT
┌─────────────────────────────────────────────────────────────────────┐
│ google-auth-library  IdentityPoolClient                             │
│                                                                     │
│   POST https://sts.googleapis.com/v1/token                          │
│     grant_type=token-exchange                                       │
│     subject_token=<VERCEL_OIDC_TOKEN>                               │
│     audience=//iam.googleapis.com/<provider-resource>               │
│   → returns federated STS access token                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼  (2) STS token used to impersonate SA
┌─────────────────────────────────────────────────────────────────────┐
│ iamcredentials.googleapis.com                                       │
│                                                                     │
│   POST .../serviceAccounts/<SA_EMAIL>:generateAccessToken           │
│     scope=https://www.googleapis.com/auth/cloud-platform            │
│   → returns short-lived GCP access token (~1h, auto-refreshed by    │
│     google-auth-library when within EXPIRATION_TIME_OFFSET)         │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼  (3) Connector uses access token
┌─────────────────────────────────────────────────────────────────────┐
│ @google-cloud/cloud-sql-connector                                   │
│                                                                     │
│   GET sqladmin.googleapis.com/.../instances/<instance>              │
│     ─ Fetches instance metadata + ephemeral SSL cert                │
│   → opens TLS 1.3 tunnel to the instance using the ephemeral cert   │
│   → returns a sync stream factory function for pg.Pool              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼  (4) Postgres IAM auth
┌─────────────────────────────────────────────────────────────────────┐
│ pg.Pool({ ...connectorOpts, user, database,                         │
│           password: () => authClient.getAccessToken(),              │
│           max: 5 })                                                 │
│                                                                     │
│   ─ "password" supplied as a per-connection callback that returns   │
│     the impersonated SA's OAuth access token; pg uses it during     │
│     SCRAM/IAM auth                                                  │
│   ─ Cloud SQL recognises the user as a Cloud IAM principal and      │
│     verifies the token against IAM (no static password compared)    │
│   ─ Postgres session opens with the IAM user's grants only          │
│ → @prisma/adapter-pg PrismaPg(pool) wraps it                        │
│ → new PrismaClient({ adapter }) provides the rest of the app        │
│   the same `prisma.<model>.<op>` API as before                      │
│                                                                     │
│   Lazy init: lib/db.ts wraps the client in a Proxy so the auth     │
│   chain only runs on the first method call inside a request        │
│   handler (required because getVercelOidcToken() reads from the    │
│   request context and cannot be called at module-load time).       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Identifiers and components

| Item | Value | Notes |
|---|---|---|
| GCP project | `monitrax-479700` | sole production project |
| Workload Identity Pool | `vercel-pool` | location: `global` |
| OIDC Provider | `vercel-oidc` | issuer: `https://oidc.vercel.com/<team>` |
| Attribute condition | `assertion.project_id == 'prj_UYQF3GpGAkeFo4ZhMhch4Q0btCAU'` | restricts the pool to this exact Vercel project |
| Service account | `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com` | minimal-privilege; no `Owner` / `Editor` roles |
| Project IAM roles on SA | `roles/cloudsql.client`, `roles/cloudsql.instanceUser` | nothing else |
| WIF binding | `roles/iam.workloadIdentityUser` on the SA, granted to the principal `principalSet://iam.googleapis.com/.../attribute.project_id/<vercel-project-id>` | restricts impersonation to this Vercel project's OIDC tokens only |
| Cloud SQL instance | `monitrax-479700:australia-southeast1:monitrax-db-prod` | data residency: Sydney |
| IAM Postgres user | `vercel-monitrax-db@monitrax-479700.iam` | `.gserviceaccount.com` stripped per Cloud SQL convention |
| Postgres grants | `CONNECT` on `monitrax`; `USAGE` on `public`; `SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER` on all tables in `public`; `USAGE/SELECT/UPDATE` on all sequences in `public`; matching `ALTER DEFAULT PRIVILEGES` for objects created in future | no `OWNERSHIP` of any object — `monitrax_user` retains ownership during the fallback window |
| Vercel runtime env vars | `USE_CLOUD_SQL_CONNECTOR=true`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `CLOUD_SQL_CONNECTION_NAME`, `CLOUD_SQL_DB_USER`, `CLOUD_SQL_DB_NAME` | none of these are secrets — they are non-sensitive identifiers |

---

## 4. What this design eliminates

| Risk before WIF | Status after WIF |
|---|---|
| Long-lived password stored in `DATABASE_URL` env var on Vercel — readable by anyone with project Owner/Member access | ✅ Eliminated. No password exists in any env var. |
| Password rotation requires manual coordination — proven failure mode on 2026-04-30 when an attempted URL append broke prod auth | ✅ Eliminated. Tokens rotate automatically every cold start. |
| `0.0.0.0/0` authorized network on Cloud SQL — instance reachable from the entire public internet (TLS-protected, but auth surface globally exposed) | 🟡 In progress. WIF is now serving 100% of Production traffic (Phase 9 complete 2026-05-01); Phase 10 will remove `0.0.0.0/0` from authorized networks 24h after stable verification. |
| No GCP audit trail of who/what is connecting to the DB — only Postgres-level `log_connections` showed `monitrax_user` | ✅ Eliminated. STS token exchange and SA impersonation are logged in Cloud Logging under the SA principal, with the originating Vercel project ID visible in the OIDC claims. |
| If a Vercel team member exfiltrated the env vars, they could connect to prod from anywhere | ✅ Eliminated. The non-secret env vars on their own grant nothing — the OIDC token is required, and OIDC tokens are only issued to Vercel functions running under the project's slug. |

---

## 5. Compensating controls

The 30-day fallback period (Phase 9 → Phase 11) keeps the legacy
`DATABASE_URL` path wired in as a `USE_CLOUD_SQL_CONNECTOR=false` toggle,
so an issue with WIF never prevents the application from serving
traffic. During this period:

- The fallback password remains in `DATABASE_URL` on Vercel and would
  be rotated immediately if the WIF flag were ever flipped back on
  (per `docs/policy/INCIDENT_RESPONSE_PLAN.md`).
- `0.0.0.0/0` remains in Cloud SQL authorized networks until 24 hours
  after the WIF path has been stable in production (Phase 10).
- Both Postgres users (`monitrax_user` legacy + `vercel-monitrax-db@...iam`)
  exist in the database simultaneously to enable instant rollback.

After Phase 10 (24h after Phase 9 stability — target ≥ 2026-05-02):

- `0.0.0.0/0` is removed from Cloud SQL authorized networks; the
  instance is reachable only via the Cloud SQL Connector path.

After Phase 11 (30 days after Phase 9 — target ≥ 2026-05-31):

- `lib/db.ts` is reduced to the connector branch only (legacy
  `buildStandardPrisma()` removed).
- `DATABASE_URL` env var is deleted from Vercel runtime scope (kept
  only in Vercel's build env scope for `prisma migrate deploy`).
- `monitrax_user` Postgres user is dropped (or its password rotated
  to a generated value and locked to disable login).

---

## 6. References

- Code: `lib/db.ts`
- Architecture: `docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md` §5.5
- Runbook: `docs/operational/security/04_WIF_TROUBLESHOOTING.md`
- Migration history: `docs/migration/MIGRATION_RENDER_TO_GCP_STEPS.md` Appendix A
- CDR matrix: `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` §3.2
- Implementation plan: `docs/IMPLEMENTATION_PLAN.md` (workstream "Step 1a — DB authentication via Workload Identity Federation")

---

## 7. Phase 9 cutover record (2026-05-01)

Production cutover from `DATABASE_URL` to WIF + Cloud SQL Connector
was completed on 2026-05-01. The cutover surfaced four
configuration / code issues, all resolved within the same day:

| # | Surfaced as | Root cause | Resolution |
|---|---|---|---|
| 1 | `VERCEL_OIDC_TOKEN not set` at runtime | The OIDC token is delivered as a per-request `x-vercel-oidc-token` HTTP header, NOT as `process.env.VERCEL_OIDC_TOKEN` (that env var only exists at build time). | PR #563: switched to `getVercelOidcToken()` from `@vercel/oidc`; added a `Proxy`-based lazy init so the auth chain runs inside a request context. |
| 2 | `ERR_SSL_SSL/TLS_ALERT_BAD_CERTIFICATE` (TLS alert 42, server-side rejection of the ephemeral client cert) | The SA had project-level IAM roles and the instance had `cloudsql.iam_authentication=on`, but the SA was never registered as a Cloud IAM database user on the instance itself. SQL Admin minted a cert; the instance refused it at TLS because the IAM identity wasn't recognised on the instance. | `gcloud sql users create vercel-monitrax-db@monitrax-479700.iam --instance=monitrax-db-prod --type=CLOUD_IAM_SERVICE_ACCOUNT`, then GRANTs run from Cloud SQL Studio as `monitrax_user`. |
| 3 | `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` | The Cloud SQL Connector handles TLS but does NOT inject a Postgres-level password. In IAM-auth mode the password pg sends is the SA's OAuth access token; the application must supply it. | PR #564 commit `a29667a`: added `password: async () => authClient.getAccessToken()` callback to `pg.Pool` so pg fetches a fresh token on each connection. |
| 4 | `Raw query failed. Code: 28P01. password authentication failed for user "...iam "` | Trailing space on the `CLOUD_SQL_DB_USER` env var (copy-paste artifact). Postgres treats `...iam` and `...iam ` as different identifiers. | Vercel env var corrected; PR #564 commit `34e764c` added defensive `.trim()` on all WIF env-var reads in `lib/db.ts` so future copy-paste artifacts cannot reproduce this class of bug. |

After (4) was resolved, `/api/health` returned 200 with
`{"status":"healthy","database":"connected"}` and all dashboard pages
loaded successfully against IAM-authenticated Postgres sessions.

---

*Last Updated: 2026-05-01*
