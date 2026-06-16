/**
 * Canonical builder for Monitrax's KEYLESS GCP identity on Vercel.
 *
 * Returns a google-auth-library `external_account` (Workload Identity Federation)
 * client that mints short-lived *impersonated* service-account access tokens from
 * the per-request Vercel OIDC token — the SAME passwordless identity the Cloud SQL
 * connector uses in `lib/db.ts`. No static credential ever lives in a runtime env
 * var (CLAUDE.md §13.6 / §12.7). Any GCP SDK that accepts an `authClient` (e.g.
 * `@google-cloud/storage`'s `new Storage({ authClient })`) can authenticate with it.
 *
 * Returns `null` when the WIF env vars are absent (local dev / build), so callers
 * fall back to Application Default Credentials or a service-account key.
 *
 * Requires (non-secret identifiers — neither grants access without the runtime
 * OIDC token that only exists inside a Vercel request context):
 *   - `GCP_WORKLOAD_IDENTITY_PROVIDER` — full WIF provider resource path
 *   - `GCP_SERVICE_ACCOUNT_EMAIL`      — the SA to impersonate
 *
 * NOTE: `lib/db.ts` builds an equivalent `IdentityPoolClient` inline for the Cloud
 * SQL connector. The config here is byte-identical; it is kept as a separate
 * canonical helper so this (new) GCS path does not have to touch the CDR-critical
 * DB auth code. A future PR can have `lib/db.ts` consume this helper too (SSOT).
 *
 * @see lib/db.ts (the Cloud SQL connector's inline equivalent)
 * @see docs/blueprint/PHASE_50_AI_DOCUMENT_ROUTER.md §B-storage
 */

import type { AuthClient } from 'google-auth-library';

/**
 * Build the keyless WIF auth client, or return null if the WIF env vars are not
 * present (so the caller can fall back to ADC / a key).
 */
export async function buildGcpWifAuthClient(): Promise<AuthClient | null> {
  const provider = process.env.GCP_WORKLOAD_IDENTITY_PROVIDER?.trim();
  const saEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim();

  if (!provider || !saEmail) {
    return null;
  }

  const [{ IdentityPoolClient }, { getVercelOidcToken }] = await Promise.all([
    import('google-auth-library'),
    import('@vercel/oidc'),
  ]);

  const client = new IdentityPoolClient({
    type: 'external_account',
    audience: `//iam.googleapis.com/${provider}`,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${saEmail}:generateAccessToken`,
    subject_token_supplier: {
      getSubjectToken: async () => {
        try {
          return await getVercelOidcToken();
        } catch (err) {
          const cause = err instanceof Error ? err.message : String(err);
          throw new Error(
            `Failed to retrieve Vercel OIDC token (cause: ${cause}). ` +
              `Ensure OIDC Federation is enabled at the Vercel project level and the ` +
              `function runs in a request context (Node.js runtime, not middleware, ` +
              `not at module top-level).`,
          );
        }
      },
    },
  });

  return client as unknown as AuthClient;
}

/** Whether the keyless WIF env vars are present (no async build needed to check). */
export function isGcpWifConfigured(): boolean {
  return !!(
    process.env.GCP_WORKLOAD_IDENTITY_PROVIDER?.trim() &&
    process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim()
  );
}
