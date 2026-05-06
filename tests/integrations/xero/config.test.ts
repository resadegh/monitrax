/**
 * Phase 41f.2 — Xero config resolution tests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolveXeroConfig, isXeroConfigured } from '@/lib/integrations/xero/config';

describe('Phase 41f.2 — Xero config resolution', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.XERO_CLIENT_ID;
    delete process.env.XERO_CLIENT_SECRET;
    delete process.env.XERO_OAUTH_REDIRECT_URI;
    delete process.env.XERO_OAUTH_STATE_SECRET;
    delete process.env.NEXTAUTH_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns configured: false when no env vars are set', () => {
    const r = resolveXeroConfig();
    expect(r.configured).toBe(false);
    if (!r.configured) {
      expect(r.missing).toContain('XERO_CLIENT_ID');
      expect(r.missing).toContain('XERO_CLIENT_SECRET');
      expect(r.missing).toContain('XERO_OAUTH_REDIRECT_URI');
    }
    expect(isXeroConfigured()).toBe(false);
  });

  it('returns configured: false when only some required vars are set', () => {
    process.env.XERO_CLIENT_ID = 'cid';
    process.env.XERO_CLIENT_SECRET = 'csecret';
    // Missing redirect URI
    const r = resolveXeroConfig();
    expect(r.configured).toBe(false);
    if (!r.configured) {
      expect(r.missing).toContain('XERO_OAUTH_REDIRECT_URI');
    }
  });

  it('returns configured: false when state secret is missing AND no NEXTAUTH_SECRET fallback', () => {
    process.env.XERO_CLIENT_ID = 'cid';
    process.env.XERO_CLIENT_SECRET = 'csecret';
    process.env.XERO_OAUTH_REDIRECT_URI = 'https://app.monitrax.com.au/cb';
    const r = resolveXeroConfig();
    expect(r.configured).toBe(false);
    if (!r.configured) {
      expect(r.missing.some((m) => m.includes('STATE_SECRET'))).toBe(true);
    }
  });

  it('falls back to NEXTAUTH_SECRET when XERO_OAUTH_STATE_SECRET is missing', () => {
    process.env.XERO_CLIENT_ID = 'cid';
    process.env.XERO_CLIENT_SECRET = 'csecret';
    process.env.XERO_OAUTH_REDIRECT_URI = 'https://app.monitrax.com.au/cb';
    process.env.NEXTAUTH_SECRET = 'fallback-secret';
    const r = resolveXeroConfig();
    expect(r.configured).toBe(true);
    if (r.configured) {
      expect(r.config.stateSecret).toBe('fallback-secret');
    }
  });

  it('returns configured: true with full config when every var is set', () => {
    process.env.XERO_CLIENT_ID = 'cid';
    process.env.XERO_CLIENT_SECRET = 'csecret';
    process.env.XERO_OAUTH_REDIRECT_URI = 'https://app.monitrax.com.au/cb';
    process.env.XERO_OAUTH_STATE_SECRET = 'specific-state-secret';
    const r = resolveXeroConfig();
    expect(r.configured).toBe(true);
    if (r.configured) {
      expect(r.config.clientId).toBe('cid');
      expect(r.config.clientSecret).toBe('csecret');
      expect(r.config.redirectUri).toBe('https://app.monitrax.com.au/cb');
      expect(r.config.stateSecret).toBe('specific-state-secret');
    }
    expect(isXeroConfigured()).toBe(true);
  });

  it('XERO_OAUTH_STATE_SECRET takes precedence over NEXTAUTH_SECRET', () => {
    process.env.XERO_CLIENT_ID = 'cid';
    process.env.XERO_CLIENT_SECRET = 'csecret';
    process.env.XERO_OAUTH_REDIRECT_URI = 'https://app.monitrax.com.au/cb';
    process.env.NEXTAUTH_SECRET = 'fallback';
    process.env.XERO_OAUTH_STATE_SECRET = 'specific';
    const r = resolveXeroConfig();
    expect(r.configured).toBe(true);
    if (r.configured) {
      expect(r.config.stateSecret).toBe('specific');
    }
  });
});
