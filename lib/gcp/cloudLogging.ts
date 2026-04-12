/**
 * GCP Cloud Logging API Service
 *
 * Phase M.2.2: Reads audit logs directly from Cloud Logging for the admin portal.
 *
 * This is the GCP-First approach: GCP is the source of truth for audit logs.
 * The admin audit page queries Cloud Logging directly instead of relying only
 * on PostgreSQL (which serves as a secondary local cache for fast queries).
 *
 * Cloud Logging is required because:
 * - CDR compliance mandates 365+ day log retention
 * - Logs must be tamper-proof (Cloud Logging is append-only)
 * - Admin portal must reflect the authoritative audit trail
 *
 * @see docs/blueprint/PHASE_M_ADMIN_PORTAL_GCP_FIRST.md
 */

import { log } from '@/lib/utils/logger';

// Lazy-initialized Cloud Logging client
let cloudLoggingClient: any = null;
let cloudLoggingInitFailed = false;

/**
 * Get or initialize the Cloud Logging client.
 * Returns null if Cloud Logging is not configured.
 */
function getCloudLoggingClient(): any {
  if (cloudLoggingInitFailed) return null;
  if (cloudLoggingClient) return cloudLoggingClient;

  try {
    const { Logging } = require('@google-cloud/logging');
    const projectId = process.env.GCP_PROJECT_ID;
    if (!projectId) {
      cloudLoggingInitFailed = true;
      log.warn('[Cloud Logging] GCP_PROJECT_ID not set — Cloud Logging API unavailable');
      return null;
    }
    cloudLoggingClient = new Logging({ projectId });
    return cloudLoggingClient;
  } catch (error) {
    cloudLoggingInitFailed = true;
    log.error('[Cloud Logging] Failed to initialize', error as Error);
    return null;
  }
}

export interface CloudLogEntry {
  insertId: string;
  timestamp: string;
  severity: string;
  resource: {
    type: string;
  };
  labels: Record<string, string>;
  logName: string;
  jsonPayload: Record<string, unknown>;
}

export interface CloudLogQuery {
  /** Log name (e.g., 'monitrax-audit') */
  logName?: string;
  /** Minimum timestamp (ISO string) */
  startTime?: string;
  /** Maximum timestamp (ISO string) */
  endTime?: string;
  /** Filter by severity (INFO, WARNING, ERROR) */
  severity?: string;
  /** Filter by action label */
  action?: string;
  /** Filter by entity type label */
  entityType?: string;
  /** Filter by userId in jsonPayload */
  userId?: string;
  /** Max results */
  pageSize?: number;
  /** Pagination token */
  pageToken?: string;
}

export interface CloudLogQueryResult {
  entries: CloudLogEntry[];
  nextPageToken: string | null;
  total: number;
  source: 'cloud-logging' | 'postgres-fallback';
}

/**
 * Query Cloud Logging for audit log entries.
 *
 * Builds a Logging filter string and calls the entries.list API.
 * Returns a unified result format compatible with the PostgreSQL format.
 */
export async function queryCloudLogs(query: CloudLogQuery = {}): Promise<CloudLogQueryResult> {
  const client = getCloudLoggingClient();
  if (!client) {
    return {
      entries: [],
      nextPageToken: null,
      total: 0,
      source: 'postgres-fallback',
    };
  }

  try {
    // Build the Cloud Logging filter string
    const filters: string[] = [];
    const logName = query.logName || 'monitrax-audit';
    filters.push(`logName="projects/${process.env.GCP_PROJECT_ID}/logs/${logName}"`);

    if (query.startTime) {
      filters.push(`timestamp>="${query.startTime}"`);
    }
    if (query.endTime) {
      filters.push(`timestamp<="${query.endTime}"`);
    }
    if (query.severity) {
      filters.push(`severity="${query.severity}"`);
    }
    if (query.action) {
      filters.push(`labels.action="${query.action}"`);
    }
    if (query.entityType) {
      filters.push(`labels.entityType="${query.entityType}"`);
    }
    if (query.userId) {
      filters.push(`jsonPayload.userId="${query.userId}"`);
    }

    const filter = filters.join(' AND ');
    const pageSize = Math.min(query.pageSize || 50, 500);

    // Call Cloud Logging API
    const [entries, nextPageToken] = await client.getEntries({
      filter,
      pageSize,
      pageToken: query.pageToken,
      orderBy: 'timestamp desc',
    });

    const mappedEntries: CloudLogEntry[] = entries.map((entry: any) => {
      const metadata = entry.metadata || {};
      return {
        insertId: metadata.insertId || '',
        timestamp: metadata.timestamp ? new Date(metadata.timestamp.seconds * 1000 + (metadata.timestamp.nanos || 0) / 1e6).toISOString() : new Date().toISOString(),
        severity: metadata.severity || 'INFO',
        resource: metadata.resource || { type: 'global' },
        labels: metadata.labels || {},
        logName: metadata.logName || '',
        jsonPayload: (entry.data || {}) as Record<string, unknown>,
      };
    });

    return {
      entries: mappedEntries,
      nextPageToken: (nextPageToken as any)?.pageToken || null,
      total: mappedEntries.length,
      source: 'cloud-logging',
    };
  } catch (error) {
    log.error('[Cloud Logging] Query failed', error as Error);
    return {
      entries: [],
      nextPageToken: null,
      total: 0,
      source: 'postgres-fallback',
    };
  }
}

/**
 * Check if Cloud Logging is available for this environment.
 * Used by admin UI to show/hide Cloud Logging features.
 */
export function isCloudLoggingAvailable(): boolean {
  return getCloudLoggingClient() !== null;
}

/**
 * Get the Cloud Logging Console URL for deep-linking.
 * Admin portal can link directly to GCP Console Logs Explorer with a filter.
 */
export function getCloudLoggingConsoleUrl(logName: string = 'monitrax-audit'): string {
  const projectId = process.env.GCP_PROJECT_ID || '';
  const encodedFilter = encodeURIComponent(
    `logName="projects/${projectId}/logs/${logName}"`
  );
  return `https://console.cloud.google.com/logs/query;query=${encodedFilter}?project=${projectId}`;
}
