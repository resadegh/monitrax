/**
 * Phase 47.66 — n8n webhook fire-and-forget helper.
 *
 * Emits inbound signal events from Monitrax to the n8n `friendlies-tracker`
 * workflow. n8n looks up the email against Airtable Contacts, and if the
 * contact is tagged `friendly`, advances their `Friendly stage` + writes an
 * Activities row. Reza never has to touch the CRM manually for these signals.
 *
 * Events currently emitted:
 *   - `user.signup`         — fired from /api/auth/consent when the consent
 *                              source is SIGNUP or OAUTH_SIGNUP (i.e. an
 *                              actual new signup, NOT the existing-user
 *                              migration prompt).
 *   - `feedback.submitted`  — fired from createThread() in
 *                              lib/services/feedbackService.ts every time a
 *                              new feedback thread is created.
 *
 * Architecture notes:
 * - Fire-and-forget. The webhook call never blocks the API response — failure
 *   to deliver is logged but never throws to the caller.
 * - HMAC-signed with the shared `N8N_WEBHOOK_SECRET`; n8n's Code-node verify
 *   step rejects unsigned or mismatched requests.
 * - If `N8N_WEBHOOK_URL` is not configured, the helper no-ops silently. This
 *   keeps local development + tests clean (no env-setup-required for unrelated
 *   work).
 * - CDR-safe payload: never include CDR data, balances, transaction details,
 *   or anything beyond the minimum needed to match a Contacts row + write a
 *   one-line Activity. (CLAUDE.md §13.3.)
 */

import crypto from 'node:crypto';

export type N8nFriendliesEvent =
  | {
      event: 'user.signup';
      userId: string;
      email: string;
      timestamp: string;
      metadata: { consentSource: 'SIGNUP' | 'OAUTH_SIGNUP' };
    }
  | {
      event: 'feedback.submitted';
      userId: string;
      email: string;
      timestamp: string;
      metadata: {
        threadId: string;
        subject: string; // ≤140 chars per createThread validation
        surfaceTag?: string;
        severity?: string;
      };
    };

const WEBHOOK_TIMEOUT_MS = 4000;

/**
 * Fire-and-forget signed webhook to n8n.
 *
 * Returns immediately. Errors are logged but not thrown — the helper exists
 * to emit signals, not to block user-facing flows on n8n availability.
 */
export function emitFriendliesEvent(event: N8nFriendliesEvent): void {
  const url = process.env.N8N_WEBHOOK_URL;
  const secret = process.env.N8N_WEBHOOK_SECRET;

  // DEBUG (Phase 47.66 — remove once env vars confirmed live in prod) — logs
  // whether the helper was called and whether env vars are visible to the
  // running build. Truthy "set" or "MISSING"; never logs the secret value.
  console.log(
    `[n8n-webhook] ${event.event} invoked. url=${url ? 'set(' + url.slice(0, 30) + ')' : 'MISSING'} secret=${secret ? 'set(' + secret.length + ' chars)' : 'MISSING'} userId=${event.userId}`
  );

  // No-op when not configured. Local dev + tests are unaffected by this
  // helper unless the env vars are explicitly set.
  if (!url || !secret) return;

  // Build the signed payload synchronously so we don't await anything before
  // returning to the caller.
  const body = JSON.stringify(event);
  const signature = crypto.createHmac('sha256', secret).update(body).digest('hex');

  // Fire-and-forget. Promise floats; .catch swallows.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);

  fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Monitrax-Event': event.event,
      'X-Monitrax-Signature': signature,
    },
    body,
    signal: controller.signal,
  })
    .then((res) => {
      clearTimeout(timeout);
      if (!res.ok) {
        // Don't throw; just log. The caller's flow must not depend on this.
        console.warn(
          `[n8n-webhook] ${event.event} → ${res.status} ${res.statusText} (user ${event.userId})`
        );
      }
    })
    .catch((err: unknown) => {
      clearTimeout(timeout);
      console.warn(
        `[n8n-webhook] ${event.event} → error (user ${event.userId}):`,
        err instanceof Error ? err.message : err
      );
    });
}
