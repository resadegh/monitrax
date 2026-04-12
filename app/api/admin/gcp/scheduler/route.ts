/**
 * Phase M.3.2: Admin Cloud Scheduler API
 *
 * GET  /api/admin/gcp/scheduler — List all Cloud Scheduler jobs
 * POST /api/admin/gcp/scheduler — Pause/resume/run a job
 *
 * Bulletproof — always returns JSON.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { createAuditLog } from '@/lib/security/auditLog';

function jsonError(status: number, message: string, code: string = ADMIN_ERROR_CODES.INTERNAL_ERROR) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(request: NextRequest) {
  try {
    if (!isAdminPortalAccessible()) {
      return jsonError(503, 'Admin portal is not enabled', ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED);
    }

    const authResult = await verifyAdminGCPAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    if (!hasPermission(authResult.context.role, 'audit:read')) {
      return jsonError(403, 'Insufficient permissions', ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    }

    let jobs: unknown[] = [];
    let available = false;
    let consoleUrl = '';
    let loadError: string | null = null;

    try {
      const scheduler = await import('@/lib/gcp/cloudScheduler');
      jobs = await scheduler.listSchedulerJobs();
      available = scheduler.isCloudSchedulerAvailable();
      consoleUrl = scheduler.getSchedulerConsoleUrl();
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'Cloud Scheduler SDK failed to load';
      const projectId = process.env.GCP_PROJECT_ID || process.env.GCS_PROJECT_ID || '';
      consoleUrl = `https://console.cloud.google.com/cloudscheduler?project=${projectId}`;
    }

    return NextResponse.json({
      success: true,
      data: { jobs, available, consoleUrl, loadError },
    });
  } catch (error) {
    console.error('[Admin Scheduler] Fatal error:', error);
    return jsonError(500, error instanceof Error ? error.message : 'Failed to fetch scheduler jobs');
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAdminPortalAccessible()) {
      return jsonError(503, 'Admin portal is not enabled', ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED);
    }

    const authResult = await verifyAdminGCPAuth(request);
    if (!authResult.success || !authResult.context) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    if (!hasPermission(authResult.context.role, 'admins:update')) {
      return jsonError(403, 'SUPER_ADMIN required', ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS);
    }

    const body = await request.json();
    const { action, jobName } = body;

    if (!action || !jobName) {
      return jsonError(400, 'action and jobName are required', 'VALIDATION_ERROR' as any);
    }

    let result = false;
    let loadError: string | null = null;

    try {
      const scheduler = await import('@/lib/gcp/cloudScheduler');
      switch (action) {
        case 'pause':
          result = await scheduler.pauseSchedulerJob(jobName);
          break;
        case 'resume':
          result = await scheduler.resumeSchedulerJob(jobName);
          break;
        case 'run':
          result = await scheduler.runSchedulerJob(jobName);
          break;
        default:
          return jsonError(400, 'Invalid action. Use: pause, resume, run', 'VALIDATION_ERROR' as any);
      }
    } catch (err) {
      loadError = err instanceof Error ? err.message : 'Cloud Scheduler SDK failed';
    }

    createAuditLog({
      userId: authResult.context.adminId,
      action: 'UPDATE',
      status: result ? 'SUCCESS' : 'FAILURE',
      entityType: 'CloudSchedulerJob',
      entityId: jobName,
      metadata: {
        schedulerAction: action,
        adminEmail: authResult.context.email,
        loadError,
      },
    }).catch(() => {});

    if (loadError) {
      return jsonError(500, loadError);
    }

    return NextResponse.json({
      success: result,
      data: { action, jobName, result },
    });
  } catch (error) {
    console.error('[Admin Scheduler Action] Fatal error:', error);
    return jsonError(500, error instanceof Error ? error.message : 'Failed to perform scheduler action');
  }
}
