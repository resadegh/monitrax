/**
 * Phase 41f.2 — HMAC-signed state token tests.
 *
 * Locks in the structural defence: only signed-by-the-server state
 * tokens validate; tampering is rejected; expired tokens are rejected.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { issueOAuthState, verifyOAuthState } from '@/lib/integrations/xero/state';

const SECRET = 'test-secret-monitrax-41f2';

describe('Phase 41f.2 — OAuth state token', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-07T10:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('round-trip', () => {
    it('issues a state token that verifies back to the original payload', () => {
      const token = issueOAuthState('entity-123', 'user-abc', SECRET);
      const verified = verifyOAuthState(token, SECRET);
      expect(verified).not.toBeNull();
      expect(verified!.entityId).toBe('entity-123');
      expect(verified!.userId).toBe('user-abc');
      expect(typeof verified!.nonce).toBe('string');
      expect(verified!.nonce.length).toBeGreaterThan(0);
    });

    it('issues unique nonces per call (no replay even within the TTL window)', () => {
      const t1 = issueOAuthState('entity-1', 'user-1', SECRET);
      const t2 = issueOAuthState('entity-1', 'user-1', SECRET);
      expect(t1).not.toBe(t2);
      const v1 = verifyOAuthState(t1, SECRET);
      const v2 = verifyOAuthState(t2, SECRET);
      expect(v1!.nonce).not.toBe(v2!.nonce);
    });
  });

  describe('rejection — tampered tokens', () => {
    it('rejects a token signed with a different secret', () => {
      const token = issueOAuthState('entity-1', 'user-1', SECRET);
      expect(verifyOAuthState(token, 'wrong-secret')).toBeNull();
    });

    it('rejects a token whose payload is mutated after signing', () => {
      const token = issueOAuthState('entity-1', 'user-1', SECRET);
      const [, sig] = token.split('.');
      const mutatedPayload = Buffer.from(
        JSON.stringify({ e: 'attacker-entity', u: 'attacker-user', n: 'x', x: Date.now() + 60000 }),
      ).toString('base64url');
      const tampered = `${mutatedPayload}.${sig}`;
      expect(verifyOAuthState(tampered, SECRET)).toBeNull();
    });

    it('rejects a token whose signature is mutated', () => {
      const token = issueOAuthState('entity-1', 'user-1', SECRET);
      const [payload] = token.split('.');
      const tampered = `${payload}.YWJjZGVmZ2hpamtsbW5vcA`;
      expect(verifyOAuthState(tampered, SECRET)).toBeNull();
    });

    it('rejects a malformed token (missing dot)', () => {
      expect(verifyOAuthState('not-a-token', SECRET)).toBeNull();
    });

    it('rejects an empty token', () => {
      expect(verifyOAuthState('', SECRET)).toBeNull();
    });

    it('rejects a token with empty payload', () => {
      expect(verifyOAuthState('.somesig', SECRET)).toBeNull();
    });
  });

  describe('rejection — expired tokens', () => {
    it('rejects a token whose expiry has passed', () => {
      const token = issueOAuthState('entity-1', 'user-1', SECRET);
      // Advance past the 15-minute TTL
      vi.setSystemTime(new Date('2026-05-07T10:16:00Z'));
      expect(verifyOAuthState(token, SECRET)).toBeNull();
    });

    it('accepts a token issued just under the TTL boundary', () => {
      const token = issueOAuthState('entity-1', 'user-1', SECRET);
      // Advance 14 minutes 59 seconds — still within the 15-minute TTL
      vi.setSystemTime(new Date('2026-05-07T10:14:59Z'));
      const verified = verifyOAuthState(token, SECRET);
      expect(verified).not.toBeNull();
      expect(verified!.entityId).toBe('entity-1');
    });
  });

  describe('input validation', () => {
    it('rejects a non-string token (cast bypass attempt)', () => {
      // @ts-expect-error — verifying that runtime type-check rejects
      expect(verifyOAuthState(null, SECRET)).toBeNull();
      // @ts-expect-error
      expect(verifyOAuthState(123, SECRET)).toBeNull();
    });

    it('rejects a payload missing required fields', () => {
      const partialPayload = Buffer.from(
        JSON.stringify({ e: 'entity-1' }), // missing u, n, x
      ).toString('base64url');
      // Sign it with the right secret so we test missing fields specifically
      // (the sig will pass HMAC; the JSON shape check should reject)
      const { createHmac } = require('node:crypto');
      const sig = createHmac('sha256', SECRET)
        .update(partialPayload)
        .digest()
        .subarray(0, 32)
        .toString('base64url');
      expect(verifyOAuthState(`${partialPayload}.${sig}`, SECRET)).toBeNull();
    });
  });
});
