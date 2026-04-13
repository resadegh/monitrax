/**
 * Phase N.3: Basiq Events Webhook (Gap G16)
 *
 * POST /api/basiq/webhook
 *
 * Receives Basiq Events notifications:
 * - Connection status changes (ACTIVE, EXPIRED, INVALID_CREDENTIALS)
 * - Consent revocation by user at bank side
 * - Account balance updates
 * - Transaction fetch completion
 *
 * When a consent is revoked at the bank side, Monitrax must:
 * 1. Mark the BasiqConnection as DISABLED
 * 2. Delete the associated CDR data (consent-driven deletion)
 * 3. Audit the event
 *
 * CDR Rules §5.6 requires bank-side revocations to trigger data deletion
 * within 24 hours. Without this webhook, Monitrax has no way to detect
 * bank-side revocations.
 *
 * Setup:
 * 1. Basiq Dashboard → Events → Create Subscription
 * 2. URL: https://www.monitrax.com.au/api/basiq/webhook
 * 3. Events: job.completed, connection.updated, connection.deleted
 * 4. Auth: Basiq signs webhooks with HMAC-SHA256 in X-Basiq-Signature header
 * 5. Set BASIQ_WEBHOOK_SECRET env var on Vercel (shared secret with Basiq)
 *
 * Refs: docs/compliance/CDR_IMPLEMENTATION_PLAN.md (Phase N.3)
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';
import { deleteCDRData } from '@/lib/services/cdrDataLifecycle';
import { log } from '@/lib/utils/logger';

interface BasiqEvent {
  type: string;
  data?: {
    connectionId?: string;
    userId?: string; // Basiq user ID
    status?: string;
    [key: string]: unknown;
  };
  occurred?: string;
}

/**
 * Verify the HMAC signature on the webhook payload.
 * Basiq signs webhooks with X-Basiq-Signature header.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifyWebhookSignature(body: string, signatureHeader: string | null): boolean {
  if (!signatureHeader) return false;

  const secret = process.env.BASIQ_WEBHOOK_SECRET;
  if (!secret) {
    log.warn('[Basiq Webhook] BASIQ_WEBHOOK_SECRET not configured — rejecting webhook');
    return false;
  }

  try {
    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
    const expectedBuffer = Buffer.from(expected, 'utf-8');
    const receivedBuffer = Buffer.from(signatureHeader, 'utf-8');

    if (expectedBuffer.length !== receivedBuffer.length) return false;
    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Read the raw body (required for HMAC verification)
    const rawBody = await request.text();
    const signature = request.headers.get('x-basiq-signature');

    // 2. Verify signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      createAuditLog({
        action: 'UNAUTHORIZED_ACCESS',
        status: 'BLOCKED',
        entityType: 'BasiqWebhook',
        ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
        metadata: { endpoint: '/api/basiq/webhook', reason: 'Invalid signature' },
      }).catch(() => {});
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Invalid webhook signature' } },
        { status: 401 }
      );
    }

    // 3. Parse the event
    let event: BasiqEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Invalid JSON payload' } },
        { status: 400 }
      );
    }

    log.info('[Basiq Webhook] Received event', { type: event.type, connectionId: event.data?.connectionId });

    // 4. Handle the event by type
    switch (event.type) {
      case 'connection.updated':
      case 'connection.refreshed': {
        const connectionId = event.data?.connectionId;
        if (!connectionId) break;

        const newStatus = event.data?.status?.toUpperCase();
        const connection = await prisma.basiqConnection.findUnique({
          where: { basiqConnectionId: connectionId },
          select: { id: true, userId: true, status: true },
        });

        if (!connection) {
          log.warn('[Basiq Webhook] Connection not found', { connectionId });
          break;
        }

        // Map Basiq status to our enum
        let mappedStatus: 'ACTIVE' | 'RECONNECT' | 'DISABLED' | 'ERROR' = 'ACTIVE';
        if (newStatus === 'INVALID_CREDENTIALS' || newStatus === 'EXPIRED') {
          mappedStatus = 'RECONNECT';
        } else if (newStatus === 'DELETED' || newStatus === 'REVOKED') {
          mappedStatus = 'DISABLED';
        } else if (newStatus === 'ERROR' || newStatus === 'FAILED') {
          mappedStatus = 'ERROR';
        }

        await prisma.basiqConnection.update({
          where: { id: connection.id },
          data: { status: mappedStatus, lastSyncError: newStatus || null },
        });

        createAuditLog({
          userId: connection.userId,
          action: 'UPDATE',
          status: 'SUCCESS',
          entityType: 'BasiqConnection',
          entityId: connection.id,
          metadata: {
            webhookEvent: event.type,
            previousStatus: connection.status,
            newStatus: mappedStatus,
          },
        }).catch(() => {});

        // If consent was revoked at the bank side, delete CDR data (Basiq §5.6)
        if (mappedStatus === 'DISABLED') {
          log.info('[Basiq Webhook] Consent revoked at bank side — triggering CDR data deletion', {
            userId: connection.userId,
            connectionId,
          });
          await deleteCDRData(connection.userId, 'consent_revoked').catch((err) => {
            log.error('[Basiq Webhook] CDR data deletion failed', err);
          });
        }
        break;
      }

      case 'connection.deleted': {
        const connectionId = event.data?.connectionId;
        if (!connectionId) break;

        const connection = await prisma.basiqConnection.findUnique({
          where: { basiqConnectionId: connectionId },
          select: { id: true, userId: true },
        });

        if (!connection) break;

        // Hard-delete the connection and trigger CDR data deletion
        await prisma.basiqConnection.delete({ where: { id: connection.id } });

        createAuditLog({
          userId: connection.userId,
          action: 'CDR_CONSENT_REVOKED',
          status: 'SUCCESS',
          entityType: 'BasiqConnection',
          entityId: connection.id,
          metadata: { webhookEvent: 'connection.deleted', connectionId },
        }).catch(() => {});

        await deleteCDRData(connection.userId, 'consent_revoked').catch(() => {});
        break;
      }

      case 'job.completed': {
        // Account/transaction fetch completed — log for observability
        log.info('[Basiq Webhook] Job completed', { jobId: event.data?.connectionId });
        break;
      }

      default:
        log.info('[Basiq Webhook] Unhandled event type', { type: event.type });
        break;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error('[Basiq Webhook] Processing failed', error as Error);
    return NextResponse.json(
      { error: { code: 'SERVER_ERROR', message: 'Webhook processing failed' } },
      { status: 500 }
    );
  }
}

/**
 * GET /api/basiq/webhook — Health check / verification ping
 * Basiq may send a test GET to verify the endpoint is reachable.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Basiq webhook endpoint is operational',
    events: ['connection.updated', 'connection.refreshed', 'connection.deleted', 'job.completed'],
  });
}
