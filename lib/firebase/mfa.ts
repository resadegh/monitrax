/**
 * Firebase MFA (Multi-Factor Authentication) Client Helpers
 *
 * Provides enrollment and sign-in resolution for Firebase Auth MFA.
 * Supports TOTP (Authenticator apps) and Phone (SMS) second factors.
 *
 * GCP Identity Platform must have MFA enabled in the GCP Console:
 *   Authentication → Sign-in method → Multi-factor authentication
 *
 * @see docs/blueprint/PHASE_10_AUTH_AND_SECURITY.md
 */

import {
  multiFactor,
  TotpMultiFactorGenerator,
  TotpSecret,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  getMultiFactorResolver,
  type MultiFactorResolver,
  type MultiFactorInfo,
  type User as FirebaseUser,
  type MultiFactorError,
} from 'firebase/auth';
import { getFirebaseAuth } from './config';

// =============================================================================
// TYPES
// =============================================================================

export interface TOTPEnrollmentResult {
  /** The TOTP secret for QR code generation */
  secret: TotpSecret;
  /** The otpauth:// URI for QR code scanning */
  totpUri: string;
  /** The raw secret key for manual entry */
  secretKey: string;
}

export interface MFAFactorInfo {
  /** Factor UID from Firebase */
  uid: string;
  /** Display name given during enrollment */
  displayName: string | null;
  /** Factor type: 'totp' or 'phone' */
  factorId: string;
  /** Enrollment timestamp */
  enrollmentTime: string;
}

export interface MFAChallengeState {
  /** The multi-factor resolver from the sign-in error */
  resolver: MultiFactorResolver;
  /** Available second factors the user can use */
  hints: MFAFactorInfo[];
  /** Whether a phone verification SMS has been sent */
  phoneVerificationSent: boolean;
  /** Phone verification ID (needed to complete phone MFA) */
  phoneVerificationId?: string;
}

// =============================================================================
// ENROLLMENT — Setup MFA for an already-signed-in user
// =============================================================================

/**
 * Start TOTP MFA enrollment for the current Firebase user.
 * Returns the TOTP secret and URI for QR code display.
 *
 * After scanning the QR code, call `finalizeTOTPEnrollment()` to complete setup.
 */
export async function startTOTPEnrollment(firebaseUser: FirebaseUser): Promise<TOTPEnrollmentResult> {
  const mfaUser = multiFactor(firebaseUser);
  const session = await mfaUser.getSession();
  const secret = await TotpMultiFactorGenerator.generateSecret(session);

  // Generate the otpauth URI for QR code generation
  // accountName = user's email, issuer = app name
  const totpUri = secret.generateQrCodeUrl(
    firebaseUser.email || 'user',
    'Monitrax'
  );

  return {
    secret,
    totpUri,
    secretKey: secret.secretKey,
  };
}

/**
 * Finalize TOTP enrollment by verifying a 6-digit code from the authenticator app.
 * Call this after the user scans the QR code and enters the verification code.
 */
export async function finalizeTOTPEnrollment(
  firebaseUser: FirebaseUser,
  secret: TotpSecret,
  verificationCode: string,
  displayName: string = 'Authenticator App'
): Promise<void> {
  const mfaUser = multiFactor(firebaseUser);
  const assertion = TotpMultiFactorGenerator.assertionForEnrollment(secret, verificationCode);
  await mfaUser.enroll(assertion, displayName);
}

/**
 * Start Phone (SMS) MFA enrollment.
 * Sends a verification SMS to the provided phone number.
 * Returns the verification ID needed for `finalizePhoneEnrollment()`.
 */
export async function startPhoneEnrollment(
  firebaseUser: FirebaseUser,
  phoneNumber: string,
  recaptchaVerifier: import('firebase/auth').ApplicationVerifier
): Promise<string> {
  const mfaUser = multiFactor(firebaseUser);
  const session = await mfaUser.getSession();
  const phoneAuthProvider = new PhoneAuthProvider(getFirebaseAuth()!);

  const verificationId = await phoneAuthProvider.verifyPhoneNumber(
    { phoneNumber, session },
    recaptchaVerifier
  );

  return verificationId;
}

/**
 * Finalize Phone MFA enrollment by verifying the SMS code.
 */
export async function finalizePhoneEnrollment(
  firebaseUser: FirebaseUser,
  verificationId: string,
  verificationCode: string,
  displayName: string = 'Phone SMS'
): Promise<void> {
  const mfaUser = multiFactor(firebaseUser);
  const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
  const assertion = PhoneMultiFactorGenerator.assertion(credential);
  await mfaUser.enroll(assertion, displayName);
}

// =============================================================================
// SIGN-IN RESOLUTION — Handle MFA challenge during login
// =============================================================================

/**
 * Check if a Firebase error is an MFA challenge (user has MFA enrolled).
 * Returns true if the error code is 'auth/multi-factor-auth-required'.
 */
export function isMFAError(error: unknown): error is MultiFactorError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'auth/multi-factor-auth-required'
  );
}

/**
 * Extract the MFA challenge state from a multi-factor-auth-required error.
 * Returns the resolver and available second factor hints.
 */
export function getMFAChallengeFromError(error: MultiFactorError): MFAChallengeState {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth not initialized');

  const resolver = getMultiFactorResolver(auth, error);

  const hints: MFAFactorInfo[] = resolver.hints.map((hint: MultiFactorInfo) => ({
    uid: hint.uid,
    displayName: hint.displayName ?? null,
    factorId: hint.factorId,
    enrollmentTime: hint.enrollmentTime || '',
  }));

  return {
    resolver,
    hints,
    phoneVerificationSent: false,
  };
}

/**
 * Complete MFA sign-in with a TOTP code.
 * Used when the user enters their authenticator app code during the MFA challenge.
 */
export async function resolveWithTOTP(
  resolver: MultiFactorResolver,
  hintUid: string,
  verificationCode: string
): Promise<import('firebase/auth').UserCredential> {
  const hint = resolver.hints.find((h) => h.uid === hintUid);
  if (!hint) throw new Error('MFA hint not found');

  const assertion = TotpMultiFactorGenerator.assertionForSignIn(hintUid, verificationCode);
  return resolver.resolveSignIn(assertion);
}

/**
 * Send an SMS verification code for Phone MFA during sign-in.
 * Returns the verification ID needed for `resolveWithPhone()`.
 */
export async function sendPhoneMFACode(
  resolver: MultiFactorResolver,
  hintIndex: number,
  recaptchaVerifier: import('firebase/auth').ApplicationVerifier
): Promise<string> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error('Firebase Auth not initialized');

  const phoneAuthProvider = new PhoneAuthProvider(auth);
  const hint = resolver.hints[hintIndex];

  const verificationId = await phoneAuthProvider.verifyPhoneNumber(
    { multiFactorHint: hint, session: resolver.session },
    recaptchaVerifier
  );

  return verificationId;
}

/**
 * Complete MFA sign-in with a Phone (SMS) verification code.
 */
export async function resolveWithPhone(
  resolver: MultiFactorResolver,
  verificationId: string,
  verificationCode: string
): Promise<import('firebase/auth').UserCredential> {
  const credential = PhoneAuthProvider.credential(verificationId, verificationCode);
  const assertion = PhoneMultiFactorGenerator.assertion(credential);
  return resolver.resolveSignIn(assertion);
}

// =============================================================================
// MANAGEMENT — List and unenroll MFA factors
// =============================================================================

/**
 * Get the list of enrolled MFA factors for the current Firebase user.
 */
export function getEnrolledFactors(firebaseUser: FirebaseUser): MFAFactorInfo[] {
  const mfaUser = multiFactor(firebaseUser);
  return mfaUser.enrolledFactors.map((factor: MultiFactorInfo) => ({
    uid: factor.uid,
    displayName: factor.displayName ?? null,
    factorId: factor.factorId,
    enrollmentTime: factor.enrollmentTime || '',
  }));
}

/**
 * Unenroll (remove) an MFA factor from the current Firebase user.
 */
export async function unenrollFactor(
  firebaseUser: FirebaseUser,
  factorUid: string
): Promise<void> {
  const mfaUser = multiFactor(firebaseUser);
  const factor = mfaUser.enrolledFactors.find((f: MultiFactorInfo) => f.uid === factorUid);
  if (!factor) throw new Error('MFA factor not found');
  await mfaUser.unenroll(factor);
}
