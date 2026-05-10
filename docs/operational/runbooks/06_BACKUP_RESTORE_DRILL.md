# Backup & Restore Drill

> **Audience:** BAU support team / Director
> **Cadence:** Quarterly (next due: see the Drill Log at the bottom of this file)
> **Owner:** Director (until the team grows)
> **Purpose:** Prove — not assume — that the Cloud SQL backups can actually be restored, that the restored data is intact, and that the team knows the steps before a real incident forces them to.

This is the *exercise* runbook. The *procedure* reference it exercises is [`database/02_BACKUP_AND_RESTORE.md`](../database/02_BACKUP_AND_RESTORE.md). Run this drill on a schedule; run that procedure in an incident.

---

## 1. Why this drill exists

A backup that has never been restored is a hypothesis, not a safety net. The 2026-04-15 R12 incident (Phase 12 schema change deployed without its migration → prod DB schema mismatch → blank dashboard for every user) is the kind of event a restore-from-backup recovers from — *if* the restore path works and *if* whoever is on call has done it before. This drill removes both ifs.

Three things the drill verifies:

1. **The backups exist and are recent** — automated daily backups are actually running, retention is honoured, and PITR logs cover the documented window.
2. **A restore produces a working database** — a backup restored to a fresh instance comes up `RUNNABLE`, the schema is current, and row counts are sane.
3. **The team can do it** — the operator running the drill follows the steps cold, times them, and notes anything that was unclear or missing from the procedure doc.

This drill is **non-destructive**: it never touches `monitrax-db-prod`. It restores into a *throwaway* instance, verifies, and deletes the throwaway. If a step ever requires touching production, stop — that means the drill is being run wrong.

---

## 2. Scope & cadence

| Item | Value |
|---|---|
| Frequency | Quarterly (4× / year) |
| Also run after | Any Cloud SQL tier/edition change; any change to backup configuration; any major Prisma migration that altered many tables |
| Target | `monitrax-db-prod` automated backup → restored into `monitrax-db-prod-drill` (throwaway) |
| Also drill (annually) | PITR clone to a specific timestamp; full `pg_dump` → `pg_restore` round-trip into a local/throwaway Postgres |
| Estimated time | 30–45 min (Cloud SQL restore to a new instance is the long pole — 10–20 min) |
| Out of scope | Restoring *over* production (that's the real-incident procedure in `02_BACKUP_AND_RESTORE.md`, not a drill) |

> **CDR note:** the restored throwaway instance contains CDR-protected data. It must be deleted at the end of the drill (step 7). Do not leave a drill instance running. Do not connect anything other than `psql`/`cloud-sql-proxy` to it. Do not export data from it.

---

## 3. Pre-drill checklist

- [ ] You have `gcloud` authenticated against the `monitrax-prod` project (`gcloud config get-value project`).
- [ ] You have `cloud-sql-proxy` (or `cloud_sql_proxy`) installed locally.
- [ ] You have `psql` installed locally.
- [ ] You have ~45 minutes uninterrupted.
- [ ] You have this file and `02_BACKUP_AND_RESTORE.md` open side by side.
- [ ] Nobody else is mid-incident on the prod database (check `#ops` / recent alerts).

---

## 4. Part A — Verify backups exist and are healthy (5 min)

```bash
# 4.1 — Automated backup configuration is still enabled and configured as documented
gcloud sql instances describe monitrax-db-prod --project=monitrax-prod \
  --format="json(settings.backupConfiguration)"
```

Confirm against `02_BACKUP_AND_RESTORE.md` §"Automated Backups":
- [ ] `enabled: true`
- [ ] `startTime` is the documented backup window (≈ `04:00` UTC)
- [ ] `pointInTimeRecoveryEnabled: true`
- [ ] `transactionLogRetentionDays` ≥ 7
- [ ] `backupRetentionSettings.retainedBackups` ≥ 30 (prod)

```bash
# 4.2 — Recent backups actually exist
gcloud sql backups list --instance=monitrax-db-prod --project=monitrax-prod --limit=10
```

- [ ] There is a `SUCCESSFUL` automated backup from within the last 24–48 hours.
- [ ] No `FAILED` backups in the last 10. (If there are — that is itself a finding; log it and investigate before continuing.)
- [ ] Note the `ID` of the most recent successful backup — you will restore it in Part B. → **Backup ID used: `____________`**

---

## 5. Part B — Restore a backup into a throwaway instance (15–25 min)

```bash
# 5.1 — Restore the chosen backup into a NEW instance (does NOT touch prod)
gcloud sql backups restore <BACKUP_ID> \
  --restore-instance=monitrax-db-prod-drill \
  --project=monitrax-prod
```

> If `monitrax-db-prod-drill` does not exist yet, `backups restore --restore-instance` to a non-existent instance fails. In that case, clone instead — it creates a new instance from the source's latest backup state:
> ```bash
> gcloud sql instances clone monitrax-db-prod monitrax-db-prod-drill --project=monitrax-prod
> ```
> Either path is valid for the drill; note which one you used.

```bash
# 5.2 — Wait for it to come up
gcloud sql instances describe monitrax-db-prod-drill --project=monitrax-prod \
  --format="value(state)"
# Repeat until: RUNNABLE
```

- [ ] Instance reaches `RUNNABLE` state. → **Time from "restore started" to `RUNNABLE`: `____ min`**

---

## 6. Part C — Verify the restored data (5–10 min)

```bash
# 6.1 — Connect via the Auth Proxy on a non-default port (so it can't be confused with prod)
cloud-sql-proxy monitrax-prod:us-west1:monitrax-db-prod-drill --port=5434 &

# 6.2 — Schema is current: the Prisma migrations table should list every migration in prisma/migrations/
psql "host=127.0.0.1 port=5434 dbname=monitrax user=monitrax_app sslmode=require" \
  -c "SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 10;"
```

- [ ] The latest row in `_prisma_migrations` matches the newest folder in `prisma/migrations/` on `main`.

```bash
# 6.3 — Core tables have rows and the counts are in the expected ballpark
psql "host=127.0.0.1 port=5434 dbname=monitrax user=monitrax_app sslmode=require" -c "
  SELECT 'User'                AS table, count(*) FROM \"User\"
  UNION ALL SELECT 'Account',              count(*) FROM \"Account\"
  UNION ALL SELECT 'UnifiedTransaction',   count(*) FROM \"UnifiedTransaction\"
  UNION ALL SELECT 'Organization',         count(*) FROM \"Organization\"
  UNION ALL SELECT 'AuditLog',             count(*) FROM \"AuditLog\"
  UNION ALL SELECT 'ConversationMessage',  count(*) FROM \"ConversationMessage\";
"
```

- [ ] Each count is `> 0` (or matches the known state of prod — if prod genuinely has 0 organizations, that's fine).
- [ ] Counts are within ~5% of the same query run against prod (run it against the proxy to prod on port 5432 to compare). Large divergence ⇒ the backup is stale or the restore is partial — that's a finding.

```bash
# 6.4 — Spot-check referential integrity on one relationship
psql "host=127.0.0.1 port=5434 dbname=monitrax user=monitrax_app sslmode=require" -c "
  SELECT count(*) AS orphaned_accounts
  FROM \"Account\" a LEFT JOIN \"User\" u ON a.\"userId\" = u.id
  WHERE u.id IS NULL;
"
```

- [ ] `orphaned_accounts = 0`.

```bash
# 6.5 — Stop the proxy
kill %1
```

---

## 7. Part D — Tear down the throwaway instance (2 min) — DO NOT SKIP

```bash
gcloud sql instances delete monitrax-db-prod-drill --project=monitrax-prod
# Confirm when prompted. This is the throwaway — it must not survive the drill.
```

- [ ] `monitrax-db-prod-drill` no longer appears in `gcloud sql instances list --project=monitrax-prod`.
- [ ] Any local `pg_dump` files created during an extended (annual) drill are deleted: `shred -u monitrax_*.dump monitrax_*.sql` (or secure-delete equivalent).

> **Why this matters:** a forgotten drill instance is (a) a recurring bill and (b) a second copy of CDR data outside the documented data map — a compliance gap. Deleting it is part of the drill, not an afterthought.

---

## 8. Part E (annual only) — PITR + pg_dump round-trip

Once a year, also exercise the two recovery paths the quarterly drill skips:

**E.1 — Point-in-time recovery**
```bash
# Clone to a timestamp ~1 hour ago (well inside the PITR window)
gcloud sql instances clone monitrax-db-prod monitrax-db-prod-pitr-drill \
  --project=monitrax-prod \
  --point-in-time="$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)"
# Verify it reaches RUNNABLE, spot-check counts (§6), then DELETE it (§7).
```
- [ ] PITR clone reached `RUNNABLE` and passed the §6 spot-checks, then was deleted.

**E.2 — pg_dump → pg_restore round-trip**
- [ ] Followed `02_BACKUP_AND_RESTORE.md` §"Export Full Dump" to create a custom-format dump.
- [ ] Restored it into a *local* throwaway Postgres (`docker run --rm -e POSTGRES_PASSWORD=x -p 5435:5432 postgres:16`) with `pg_restore --no-owner`.
- [ ] Ran the §6 spot-checks against the local restore.
- [ ] Deleted the dump file (`shred -u ...`) and stopped the container.

---

## 9. Drill Log

Record every drill here. A drill that wasn't logged didn't happen.

| Date | Operator | Backup ID restored | Restore→RUNNABLE time | Result | Findings / follow-ups | Next due |
|---|---|---|---|---|---|---|
| _(template)_ 2026-08-10 | Director | _e.g. 1715299200000_ | _e.g. 14 min_ | PASS / FAIL | _e.g. "step 5.1 failed because the drill instance didn't exist — added the `clone` fallback to the runbook"_ | 2026-11-10 |

**Definition of PASS:** Part A all-green, Part B reaches `RUNNABLE`, Part C all spot-checks green, Part D teardown confirmed. Any red box ⇒ FAIL ⇒ raise it as a follow-up (and, if it's a backup-config or restore-path defect, treat it with the urgency of a production-readiness gap, not a routine ticket).

**If a drill FAILS:** open an incident-style entry in the [IMPLEMENTATION_PLAN](../../IMPLEMENTATION_PLAN.md) (a failed restore drill means the recovery path is broken — that is a P1-equivalent finding even though nothing is on fire yet), fix the root cause, and re-run the drill to confirm before closing.

---

## 10. References

| Document | Purpose |
|---|---|
| [`database/02_BACKUP_AND_RESTORE.md`](../database/02_BACKUP_AND_RESTORE.md) | The procedure this drill exercises — backup config, restore, PITR, pg_dump/restore, disaster-recovery scenarios |
| [`database/01_CLOUD_SQL_OPERATIONS.md`](../database/01_CLOUD_SQL_OPERATIONS.md) | Instance details, connection management |
| [`database/04_PRISMA_MIGRATION_BASELINE.md`](../database/04_PRISMA_MIGRATION_BASELINE.md) | Why `_prisma_migrations` exists and how it's populated (relevant to §6.2) |
| [`07_IRP_TABLETOP_EXERCISE.md`](07_IRP_TABLETOP_EXERCISE.md) | Scenario 2 (prod DB down) walks the same restore path under incident pressure |
| [`docs/policy/INCIDENT_RESPONSE_PLAN.md`](../../policy/INCIDENT_RESPONSE_PLAN.md) §8 | Testing & drills cadence (this drill satisfies the "Backup verification" line) |

---

*Last Updated: 2026-05-10 — created as part of the Phase 0 operational-readiness chunk (backup/restore drill + IRP tabletop + observability SLOs).*
