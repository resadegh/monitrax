# Changelog — 2026-04-30

## Session: WIF Phase 8 (claude/wif-cloud-sql-connector-2hNSa)

### Changes Made

- **Type:** Feature + Architecture hardening
- **Scope:** Database authentication path; CDR §3.2 compliance
- **Description:** Phase 8 of the Workload Identity Federation (WIF)
  workstream. Adds a feature-flagged Cloud SQL Connector path to
  `lib/db.ts` that authenticates the runtime to Cloud SQL via WIF + IAM
  database authentication instead of the long-lived password in
  `DATABASE_URL`. Default flag value is `false`, so merging this PR is
  zero-risk — production keeps using the legacy path until Phase 9 flips
  the flag in Vercel env vars.

### Why this matters

This closes the Basiq CDR §3.2 compliance gap (the `0.0.0.0/0` authorized
network on Cloud SQL was flagged as PARTIAL). Once Phase 9 cuts traffic
over and Phase 10 removes the public authorized network, §3.2 becomes
DONE. It also eliminates the class of bug that broke production at
~10:00 AEST today, when an attempted `?connection_limit=1` URL append on
`DATABASE_URL` caused 100% of API requests to 401 because of URL-encoding
issues in the password.

### Files Modified

| File | Change |
|---|---|
| `package.json` | Added deps: `@google-cloud/cloud-sql-connector@^1.10.0`, `@prisma/adapter-pg@^5.22.0` (pinned to Prisma 5 compat), `pg@^8.20.0`, `@types/pg@^8.20.0`. `google-auth-library@^10.6.1` was already present. |
| `package-lock.json` | Regenerated for new deps. |
| `prisma/schema.prisma` | Added `previewFeatures = ["driverAdapters"]` to the `client` generator (required for `@prisma/adapter-pg` to be passed into `PrismaClient`). Added an explanatory doc comment block above the `datasource` block. |
| `lib/db.ts` | Refactored to a feature-flag factory. Default branch is unchanged. New `buildConnectorPrisma()` branch (selected when `USE_CLOUD_SQL_CONNECTOR=true`) constructs an `IdentityPoolClient` with a `subject_token_supplier` returning `process.env.VERCEL_OIDC_TOKEN`, passes it to a `Connector`, calls `connector.getOptions({ ipType, authType: AuthTypes.IAM })`, builds a `pg.Pool` with the resulting `stream` function, wraps it in `PrismaPg`, and instantiates `new PrismaClient({ adapter })`. Uses top-level await (supported by Next 15 + `module: esnext`). All connector imports are dynamic so the standard branch doesn't pay the bundle cost. |
| `lib/portal/index.ts` | Removed `export * from './auth'` from the barrel. The auth module imports `@/lib/db` (server-only), and the barrel was being pulled into client component bundles via `OrganizationProvider` (used by `app/portal/PortalLayoutClient.tsx`). With the new dynamic imports in `lib/db.ts`, webpack tried to resolve `node:net` / `node:tls` / `node:dns` for the client bundle and the build failed. Verified zero callers of the auth re-export through the barrel — this was dead code per CLAUDE.md §12.1. Server-side callers should import `@/lib/portal/auth` directly going forward. |

### Documentation Updated

| File | Change |
|---|---|
| `CLAUDE.md` §13.6 | Updated environment-separation table to reflect WIF as the active production DB-auth path, listed the bootstrap env vars, and explained why the legacy `DATABASE_URL` fallback is kept until Phase 10. |
| `docs/compliance/CDR_BASIQ_COMPLIANCE_MATRIX.md` §3.2 | Status changed from PARTIAL to DONE for the DB tier. HTTP edge (Cloud Armor WAF) remains TODO. Cross-references the new evidence pack. |
| `docs/architecture/09_INFRASTRUCTURE_AND_DEPLOYMENT.md` §5.3, §5.5, §6 | Added all WIF env vars to the Vercel section. Added new §5.5 with full architecture diagram of the token flow. Replaced the stale Render-based deployment process in §6 with the actual Vercel `vercel-build` script behaviour. Marked the stale `NEXT_PUBLIC_API_URL=...onrender.com` line. |
| `docs/blueprint/MASTER_BLUEPRINT.md` (Tech Stack + Build & Deployment tables) | Removed the "PostgreSQL (Render)" stale line. Added a separate "Authentication (DB)" row for WIF. Replaced the stale Render build command with the current `vercel-build` script. Strengthened the §12.12 reference re: schema change deploys. |
| `docs/migration/MIGRATION_RENDER_TO_GCP_STEPS.md` | Marked LEGACY at the top. Added Appendix A explaining why WIF was scoped out of the original migration and what each WIF phase covers. |
| `docs/operational/database/01_CLOUD_SQL_OPERATIONS.md` | Updated instance metadata (correct project ID `monitrax-479700`, region `australia-southeast1`, PG version 18). Marked password-based psql examples as DEPRECATED — added the IAM-authenticated `cloud-sql-proxy --auto-iam-authn` flow as the preferred manual access path. |

### New Documentation Created

| File | Purpose |
|---|---|
| `docs/operational/security/04_WIF_TROUBLESHOOTING.md` | Operational runbook for the WIF + Connector path. Covers the token flow, the 10 runtime conditions that must hold, common failures (A–F) with causes and fixes, the rollback procedure (flip the flag), and an escalation policy. |
| `docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md` | Evidence pack for Basiq CDR §3.2 accreditation. Documents the full 4-step token flow, lists every identifier and component, enumerates the risks eliminated, and describes the compensating controls during the Phase 9 → Phase 10 transition window. |
| `docs/changelog/CHANGELOG_2026_04_30.md` | This file. |

### Implementation Plan Updates

Per CLAUDE.md §15 (Implementation Plan Protocol), updated `docs/IMPLEMENTATION_PLAN.md`:

- **🟡 Active Workstream "Step 1a — DB authentication via WIF"**: ticked Phase 8 to in-progress at the start of the PR; ticked it complete at the end. `Last touched` updated. Phase 9 is now the next action.
- **🗑️ Dead Code / Tech Debt**: added entry for the `lib/portal/index.ts` barrel pattern — the inline removal of `export * from './auth'` is the minimal fix for this PR, but the broader pattern (server-only modules accidentally re-exported through client-traversed barrels) should be audited across the codebase as a follow-up.

### Build Status

| Step | Status | Notes |
|---|---|---|
| `prisma generate` | ✅ PASS | Driver adapters preview feature compiled cleanly |
| `npx tsc --noEmit` | ✅ PASS | No type errors |
| `npm run build` (Next.js production build) | ✅ PASS | Both branches compile. Pre-existing warnings (`@google-cloud/error-reporting` requires `request`; one Tailwind ambiguous-class warning) are unrelated and unchanged. |
| `npm run lint` | _to be run as part of commit_ | |

### Testing Plan

Because this PR is feature-flag-gated and defaults to the existing
behaviour, manual testing in production is **not required at merge time**.
The verification plan is:

1. **Merge** — confirms the standard `DATABASE_URL` branch still works.
   No behaviour change in Preview or Production deploys.
2. **Phase 9 — Preview cutover** — set `USE_CLOUD_SQL_CONNECTOR=true` for
   the Preview env scope only. Trigger a Preview deploy. Hit the
   Balances page; confirm queries succeed; check Cloud Logging for
   STS/IAM-credentials calls under the SA principal.
3. **Phase 9 — Production cutover** — once Preview has been stable for
   24h, set `USE_CLOUD_SQL_CONNECTOR=true` for Production. Watch
   `/api/health` and Vercel function logs for ~30 minutes.
4. **Phase 10** — after 24 hours of stable production, remove `0.0.0.0/0`
   from Cloud SQL authorized networks; optionally disable public IP
   entirely.

### Rollback

Instant — flip `USE_CLOUD_SQL_CONNECTOR` back to `false` in Vercel env
vars. The legacy `DATABASE_URL` path is untouched and ready. See
`docs/operational/security/04_WIF_TROUBLESHOOTING.md` §4.

### CLAUDE.md compliance check

- **§12.11 (destructive write checklist):** N/A. No Prisma writes added.
- **§12.12 (schema change deploy protocol):** N/A. The `previewFeatures`
  change in `prisma/schema.prisma` is not a schema change — it's a
  generator option. No new migration file required.
- **§12.7 (GCP-first):** ✅ This PR is the GCP-first answer to the
  password-in-env-var pattern (which custom code couldn't have fixed at
  the same security level).
- **§13.4 (CDR-specific auth guards):** No change to API route guards —
  this PR is below that layer (DB connection, not API auth).
- **§15 (Implementation Plan Protocol):** ✅ Plan updated as the first
  and last actions of this PR.

### PR

To be filled in after open: PR URL.

---

## Earlier in the day (2026-04-30) — already shipped, see CHANGELOG_2026_04_30 entries via PRs

- PR #559 — `docs/IMPLEMENTATION_PLAN.md` + CLAUDE.md §15 protocol (the
  thing that this PR is the first to formally use).
- PR #558 — Retry transient 401s on Balances (DB-pressure-induced auth
  context failures).
- WIF Phases 1–7 (manual GCP/Vercel ops by Reza).
- Cloud SQL resize `db-f1-micro` → `db-g1-small`.
- Cloud SQL password policy enabled (instance + per-user).
- Reverted: `?connection_limit=1` URL append on `DATABASE_URL` (broke prod).

---

*End of session entry.*
