# Changelog — 2026-05-01

## Session: claude/review-monitrax-docs-GgeVM

### Outcome

**WIF Phase 9 cutover COMPLETE.** Production database authentication is
now fully on Workload Identity Federation + Cloud SQL Connector + IAM
database auth, end-to-end. `/api/health` returns 200 with
`{"status":"healthy","database":"connected"}`; the dashboard loads;
all API routes 200. No long-lived password is required at runtime.

### Context

Previous session shipped PR #563 — switched `lib/db.ts` to read the Vercel
OIDC token via `getVercelOidcToken()` (from the `x-vercel-oidc-token`
request header, not `process.env.VERCEL_OIDC_TOKEN`) and added a Proxy
to defer connector init until the first method call inside a request
context. With `USE_CLOUD_SQL_CONNECTOR=true` in Vercel Production after
the merge, every API route returned 401 in the browser and the Vercel
function logs surfaced:

```
PrismaClientKnownRequestError: ... C0D85FC5...:error:0A000412:
SSL routines:ssl3_read_bytes:ssl/tls alert bad certificate:
ssl/record/rec_layer_s3.c:912:SSL alert number 42
code: 'ERR_SSL_SSL/TLS_ALERT_BAD_CERTIFICATE'
clientVersion: '5.22.0'
```

### Diagnosis

The OIDC fix from PR #563 worked. Every layer up to and including the
SQL Admin API call (which mints an ephemeral client cert) succeeded.
The failure is at the **mutual-TLS handshake** between the Cloud SQL
Connector and the instance — TLS alert 42 (`bad_certificate`) is sent
**by the server**, meaning the Cloud SQL instance is rejecting the
ephemeral client cert at handshake.

Likely causes (in order of probability):

1. The instance flag `cloudsql.iam_authentication` is OFF. IAM
   authentication is opt-in per Cloud SQL instance — without the
   flag, the instance refuses IAM-issued certs at TLS layer.
2. The SA `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com`
   has `roles/cloudsql.client` (enough to mint a cert) but not
   `roles/cloudsql.instanceUser` (required for the instance to
   accept the cert for IAM-mode auth).
3. `CLOUD_SQL_CONNECTION_NAME` env var has a typo, so the cert is
   minted for instance A but the connector opens a TCP socket to
   instance B.

### Changes Made

- **Type:** Diagnostic + docs
- **Scope:** `lib/db.ts`, WIF runbook, IMPLEMENTATION_PLAN

### Files Modified

- `lib/db.ts` —
  (1) wrapped `prisma.<model>.<method>()` and `prisma.$<method>()`
  calls in the lazy connector Proxy with TLS error detection. When
  pg surfaces a TLS error, the original is rewrapped with a clear
  pointer to `04_WIF_TROUBLESHOOTING.md` §3.G + the three most-likely
  causes; original preserved as `cause`.
  (2) Added `password: async () => authClient.getAccessToken()` to
  the `pg.Pool` config in `buildConnectorPrisma()` so pg has the
  SA's OAuth access token to send during Postgres-level auth. This
  fixes the `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must
  be a string` error that surfaced after the TLS layer was unblocked.
- `docs/operational/security/04_WIF_TROUBLESHOOTING.md` —
  added §3.G "TLS bad_certificate" with verification gcloud commands
  + the most-common fix; added §3.H "SASL no-password" documenting
  the password-callback fix; added §3.I for the transient
  `socket disconnected before secure TLS` error seen during the
  instance restart that toggling the IAM flag triggers.
- `docs/IMPLEMENTATION_PLAN.md` — Phase 9 entry expanded with the
  new blocker, the §3.G GCP-side fix that resolved it, and the §3.H
  follow-on code fix.

### Build Status

- [x] `npm run build` — passes
- [x] TypeScript-only changes to `lib/db.ts`; no schema change; no
  destructive Prisma writes
- [x] Manually verified end-to-end against Production:
  `/api/health` → 200, dashboard loads, balances render

### Commits

| Hash | Message |
|---|---|
| `5c0229b` | fix(db): wrap pg TLS handshake errors with runbook pointer; doc §3.G |
| `a29667a` | fix(db): supply SA OAuth token as pg password for Cloud SQL IAM auth |
| `34e764c` | fix(db): trim WIF env vars on read; runbook §3.J for 28P01 + trailing whitespace |
| (this commit) | docs: WIF Phase 9 doc sync — mark complete across all references |

### Operational status (end of session)

- ✅ `USE_CLOUD_SQL_CONNECTOR=true` in Vercel **Production**
- ✅ `/api/health` returns 200 with
  `{"status":"healthy","database":"connected"}`
- ✅ `/dashboard/balances` loads; all API routes 200
- ✅ No long-lived password in any runtime env var
- ✅ Cloud Logging shows STS + IAM Credentials calls under
  `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com`

### Layer-by-layer status

| Layer | Status |
|---|---|
| OIDC token retrieval (per-request header) | ✅ |
| STS token exchange | ✅ |
| Service account impersonation | ✅ |
| SQL Admin API ephemeral cert minting | ✅ |
| mTLS handshake to Cloud SQL instance | ✅ |
| Postgres IAM auth (SA token as password) | ✅ |
| `public`-schema query authorization | ✅ |

### Phase 9 timeline (single-day cutover)

| When | What |
|---|---|
| Morning | Cutover attempt blocked by `VERCEL_OIDC_TOKEN not set`. PR #563 (OIDC header + Proxy lazy init) merged. |
| Early afternoon | After redeploy, surfaced TLS alert 42 / `bad_certificate`. PR #564 commit `5c0229b` added error wrapper + runbook §3.G. |
| Mid afternoon | Ran §3.G verification commands; found SA was not a Cloud IAM DB user on the instance. `gcloud sql users create` + GRANTs in Cloud SQL Studio as `monitrax_user`. |
| Late afternoon | Surfaced SASL no-password. PR #564 commit `a29667a` added `password` callback to `pg.Pool` + runbook §3.H. |
| Early evening | Surfaced 28P01 with trailing space in error. Vercel env var corrected. PR #564 commit `34e764c` added `.trim()` defence + runbook §3.J. |
| Evening | `/api/health` 200. Phase 9 complete. Doc sync (this commit). |

### Next steps

- **Phase 10** (queued, +24h): remove `0.0.0.0/0` from Cloud SQL
  authorized networks. Verify connector path still works (it should —
  Connector uses SQL Admin API + TLS tunnel, not the public auth
  surface).
- **Phase 11** (queued, +30 days): drop legacy `buildStandardPrisma()`
  branch, remove `DATABASE_URL` from runtime env scope (keep build),
  disable / drop `monitrax_user`.
- **Side observation:** `/api/health` log shows Edge → `iad1` despite
  `vercel.json` `regions: ["syd1"]`. Non-blocking — investigate during
  Phase 10.

### Refs

- `docs/IMPLEMENTATION_PLAN.md` — Workstream #1, Phase 9
- `docs/operational/security/04_WIF_TROUBLESHOOTING.md` §3.G
- PR #563 (precursor — OIDC header fix)
- `docs/changelog/CHANGELOG_2026_04_30.md` — Phase 8 ship
