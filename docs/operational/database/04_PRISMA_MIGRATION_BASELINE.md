# Prisma Migration Baseline Runbook

> **One-time setup** to bring both Cloud SQL instances (`monitrax-db-dev`
> and `monitrax-db-prod`) under Prisma's official migration-tracking
> system.
>
> **After this runs:** every future schema change goes through
> `prisma migrate deploy` and is automatically applied to the database
> by the deploy pipeline. No more `db push`, no more manual SQL, no
> more schema drift.
>
> **Context:** the 2026-04-15 data-display incident (see
> `docs/quality/PHASE_12_DESIGN_AUDIT.md` §11 R12) confirmed that
> neither the dev nor the prod database has a `_prisma_migrations`
> tracking table. Both databases were created outside of Prisma's
> migration workflow and have been drifting ever since. This runbook
> is the fix.

**Owner:** Claude (engineer) → Reza (executor)
**Status:** 🟡 Pending execution
**Blocks:** PR #3 (CI deploy pipeline gate)
**Blast radius:** **ZERO user data touched.** Only creates the
`_prisma_migrations` metadata table and populates it with one row.
**Duration:** ~5 minutes per instance, including verification.

---

## 1. What "baseline an existing DB" means

Prisma's migration engine expects every managed database to have a
`_prisma_migrations` metadata table that records which migration
folders have been applied. New databases get this table created
automatically the first time `prisma migrate deploy` runs. Existing
databases — like ours — need to be **baselined** first: Prisma is
told "these migrations are already applied, don't try to run them
again."

The official baseline command is:

```bash
npx prisma migrate resolve --applied <migration_folder_name>
```

This command:
- ✅ Creates the `_prisma_migrations` table if it doesn't exist
- ✅ Writes one row per `--applied` invocation
- ❌ **Does NOT execute any SQL from the migration file** — it's a
  metadata-only operation
- ❌ **Does NOT touch user data**

After this, `prisma migrate deploy` becomes idempotent: it only
runs migration folders that aren't marked as applied in
`_prisma_migrations`.

---

## 2. Prerequisites

Before you start, make sure you have:

- [ ] `gcloud` CLI installed and authenticated (`gcloud auth login`)
- [ ] Node.js and `npm` installed (v18+)
- [ ] The Monitrax repo cloned locally on `main` (commit `1d0940a`
      or later — must contain PR #524's revert and PR #526's runbook)
- [ ] `npm install` run successfully (so `node_modules/.bin/prisma`
      exists)
- [ ] A fresh backup of **both** databases taken in the last hour
      (GCP Console → SQL → Instance → Backups → Create Backup)
- [ ] Labelled backups `pre-prisma-baseline-2026-04-15-dev` and
      `pre-prisma-baseline-2026-04-15-prod`
- [ ] The DB passwords for `monitrax_app` on both instances, from
      GCP Secret Manager

---

## 3. Current state verification (safety check)

Before modifying anything, **prove** that `_prisma_migrations` does
not exist on either instance. If it does already exist, **STOP and
re-read §6** — a different baseline procedure applies.

### 3.1 Check dev

```bash
gcloud sql connect monitrax-db-dev \
  --project=monitrax-dev \
  --user=monitrax_app \
  --database=monitrax
```

Then in the psql prompt:

```sql
\d _prisma_migrations
```

**Expected result:** `Did not find any relation named "_prisma_migrations".`

Then exit: `\q`

### 3.2 Check prod

```bash
gcloud sql connect monitrax-db-prod \
  --project=monitrax-prod \
  --user=monitrax_app \
  --database=monitrax
```

Same check:

```sql
\d _prisma_migrations
```

**Expected result:** `Did not find any relation named "_prisma_migrations".`

Then exit: `\q`

If **either** check returns an existing table, stop and go to §6
before proceeding.

---

## 4. Baseline dev first (rehearsal)

**Always run this on dev first.** If anything goes wrong, worst
case is we drop the `_prisma_migrations` table on dev and retry.

### 4.1 Set DATABASE_URL to point at dev

```bash
# Start the Cloud SQL Auth Proxy for dev
cloud-sql-proxy monitrax-dev:us-west1:monitrax-db-dev --port=5433 &

# Set DATABASE_URL to the proxy
export DATABASE_URL="postgresql://monitrax_app:PASSWORD@127.0.0.1:5433/monitrax?sslmode=require"

# Replace PASSWORD with the value from GCP Secret Manager
# (Secret: monitrax-dev-db-password)
```

### 4.2 Confirm Prisma can see the DB

```bash
npx prisma migrate status
```

**Expected result** (before baselining):

```
Status
1 migration found in prisma/migrations

Following migrations have not yet been applied:
0_init

To apply migrations in development run prisma migrate dev.
To apply migrations in production run prisma migrate deploy.
```

This proves: (a) Prisma can connect to dev, and (b) dev has no
tracked migrations yet.

### 4.3 Baseline 0_init on dev

```bash
npx prisma migrate resolve --applied 0_init
```

**Expected result:**

```
Migration 0_init marked as applied.
```

### 4.4 Verify dev baseline

```bash
npx prisma migrate status
```

**Expected result:**

```
Database schema is up to date!
```

Then connect again with `gcloud sql connect ...` and run:

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at
FROM _prisma_migrations
ORDER BY started_at DESC;
```

**Expected result:** one row, `0_init`, with `finished_at` set and
`rolled_back_at` null.

### 4.5 Stop the dev proxy

```bash
kill %1  # or the PID of cloud-sql-proxy you started
```

Dev is now baselined. Move to prod.

---

## 5. Baseline prod (production)

**⚠ Only run this step after §4 succeeded on dev.**

### 5.1 Take a fresh backup of prod (second time — belt and braces)

```bash
gcloud sql backups create \
  --instance=monitrax-db-prod \
  --project=monitrax-prod \
  --description="pre-prisma-baseline-2026-04-15-prod-step5"
```

Wait for the backup to complete (visible in GCP Console →
SQL → monitrax-db-prod → Backups).

### 5.2 Set DATABASE_URL to point at prod

```bash
# Start the Cloud SQL Auth Proxy for prod (different port to avoid
# clashing with any dev proxy still running)
cloud-sql-proxy monitrax-prod:us-west1:monitrax-db-prod --port=5434 &

# Set DATABASE_URL to the proxy
export DATABASE_URL="postgresql://monitrax_app:PASSWORD@127.0.0.1:5434/monitrax?sslmode=require"

# Replace PASSWORD with the value from GCP Secret Manager
# (Secret: monitrax-prod-db-password)
```

### 5.3 Confirm Prisma can see prod

```bash
npx prisma migrate status
```

**Expected result:** same as §4.2 — one pending migration (`0_init`).

### 5.4 Baseline 0_init on prod

```bash
npx prisma migrate resolve --applied 0_init
```

**Expected result:**

```
Migration 0_init marked as applied.
```

### 5.5 Verify prod baseline

```bash
npx prisma migrate status
```

**Expected result:**

```
Database schema is up to date!
```

Then reconnect with `gcloud sql connect ...` and run:

```sql
SELECT migration_name, started_at, finished_at, rolled_back_at
FROM _prisma_migrations
ORDER BY started_at DESC;
```

**Expected result:** one row, `0_init`, with `finished_at` set.

### 5.6 Stop the prod proxy

```bash
kill %1  # or the PID of cloud-sql-proxy you started
```

Prod is now baselined.

---

## 6. What if `_prisma_migrations` already exists?

If §3.1 or §3.2 showed an existing `_prisma_migrations` table,
**do NOT run §4 or §5**. Instead:

1. Take a fresh backup
2. Connect via `gcloud sql connect ...`
3. Inspect the existing rows:
   ```sql
   SELECT migration_name, started_at, finished_at, rolled_back_at
   FROM _prisma_migrations
   ORDER BY started_at DESC;
   ```
4. Share the output with the engineer before doing anything else.
   The baseline procedure depends on which rows exist and their
   state.

**Do not drop `_prisma_migrations` without explicit confirmation.**
It's metadata, but losing it means re-baselining from scratch.

---

## 7. Rollback (if something goes wrong during §4 or §5)

If `prisma migrate resolve --applied 0_init` fails partway through,
the database may end up with an empty `_prisma_migrations` table or
a row in an inconsistent state. To roll back:

### 7.1 Drop the partial table

```bash
gcloud sql connect monitrax-db-<env> --project=monitrax-<env> --user=monitrax_app --database=monitrax
```

```sql
DROP TABLE IF EXISTS "_prisma_migrations";
```

### 7.2 Retry

Restart from §3.1 (for dev) or §5.1 (for prod). The operation is
fully idempotent.

### 7.3 Worst case — restore from backup

If the instance is truly broken (unlikely — this operation only
writes to one metadata table), restore from the backup taken in
§2. Instructions: `docs/operational/database/02_BACKUP_AND_RESTORE.md`.

---

## 8. Post-baseline verification

After **both** dev and prod are baselined, run one final check from
your local dev machine with the prod `DATABASE_URL`:

```bash
export DATABASE_URL="<prod_connection_string>"
npx prisma migrate status
```

**Expected result:**

```
Database schema is up to date!
```

If you see any pending migrations, **STOP** — the baseline is in
an inconsistent state and needs investigation before PR #3 ships.

---

## 9. What PR #3 adds on top of this baseline

Once both DBs are baselined, PR #3 will wire `prisma migrate deploy`
into the **Vercel** deploy flow. Monitrax currently deploys via
Vercel (see `deployment/02_VERCEL_DEPLOYMENT.md`), so PR #3 takes
one of these shapes (final choice depends on team preference):

**Option A — GitHub Actions gate before Vercel**

A new workflow at `.github/workflows/prisma-deploy.yml`:

1. Trigger: push to `main`
2. Job 1: `prisma migrate deploy` against `monitrax-db-dev`
3. Job 2: wait for manual approval (GitHub Environment "production")
4. Job 3: `prisma migrate deploy` against `monitrax-db-prod`
5. Only after job 3 succeeds does Vercel's auto-deploy run
   (Vercel is configured to wait for the workflow via GitHub
   deployment protection rules)

**Option B — Vercel Build Command integration**

Update the Vercel production Build Command to:

```
prisma migrate deploy && prisma generate && next build
```

With `DATABASE_URL` scoped to production. Vercel aborts the deploy
if `migrate deploy` fails. Simpler but doesn't handle the dev DB
— that would still need a separate step.

**Option C — Hybrid (recommended)**

- PR previews: Vercel Build Command runs `prisma generate && next build`
  (no migration — previews share the dev DB and engineers apply
  migrations manually during local development)
- `main` deploys: GitHub Actions workflow (Option A) runs
  migrations against prod, then Vercel picks up the deploy once
  the workflow passes

Whichever shape is chosen, the key property is the same: after
this baseline runs, future schema changes go through
`prisma migrate deploy`, the `_prisma_migrations` table records
them, and drift cannot recur.

For the existing manual process (what we do today, before PR #3
automates it), see `deployment/03_DATABASE_MIGRATIONS.md`.

---

## 10. Known caveats

1. **The orphaned `1_add_entry_source_enum` migration was deleted**
   in PR #526 (this PR). It was never applied to prod and was
   reverted from `schema.prisma` in PR #524. When Phase 12 A.0 is
   re-applied, it will be a NEW migration folder (e.g.
   `2_phase12_entry_source_hardened`) with the destructive-write
   hardening per CLAUDE.md §12.11 baked in from the start.

2. **The `0_init` migration is a placeholder** — its `migration.sql`
   contains only `SELECT 1;`. This is intentional. It exists so
   Prisma has a "first migration" to mark as the baseline. The
   actual schema was established before Prisma was adopted.

3. **Cloud SQL Auth Proxy is required** for Prisma commands against
   Cloud SQL. Direct IP connection works but requires SSL client
   certs, which is fiddly for a one-off. The proxy is the simpler
   path.

4. **`DATABASE_URL` must be exported**, not just set, so `npx prisma`
   child processes inherit it. Forgetting `export` is the most
   common cause of "Prisma can't find a database" errors during this
   runbook.

---

## 11. Sign-off

When §4 and §5 complete successfully:

| Step | Executor | Status | Date | Notes |
|---|---|---|---|---|
| §3 state verification | Reza | ⬜ | — | |
| §4 dev baseline | Reza | ⬜ | — | |
| §5 prod baseline | Reza | ⬜ | — | |
| §8 post-baseline verification | Reza | ⬜ | — | |

Once all four are ticked, PR #3 (the deploy pipeline gate) is
unblocked and can ship.

---

*This runbook is intentionally detailed. Execute it once, tick the
boxes, and never run it again — future databases get Prisma
migration tracking from day one via PR #3's pipeline.*
