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

- `lib/db.ts` — wrapped `prisma.<model>.<method>()` and
  `prisma.$<method>()` calls in the lazy connector Proxy with TLS
  error detection. When pg surfaces a TLS error
  (`code` starts with `ERR_SSL_` or message matches
  `tls alert|bad[_ ]certificate|ssl3_read_bytes`), the original error
  is wrapped with a clear pointer to
  `04_WIF_TROUBLESHOOTING.md` §3.G and the three most likely causes.
  The original error is preserved as `cause` so nothing is lost.
- `docs/operational/security/04_WIF_TROUBLESHOOTING.md` — added §3.G
  "TLS bad_certificate" with the verification gcloud commands and the
  most-common single fix (`patch ... --database-flags=cloudsql.iam_authentication=on`).
- `docs/IMPLEMENTATION_PLAN.md` — Phase 9 entry expanded with the new
  blocker, hypothesis, and rollback note (deferred — site has no users
  yet, flag stays `true` while we diagnose).

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
- Site is currently broken (all API routes 401 → DB connect fails)
- Next action: Reza runs the §3.G verification commands, fixes whichever
  GCP-side condition is wrong, and the cold start after that should
  succeed.

### Refs

- `docs/IMPLEMENTATION_PLAN.md` — Workstream #1, Phase 9
- `docs/operational/security/04_WIF_TROUBLESHOOTING.md` §3.G
- PR #563 (precursor — OIDC header fix)
- `docs/changelog/CHANGELOG_2026_04_30.md` — Phase 8 ship
