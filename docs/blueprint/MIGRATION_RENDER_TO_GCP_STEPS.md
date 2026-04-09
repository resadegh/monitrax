# Migration Steps: Render PostgreSQL → GCP Cloud SQL

> **Parent Doc:** [MIGRATION_RENDER_TO_GCP_PLAN.md](./MIGRATION_RENDER_TO_GCP_PLAN.md)
> **Status:** PLANNING | Created: 2026-04-09

---

## Phase 1: GCP Cloud SQL Instance Setup (YOU DO)

**Goal:** Create a Cloud SQL PostgreSQL instance matching your current Render setup.

### Steps:

1. **Go to GCP Console** → SQL → Create Instance → PostgreSQL
2. **Configuration:**
   - Instance ID: `monitrax-db`
   - Password: Generate a strong password, save securely
   - PostgreSQL version: Match your Render version (run `SELECT version();` on Render to check)
   - Region: `us-west1` (Oregon) — matches Render's Oregon region for latency parity
   - Zone availability: Single zone for cost savings, or HA for production resilience
3. **Machine type:** Start with `db-f1-micro` (shared core) or `db-custom-1-3840` (1 vCPU, 3.75GB) depending on your load
4. **Storage:** SSD, 10GB minimum (auto-resize enabled)
5. **Connections:**
   - Enable **Public IP** (required for Vercel connectivity)
   - Require **SSL** for all connections
6. **Backups:**
   - Enable automated backups (daily)
   - Enable point-in-time recovery
   - Backup retention: 7 days minimum
7. **Maintenance:** Set a preferred window (low-traffic time in your timezone)

### What I need from you after this step:
- Cloud SQL instance connection name (format: `project:region:instance`)
- Public IP address of the instance
- PostgreSQL version you selected
- Database user and password you created

---

## Phase 2: Database & User Setup on Cloud SQL (YOU DO)

### Steps:

1. **Create the database:**
   ```bash
   gcloud sql databases create monitrax --instance=monitrax-db
   ```

2. **Create the application user:**
   ```bash
   gcloud sql users create monitrax_user --instance=monitrax-db --password=YOUR_SECURE_PASSWORD
   ```

3. **Authorize your IP for migration** (temporary — remove after migration):
   ```bash
   # Your current IP for running pg_dump/pg_restore
   gcloud sql instances patch monitrax-db --authorized-networks=YOUR_IP/32
   ```

4. **Download the SSL certificates** (from GCP Console → SQL → Instance → Connections → Security):
   - Server CA certificate
   - Client certificate and key (if using client cert auth)

---

## Phase 3: Data Migration (YOU DO, I GUIDE)

**Goal:** Move all data from Render to Cloud SQL with zero data loss.

### Step 3a: Export from Render

```bash
# Get your Render DATABASE_URL from the Render dashboard
# Format: postgresql://monitrax_user:PASSWORD@HOST:PORT/monitrax

# Full database dump (custom format, includes all tables + legacy tables)
pg_dump -Fc -v -h RENDER_HOST -p RENDER_PORT -U monitrax_user -d monitrax \
  -f monitrax_full_backup.dump

# Also create a plain SQL backup as safety net
pg_dump -h RENDER_HOST -p RENDER_PORT -U monitrax_user -d monitrax \
  --no-owner --no-privileges \
  -f monitrax_full_backup.sql
```

**Important:** The `-Fc` (custom format) dump preserves everything: tables, indexes, constraints, sequences, extensions, legacy tables, and data types including JSON, Bytes, and Decimal fields.

### Step 3b: Import to Cloud SQL

```bash
# Restore to Cloud SQL using the public IP
pg_restore -v -h CLOUD_SQL_PUBLIC_IP -p 5432 -U monitrax_user -d monitrax \
  --no-owner --no-privileges \
  monitrax_full_backup.dump
```

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

## Phase 4: Connection String Update (YOU DO, I VERIFY CODE)

**Goal:** Point Monitrax to the new Cloud SQL database.

### New DATABASE_URL format:

```
postgresql://monitrax_user:PASSWORD@CLOUD_SQL_PUBLIC_IP:5432/monitrax?schema=public&sslmode=require
```

Note the `&sslmode=require` — this enforces SSL which Cloud SQL expects.

### Where to update:

1. **Vercel Environment Variables:**
   - Go to Vercel Dashboard → Project → Settings → Environment Variables
   - Update `DATABASE_URL` with the new Cloud SQL connection string
   - Apply to: Production, Preview, Development (as needed)

2. **Render Environment Variables** (if still running backend on Render):
   - Update `DATABASE_URL` in Render service settings
   - Or if fully migrating away from Render backend, this step is N/A

3. **Local development** (`.env.local`):
   - Update your local `DATABASE_URL` if you want to test against Cloud SQL
   - Or keep it pointing to a local PostgreSQL for dev

### Code changes required (MINIMAL — I will do these):

The only code change is in `lib/db.ts` — and it's **optional**. The current Prisma client setup works as-is with Cloud SQL because:
- Prisma reads `DATABASE_URL` from env (no hardcoded connection strings)
- PostgreSQL provider is already configured in `prisma/schema.prisma`
- No connection pooling config changes needed initially

**No API route changes. No auth changes. No service layer changes.**

---

## Phase 5: Vercel Network Configuration (YOU DO)

**Goal:** Ensure Vercel can reach Cloud SQL.

### Option A: Authorize Vercel IPs (Simplest)

Vercel serverless functions use dynamic IPs. Options:
1. **Allow all IPs** (less secure but simplest for serverless):
   ```bash
   gcloud sql instances patch monitrax-db --authorized-networks=0.0.0.0/0
   ```
   Acceptable because SSL is enforced + strong password + Cloud SQL's own firewall.

2. **Use Vercel's static IP ranges** (if on Vercel Enterprise with dedicated IPs)

### Option B: Use a Connection Proxy (More Secure)

If you want tighter network security:
- Deploy a lightweight Cloud Run service as a proxy
- Or use Prisma Accelerate (managed connection pooling + proxy)
- Or use `@prisma/pg-worker` for edge-compatible connections

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
3. **Enable Cloud SQL audit logging:**
   ```bash
   gcloud sql instances patch monitrax-db --database-flags=log_connections=on,log_disconnections=on,log_statement=ddl
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
| 1. Cloud SQL Setup | NOT STARTED | | | |
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

Fill this in during Phase 0 (Pre-Migration Checklist):

| Metric | Render Value | Cloud SQL Value | Match? |
|--------|-------------|-----------------|--------|
| PostgreSQL version | | | |
| Database size | | | |
| Total table count | | | |
| User count | | | |
| Property count | | | |
| Loan count | | | |
| Account count | | | |
| Expense count | | | |
| Income count | | | |
| AuditLog count | | | |
| UnifiedTransaction count | | | |
| Document count | | | |
| Legacy table count | | | |

---

*Last Updated: 2026-04-09*
