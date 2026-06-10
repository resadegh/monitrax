'use client';

/**
 * Resend-verification page — GCP Identity Platform (2026-06-10).
 *
 * Firebase's client SDK sends verification emails for the SIGNED-IN user
 * only (`sendEmailVerification(currentUser)`), so this page no longer takes
 * a free-text email address (the Phase 05 anonymous resend endpoint backed
 * by the in-memory token store was deleted — it never worked on serverless).
 *
 *   - Signed in + unverified → one-tap resend to the account's address
 *   - Signed in + verified   → nothing to do; CTA to dashboard
 *   - Signed out             → CTA to sign in first
 *
 * Visual chrome unchanged (Phase 48 Deep Cosmos AuthShell).
 */

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { AuthShell, AuthSubmit, AuthError } from '@/components/auth/AuthShell';

export default function ResendVerificationPage() {
  const { firebaseUser, isLoading: authLoading, resendVerificationEmail } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSending(true);

    try {
      await resendVerificationEmail();
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('auth/too-many-requests')) {
        setError('Too many attempts — please wait a few minutes before trying again.');
      } else {
        setError('Failed to send verification email. Please try again.');
      }
    } finally {
      setIsSending(false);
    }
  };

  if (authLoading) {
    return (
      <AuthShell title="Loading…">
        <div className="flex justify-center py-4">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-cosmos-action border-t-transparent" />
        </div>
      </AuthShell>
    );
  }

  if (!firebaseUser) {
    return (
      <AuthShell
        title="Resend verification email"
        subtitle="Sign in first, and we'll send a fresh verification link to your account's email address."
      >
        <Link
          href="/signin"
          className="cosmos-cta inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold"
        >
          Sign in to continue
        </Link>
      </AuthShell>
    );
  }

  if (firebaseUser.emailVerified) {
    return (
      <AuthShell title="You're already verified.">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-cosmos-action/30 bg-cosmos-action/15">
            <svg className="h-6 w-6 text-cosmos-action" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="mb-8 text-sm leading-relaxed text-cosmos-soft">
            <span className="font-medium text-cosmos">{firebaseUser.email}</span> is verified.
            Nothing more to do here.
          </p>
          <Link
            href="/dashboard"
            className="cosmos-cta inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold"
          >
            Go to Dashboard
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (submitted) {
    return (
      <AuthShell title="Check your email.">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-cosmos-action/30 bg-cosmos-action/15">
            <svg className="h-6 w-6 text-cosmos-action" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M3 8v8a2 2 0 002 2h14a2 2 0 002-2V8M3 8l9-5 9 5" />
            </svg>
          </div>
          <p className="mb-8 text-sm leading-relaxed text-cosmos-soft">
            A fresh verification link is on its way to{' '}
            <span className="font-medium text-cosmos">{firebaseUser.email}</span>. Check your
            inbox (and spam folder).
          </p>
          <Link
            href="/verify-email-sent"
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-cosmos-hairline bg-cosmos-surface/50 text-sm font-medium text-cosmos transition-colors hover:bg-cosmos-elevated"
          >
            Back to verification
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Resend verification email"
      subtitle={
        <>
          We&apos;ll send a new verification link to{' '}
          <span className="font-medium text-cosmos">{firebaseUser.email}</span>.
        </>
      }
    >
      {error ? <AuthError>{error}</AuthError> : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        <AuthSubmit isLoading={isSending} loadingLabel="Sending...">
          Send verification email
        </AuthSubmit>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-cosmos-muted transition-colors hover:text-cosmos"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to dashboard
        </Link>
      </div>
    </AuthShell>
  );
}
