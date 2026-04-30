# CDR Evidence Pack — Database Authentication via Workload Identity Federation

> Evidence pack for Basiq CDR accreditation requirement **§3.2** (network
> rules are enforced to limit external access).
>
> **Status:** Active in code (Phase 8 of WIF, 2026-04-30). Active in
> production after Phase 9 cutover. Public IP authorized network removed
> after Phase 10.

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
(`Cloud SQL Client` and `Cloud SQL Instance User`). Postgres-level
authentication is performed via Cloud SQL IAM database authentication —
the impersonated service account is mapped to a Postgres IAM user inside
the database, with explicit grants on the `public` schema and no
ownership of any object.

---

## 2. End-to-end token flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ Vercel Serverless Function (cold start)                             │
│                                                                     │
│   process.env.VERCEL_OIDC_TOKEN                                     │
│     ─ Issued by:    https://oidc.vercel.com/<team-slug>             │
│     ─ Audience:     //iam.googleapis.com/projects/<num>/locations   │
│                       /global/workloadIdentityPools/vercel-pool     │
│                       /providers/vercel-oidc                        │
│     ─ TTL:          ~1 hour                                         │
│     ─ Rotated:      every cold start (Vercel re-issues)             │
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
│ pg.Pool({ stream, user: '<SA>@<project>.iam', database, max: 5 })   │
│                                                                     │
│   ─ No password parameter                                           │
│   ─ Cloud SQL recognises the user as an IAM principal               │
│   ─ Postgres session opens with the IAM user's grants               │
│ → @prisma/adapter-pg PrismaPg(pool) wraps it                        │
│ → new PrismaClient({ adapter }) provides the rest of the app        │
│   the same `prisma.<model>.<op>` API as before                      │
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
| Postgres grants | `CONNECT` on `monitrax`, `USAGE` on `public`, `ALL` on tables/sequences in `public`, default privileges set | no `OWNERSHIP` of any object |
| Vercel runtime env vars | `USE_CLOUD_SQL_CONNECTOR=true`, `GCP_WORKLOAD_IDENTITY_PROVIDER`, `GCP_SERVICE_ACCOUNT_EMAIL`, `CLOUD_SQL_CONNECTION_NAME`, `CLOUD_SQL_DB_USER`, `CLOUD_SQL_DB_NAME` | none of these are secrets — they are non-sensitive identifiers |

---

## 4. What this design eliminates

| Risk before WIF | Status after WIF |
|---|---|
| Long-lived password stored in `DATABASE_URL` env var on Vercel — readable by anyone with project Owner/Member access | ✅ Eliminated. No password exists in any env var. |
| Password rotation requires manual coordination — proven failure mode on 2026-04-30 when an attempted URL append broke prod auth | ✅ Eliminated. Tokens rotate automatically every cold start. |
| `0.0.0.0/0` authorized network on Cloud SQL — instance reachable from the entire public internet (TLS-protected, but auth surface globally exposed) | 🟡 In progress. WIF works with public IP locked down; Phase 10 of the WIF workstream removes `0.0.0.0/0` from authorized networks. |
| No GCP audit trail of who/what is connecting to the DB — only Postgres-level `log_connections` showed `monitrax_user` | ✅ Eliminated. STS token exchange and SA impersonation are logged in Cloud Logging under the SA principal, with the originating Vercel project ID visible in the OIDC claims. |
| If a Vercel team member exfiltrated the env vars, they could connect to prod from anywhere | ✅ Eliminated. The non-secret env vars on their own grant nothing — the OIDC token is required, and OIDC tokens are only issued to Vercel functions running under the project's slug. |

---

## 5. Compensating controls

The 30-day fallback period (Phase 9 → Phase 10) keeps the legacy
`DATABASE_URL` path wired in as a `USE_CLOUD_SQL_CONNECTOR=false` toggle,
so an issue with WIF never prevents the application from serving
traffic. During this period:

- The fallback password remains in `DATABASE_URL` on Vercel and is
  rotated immediately if the WIF flag is flipped back on (per
  `docs/policy/INCIDENT_RESPONSE_PLAN.md`).
- `0.0.0.0/0` remains in Cloud SQL authorized networks until 24 hours
  after the WIF path has been stable in production.
- Both Postgres users (`monitrax_user` legacy + `vercel-monitrax-db@...iam`)
  exist in the database simultaneously to enable instant rollback.

After Phase 10:

- Both `0.0.0.0/0` and the legacy `monitrax_user` are removed.
- `lib/db.ts` is reduced to the connector branch only.
- `DATABASE_URL` env var is deleted from Vercel runtime scope (kept
  only in Vercel's build env scope for `prisma migrate deploy`).

---

## 6. References

- Code: `lib/db.ts`
- Architecture: `docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md` §5.5
- Runbook: `docs/operational/security/04_WIF_TROUBLESHOOTING.md`
- Migration history: `docs/migration/MIGRATION_RENDER_TO_GCP_STEPS.md` Appendix A
- CDR matrix: `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` §3.2
- Implementation plan: `docs/IMPLEMENTATION_PLAN.md` (workstream "Step 1a — DB authentication via Workload Identity Federation")

---

*Last Updated: 2026-04-30*
