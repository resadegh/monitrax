/**
 * GCP Identity Platform - Token Verifier
 *
 * Verifies Firebase/GCP Identity Platform ID tokens server-side
 * using Google's public keys (JWKS). Does NOT require the Firebase Admin SDK.
 *
 * Uses google-auth-library's OAuth2Client to verify ID tokens
 * against Google's public certificates, validating:
 *   - RSA signature
 *   - Token expiry
 *   - Audience (must match GCP project ID)
 *   - Issuer (must be accounts.google.com or GCP Identity Platform)
 *
 * @see https://cloud.google.com/identity-platform/docs/reference/rest/v1/accounts
 */

import { OAuth2Client } from 'google-auth-library';
import { log } from '@/lib/utils/logger';
import type { GCPTokenClaims } from './gcpIdentity';

// =============================================================================
// CONFIGURATION
// =============================================================================

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || '';

/**
 * Valid issuers for GCP Identity Platform / Firebase Auth tokens
 */
const VALID_ISSUERS = [
  `https://securetoken.google.com/${GCP_PROJECT_ID}`,
];

/**
 * Reusable OAuth2Client instance for token verification.
 * Uses Google's published certificates to verify token signatures.
 */
let oauth2Client: OAuth2Client | null = null;

function getOAuth2Client(): OAuth2Client {
  if (!oauth2Client) {
    oauth2Client = new OAuth2Client();
  }
  return oauth2Client;
}

// =============================================================================
// TOKEN VERIFICATION
// =============================================================================

/**
 * Verify a GCP Identity Platform / Firebase ID token.
 *
 * Steps:
 * 1. Decode and verify the JWT signature against Google's public keys
 * 2. Validate the audience matches our GCP project ID
 * 3. Validate the issuer matches GCP Identity Platform
 * 4. Check token is not expired
 * 5. Extract and return standardized claims
 *
 * @param idToken - The raw ID token string from the client
 * @returns Verified token claims or null if verification fails
 */
export async function verifyGCPIdToken(idToken: string): Promise<GCPTokenClaims | null> {
  if (!GCP_PROJECT_ID) {
    log.error('GCP_PROJECT_ID not configured - cannot verify GCP tokens');
    return null;
  }

  if (!idToken || typeof idToken !== 'string') {
    log.warn('Invalid ID token provided to verifier');
    return null;
  }

  try {
    const client = getOAuth2Client();

    // Verify the token signature and decode payload
    const ticket = await client.verifyIdToken({
      idToken,
      audience: GCP_PROJECT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      log.warn('GCP token verification returned no payload');
      return null;
    }

    // Validate issuer
    const issuer = payload.iss;
    if (!issuer || !VALID_ISSUERS.includes(issuer)) {
      log.warn('GCP token has invalid issuer', {
        issuer,
        expected: VALID_ISSUERS,
      });
      return null;
    }

    // Validate required fields
    const uid = payload.sub;
    const email = payload.email;

    if (!uid) {
      log.warn('GCP token missing sub (uid) claim');
      return null;
    }

    if (!email) {
      log.warn('GCP token missing email claim', { uid });
      return null;
    }

    // Extract Firebase-specific claims from the payload
    // Firebase tokens include these in the decoded JWT
    const payloadRecord = payload as unknown as Record<string, unknown>;
    const firebaseClaims = payloadRecord.firebase as
      | { sign_in_provider?: string }
      | undefined;

    const claims: GCPTokenClaims = {
      uid,
      email,
      emailVerified: payload.email_verified ?? false,
      displayName: payload.name || undefined,
      phoneNumber: payloadRecord.phone_number as string | undefined,
      photoURL: payload.picture || undefined,
      signInProvider: firebaseClaims?.sign_in_provider,
      iat: payload.iat ?? 0,
      exp: payload.exp ?? 0,
      aud: typeof payload.aud === 'string' ? payload.aud : GCP_PROJECT_ID,
      iss: issuer,
    };

    log.debug('GCP token verified successfully', {
      uid: claims.uid,
      email: claims.email,
      signInProvider: claims.signInProvider,
    });

    return claims;
  } catch (error) {
    // Differentiate between expected and unexpected errors
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes('Token used too late') ||
      errorMessage.includes('Token used too early') ||
      errorMessage.includes('Invalid token signature') ||
      errorMessage.includes('Wrong recipient')
    ) {
      log.warn('GCP token verification failed (expected)', {
        reason: errorMessage,
      });
    } else {
      log.error('GCP token verification failed (unexpected)', error as Error);
    }

    return null;
  }
}

/**
 * Extract the GCP ID token from a request's Authorization header.
 * Expects the format: "Bearer <id-token>"
 *
 * This is separate from the existing extractTokenFromHeader in lib/auth.ts
 * to avoid coupling GCP token handling with the existing JWT system.
 */
export function extractGCPTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}
