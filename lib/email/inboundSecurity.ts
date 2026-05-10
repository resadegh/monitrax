/**
 * inboundSecurity — Phase 0 / email-in hardening
 *
 * Verification primitives for the SendGrid Inbound Parse webhook
 * (`POST /api/conversations/inbound`). The webhook is unauthenticated
 * in the HTTP sense (SendGrid calls it, not a Monitrax user), so these
 * checks are the only thing standing between "real client reply" and
 * "anyone who guessed the `+conv-<slug>@` address pattern injecting
 * into an adviser↔client thread".
 *
 * Layers (defence in depth):
 *   1. Shared secret — SendGrid is configured to POST to
 *      `…/api/conversations/inbound?secret=<INBOUND_EMAIL_SECRET>`.
 *      Timing-safe compare. In production a missing secret is a
 *      misconfiguration (caller should 503); in dev it's allowed so
 *      local/demo inbound works without SendGrid.
 *   2. DKIM / SPF strict mode — SendGrid's inbound payload includes
 *      `SPF` (`pass`/`fail`/`softfail`/`neutral`/`none`) and `dkim`
 *      (`{@domain : pass}` style) form fields. When
 *      `INBOUND_EMAIL_REQUIRE_DKIM_SPF === 'true'`, require SPF=pass
 *      AND a `pass` in the dkim string. Off by default so dev/demo
 *      (which sends from un-authenticated test addresses) works; ops
 *      flips it on for prod.
 *   3. Sender allowlist — the `from` address must match the
 *      conversation's consumer participant exactly (the route already
 *      does this — it's the primary gate), OR its domain must be in
 *      `INBOUND_EMAIL_ALLOWED_DOMAINS` (comma-separated; a
 *      defence-in-depth knob for future shared-mailbox scenarios,
 *      empty by default).
 *   4. Per-conversation rate limit — at most `INBOUND_RATE_LIMIT_PER_HOUR`
 *      EMAIL_IN messages per conversation per rolling hour. Stops a
 *      runaway auto-responder loop from flooding a thread. The route
 *      passes in the recent count; the constant lives here.
 *
 * Pure helpers (no DB, no fetch) — the route does the I/O and feeds the
 * results in. Unit-tested in `tests/email/inboundSecurity.test.ts`.
 *
 * @see app/api/conversations/inbound/route.ts
 */

import crypto from 'crypto';

/** Max EMAIL_IN messages per conversation per rolling hour. */
export const INBOUND_RATE_LIMIT_PER_HOUR = 20;

/** Rolling window for the rate limit, in milliseconds. */
export const INBOUND_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export interface CheckResult {
  ok: boolean;
  /** Short machine code for the failure (audit / response body). */
  reason?: string;
  /** Human-readable detail (response body). */
  message?: string;
}

/**
 * Timing-safe string compare. Returns false for length mismatch (which
 * is itself non-secret) without short-circuiting on the content.
 */
function timingSafeEqualStr(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify the shared inbound secret.
 *
 * @param providedSecret  the `secret` query param (or header) SendGrid was configured to send
 * @param isProduction    `process.env.NODE_ENV === 'production'`
 *
 * - secret configured + matches → ok
 * - secret configured + mismatch/missing → fail (`bad_secret`)
 * - secret NOT configured + production → fail (`secret_not_configured` — misconfiguration; caller should 503)
 * - secret NOT configured + non-production → ok (dev/demo convenience)
 */
export function verifyInboundSecret(
  providedSecret: string | null | undefined,
  isProduction: boolean,
): CheckResult {
  const expected = process.env.INBOUND_EMAIL_SECRET;
  if (!expected) {
    if (isProduction) {
      return {
        ok: false,
        reason: 'secret_not_configured',
        message: 'Inbound webhook secret not configured',
      };
    }
    return { ok: true };
  }
  if (!providedSecret || !timingSafeEqualStr(providedSecret, expected)) {
    return { ok: false, reason: 'bad_secret', message: 'Invalid inbound webhook secret' };
  }
  return { ok: true };
}

/** True when DKIM/SPF strict mode is requested via env. */
export function isDkimSpfStrict(): boolean {
  return process.env.INBOUND_EMAIL_REQUIRE_DKIM_SPF === 'true';
}

/**
 * Verify DKIM + SPF from SendGrid's inbound-parse fields, when strict
 * mode is enabled. When strict mode is OFF this always returns ok
 * (with the raw values echoed for the audit row either way).
 *
 * SPF must be `pass`. The `dkim` field is a string like
 * `{@example.com : pass}` (or `none`); we require a `pass` somewhere
 * in it (case-insensitive). Both are matched leniently on
 * surrounding whitespace.
 */
export function verifyDkimSpf(
  spfRaw: string | null | undefined,
  dkimRaw: string | null | undefined,
): CheckResult & { spf: string; dkim: string } {
  const spf = (spfRaw ?? '').trim();
  const dkim = (dkimRaw ?? '').trim();
  if (!isDkimSpfStrict()) {
    return { ok: true, spf, dkim };
  }
  const spfPass = spf.toLowerCase() === 'pass';
  const dkimPass = /(^|[^a-z])pass([^a-z]|$)/i.test(dkim);
  if (!spfPass) {
    return { ok: false, reason: 'spf_not_pass', message: `SPF check did not pass (${spf || 'missing'})`, spf, dkim };
  }
  if (!dkimPass) {
    return { ok: false, reason: 'dkim_not_pass', message: `DKIM check did not pass (${dkim || 'missing'})`, spf, dkim };
  }
  return { ok: true, spf, dkim };
}

/** Extract the bare email from a `From` header (`Name <a@b>` or `a@b`). Lower-cased. */
export function extractFromAddress(fromHeader: string): string {
  const angle = fromHeader.match(/<([^>]+)>/);
  const raw = angle ? angle[1] : fromHeader;
  return raw.trim().toLowerCase();
}

/** The domain part of an email address (everything after the last `@`), lower-cased. Empty if malformed. */
export function emailDomain(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return '';
  return email.slice(at + 1).trim().toLowerCase();
}

/** Parse `INBOUND_EMAIL_ALLOWED_DOMAINS` (comma-separated) into a lower-cased Set. */
export function getAllowedInboundDomains(): Set<string> {
  const raw = process.env.INBOUND_EMAIL_ALLOWED_DOMAINS;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Decide whether `fromEmail` is allowed to post into a conversation
 * whose consumer participant is `consumerEmail`.
 *
 * Allowed iff:
 *   - exact (case-insensitive) match on the consumer's email, OR
 *   - the sender's domain is in `INBOUND_EMAIL_ALLOWED_DOMAINS`
 *     (defence-in-depth knob; empty by default ⇒ only the exact
 *     match counts).
 */
export function isSenderAllowed(
  fromEmail: string,
  consumerEmail: string | null | undefined,
): CheckResult {
  const from = fromEmail.trim().toLowerCase();
  const consumer = (consumerEmail ?? '').trim().toLowerCase();
  if (!consumer) {
    return { ok: false, reason: 'no_consumer_email', message: 'Conversation has no consumer participant email' };
  }
  if (from && from === consumer) return { ok: true };
  const allowedDomains = getAllowedInboundDomains();
  const dom = emailDomain(from);
  if (dom && allowedDomains.has(dom)) return { ok: true };
  return { ok: false, reason: 'sender_mismatch', message: 'From address does not match the conversation participant' };
}

/**
 * Check the per-conversation rate limit. The route counts EMAIL_IN
 * messages in the last `INBOUND_RATE_LIMIT_WINDOW_MS` and passes the
 * count here.
 */
export function checkInboundRateLimit(recentEmailInCount: number): CheckResult {
  if (recentEmailInCount >= INBOUND_RATE_LIMIT_PER_HOUR) {
    return {
      ok: false,
      reason: 'rate_limited',
      message: `Conversation has hit the inbound limit of ${INBOUND_RATE_LIMIT_PER_HOUR} emails/hour`,
    };
  }
  return { ok: true };
}
