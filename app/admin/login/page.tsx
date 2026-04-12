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
import { signInWithEmailAndPassword } from 'firebase/auth';
import { getFirebaseAuth, isFirebaseConfigured } from '@/lib/firebase/config';
import { isMFAError, getMFAChallengeFromError, resolveWithTOTP, type MFAChallengeState } from '@/lib/firebase/mfa';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Input } from '@/components/admin/ui/AdminForm';
import { AdminCard } from '@/components/admin/ui/AdminCard';
import { ADMIN_ROUTES } from '@/lib/admin/constants';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaChallenge, setMfaChallenge] = useState<MFAChallengeState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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

      // Step 3: Redirect to admin dashboard
      router.push(ADMIN_ROUTES.DASHBOARD);
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Admin Portal
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Sign in with your GCP Identity Platform credentials
          </p>
        </div>

        <AdminCard>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
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
              {showMfa ? 'Verify MFA' : 'Sign in'}
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
