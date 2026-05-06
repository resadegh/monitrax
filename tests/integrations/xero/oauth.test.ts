/**
 * Phase 41f.2 — OAuth helper tests (authorize URL builder).
 *
 * Token-exchange / refresh / revoke / tenant-list helpers all hit the
 * network — they're smoke-tested manually after deploy and integration-
 * tested with a Xero sandbox connection. The unit-testable surface is
 * the authorize URL builder + the token-response parser shape (covered
 * indirectly via the state-token tests).
 */

import { describe, it, expect } from 'vitest';
import { buildAuthorizeUrl, XERO_AUTHORIZE_URL } from '@/lib/integrations/xero';
import type { XeroConfig } from '@/lib/integrations/xero';

const CONFIG: XeroConfig = {
  clientId: 'test-client-id',
  clientSecret: 'test-client-secret',
  redirectUri: 'https://app.monitrax.com.au/api/integrations/xero/callback',
  stateSecret: 'test-state-secret',
};

describe('Phase 41f.2 — buildAuthorizeUrl', () => {
  it('builds a Xero authorize URL with all required RFC 6749 params', () => {
    const url = buildAuthorizeUrl('entity-1', 'user-1', CONFIG);
    expect(url.startsWith(XERO_AUTHORIZE_URL)).toBe(true);

    const parsed = new URL(url);
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('client_id')).toBe('test-client-id');
    expect(parsed.searchParams.get('redirect_uri')).toBe(
      'https://app.monitrax.com.au/api/integrations/xero/callback',
    );
    expect(parsed.searchParams.get('scope')).toContain('offline_access');
    expect(parsed.searchParams.get('scope')).toContain('accounting.reports.read');
    expect(parsed.searchParams.get('state')).toBeTruthy();
  });

  it('embeds different state tokens for different (entityId, userId) pairs', () => {
    const a = new URL(buildAuthorizeUrl('e1', 'u1', CONFIG));
    const b = new URL(buildAuthorizeUrl('e2', 'u1', CONFIG));
    const c = new URL(buildAuthorizeUrl('e1', 'u2', CONFIG));
    const stateA = a.searchParams.get('state');
    const stateB = b.searchParams.get('state');
    const stateC = c.searchParams.get('state');
    expect(stateA).not.toBe(stateB);
    expect(stateA).not.toBe(stateC);
    expect(stateB).not.toBe(stateC);
  });

  it('does NOT include the client_secret anywhere in the authorize URL', () => {
    const url = buildAuthorizeUrl('entity-1', 'user-1', CONFIG);
    expect(url.includes('test-client-secret')).toBe(false);
    expect(url.toLowerCase().includes('secret')).toBe(false);
  });

  it('URL-encodes the redirect_uri properly', () => {
    const url = buildAuthorizeUrl('entity-1', 'user-1', CONFIG);
    // The raw colon and slashes get percent-encoded in URLSearchParams output
    expect(url.includes('redirect_uri=https%3A%2F%2Fapp.monitrax.com.au')).toBe(true);
  });

  it('requests the read-only Xero scopes only (no write scopes per §1.1 boundary)', () => {
    const url = buildAuthorizeUrl('entity-1', 'user-1', CONFIG);
    const scope = new URL(url).searchParams.get('scope') ?? '';
    expect(scope).not.toContain('.write');
    expect(scope).not.toContain('.update');
    expect(scope).not.toContain('payroll');
  });
});
