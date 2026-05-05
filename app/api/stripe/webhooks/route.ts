/**
 * Phase 32C PR6 — Stripe webhook receiver.
 *
 * POST /api/stripe/webhooks
 *
 * Receives Stripe webhook events. Verifies the signature using
 * `STRIPE_WEBHOOK_SECRET`, dedupes via the `stripe_webhook_events`
 * table, and dispatches to the billing service for subscription
 * mirroring. Idempotent — Stripe retries up to 3 days; our handler
 * is a no-op on re-deliveries.
 *
 * Auth: NO `withPermission` gate. Stripe is the caller; signature
 * verification IS the auth mechanism.
 *
 * Critical: must read the raw body BEFORE parsing — Stripe's signature
 * verification depends on the exact bytes that were signed. We use
 * `request.text()` to get the raw string; Next.js does NOT auto-parse
 * for `application/json` bodies in App Router route handlers.
 *
 * PROD HARDENING (DEFERRED bucket):
 *   - Live-mode key rotation
 *   - Cloud Logging audit trail of every webhook event
 *   - Dead-letter queue for repeatedly-failing events
 *   - Slack/PagerDuty alert on signature verification failure
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  constructAndVerifyWebhookEvent,
  handleWebhookEvent,
  StripeBillingServiceError,
} from '@/lib/services/stripeBillingService';
import { createAuditLog } from '@/lib/security/auditLog';

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature');
  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  let event;
  try {
    event = constructAndVerifyWebhookEvent(rawBody, sig);
  } catch (err) {
    if (err instanceof StripeBillingServiceError && err.code === 'WEBHOOK_VERIFICATION_FAILED') {
      // 400 (not 401) per Stripe's recommendation — non-200 triggers retry
      // but 4xx tells Stripe the request shape is wrong (signature mismatch
      // is a permanent failure, not a transient one).
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 400 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Webhook verification failed' },
      { status: 400 },
    );
  }

  // Audit row for every received event (success or failure of dispatch).
  // The webhook events table is the authoritative log; this audit row is
  // just for grep-ability in the broader audit trail.
  createAuditLog({
    action: 'BILLING_WEBHOOK_RECEIVED',
    entityType: 'STRIPE_WEBHOOK_EVENT',
    entityId: event.id,
    metadata: { eventType: event.type, livemode: event.livemode },
  }).catch(() => {});

  try {
    const { duplicate } = await handleWebhookEvent(event);
    return NextResponse.json({ received: true, duplicate });
  } catch (err) {
    // Returning a 5xx tells Stripe to retry. We also log the failure
    // server-side; the StripeWebhookEvent row already recorded the error.
    // eslint-disable-next-line no-console
    console.error('[stripe-webhook] dispatch failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Dispatch failed' },
      { status: 500 },
    );
  }
}
