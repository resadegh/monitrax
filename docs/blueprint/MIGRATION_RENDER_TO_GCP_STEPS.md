# Migration Steps: Render PostgreSQL → GCP Cloud SQL

> **Parent Doc:** [MIGRATION_RENDER_TO_GCP_PLAN.md](./MIGRATION_RENDER_TO_GCP_PLAN.md)
> **Status:** PLANNING | Created: 2026-04-09

---

## Phase 1: GCP Cloud SQL Instance Setup — TWO INSTANCES (YOU DO)

**Goal:** Create TWO Cloud SQL PostgreSQL instances: one for PROD, one for DEV/UAT.

### Step 1a: Create PRODUCTION Instance

1. **Go to GCP Console** → SQL → Create Instance → PostgreSQL
2. **Configuration:**
   - Instance ID: `monitrax-db-prod`
   - Password: Generate a strong password, save securely
   - PostgreSQL version: Match your Render version (run `SELECT version();` on Render to check)
   - Region: `australia-southeast1` (Sydney) — CDR data residency requirement
   - Zone availability: **High Availability** recommended for production
3. **Machine type:** `db-f1-micro` (shared core, 614MB RAM) — cheapest option, scale up later if needed
4. **Storage:** SSD, 10GB minimum (auto-resize enabled)
5. **Connections:**
   - Enable **Public IP** (required for Vercel connectivity)
   - Require **SSL** for all connections
6. **Backups:**
   - Enable automated backups (daily)
   - Enable point-in-time recovery
   - Backup retention: 7 days minimum
7. **Maintenance:** Set a preferred window (low-traffic time in your timezone)

### Step 1b: Create DEV/UAT Instance

1. **GCP Console** → SQL → Create Instance → PostgreSQL
2. **Configuration:**
   - Instance ID: `monitrax-db-dev`
   - Password: Different password from PROD, save securely
   - PostgreSQL version: **Same version as PROD**
   - Region: `australia-southeast1` (Sydney) — same as PROD
   - Zone availability: **Single zone** (cost saving, no HA needed)
3. **Machine type:** `db-f1-micro` (shared core, cheapest — ~$7-10/month)
4. **Storage:** SSD, 10GB (auto-resize enabled)
5. **Connections:**
   - Enable **Public IP**
   - Require **SSL**
6. **Backups:** Weekly or manual only (not critical for dev)
7. **Maintenance:** Any window

### What I need from you after this step:
- PROD instance: connection name, public IP, PostgreSQL version
- DEV instance: connection name, public IP
- Database users and passwords for both instances

---

## Phase 2: Database & User Setup on Cloud SQL (YOU DO)

### Step 2a: Setup PROD Instance

1. **Create the database:**
   ```bash
   gcloud sql databases create monitrax --instance=monitrax-db-prod
   ```

2. **Create the application user:**
   ```bash
   gcloud sql users create monitrax_user --instance=monitrax-db-prod --password=YOUR_PROD_PASSWORD
   ```

3. **Authorize your IP for migration** (temporary — remove after migration):
   ```bash
   gcloud sql instances patch monitrax-db-prod --authorized-networks=YOUR_IP/32
   ```

### Step 2b: Setup DEV/UAT Instance

1. **Create the database:**
   ```bash
   gcloud sql databases create monitrax --instance=monitrax-db-dev
   ```

2. **Create the application user:**
   ```bash
   gcloud sql users create monitrax_user --instance=monitrax-db-dev --password=YOUR_DEV_PASSWORD
   ```

3. **Authorize your IP:**
   ```bash
   gcloud sql instances patch monitrax-db-dev --authorized-networks=YOUR_IP/32
   ```

### Step 2c: Setup DEV Schema (Empty — No Data Migration)

After creating the DEV database, apply the Prisma schema to create empty tables:
```bash
# From your local machine, temporarily set DATABASE_URL to DEV instance
DATABASE_URL="postgresql://monitrax_user:DEV_PASSWORD@DEV_PUBLIC_IP:5432/monitrax?sslmode=require" \
  npx prisma migrate deploy
```

Optionally seed with test data:
```bash
DATABASE_URL="postgresql://monitrax_user:DEV_PASSWORD@DEV_PUBLIC_IP:5432/monitrax?sslmode=require" \
  npx ts-node prisma/seed-admin.ts
```

---

## Phase 3: Data Migration (YOU DO, I GUIDE)

**Goal:** Move all data from Render to Cloud SQL with zero data loss.

### Step 3a: Export from Render

```bash
# Get your Render DATABASE_URL from the Render dashboard
# Format: postgresql://monitrax_user:PASSWORD@HOST:PORT/monitrax

# Full database dump (custom format, includes all tables + legacy tables)
pg_dump -Fc -v -h RENDER_HOST -p RENDER_PORT -U monitrax_user -d monitrax_i65x_y7ho \
  -f monitrax_full_backup.dump

# Also create a plain SQL backup as safety net
pg_dump -h RENDER_HOST -p RENDER_PORT -U monitrax_user -d monitrax_i65x_y7ho \
  --no-owner --no-privileges \
  -f monitrax_full_backup.sql
```

**Important:** The `-Fc` (custom format) dump preserves everything: tables, indexes, constraints, sequences, extensions, legacy tables, and data types including JSON, Bytes, and Decimal fields.

### Step 3b: Import to Cloud SQL PROD (NOT DEV)

```bash
# Restore to PROD Cloud SQL instance only
pg_restore -v -h PROD_CLOUD_SQL_PUBLIC_IP -p 5432 -U monitrax_user -d monitrax \
  --no-owner --no-privileges \
  monitrax_full_backup.dump
```

**Note:** Do NOT restore production data to DEV/UAT. DEV gets an empty schema (Phase 2c) with synthetic seed data only. This is a CDR compliance requirement (§13.6).

If you get extension errors (e.g., `uuid-ossp`), create them first:
```bash
psql -h CLOUD_SQL_PUBLIC_IP -U monitrax_user -d monitrax \
  -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
```

### Step 3c: Verify Data Integrity

Run these queries on BOTH Render and Cloud SQL and compare:

```sql
-- 1. Total table count
SELECT count(*) FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- 2. Row counts per table
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables ORDER BY relname;

-- 3. Check key financial totals (sanity check)
SELECT count(*) as users FROM "User";
SELECT count(*) as properties FROM "Property";
SELECT count(*) as loans FROM "Loan";
SELECT count(*) as accounts FROM "Account";
SELECT count(*) as expenses FROM "Expense";
SELECT count(*) as income FROM "Income";
SELECT count(*) as audit_logs FROM "AuditLog";
SELECT count(*) as documents FROM "Document";
SELECT count(*) as transactions FROM "UnifiedTransaction";

-- 4. Verify legacy tables exist
-- (Compare the table list from pre-migration against Cloud SQL)
```

**Report the comparison results to me before proceeding.**

---

## Phase 4: Connection String Update — 2-Tier Setup (YOU DO, I VERIFY CODE)

**Goal:** Configure Vercel to use PROD Cloud SQL for production and DEV Cloud SQL for preview deployments.

### Connection string format:

```
postgresql://monitrax_user:PASSWORD@CLOUD_SQL_PUBLIC_IP:5432/monitrax?schema=public&sslmode=require
```

Note the `&sslmode=require` — this enforces SSL which Cloud SQL expects.

### Step 4a: Set Vercel Environment Variables (SCOPED)

Go to **Vercel Dashboard → Project → Settings → Environment Variables**.

For `DATABASE_URL`, create **two entries** with different scopes:

| Variable | Value | Environments |
|----------|-------|-------------|
| `DATABASE_URL` | `postgresql://monitrax_user:PROD_PASS@PROD_IP:5432/monitrax?schema=public&sslmode=require` | **Production** only |
| `DATABASE_URL` | `postgresql://monitrax_user:DEV_PASS@DEV_IP:5432/monitrax?schema=public&sslmode=require` | **Preview** only |

For other variables that should differ between environments:

| Variable | Production | Preview |
|----------|-----------|---------|
| `BASIQ_API_KEY` | Real key | Sandbox key or empty |
| `NODE_ENV` | `production` | `production` |
| All Firebase/GCP vars | Same | Same |
| All Google Maps/Gemini vars | Same | Same |

### Step 4b: Local Development

Update `.env.local` to point to DEV Cloud SQL (or keep using local PostgreSQL):
```
DATABASE_URL="postgresql://monitrax_user:DEV_PASS@DEV_IP:5432/monitrax?schema=public&sslmode=require"
```

### Code changes required: NONE

The current Prisma client setup works as-is with Cloud SQL because:
- Prisma reads `DATABASE_URL` from env (no hardcoded connection strings)
- PostgreSQL provider is already configured in `prisma/schema.prisma`
- No connection pooling config changes needed initially

**No API route changes. No auth changes. No service layer changes.**

---

## Phase 5: Vercel Network Configuration — Both Instances (YOU DO)

**Goal:** Ensure Vercel can reach both Cloud SQL instances.

### Option A: Authorize All IPs (Simplest — Recommended for Vercel)

Vercel serverless functions use dynamic IPs. Apply to **both** instances:

```bash
# PROD instance
gcloud sql instances patch monitrax-db-prod --authorized-networks=0.0.0.0/0

# DEV instance
gcloud sql instances patch monitrax-db-dev --authorized-networks=0.0.0.0/0
```

This is acceptable because: SSL is enforced + strong passwords + Cloud SQL's own firewall.

### Option B: Use a Connection Proxy (More Secure — Future Enhancement)

If you want tighter network security later:
- Deploy a lightweight Cloud Run service as a proxy
- Or use Prisma Accelerate (managed connection pooling + proxy)

**Recommendation for now:** Option A with SSL enforcement. Tighten later if needed.

---

## Phase 6: Smoke Testing (WE DO TOGETHER)

**Goal:** Verify everything works end-to-end before decommissioning Render DB.

### Tests to run:

1. **Health check:**
   ```
   GET /api/health → should return { status: "healthy", database: "connected" }
   ```

2. **Authentication flow:**
   - Sign in via Firebase Auth
   - Verify API routes return data
   - Check that `syncGCPUser()` works (creates/links user in DB)

3. **Financial data integrity:**
   - Load dashboard → verify all financial data appears
   - Check properties, loans, accounts, expenses, income
   - Verify Master Financial Snapshot returns correct totals
   - Open entity dialogs → verify Linked Data tab shows relationships

4. **GRDCS consistency:**
   - Navigate between entities → verify cross-module links work
   - Check Linkage Health endpoint returns expected scores

5. **CDR data:**
   - If Basiq connections exist, verify they still sync
   - Verify audit logs are being written

6. **Write operations:**
   - Create a test expense → verify it saves
   - Update it → verify update works
   - Delete it → verify cascade works

7. **Performance baseline:**
   - Time the Master Snapshot API call
   - Time dashboard load
   - Compare with pre-migration times

---

## Phase 7: GCP Security Hardening (YOU DO, I GUIDE)

**Goal:** Enable GCP security services required for CDR compliance.

### Priority 0 (Do immediately):

1. **Cloud SQL SSL enforcement** (should already be done in Phase 1)
2. **Remove temporary authorized networks** used during migration
3. **Enable Cloud SQL audit logging (both instances):**
   ```bash
   gcloud sql instances patch monitrax-db-prod --database-flags=log_connections=on,log_disconnections=on,log_statement=ddl
   gcloud sql instances patch monitrax-db-dev --database-flags=log_connections=on,log_disconnections=on,log_statement=ddl
   ```

### Priority 1 (Do within 1 week):

4. **Cloud Monitoring alerts:**
   - CPU > 80% for 5 minutes
   - Storage > 80% capacity
   - Connection count > 80% of max
   - Failed connection attempts

5. **Cloud Logging:**
   - Verify SQL logs flow to Cloud Logging
   - Set retention to 90+ days (CDR requirement)

### Priority 2 (Do within 1 month — CDR compliance):

6. **Cloud KMS (CMEK)** — Customer-Managed Encryption Keys for CDR data at rest
7. **Cloud Armor** — WAF/DDoS protection for API endpoints
8. **Security Command Center** — Vulnerability scanning

---

## Phase 8: Decommission Render Database (YOU DO)

**Goal:** Safely remove the old Render PostgreSQL after validation period.

### Timeline:
- **Day 0:** Switch to Cloud SQL (Phase 4)
- **Days 1-7:** Run both databases in parallel (Render as read-only backup)
- **Day 7:** If no issues, take final Render backup
- **Day 14:** Delete Render PostgreSQL instance
- **Day 14+:** Clean up Render service if backend also moves to Vercel-only

### Steps:

1. **Final backup from Render** (even though Cloud SQL is now primary)
2. **Store backup in GCS bucket** for archival
3. **Delete Render database** via Render dashboard
4. **Update `render.yaml`** — remove database section (I will do this code change)
5. **If no longer using Render at all**, cancel Render service

---

## Phase 9: Documentation Updates (I DO)

After migration is complete, I will update:

- [ ] `docs/blueprint/01_ARCHITECTURE_OVERVIEW.md` — Update deployment diagram
- [ ] `docs/blueprint/MASTER_BLUEPRINT.md` — Update technology stack section
- [ ] `docs/blueprint/CDR_BASIQ_COMPLIANCE_MATRIX.md` — Update GCP tools status
- [ ] `render.yaml` — Remove database section
- [ ] `.env.example` — Add Cloud SQL connection string format
- [ ] Create `CHANGELOG_2026_04_09.md` entry
- [ ] This document — Mark all phases complete

---

## Phase 10: Future Improvements (OPTIONAL)

These are not required for the migration but recommended:

| Improvement | Why | When |
|-------------|-----|------|
| Prisma Accelerate | Connection pooling for serverless (Vercel) | If connection limits hit |
| Cloud SQL HA | Automatic failover for production | When traffic grows |
| Read replicas | Separate read traffic from writes | When query volume grows |
| Cloud SQL IAM auth | Replace password auth with IAM | When tightening security |
| Migrate backend to Cloud Run | Full GCP stack, no Render dependency | If you want to leave Render entirely |
| Cloud Scheduler for CDR lifecycle | Automated consent expiry checks | CDR compliance (§13.2) |

---

## Progress Tracker

| Phase | Status | Date Started | Date Completed | Notes |
|-------|--------|-------------|----------------|-------|
| 0. Pre-Migration | COMPLETE | 2026-04-09 | 2026-04-09 | GCP project confirmed, APIs enabled, DB assessed |
| 1. Cloud SQL Setup | COMPLETE | 2026-04-09 | 2026-04-10 | PROD: db-f1-micro, 35.197.180.137. DEV: db-f1-micro, 35.189.31.209. Both in Sydney. |
| 2. DB & User Setup | COMPLETE | 2026-04-10 | 2026-04-10 | Database `monitrax` + user `monitrax_user` created on both. IPs authorized. |
| 3. Data Migration | IN PROGRESS | 2026-04-10 | | pg_dump from Render → pg_restore to PROD |
| 2. DB & User Setup | NOT STARTED | | | |
| 3. Data Migration | NOT STARTED | | | |
| 4. Connection Update | NOT STARTED | | | |
| 5. Vercel Network Config | NOT STARTED | | | |
| 6. Smoke Testing | NOT STARTED | | | |
| 7. Security Hardening | NOT STARTED | | | |
| 8. Decommission Render | NOT STARTED | | | |
| 9. Doc Updates | NOT STARTED | | | |
| 10. Future Improvements | OPTIONAL | | | |

### Pre-Migration Data Snapshot

| Metric | Render Value | Cloud SQL Value | Match? |
|--------|-------------|-----------------|--------|
| PostgreSQL version | 18.3 (Debian) | | |
| Database size | 24 MB | | |
| Total table count | 83 | | |
| User count | 16 | | |
| Property count | 29 | | |
| Loan count | 30 | | |
| Account count | 34 | | |
| Expense count | 186 | | |
| Income count | 39 | | |
| AuditLog count | 54 | | |
| UnifiedTransaction count | 423 | | |
| Document count | 36 | | |
| Legacy table count | TBD | | |

---

*Last Updated: 2026-04-09*
