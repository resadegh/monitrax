/**
 * Phase M.3.2: Admin Cloud Scheduler API
 *
 * GET  /api/admin/gcp/scheduler — List all Cloud Scheduler jobs
 * POST /api/admin/gcp/scheduler — Pause/resume/run a job
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { createAuditLog } from '@/lib/security/auditLog';
import {
  listSchedulerJobs,
  pauseSchedulerJob,
  resumeSchedulerJob,
  runSchedulerJob,
  isCloudSchedulerAvailable,
  getSchedulerConsoleUrl,
} from '@/lib/gcp/cloudScheduler';

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  if (!hasPermission(authResult.context.role, 'audit:read')) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
      { status: 403 }
    );
  }

  try {
    const jobs = await listSchedulerJobs();
    return NextResponse.json({
      success: true,
      data: {
        jobs,
        available: isCloudSchedulerAvailable(),
        consoleUrl: getSchedulerConsoleUrl(),
      },
    });
  } catch (error) {
    console.error('[Admin Scheduler] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch scheduler jobs' } },
      { status: 500 }
    );
  }
}

/**
 * POST — Admin actions for Cloud Scheduler jobs
 * Body: { action: 'pause' | 'resume' | 'run', jobName: string }
 */
export async function POST(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 }
    );
  }

  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }

  if (!hasPermission(authResult.context.role, 'admins:update')) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'SUPER_ADMIN required' } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { action, jobName } = body;

    if (!action || !jobName) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'action and jobName are required' } },
        { status: 400 }
      );
    }

    let result = false;
    switch (action) {
      case 'pause':
        result = await pauseSchedulerJob(jobName);
        break;
      case 'resume':
        result = await resumeSchedulerJob(jobName);
        break;
      case 'run':
        result = await runSchedulerJob(jobName);
        break;
      default:
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid action. Use: pause, resume, run' } },
          { status: 400 }
        );
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
      },
    }).catch(() => {});

    return NextResponse.json({
      success: result,
      data: { action, jobName, result },
    });
  } catch (error) {
    console.error('[Admin Scheduler Action] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to perform scheduler action' } },
      { status: 500 }
    );
  }
}
