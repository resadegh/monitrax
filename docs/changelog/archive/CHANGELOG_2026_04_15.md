# Changelog — 2026-04-15

## Session: claude/monitrax-wizard-redesign-6jVjX — R12 data-loss incident response

### Summary

Full-day incident response and remediation for a reported "all user data missing" bug on `rayanmehr79@gmail.com`'s dashboard. Root cause turned out to be a **read-path crash** caused by schema drift (Phase 12 A.0 added columns to `schema.prisma` but the migration never ran on either Cloud SQL instance because neither DB had a `_prisma_migrations` tracking table). No data was ever actually lost.

Four PRs shipped plus a one-time SQL baseline. The Vercel build pipeline now automatically applies Prisma migrations before every deploy. Schema drift is structurally impossible going forward.

### Root cause (R12)

1. Phase 12 Track A.0 added `enum EntrySource` and `source EntrySource @default(MANUAL)` to 9 financial models in `prisma/schema.prisma` (shipped via PRs #511 and #516).
2. The matching `ALTER TABLE` migration never ran on `monitrax-db-dev` (35.189.31.209) or `monitrax-db-prod` (35.197.180.137).
3. The underlying reason: **neither DB had a `_prisma_migrations` tracking table**. Both databases were created outside Prisma's migration workflow during the earlier Render → GCP move and had been drifting from `schema.prisma` ever since.
4. Deployed Prisma client generated `SELECT ..., source FROM accounts WHERE "userId" = ...` which crashed with `column "source" does not exist`. API routes returned empty responses. Dashboard rendered blank.

### Investigation evidence

Direct SQL queries executed via Cloud SQL Studio against `monitrax-db-dev`:

| Query | Result | Interpretation |
|---|---|---|
| `SELECT id FROM users WHERE email = 'rayanmehr79@gmail.com'` | One row, id `fb06f1d0-cfbc-41fb-8324-ca3aa8327907` | User exists |
| Row counts across 7 tables for that userId | 3 accounts, 5 properties, 4 loans, 6 income, 57 expenses, 3 investments, 1 household | **All data intact** |
| `audit_logs` last 14 days for that userId | 50 rows, all `API_REQUEST`, zero `ENTITY_DELETED` | **No deletions** |
| `information_schema.columns WHERE column_name = 'source'` | 5 pre-existing tables (ai_categorization_learnings, asset_value_history, import_batches, merchant_mappings, unified_transactions), **none of the 9 Phase 12 A.0 tables** | Schema drift confirmed |
| `pg_type WHERE typname ILIKE '%source%'` | 5 pre-existing enums, **no `EntrySource`** | A.0 migration never ran |
| `SELECT FROM "_prisma_migrations"` | `relation does not exist` | Neither DB tracked by Prisma migrate |

### Changes shipped

#### PR #523 — CLAUDE.md §12.11 destructive-write checklist

- **Type**: Docs, governance
- **Scope**: `CLAUDE.md` PART 12
- **Motivation**: The destructive `upsertHouseholdEstimate` upsert shipped without user confirmation. Added a zero-tolerance rule so that class of mistake cannot recur.

Added §12.11 "Destructive Write Checklist (NON-NEGOTIABLE)" covering `update`, `upsert`, `updateMany`, `delete`, `deleteMany`, raw SQL, and schema-destructive migrations. Three mandatory PR-body questions, ❌/✅ examples, PR body template, grep one-liner, code-review enforcement. Renumbered the existing §12.11 checklist to §12.12 with a new bullet referencing §12.11.

#### PR #524 — Phase 12 A.0 hotfix revert

- **Type**: Fix
- **Scope**: `prisma/schema.prisma`, `lib/services/setupStateService.ts`, `lib/services/onboardingEstimateService.ts`
- **Motivation**: Restore the live dashboard for every user whose data appeared to be missing.

**Files modified:**

- `prisma/schema.prisma` — removed `EntrySource` enum + `source EntrySource @default(MANUAL)` field from 9 models (Property, Loan, Account, Income, Expense, InvestmentAccount, SuperannuationAccount, Asset, HouseholdProfile). Left a prominent comment pointing at R12.
- `lib/services/setupStateService.ts` — `buildModuleProgress` no longer filters by `{ source: 'ONBOARDING' }`. Estimated counts hard-coded to 0. Tiles resolve to Verified/Missing.
- `lib/services/onboardingEstimateService.ts` — every write function (5 total) now throws `OnboardingDisabledError`. Defense in depth so no destructive Prisma call can fire even if a route somehow routes through the service.

**Zero database changes.** Build status green.

#### PR #525 — Prisma migration baseline runbook

- **Type**: Docs + script
- **Scope**: `docs/operational/database/04_PRISMA_MIGRATION_BASELINE.md` (new), `scripts/baseline-prisma-migrations.sh` (new), `prisma/migrations/1_add_entry_source_enum/` (deleted), `docs/operational/deployment/03_DATABASE_MIGRATIONS.md` (edited), `docs/operational/00_INDEX.md` (edited)
- **Motivation**: Document the one-time procedure for bringing both Cloud SQL instances under Prisma migration tracking.

New 11-section runbook + executable helper script. Deleted the orphaned Phase 12 A.0 migration folder since the schema was reverted in PR #524. Cross-referenced the new runbook from the existing migration doc.

#### PR #526 — Vercel auto-migrate pipeline

- **Type**: Feature
- **Scope**: `package.json`, `CLAUDE.md`, `docs/operational/deployment/02_VERCEL_DEPLOYMENT.md`, `docs/operational/deployment/03_DATABASE_MIGRATIONS.md`
- **Motivation**: Make schema drift structurally impossible by wiring `prisma migrate deploy` into the Vercel build.

**The one-line change that does the work:**

```json
"vercel-build": "prisma migrate deploy && prisma generate && next build"
```

Vercel auto-detects `vercel-build` and uses it instead of the default `build` script. No dashboard change required.

**How the 2-tier DB split is handled natively:** Vercel already has two separate `DATABASE_URL` env vars — Production scope points at `monitrax-db-prod` (35.197.180.137), Pre-Production points at `monitrax-db-dev` (35.189.31.209). Preview builds apply migrations to dev, production builds apply to prod.

**Also added:**
- CLAUDE.md §12.12 "Schema Change Deploy Protocol (NON-NEGOTIABLE)" — every PR modifying `schema.prisma` MUST include a matching migration file, `db push` / `db execute` / manual SQL all BANNED, code-review enforcement rules, grep one-liner for catching schema-without-migration changes.
- CLAUDE.md §12.13 — the existing "Before Every Session" checklist renumbered, with a new bullet pointing at §12.12.
- `02_VERCEL_DEPLOYMENT.md` — documented the new Build Process flow, the R12 remediation, and the banned commands list.
- `03_DATABASE_MIGRATIONS.md` — replaced the manual "Apply to PROD" step with the automated flow.

### Manual steps executed during the session

**1. Cloud SQL Studio SQL baseline** (run against both `monitrax-db-dev` and `monitrax-db-prod`):

```sql
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id"                    VARCHAR(36) PRIMARY KEY NOT NULL,
    "checksum"              VARCHAR(64) NOT NULL,
    "finished_at"           TIMESTAMPTZ,
    "migration_name"        VARCHAR(255) NOT NULL,
    "logs"                  TEXT,
    "rolled_back_at"        TIMESTAMPTZ,
    "started_at"            TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count"   INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "_prisma_migrations" (
    id, checksum, finished_at, migration_name, started_at, applied_steps_count
)
SELECT
    gen_random_uuid()::text,
    'abc16efe3df5a5171a5873aa20ae3d072b54e14ad8c329484e49b4d5d2bde2bd',
    now(),
    '0_init',
    now(),
    1
WHERE NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations" WHERE migration_name = '0_init'
);
```

Executed 2026-04-15T10:13:40Z on `monitrax-db-dev` and 2026-04-15T10:15:08Z on `monitrax-db-prod`. The SHA256 checksum `abc16efe...` matches `prisma/migrations/0_init/migration.sql` so Prisma will not detect drift.

**2. Redeployed PR #526 on Vercel** after the first build failed with Prisma error P3005 (`The database schema is not empty. Read more about how to baseline an existing production database`). Post-baseline redeploy succeeded end-to-end.

### Permanent guarantees in place after this session

1. ✅ **Auto-apply on deploy** — Vercel's `vercel-build` script runs `prisma migrate deploy` against the scoped `DATABASE_URL` before every preview and production build.
2. ✅ **Fail-closed deploys** — if a migration fails, the build aborts and the previous deployment keeps serving. New code never reaches a DB it wasn't designed for.
3. ✅ **Both DBs tracked by Prisma migration history.**
4. ✅ **Destructive writes gated** by CLAUDE.md §12.11 — PR authors must fill in a three-question checklist; reviewers must reject PRs that skip it.
5. ✅ **Schema changes gated** by CLAUDE.md §12.12 — no schema change without a matching migration file; `db push` / manual SQL BANNED.
6. ✅ **2-tier split handled natively** via Vercel's per-environment `DATABASE_URL` scoping.

### Build status

| Check | Result |
|---|---|
| `npx prisma generate` | ✅ Prisma Client v5.22.0 (green after each PR) |
| `npm run build` (local, no migration) | ✅ Green after each PR |
| Destructive writes in any diff | ✅ Zero |
| Schema references to `source` on A.0 tables | ✅ All removed (#524) |
| Vercel Production build for #526 | ✅ Green after baseline fix |
| Dashboard verified working for affected user | ✅ `rayanmehr79@gmail.com` sees full data again |

### PRs in this session

| PR | Title | Status |
|---|---|---|
| #523 | `docs(claude.md): add §12.11 destructive write checklist (NON-NEGOTIABLE)` | ✅ Merged |
| #524 | `fix(phase-12): revert A.0 source-column changes to unblock prod dashboards` | ✅ Merged |
| #525 | `docs(ops): add Prisma migration baseline runbook + delete orphaned A.0 migration` | ✅ Merged |
| #526 | `feat(deploy): auto-apply Prisma migrations on every Vercel build` | ✅ Merged + deployed |
| (this PR) | `docs(phase-12): close R12 in design audit + update Phase 12 plan + session changelog` | 🟡 Open |

### Outstanding work (not in scope for this session)

1. **Re-apply Phase 12 A.0 (hardened)** — new migration folder + restored schema fields + `source === 'ONBOARDING'` guards on the destructive upserts + §12.11 checklist filled in + explicit user approval. Vercel pipeline will auto-apply on merge.
2. **Re-enable wizard writes** — once A.0 re-applies, remove the `OnboardingDisabledError` stubs.
3. **Rescue #514** — Track A.6–A.12 guided flows are still orphaned on a stacked branch.
4. **Audit walkthrough** — Reza walks §3 paths in `docs/quality/PHASE_12_DESIGN_AUDIT.md`.

### References

- `docs/quality/PHASE_12_DESIGN_AUDIT.md` §11.1 — full post-mortem
- `docs/blueprint/PHASE_12_SETUP_AND_ONBOARDING.md` §11 R11/R12, §13 progress tracker, §14 changelog
- `docs/operational/deployment/02_VERCEL_DEPLOYMENT.md` — new Build Process section
- `docs/operational/deployment/03_DATABASE_MIGRATIONS.md` — updated automated flow
- `docs/operational/database/04_PRISMA_MIGRATION_BASELINE.md` — baseline runbook (now reference-only, executed once)
- `CLAUDE.md` §12.11 (destructive writes), §12.12 (schema change deploy protocol), §12.13 (session checklist)
