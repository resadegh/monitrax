# Cloud SQL Operations

BAU operations guide for Monitrax PostgreSQL instances on GCP Cloud SQL.

---

## Instances

| Property | Production | Development |
|----------|-----------|-------------|
| Instance name | `monitrax-db-prod` | `monitrax-db-dev` |
| Project | `monitrax-prod` | `monitrax-dev` |
| Region | `us-west1` (Oregon) | `us-west1` (Oregon) |
| Engine | PostgreSQL 15 | PostgreSQL 15 |
| SSL | Required | Required |

---

## Check Instance Status

```bash
# Production
gcloud sql instances describe monitrax-db-prod --project=monitrax-prod --format="table(state,settings.tier,settings.dataDiskSizeGb,settings.availabilityType)"

# Development
gcloud sql instances describe monitrax-db-dev --project=monitrax-dev --format="table(state,settings.tier,settings.dataDiskSizeGb,settings.availabilityType)"
```

Via console: **SQL > Instances > monitrax-db-prod > Overview**

---

## Connect via psql

The application connects through the `DATABASE_URL` environment variable (managed in GCP Secret Manager). For manual access:

```bash
# Using Cloud SQL Auth Proxy (preferred)
cloud-sql-proxy monitrax-prod:us-west1:monitrax-db-prod --port=5432 &
psql "host=127.0.0.1 port=5432 dbname=monitrax user=monitrax_app sslmode=require"

# Direct connection (requires authorized network)
psql "host=<INSTANCE_IP> port=5432 dbname=monitrax user=monitrax_app sslmode=verify-ca \
  sslrootcert=server-ca.pem sslcert=client-cert.pem sslkey=client-key.pem"
```

Download SSL certs from: **SQL > Instances > monitrax-db-prod > Connections > Security > Manage SSL client certificates**

> **WARNING**: Never connect to production without a valid reason. All connections are logged.

---

## Storage Usage

```bash
# Check current disk usage
gcloud sql instances describe monitrax-db-prod --project=monitrax-prod \
  --format="table(settings.dataDiskSizeGb,settings.storageAutoResize)"

# Check usage from inside the database
psql -c "SELECT pg_size_pretty(pg_database_size('monitrax'));"

# Per-table sizes (top 20)
psql -c "SELECT schemaname || '.' || tablename AS table,
         pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
         FROM pg_tables WHERE schemaname = 'public'
         ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC LIMIT 20;"
```

Storage auto-resize should be **enabled** on both instances. Verify with the `describe` command above.

---

## Connection Limits

```bash
# Check max connections flag
gcloud sql instances describe monitrax-db-prod --project=monitrax-prod \
  --format="json(settings.databaseFlags)"

# Check active connections from inside the database
psql -c "SELECT count(*) AS active_connections FROM pg_stat_activity;"
psql -c "SHOW max_connections;"
```

The application uses Prisma's connection pool (`lib/db.ts` singleton). Default pool size is determined by the `connection_limit` parameter in `DATABASE_URL`. Typical setting: `?connection_limit=10` per serverless function instance.

---

## Scale Up / Down

```bash
# Change machine tier (requires restart — schedule during maintenance window)
gcloud sql instances patch monitrax-db-prod --project=monitrax-prod \
  --tier=db-custom-<CPUS>-<MEMORY_MB>

# Example: scale prod to 4 vCPUs, 16 GB RAM
gcloud sql instances patch monitrax-db-prod --project=monitrax-prod \
  --tier=db-custom-4-16384

# Increase disk size (no restart required, cannot be decreased)
gcloud sql instances patch monitrax-db-prod --project=monitrax-prod \
  --storage-size=50GB
```

> **NOTE**: Disk size can only be increased, never decreased. Plan accordingly.

---

## Maintenance Windows

```bash
# View current maintenance window
gcloud sql instances describe monitrax-db-prod --project=monitrax-prod \
  --format="json(settings.maintenanceWindow)"

# Set maintenance window (Sunday 03:00 UTC — Saturday evening US Pacific)
gcloud sql instances patch monitrax-db-prod --project=monitrax-prod \
  --maintenance-window-day=SUN --maintenance-window-hour=3

# Deny maintenance during a critical period
gcloud sql instances patch monitrax-db-prod --project=monitrax-prod \
  --deny-maintenance-period-start-date=2026-06-30 \
  --deny-maintenance-period-end-date=2026-07-02
```

Recommended: maintenance window on **Sunday 03:00 UTC** (low-traffic period).

---

## Authorized Networks

```bash
# List current authorized networks
gcloud sql instances describe monitrax-db-prod --project=monitrax-prod \
  --format="json(settings.ipConfiguration.authorizedNetworks)"

# Add a network (e.g., office IP for debugging)
gcloud sql instances patch monitrax-db-prod --project=monitrax-prod \
  --authorized-networks="<EXISTING_CIDRS>,<NEW_CIDR>"

# Remove a network (re-specify only the networks you want to keep)
gcloud sql instances patch monitrax-db-prod --project=monitrax-prod \
  --authorized-networks="<REMAINING_CIDRS>"
```

> **IMPORTANT**: Prefer Cloud SQL Auth Proxy over authorized networks. Remove temporary network entries after use. Production should have minimal authorized networks.

---

## Database Flags

```bash
# View current flags
gcloud sql instances describe monitrax-db-prod --project=monitrax-prod \
  --format="json(settings.databaseFlags)"

# Set a flag
gcloud sql instances patch monitrax-db-prod --project=monitrax-prod \
  --database-flags=log_connections=on,log_disconnections=on,log_statement=ddl,log_min_duration_statement=1000
```

Recommended flags for production:

| Flag | Value | Purpose |
|------|-------|---------|
| `log_connections` | `on` | Audit connection attempts |
| `log_disconnections` | `on` | Audit connection closures |
| `log_statement` | `ddl` | Log schema changes |
| `log_min_duration_statement` | `1000` | Log queries slower than 1 second |
| `log_lock_waits` | `on` | Log lock contention |

> **NOTE**: Changing flags may require an instance restart. Check flag documentation before applying.

---

## Legacy Tables

The database contains legacy tables that are **NOT** defined in the Prisma schema (`prisma/schema.prisma`). These tables **MUST be preserved** — do not drop or modify them. If you need to identify legacy tables:

```sql
-- Tables in the database but not managed by Prisma
-- Compare this output against the Prisma schema model list
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

When running Prisma migrations, always use `prisma migrate deploy` (not `prisma db push`) to avoid accidentally dropping legacy tables.

---

*Last Updated: 2026-04-09*
