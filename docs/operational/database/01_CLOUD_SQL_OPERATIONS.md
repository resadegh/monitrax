# Cloud SQL Operations

BAU operations guide for Monitrax PostgreSQL instances on GCP Cloud SQL.

> **2026-05-01 update:** Application runtime now serves 100% of
> Production traffic via Workload Identity Federation + Cloud SQL
> Connector + IAM database authentication
> (`USE_CLOUD_SQL_CONNECTOR=true`, Phase 9 cutover complete). The
> legacy `DATABASE_URL` password path is still wired in as a fallback
> for the 30-day stabilisation window and is the path used by
> `prisma migrate deploy` at build time. See `lib/db.ts`,
> `docs/operational/security/04_WIF_TROUBLESHOOTING.md` (runbook
> §3.A–§3.J for known failure modes), and
> `docs/compliance/CDR_WIF_AUTHENTICATION_EVIDENCE.md` §7 for the
> cutover record.

---

## Instances

| Property | Production | Development |
|----------|-----------|-------------|
| Instance name | `monitrax-db-prod` | `monitrax-db-dev` |
| Project | `monitrax-479700` | `monitrax-479700` |
| Region | `australia-southeast1` (Sydney) | `australia-southeast1` (Sydney) |
| Engine | PostgreSQL 18 | PostgreSQL 18 |
| Edition | **Cloud SQL Enterprise Plus** (upgraded 2026-05-02) | same |
| Runtime auth | **WIF + Cloud SQL Connector + IAM DB auth** (after Phase 9 of WIF) | same |
| Build-time auth | `DATABASE_URL` password (used by `prisma migrate deploy`) | same |
| SSL | Required | Required |

> **Edition note (2026-05-02):** Production was upgraded from `db-g1-small` (Cloud SQL **Standard** edition, shared 1 vCPU / 1.7 GB) to **Cloud SQL Enterprise Plus**. Enterprise Plus gives us: (a) dedicated machine resources (no noisy-neighbour); (b) faster failover (under 60s); (c) integrated near-zero-downtime maintenance; (d) data cache (transparent in-memory layer for read performance); (e) point-in-time recovery with finer granularity. Run `gcloud sql instances describe monitrax-db-prod --format="value(settings.edition,settings.tier)"` to confirm the live edition + tier flags.

---

## Check Instance Status

```bash
# Production
gcloud sql instances describe monitrax-db-prod --project=monitrax-479700 --format="table(state,settings.tier,settings.dataDiskSizeGb,settings.availabilityType)"

# Development
gcloud sql instances describe monitrax-db-dev --project=monitrax-479700 --format="table(state,settings.tier,settings.dataDiskSizeGb,settings.availabilityType)"
```

Via console: **SQL > Instances > monitrax-db-prod > Overview**

---

## Connect via psql

> **DEPRECATION NOTE (updated 2026-05-01):** The password-based examples
> below are legacy. Prefer the IAM-authenticated Cloud SQL Auth Proxy
> flow for any manual access to production. The application runtime no
> longer uses a password — Production has been on the WIF + Connector
> path since 2026-05-01 (Phase 9 of the WIF workstream). The legacy
> `monitrax_user` will be disabled in Phase 11 (~30 days after cutover)
> — after that, the only supported access path is IAM.

### Preferred — IAM-authenticated Cloud SQL Auth Proxy

```bash
# Authenticate as your own GCP identity (must have Cloud SQL Client + Cloud
# SQL Instance User roles, plus a matching Postgres IAM user inside the DB).
gcloud auth application-default login

cloud-sql-proxy monitrax-479700:australia-southeast1:monitrax-db-prod \
  --auto-iam-authn --port=5432 &

# Connect — note: NO password. Username is your IAM-mapped DB user.
psql "host=127.0.0.1 port=5432 dbname=monitrax user=<your.email>@monitrax-479700.iam sslmode=disable"
```

### Legacy — password-based (for break-glass only)

```bash
# Using Cloud SQL Auth Proxy with password
cloud-sql-proxy monitrax-479700:australia-southeast1:monitrax-db-prod --port=5432 &
psql "host=127.0.0.1 port=5432 dbname=monitrax user=monitrax_user sslmode=require"

# Direct connection (requires being on an authorized network — being phased
# out in Phase 10 of WIF; do not rely on this for new tooling)
psql "host=<INSTANCE_IP> port=5432 dbname=monitrax user=monitrax_user sslmode=verify-ca \
  sslrootcert=server-ca.pem sslcert=client-cert.pem sslkey=client-key.pem"
```

Download SSL certs from: **SQL > Instances > monitrax-db-prod > Connections > Security > Manage SSL client certificates**

> **WARNING**: Never connect to production without a valid reason. All connections are logged via `log_connections` / `log_disconnections` flags and surface in Cloud Logging.

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
