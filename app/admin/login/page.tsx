'use client';

/**
 * Phase M: Admin Login Page — GCP Identity Platform
 *
 * Admin authentication via Firebase Auth (same as user auth).
 * Firebase ID token is sent to /api/admin/auth/login which verifies
 * the token and checks for admin custom claims or AdminUser DB record.
 *
 * Phase M Migration: Replaces custom email/password auth with Firebase Auth.
 */

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, sendPasswordResetEmail } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase/config';
import { isMFAError, getMFAChallengeFromError, resolveWithTOTP, type MFAChallengeState } from '@/lib/firebase/mfa';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Input } from '@/components/admin/ui/AdminForm';
import { AdminCard } from '@/components/admin/ui/AdminCard';
import { HelpTip } from '@/components/admin/ui/HelpTip';
import { helpContent } from '@/lib/admin/help-content';
import { ADMIN_ROUTES } from '@/lib/admin/constants';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaChallenge, setMfaChallenge] = useState<MFAChallengeState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const auth = getFirebaseAuth();
      if (!auth) {
        throw new Error('Firebase is not configured. Check environment variables.');
      }

      // Step 1: Authenticate with Firebase (GCP Identity Platform)
      let idToken: string;

      if (mfaChallenge) {
        // MFA step 2: resolve with TOTP code using the Firebase MultiFactorResolver
        const hint = mfaChallenge.hints[0]; // Use first available MFA hint
        const credential = await resolveWithTOTP(mfaChallenge.resolver, hint.uid, mfaCode);
        idToken = await credential.user.getIdToken();
      } else {
        // Step 1: Sign in with email/password
        try {
          const credential = await signInWithEmailAndPassword(auth, email, password);
          idToken = await credential.user.getIdToken();
        } catch (firebaseError) {
          // Check if MFA challenge is required
          if (isMFAError(firebaseError)) {
            const challenge = getMFAChallengeFromError(firebaseError);
            if (challenge) {
              setMfaChallenge(challenge);
              return; // Show MFA input
            }
          }
          throw firebaseError;
        }
      }

      // Step 2: Verify admin access via our API (checks custom claims + AdminUser table)
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ firebaseToken: idToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Admin access denied');
      }

      // Step 3: Redirect based on MFA setup status
      if (data.mfaSetupRequired) {
        router.push('/admin/mfa-setup');
      } else {
        router.push(ADMIN_ROUTES.DASHBOARD);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      // Make Firebase error messages more user-friendly
      if (message.includes('auth/invalid-credential') || message.includes('auth/wrong-password')) {
        setError('Invalid email or password');
      } else if (message.includes('auth/user-not-found')) {
        setError('No account found with this email');
      } else if (message.includes('auth/too-many-requests')) {
        setError('Too many login attempts. Please try again later.');
      } else if (message.includes('auth/user-disabled')) {
        setError('This account has been disabled');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError('');

    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase is not configured.');

      const provider = new GoogleAuthProvider();
      const credential = await signInWithPopup(auth, provider);
      const idToken = await credential.user.getIdToken();

      // Verify admin access via our API
      const response = await fetch('/api/admin/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ firebaseToken: idToken }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || 'Admin access denied');
      }

      // Redirect based on MFA setup status
      if (data.mfaSetupRequired) {
        router.push('/admin/mfa-setup');
      } else {
        router.push(ADMIN_ROUTES.DASHBOARD);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      if (message.includes('popup-closed-by-user')) {
        // User closed the popup — not an error
      } else {
        setError(message);
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError('Enter your email address first, then click Forgot Password');
      return;
    }
    setError('');
    try {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error('Firebase is not configured.');
      await sendPasswordResetEmail(auth, email);
      setResetSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email';
      if (message.includes('auth/user-not-found')) {
        setError('No account found with this email');
      } else {
        setError(message);
      }
    }
  };

  const showMfa = mfaChallenge !== null;

  // Fallback for environments without Firebase configured
  if (!isFirebaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">!</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Configuration Required</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY and NEXT_PUBLIC_GCP_PROJECT_ID environment variables.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-2xl">M</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white inline-flex items-center gap-1.5">
            Admin Portal
            <HelpTip content={helpContent.login.intro} align="right" />
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Sign in with your GCP Identity Platform credentials
          </p>
        </div>

        <AdminCard>
          {/* Google Sign-In button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isGoogleLoading || isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {isGoogleLoading ? 'Signing in...' : 'Sign in with Google'}
          </button>

          {/* Divider */}
          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">or sign in with email</span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {resetSent && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400">Password reset email sent. Check your inbox.</p>
              </div>
            )}

            <Input
              label="Email address"
              type="email"
              value={email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              placeholder="admin@monitrax.com.au"
              required
              autoComplete="email"
              disabled={showMfa}
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
              disabled={showMfa}
            />

            {!showMfa && (
              <div className="flex items-center justify-end gap-1">
                <HelpTip content={helpContent.login.forgotPassword} align="right" />
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  Forgot password?
                </button>
              </div>
            )}

            {showMfa && (
              <Input
                label="MFA Code"
                type="text"
                value={mfaCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMfaCode(e.target.value)}
                placeholder="Enter 6-digit code"
                required
                autoComplete="one-time-code"
                maxLength={6}
              />
            )}

            <AdminButton
              type="submit"
              className="w-full"
              isLoading={isLoading}
            >
              {showMfa ? 'Verify MFA' : 'Sign in with email'}
            </AdminButton>
          </form>

          {showMfa && (
            <button
              type="button"
              onClick={() => {
                setMfaChallenge(null);
                setMfaCode('');
              }}
              className="w-full mt-4 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              Use a different account
            </button>
          )}
        </AdminCard>

        {/* Security notice */}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-6">
          This portal is for authorized Monitrax staff only.
          <br />
          Authenticated via GCP Identity Platform. All access is logged and monitored.
        </p>
      </div>
    </div>
  );
}
