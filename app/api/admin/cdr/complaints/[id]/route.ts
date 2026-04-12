/**
 * Phase M.4.3: Admin CDR Complaint Detail API
 *
 * GET   /api/admin/cdr/complaints/[id] — Get complaint details
 * PATCH /api/admin/cdr/complaints/[id] — Update complaint (resolve, escalate)
 *
 * CDR compliance requires tracking resolution and OAIC escalation.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { createAuditLog } from '@/lib/security/auditLog';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/admin/cdr/complaints/[id]
 */
export async function GET(request: NextRequest, context: RouteContext) {
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
    const { id } = await context.params;
    const complaint = await prisma.cDRComplaint.findUnique({
      where: { id },
      include: { user: { select: { email: true, name: true } } },
    });

    if (!complaint) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Complaint not found' } },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: complaint });
  } catch (error) {
    console.error('[Admin CDR Complaint Detail] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch complaint' } },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/cdr/complaints/[id]
 * Update complaint: resolve, escalate to OAIC, or update status.
 *
 * Body:
 *   { action: 'resolve', resolution: string }
 *   { action: 'escalate', oaicReferenceId?: string }
 *   { action: 'update_status', status: 'IN_PROGRESS' | 'CLOSED' }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
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
      { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
      { status: 403 }
    );
  }

  try {
    const { id } = await context.params;
    const body = await request.json();
    const { action } = body;

    const existing = await prisma.cDRComplaint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Complaint not found' } },
        { status: 404 }
      );
    }

    let updated;

    switch (action) {
      case 'resolve':
        updated = await prisma.cDRComplaint.update({
          where: { id },
          data: {
            status: 'RESOLVED',
            resolution: body.resolution || 'Resolved by admin',
            resolvedAt: new Date(),
            resolvedBy: authResult.context.email,
          },
        });
        break;

      case 'escalate':
        updated = await prisma.cDRComplaint.update({
          where: { id },
          data: {
            status: 'ESCALATED',
            escalatedToOAIC: true,
            oaicReferenceId: body.oaicReferenceId || null,
          },
        });
        break;

      case 'update_status':
        if (!body.status) {
          return NextResponse.json(
            { error: { code: 'VALIDATION_ERROR', message: 'status is required' } },
            { status: 400 }
          );
        }
        updated = await prisma.cDRComplaint.update({
          where: { id },
          data: { status: body.status },
        });
        break;

      default:
        return NextResponse.json(
          { error: { code: 'VALIDATION_ERROR', message: 'Invalid action. Use: resolve, escalate, update_status' } },
          { status: 400 }
        );
    }

    createAuditLog({
      userId: authResult.context.adminId,
      action: 'UPDATE',
      status: 'SUCCESS',
      entityType: 'CDRComplaint',
      entityId: id,
      metadata: {
        complaintAction: action,
        adminEmail: authResult.context.email,
        newStatus: updated.status,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Admin CDR Complaint Update] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to update complaint' } },
      { status: 500 }
    );
  }
}
