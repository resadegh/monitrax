/**
 * CDR Data Lifecycle API
 * Phase 35: Automated consent-driven CDR data management
 *
 * POST /api/cdr/lifecycle — Run consent expiry check and CDR data cleanup
 * GET  /api/cdr/lifecycle — Get CDR data summary for authenticated user
 *
 * POST is designed to be called by GCP Cloud Scheduler daily at 02:00 Australia/Sydney (AEST/AEDT).
 * Authenticated via CRON_SECRET environment variable (not user auth).
 *
 * GET is authenticated via standard user auth for consent management UI.
 *
 * Basiq §5.4, §5.5, §5.6
 * CLAUDE.md §13.2
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { withPermission } from '@/lib/auth/guards';
import { checkConsentExpiry, getCDRDataSummary } from '@/lib/services/cdrDataLifecycle';
import { createAuditLog } from '@/lib/security/auditLog';
import { enforceAuditLogRetention, runAnomalyDetection } from '@/lib/security/cdrAuditCompliance';

/**
 * POST /api/cdr/lifecycle
 * Trigger consent expiry check and CDR data deletion.
 *
 * Auth: CRON_SECRET header (for GCP Cloud Scheduler).
 * GCP Cloud Scheduler config:
 *   Schedule: 0 2 * * * (daily at 02:00 Australia/Sydney (AEST/AEDT))
 *   HTTP Target: POST https://<domain>/api/cdr/lifecycle
 *   Headers: { "Authorization": "Bearer <CRON_SECRET>" }
 */
export async function POST(request: NextRequest) {
  // Authenticate cron job via CRON_SECRET
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'CRON_SECRET not configured' } },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  // Fix: G27 — Use timing-safe comparison to prevent timing attacks
  const tokenBuffer = Buffer.from(token || '', 'utf-8');
  const secretBuffer = Buffer.from(cronSecret, 'utf-8');
  const isValid = tokenBuffer.length === secretBuffer.length &&
    crypto.timingSafeEqual(tokenBuffer, secretBuffer);

  if (!isValid) {
    // Audit unauthorized cron attempt
    createAuditLog({
      action: 'UNAUTHORIZED_ACCESS',
      status: 'BLOCKED',
      entityType: 'CDRLifecycle',
      ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
      metadata: { endpoint: '/api/cdr/lifecycle', method: 'POST' },
    }).catch(() => {});

    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' } },
      { status: 401 }
    );
  }

  try {
    const start = Date.now();

    // 1. Check consent expiry and trigger CDR data deletion
    const result = await checkConsentExpiry();

    // 2. Fix: G44 — Enforce audit log retention (runs with CDR lifecycle)
    const retentionResult = await enforceAuditLogRetention();

    // 3. Fix: G45 — Run anomaly detection (runs with CDR lifecycle)
    const anomalies = await runAnomalyDetection();

    return NextResponse.json({
      success: true,
      data: {
        consentExpiry: result,
        auditRetention: retentionResult,
        anomaliesDetected: anomalies.length,
      },
      meta: {
        timestamp: new Date().toISOString(),
        durationMs: Date.now() - start,
      },
    });
  } catch (error) {
    console.error('CDR lifecycle job failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'CDR lifecycle job failed',
        },
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cdr/lifecycle
 * Get CDR data summary for the authenticated user.
 * Used by consent management UI to show CDR data status.
 */
export const GET = withPermission('account.read', async (request, auth) => {
  try {
    const summary = await getCDRDataSummary(auth.userId);

    return NextResponse.json({
      success: true,
      data: summary,
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching CDR data summary:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch CDR data summary',
        },
      },
      { status: 500 }
    );
  }
});
