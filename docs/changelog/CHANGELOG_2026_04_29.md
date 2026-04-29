# Changelog — 2026-04-29

## Session: claude/sync-user-preferences-columns-2hNSa — fix UserPreference schema/prod drift

### Symptom

After PR #548 surfaced server `details` to the wizard footer, clicking
Launch dashboard showed:

> Couldn't finish setup. Failed to save onboarding data: Invalid
> `prisma.userPreference.upsert()` invocation: The column `taxYear`
> does not exist in the current database.

So the bug was identified within minutes of #548 merging — the client
banner did exactly what we needed.

### Root cause

Schema drift between `prisma/schema.prisma` and the production
database. Per CLAUDE.md §12.12 (R12 incident note), the prod DB was
originally created outside the Prisma migration workflow. The
`0_init` migration is a `SELECT 1;` no-op baseline, so any column
added to `model UserPreference` after the baseline never reached prod.

`taxYear` (added some time after baseline as `String?` on
`UserPreference`) is the first one to crash because `bulk-create`
writes it as part of the onboarding upsert. Other columns the
schema declares but prod might be missing would crash next — see
the migration body for the full set we sync defensively.

### Solution

New Prisma migration:
`prisma/migrations/20260429140700_sync_user_preferences_columns/migration.sql`

The migration uses `ADD COLUMN IF NOT EXISTS` for **every column the
current `UserPreference` schema declares**, so it is fully idempotent:

- On `monitrax-db-dev` (where the columns probably exist already
  from historical `prisma db push`), every statement is a no-op.
- On `monitrax-db-prod` (where most/all columns are missing), each
  statement adds the column with the same default the schema
  declares.

Every NOT NULL column has a sensible default (`false`, `'AUD'`,
`'AU'`, etc.) so existing rows are filled in without manual backfill.
Nullable columns (`tourSkippedAt`, `taxYear`, `onboardingDraft`)
add no constraint.

### CLAUDE.md compliance

- **§12.11 (Destructive write checklist):** NOT required. Every
  statement is `ADD COLUMN IF NOT EXISTS ... DEFAULT ...` or
  nullable. No `DROP`, no `ALTER ... DROP COLUMN`, no `TRUNCATE`,
  no NOT NULL backfill. Existing rows are unaffected beyond
  taking the column default.
- **§12.12 (Schema change deploy protocol):** ✓
  - Schema-and-migration ship together in this PR.
  - Migration was *not* generated via `prisma migrate dev` because
    no dev DB connection is available in this session — it was
    written by hand to mirror the schema. The `IF NOT EXISTS`
    pattern makes hand-written safe: dev sees no-ops, prod sees
    the additions, no manual diffing required.
  - `prisma migrate deploy` runs in `vercel-build` (per
    `package.json`), so this migration applies automatically to
    `monitrax-db-dev` on the preview build and to
    `monitrax-db-prod` on the production deploy. Either failure
    aborts the deploy and the previous build keeps serving.
  - First migrate-deploy run on each DB will create
    `_prisma_migrations` (which doesn't exist yet per R12) and
    apply this folder. Subsequent runs no-op.

### Files Modified

- `prisma/migrations/20260429140700_sync_user_preferences_columns/migration.sql`
  — new migration. Adds 18 columns idempotently.

### Build Status

- [x] `npm run build` passes (Next.js 15.2.6).

### Outstanding

- Other tables likely have the same drift (R12 covered the entire
  schema). When the *next* user-blocking column-missing error
  surfaces (now visible thanks to PR #548), we can extend this
  pattern to the affected table.
- Long-term: a one-shot full-sync migration would be cleaner than
  fixing tables piecemeal, but that requires a dev DB session to
  generate properly via `prisma migrate diff`. Tracked as a
  follow-up in the next maintenance window.
