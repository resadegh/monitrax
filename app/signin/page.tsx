'use client';

/**
 * Public sign-in page.
 *
 * Phase 48 PR 6 (2026-05-26): visual chrome rebuilt to dark Deep Cosmos
 * via `AuthShell`. ALL auth logic preserved verbatim:
 *   - `useAuth()` hook + `login()` / `loginWithGoogle()` calls
 *   - MFA challenge flow (`mfaChallenge` from AuthContext)
 *   - Session-expired query param handling (`?reason=session_expired`)
 *   - `?next=` redirect honour after auth
 *   - OAuth provider availability fetch (`/api/auth/providers` legacy)
 *   - Firebase auth error mapping
 *   - Loading + error states
 *
 * Only the JSX shell + form input vocabulary changed. The shadcn
 * `<Input>` / `<Label>` / `<Checkbox>` / `<Button>` are NOT used here
 * anymore — they're light-theme internal-app components. The dark
 * auth surfaces use native HTML elements styled via the `cosmos-input`
 * utility class + the shared `AuthShell` primitives.
 */

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  AuthShell,
  AuthLabel,
  AuthSubmit,
  AuthGhostButton,
  AuthDivider,
  AuthError,
  AuthInfo,
} from '@/components/auth/AuthShell';

interface AvailableProviders {
  google: boolean;
  facebook: boolean;
  apple: boolean;
  microsoft: boolean;
}

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableProviders, setAvailableProviders] = useState<AvailableProviders>({
    google: false,
    facebook: false,
    apple: false,
    microsoft: false,
  });
  const { login, loginWithGoogle, user, isGCPEnabled, mfaChallenge, token } = useAuth();
  const router = useRouter();
  // Read query params via window directly to avoid Next.js's CSR-bailout
  // that `useSearchParams()` would force; we're already a client component.
  const [sessionExpired, setSessionExpired] = useState(false);
  const [nextPath, setNextPath] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const sp = new URLSearchParams(window.location.search);
    setSessionExpired(sp.get('reason') === 'session_expired');
    setNextPath(sp.get('next'));
  }, []);

  // Redirect if already authenticated (including after MFA resolution).
  // Honour `?next=` so the user lands back where they were when their
  // session expired.
  useEffect(() => {
    if ((user || token) && !mfaChallenge) {
      router.push(nextPath || '/dashboard');
    }
  }, [user, token, mfaChallenge, router, nextPath]);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      // Navigation happens via useEffect when token is set (handles MFA flow too)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Incorrect email or password';
      if (message.includes('auth/invalid-credential') || message.includes('auth/wrong-password')) {
        setError('Incorrect email or password');
      } else if (message.includes('auth/user-not-found')) {
        setError('No account found with this email');
      } else if (message.includes('auth/too-many-requests')) {
        setError('Too many failed attempts. Please try again later.');
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsLoading(true);

    try {
      if (isGCPEnabled) {
        await loginWithGoogle();
        // Navigation happens via useEffect when token is set (handles MFA flow too)
      } else {
        window.location.href = '/api/auth/oauth/google';
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed';
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
      eyebrow="Welcome back."
      title="Sign in to your account"
      subtitle={
        <>
          Or{' '}
          <Link href="/register" className="text-cosmos-action transition-colors hover:text-cosmos-action-soft">
            create an account →
          </Link>
        </>
      }
    >
      {sessionExpired && !error ? (
        <AuthInfo>Your session expired for security. Please sign in again to continue.</AuthInfo>
      ) : null}

      {error ? <AuthError>{error}</AuthError> : null}

      <form onSubmit={handleSubmit} className="space-y-5">
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
          <input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
            autoComplete="current-password"
            className="cosmos-input"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="group flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading}
              className="h-4 w-4 cursor-pointer rounded border-cosmos-hairline-strong bg-cosmos-surface/50 text-cosmos-action focus:ring-2 focus:ring-cosmos-action/30 focus:ring-offset-0"
            />
            <span className="text-sm text-cosmos-soft transition-colors group-hover:text-cosmos">
              Keep me signed in
            </span>
          </label>
          <Link
            href="/forgot-password"
            className="text-sm font-medium text-cosmos-action transition-colors hover:text-cosmos-action-soft"
          >
            Forgot password?
          </Link>
        </div>

        <AuthSubmit isLoading={isLoading} loadingLabel="Signing in...">
          Sign in
        </AuthSubmit>

        {(isGCPEnabled || availableProviders.google) ? (
          <>
            <AuthDivider />
            <AuthGhostButton onClick={handleGoogleSignIn} disabled={isLoading}>
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
