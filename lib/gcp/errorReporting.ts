/**
 * GCP Error Reporting API Service
 *
 * Phase M.2.5: Reads grouped errors from GCP Error Reporting.
 * Used by the admin portal Error Logs page to show application errors.
 *
 * Note: Error Reporting auto-groups similar errors. Errors are automatically
 * captured from Cloud Logging entries with severity ERROR and stack traces.
 *
 * @see docs/blueprint/PHASE_M_ADMIN_PORTAL_GCP_FIRST.md
 */

import { log } from '@/lib/utils/logger';
import { getGCPClientOptions, getGCPProjectId } from './credentials';

let errorGroupClient: any = null;
let errorStatsClient: any = null;
let errorReportingInitFailed = false;

function getProjectPath(): string | null {
  const projectId = getGCPProjectId();
  return projectId ? `projects/${projectId}` : null;
}

function getErrorStatsClient(): any {
  if (errorReportingInitFailed) return null;
  if (errorStatsClient) return errorStatsClient;
  try {
    const options = getGCPClientOptions();
    if (!options) {
      errorReportingInitFailed = true;
      return null;
    }
    const { ErrorStatsServiceClient } = require('@google-cloud/error-reporting');
    errorStatsClient = new ErrorStatsServiceClient(options);
    return errorStatsClient;
  } catch (error) {
    errorReportingInitFailed = true;
    log.error('[Error Reporting] init failed', error as Error);
    return null;
  }
}

export interface ErrorGroupSummary {
  groupId: string;
  message: string;
  count: number;
  affectedUsers: number;
  firstSeen: string;
  lastSeen: string;
  status: 'RESOLVED' | 'ACKNOWLEDGED' | 'OPEN' | 'MUTED';
}

export interface ErrorReportingQuery {
  timeRangePeriod?: 'PERIOD_1_HOUR' | 'PERIOD_6_HOURS' | 'PERIOD_1_DAY' | 'PERIOD_1_WEEK' | 'PERIOD_30_DAYS';
  pageSize?: number;
}

/**
 * List grouped errors from Error Reporting.
 * Auto-grouped by error signature (stack trace similarity).
 */
export async function listErrorGroups(query: ErrorReportingQuery = {}): Promise<ErrorGroupSummary[]> {
  const client = getErrorStatsClient();
  const projectPath = getProjectPath();
  if (!client || !projectPath) return [];

  try {
    const [groups] = await client.listGroupStats({
      projectName: projectPath,
      timeRange: { period: query.timeRangePeriod || 'PERIOD_1_DAY' },
      pageSize: query.pageSize || 50,
      order: 'COUNT_DESC',
    });

    return groups.map((group: any) => ({
      groupId: group.group?.groupId || '',
      message: group.representative?.message || 'Unknown error',
      count: parseInt(group.count?.toString() || '0'),
      affectedUsers: parseInt(group.affectedUsersCount?.toString() || '0'),
      firstSeen: group.firstSeenTime ? new Date(parseInt(group.firstSeenTime.seconds) * 1000).toISOString() : '',
      lastSeen: group.lastSeenTime ? new Date(parseInt(group.lastSeenTime.seconds) * 1000).toISOString() : '',
      status: (group.group?.resolutionStatus as any) || 'OPEN',
    }));
  } catch (error) {
    log.error('[Error Reporting] listErrorGroups failed', error as Error);
    return [];
  }
}

/**
 * Get total error count for the given time period.
 */
export async function getErrorSummary(): Promise<{
  totalGroups: number;
  totalErrors: number;
  affectedUsers: number;
  period: string;
}> {
  const groups = await listErrorGroups({ timeRangePeriod: 'PERIOD_1_DAY' });
  return {
    totalGroups: groups.length,
    totalErrors: groups.reduce((sum, g) => sum + g.count, 0),
    affectedUsers: groups.reduce((sum, g) => sum + g.affectedUsers, 0),
    period: 'PERIOD_1_DAY',
  };
}

export function isErrorReportingAvailable(): boolean {
  return getErrorStatsClient() !== null;
}

export function getErrorReportingConsoleUrl(): string {
  const projectId = getGCPProjectId() || '';
  return `https://console.cloud.google.com/errors?project=${projectId}`;
}
