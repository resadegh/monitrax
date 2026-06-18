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

  // E2E ONLY (Phase 4 L4): under the Firebase Auth emulator there are no real
  // GCP credentials. `GCP_PROJECT_ID` is set to a synthetic value
  // (`monitrax-e2e`), which would otherwise make us hand back a credential-less
  // options object (the ADC fall-through below). GCP client libraries
  // (e.g. the Cloud Logging audit sink) then construct successfully but fail
  // ADC resolution ASYNCHRONOUSLY, surfacing an `uncaughtException`
  // ("Could not load the default credentials") that escapes the sink's
  // fire-and-forget `.catch()` and aborts the in-flight request. Treating the
  // emulator env as "no GCP" means no GCP client is ever constructed in E2E.
  // This var is set ONLY in the Playwright CI job — never in prod or Vercel
  // preview — so this is a strict no-op there.
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    credentialsResolveFailed = true;
    return null;
  }

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

    // Vercel keyless (no key, but Workload Identity Federation env present):
    // the bare-ADC fall-through below would hand GCP client libraries a
    // credential-less options object. They construct OK but fail ADC
    // ASYNCHRONOUSLY (no metadata server on Vercel), throwing an
    // uncaughtException ("Could not load the default credentials") that escapes
    // the sinks' fire-and-forget `.catch()` and destabilises in-flight requests.
    // (Same failure #1121 gated for the E2E emulator only — this extends the
    // guard to prod keyless.) Return null so the SECONDARY GCP sinks (Cloud
    // Logging / Monitoring / Error Reporting / Scheduler) no-op; the audit
    // log's Postgres PRIMARY is unaffected. Making those sinks authenticate via
    // keyless WIF is a follow-up.
    if (
      !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
      process.env.GCP_WORKLOAD_IDENTITY_PROVIDER &&
      process.env.GCP_SERVICE_ACCOUNT_EMAIL
    ) {
      log.info('[GCP Credentials] No key + keyless WIF env — GCP client sinks no-op (avoids ADC uncaughtException)');
      credentialsResolveFailed = true;
      return null;
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
