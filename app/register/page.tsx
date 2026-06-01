'use client';

/**
 * Public registration page.
 *
 * Phase 48 PR 6 (2026-05-26): visual chrome rebuilt to dark Deep Cosmos
 * via `AuthShell`. ALL auth + consent logic preserved verbatim:
 *   - `useAuth()` hook + `register()` / `loginWithGoogle()` calls
 *   - Phase 47 consent block — mandatory bundled tick (Terms + Privacy +
 *     AFSL) + optional marketing opt-in (Spam Act unbundling rule, default OFF)
 *   - `acceptedBundle` gates BOTH email/password submit AND OAuth button
 *   - `captureConsent()` POST to `/api/auth/consent` after successful signup
 *     (idempotent server-side; safe to retry on transient failures)
 *   - Password match validation + min-length 8
 *   - Firebase auth error mapping
 *   - OAuth provider availability fetch (legacy)
 *
 * Only the JSX shell + form input vocabulary changed. The Phase 47
 * consent block visual treatment is restyled to match the cosmos
 * palette but the EXACT same fields, labels, and gating behaviour are
 * preserved (CLAUDE.md §13 + Privacy Act APP 5 + Spam Act compliance).
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAuth } from 'firebase/auth';
import {
  AuthShell,
  AuthLabel,
  AuthSubmit,
  AuthGhostButton,
  AuthDivider,
  AuthError,
} from '@/components/auth/AuthShell';
import { AuthPasswordInput } from '@/components/auth/AuthPasswordInput';

interface AvailableProviders {
  google: boolean;
  facebook: boolean;
  apple: boolean;
  microsoft: boolean;
}

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Phase 47 — Signup consent (CLAUDE.md §13, Privacy Act APP 5, Spam Act).
  // Mandatory bundle: Terms + Privacy + AFSL Boundary acknowledgement.
  // Optional: marketing communications (Spam Act requires explicit, unbundled
  // opt-in; default OFF).
  const [acceptedBundle, setAcceptedBundle] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<AvailableProviders>({
    google: false,
    facebook: false,
    apple: false,
    microsoft: false,
  });
  const { register, loginWithGoogle, user, isGCPEnabled } = useAuth();
  const router = useRouter();

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Check which OAuth providers are configured (legacy mode only)
  useEffect(() => {
    if (!isGCPEnabled) {
      fetch('/api/auth/providers')
        .then((res) => res.json())
        .then((data) => {
          if (data.available) {
            setAvailableProviders(data.available);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch providers:', err);
        });
    }
  }, [isGCPEnabled]);

  /**
   * Phase 47 — POST consent to /api/auth/consent immediately after a
   * successful Firebase signup. The Firebase user must exist (currentUser
   * non-null) for this to succeed; the API endpoint is idempotent so a
   * retried call after a network blip is safe.
   */
  const captureConsent = async (consentSource: 'SIGNUP' | 'OAUTH_SIGNUP') => {
    const fbUser = getAuth().currentUser;
    if (!fbUser) {
      // Should not happen — Firebase signup just succeeded — but if it does,
      // surface so the user re-tries rather than silently bypassing consent.
      throw new Error('Authentication state not ready — please retry.');
    }
    const idToken = await fbUser.getIdToken();
    const res = await fetch('/api/auth/consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        termsAccepted: true,
        privacyAccepted: true,
        afslAcknowledged: true,
        marketingOptIn,
        consentSource,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as { error?: { message?: string } }));
      throw new Error(body.error?.message ?? 'Could not record your consent — please retry.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!acceptedBundle) {
      setError('Please confirm you have read and agree to the Terms, Privacy Policy, and AFSL, Credit and Tax Boundary Disclosure.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);

    try {
      await register(email, password, name);
      await captureConsent('SIGNUP');
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError('');

    if (!acceptedBundle) {
      setError('Please confirm you have read and agree to the Terms, Privacy Policy, and AFSL, Credit and Tax Boundary Disclosure.');
      return;
    }

    setIsLoading(true);

    try {
      if (isGCPEnabled) {
        await loginWithGoogle();
        await captureConsent('OAUTH_SIGNUP');
        router.push('/dashboard');
      } else {
        // Legacy: redirect to server-side OAuth.
        // Note: consent capture deferred — the legacy flow doesn't return to
        // this page after OAuth. Migration prompt (PR 2) will catch this case.
        window.location.href = '/api/auth/oauth/google';
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-up failed';
      if (message.includes('auth/popup-closed-by-user')) {
        setError('');
      } else if (message.includes('auth/popup-blocked')) {
        setError('Pop-up was blocked. Please allow pop-ups for this site.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Build your picture."
      title="Create your account"
      subtitle={
        <>
          Already have an account?{' '}
          <Link href="/signin" className="text-cosmos-action transition-colors hover:text-cosmos-action-soft">
            Sign in →
          </Link>
        </>
      }
    >
      {error ? <AuthError>{error}</AuthError> : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <AuthLabel htmlFor="name">Full name</AuthLabel>
          <input
            id="name"
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="name"
            className="cosmos-input"
          />
        </div>

        <div>
          <AuthLabel htmlFor="email">Email address</AuthLabel>
          <input
            id="email"
            type="email"
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="email"
            className="cosmos-input"
          />
        </div>

        <div>
          <AuthLabel htmlFor="password">Password</AuthLabel>
          <AuthPasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            placeholder="At least 8 characters"
            required
            disabled={isLoading}
            autoComplete="new-password"
          />
        </div>

        <div>
          <AuthLabel htmlFor="confirmPassword">Confirm password</AuthLabel>
          <AuthPasswordInput
            id="confirmPassword"
            value={confirmPassword}
            onChange={setConfirmPassword}
            required
            disabled={isLoading}
            autoComplete="new-password"
          />
        </div>

        {/* Phase 47 — Signup consent block. CLAUDE.md §13 + Privacy Act APP 5 +
            Spam Act. Mandatory bundle gates BOTH email/password submit AND
            OAuth button. Marketing opt-in is unbundled per Spam Act, default OFF.
            Visual treatment restyled to cosmos palette; field set + gating
            logic preserved verbatim. */}
        <div className="space-y-3 rounded-xl border border-cosmos-hairline bg-cosmos-surface/40 p-4">
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              id="acceptedBundle"
              checked={acceptedBundle}
              onChange={(e) => setAcceptedBundle(e.target.checked)}
              disabled={isLoading}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded border-cosmos-hairline-strong bg-cosmos-surface/50 text-cosmos-action focus:ring-2 focus:ring-cosmos-action/30 focus:ring-offset-0"
            />
            <span className="text-sm leading-relaxed text-cosmos-soft">
              I have read and agree to Monitrax&apos;s{' '}
              <Link href="/legal/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-cosmos-action underline">
                Terms of Service
              </Link>
              ,{' '}
              <Link href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-cosmos-action underline">
                Privacy Policy
              </Link>
              , and{' '}
              <Link href="/legal/afsl-credit-tax-boundary-disclosure" target="_blank" rel="noopener noreferrer" className="text-cosmos-action underline">
                AFSL, Credit and Tax Boundary Disclosure
              </Link>
              . I understand Monitrax does not hold an AFSL and does not provide personal financial advice.
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              id="marketingOptIn"
              checked={marketingOptIn}
              onChange={(e) => setMarketingOptIn(e.target.checked)}
              disabled={isLoading}
              className="mt-0.5 h-4 w-4 cursor-pointer rounded border-cosmos-hairline-strong bg-cosmos-surface/50 text-cosmos-action focus:ring-2 focus:ring-cosmos-action/30 focus:ring-offset-0"
            />
            <span className="text-sm leading-relaxed text-cosmos-muted">
              Optional — send me occasional emails about new features, tips, and Australian financial updates. You can unsubscribe any time.
            </span>
          </label>
        </div>

        <AuthSubmit isLoading={isLoading} disabled={!acceptedBundle} loadingLabel="Creating account...">
          Create account
        </AuthSubmit>

        {(isGCPEnabled || availableProviders.google) ? (
          <>
            <AuthDivider />
            <AuthGhostButton
              onClick={handleGoogleSignUp}
              disabled={isLoading || !acceptedBundle}
              title={!acceptedBundle ? 'Confirm the legal documents below first' : undefined}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </AuthGhostButton>
          </>
        ) : null}
      </form>
    </AuthShell>
  );
}
