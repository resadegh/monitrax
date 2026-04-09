# Monitoring and Alerts

BAU monitoring and alerting guide for Monitrax PostgreSQL on GCP Cloud SQL.

---

## Key Metrics to Watch

| Metric | Resource Type | Description | Warning Threshold | Critical Threshold |
|--------|--------------|-------------|-------------------|-------------------|
| `database/cpu/utilization` | Cloud SQL | CPU usage (0.0 - 1.0) | > 0.7 for 5 min | > 0.9 for 5 min |
| `database/memory/utilization` | Cloud SQL | Memory usage (0.0 - 1.0) | > 0.8 for 5 min | > 0.95 for 5 min |
| `database/postgresql/num_backends` | Cloud SQL | Active connections | > 80% of max_connections | > 90% of max_connections |
| `database/disk/utilization` | Cloud SQL | Disk usage (0.0 - 1.0) | > 0.7 | > 0.85 |
| `database/disk/bytes_used` | Cloud SQL | Absolute disk bytes used | -- | -- |
| `database/network/connections` | Cloud SQL | Connection count | -- | Sudden spike or drop to 0 |
| `database/replication/replica_byte_lag` | Cloud SQL | Replication lag (if read replicas exist) | > 10 MB | > 100 MB |
| `database/postgresql/transaction_count` | Cloud SQL | Transactions per second | -- | Sudden drop to 0 |
| `database/up` | Cloud SQL | Instance availability (1 = up) | -- | 0 for 1 min |

View these in Cloud Console: **Monitoring > Metrics Explorer > Resource type: Cloud SQL Database**

---

## Recommended Alert Policies

Create these policies in **Cloud Monitoring > Alerting > Create Policy**.

### 1. High CPU

- **Condition**: `database/cpu/utilization` > 0.85 for 10 minutes
- **Instance**: `monitrax-db-prod`
- **Notification**: Email + Slack (ops channel)
- **Severity**: Warning

### 2. High Memory

- **Condition**: `database/memory/utilization` > 0.9 for 5 minutes
- **Instance**: `monitrax-db-prod`
- **Notification**: Email + Slack (ops channel)
- **Severity**: Critical

### 3. Disk Usage High

- **Condition**: `database/disk/utilization` > 0.8
- **Instance**: `monitrax-db-prod`
- **Notification**: Email + Slack (ops channel)
- **Severity**: Warning
- **Action**: Verify `storageAutoResize` is enabled. If approaching hard limit, increase disk manually (see `01_CLOUD_SQL_OPERATIONS.md`).

### 4. Connection Count High

- **Condition**: `database/postgresql/num_backends` > 80% of `max_connections` for 5 minutes
- **Instance**: `monitrax-db-prod`
- **Notification**: Email + Slack (ops channel)
- **Severity**: Warning
- **Action**: Check for connection leaks. Review Prisma pool size (`connection_limit` in `DATABASE_URL`).

### 5. Instance Down

- **Condition**: Uptime check on `GET /api/health` fails for 2 consecutive checks (60-second interval)
- **Notification**: PagerDuty + Email + Slack (ops channel)
- **Severity**: Critical

### 6. Replication Lag (if read replicas exist)

- **Condition**: `database/replication/replica_byte_lag` > 50 MB for 5 minutes
- **Instance**: Any read replica
- **Notification**: Email + Slack (ops channel)
- **Severity**: Warning

### Create alerts via gcloud

```bash
# Example: CPU alert policy (create via gcloud or Terraform -- console is easier for one-off)
gcloud alpha monitoring policies create \
  --display-name="Cloud SQL Prod - High CPU" \
  --condition-display-name="CPU > 85% for 10 min" \
  --condition-filter='resource.type="cloudsql_database" AND resource.labels.database_id="monitrax-prod:monitrax-db-prod" AND metric.type="cloudsql.googleapis.com/database/cpu/utilization"' \
  --condition-threshold-value=0.85 \
  --condition-threshold-duration=600s \
  --notification-channels=<CHANNEL_ID> \
  --project=monitrax-prod
```

---

## Cloud SQL Logs in Cloud Logging

### View logs in Console

**Logging > Logs Explorer** with this filter:

```
resource.type="cloudsql_database"
resource.labels.database_id="monitrax-prod:monitrax-db-prod"
```

### Common log queries

```
-- Connection events
resource.type="cloudsql_database"
resource.labels.database_id="monitrax-prod:monitrax-db-prod"
textPayload=~"connection"

-- Slow queries (requires log_min_duration_statement flag)
resource.type="cloudsql_database"
resource.labels.database_id="monitrax-prod:monitrax-db-prod"
textPayload=~"duration:"

-- Errors
resource.type="cloudsql_database"
resource.labels.database_id="monitrax-prod:monitrax-db-prod"
severity="ERROR"

-- DDL statements (schema changes)
resource.type="cloudsql_database"
resource.labels.database_id="monitrax-prod:monitrax-db-prod"
textPayload=~"statement: (CREATE|ALTER|DROP)"
```

### Via gcloud

```bash
# Tail live logs
gcloud logging read \
  'resource.type="cloudsql_database" AND resource.labels.database_id="monitrax-prod:monitrax-db-prod"' \
  --project=monitrax-prod --limit=50 --format=json

# Errors only
gcloud logging read \
  'resource.type="cloudsql_database" AND resource.labels.database_id="monitrax-prod:monitrax-db-prod" AND severity="ERROR"' \
  --project=monitrax-prod --limit=20 --format=json
```

---

## Database Flags for Logging

These flags must be set on the production instance (see `01_CLOUD_SQL_OPERATIONS.md` for how to set flags).

| Flag | Recommended Value | Purpose |
|------|-------------------|---------|
| `log_connections` | `on` | Log every new connection (who, when, from where) |
| `log_disconnections` | `on` | Log connection closures (detect connection leaks) |
| `log_statement` | `ddl` | Log all DDL (CREATE, ALTER, DROP). Set to `all` temporarily for debugging |
| `log_min_duration_statement` | `1000` | Log queries taking longer than 1000 ms (1 second) |
| `log_lock_waits` | `on` | Log when a query waits for a lock longer than `deadlock_timeout` |
| `log_checkpoints` | `on` | Log checkpoint activity (useful for write-heavy workload tuning) |
| `log_temp_files` | `0` | Log all temp file usage (indicates queries spilling to disk) |

> **WARNING**: Setting `log_statement=all` in production generates a high volume of logs. Use temporarily for debugging only, then revert to `ddl`.

---

## Checking Slow Queries

### From Cloud Logging

With `log_min_duration_statement=1000` set, any query over 1 second appears in logs. Use the Logs Explorer query above to find them.

### From inside the database

```sql
-- Enable pg_stat_statements extension (one-time)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 20 slowest queries by total time
SELECT
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  round(max_exec_time::numeric, 2) AS max_ms,
  rows,
  left(query, 120) AS query
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Top 20 most frequently called queries
SELECT
  calls,
  round(total_exec_time::numeric, 2) AS total_ms,
  round(mean_exec_time::numeric, 2) AS mean_ms,
  rows,
  left(query, 120) AS query
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 20;

-- Reset stats (do this periodically to get fresh data)
SELECT pg_stat_statements_reset();
```

> **NOTE**: `pg_stat_statements` must be enabled via database flag `shared_preload_libraries=pg_stat_statements` (requires restart). Check if already enabled before attempting to create the extension.

### From Cloud SQL Insights (Console)

**SQL > Instances > monitrax-db-prod > Query Insights**

This provides a built-in dashboard for:
- Top queries by CPU time
- Top queries by IO wait
- Top queries by lock wait
- Query latency over time

Enable Query Insights if not already active:
```bash
gcloud sql instances patch monitrax-db-prod --project=monitrax-prod \
  --insights-config-query-insights-enabled \
  --insights-config-query-string-length=1024 \
  --insights-config-record-application-tags \
  --insights-config-record-client-address
```

---

## Health Check Endpoint

The application exposes a health check at:

```
GET /api/health
```

**Implementation** (`app/api/health/route.ts`): Runs `SELECT 1` via the Prisma client. Returns:

| Status | HTTP Code | Body |
|--------|-----------|------|
| Healthy | 200 | `{ "status": "healthy", "database": "connected", "timestamp": "..." }` |
| Unhealthy | 503 | `{ "status": "unhealthy", "database": "disconnected", "timestamp": "..." }` |

### Uptime check configuration

Create in **Monitoring > Uptime Checks**:

- **Protocol**: HTTPS
- **Hostname**: Production app URL (e.g., `monitrax.com`)
- **Path**: `/api/health`
- **Check frequency**: 60 seconds
- **Timeout**: 10 seconds
- **Response match**: Body contains `"healthy"`
- **Alert on failure**: 2 consecutive failures
- **Notification**: PagerDuty + Email + Slack

```bash
# Create uptime check via gcloud
gcloud monitoring uptime create "Monitrax Health Check" \
  --resource-type=uptime-url \
  --hostname=monitrax.com \
  --path=/api/health \
  --check-every=60s \
  --timeout=10s \
  --project=monitrax-prod
```

---

## When Alerts Fire -- Response Playbook

### High CPU (> 85%)

1. Check Cloud SQL Query Insights for expensive queries.
2. Check `pg_stat_activity` for long-running queries:
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
   FROM pg_stat_activity
   WHERE state != 'idle' AND query_start < now() - interval '30 seconds'
   ORDER BY duration DESC;
   ```
3. Kill runaway queries if needed: `SELECT pg_terminate_backend(<pid>);`
4. If sustained, scale up the instance tier (see `01_CLOUD_SQL_OPERATIONS.md`).
5. Review application code for missing indexes or N+1 queries.

### High Memory (> 90%)

1. Check for connection count -- each connection uses memory.
2. Check `work_mem` and `shared_buffers` flags.
3. Look for queries using large temp tables (`log_temp_files` flag).
4. If sustained, scale up memory tier.

### Disk Usage High (> 80%)

1. Check `storageAutoResize` is enabled:
   ```bash
   gcloud sql instances describe monitrax-db-prod --project=monitrax-prod \
     --format="value(settings.storageAutoResize)"
   ```
2. Identify largest tables:
   ```sql
   SELECT schemaname || '.' || tablename AS table,
          pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
   FROM pg_tables WHERE schemaname = 'public'
   ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
   LIMIT 20;
   ```
3. Check for bloat -- run `VACUUM ANALYZE` on large tables.
4. Check for old data eligible for archival or deletion (respect CDR retention rules).
5. If auto-resize is off or approaching limits, increase disk manually.

### Connection Count High (> 80% of max)

1. Check active connections:
   ```sql
   SELECT client_addr, usename, state, count(*)
   FROM pg_stat_activity
   GROUP BY client_addr, usename, state
   ORDER BY count DESC;
   ```
2. Look for idle connections that should have been released.
3. Check Prisma `connection_limit` in `DATABASE_URL` -- reduce if too many serverless instances are each opening pools.
4. Consider enabling PgBouncer (Cloud SQL supports built-in connection pooling).
5. Kill idle connections older than 10 minutes if needed:
   ```sql
   SELECT pg_terminate_backend(pid)
   FROM pg_stat_activity
   WHERE state = 'idle' AND query_start < now() - interval '10 minutes';
   ```

### Health Check Failing (503)

1. Check if the Cloud SQL instance is running:
   ```bash
   gcloud sql instances describe monitrax-db-prod --project=monitrax-prod --format="value(state)"
   ```
2. If instance is `RUNNABLE` but health check fails:
   - Check application logs in Cloud Logging for connection errors.
   - Verify the Cloud SQL Auth Proxy or direct connection is working.
   - Check if `max_connections` has been exhausted.
3. If instance is `SUSPENDED` or `MAINTENANCE`:
   - Suspended: Check billing and quotas.
   - Maintenance: Wait for maintenance to complete (check maintenance logs).
4. If instance is unreachable:
   - Check VPC networking and authorized networks.
   - Check if the instance IP changed (unlikely but possible after maintenance).
5. Escalate to GCP Support if the instance state is abnormal.

### Replication Lag High

1. Check replica status:
   ```bash
   gcloud sql instances describe <REPLICA_NAME> --project=monitrax-prod \
     --format="json(replicaConfiguration)"
   ```
2. High lag usually means the primary is writing faster than the replica can apply.
3. Check primary for write-heavy queries or bulk operations.
4. If sustained, scale up the replica tier to match the primary.

---

## Useful Ad-Hoc Monitoring Queries

```sql
-- Current database size
SELECT pg_size_pretty(pg_database_size('monitrax'));

-- Table row counts (estimates from planner stats, fast)
SELECT relname AS table, reltuples::bigint AS estimated_rows
FROM pg_class WHERE relkind = 'r' AND relnamespace = 'public'::regnamespace
ORDER BY reltuples DESC LIMIT 20;

-- Index usage (unused indexes are candidates for removal)
SELECT indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC
LIMIT 20;

-- Cache hit ratio (should be > 99%)
SELECT
  sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) AS cache_hit_ratio
FROM pg_statio_user_tables;

-- Lock contention
SELECT locktype, relation::regclass, mode, granted, pid
FROM pg_locks WHERE NOT granted;
```

---

*Last Updated: 2026-04-09*
