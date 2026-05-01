# Changelog — 2026-05-01

## Session: claude/review-monitrax-docs-GgeVM (afternoon)

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

- [ ] `npm run build` — pending verification (run before commit)
- TypeScript-only changes to `lib/db.ts`; no schema change; no
  destructive Prisma writes

### Commits

| Hash | Message |
|---|---|
| (pending) | fix(db): wrap pg TLS handshake errors with runbook pointer; doc §3.G |

### Operational status (end of session)

- `USE_CLOUD_SQL_CONNECTOR=true` in Vercel Production (kept on per
  Reza's call — no users, debugging in place)
- Phase 9 progressed two more layers in this session:
  1. **§3.G TLS bad_cert resolved** — root cause was that the
     SA was never registered as a Cloud IAM database user on the
     instance. Fixed via `gcloud sql users create
     vercel-monitrax-db@monitrax-479700.iam --type=CLOUD_IAM_SERVICE_ACCOUNT`
     plus the public-schema grants run from Cloud SQL Studio as
     `monitrax_user`. This contradicted the ✅ tick on Phase 1 of
     the WIF workstream — the step was either never run or run
     against the wrong instance. Phase 1 retroactively re-verified.
  2. **§3.H SASL no-password surfaced and fixed in code** —
     after TLS, pg fell through to SCRAM and crashed because
     no password was ever supplied to the pool. In Cloud SQL IAM
     mode the password is the SA's OAuth access token; the
     `Connector` wraps the socket but does NOT inject the token
     into pg config. Added a `password: async () => authClient
     .getAccessToken()` callback in `lib/db.ts` so pg fetches a
     fresh token per connection (handles the ~1h token TTL
     transparently). Documented in §3.H.
- Next action: redeploy on Vercel, hit `/api/health`, expect 200.

### Refs

- `docs/IMPLEMENTATION_PLAN.md` — Workstream #1, Phase 9
- `docs/operational/security/04_WIF_TROUBLESHOOTING.md` §3.G
- PR #563 (precursor — OIDC header fix)
- `docs/changelog/CHANGELOG_2026_04_30.md` — Phase 8 ship
