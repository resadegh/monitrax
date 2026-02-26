/**
 * GCP Identity Platform - Token Verifier
 *
 * Verifies Firebase/GCP Identity Platform ID tokens server-side
 * using Google's public keys. Does NOT require the Firebase Admin SDK.
 *
 * Firebase Auth tokens are signed by securetoken@system.gserviceaccount.com
 * and the public keys are published at a well-known endpoint. This module:
 *   - Fetches and caches the public keys (respecting Cache-Control headers)
 *   - Verifies the JWT signature using the correct kid-matched certificate
 *   - Validates audience (must match GCP project ID)
 *   - Validates issuer (must be https://securetoken.google.com/{project-id})
 *   - Checks token expiry and issued-at time
 *
 * @see https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
 */

import jwt from 'jsonwebtoken';
import { log } from '@/lib/utils/logger';
import type { GCPTokenClaims } from './gcpIdentity';

// =============================================================================
// CONFIGURATION
// =============================================================================

const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || '';

/**
 * Firebase Auth public key endpoint.
 * Returns a JSON object mapping key IDs (kid) to X.509 certificates.
 */
const FIREBASE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

/**
 * Valid issuer for Firebase Auth / GCP Identity Platform tokens
 */
const VALID_ISSUER = `https://securetoken.google.com/${GCP_PROJECT_ID}`;

// =============================================================================
// PUBLIC KEY CACHE
// =============================================================================

let cachedCerts: Record<string, string> = {};
let cacheExpiresAt = 0;

/**
 * Fetch Firebase Auth public certificates.
 * Caches based on the max-age from the Cache-Control response header.
 */
async function getFirebaseCerts(): Promise<Record<string, string>> {
  const now = Date.now();

  if (Object.keys(cachedCerts).length > 0 && now < cacheExpiresAt) {
    return cachedCerts;
  }

  const response = await fetch(FIREBASE_CERTS_URL);

  if (!response.ok) {
    throw new Error(`Failed to fetch Firebase certificates: ${response.status}`);
  }

  // Parse cache duration from Cache-Control header
  const cacheControl = response.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAgeSec = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 3600;

  cachedCerts = await response.json();
  cacheExpiresAt = now + maxAgeSec * 1000;

  return cachedCerts;
}

// =============================================================================
// TOKEN VERIFICATION
// =============================================================================

/**
 * Verify a GCP Identity Platform / Firebase Auth ID token.
 *
 * Steps:
 * 1. Decode the JWT header to get the key ID (kid)
 * 2. Fetch the matching public certificate from Google
 * 3. Verify the JWT signature, expiry, audience, and issuer
 * 4. Extract and return standardized claims
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
    // Decode the header to get the key ID (kid)
    const decoded = jwt.decode(idToken, { complete: true });

    if (!decoded || !decoded.header || !decoded.header.kid) {
      log.warn('GCP token missing kid in header');
      return null;
    }

    // Fetch the public certificates
    const certs = await getFirebaseCerts();
    const cert = certs[decoded.header.kid];

    if (!cert) {
      log.warn('No matching certificate found for kid', {
        kid: decoded.header.kid,
        availableKids: Object.keys(certs),
      });
      return null;
    }

    // Verify the token with the matched certificate
    const payload = jwt.verify(idToken, cert, {
      algorithms: ['RS256'],
      audience: GCP_PROJECT_ID,
      issuer: VALID_ISSUER,
    }) as Record<string, unknown>;

    // Validate required fields
    const uid = payload.sub as string | undefined;
    const email = payload.email as string | undefined;

    if (!uid) {
      log.warn('GCP token missing sub (uid) claim');
      return null;
    }

    if (!email) {
      log.warn('GCP token missing email claim', { uid });
      return null;
    }

    // Firebase includes auth_time - ensure it's not in the future
    const authTime = payload.auth_time as number | undefined;
    if (authTime && authTime > Math.floor(Date.now() / 1000)) {
      log.warn('GCP token auth_time is in the future', { authTime });
      return null;
    }

    // Extract Firebase-specific claims
    const firebaseClaims = payload.firebase as
      | { sign_in_provider?: string }
      | undefined;

    const claims: GCPTokenClaims = {
      uid,
      email,
      emailVerified: (payload.email_verified as boolean) ?? false,
      displayName: (payload.name as string) || undefined,
      phoneNumber: (payload.phone_number as string) || undefined,
      photoURL: (payload.picture as string) || undefined,
      signInProvider: firebaseClaims?.sign_in_provider,
      iat: (payload.iat as number) ?? 0,
      exp: (payload.exp as number) ?? 0,
      aud: typeof payload.aud === 'string' ? payload.aud : GCP_PROJECT_ID,
      iss: payload.iss as string,
    };

    log.debug('GCP token verified successfully', {
      uid: claims.uid,
      email: claims.email,
      signInProvider: claims.signInProvider,
    });

    return claims;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (
      errorMessage.includes('jwt expired') ||
      errorMessage.includes('jwt not active') ||
      errorMessage.includes('invalid signature') ||
      errorMessage.includes('jwt audience invalid') ||
      errorMessage.includes('jwt issuer invalid')
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
