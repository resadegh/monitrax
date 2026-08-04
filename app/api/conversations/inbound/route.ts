/**
 * SendGrid Inbound Parse webhook — POST /api/conversations/inbound
 *
 * Phase 32C PR4d shipped the v1 (dev/demo) version with no verification.
 * Phase 0 email-in hardening (this version) adds the defence layers the
 * original file's TODO listed. The webhook is unauthenticated in the
 * HTTP sense (SendGrid calls it, not a Monitrax user), so these checks
 * are the only thing between "real client reply" and "anyone who
 * guessed the `monitrax+conv-<slug>@<inbound-domain>` address pattern
 * injecting into an adviser↔client thread".
 *
 * Verification order (fail-closed; every reject writes a `BLOCKED`
 * audit row):
 *   1. Shared secret — SendGrid is configured to POST to
 *      `…?secret=<INBOUND_EMAIL_SECRET>` (or send an
 *      `x-inbound-secret` header). Timing-safe. Missing-secret-in-prod
 *      = 503 (misconfiguration); missing-in-dev = allowed.
 *   2. DKIM / SPF strict mode — when `INBOUND_EMAIL_REQUIRE_DKIM_SPF`
 *      is `'true'`, require SPF=pass + a `pass` in the `dkim` field
 *      (both SendGrid inbound-parse fields). Off by default so dev/demo
 *      works; ops flips it on for prod.
 *   3. Payload sanity — `to` / `from` / `text` present, text ≤ 50KB,
 *      slug extractable, conversation exists.
 *   4. Sender allowlist — `from` must match the conversation's consumer
 *      participant exactly, OR its domain must be in
 *      `INBOUND_EMAIL_ALLOWED_DOMAINS` (empty by default).
 *   5. Per-conversation rate limit — at most
 *      `INBOUND_RATE_LIMIT_PER_HOUR` EMAIL_IN messages per conversation
 *      per rolling hour (stops a runaway auto-responder loop).
 *
 * The verification primitives live in `lib/email/inboundSecurity.ts`
 * (pure, unit-tested); this route does the I/O and feeds the results in.
 *
 * Still deferred (not in this hardening pass):
 *   - Cloud DLP attachment scanning (GCP service to enable)
 *   - HTML→plaintext sanitisation (we accept text/plain only at v1)
 *   - X-Monitrax-* tracing-header round-trip verification
 *   - A proper email-reply parser (current quote-stripper is a coarse
 *     heuristic)
 *
 * Prod env: `INBOUND_EMAIL_SECRET` (required), `INBOUND_EMAIL_REQUIRE_DKIM_SPF=true`,
 * optionally `INBOUND_EMAIL_ALLOWED_DOMAINS`. SendGrid's Inbound Parse
 * destination URL must carry the `?secret=…` query param.
 *
 * CLAUDE.md §12.5 (input validation at system boundaries), §13.3
 * (no CDR-raw data in audit metadata).
 */
import { moduleApiGuard } from '@/lib/featureFlags/moduleRouteGuard';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import {
  findConversationByReplyToSlug,
  postMessage,
} from '@/lib/services/conversationService';
import { createAuditLog } from '@/lib/security/auditLog';
import {
  verifyInboundSecret,
  verifyDkimSpf,
  isSenderAllowed,
  checkInboundRateLimit,
  extractFromAddress,
  INBOUND_RATE_LIMIT_WINDOW_MS,
} from '@/lib/email/inboundSecurity';

const SLUG_RE = /\+conv-([a-zA-Z0-9]+)@/;
const MAX_TEXT_BYTES = 50 * 1024; // 50KB safety cap on inbound text

function extractSlug(toHeader: string): string | null {
  const match = toHeader.match(SLUG_RE);
  return match ? match[1] : null;
}

/** Write a BLOCKED audit row for a rejected inbound. Fire-and-forget. */
function auditReject(reason: string, extra?: Record<string, unknown>) {
  createAuditLog({
    action: 'UNAUTHORIZED_ACCESS',
    status: 'BLOCKED',
    entityType: 'ConversationInboundEmail',
    metadata: { reason, route: '/api/conversations/inbound', ...extra },
  }).catch(() => {});
}

export async function POST(request: NextRequest) {
    const gateBlocked = await moduleApiGuard('MODULE_SOCIAL');
    if (gateBlocked) return gateBlocked;
  const isProduction = process.env.NODE_ENV === 'production';

  // 1. Shared secret — `?secret=` query param or `x-inbound-secret` header.
  const { searchParams } = new URL(request.url);
  const providedSecret = searchParams.get('secret') ?? request.headers.get('x-inbound-secret');
  const secretCheck = verifyInboundSecret(providedSecret, isProduction);
  if (!secretCheck.ok) {
    if (secretCheck.reason === 'secret_not_configured') {
      auditReject(secretCheck.reason);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: secretCheck.message } },
        { status: 503 },
      );
    }
    auditReject(secretCheck.reason ?? 'bad_secret');
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: secretCheck.message } },
      { status: 401 },
    );
  }

  // Parse the multipart body.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    auditReject('invalid_payload');
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_PAYLOAD', message: 'Expected multipart/form-data' } },
      { status: 400 },
    );
  }

  const toHeader = String(formData.get('to') ?? '');
  const fromHeader = String(formData.get('from') ?? '');
  const subject = String(formData.get('subject') ?? '');
  const text = String(formData.get('text') ?? '');
  const spfRaw = String(formData.get('SPF') ?? formData.get('spf') ?? '');
  const dkimRaw = String(formData.get('dkim') ?? '');

  if (!toHeader || !fromHeader || !text) {
    auditReject('missing_fields');
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_FIELDS', message: 'to, from, and text required' } },
      { status: 400 },
    );
  }
  if (text.length > MAX_TEXT_BYTES) {
    auditReject('payload_too_large', { textBytes: text.length });
    return NextResponse.json(
      { success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: `text exceeds ${MAX_TEXT_BYTES} bytes` } },
      { status: 413 },
    );
  }

  // 2. DKIM / SPF strict mode (no-op unless INBOUND_EMAIL_REQUIRE_DKIM_SPF=true).
  const dkimSpf = verifyDkimSpf(spfRaw, dkimRaw);
  if (!dkimSpf.ok) {
    auditReject(dkimSpf.reason ?? 'dkim_spf_failed', { spf: dkimSpf.spf, dkim: dkimSpf.dkim });
    return NextResponse.json(
      { success: false, error: { code: 'EMAIL_AUTH_FAILED', message: dkimSpf.message } },
      { status: 403 },
    );
  }

  // 3. Slug + conversation lookup.
  const slug = extractSlug(toHeader);
  if (!slug) {
    auditReject('no_conversation_slug');
    return NextResponse.json(
      { success: false, error: { code: 'NO_CONVERSATION_SLUG', message: 'to address missing conversation slug' } },
      { status: 400 },
    );
  }
  const conversation = await findConversationByReplyToSlug(slug);
  if (!conversation) {
    auditReject('conversation_not_found', { slug });
    return NextResponse.json(
      { success: false, error: { code: 'CONVERSATION_NOT_FOUND', message: 'No conversation matches this slug' } },
      { status: 404 },
    );
  }

  // 4. Sender allowlist — exact match on the consumer participant, or a
  //    domain in INBOUND_EMAIL_ALLOWED_DOMAINS.
  const fromEmail = extractFromAddress(fromHeader);
  const consumerParticipant = conversation.participants[0];
  const consumerEmail = consumerParticipant?.user?.email ?? null;
  const senderCheck = isSenderAllowed(fromEmail, consumerEmail);
  if (!senderCheck.ok) {
    auditReject(senderCheck.reason ?? 'sender_mismatch', { conversationId: conversation.id, fromEmail });
    return NextResponse.json(
      { success: false, error: { code: 'SENDER_MISMATCH', message: senderCheck.message } },
      { status: 403 },
    );
  }

  // 5. Per-conversation rate limit.
  const since = new Date(Date.now() - INBOUND_RATE_LIMIT_WINDOW_MS);
  const recentInboundCount = await prisma.conversationMessage.count({
    where: { conversationId: conversation.id, channel: 'EMAIL_IN', createdAt: { gte: since } },
  });
  const rateCheck = checkInboundRateLimit(recentInboundCount);
  if (!rateCheck.ok) {
    auditReject(rateCheck.reason ?? 'rate_limited', { conversationId: conversation.id, recentInboundCount });
    return NextResponse.json(
      { success: false, error: { code: 'RATE_LIMITED', message: rateCheck.message } },
      { status: 429 },
    );
  }

  // Strip common email reply-quote markers — keep just the user's prose.
  const cleanedBody = stripQuotedReply(text);

  try {
    const created = await postMessage({
      conversationId: conversation.id,
      senderUserId: '', // not used for inbound — the service layer reads channel=EMAIL_IN
      body: cleanedBody,
      channel: 'EMAIL_IN',
      inboundFromEmail: fromEmail,
      inboundSubject: subject,
    });

    createAuditLog({
      userId: consumerParticipant.userId ?? undefined,
      action: 'CONVERSATION_EMAIL_INBOUND',
      entityType: 'CONVERSATION_MESSAGE',
      entityId: created.id,
      metadata: {
        conversationId: conversation.id,
        fromEmail,
        subject: subject.slice(0, 80),
        spf: dkimSpf.spf || undefined,
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, data: { messageId: created.id } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Inbound failed';
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL', message } },
      { status: 500 },
    );
  }
}

/**
 * Coarse quote-stripper. Cuts off at the first occurrence of:
 *   - "On <date> wrote:" line (Apple Mail / Outlook format)
 *   - ">" line at start of a line (RFC 2822 quoted reply)
 *   - "-- " sig delimiter
 *
 * Keeps the user's reply text. Intentionally simple — a proper
 * email-reply parser (e.g. Mailgun's `email-reply-parser`) is in the
 * still-deferred list.
 */
function stripQuotedReply(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^On .* wrote:/i.test(t)) break;
    if (/^>/.test(t)) break;
    if (t === '-- ') break;
    out.push(line);
  }
  return out.join('\n').trim();
}
