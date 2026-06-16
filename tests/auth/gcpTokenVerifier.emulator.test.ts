/**
 * Phase 4 · Layer 4 — server-side Auth-emulator verify path.
 *
 * The Firebase Auth emulator issues UNSIGNED tokens, so verifyGCPIdToken takes
 * a decode-only path gated on FIREBASE_AUTH_EMULATOR_HOST. These tests pin that
 * the gate is (a) strictly env-gated (off without the var → real path rejects
 * an unsigned token), and (b) still enforces issuer / audience / expiry.
 *
 * GCP_PROJECT_ID is read at module load, so it is set before the dynamic import.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const PROJECT = 'monitrax-e2e';
process.env.GCP_PROJECT_ID = PROJECT;

// Dynamic import AFTER env is set so module-level consts pick it up.
const { verifyGCPIdToken } = await import('@/lib/auth/gcpTokenVerifier');

function emulatorToken(over: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: `https://securetoken.google.com/${PROJECT}`,
    aud: PROJECT,
    sub: 'emu-uid-123',
    email: 'sole.owner@e2e.monitrax.test',
    email_verified: true,
    auth_time: now,
    iat: now,
    exp: now + 3600,
    firebase: { sign_in_provider: 'password' },
    ...over,
  };
  // Sign with a throwaway secret — the emulator path only `jwt.decode`s it.
  return jwt.sign(payload, 'emulator-test-secret');
}

describe('verifyGCPIdToken — Auth emulator path (env-gated)', () => {
  afterEach(() => { delete process.env.FIREBASE_AUTH_EMULATOR_HOST; vi.restoreAllMocks(); });

  it('OFF by default: an unsigned token is rejected when the emulator env is absent', async () => {
    expect(process.env.FIREBASE_AUTH_EMULATOR_HOST).toBeUndefined();
    const claims = await verifyGCPIdToken(emulatorToken());
    expect(claims).toBeNull(); // real path: no kid / no Google cert match
  });

  describe('with FIREBASE_AUTH_EMULATOR_HOST set', () => {
    beforeEach(() => { process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099'; });

    it('accepts a well-formed emulator token and extracts claims', async () => {
      const claims = await verifyGCPIdToken(emulatorToken());
      expect(claims).not.toBeNull();
      expect(claims!.uid).toBe('emu-uid-123');
      expect(claims!.email).toBe('sole.owner@e2e.monitrax.test');
      expect(claims!.emailVerified).toBe(true);
      expect(claims!.signInProvider).toBe('password');
    });

    it('rejects a wrong issuer', async () => {
      const t = emulatorToken({ iss: 'https://securetoken.google.com/some-other-project' });
      expect(await verifyGCPIdToken(t)).toBeNull();
    });

    it('rejects a wrong audience', async () => {
      expect(await verifyGCPIdToken(emulatorToken({ aud: 'wrong-aud' }))).toBeNull();
    });

    it('rejects an expired token', async () => {
      const now = Math.floor(Date.now() / 1000);
      expect(await verifyGCPIdToken(emulatorToken({ exp: now - 10 }))).toBeNull();
    });

    it('rejects a token missing sub or email', async () => {
      expect(await verifyGCPIdToken(emulatorToken({ sub: undefined }))).toBeNull();
      expect(await verifyGCPIdToken(emulatorToken({ email: undefined }))).toBeNull();
    });
  });
});
