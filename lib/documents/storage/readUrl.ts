/**
 * Canonical read-URL policy for stored documents (provider-aware).
 *
 * Produces the browser-fetchable URL a client uses to view/download a document.
 * The policy depends on where the bytes live AND how we authenticate to GCS:
 *
 *   - MONITRAX (DB bytea) → an HMAC-signed URL to our own streaming route
 *     (`/api/documents/download`).
 *   - GCS + a service-account KEY present → a native v4 signed URL (the browser
 *     fetches directly from GCS; signing needs the key's private material).
 *   - GCS KEYLESS (Workload Identity Federation / ADC, no key) → an HMAC URL to
 *     our streaming route. Keyless credentials cannot sign a v4 URL locally (no
 *     private key), so we stream the bytes through our own authenticated route
 *     instead. This is also the better CDR posture: the bytes never leave via a
 *     public signed URL — every read is mediated by our route.
 *   - LOCAL_DRIVE → the local path (client handles it via the File System Access
 *     API; nothing is stored server-side).
 *
 * SSOT for "how do I get a viewable URL for a document?" — used by both the
 * upload responses and `getDocumentDownloadUrl`.
 *
 * @see app/api/documents/download/route.ts (the streaming route that serves the HMAC URLs)
 * @see docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md §B-storage
 */

import { StorageProviderType } from '../types';
import { getMonitraxStorageProvider } from './monitraxProvider';
import { getGoogleCloudStorageProvider } from './googleCloudStorageProvider';

export interface ReadUrlResult {
  success: boolean;
  url?: string;
  expiresAt?: Date;
  error?: string;
}

/** True when a GCS service-account key is configured (native signed URLs work). */
function gcsHasSigningKey(): boolean {
  return !!process.env.GCS_SERVICE_ACCOUNT_KEY;
}

export async function getDocumentReadUrl(
  storageProvider: StorageProviderType | string,
  storagePath: string,
): Promise<ReadUrlResult> {
  // GCS with a signing key → native v4 signed URL (direct to GCS).
  if (storageProvider === StorageProviderType.GOOGLE_CLOUD_STORAGE && gcsHasSigningKey()) {
    const gcs = getGoogleCloudStorageProvider();
    await gcs.initialize();
    const r = await gcs.getSignedUrl(storagePath);
    return { success: r.success, url: r.url, expiresAt: r.expiresAt, error: r.error };
  }

  // LOCAL_DRIVE → the client opens the local path itself.
  if (storageProvider === StorageProviderType.LOCAL_DRIVE) {
    return { success: true, url: storagePath, expiresAt: new Date(Date.now() + 300_000) };
  }

  // MONITRAX or keyless GCS → our HMAC-signed streaming route. The Monitrax
  // provider owns the (provider-agnostic) HMAC signer for `/api/documents/download`.
  const r = await getMonitraxStorageProvider().getSignedUrl(storagePath);
  return { success: r.success, url: r.url, expiresAt: r.expiresAt, error: r.error };
}
