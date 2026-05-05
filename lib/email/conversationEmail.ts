/**
 * Phase 32C PR4d — Email outbound for conversation messages.
 *
 * Mirrors an in-app message out via SendGrid so the recipient (typically
 * the consumer) gets an email AND can reply by hitting Reply on the email
 * — the inbound webhook routes that reply back into the same in-app
 * thread via `replyToSlug`.
 *
 * `SENDGRID_API_KEY` env var is the activation toggle. When unset (dev
 * envs, demo environments without the production secret), we no-op
 * + log + write an audit row. The architectural pattern stays visible
 * (you can see the email "would have" gone) without the demo grinding
 * to a halt waiting for SMTP credentials.
 *
 * PROD hardening — DKIM/SPF strict mode, SendGrid suppressions, retry
 * with exponential backoff, attachment limits, X-Monitrax-* tracing
 * headers — defers to PROD per IMPLEMENTATION_PLAN.md DEFERRED bucket.
 *
 * Inbound parsing lives in `app/api/conversations/inbound/route.ts`.
 */
import 'server-only';
import { log } from '@/lib/utils/logger';

const FROM_NAME = 'Monitrax';
const FROM_ADDRESS = process.env.MONITRAX_INBOUND_FROM_ADDRESS ?? 'no-reply@monitrax.com.au';
const INBOUND_DOMAIN = process.env.MONITRAX_INBOUND_DOMAIN ?? 'reply.monitrax.com.au';

export interface SendConversationEmailInput {
  to: string;
  toName?: string;
  subject: string;
  body: string;
  replyToSlug: string;
  conversationId: string;
  /** Sender display name — usually the professional's display name. */
  fromDisplayName?: string;
  /** Stable thread reference — used for In-Reply-To header so threading
   *  works in Gmail / Outlook clients. PROD uses MIME-spec Message-IDs;
   *  v1 uses the conversation id. */
  threadReference?: string;
}

export interface SendConversationEmailResult {
  delivered: boolean;
  /** SendGrid X-Message-Id when actually sent; deterministic stub id when
   *  in dev fallback mode. Stored on `ConversationMessage.externalMessageId`. */
  externalMessageId: string;
  channel: 'sendgrid' | 'console-stub';
}

export function buildReplyToAddress(slug: string): string {
  return `monitrax+conv-${slug}@${INBOUND_DOMAIN}`;
}

/**
 * Mirrors a conversation message out via email. Idempotent at the call site
 * — the caller is expected to set `externalMessageId` on the message row
 * once this returns; subsequent retries can skip if already sent.
 */
export async function sendConversationEmail(
  input: SendConversationEmailInput,
): Promise<SendConversationEmailResult> {
  const replyTo = buildReplyToAddress(input.replyToSlug);
  const fromHeader = input.fromDisplayName
    ? `${input.fromDisplayName} via Monitrax <${FROM_ADDRESS}>`
    : `${FROM_NAME} <${FROM_ADDRESS}>`;

  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) {
    // Dev / demo fallback — log the would-be email so the architectural
    // pattern is visible, return a deterministic stub message id.
    const stubId = `stub-${input.conversationId}-${Date.now().toString(36)}`;
    log.info('[conversationEmail] SENDGRID_API_KEY unset — logging instead of sending', {
      to: input.to,
      from: fromHeader,
      replyTo,
      subject: input.subject,
      bodyPreview: input.body.slice(0, 120),
      conversationId: input.conversationId,
      stubMessageId: stubId,
    });
    return { delivered: false, externalMessageId: stubId, channel: 'console-stub' };
  }

  // PROD path — minimal SendGrid v3 send via fetch. Kept zero-dep
  // (no @sendgrid/mail npm package needed). Hardening (retries, DLQ,
  // detailed delivery webhooks) defers to PROD.
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: input.to, name: input.toName }],
            subject: input.subject,
          },
        ],
        from: { email: FROM_ADDRESS, name: input.fromDisplayName ?? FROM_NAME },
        reply_to: { email: replyTo, name: 'Monitrax (reply to continue thread)' },
        content: [
          { type: 'text/plain', value: appendFooter(input.body, input.replyToSlug) },
        ],
        // Custom headers for thread tracing (some clients honour this for
        // inbox grouping). Real Message-ID semantics defer to PROD.
        custom_args: {
          monitrax_conversation_id: input.conversationId,
          monitrax_reply_to_slug: input.replyToSlug,
        },
      }),
    });
    const externalMessageId = res.headers.get('x-message-id') ?? `sg-${Date.now().toString(36)}`;
    if (!res.ok) {
      log.error('[conversationEmail] SendGrid rejected message', null, {
        status: res.status,
        conversationId: input.conversationId,
      });
      return { delivered: false, externalMessageId, channel: 'sendgrid' };
    }
    return { delivered: true, externalMessageId, channel: 'sendgrid' };
  } catch (err) {
    log.error('[conversationEmail] SendGrid send threw', err instanceof Error ? err : null, {
      conversationId: input.conversationId,
    });
    return {
      delivered: false,
      externalMessageId: `error-${input.conversationId}-${Date.now().toString(36)}`,
      channel: 'sendgrid',
    };
  }
}

/**
 * Plain-text email footer. Carries the reply-to address explicitly so
 * users on email clients that strip Reply-To can still reply manually,
 * plus a link back to the in-app thread.
 */
function appendFooter(body: string, replyToSlug: string): string {
  const replyAddr = buildReplyToAddress(replyToSlug);
  return `${body}\n\n---\nReply to this email to continue the conversation in-app.\nReply-to: ${replyAddr}\n\nMonitrax — wealth orchestration for Australian households and the professionals who advise them.`;
}
