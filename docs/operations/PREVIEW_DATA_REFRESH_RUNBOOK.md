# Preview Data Refresh — RUNBOOK (PROD → dev copy)

**Status:** ✅ TESTED end-to-end 2026-08-11 (first refresh executed; every failure mode below was hit and solved that night).
**Authority:** implements `PROD_SIMPLIFICATION_PLAN.md` §7 (D-7, widened to full-instance 2026-08-09) + CLAUDE.md §13.6 exception. **Sunset:** the day the first genuine customer account or any CDR/Basiq data exists in PROD, full-instance copying is PROHIBITED — revert to synthetic-only or Reza's-rows-only.
**Data residency (Reza, 2026-08-11):** ALL data stays in `australia-southeast1` (Sydney) per CDR posture — instances AND the migration bucket.

## Architecture

- PROD: Cloud SQL `monitrax-db-prod` · db `monitrax` · project `monitrax-479700` · Sydney · PG18
- DEV: Cloud SQL `monitrax-db-dev` · db `monitrax` (owner: `monitrax_user`) · same project/region
- Transfer bucket: `gs://monitrax-db-migrations` (Sydney, not public, soft-delete) — DB dumps only, never documents
- Preview (Vercel) builds read dev; Production reads prod. Flag rows differ per environment by construction.
- Standing dev state: **all 13 `MODULE_*` flags ON** (Preview shows the full app; PROD ships hidden).

## One-time preconditions (already done; verify if instances are rebuilt)

1. Dev role for PROD's IAM user (dump GRANTs reference it):
   `CREATE ROLE "vercel-monitrax-db@monitrax-479700.iam" NOLOGIN;`
2. Import-user memberships: `GRANT "vercel-monitrax-db@monitrax-479700.iam" TO postgres;` and `GRANT monitrax_user TO postgres;`
3. Dev `monitrax` database owned by `monitrax_user` (`CREATE DATABASE monitrax OWNER monitrax_user;`) — console-created DBs get an internal owner neither postgres nor the console can later drop.
4. API key `Monitrax Auth (Web)`: referrer allowlist includes `https://*.vercel.app/*` (else Firebase sign-in on previews fails with `auth/requests-from-referer-...-are-blocked`; this was also the old Preview-admin login failure). **Hardening TODO:** assign a stable domain (e.g. `preview.monitrax.com.au`) to previews in Vercel, allowlist that, drop the wildcard.

## The refresh (repeat any time; ~15 min)

1. **Export PROD** (console: SQL → monitrax-db-prod → Export → SQL → db `monitrax` → `monitrax-db-migrations/prod-monitrax-YYYY-MM-DD.sql`). Read-only; no offload needed at current size.
2. **Reset dev db** (Cloud Shell → `gcloud sql connect monitrax-db-dev --user=postgres --database=postgres`):
   `DROP DATABASE monitrax WITH (FORCE);` then `CREATE DATABASE monitrax OWNER monitrax_user;` then `\q`
   (One line at a time — `\c` re-prompts for a password and eats pasted lines.)
3. **Import AS POSTGRES** — the console Import button runs as an internal user and FAILS on the dump's `ALTER DEFAULT PRIVILEGES` (which sit BEFORE the tables — a failed import leaves dev with types only, zero tables). Always use the CLI:
   `gcloud sql import sql monitrax-db-dev gs://monitrax-db-migrations/prod-monitrax-YYYY-MM-DD.sql --database=monitrax --user=postgres --quiet`
4. **Post-import block** (`gcloud sql connect monitrax-db-dev --user=postgres --database=monitrax`):
   ```sql
   GRANT USAGE ON SCHEMA public TO monitrax_user;
   GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO monitrax_user;
   GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO monitrax_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO monitrax_user;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO monitrax_user;
   UPDATE global_feature_flags SET enabled = true WHERE key LIKE 'MODULE_%';
   ```
5. **Verify:** `SELECT (SELECT count(*) FROM information_schema.tables WHERE table_schema='public'), (SELECT count(*) FROM users), (SELECT count(*) FROM properties), (SELECT count(*) FROM global_feature_flags WHERE key LIKE 'MODULE_%' AND enabled);` → expect ~140 tables · users>0 · properties>0 · 13.
6. **Rebuild the preview** — push any commit to `preview/dev-full-app` (see `PREVIEW_BRANCH.md`): gated routes are statically pre-rendered, so runtime flag flips do NOT change visibility until a redeploy (defect registered 2026-08-11, PR #1587 comments; fix = force-dynamic on gated layouts).
7. **Log the refresh** in the table below + note it in the plan's §7.3 area.

## Failure modes seen 2026-08-11 (all solved above — do not re-diagnose)

| Error | Cause | Fix |
|---|---|---|
| `role "vercel-...iam" does not exist` | dump GRANTs reference PROD's IAM user | precondition 1 |
| `permission denied to change default privileges` | import user ∉ that role; console import user ≠ postgres | precondition 2 + CLI `--user=postgres` |
| `must be owner of database monitrax` / console "not owned by cloudsqlsuperuser" | DB created under a different identity | precondition 3 (owner `monitrax_user`, postgres a member) |
| Preview sign-in `auth/requests-from-referer-...-are-blocked` | API key referrer allowlist lacks vercel.app | precondition 4 |
| Flags ON but some routes still 404 | build-time-baked static prerender of gated routes | step 6 (+ the registered force-dynamic fix) |

## Refresh log

| Date | Dump | Result |
|---|---|---|
| 2026-08-11 | `prod-monitrax-2026-08-11.sql` | ✅ 140 tables / 36 users / 58 properties / 13 flags ON · first end-to-end run |

## Security follow-ups (non-blocking, tracked)

1. Both SQL instances allow `0.0.0.0/0` in authorized networks — narrow to needed ranges (console has an open recommendation).
2. Replace the `*.vercel.app` API-key referrer wildcard with a stable preview domain.
