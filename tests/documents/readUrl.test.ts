/**
 * Read-URL policy (provider-aware) — the decision that makes keyless GCS work.
 *
 * Pins:
 *   - GCS + a service-account KEY present → native v4 signed URL (GCS provider).
 *   - GCS KEYLESS (no key) → our HMAC streaming route (Monitrax signer), because
 *     keyless WIF credentials cannot sign a v4 URL locally.
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
  it('GCS + key present → native GCS signed URL', async () => {
    process.env[KEY_ENV] = 'base64key';
    gcsGetSignedUrl.mockResolvedValue({ success: true, url: 'https://storage.googleapis.com/signed', expiresAt: new Date() });

    const r = await getDocumentReadUrl(StorageProviderType.GOOGLE_CLOUD_STORAGE, 'users/u1/doc.pdf');

    expect(r.url).toBe('https://storage.googleapis.com/signed');
    expect(gcsGetSignedUrl).toHaveBeenCalledWith('users/u1/doc.pdf');
    expect(monitraxGetSignedUrl).not.toHaveBeenCalled();
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
