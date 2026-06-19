/**
 * Canonical read-URL policy for stored documents (provider-aware).
 *
 * Produces the browser-fetchable URL a client uses to view/download a document.
 * Every server-backed read is mediated through our own same-origin streaming
 * route (`/api/documents/download`), regardless of where the bytes live:
 *
 *   - MONITRAX (DB bytea) → HMAC-signed URL to `/api/documents/download`.
 *   - GCS (key OR keyless) → HMAC-signed URL to `/api/documents/download`
 *     (the route downloads the bytes from GCS server-side and re-streams them).
 *   - LOCAL_DRIVE → the local path (client handles it via the File System Access
 *     API; nothing is stored server-side).
 *
 * **Why we no longer hand out native GCS v4 signed URLs (2026-06-19, Reza prod
 * report — My Vault preview showed Chrome's "This content is blocked"):** a
 * native signed URL is a cross-origin `storage.googleapis.com` link. The browser
 * blocks it when it's framed for preview (`<iframe>` → ERR_BLOCKED_BY_RESPONSE),
 * and GCS serves the object with its own stored content-type, so an `<img>`
 * thumbnail of an `application/octet-stream` object renders broken. Streaming
 * through our route fixes both: it sets `Content-Type` from the authoritative DB
 * `mimeType` and `Content-Disposition: inline`, and the bytes are same-origin.
 * It is also the better CDR posture — every read is mediated, the bytes never
 * leave via a public signed URL.
 *
 * SSOT for "how do I get a viewable URL for a document?" — used by both the
 * upload responses and `getDocumentDownloadUrl`.
 *
 * @see app/api/documents/download/route.ts (the streaming route that serves the HMAC URLs)
 * @see docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md §B-storage
 */

import { StorageProviderType } from '../types';
import { getMonitraxStorageProvider } from './monitraxProvider';

export interface ReadUrlResult {
  success: boolean;
  url?: string;
  expiresAt?: Date;
  error?: string;
}

export async function getDocumentReadUrl(
  storageProvider: StorageProviderType | string,
  storagePath: string,
): Promise<ReadUrlResult> {
  // LOCAL_DRIVE → the client opens the local path itself.
  if (storageProvider === StorageProviderType.LOCAL_DRIVE) {
    return { success: true, url: storagePath, expiresAt: new Date(Date.now() + 300_000) };
  }

  // MONITRAX or GCS (key OR keyless) → our HMAC-signed same-origin streaming
  // route. We deliberately do NOT return native GCS signed URLs (see the file
  // header) — they are cross-origin and the browser blocks them when framed for
  // preview. The Monitrax provider owns the (provider-agnostic) HMAC signer; the
  // `/api/documents/download` route resolves the backend from the Document row
  // and streams GCS bytes server-side when needed.
  const r = await getMonitraxStorageProvider().getSignedUrl(storagePath);
  return { success: r.success, url: r.url, expiresAt: r.expiresAt, error: r.error };
}
