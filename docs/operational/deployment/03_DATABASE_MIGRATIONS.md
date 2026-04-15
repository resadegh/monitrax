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
| `prisma generate` | Generates the Prisma Client from `schema.prisma`. Does NOT touch the database. | Yes -- used in the Vercel build command |
| `prisma migrate deploy` | Applies pending migrations that have already been created and reviewed. Does NOT generate new migrations. Does NOT drop unmanaged tables. | Yes -- safe for CI/CD, but currently run manually |

---

## Correct Process for Schema Changes

### Step 1: Plan and Review

1. Identify the required schema change (new model, new field, altered column, etc.).
2. Update `prisma/schema.prisma` locally with the change.
3. Review the diff carefully. Understand what SQL will be generated.

### Step 2: Generate the Migration

Run locally against the **DEV** database:

```bash
npx prisma migrate dev --name {descriptive-migration-name}
```

This command:
- Compares `schema.prisma` to the DEV database.
- Generates a new SQL migration file in `prisma/migrations/{timestamp}_{name}/migration.sql`.
- Applies the migration to the DEV database.
- Regenerates the Prisma Client.

**Review the generated `migration.sql` file before proceeding.** Ensure it does not contain `DROP TABLE` or `ALTER TABLE ... DROP COLUMN` statements that affect legacy tables.

### Step 3: Test on DEV

1. Push the branch with the new migration file.
2. Verify the preview deployment works correctly against the DEV database.
3. Test all affected features.

### Step 4: Backup PROD Database

Before applying any migration to production:

```bash
# Via GCP Console or gcloud CLI
gcloud sql backups create --instance={instance-name} --description="Pre-migration backup YYYY-MM-DD"
```

Alternatively, use the GCP Console: Cloud SQL > Instance > Backups > Create Backup.

### Step 5: Apply to PROD

Connect to the production database and run:

```bash
npx prisma migrate deploy
```

This applies all pending migrations (migrations that exist in `prisma/migrations/` but have not yet been recorded in the `_prisma_migrations` table in PROD).

**This command is safe:** it only runs forward migrations. It does not drop unmanaged tables. It does not generate new migrations.

### Step 6: Verify

1. Confirm the migration completed without errors.
2. Check migration status (see below).
3. Deploy the application code (merge PR to `main`).
4. Verify the application works against the updated PROD schema.

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
- [ ] Migration tested on DEV database
- [ ] Application tested against DEV with the new schema
- [ ] PROD database backed up (GCP Cloud SQL backup)
- [ ] Migration applied to PROD with `prisma migrate deploy`
- [ ] Migration status verified with `prisma migrate status`
- [ ] Application deployed (PR merged to `main`)
- [ ] Application verified against PROD with the new schema
- [ ] Changelog updated with schema change details

---

## Legacy Table Protection

The following principles protect legacy tables:

1. **`prisma db push` is banned** -- it would drop tables not in `schema.prisma`.
2. **`prisma migrate dev`** generates additive SQL migrations. It does not drop tables it does not manage.
3. **`prisma migrate deploy`** only runs forward migrations. It does not inspect or modify unmanaged tables.
4. **Always review generated SQL** before applying. If a migration contains unexpected `DROP` statements, do not apply it.
5. **The Vercel build command** (`prisma generate && next build`) deliberately uses `prisma generate`, which never touches the database.

---

*Last Updated: 2026-04-09*
