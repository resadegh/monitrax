/**
 * GCP Cloud Scheduler API Service
 *
 * Phase M.3.2: Read/manage Cloud Scheduler jobs from the admin portal.
 * Admin portal can view job status, last run, next run, and pause/resume.
 *
 * Current jobs:
 * - monitrax-cdr-lifecycle: Daily CDR consent expiry check (02:00 UTC)
 *
 * @see docs/blueprint/PHASE_M_ADMIN_PORTAL_GCP_FIRST.md
 */

import { log } from '@/lib/utils/logger';

let schedulerClient: any = null;
let schedulerInitFailed = false;

function getProjectId(): string | null {
  return process.env.GCP_PROJECT_ID || null;
}

function getLocation(): string {
  return process.env.GCP_SCHEDULER_LOCATION || 'australia-southeast1';
}

function getParent(): string | null {
  const projectId = getProjectId();
  return projectId ? `projects/${projectId}/locations/${getLocation()}` : null;
}

function getSchedulerClient(): any {
  if (schedulerInitFailed) return null;
  if (schedulerClient) return schedulerClient;
  try {
    const { CloudSchedulerClient } = require('@google-cloud/scheduler');
    schedulerClient = new CloudSchedulerClient();
    return schedulerClient;
  } catch (error) {
    schedulerInitFailed = true;
    log.error('[Cloud Scheduler] init failed', error as Error);
    return null;
  }
}

export interface SchedulerJobInfo {
  name: string;
  displayName: string;
  schedule: string;
  timeZone: string;
  state: 'ENABLED' | 'PAUSED' | 'DISABLED' | 'UPDATE_FAILED' | 'STATE_UNSPECIFIED';
  lastAttemptTime: string | null;
  nextRunTime: string | null;
  targetUri: string | null;
  httpMethod: string;
  description: string;
}

/**
 * List all Cloud Scheduler jobs in the project.
 */
export async function listSchedulerJobs(): Promise<SchedulerJobInfo[]> {
  const client = getSchedulerClient();
  const parent = getParent();
  if (!client || !parent) return [];

  try {
    const [jobs] = await client.listJobs({ parent });
    return jobs.map((job: any) => {
      // Extract last segment of the full name as display name
      const nameSegments = (job.name || '').split('/');
      const displayName = nameSegments[nameSegments.length - 1] || 'unknown';

      return {
        name: job.name || '',
        displayName,
        schedule: job.schedule || '',
        timeZone: job.timeZone || 'UTC',
        state: job.state || 'STATE_UNSPECIFIED',
        lastAttemptTime: job.lastAttemptTime
          ? new Date(parseInt(job.lastAttemptTime.seconds) * 1000).toISOString()
          : null,
        nextRunTime: job.scheduleTime
          ? new Date(parseInt(job.scheduleTime.seconds) * 1000).toISOString()
          : null,
        targetUri: job.httpTarget?.uri || null,
        httpMethod: job.httpTarget?.httpMethod || 'POST',
        description: job.description || '',
      };
    });
  } catch (error) {
    log.error('[Cloud Scheduler] listSchedulerJobs failed', error as Error);
    return [];
  }
}

/**
 * Pause a Cloud Scheduler job.
 */
export async function pauseSchedulerJob(jobName: string): Promise<boolean> {
  const client = getSchedulerClient();
  if (!client) return false;
  try {
    await client.pauseJob({ name: jobName });
    return true;
  } catch (error) {
    log.error('[Cloud Scheduler] pauseSchedulerJob failed', error as Error);
    return false;
  }
}

/**
 * Resume a paused Cloud Scheduler job.
 */
export async function resumeSchedulerJob(jobName: string): Promise<boolean> {
  const client = getSchedulerClient();
  if (!client) return false;
  try {
    await client.resumeJob({ name: jobName });
    return true;
  } catch (error) {
    log.error('[Cloud Scheduler] resumeSchedulerJob failed', error as Error);
    return false;
  }
}

/**
 * Trigger a Cloud Scheduler job to run immediately (for testing or manual runs).
 */
export async function runSchedulerJob(jobName: string): Promise<boolean> {
  const client = getSchedulerClient();
  if (!client) return false;
  try {
    await client.runJob({ name: jobName });
    return true;
  } catch (error) {
    log.error('[Cloud Scheduler] runSchedulerJob failed', error as Error);
    return false;
  }
}

export function isCloudSchedulerAvailable(): boolean {
  return getSchedulerClient() !== null;
}

export function getSchedulerConsoleUrl(): string {
  const projectId = getProjectId() || '';
  return `https://console.cloud.google.com/cloudscheduler?project=${projectId}`;
}
