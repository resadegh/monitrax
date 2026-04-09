# Backup and Restore

BAU backup and restore procedures for Monitrax PostgreSQL on GCP Cloud SQL.

---

## Automated Backups

Cloud SQL automated backups are enabled on both instances.

| Setting | Production | Development |
|---------|-----------|-------------|
| Automated backups | Enabled | Enabled |
| Backup window | 04:00 UTC | 04:00 UTC |
| Retention | 30 days | 7 days |
| Location | us-west1 | us-west1 |
| Point-in-time recovery | Enabled | Disabled |

```bash
# Verify automated backup configuration
gcloud sql instances describe monitrax-db-prod --project=monitrax-prod \
  --format="json(settings.backupConfiguration)"

# List recent backups
gcloud sql backups list --instance=monitrax-db-prod --project=monitrax-prod
```

---

## On-Demand Backups

Create a manual backup before risky operations (migrations, bulk deletes, schema changes).

```bash
# Create on-demand backup — production
gcloud sql backups create --instance=monitrax-db-prod --project=monitrax-prod \
  --description="Pre-migration backup $(date +%Y-%m-%d_%H%M)"

# Create on-demand backup — development
gcloud sql backups create --instance=monitrax-db-dev --project=monitrax-dev \
  --description="Pre-migration backup $(date +%Y-%m-%d_%H%M)"

# List backups to confirm
gcloud sql backups list --instance=monitrax-db-prod --project=monitrax-prod --limit=5
```

> **RULE**: Always create an on-demand backup before running `prisma migrate deploy` in production.

---

## Restore from Backup

### Restore to the Same Instance (Overwrites Current Data)

```bash
# List backups to find the backup ID
gcloud sql backups list --instance=monitrax-db-prod --project=monitrax-prod

# Restore (replaces all data — the instance will restart)
gcloud sql backups restore <BACKUP_ID> --restore-instance=monitrax-db-prod \
  --project=monitrax-prod
```

> **WARNING**: This overwrites all current data. Notify the team and stop application traffic first.

### Restore to a New Instance (Safer — Verify Before Switching)

```bash
# Clone from backup into a temporary instance
gcloud sql instances clone monitrax-db-prod monitrax-db-prod-restore \
  --project=monitrax-prod

# Or restore a specific backup to a new instance
gcloud sql backups restore <BACKUP_ID> --restore-instance=monitrax-db-prod-restore \
  --project=monitrax-prod
```

After verifying the restored data is correct, update the application's `DATABASE_URL` in Secret Manager to point at the new instance, then delete the old one.

---

## Point-in-Time Recovery (PITR)

PITR is enabled on production. It allows restoring to any point within the transaction log retention window (default: 7 days of logs).

```bash
# Clone to a specific point in time
gcloud sql instances clone monitrax-db-prod monitrax-db-prod-pitr \
  --project=monitrax-prod \
  --point-in-time="2026-04-08T14:30:00Z"
```

Use PITR when:
- A bad migration ran and you need to recover to just before it
- Accidental data deletion occurred at a known time
- You need a consistent snapshot from a specific moment

---

## Export Full Dump (pg_dump)

For offline backups or migrating data outside Cloud SQL.

```bash
# Start Cloud SQL Auth Proxy
cloud-sql-proxy monitrax-prod:us-west1:monitrax-db-prod --port=5432 &

# Full database dump (custom format — supports selective restore)
pg_dump "host=127.0.0.1 port=5432 dbname=monitrax user=monitrax_app sslmode=require" \
  --format=custom --verbose --file=monitrax_prod_$(date +%Y%m%d_%H%M).dump

# Full database dump (plain SQL — human-readable)
pg_dump "host=127.0.0.1 port=5432 dbname=monitrax user=monitrax_app sslmode=require" \
  --format=plain --verbose --file=monitrax_prod_$(date +%Y%m%d_%H%M).sql

# Schema only (no data)
pg_dump "host=127.0.0.1 port=5432 dbname=monitrax user=monitrax_app sslmode=require" \
  --schema-only --file=monitrax_schema_$(date +%Y%m%d_%H%M).sql
```

> **CDR COMPLIANCE**: Dump files contain CDR-protected data. Encrypt before storing. Never transfer over unencrypted channels. Delete local copies after uploading to GCS.

---

## Import a Dump (pg_restore)

```bash
# Start Cloud SQL Auth Proxy
cloud-sql-proxy monitrax-prod:us-west1:monitrax-db-prod --port=5432 &

# Restore from custom-format dump
pg_restore "host=127.0.0.1 port=5432 dbname=monitrax user=monitrax_app sslmode=require" \
  --verbose --clean --if-exists --no-owner \
  monitrax_prod_20260408_1430.dump

# Restore from plain SQL
psql "host=127.0.0.1 port=5432 dbname=monitrax user=monitrax_app sslmode=require" \
  --file=monitrax_prod_20260408_1430.sql
```

Flags explained:
- `--clean` drops existing objects before recreating (use with caution)
- `--if-exists` avoids errors if objects do not exist
- `--no-owner` skips ownership commands (Cloud SQL manages roles)

> **IMPORTANT**: Legacy tables not in the Prisma schema will be included in dumps. When restoring, ensure these tables are preserved.

---

## Offline Backup Storage (GCS)

Store offline backups in a dedicated GCS bucket with encryption and lifecycle rules.

**Bucket**: `gs://monitrax-db-backups-prod`

```bash
# Upload dump to GCS
gsutil cp monitrax_prod_$(date +%Y%m%d_%H%M).dump \
  gs://monitrax-db-backups-prod/manual/

# List stored backups
gsutil ls -l gs://monitrax-db-backups-prod/manual/

# Download a backup
gsutil cp gs://monitrax-db-backups-prod/manual/monitrax_prod_20260408_1430.dump .
```

Bucket configuration:
- **Location**: `us-west1`
- **Storage class**: Nearline (backups accessed infrequently)
- **Encryption**: Google-managed or CMEK (match CDR requirements)
- **Lifecycle rule**: Delete objects older than 90 days
- **Versioning**: Enabled
- **Access**: IAM-only (no public access, no ACLs)

---

## Backup Retention Policy

| Backup Type | Retention | Storage |
|-------------|-----------|---------|
| Cloud SQL automated (prod) | 30 days | Cloud SQL managed |
| Cloud SQL automated (dev) | 7 days | Cloud SQL managed |
| On-demand (prod) | Until manually deleted | Cloud SQL managed |
| pg_dump to GCS (prod) | 90 days (lifecycle rule) | `gs://monitrax-db-backups-prod` |
| pg_dump to GCS (dev) | 30 days (lifecycle rule) | `gs://monitrax-db-backups-dev` |

---

## Disaster Recovery Steps

### Scenario: Production Instance Unavailable

1. **Assess** -- Check instance status:
   ```bash
   gcloud sql instances describe monitrax-db-prod --project=monitrax-prod --format="value(state)"
   ```
2. **If SUSPENDED or FAILED** -- Contact GCP support. Check for billing or quota issues.
3. **If data corruption** -- Restore from the most recent clean backup:
   ```bash
   # Option A: PITR to just before the incident
   gcloud sql instances clone monitrax-db-prod monitrax-db-prod-dr \
     --project=monitrax-prod --point-in-time="<TIMESTAMP_BEFORE_INCIDENT>"

   # Option B: Restore last automated backup
   gcloud sql backups list --instance=monitrax-db-prod --project=monitrax-prod --limit=5
   gcloud sql backups restore <BACKUP_ID> --restore-instance=monitrax-db-prod-dr \
     --project=monitrax-prod
   ```
4. **Verify** the restored instance:
   ```bash
   cloud-sql-proxy monitrax-prod:us-west1:monitrax-db-prod-dr --port=5433 &
   psql "host=127.0.0.1 port=5433 dbname=monitrax user=monitrax_app sslmode=require" \
     -c "SELECT count(*) FROM \"User\";"
   ```
5. **Switch traffic** -- Update `DATABASE_URL` in GCP Secret Manager to point to the new instance.
6. **Redeploy** the application to pick up the new secret value.
7. **Notify** the team and document the incident.

### Scenario: Accidental Data Deletion

1. Identify the exact time of deletion from application logs or audit logs.
2. Use PITR to clone to just before that time (see above).
3. Extract the deleted data from the clone and re-insert into production.
4. Delete the temporary clone instance when done.

### Scenario: Region Outage (us-west1)

1. Restore from the most recent GCS backup to a Cloud SQL instance in another region.
2. Update DNS and application configuration to point to the new region.
3. This is a major incident -- follow the Incident Response Plan (`docs/policy/INCIDENT_RESPONSE_PLAN.md`).

---

*Last Updated: 2026-04-09*
