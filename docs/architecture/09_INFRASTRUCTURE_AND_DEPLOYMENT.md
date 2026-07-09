# 09 — INFRASTRUCTURE AND DEPLOYMENT
### *Build, Deploy, and Database Management for Monitrax*

---

**Last Updated:** 2026-02-03
**Status:** Active

---

## 1. Overview

This document defines the infrastructure, build process, deployment pipeline, and database management strategy for Monitrax. It serves as the authoritative reference for all deployment-related operations.

---

## 2. Infrastructure Architecture

### 2.1 Platform Overview

| Component | Platform | Purpose |
|-----------|----------|---------|
| **Frontend** | Vercel | Next.js hosting, edge functions, CDN |
| **Backend API** | Render | API routes, background jobs |
| **Database** | Render PostgreSQL | Primary data store |
| **File Storage** | Google Cloud Storage | Document storage (Phase 19.3) |
| **Maps & Geocoding** | Google Maps Platform | Property locations (Phase 20) |

### 2.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      VERCEL (Frontend)                          │
│   • Next.js App Router                                          │
│   • React Server Components                                     │
│   • Edge Functions                                              │
│   • CDN / Static Assets                                         │
│   • Google Maps JavaScript API                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      RENDER (Backend)                           │
│   • Next.js API Routes                                          │
│   • Prisma ORM                                                  │
│   • Background Processing                                       │
│   • Google Geocoding API                                        │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
┌─────────────────────┐ ┌─────────────────┐ ┌─────────────────────┐
│  RENDER PostgreSQL  │ │  GOOGLE CLOUD   │ │  GOOGLE MAPS        │
│   (Database)        │ │  STORAGE        │ │  PLATFORM           │
│                     │ │                 │ │                     │
│ • Primary data      │ │ • Document      │ │ • Maps JavaScript   │
│ • Automated backups │ │   storage       │ │ • Geocoding API     │
│ • Prisma schema     │ │ • Signed URLs   │ │ • Places API        │
└─────────────────────┘ └─────────────────┘ └─────────────────────┘
```

---

## 3. Build Process

### 3.1 Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Start development server
npm run dev
```

### 3.2 Production Build Commands

**package.json scripts:**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && next build",
    "start": "next start",
    "postinstall": "prisma generate"
  }
}
```

### 3.3 Render Build Configuration

**render.yaml:**

```yaml
services:
  - type: web
    name: monitrax
    runtime: node
    buildCommand: npm install && npx prisma generate && npm run build
    startCommand: npm start
```

**NOTE:** The build command does NOT include `prisma db push`. Schema changes must be applied manually to protect legacy database tables. See Section 4.5 for manual schema sync procedures.

---

## 4. Database Management

### 4.1 Schema Management Strategy

Monitrax uses **manual schema synchronization** to protect legacy database tables:

| Command | Environment | Purpose |
|---------|-------------|---------|
| `prisma db push` | Manual only | Sync schema to database (run via Render Shell) |
| `prisma migrate dev` | Development | Create migration files (local only) |
| `prisma generate` | Build time | Generate Prisma client (safe, doesn't modify DB) |

### 4.2 Why Manual Schema Sync?

1. **Data Protection** — Prevents accidental deletion of legacy tables not in schema
2. **Controlled Changes** — Schema modifications are explicit and intentional
3. **Audit Trail** — Changes are reviewed before application
4. **Legacy Table Preservation** — Database contains tables for future features

### 4.3 Legacy Tables (Pending Audit)

The following tables exist in the database but are not in the Prisma schema:

| Table | Status | Notes |
|-------|--------|-------|
| `admin_users` | Preserved | May be needed for admin features |
| `admin_sessions` | Preserved | Admin authentication sessions |
| `import_batches` | Preserved | Transaction import tracking |
| `organization_invitations` | Preserved | Multi-tenant invitations |
| `organization_portal_settings` | Preserved | Portal configuration |
| `transaction_review_queue` | Preserved | Transaction review workflow |

These tables will be audited in a future cleanup phase to determine if they should be:
- Added to the schema (if actively used)
- Dropped (if confirmed unused)
- Migrated to new structures

### 4.3 Schema Change Workflow

```
1. Developer updates prisma/schema.prisma
2. Developer commits and pushes to branch
3. PR is merged to main
4. Render auto-deploys (or manual deploy triggered)
5. Build command runs: npx prisma db push
6. Database schema is automatically updated
7. Application starts with new schema
```

### 4.4 Database Backup Best Practices

Before major schema changes:

1. Go to **Render Dashboard** → **Your PostgreSQL Database**
2. Navigate to **"Backups"** tab
3. Click **"Create Backup"**
4. Wait for backup to complete before deploying

### 4.5 Manual Database Operations

If direct SQL execution is needed:

```bash
# Option 1: Render PSQL Console
# Render Dashboard → Database → PSQL tab

# Option 2: External connection
psql "your-render-database-url" -f script.sql

# Option 3: Database GUI (pgAdmin, DBeaver)
# Use External Database URL from Render Dashboard
```

---

## 5. Environment Configuration

### 5.1 Required Environment Variables

| Variable | Description | Where Set | Required? |
|----------|-------------|-----------|-----------|
| `DATABASE_URL` | PostgreSQL connection string | Vercel build scope | Always (build) |
| `NODE_ENV` | Environment mode | Vercel | Always |
| `NEXT_PUBLIC_API_URL` | API base URL | Vercel | Always |
| `USE_CLOUD_SQL_CONNECTOR` + WIF vars (5) | Phase 9 WIF runtime DB auth — see §5.3 | Vercel runtime | PROD since 2026-05-01 |
| `STRIPE_SECRET_KEY` + 5 related (Phase 32C PR6) | Stripe billing test-mode | Vercel | Optional — billing UI gracefully disables when unset |
| `SENDGRID_API_KEY` + 2 related (Phase 32C PR4d) | Conversation email-through-app | Vercel | Optional — outbound mirror falls through to console-log when unset |
| `GCS_PROJECT_ID` + `GCS_BUCKET_NAME` (Phase 50) | Google Cloud Storage for documents. **Keyless** — the GCS client reuses the existing WIF identity (`GCP_WORKLOAD_IDENTITY_PROVIDER` + `GCP_SERVICE_ACCOUNT_EMAIL`, already set for the DB) via `lib/gcp/wifAuthClient.ts`; **no service-account key needed.** The storage factory auto-selects GCS as the default backend once `GCS_BUCKET_NAME` (+ `GCS_PROJECT_ID`) are present (`lib/documents/storage/factory.ts`); otherwise it falls back to Monitrax DB (Postgres bytea). Reads stream through `/api/documents/download` (keyless can't sign native v4 URLs). | Vercel | Pending prod provisioning (bucket + IAM grant + these 2 vars) — until set, uploads persist to the DB |
| `GCS_SERVICE_ACCOUNT_KEY` (legacy, optional) | A base64 SA key. **Only** if you deliberately want native GCS signed URLs instead of keyless streaming. Omit it to stay keyless (recommended — §13.6). | Vercel | Optional — leave unset for the keyless path |
| `GOOGLE_MAPS_API_KEY` (Phase 20) | Property location lookup | Vercel | Required for Google Maps integration |
| `GEMINI_API_KEY` (Phase 27) | All AI features (CFO advice, document analysis, AskAPro suggestions) | Vercel | Required for AI features |

### 5.2 Render Environment Variables

Set in **Render Dashboard** → **Environment**:

```
DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=<auto-generated>
NODE_ENV=production

# Google Cloud Storage (Phase 19.3)
GCS_PROJECT_ID=monitrax-479700
GCS_BUCKET_NAME=monitrax-documents
GCS_SERVICE_ACCOUNT_KEY=<base64-encoded-service-account-json>

# Google Maps API (Phase 20)
GOOGLE_MAPS_API_KEY=<your-api-key>
```

### 5.3 Vercel Environment Variables

Set in **Vercel Dashboard** → **Settings** → **Environment Variables**:

```
NEXT_PUBLIC_API_URL=https://monitrax.onrender.com   # ⚠️ STALE — Render is no longer the API host. App is now self-hosted on Vercel after the 2026-04-10 migration.

# Google Maps API (Phase 20) - Frontend
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=<your-api-key>

# --- Workload Identity Federation → Cloud SQL (Phase 9 of WIF, 2026-05-01) ---
# These five vars switch the Prisma client from password-in-DATABASE_URL auth
# to short-lived OIDC tokens exchanged for GCP credentials. None of them are
# secrets in their own right — the runtime OIDC token (delivered as the
# `x-vercel-oidc-token` request header) is the only thing that grants access.
# IMPORTANT: All values must have NO leading or trailing whitespace.
# `lib/db.ts` defensively `.trim()`s these on read, but Vercel's env-var
# UI has historically retained pasted whitespace and produced 28P01
# `password authentication failed for user "...iam "` — see
# `04_WIF_TROUBLESHOOTING.md` §3.J for the precedent.
USE_CLOUD_SQL_CONNECTOR=true                         # feature flag; PROD = true since 2026-05-01
GCP_WORKLOAD_IDENTITY_PROVIDER=projects/<num>/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-oidc
GCP_SERVICE_ACCOUNT_EMAIL=vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com
CLOUD_SQL_CONNECTION_NAME=monitrax-479700:australia-southeast1:monitrax-db-prod
CLOUD_SQL_DB_USER=vercel-monitrax-db@monitrax-479700.iam   # IAM-mapped Postgres user (no .gserviceaccount.com suffix)
CLOUD_SQL_DB_NAME=monitrax

# Optional overrides
# CLOUD_SQL_IP_TYPE=PUBLIC      # PUBLIC (default) | PRIVATE | PSC
# CLOUD_SQL_POOL_MAX=5          # pg.Pool max connections (default 5)

# Fallback (kept until Phase 10 of WIF lands):
DATABASE_URL=postgresql://...   # only used when USE_CLOUD_SQL_CONNECTOR=false
                                # also used by `prisma migrate deploy` at build time

# --- Phase 32C PR4d: SendGrid email-through-app (added 2026-05-07) ---
# The conversation thread (in-app messages between consumer + adviser)
# auto-mirrors outbound messages via email; replies route back via
# SendGrid Inbound Parse webhook. When SENDGRID_API_KEY is unset,
# outbound is a no-op + console-log + audit row (dev/demo works
# without secrets; the architectural pattern is visible).
# See `lib/email/conversationEmail.ts` and PR4d in
# IMPLEMENTATION_PLAN.md for hardening (DKIM/SPF strict, signed-event
# verification, sender-domain allowlist, Cloud DLP attachment scanning,
# rate-limiting per conversation) — all DEFERRED to PROD.
SENDGRID_API_KEY=<sendgrid-api-key>                  # optional; outbound mirror disabled when unset
MONITRAX_INBOUND_FROM_ADDRESS=no-reply@monitrax.com.au  # outbound From header
MONITRAX_INBOUND_DOMAIN=reply.monitrax.com.au        # base domain for reply-to slugs (monitrax+conv-<slug>@<domain>)

# --- Phase 32C PR6: Stripe test-mode billing (added 2026-05-08) ---
# Stripe is the source of truth for subscription state; we mirror via
# signed webhooks. When STRIPE_SECRET_KEY is unset, /portal/billing
# renders a "Configure billing in your env" notice instead of crashing
# (dev/demo works without secrets). Test-mode keys at v1; live mode
# cutover post-Basiq accreditation per IMPLEMENTATION_PLAN.md DEFERRED
# bucket.
# See `lib/services/stripeBillingService.ts`.
STRIPE_SECRET_KEY=sk_test_<stripe-test-key>          # optional; billing UI shows NOT_CONFIGURED notice when unset
STRIPE_WEBHOOK_SECRET=whsec_<stripe-webhook-secret>  # required when STRIPE_SECRET_KEY is set
STRIPE_STUDIO_PRICE_ID=price_<studio-tier-price-id>  # AU$199/mo recurring
STRIPE_PRACTICE_PRICE_ID=price_<practice-tier-price-id>  # AU$599/mo recurring
BILLING_SUCCESS_URL=https://www.monitrax.com.au/portal/billing?success=true   # post-checkout redirect; defaults to NEXT_PUBLIC_APP_URL
BILLING_CANCEL_URL=https://www.monitrax.com.au/portal/billing?cancelled=true  # cancel redirect; defaults to NEXT_PUBLIC_APP_URL
```

> See `lib/db.ts` for the runtime selection logic and
> `docs/operational/security/04_WIF_TROUBLESHOOTING.md` for the runbook.

### 5.4 Google Cloud Setup

To encode your service account key for `GCS_SERVICE_ACCOUNT_KEY`:

```bash
# Mac/Linux
base64 -i service-account-key.json | tr -d '\n'

# Windows PowerShell
[Convert]::ToBase64String([System.IO.File]::ReadAllBytes("service-account-key.json"))
```

### 5.5 Database Authentication Flow (WIF + Cloud SQL Connector)

> **Active and serving Production traffic since 2026-05-01.**
> Phase 9 of the WIF workstream cut over Production to
> `USE_CLOUD_SQL_CONNECTOR=true`. The legacy `DATABASE_URL` path
> remains wired in as a fallback (for instant rollback during the
> 30-day stabilisation window) and as the build-time path for
> `prisma migrate deploy`. It will be removed in Phase 10 along
> with the `0.0.0.0/0` Cloud SQL authorized network.

```
                  ┌────────────────────────────────────────────┐
                  │  Vercel Serverless Function (Node.js)      │
                  │  Per-request `x-vercel-oidc-token` header  │
                  │  (NOT an env var — the token only exists   │
                  │  inside a request context). Read via       │
                  │  getVercelOidcToken() from @vercel/oidc.   │
                  └────────────────────┬───────────────────────┘
                                       │
                                       ▼
                  ┌────────────────────────────────────────────┐
                  │  google-auth-library  IdentityPoolClient   │
                  │  ─ subject_token_supplier returns the      │
                  │    Vercel OIDC token                       │
                  │  ─ exchange via STS for an STS token       │
                  │  ─ impersonate the service account via     │
                  │    iamcredentials.googleapis.com           │
                  │  → returns a short-lived GCP access token  │
                  │    (~1h, scoped to the SA)                 │
                  └────────────────────┬───────────────────────┘
                                       │
                                       ▼
                  ┌────────────────────────────────────────────┐
                  │  @google-cloud/cloud-sql-connector         │
                  │  ─ uses the GCP access token to fetch an   │
                  │    ephemeral client cert from the          │
                  │    Cloud SQL Admin API                     │
                  │  ─ opens a TLS 1.3 tunnel to the instance  │
                  │  → returns pg-compatible socket options    │
                  └────────────────────┬───────────────────────┘
                                       │
                                       ▼
                  ┌────────────────────────────────────────────┐
                  │  pg.Pool({ ...connectorOpts,               │
                  │            user, database,                 │
                  │            password: () =>                 │
                  │              authClient.getAccessToken()   │
                  │          })                                │
                  │  + @prisma/adapter-pg PrismaPg(pool)       │
                  │  + new PrismaClient({ adapter })           │
                  │  ─ Postgres-level auth: IAM auth using     │
                  │    the SA OAuth access token as password   │
                  │    (per-connection callback, fresh each    │
                  │    time so token TTL is invisible)         │
                  └────────────────────────────────────────────┘
```

**Lazy initialisation note.** `lib/db.ts` constructs the client behind
a `Proxy` so the auth chain only runs on the first method call inside
a request handler. This is required because `getVercelOidcToken()`
reads the token from the request context — it can't be called at
module load time. The Proxy caches the resulting `PrismaClient` on
`globalThis` so subsequent requests on the same warm function reuse it.

**Required GCP-side configuration** (one-time, all done as of Phase 9):

1. Service account `vercel-monitrax-db@monitrax-479700.iam.gserviceaccount.com`
   with **both** `roles/cloudsql.client` and `roles/cloudsql.instanceUser`
   at the project level.
2. Workload Identity Pool `vercel-pool` with OIDC provider `vercel-oidc`,
   attribute condition `assertion.project_id == 'prj_UYQF...'`.
3. WIF principal bound to the SA via `roles/iam.workloadIdentityUser`.
4. Cloud SQL instance flag `cloudsql.iam_authentication=on`.
5. SA registered as a Cloud IAM **database** user on the instance via
   `gcloud sql users create vercel-monitrax-db@monitrax-479700.iam
   --type=CLOUD_IAM_SERVICE_ACCOUNT`.
6. Postgres grants on the `public` schema (CONNECT, USAGE,
   SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER on tables;
   USAGE/SELECT/UPDATE on sequences; ALTER DEFAULT PRIVILEGES for new
   objects).

**Why this is better than `DATABASE_URL`:**

| Aspect | `DATABASE_URL` (legacy, fallback only) | WIF + Connector (active) |
|---|---|---|
| Credential lifetime | indefinite (until rotated manually) | ~1h (OIDC token) → ~1h (GCP access token); rotation invisible to app |
| Stored secret in Vercel | yes, as plaintext password | no — only non-secret identifiers |
| Network exposure | requires `0.0.0.0/0` authorized network | scheduled to be locked down in Phase 10 (after 24h of stable Phase 9) |
| Audit trail in GCP Cloud Logging | none | full STS + IAM Credentials + Cloud SQL audit chain under the SA |
| Rotation risk | URL-encoding bugs (see 2026-04-30 incident) | rotation is automatic per connection |

---

## 6. Deployment Process

### 6.1 Automatic Deployment (Recommended)

1. Push code to `main` branch
2. **Vercel** detects changes and triggers a build (Render is no longer in the loop — see migration doc).
3. Build command executes (`vercel-build` script in `package.json`):
   - `npm run lint:financial-surfaces` (static-analysis gate; fails build on new violations)
   - `npm run neomatrix:check` (Neomatrix build gate, added 2026-06-23 — CLAUDE.md Part 21; validates `financial-graph.json` schema + the A3 orphan/convergence invariants + engine `file:line` anchors + `GENERATED_CORE.md` freshness; aborts the build before the DB migrate if the financial-logic graph is invalid, stale, or self-contradictory)
     > **Bundle note (N2 explorer, 2026-06-24):** the admin-only Neomatrix explorer (`/admin/neomatrix`) adds `react-force-graph-3d` (three.js, ~600KB). It is **dynamically imported (`ssr:false`) and route-scoped to the admin tool**, so it loads only on that route and never enters the user-facing bundle (§12.7). See `PHASE_53_MONITRAX_NEOMATRIX.md` §15.
   - `prisma migrate deploy` (applies any new migration; aborts the deploy on failure — see CLAUDE.md §12.12)
   - `prisma generate`
   - `npm run seed:feature-flags` (idempotent upsert of canonical `GlobalFeatureFlag` rows from `prisma/seed-feature-flags.ts`; never overwrites the operator-controlled `enabled` column; added 2026-05-17 so new flag rows auto-appear in `/admin/feature-flags` on next deploy)
   - `next build`
4. New deployment is promoted only if the build succeeds.

### 6.2 Manual Deployment

1. Go to **Vercel Dashboard** → **Your Project**
2. Click **Deployments** → **Promote to Production** on a previous green build, or **Redeploy** on the current commit.
3. Monitor build logs for success.

> ⚠️ Render-based deployment (the legacy path described in earlier revisions of this doc) was retired during the 2026-04-10 migration. See `docs/migration/MIGRATION_RENDER_TO_GCP_STEPS.md`.

### 6.3 Deployment Checklist

Before deploying major changes:

- [ ] TypeScript compiles without errors (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] Database backup created (for schema changes)
- [ ] Environment variables updated (if needed)
- [ ] PR reviewed and approved

---

## 7. Monitoring and Health Checks

### 7.1 Health Check Endpoint

```
GET /api/health
```

Render uses this endpoint to verify application health.

### 7.2 Monitoring Locations

| Metric | Location |
|--------|----------|
| Build Logs | Render Dashboard → Events |
| Runtime Logs | Render Dashboard → Logs |
| Database Metrics | Render Dashboard → Database → Metrics |
| Frontend Metrics | Vercel Dashboard → Analytics |

---

## 8. Troubleshooting

### 8.1 Build Failures

**Issue:** `prisma db push` fails

**Solution:**
- Check DATABASE_URL is correctly set
- Verify database is accessible
- Check for schema conflicts

**Issue:** TypeScript compilation errors

**Solution:**
- Run `npm run build` locally first
- Fix all type errors before pushing

### 8.2 Database Issues

**Issue:** Schema out of sync

**Solution:**
- Trigger manual deploy on Render
- Or run `npx prisma db push` directly via Render Shell

**Issue:** Need to rollback schema

**Solution:**
1. Revert the schema change in code
2. Deploy the reverted code
3. `prisma db push` will sync the rollback

### 8.3 Connection Issues

**Issue:** Cannot connect to database

**Solution:**
- Verify DATABASE_URL in Render environment
- Check database is running (Render Dashboard)
- Verify IP allowlist if using external tools

---

## 9. Security Considerations

### 9.1 Database Security

- Database URL contains credentials — never commit to git
- Use Render's auto-injection for DATABASE_URL
- External connections require SSL

### 9.2 Build Security

- Dependencies are installed fresh on each build
- `npm audit` should be run periodically
- Keep Node.js version updated in Render settings

### 9.3 Secrets Management

- All secrets stored in Render/Vercel environment variables
- JWT_SECRET is auto-generated by Render
- Never log or expose secrets in code

---

## 10. Quick Reference

### Common Commands

```bash
# Local development
npm run dev

# Build for production
npm run build

# Generate Prisma client
npx prisma generate

# Sync schema to database (what Render does)
npx prisma db push

# Open Prisma Studio (database GUI)
npx prisma studio

# View database schema
npx prisma db pull
```

### Key URLs

| Service | URL |
|---------|-----|
| Render Dashboard | https://dashboard.render.com |
| Vercel Dashboard | https://vercel.com/dashboard |
| GitHub Repository | https://github.com/resadegh/monitrax |

---

## 10a. Build: server-only native packages (`serverExternalPackages`)

`next.config.ts` marks server-only packages as external so Next does **not**
webpack-bundle them. Current list: `@prisma/client`, `prisma`, `pdfkit`,
`fontkit`.

- **Why `pdfkit`/`fontkit` (added 2026-07-08):** the tax-pack PDF export route
  (`app/api/bookkeeping/tax-pack/export/route.ts` → `lib/bookkeeping/taxPack/pdfExporter.ts`)
  pulls `pdfkit → fontkit → restructure`, which does an **optional**
  `require('iconv-lite')`. When webpack tries to bundle it, cold builds
  intermittently fail with `Module not found: Can't resolve 'iconv-lite' in
  node_modules/restructure/src`, erroring the Vercel deploy. Externalizing
  loads them via native `require` at runtime, where the optional require is a
  guarded try/catch — builds become deterministic.
- **Rule:** any new server-only package that (a) is never imported by client
  components and (b) does optional/native requires webpack can't resolve should
  be added here rather than bundled.

## 11. Revision History

| Date | Change | Author |
|------|--------|--------|
| 2025-12-04 | Initial document creation | Claude |
| 2026-07-08 | Externalized `pdfkit`/`fontkit` (`serverExternalPackages`) — fixes intermittent cold-build `iconv-lite` resolution failure (§10a) | Claude |

---

**END OF INFRASTRUCTURE AND DEPLOYMENT DOCUMENTATION**
