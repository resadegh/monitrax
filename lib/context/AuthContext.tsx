'use client';

/**
 * Authentication Context — GCP Identity Platform
 *
 * Uses Firebase Auth SDK as the sole authentication provider.
 * Firebase ID tokens are sent directly to API routes (no Monitrax JWT).
 * Token refresh is handled automatically by the Firebase SDK.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onIdTokenChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase/config';
import {
  isMFAError,
  getMFAChallengeFromError,
  resolveWithTOTP,
  resolveWithPhone,
  sendPhoneMFACode,
  type MFAChallengeState,
} from '@/lib/firebase/mfa';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isGCPEnabled: boolean;
  /** Current Firebase user (needed for MFA enrollment in settings) */
  firebaseUser: FirebaseUser | null;
  /** MFA challenge state — non-null when login requires a second factor */
  mfaChallenge: MFAChallengeState | null;
  /** Complete MFA sign-in with a TOTP code */
  resolveMFAWithTOTP: (hintUid: string, code: string) => Promise<void>;
  /** Send SMS for phone MFA during sign-in challenge */
  sendMFAPhoneCode: (hintIndex: number, recaptchaVerifier: import('firebase/auth').ApplicationVerifier) => Promise<void>;
  /** Complete MFA sign-in with a phone SMS code */
  resolveMFAWithPhone: (code: string) => Promise<void>;
  /** Cancel the current MFA challenge */
  cancelMFAChallenge: () => void;
  /** Re-send the Firebase email-verification link to the signed-in user */
  resendVerificationEmail: () => Promise<void>;
  /**
   * Re-check verification after the user clicks the emailed link: reloads the
   * Firebase user, force-refreshes the ID token so `email_verified` lands in
   * the live claim (the server gates read the claim), and trues-up the DB row.
   * Returns true when the email is now verified.
   */
  confirmEmailVerified: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Fetch user profile from the Monitrax API using the Firebase ID token.
 * The server verifies the GCP token directly and auto-syncs the user.
 */
async function fetchUserProfile(idToken: string): Promise<User> {
  const response = await fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${idToken}` },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user profile (status ${response.status})`);
  }

  const data = await response.json();
  return {
    id: data.user?.id || data.data?.userId || '',
    email: data.user?.email || data.data?.email || '',
    name: data.user?.name || data.data?.name || '',
    role: data.user?.role || data.data?.role || 'OWNER',
  };
}

/**
 * Fetch the user profile with retry + exponential backoff.
 * Guards against transient /api/auth/me failures that would otherwise
 * leave the dashboard stuck on "Loading..." (see DashboardLayout's
 * `isLoading || (token && !user)` check).
 */
async function fetchUserProfileWithRetry(
  idToken: string,
  maxAttempts = 3,
): Promise<User> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fetchUserProfile(idToken);
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        // 400ms, 1200ms
        await new Promise((r) => setTimeout(r, 400 * attempt * attempt));
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('Failed to fetch user profile');
}

/**
 * Build a minimal User object from the Firebase user's token claims.
 * Used as a last-resort fallback so the dashboard always renders once
 * Firebase has a valid session, even if /api/auth/me is temporarily down.
 * Subsequent API calls still carry the real token, so permission checks
 * on the server continue to work normally.
 */
async function buildFallbackUserFromFirebase(
  fbUser: FirebaseUser,
): Promise<User> {
  // Read the decoded ID token claims (client-side — not a security boundary)
  // so we can pick up the Monitrax role claim if one was set via custom claims.
  let roleFromClaims: string | undefined;
  try {
    const result = await fbUser.getIdTokenResult();
    const claims = result.claims as Record<string, unknown>;
    if (typeof claims.role === 'string') {
      roleFromClaims = claims.role;
    } else if (typeof claims.monitrax_role === 'string') {
      roleFromClaims = claims.monitrax_role;
    }
  } catch {
    // ignore — fall through to default role
  }

  return {
    id: fbUser.uid,
    email: fbUser.email || '',
    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
    role: roleFromClaims || 'OWNER',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mfaChallenge, setMFAChallenge] = useState<MFAChallengeState | null>(null);
  const gcpEnabled = isFirebaseConfigured();
  const profileFetchedRef = useRef(false);

  // Listen for Firebase auth state and token refresh.
  // This is the single source of truth for authentication.
  useEffect(() => {
    if (!gcpEnabled) {
      setIsLoading(false);
      return;
    }

    const auth = getFirebaseAuth();
    if (!auth) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = onIdTokenChanged(auth, async (fbUser) => {
      if (fbUser) {
        // User is signed in — get the ID token
        const idToken = await fbUser.getIdToken();
        setFirebaseUser(fbUser);
        setToken(idToken);

        // Fetch user profile on initial sign-in (not on every token refresh).
        // Retry + Firebase-claims fallback ensures the dashboard never gets
        // stuck on "Loading..." when /api/auth/me is transiently unavailable
        // (DashboardLayout gates render on `token && !user`).
        if (!profileFetchedRef.current) {
          try {
            const profile = await fetchUserProfileWithRetry(idToken);
            setUser(profile);
            profileFetchedRef.current = true;
          } catch (err) {
            console.error(
              'Failed to fetch user profile after retries — falling back to Firebase claims:',
              err,
            );
            try {
              const fallback = await buildFallbackUserFromFirebase(fbUser);
              setUser(fallback);
              profileFetchedRef.current = true;
            } catch (fallbackErr) {
              console.error(
                'Fallback user construction also failed:',
                fallbackErr,
              );
              // Last resort: sign the user out so they land on /signin
              // rather than a frozen loading spinner.
              try {
                await firebaseSignOut(auth);
              } catch {
                // ignore
              }
            }
          }
        }
      } else {
        // User is signed out
        setFirebaseUser(null);
        setToken(null);
        setUser(null);
        profileFetchedRef.current = false;
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, [gcpEnabled]);

  /**
   * Handle a successful Firebase sign-in.
   * Gets the ID token and fetches the user profile from the server.
   */
  const handleSignIn = async (fbUser: FirebaseUser) => {
    const idToken = await fbUser.getIdToken();
    setFirebaseUser(fbUser);
    setToken(idToken);
    setMFAChallenge(null);

    try {
      const profile = await fetchUserProfileWithRetry(idToken);
      setUser(profile);
    } catch (err) {
      console.error(
        'Profile fetch failed on sign-in — using Firebase claims fallback:',
        err,
      );
      const fallback = await buildFallbackUserFromFirebase(fbUser);
      setUser(fallback);
    }
    profileFetchedRef.current = true;
  };

  /**
   * Handle a Firebase auth error. If it's an MFA challenge, capture it.
   * Otherwise, re-throw.
   */
  const handleFirebaseAuthError = (error: unknown): void => {
    if (isMFAError(error)) {
      const challenge = getMFAChallengeFromError(error);
      setMFAChallenge(challenge);
      return;
    }
    throw error;
  };

  /**
   * Login with email/password via Firebase Auth.
   * If the user has MFA enrolled, this sets mfaChallenge instead of completing login.
   */
  const login = async (email: string, password: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Authentication not configured');

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await handleSignIn(credential.user);
    } catch (error) {
      handleFirebaseAuthError(error);
    }
  };

  /**
   * Login with Google via Firebase Auth popup.
   * If the user has MFA enrolled, this sets mfaChallenge instead of completing login.
   */
  const loginWithGoogle = async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Google sign-in is not configured');

    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');

    try {
      const credential = await signInWithPopup(auth, provider);
      await handleSignIn(credential.user);
    } catch (error) {
      handleFirebaseAuthError(error);
    }
  };

  /**
   * Register a new account with email/password via Firebase Auth.
   * Sets the display name on the Firebase profile so the server picks it up.
   */
  const register = async (email: string, password: string, name: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Authentication not configured');

    const credential = await createUserWithEmailAndPassword(auth, email, password);

    // Set the display name on the Firebase user profile
    // so the server-side sync picks up the correct name
    await updateProfile(credential.user, { displayName: name });

    // Send the GCP Identity Platform verification email (2026-06-10).
    // Best-effort: a failed send must never fail the signup itself — the
    // user can re-send from /verify-email-sent or the dashboard banner.
    try {
      await sendEmailVerification(credential.user, {
        url: `${window.location.origin}/dashboard`,
      });
    } catch (err) {
      console.error('Verification email send failed (user can resend):', err);
    }

    // Force token refresh to include the updated profile
    await credential.user.getIdToken(true);

    await handleSignIn(credential.user);
  };

  // Send a Firebase password-reset email. Errors propagate raw (the caller
  // maps the Firebase code) so the page can avoid account-enumeration leakage
  // by treating `auth/user-not-found` the same as success.
  const resetPassword = async (email: string) => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Authentication not configured');
    await sendPasswordResetEmail(auth, email);
  };

  // ==========================================================================
  // MFA Challenge Resolution
  // ==========================================================================

  const resolveMFAWithTOTP = useCallback(async (hintUid: string, code: string) => {
    if (!mfaChallenge) throw new Error('No MFA challenge in progress');
    const credential = await resolveWithTOTP(mfaChallenge.resolver, hintUid, code);
    await handleSignIn(credential.user);
  }, [mfaChallenge]);

  const sendMFAPhoneCode = useCallback(async (
    hintIndex: number,
    recaptchaVerifier: import('firebase/auth').ApplicationVerifier
  ) => {
    if (!mfaChallenge) throw new Error('No MFA challenge in progress');
    const verificationId = await sendPhoneMFACode(
      mfaChallenge.resolver,
      hintIndex,
      recaptchaVerifier
    );
    setMFAChallenge({
      ...mfaChallenge,
      phoneVerificationSent: true,
      phoneVerificationId: verificationId,
    });
  }, [mfaChallenge]);

  const resolveMFAWithPhone = useCallback(async (code: string) => {
    if (!mfaChallenge?.phoneVerificationId) throw new Error('No phone verification in progress');
    const credential = await resolveWithPhone(
      mfaChallenge.resolver,
      mfaChallenge.phoneVerificationId,
      code
    );
    await handleSignIn(credential.user);
  }, [mfaChallenge]);

  const cancelMFAChallenge = useCallback(() => {
    setMFAChallenge(null);
  }, []);

  // ==========================================================================
  // Email Verification (GCP Identity Platform — 2026-06-10)
  // ==========================================================================

  const resendVerificationEmail = useCallback(async () => {
    const auth = getFirebaseAuth();
    const fbUser = auth?.currentUser;
    if (!fbUser) throw new Error('You need to be signed in to resend the verification email.');
    await sendEmailVerification(fbUser, {
      url: `${window.location.origin}/dashboard`,
    });
  }, []);

  const confirmEmailVerified = useCallback(async (): Promise<boolean> => {
    const auth = getFirebaseAuth();
    const fbUser = auth?.currentUser;
    if (!fbUser) return false;

    // Pull the latest account state from Firebase — emailVerified flips
    // server-side when the user clicks the emailed link.
    await fbUser.reload();
    if (!fbUser.emailVerified) return false;

    // Force-refresh the ID token so `email_verified` lands in the live claim.
    // Server-side gates (withMFARequired / withActiveConsent) read the claim,
    // so without this refresh a just-verified user would still be blocked.
    const freshToken = await fbUser.getIdToken(true);
    setToken(freshToken);

    // True-up the DB bookkeeping row (fire-and-forget — the claim is the SSOT).
    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { Authorization: `Bearer ${freshToken}` },
    }).catch(() => {});

    return true;
  }, []);

  /**
   * Logout — clears Firebase session
   */
  const logout = () => {
    const auth = getFirebaseAuth();
    if (auth) {
      firebaseSignOut(auth).catch(() => {
        // Silent fail — state is cleared by onIdTokenChanged listener
      });
    }

    setToken(null);
    setUser(null);
    setFirebaseUser(null);
    setMFAChallenge(null);
    profileFetchedRef.current = false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        loginWithGoogle,
        register,
        resetPassword,
        logout,
        isLoading,
        isGCPEnabled: gcpEnabled,
        firebaseUser,
        mfaChallenge,
        resolveMFAWithTOTP,
        sendMFAPhoneCode,
        resolveMFAWithPhone,
        cancelMFAChallenge,
        resendVerificationEmail,
        confirmEmailVerified,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
