/**
 * Read-URL policy (provider-aware) — every server-backed read is mediated
 * through our own same-origin streaming route.
 *
 * Pins (2026-06-19 — after the My Vault "content is blocked" preview fix):
 *   - GCS + a service-account KEY present → our HMAC streaming route (NOT a
 *     native cross-origin GCS signed URL — the browser blocks those when framed
 *     for preview).
 *   - GCS KEYLESS (no key) → our HMAC streaming route.
 *   - LOCAL_DRIVE → the local path verbatim.
 *   - MONITRAX → our HMAC streaming route.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { gcsGetSignedUrl, gcsInitialize, monitraxGetSignedUrl } = vi.hoisted(() => ({
  gcsGetSignedUrl: vi.fn(),
  gcsInitialize: vi.fn().mockResolvedValue(undefined),
  monitraxGetSignedUrl: vi.fn(),
}));

vi.mock('@/lib/documents/storage/googleCloudStorageProvider', () => ({
  getGoogleCloudStorageProvider: () => ({
    initialize: gcsInitialize,
    getSignedUrl: gcsGetSignedUrl,
  }),
}));
vi.mock('@/lib/documents/storage/monitraxProvider', () => ({
  getMonitraxStorageProvider: () => ({ getSignedUrl: monitraxGetSignedUrl }),
}));

import { getDocumentReadUrl } from '@/lib/documents/storage/readUrl';
import { StorageProviderType } from '@/lib/documents/types';

const KEY_ENV = 'GCS_SERVICE_ACCOUNT_KEY';

beforeEach(() => {
  gcsGetSignedUrl.mockReset();
  monitraxGetSignedUrl.mockReset();
  gcsInitialize.mockClear();
  delete process.env[KEY_ENV];
});

describe('getDocumentReadUrl', () => {
  it('GCS + key present → our HMAC streaming route, NOT a native GCS URL', async () => {
    // Even with a signing key we mediate the read through our route: a native
    // GCS signed URL is cross-origin and the browser blocks it when framed for
    // preview (the My Vault "content is blocked" regression, 2026-06-19).
    process.env[KEY_ENV] = 'base64key';
    monitraxGetSignedUrl.mockResolvedValue({ success: true, url: '/api/documents/download?path=x&signature=y', expiresAt: new Date() });

    const r = await getDocumentReadUrl(StorageProviderType.GOOGLE_CLOUD_STORAGE, 'users/u1/doc.pdf');

    expect(r.url).toContain('/api/documents/download');
    expect(monitraxGetSignedUrl).toHaveBeenCalledWith('users/u1/doc.pdf');
    expect(gcsGetSignedUrl).not.toHaveBeenCalled();
  });

  it('GCS keyless (no key) → our HMAC streaming route, NOT a native GCS URL', async () => {
    monitraxGetSignedUrl.mockResolvedValue({ success: true, url: '/api/documents/download?path=x&signature=y', expiresAt: new Date() });

    const r = await getDocumentReadUrl(StorageProviderType.GOOGLE_CLOUD_STORAGE, 'users/u1/doc.pdf');

    expect(r.url).toContain('/api/documents/download');
    expect(monitraxGetSignedUrl).toHaveBeenCalledWith('users/u1/doc.pdf');
    expect(gcsGetSignedUrl).not.toHaveBeenCalled();
  });

  it('LOCAL_DRIVE → returns the local path verbatim', async () => {
    const r = await getDocumentReadUrl(StorageProviderType.LOCAL_DRIVE, '/Users/reza/file.pdf');
    expect(r.success).toBe(true);
    expect(r.url).toBe('/Users/reza/file.pdf');
    expect(gcsGetSignedUrl).not.toHaveBeenCalled();
    expect(monitraxGetSignedUrl).not.toHaveBeenCalled();
  });

  it('MONITRAX → our HMAC streaming route', async () => {
    monitraxGetSignedUrl.mockResolvedValue({ success: true, url: '/api/documents/download?path=z', expiresAt: new Date() });

    const r = await getDocumentReadUrl(StorageProviderType.MONITRAX, 'users/u1/doc.pdf');

    expect(r.url).toContain('/api/documents/download');
    expect(monitraxGetSignedUrl).toHaveBeenCalledWith('users/u1/doc.pdf');
  });
});
