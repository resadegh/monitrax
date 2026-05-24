'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { getAuth } from 'firebase/auth';

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
      setError('Please confirm you have read and agree to the Terms, Privacy Policy, and AFSL Boundary Disclosure.');
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
      setError('Please confirm you have read and agree to the Terms, Privacy Policy, and AFSL Boundary Disclosure.');
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
    <div className="min-h-screen flex">
      {/* Left side - Branding (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary/10 to-primary/5 items-center justify-center p-12">
        <div className="max-w-md">
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <span className="text-xl font-bold text-primary-foreground">M</span>
            </div>
            <span className="text-2xl font-bold">Monitrax</span>
          </Link>
          <h1 className="text-3xl font-bold mb-4">
            Start building your wealth today.
          </h1>
          <p className="text-muted-foreground text-lg">
            Track properties, loans, investments and cash in one place.
            Make smarter decisions with Australian-aware forecasts.
          </p>
        </div>
      </div>

      {/* Right side - Registration form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <span className="text-lg font-bold text-primary-foreground">M</span>
              </div>
              <span className="text-xl font-bold">Monitrax</span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold">Create your account</h2>
            <p className="text-muted-foreground mt-2">
              Already have an account?{' '}
              <Link href="/signin" className="text-primary hover:underline font-medium">
                Sign in
              </Link>
            </p>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          {/* OAuth buttons */}
          {(isGCPEnabled || availableProviders.google) && (
            <Button
              type="button"
              variant="outline"
              className="w-full mb-4"
              onClick={handleGoogleSignUp}
              disabled={isLoading || !acceptedBundle}
              title={!acceptedBundle ? 'Confirm the legal documents below first' : undefined}
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign up with Google
            </Button>
          )}

          {(isGCPEnabled || availableProviders.google || availableProviders.facebook) && (
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-background text-muted-foreground">or</span>
              </div>
            </div>
          )}

          {/* Email/password form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {/* Phase 47 — Signup consent block (CLAUDE.md §13, Privacy Act APP 5, Spam Act).
              * Mandatory bundle: gates BOTH the email/password submit AND the OAuth button above.
              * Optional marketing opt-in: separate tick (Spam Act unbundling rule), default OFF.
              * Acceptance is captured server-side via POST /api/auth/consent (audit-trailed).
              */}
            <div className="space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  id="acceptedBundle"
                  checked={acceptedBundle}
                  onCheckedChange={(v) => setAcceptedBundle(v === true)}
                  disabled={isLoading}
                  className="mt-0.5"
                />
                <span className="text-sm text-stone-700 leading-relaxed">
                  I have read and agree to Monitrax's{' '}
                  <Link href="/legal/terms-of-service" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Terms of Service
                  </Link>
                  ,{' '}
                  <Link href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    Privacy Policy
                  </Link>
                  , and{' '}
                  <Link href="/legal/afsl-boundary-disclosure" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                    AFSL Boundary Disclosure
                  </Link>
                  . I understand Monitrax does not hold an AFSL and does not provide personal financial advice.
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <Checkbox
                  id="marketingOptIn"
                  checked={marketingOptIn}
                  onCheckedChange={(v) => setMarketingOptIn(v === true)}
                  disabled={isLoading}
                  className="mt-0.5"
                />
                <span className="text-sm text-stone-600 leading-relaxed">
                  Optional — send me occasional emails about new features, tips, and Australian financial updates. You can unsubscribe any time.
                </span>
              </label>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || !acceptedBundle}>
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Creating account...
                </>
              ) : (
                'Create account'
              )}
            </Button>
          </form>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            Your information is collected and handled in accordance with our{' '}
            <Link href="/legal/privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Privacy Policy
            </Link>{' '}
            (Privacy Act 1988 APPs + CDR Privacy Safeguards where applicable).
          </p>
        </div>
      </div>
    </div>
  );
}
