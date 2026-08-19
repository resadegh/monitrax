/**
 * Phase 32C PR4c — Professional request endpoints (D2C side).
 *
 * GET  /api/professional-requests       — list this user's submissions
 * POST /api/professional-requests       — submit a new request to a listing
 *
 * Auth: requires the user to be signed in. Permission gate: `report.read`
 * for GET (lightest authenticated touch — surface is read-only) and
 * `report.read` for POST too (request submission is not a CDR-data action;
 * the snapshot context the user opts to share is curated client-side).
 */
import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  listRequestsForUser,
  submitRequest,
  ProfessionalRequestServiceError,
  type SubmitRequestInput,
} from '@/lib/services/professionalRequestService';
import { createAuditLog } from '@/lib/security/auditLog';
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';

export const GET = withPermission('report.read', async (_request, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_SOCIAL', auth.userId);
    if (gateBlocked) return gateBlocked;
  try {
    const items = await listRequestsForUser(auth.userId);
    return NextResponse.json({ success: true, data: { items } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load requests';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});

export const POST = withPermission('report.read', async (request, auth) => {
    const gateBlocked = await moduleApiGuard('MODULE_SOCIAL', auth.userId);
    if (gateBlocked) return gateBlocked;
  let body: Partial<SubmitRequestInput>;
  try {
    body = (await request.json()) as Partial<SubmitRequestInput>;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_JSON', message: 'Body must be JSON' } },
      { status: 400 },
    );
  }
  if (!body.listingId || typeof body.listingId !== 'string') {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'listingId required' } },
      { status: 400 },
    );
  }
  if (!body.question || typeof body.question !== 'string') {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_INPUT', message: 'question required' } },
      { status: 400 },
    );
  }

  try {
    const created = await submitRequest({
      requesterUserId: auth.userId,
      listingId: body.listingId,
      question: body.question,
      contextLabel: body.contextLabel,
      snapshotContextJson: body.snapshotContextJson,
    });

    createAuditLog({
      userId: auth.userId,
      action: 'PROFESSIONAL_REQUEST_SUBMITTED',
      entityType: 'PROFESSIONAL_REQUEST',
      entityId: created.id,
      metadata: {
        listingId: created.listingId,
        contextLabel: created.contextLabel,
        leadFeeTier: created.leadFeeTier,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: { request: created } });
  } catch (err) {
    if (err instanceof ProfessionalRequestServiceError) {
      const status =
        err.code === 'NOT_FOUND'
          ? 404
          : err.code === 'FORBIDDEN' || err.code === 'ORG_USER_PUBLIC_BLOCKED'
            ? 403
            : err.code === 'PAYLOAD_TOO_LARGE'
              ? 413
              : err.code === 'LISTING_NOT_AVAILABLE'
                ? 409
                : 400;
      return NextResponse.json(
        { success: false, error: { code: err.code, message: err.message } },
        { status },
      );
    }
    const message = err instanceof Error ? err.message : 'Submit failed';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
});
