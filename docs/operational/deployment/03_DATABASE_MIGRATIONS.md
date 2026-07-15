# Database Migrations

## Overview

Monitrax uses Prisma ORM with PostgreSQL hosted on GCP Cloud SQL. Schema changes require special care because the database contains legacy tables that are NOT represented in the Prisma schema. Automated schema sync commands would delete those tables.

> **Prerequisite (one-time):** Both `monitrax-db-dev` and
> `monitrax-db-prod` must be baselined with Prisma before the
> process below can be used. The baseline creates the
> `_prisma_migrations` tracking table and marks the `0_init`
> migration as applied. See
> [`database/04_PRISMA_MIGRATION_BASELINE.md`](../database/04_PRISMA_MIGRATION_BASELINE.md)
> for the baseline runbook. Until this one-time step runs,
> `prisma migrate deploy` and `prisma migrate status` will fail
> with "relation _prisma_migrations does not exist".

---

## CRITICAL Safety Rules

### BANNED Commands in Build Scripts and CI/CD

| Command | Risk | Status |
|---------|------|--------|
| `prisma db push` | Syncs the database to match `schema.prisma` exactly. **Drops any table not in the schema**, including legacy tables. | **BANNED from all automated pipelines** |
| `prisma migrate reset` | Drops the entire database and re-applies all migrations from scratch. | **BANNED from production** |
| `prisma db seed` | May insert or overwrite data unexpectedly. | **Not permitted in production builds** |

### Why `prisma db push` is Dangerous

`prisma db push` performs a "declarative" sync: it makes the live database match `schema.prisma` exactly. Any table, column, or index that exists in the database but is NOT in `schema.prisma` will be **dropped without warning**. Monitrax has legacy tables that predate the Prisma schema and must be preserved.

### What IS Safe in Build Scripts

| Command | Effect | Safe? |
|---------|--------|-------|
| `prisma generate` | Generates the Prisma Client from `schema.prisma`. Does NOT touch the database. | Yes -- used in `vercel-build` |
| `prisma migrate deploy` | Applies pending migrations that have already been created and reviewed. Does NOT generate new migrations. Does NOT drop unmanaged tables. | Yes -- **automated via `vercel-build`** (see `02_VERCEL_DEPLOYMENT.md`) |

---

## Correct Process for Schema Changes

> **2026-04-15 update (R12 remediation):** Steps 4, 5, and part of
> Step 6 below are now **automated by the Vercel build pipeline**
> via the `vercel-build` script in `package.json`. You no longer
> need to run `prisma migrate deploy` manually. Instead, commit
> both `schema.prisma` and the new migration file in the same PR,
> and Vercel applies the migration to the correct environment's
> database automatically — dev on preview builds, prod on the
> main-branch build. See CLAUDE.md §12.12 for the full protocol.

### Step 1: Plan and Review

1. Identify the required schema change (new model, new field, altered column, etc.).
2. Update `prisma/schema.prisma` locally with the change.
3. Review the diff carefully. Understand what SQL will be generated.

### Step 2: Generate the Migration

Run locally against the **DEV** database:

```bash
export DATABASE_URL="<dev_connection_string>"
npx prisma migrate dev --name {descriptive-migration-name}
```

This command:
- Compares `schema.prisma` to the DEV database.
- Generates a new SQL migration file in `prisma/migrations/{timestamp}_{name}/migration.sql`.
- Applies the migration to the DEV database.
- Regenerates the Prisma Client.

**Review the generated `migration.sql` file before proceeding.** Ensure it does not contain `DROP TABLE` or `ALTER TABLE ... DROP COLUMN` statements that affect legacy tables. If it does, fill in the CLAUDE.md §12.11 destructive-write checklist in the PR body.

### Step 3: Commit and Open PR

1. Commit **both** `schema.prisma` **and** the new migration folder in the same commit.
2. Push the branch and open a PR.
3. Vercel builds a preview deployment automatically. The preview build runs `prisma migrate deploy` against `monitrax-db-dev` as its first step. If the migration is broken, the preview build fails and the PR shows a failed check.
4. Verify the preview URL works correctly. Test all affected features against the dev database.

### Step 4: Merge to main (automated migration to PROD)

When you merge the PR:

1. Vercel starts a production build from `main`.
2. The build runs `npm run vercel-build`, which first executes
   `prisma migrate deploy` against `monitrax-db-prod` (via the
   Production-scoped `DATABASE_URL`).
3. If the migration succeeds, Vercel continues with `prisma generate`
   and `next build`.
4. If the migration fails, the build aborts, and the previous
   production deployment keeps serving traffic. Prod stays on old
   code + old schema — stable.
5. Once the build succeeds, Vercel routes production traffic to the
   new deployment.

**No manual `prisma migrate deploy` step is required.** It happens
automatically as part of the deploy.

### Step 5: Verify

1. Confirm the Vercel build logs show `prisma migrate deploy`
   succeeded (look for "Applied the following migration(s)" or
   "No pending migrations to apply").
2. Hit `/api/health` to confirm the app is responding.
3. Spot-check affected features in the UI.
4. Check `_prisma_migrations` table if desired:
   ```sql
   SELECT migration_name, finished_at, rolled_back_at
   FROM _prisma_migrations
   ORDER BY finished_at DESC
   LIMIT 5;
   ```

---

## Prisma Migration Commands Reference

| Command | When to Use | Touches DB? | Safe for PROD? |
|---------|-------------|-------------|----------------|
| `prisma generate` | Every build. Generates typed client from schema. | No | Yes (build only) |
| `prisma migrate dev --name {name}` | During development. Creates a new migration file and applies it. | Yes (DEV only) | **No -- never run in PROD** |
| `prisma migrate deploy` | Applying reviewed migrations to any environment. | Yes | Yes |
| `prisma migrate status` | Checking which migrations have been applied. | Read-only | Yes |
| `prisma db push` | **BANNED.** See safety rules above. | Yes (destructive) | **BANNED** |
| `prisma migrate reset` | Only for wiping DEV during development. | Yes (destructive) | **BANNED from PROD** |

---

## Checking Migration Status

To see which migrations have been applied and which are pending:

```bash
npx prisma migrate status
```

Output shows:
- Applied migrations (with timestamps).
- Pending migrations (exist in files but not in database).
- Failed migrations (applied but errored -- requires manual resolution).

You can also query the migrations table directly:

```sql
SELECT * FROM _prisma_migrations ORDER BY finished_at DESC;
```

---

## What to Do If a Migration Fails

### Migration Fails on DEV

1. Read the error message. Common causes: constraint violations, data type conflicts, missing referenced tables.
2. Fix the issue (adjust the migration SQL or fix data).
3. If needed, run `npx prisma migrate reset` to wipe DEV and start fresh (DEV only -- never PROD).
4. Regenerate the migration with `npx prisma migrate dev --name {name}`.

### Migration Fails on PROD

1. **Do NOT run `prisma migrate reset`.** This would destroy the production database.
2. Read the error message carefully.
3. Check the `_prisma_migrations` table -- the failed migration will have a non-null `rolled_back_at` or error entry.
4. Options:
   - **Fix forward:** Write a corrective SQL script and apply it manually via a direct database connection. Then mark the migration as applied: `npx prisma migrate resolve --applied {migration-name}`.
   - **Roll back manually:** Write reverse SQL to undo the partial migration. Apply via direct connection. Then mark the migration as rolled back: `npx prisma migrate resolve --rolled-back {migration-name}`.
   - **Restore from backup:** If the migration caused data loss or corruption, restore the GCP Cloud SQL backup taken in Step 4.
5. Document the incident in the changelog.

---

## Schema Change Checklist

Before applying a schema change to production:

- [ ] `schema.prisma` updated with the change
- [ ] Migration generated with `prisma migrate dev --name {name}`
- [ ] Generated `migration.sql` reviewed -- no unexpected `DROP` statements
- [ ] Migration file **committed alongside `schema.prisma`** in the same PR
- [ ] Vercel Preview build succeeded (proves dev migration applied cleanly)
- [ ] §12.11 destructive-write checklist filled in (if applicable)
- [ ] PR merged to `main` (triggers automated prod migration + deploy)
- [ ] Vercel Production build logs show `prisma migrate deploy` succeeded
- [ ] Application verified against PROD with the new schema
- [ ] Changelog updated with schema change details

---

## Legacy Table Protection

The following principles protect legacy tables:

1. **`prisma db push` is banned** -- it would drop tables not in `schema.prisma`.
2. **`prisma migrate dev`** generates additive SQL migrations. It does not drop tables it does not manage.
3. **`prisma migrate deploy`** only runs forward migrations. It does not inspect or modify unmanaged tables.
4. **Always review generated SQL** before applying. If a migration contains unexpected `DROP` statements, do not apply it.
5. **The Vercel build command** (`npm run vercel-build`) runs `prisma migrate deploy && prisma generate && next build`. `prisma migrate deploy` is forward-only and never drops unmanaged tables.

---

## Failure mode: hand-authored migration used the MODEL name, not the `@@map`-ed table name (2026-07-15, MON-053)

**What happened.** A cloud session (no dev-DB access, so no `prisma migrate dev`) hand-authored
`20260715000000_add_income_is_recurring` as `ALTER TABLE "Income" ...`. The Prisma model is
`@@map("income")` (lowercase — as are `"expenses"` etc.), so the preview build's
`prisma migrate deploy` failed with `42P01 relation "Income" does not exist` (P3018) and the FAILED
record in `monitrax-db-dev`'s `_prisma_migrations` ledger then **blocked every preview deploy
repo-wide** until resolved.

**The rules this adds:**
1. **Hand-authoring a migration? Check `@@map` FIRST.** The SQL table name is the `@@map` value,
   never the model name. Grep an existing migration for the same table as a sanity check.
2. **Recovery without a DB shell:** fix the SQL in the SAME migration folder, then add a
   temporary self-healing step to `vercel-build` **before** `migrate deploy`:
   `(prisma migrate resolve --rolled-back <migration_name> || true)` — on the broken dev DB it
   marks the failed record rolled-back so the corrected SQL re-applies; on prod (no record) and on
   healthy DBs it errors harmlessly into `|| true`. **Remove the step in the next PR after both
   environments have applied the migration** — it must not live in the pipeline permanently.
3. The failed migration made no schema change (the ALTER failed atomically), so `--rolled-back`
   is the correct resolution — never `--applied`.

*Last Updated: 2026-07-15*
