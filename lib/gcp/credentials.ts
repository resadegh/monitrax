/**
 * GCP Credentials Helper
 *
 * Centralized credential resolution for all GCP API clients.
 * Reads the same env vars used by the existing GCS integration so all GCP
 * services share a single service account.
 *
 * Env vars (in priority order):
 *   1. GCS_SERVICE_ACCOUNT_KEY — base64-encoded service account JSON (used on Vercel)
 *   2. GOOGLE_APPLICATION_CREDENTIALS — path to JSON file (local dev with gcloud)
 *   3. Falls back to Application Default Credentials (e.g., when running in GCP)
 *
 * Project ID is read from:
 *   1. GCP_PROJECT_ID — preferred
 *   2. GCS_PROJECT_ID — fallback (same as GCS integration)
 */

import { log } from '@/lib/utils/logger';

interface ParsedCredentials {
  projectId: string;
  credentials?: {
    client_email: string;
    private_key: string;
    [key: string]: unknown;
  };
}

let cachedCredentials: ParsedCredentials | null = null;
let credentialsResolveFailed = false;

/**
 * Resolve GCP credentials from environment variables.
 * Returns null if credentials cannot be resolved (e.g., missing env vars).
 */
export function getGCPCredentials(): ParsedCredentials | null {
  if (credentialsResolveFailed) return null;
  if (cachedCredentials) return cachedCredentials;

  try {
    // Get project ID
    const projectId = process.env.GCP_PROJECT_ID || process.env.GCS_PROJECT_ID;
    if (!projectId) {
      log.warn('[GCP Credentials] GCP_PROJECT_ID/GCS_PROJECT_ID not set');
      credentialsResolveFailed = true;
      return null;
    }

    // Try to parse the base64-encoded service account key
    const serviceAccountKey = process.env.GCS_SERVICE_ACCOUNT_KEY;
    if (serviceAccountKey) {
      try {
        const credentials = JSON.parse(
          Buffer.from(serviceAccountKey, 'base64').toString('utf-8')
        );
        cachedCredentials = { projectId, credentials };
        return cachedCredentials;
      } catch (parseError) {
        log.error('[GCP Credentials] Failed to parse GCS_SERVICE_ACCOUNT_KEY', parseError as Error);
      }
    }

    // Fall back to Application Default Credentials (for local dev or GCP runtime)
    log.info('[GCP Credentials] Using Application Default Credentials');
    cachedCredentials = { projectId };
    return cachedCredentials;
  } catch (error) {
    log.error('[GCP Credentials] Resolution failed', error as Error);
    credentialsResolveFailed = true;
    return null;
  }
}

/**
 * Get client options object for a GCP API client library.
 * Returns an object that can be passed to `new Client(options)` calls.
 */
export function getGCPClientOptions(): { projectId?: string; credentials?: object } | null {
  const creds = getGCPCredentials();
  if (!creds) return null;

  const options: { projectId: string; credentials?: object } = {
    projectId: creds.projectId,
  };

  if (creds.credentials) {
    options.credentials = creds.credentials;
  }

  return options;
}

/**
 * Check if GCP credentials are available.
 */
export function hasGCPCredentials(): boolean {
  return getGCPCredentials() !== null;
}

/**
 * Get just the project ID.
 */
export function getGCPProjectId(): string | null {
  return getGCPCredentials()?.projectId || null;
}
