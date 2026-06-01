/**
 * Identity Platform (Firebase Auth) admin operations — server-side.
 *
 * WHY THIS EXISTS
 * ---------------
 * Monitrax verifies consumer Firebase ID tokens with raw JWKS / `jwt.verify`
 * (see `lib/auth/gcpTokenVerifier.ts`) — it does NOT initialise the
 * `firebase-admin` SDK server-side. So there is no `admin.auth().deleteUser()`
 * available. The right-to-erasure executor (`lib/services/accountDeletion.ts`)
 * still needs to delete the auth identity, otherwise a hard-deleted user whose
 * Firebase identity survives would silently RESURRECT as a fresh empty account
 * on their next login (the GCP provisioning path in `lib/auth/gcpIdentity.ts`
 * recreates a local `User` row for any valid Firebase token).
 *
 * This module fills that gap with the Identity Platform Admin REST API
 * (`identitytoolkit.googleapis.com`), authenticated with the SAME Workload
 * Identity Federation service-account credential the database connector uses
 * (`lib/db.ts`). No new secret, no static key — the SA is impersonated via the
 * per-request Vercel OIDC token (OIDC → STS → IAM Credentials), exactly like
 * the Cloud SQL connector.
 *
 * IAM PREREQUISITE (one-time, console step — see
 * docs/operational/security/02_IAM_AND_PERMISSIONS.md §"Account-deletion executor"):
 *   The impersonated service account (`GCP_SERVICE_ACCOUNT_EMAIL`) MUST be
 *   granted a role that includes `firebaseauth.users.delete` — e.g.
 *   `roles/firebaseauth.admin` (Firebase Authentication Admin). Until that
 *   grant exists the REST call returns 403 and the executor SAFELY ABORTS the
 *   data deletion (it never half-deletes a resurrectable account).
 *
 * SCOPE: only what the executor needs — lookup by email + delete by localId.
 * Do NOT grow this into a general Firebase-admin shim; if more is needed,
 * adopt `firebase-admin` properly and document the trade-off (CLAUDE.md §12.7).
 */

import { log } from '@/lib/utils/logger';

const IDENTITY_TOOLKIT_BASE = 'https://identitytoolkit.googleapis.com/v1';
const ADMIN_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

/**
 * Outcome of an identity-deletion attempt. The executor treats `deleted`,
 * `not_found` and `skipped` as SAFE-TO-PROCEED (no resurrectable identity
 * remains), and `failed` as ABORT (an identity may still exist).
 */
export type IdentityDeletionStatus = 'deleted' | 'not_found' | 'skipped' | 'failed';

export interface IdentityDeletionResult {
  status: IdentityDeletionStatus;
  /** Firebase localIds (UIDs) that were deleted. */
  deletedUids: string[];
  /** Diagnostic message when status === 'failed' or 'skipped'. */
  detail?: string;
}

/** True only when GCP Identity Platform is the configured auth provider. */
function isGcpAuthProvider(): boolean {
  return Boolean(process.env.GCP_PROJECT_ID?.trim());
}

/** True when the WIF impersonation credential is available to mint SA tokens. */
function isWifConfigured(): boolean {
  return (
    process.env.USE_CLOUD_SQL_CONNECTOR === 'true' &&
    Boolean(process.env.GCP_WORKLOAD_IDENTITY_PROVIDER?.trim()) &&
    Boolean(process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim())
  );
}

/**
 * Mint a short-lived OAuth access token for the impersonated service account,
 * scoped for the Identity Platform Admin API. Mirrors the impersonation chain
 * in `lib/db.ts` (OIDC → STS → IAM Credentials generateAccessToken) but with
 * an explicit `cloud-platform` scope so the token is accepted by
 * `identitytoolkit.googleapis.com`.
 */
async function getImpersonatedAccessToken(): Promise<string> {
  const provider = process.env.GCP_WORKLOAD_IDENTITY_PROVIDER?.trim();
  const saEmail = process.env.GCP_SERVICE_ACCOUNT_EMAIL?.trim();
  if (!provider || !saEmail) {
    throw new Error('WIF not configured (GCP_WORKLOAD_IDENTITY_PROVIDER / GCP_SERVICE_ACCOUNT_EMAIL missing)');
  }

  const [{ IdentityPoolClient }, { getVercelOidcToken }] = await Promise.all([
    import('google-auth-library'),
    import('@vercel/oidc'),
  ]);

  const authClient = new IdentityPoolClient({
    type: 'external_account',
    audience: `//iam.googleapis.com/${provider}`,
    subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
    token_url: 'https://sts.googleapis.com/v1/token',
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${saEmail}:generateAccessToken`,
    scopes: [ADMIN_SCOPE],
    subject_token_supplier: {
      getSubjectToken: async () => {
        try {
          return await getVercelOidcToken();
        } catch (err) {
          const cause = err instanceof Error ? err.message : String(err);
          throw new Error(
            `Failed to retrieve Vercel OIDC token (cause: ${cause}). ` +
              `Identity-deletion runs from a Cloud Scheduler-triggered request; ensure ` +
              `OIDC Federation is enabled at the Vercel project level and the handler ` +
              `runs in the Node.js runtime.`,
          );
        }
      },
    },
  });

  const tokenResponse = await authClient.getAccessToken();
  const token = typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token;
  if (!token) {
    throw new Error('IAM auth: getAccessToken() returned no token (SA impersonation chain broken).');
  }
  return token;
}

/** Resolve the Firebase localId(s) (UIDs) for an email. Empty array = none. */
async function lookupUidsByEmail(email: string, token: string, projectId: string): Promise<string[]> {
  const res = await fetch(`${IDENTITY_TOOLKIT_BASE}/projects/${projectId}/accounts:lookup`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: [email] }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`accounts:lookup failed (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json().catch(() => ({}))) as { users?: Array<{ localId?: string }> };
  return (data.users ?? []).map((u) => u.localId).filter((id): id is string => Boolean(id));
}

/** Delete a single Firebase identity by localId (UID). */
async function deleteUid(localId: string, token: string, projectId: string): Promise<void> {
  const res = await fetch(`${IDENTITY_TOOLKIT_BASE}/projects/${projectId}/accounts:delete`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ localId }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`accounts:delete failed for ${localId} (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }
}

/**
 * Delete the Firebase Auth identity (or identities) associated with an email.
 *
 * Returns a status the executor uses to decide whether it is SAFE to proceed
 * with the irreversible data deletion:
 *   - `skipped`   — GCP Identity Platform is not the auth provider for this
 *                   deployment (no GCP_PROJECT_ID). There is no Firebase
 *                   identity to resurrect; safe to proceed.
 *   - `not_found` — no identity matched the email (already deleted); safe.
 *   - `deleted`   — identity removed; safe.
 *   - `failed`    — the API could not be reached or returned an error (e.g. the
 *                   IAM grant is missing → 403). NOT safe — the executor must
 *                   abort and retry on the next scheduled run.
 *
 * Never throws — all failure modes are returned as `status: 'failed'` so the
 * executor can make the abort decision deterministically.
 */
export async function deleteIdentityByEmail(email: string): Promise<IdentityDeletionResult> {
  if (!isGcpAuthProvider()) {
    return { status: 'skipped', deletedUids: [], detail: 'GCP Identity Platform not configured (no GCP_PROJECT_ID)' };
  }
  if (!isWifConfigured()) {
    return {
      status: 'failed',
      deletedUids: [],
      detail:
        'GCP Identity Platform is the auth provider but WIF impersonation is not configured — ' +
        'cannot mint an admin token to delete the identity. Aborting to avoid a resurrectable account.',
    };
  }

  const projectId = process.env.GCP_PROJECT_ID!.trim();

  try {
    const token = await getImpersonatedAccessToken();
    const uids = await lookupUidsByEmail(email, token, projectId);

    if (uids.length === 0) {
      return { status: 'not_found', deletedUids: [] };
    }

    for (const uid of uids) {
      await deleteUid(uid, token, projectId);
    }

    log.info('Firebase identity deleted', { uidCount: uids.length });
    return { status: 'deleted', deletedUids: uids };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    log.error('Firebase identity deletion failed', err as Error);
    return { status: 'failed', deletedUids: [], detail };
  }
}
