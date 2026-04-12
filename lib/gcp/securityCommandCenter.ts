/**
 * GCP Security Command Center API Service
 *
 * Phase M.3.1: Reads security findings from SCC Standard tier.
 * Used by the admin Security page to show vulnerability status.
 *
 * SCC Standard tier includes:
 * - Security Health Analytics (configuration vulnerabilities)
 * - Web Security Scanner (web app vulnerabilities)
 * - Event Threat Detection (runtime threats)
 *
 * @see docs/blueprint/PHASE_M_ADMIN_PORTAL_GCP_FIRST.md
 */

import { log } from '@/lib/utils/logger';

let sccClient: any = null;
let sccInitFailed = false;

function getProjectId(): string | null {
  return process.env.GCP_PROJECT_ID || null;
}

function getOrganizationId(): string | null {
  return process.env.GCP_ORGANIZATION_ID || null;
}

function getSCCClient(): any {
  if (sccInitFailed) return null;
  if (sccClient) return sccClient;
  try {
    const { SecurityCenterClient } = require('@google-cloud/security-center');
    sccClient = new SecurityCenterClient();
    return sccClient;
  } catch (error) {
    sccInitFailed = true;
    log.error('[SCC] init failed', error as Error);
    return null;
  }
}

export interface SCCFinding {
  name: string;
  category: string;
  resourceName: string;
  state: 'ACTIVE' | 'INACTIVE';
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  eventTime: string;
  createTime: string;
  description: string;
}

export interface SCCSummary {
  total: number;
  active: number;
  bySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  lastUpdated: string | null;
}

/**
 * List active findings from Security Command Center.
 *
 * Note: SCC requires an organization ID and specific IAM permissions.
 * Project-level SCC access is limited — most features require org-level access.
 */
export async function listSecurityFindings(limit = 50): Promise<SCCFinding[]> {
  const client = getSCCClient();
  const orgId = getOrganizationId();

  // SCC Standard tier requires organization-level access
  // If no org ID is set, return empty (project-level SCC is very limited)
  if (!client || !orgId) {
    return [];
  }

  try {
    const parent = `organizations/${orgId}/sources/-`;
    const [findings] = await client.listFindings({
      parent,
      filter: 'state="ACTIVE"',
      pageSize: limit,
    });

    return findings.map((f: any) => ({
      name: f.finding?.name || '',
      category: f.finding?.category || '',
      resourceName: f.finding?.resourceName || '',
      state: f.finding?.state || 'ACTIVE',
      severity: f.finding?.severity || 'LOW',
      eventTime: f.finding?.eventTime ? new Date(parseInt(f.finding.eventTime.seconds) * 1000).toISOString() : '',
      createTime: f.finding?.createTime ? new Date(parseInt(f.finding.createTime.seconds) * 1000).toISOString() : '',
      description: f.finding?.description || '',
    }));
  } catch (error) {
    log.error('[SCC] listSecurityFindings failed', error as Error);
    return [];
  }
}

/**
 * Get security findings summary (counts by severity).
 */
export async function getSecurityFindingsSummary(): Promise<SCCSummary> {
  const findings = await listSecurityFindings(500);
  const active = findings.filter(f => f.state === 'ACTIVE');
  const bySeverity = {
    critical: active.filter(f => f.severity === 'CRITICAL').length,
    high: active.filter(f => f.severity === 'HIGH').length,
    medium: active.filter(f => f.severity === 'MEDIUM').length,
    low: active.filter(f => f.severity === 'LOW').length,
  };

  return {
    total: findings.length,
    active: active.length,
    bySeverity,
    lastUpdated: active.length > 0
      ? active.reduce((latest, f) => (f.eventTime > latest ? f.eventTime : latest), active[0].eventTime)
      : null,
  };
}

export function isSCCAvailable(): boolean {
  return getSCCClient() !== null && getOrganizationId() !== null;
}

export function getSCCConsoleUrl(): string {
  const projectId = getProjectId() || '';
  return `https://console.cloud.google.com/security/command-center?project=${projectId}`;
}
