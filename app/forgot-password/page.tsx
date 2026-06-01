'use client';

/**
 * Public forgot-password page.
 *
 * Was a dead link: `/signin` (and the admin/portal sign-ins) linked to
 * `/forgot-password`, but no route existed → hard 404, so users could not
 * reset their password at all. This page closes that gap.
 *
 * Auth: Firebase `sendPasswordResetEmail` via `useAuth().resetPassword`.
 * Reuses the dark Deep Cosmos `AuthShell` chrome — same vocabulary as
 * `/signin` (this is a functional dead-link target, not a new design surface,
 * so it mirrors the existing auth pages rather than introducing new chrome).
 *
 * Security (CLAUDE.md §13): anti account-enumeration — a successful send and
 * an unknown-email (`auth/user-not-found`) render the SAME neutral confirmation,
 * so the page never reveals whether an email is registered.
 */

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { AuthShell, AuthLabel, AuthSubmit, AuthError, AuthInfo } from '@/components/auth/AuthShell';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      // Anti-enumeration: an unknown email looks identical to success.
      if (message.includes('auth/user-not-found')) {
        setSent(true);
      } else if (message.includes('auth/invalid-email')) {
        setError('Please enter a valid email address.');
      } else if (message.includes('auth/too-many-requests')) {
        setError('Too many attempts. Please try again in a few minutes.');
      } else {
        setError('Something went wrong sending the reset email. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="Forgot your password?"
      title="Reset your password"
      subtitle={
        <>
          Remembered it?{' '}
          <Link href="/signin" className="text-cosmos-action transition-colors hover:text-cosmos-action-soft">
            Sign in →
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="space-y-5">
          <AuthInfo>
            If an account exists for <span className="font-medium">{email}</span>, we&apos;ve sent a
            password reset link. Check your inbox (and your spam folder).
          </AuthInfo>
          <div className="flex flex-col gap-3">
            <Link
              href="/signin"
              className="cosmos-cta inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold"
            >
              Back to sign in
            </Link>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setError('');
              }}
              className="text-sm text-cosmos-soft transition-colors hover:text-cosmos"
            >
              Use a different email
            </button>
          </div>
        </div>
      ) : (
        <>
          {error ? <AuthError>{error}</AuthError> : null}
          <p className="mb-5 text-sm text-cosmos-soft">
            Enter the email address for your account and we&apos;ll send you a link to reset your
            password.
          </p>
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

            <AuthSubmit isLoading={isLoading} loadingLabel="Sending...">
              Send reset link
            </AuthSubmit>
          </form>
        </>
      )}
    </AuthShell>
  );
}
