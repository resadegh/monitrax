/**
 * Phase M.4.3: Admin CDR Complaint Management API
 *
 * GET  /api/admin/cdr/complaints — List all CDR complaints
 * POST /api/admin/cdr/complaints — Create a new CDR complaint
 *
 * CDR compliance requires tracking all consumer complaints about CDR data handling.
 * See: docs/policy/CDR_COMPLAINTS_POLICY.md
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { createAuditLog } from '@/lib/security/auditLog';

/**
 * GET /api/admin/cdr/complaints
 * List all CDR complaints with pagination and filtering.
 */
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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const skip = (page - 1) * limit;

    const where = status ? { status: status as any } : {};

    const [complaints, total] = await Promise.all([
      prisma.cDRComplaint.findMany({
        where,
        include: {
          user: { select: { email: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.cDRComplaint.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        complaints,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      },
    });
  } catch (error) {
    console.error('[Admin CDR Complaints] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to fetch complaints' } },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/cdr/complaints
 * Create a new CDR complaint record.
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
      { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const { userId, complainantName, complainantEmail, category, description } = body;

    if (!category || !description) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'category and description are required' } },
        { status: 400 }
      );
    }

    const complaint = await prisma.cDRComplaint.create({
      data: {
        userId: userId || null,
        complainantName: complainantName || null,
        complainantEmail: complainantEmail || null,
        category,
        description,
        status: 'OPEN',
      },
    });

    createAuditLog({
      userId: authResult.context.adminId,
      action: 'CREATE',
      status: 'SUCCESS',
      entityType: 'CDRComplaint',
      entityId: complaint.id,
      metadata: {
        category,
        adminEmail: authResult.context.email,
      },
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: complaint,
    }, { status: 201 });
  } catch (error) {
    console.error('[Admin CDR Complaints Create] Error:', error);
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INTERNAL_ERROR, message: 'Failed to create complaint' } },
      { status: 500 }
    );
  }
}
