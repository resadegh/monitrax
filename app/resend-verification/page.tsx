'use client';

/**
 * Resend-verification page.
 *
 * Phase 48 PR 6 (2026-05-26): visual chrome rebuilt to dark Deep Cosmos
 * via `AuthShell`. ALL logic preserved verbatim:
 *   - POST to `/api/auth/resend-verification`
 *   - Success state ("Check your email") + error mapping
 *   - Privacy-safe success message (doesn't confirm account existence)
 */

import { useState } from 'react';
import Link from 'next/link';
import {
  AuthShell,
  AuthLabel,
  AuthSubmit,
  AuthError,
} from '@/components/auth/AuthShell';

export default function ResendVerificationPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send verification email');
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

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
            If an account exists with <span className="font-medium text-cosmos">{email}</span>, you&apos;ll receive a verification link shortly.
          </p>
          <Link
            href="/signin"
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-cosmos-hairline bg-cosmos-surface/50 text-sm font-medium text-cosmos transition-colors hover:bg-cosmos-elevated"
          >
            Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Resend verification email"
      subtitle="Enter your email address and we'll send you a new verification link."
    >
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

        <AuthSubmit isLoading={isLoading} loadingLabel="Sending...">
          Send verification email
        </AuthSubmit>
      </form>

      <div className="mt-6 text-center">
        <Link
          href="/signin"
          className="inline-flex items-center gap-1 text-sm text-cosmos-muted transition-colors hover:text-cosmos"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
