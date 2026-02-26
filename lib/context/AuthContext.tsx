'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  onAuthStateChanged,
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
  type MFAFactorInfo,
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Sync a Firebase user to the Monitrax backend.
 * Sends the GCP ID token to /api/auth/gcp/sync, which verifies it
 * and returns a Monitrax JWT + user data.
 */
async function syncFirebaseUser(firebaseUser: FirebaseUser): Promise<{ token: string; user: User }> {
  const idToken = await firebaseUser.getIdToken();

  const response = await fetch('/api/auth/gcp/sync', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to sync with server');
  }

  const data = await response.json();

  return {
    token: data.data.token,
    user: {
      id: data.data.userId,
      email: data.data.email,
      name: data.data.name || data.data.email.split('@')[0],
      role: 'OWNER', // Default role for new users; server sets actual role
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [mfaChallenge, setMFAChallenge] = useState<MFAChallengeState | null>(null);
  const gcpEnabled = isFirebaseConfigured();

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  // Track Firebase auth state so firebaseUser stays current (needed for MFA enrollment)
  useEffect(() => {
    if (!gcpEnabled) return;
    const auth = getFirebaseAuth();
    if (!auth) return;

    const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
    });
    return unsubscribe;
  }, [gcpEnabled]);

  /**
   * Helper to persist auth state after successful login/register
   */
  const persistAuth = (authToken: string, authUser: User) => {
    setToken(authToken);
    setUser(authUser);
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(authUser));
  };

  /**
   * Handle a successful Firebase credential (post sign-in or post MFA resolution).
   * Syncs with the Monitrax backend and persists the session.
   */
  const handleFirebaseCredential = async (credential: import('firebase/auth').UserCredential) => {
    const result = await syncFirebaseUser(credential.user);
    persistAuth(result.token, result.user);
    setMFAChallenge(null);
  };

  /**
   * Handle a Firebase auth error. If it's an MFA challenge, capture it.
   * Otherwise, re-throw.
   */
  const handleFirebaseAuthError = (error: unknown): void => {
    if (isMFAError(error)) {
      const challenge = getMFAChallengeFromError(error);
      setMFAChallenge(challenge);
      // Don't throw — the caller should check mfaChallenge state
      return;
    }
    throw error;
  };

  /**
   * Login with email/password.
   * Uses Firebase Auth if GCP Identity Platform is configured,
   * otherwise falls back to the legacy Monitrax API.
   *
   * If the user has MFA enrolled, this will set mfaChallenge instead of completing login.
   */
  const login = async (email: string, password: string) => {
    if (gcpEnabled) {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase Auth not initialized');

      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        await handleFirebaseCredential(credential);
      } catch (error) {
        handleFirebaseAuthError(error);
      }
      return;
    }

    // Legacy fallback: direct API login
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      let errorMessage = errorData.error || 'Login failed';
      if (errorData.remainingAttempts !== undefined) {
        errorMessage += ` (${errorData.remainingAttempts} attempts remaining)`;
      }
      throw new Error(errorMessage);
    }

    const data = await response.json();
    persistAuth(data.token, data.user);
  };

  /**
   * Login with Google via Firebase Auth popup.
   * Only available when GCP Identity Platform is configured.
   *
   * If the user has MFA enrolled, this will set mfaChallenge instead of completing login.
   */
  const loginWithGoogle = async () => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error('Google sign-in is not configured');

    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');

    try {
      const credential = await signInWithPopup(auth, provider);
      await handleFirebaseCredential(credential);
    } catch (error) {
      handleFirebaseAuthError(error);
    }
  };

  /**
   * Register a new account with email/password.
   * Uses Firebase Auth if GCP Identity Platform is configured,
   * otherwise falls back to the legacy Monitrax API.
   */
  const register = async (email: string, password: string, name: string) => {
    if (gcpEnabled) {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase Auth not initialized');

      const credential = await createUserWithEmailAndPassword(auth, email, password);
      const result = await syncFirebaseUser(credential.user);
      // The sync endpoint creates the user with the display name from the token,
      // but we can update the name to what the user provided
      result.user.name = name;
      persistAuth(result.token, result.user);
      return;
    }

    // Legacy fallback: direct API register
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Registration failed');
    }

    const data = await response.json();
    persistAuth(data.token, data.user);
  };

  // ==========================================================================
  // MFA Challenge Resolution
  // ==========================================================================

  /**
   * Complete MFA with a TOTP code from authenticator app.
   */
  const resolveMFAWithTOTP = useCallback(async (hintUid: string, code: string) => {
    if (!mfaChallenge) throw new Error('No MFA challenge in progress');
    const credential = await resolveWithTOTP(mfaChallenge.resolver, hintUid, code);
    await handleFirebaseCredential(credential);
  }, [mfaChallenge]);

  /**
   * Send a phone verification SMS for MFA challenge.
   */
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

  /**
   * Complete MFA with a phone SMS code.
   */
  const resolveMFAWithPhone = useCallback(async (code: string) => {
    if (!mfaChallenge?.phoneVerificationId) throw new Error('No phone verification in progress');
    const credential = await resolveWithPhone(
      mfaChallenge.resolver,
      mfaChallenge.phoneVerificationId,
      code
    );
    await handleFirebaseCredential(credential);
  }, [mfaChallenge]);

  /**
   * Cancel the current MFA challenge (go back to login form).
   */
  const cancelMFAChallenge = useCallback(() => {
    setMFAChallenge(null);
  }, []);

  /**
   * Logout — clears both Firebase and local state
   */
  const logout = () => {
    // Sign out from Firebase if configured
    if (gcpEnabled) {
      const auth = getFirebaseAuth();
      if (auth) {
        firebaseSignOut(auth).catch(() => {
          // Silent fail — local state is cleared regardless
        });
      }
    }

    setToken(null);
    setUser(null);
    setMFAChallenge(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        loginWithGoogle,
        register,
        logout,
        isLoading,
        isGCPEnabled: gcpEnabled,
        firebaseUser,
        mfaChallenge,
        resolveMFAWithTOTP,
        sendMFAPhoneCode,
        resolveMFAWithPhone,
        cancelMFAChallenge,
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
