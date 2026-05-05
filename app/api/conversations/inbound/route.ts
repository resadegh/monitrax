/**
 * Phase 32C PR4d — SendGrid Inbound Parse webhook.
 *
 * POST /api/conversations/inbound
 *
 * SendGrid's Inbound Parse forwards incoming emails to this endpoint as
 * `multipart/form-data` with fields `to`, `from`, `subject`, `text`, etc.
 * We extract the per-conversation slug from the `to` header (format
 * `monitrax+conv-<slug>@<inbound-domain>`), look up the conversation,
 * and post the email body as a CONSUMER-side message with channel=EMAIL_IN.
 *
 * Auth: NO `withPermission` gate — this is a webhook called by SendGrid,
 * not a Monitrax-authenticated user. Verification (signed payload via
 * SendGrid's webhook signature, sender allowlist, IP allowlist) defers
 * to PROD per IMPLEMENTATION_PLAN.md DEFERRED bucket. v1 is intended for
 * dev / demo only; do NOT enable inbound DNS for prod traffic until
 * hardening is in place.
 *
 * PROD HARDENING TODO (DEFERRED bucket):
 *   - DKIM/SPF strict mode verification
 *   - SendGrid signed-event verification
 *   - Sender-domain allowlist
 *   - Cloud DLP attachment scanning
 *   - HTML→plaintext sanitisation (currently we accept text/plain only)
 *   - Rate-limiting per conversation (prevent runaway loops)
 *   - X-Monitrax-* tracing header verification
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  findConversationByReplyToSlug,
  postMessage,
} from '@/lib/services/conversationService';
import { createAuditLog } from '@/lib/security/auditLog';

const SLUG_RE = /\+conv-([a-zA-Z0-9]+)@/;
const MAX_TEXT_BYTES = 50 * 1024; // 50KB safety cap on inbound text

function extractSlug(toHeader: string): string | null {
  const match = toHeader.match(SLUG_RE);
  return match ? match[1] : null;
}

function extractFromAddress(fromHeader: string): string {
  // Accept both "Name <email@domain>" and bare "email@domain"
  const angle = fromHeader.match(/<([^>]+)>/);
  return angle ? angle[1].trim() : fromHeader.trim();
}

export async function POST(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_PAYLOAD', message: 'Expected multipart/form-data' } },
      { status: 400 },
    );
  }

  const toHeader = String(formData.get('to') ?? '');
  const fromHeader = String(formData.get('from') ?? '');
  const subject = String(formData.get('subject') ?? '');
  const text = String(formData.get('text') ?? '');

  if (!toHeader || !fromHeader || !text) {
    return NextResponse.json(
      { success: false, error: { code: 'MISSING_FIELDS', message: 'to, from, and text required' } },
      { status: 400 },
    );
  }

  if (text.length > MAX_TEXT_BYTES) {
    return NextResponse.json(
      { success: false, error: { code: 'PAYLOAD_TOO_LARGE', message: `text exceeds ${MAX_TEXT_BYTES} bytes` } },
      { status: 413 },
    );
  }

  const slug = extractSlug(toHeader);
  if (!slug) {
    return NextResponse.json(
      { success: false, error: { code: 'NO_CONVERSATION_SLUG', message: 'to address missing conversation slug' } },
      { status: 400 },
    );
  }

  const conversation = await findConversationByReplyToSlug(slug);
  if (!conversation) {
    return NextResponse.json(
      { success: false, error: { code: 'CONVERSATION_NOT_FOUND', message: 'No conversation matches this slug' } },
      { status: 404 },
    );
  }

  // Verify the from-address matches the consumer participant — prevents
  // arbitrary inbound from posting into the thread. v1 check is
  // case-insensitive exact match on the email; PROD will tighten with
  // SPF + DKIM verification.
  const fromEmail = extractFromAddress(fromHeader).toLowerCase();
  const consumerParticipant = conversation.participants[0];
  const consumerEmail = consumerParticipant?.user?.email?.toLowerCase();
  if (!consumerEmail || consumerEmail !== fromEmail) {
    return NextResponse.json(
      { success: false, error: { code: 'SENDER_MISMATCH', message: 'From address does not match conversation participant' } },
      { status: 403 },
    );
  }

  // Strip common email reply-quote markers — keep just the user's prose.
  // v1 is a coarse heuristic; PROD will use a proper email parser.
  const cleanedBody = stripQuotedReply(text);

  try {
    const created = await postMessage({
      conversationId: conversation.id,
      senderUserId: '', // not used for inbound — service layer reads channel=EMAIL_IN
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
 * Keeps the user's reply text. This is intentionally simple — PROD will
 * use a proper library (e.g. Mailgun's email-reply-parser).
 */
function stripQuotedReply(raw: string): string {
  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .* wrote:/i.test(line.trim())) break;
    if (/^>/.test(line.trim())) break;
    if (line.trim() === '-- ') break;
    out.push(line);
  }
  return out.join('\n').trim();
}
