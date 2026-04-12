/**
 * GCP Cloud Monitoring API Service
 *
 * Phase M.2.4: Reads uptime checks, alert policies, and metrics from Cloud Monitoring.
 * The admin portal displays real-time monitoring data instead of "unknown" placeholders.
 *
 * @see docs/blueprint/PHASE_M_ADMIN_PORTAL_GCP_FIRST.md
 */

import { log } from '@/lib/utils/logger';

// Lazy-initialized clients
let uptimeClient: any = null;
let alertPolicyClient: any = null;
let metricClient: any = null;
let monitoringInitFailed = false;

function getProjectId(): string | null {
  return process.env.GCP_PROJECT_ID || null;
}

function getProjectPath(): string | null {
  const projectId = getProjectId();
  return projectId ? `projects/${projectId}` : null;
}

function getUptimeClient(): any {
  if (monitoringInitFailed) return null;
  if (uptimeClient) return uptimeClient;
  try {
    const { UptimeCheckServiceClient } = require('@google-cloud/monitoring');
    uptimeClient = new UptimeCheckServiceClient();
    return uptimeClient;
  } catch (error) {
    monitoringInitFailed = true;
    log.error('[Cloud Monitoring] UptimeCheckServiceClient init failed', error as Error);
    return null;
  }
}

function getAlertClient(): any {
  if (monitoringInitFailed) return null;
  if (alertPolicyClient) return alertPolicyClient;
  try {
    const { AlertPolicyServiceClient } = require('@google-cloud/monitoring');
    alertPolicyClient = new AlertPolicyServiceClient();
    return alertPolicyClient;
  } catch (error) {
    log.error('[Cloud Monitoring] AlertPolicyServiceClient init failed', error as Error);
    return null;
  }
}

function getMetricClient(): any {
  if (monitoringInitFailed) return null;
  if (metricClient) return metricClient;
  try {
    const { MetricServiceClient } = require('@google-cloud/monitoring');
    metricClient = new MetricServiceClient();
    return metricClient;
  } catch (error) {
    log.error('[Cloud Monitoring] MetricServiceClient init failed', error as Error);
    return null;
  }
}

export interface UptimeCheckInfo {
  name: string;
  displayName: string;
  hostname: string;
  path: string;
  checkFrequencySeconds: number;
  timeoutSeconds: number;
  regions: string[];
}

export interface AlertPolicyInfo {
  name: string;
  displayName: string;
  enabled: boolean;
  severity: string;
  conditions: number;
  notificationChannels: number;
}

/**
 * List all uptime checks configured in the project.
 */
export async function listUptimeChecks(): Promise<UptimeCheckInfo[]> {
  const client = getUptimeClient();
  const projectPath = getProjectPath();
  if (!client || !projectPath) return [];

  try {
    const [configs] = await client.listUptimeCheckConfigs({ parent: projectPath });
    return configs.map((config: any) => ({
      name: config.name || '',
      displayName: config.displayName || '',
      hostname: config.monitoredResource?.labels?.host || config.httpCheck?.path || '',
      path: config.httpCheck?.path || '/',
      checkFrequencySeconds: parseInt(config.period?.seconds || '0'),
      timeoutSeconds: parseInt(config.timeout?.seconds || '0'),
      regions: config.selectedRegions || [],
    }));
  } catch (error) {
    log.error('[Cloud Monitoring] listUptimeChecks failed', error as Error);
    return [];
  }
}

/**
 * List all alert policies in the project.
 */
export async function listAlertPolicies(): Promise<AlertPolicyInfo[]> {
  const client = getAlertClient();
  const projectPath = getProjectPath();
  if (!client || !projectPath) return [];

  try {
    const [policies] = await client.listAlertPolicies({ name: projectPath });
    return policies.map((policy: any) => ({
      name: policy.name || '',
      displayName: policy.displayName || '',
      enabled: policy.enabled?.value !== false,
      severity: policy.severity || 'WARNING',
      conditions: policy.conditions?.length || 0,
      notificationChannels: policy.notificationChannels?.length || 0,
    }));
  } catch (error) {
    log.error('[Cloud Monitoring] listAlertPolicies failed', error as Error);
    return [];
  }
}

/**
 * Get recent uptime check results (pass/fail count over the last hour).
 */
export async function getUptimeSummary(): Promise<{
  totalChecks: number;
  activeChecks: number;
  lastHourSuccessRate: number | null;
}> {
  const checks = await listUptimeChecks();
  // Note: Full success rate calculation requires querying MetricServiceClient
  // for monitoring.googleapis.com/uptime_check/check_passed — implement on demand
  return {
    totalChecks: checks.length,
    activeChecks: checks.length,
    lastHourSuccessRate: null,
  };
}

/**
 * Check if Cloud Monitoring is available.
 */
export function isCloudMonitoringAvailable(): boolean {
  return getUptimeClient() !== null;
}

/**
 * Get Cloud Monitoring Console URL for an uptime check.
 */
export function getUptimeCheckConsoleUrl(checkName?: string): string {
  const projectId = getProjectId() || '';
  if (checkName) {
    return `https://console.cloud.google.com/monitoring/uptime/${encodeURIComponent(checkName)}?project=${projectId}`;
  }
  return `https://console.cloud.google.com/monitoring/uptime?project=${projectId}`;
}
