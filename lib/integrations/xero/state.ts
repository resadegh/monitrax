/**
 * Phase 41f.2 — Stateless OAuth state token (HMAC-signed).
 *
 * Xero OAuth uses a single registered redirect URI. We can't put the
 * `entityId` in the path (Xero rejects per-entity URIs as unregistered).
 * Instead we encode `{ entityId, userId, nonce, expiresAt }` as the
 * `state` parameter and sign it with HMAC-SHA256 using a server-side
 * secret.
 *
 * Why stateless (vs the in-memory store pattern in `lib/auth/oauth.ts`):
 * Vercel functions are stateless — the request that issues the state
 * runs on a different function instance from the request that
 * validates it on callback. An in-memory map only works in dev.
 *
 * Token shape (URL-safe base64, dot-separated):
 *   <payload-b64>.<sig-b64>
 *
 * Where payload is `JSON.stringify({ e: entityId, u: userId, n: nonce, x: expiresAt })`
 * and sig is `HMAC-SHA256(payload, secret)` truncated to 32 bytes.
 */

import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface XeroOAuthStatePayload {
  entityId: string;
  userId: string;
  nonce: string;
  expiresAt: number; // ms epoch
}

const STATE_TTL_MS = 15 * 60 * 1000; // 15 minutes — covers a slow Xero consent screen + retry
const SIG_BYTE_LEN = 32;

/**
 * Issue a fresh signed state token for `(entityId, userId)`. Lives 15
 * minutes; the callback rejects expired tokens.
 */
export function issueOAuthState(
  entityId: string,
  userId: string,
  secret: string,
): string {
  const payload: XeroOAuthStatePayload = {
    entityId,
    userId,
    nonce: randomBytes(16).toString('base64url'),
    expiresAt: Date.now() + STATE_TTL_MS,
  };
  const compactPayload = JSON.stringify({
    e: payload.entityId,
    u: payload.userId,
    n: payload.nonce,
    x: payload.expiresAt,
  });
  const payloadB64 = Buffer.from(compactPayload, 'utf8').toString('base64url');
  const sig = sign(payloadB64, secret);
  return `${payloadB64}.${sig}`;
}

/**
 * Verify + parse a state token. Returns the payload on success, `null`
 * on any failure (bad signature / expired / malformed). The callback
 * MUST treat `null` as a hard reject.
 */
export function verifyOAuthState(
  token: string,
  secret: string,
): XeroOAuthStatePayload | null {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [payloadB64, sig] = token.split('.', 2);
  if (!payloadB64 || !sig) return null;

  const expected = sign(payloadB64, secret);
  if (!timingSafeEqualB64(expected, sig)) return null;

  let parsed: { e?: unknown; u?: unknown; n?: unknown; x?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (
    typeof parsed.e !== 'string' ||
    typeof parsed.u !== 'string' ||
    typeof parsed.n !== 'string' ||
    typeof parsed.x !== 'number'
  ) {
    return null;
  }

  if (Date.now() > parsed.x) return null;

  return {
    entityId: parsed.e,
    userId: parsed.u,
    nonce: parsed.n,
    expiresAt: parsed.x,
  };
}

function sign(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret)
    .update(payloadB64)
    .digest()
    .subarray(0, SIG_BYTE_LEN)
    .toString('base64url');
}

function timingSafeEqualB64(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'base64url');
  const bb = Buffer.from(b, 'base64url');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
