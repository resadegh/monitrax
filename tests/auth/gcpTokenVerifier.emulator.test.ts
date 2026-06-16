/**
 * Phase 4 · Layer 4 — server-side Auth-emulator verify path.
 *
 * The Firebase Auth emulator issues UNSIGNED tokens, so verifyGCPIdToken takes
 * a decode-only path gated on FIREBASE_AUTH_EMULATOR_HOST. These tests pin that
 * the gate is (a) strictly env-gated (off without the var → real path rejects
 * an unsigned token), and (b) still enforces issuer / audience / expiry.
 *
 * GCP_PROJECT_ID is read at module load of the verifier, so we set it + import
 * the module inside beforeAll (with vi.resetModules), and RESTORE the original
 * env in afterAll so this file never leaks process.env to other test files /
 * workers (no module-scope mutation, no top-level await).
 */
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';

const PROJECT = 'monitrax-e2e';
const ORIGINAL_PROJECT = process.env.GCP_PROJECT_ID;

let verifyGCPIdToken: typeof import('@/lib/auth/gcpTokenVerifier').verifyGCPIdToken;

beforeAll(async () => {
  process.env.GCP_PROJECT_ID = PROJECT;
  vi.resetModules();
  ({ verifyGCPIdToken } = await import('@/lib/auth/gcpTokenVerifier'));
});

afterAll(() => {
  if (ORIGINAL_PROJECT === undefined) delete process.env.GCP_PROJECT_ID;
  else process.env.GCP_PROJECT_ID = ORIGINAL_PROJECT;
  delete process.env.FIREBASE_AUTH_EMULATOR_HOST;
  vi.resetModules();
});

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
  afterEach(() => { delete process.env.FIREBASE_AUTH_EMULATOR_HOST; });

  it('OFF by default: an unsigned token is rejected when the emulator env is absent', async () => {
    expect(process.env.FIREBASE_AUTH_EMULATOR_HOST).toBeUndefined();
    expect(await verifyGCPIdToken(emulatorToken())).toBeNull();
  });

  describe('with FIREBASE_AUTH_EMULATOR_HOST set', () => {
    it('accepts a well-formed emulator token and extracts claims', async () => {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
      const claims = await verifyGCPIdToken(emulatorToken());
      expect(claims).not.toBeNull();
      expect(claims!.uid).toBe('emu-uid-123');
      expect(claims!.email).toBe('sole.owner@e2e.monitrax.test');
      expect(claims!.emailVerified).toBe(true);
      expect(claims!.signInProvider).toBe('password');
    });

    it('rejects a wrong issuer', async () => {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
      expect(await verifyGCPIdToken(emulatorToken({ iss: 'https://securetoken.google.com/other' }))).toBeNull();
    });

    it('rejects a wrong audience', async () => {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
      expect(await verifyGCPIdToken(emulatorToken({ aud: 'wrong-aud' }))).toBeNull();
    });

    it('rejects an expired token', async () => {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
      const now = Math.floor(Date.now() / 1000);
      expect(await verifyGCPIdToken(emulatorToken({ exp: now - 10 }))).toBeNull();
    });

    it('rejects a token missing sub or email', async () => {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
      expect(await verifyGCPIdToken(emulatorToken({ sub: undefined }))).toBeNull();
      expect(await verifyGCPIdToken(emulatorToken({ email: undefined }))).toBeNull();
    });
  });
});
