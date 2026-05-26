'use client';

/**
 * Email-verification landing page (consumes `?token=<verification-token>`).
 *
 * Phase 48 PR 6 (2026-05-26): visual chrome rebuilt to dark Deep Cosmos
 * via `AuthShell`. ALL verification logic preserved verbatim:
 *   - Token extraction from URL search params
 *   - POST to `/api/auth/verify-email`
 *   - Three states: verifying / success / error
 *   - Suspense boundary for `useSearchParams` (Next.js requirement)
 */

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { AuthShell } from '@/components/auth/AuthShell';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setErrorMessage('No verification token provided');
      return;
    }

    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setStatus('success');
        } else {
          setStatus('error');
          setErrorMessage(data.error || 'Verification failed');
        }
      })
      .catch((err) => {
        console.error('Verification error:', err);
        setStatus('error');
        setErrorMessage('An error occurred during verification');
      });
  }, [searchParams]);

  if (status === 'verifying') {
    return (
      <AuthShell title="Verifying your email…">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-cosmos-action border-t-transparent" />
          <p className="text-sm text-cosmos-soft">Please wait while we verify your email address.</p>
        </div>
      </AuthShell>
    );
  }

  if (status === 'success') {
    return (
      <AuthShell title="Email verified.">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-cosmos-action/30 bg-cosmos-action/15">
            <svg className="h-6 w-6 text-cosmos-action" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="mb-8 text-sm leading-relaxed text-cosmos-soft">
            Your email has been verified. You can now access all features.
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

  return (
    <AuthShell title="Verification failed.">
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
          <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="mb-8 text-sm leading-relaxed text-cosmos-soft">{errorMessage}</p>
        <div className="space-y-3">
          <Link
            href="/signin"
            className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-cosmos-hairline bg-cosmos-surface/50 text-sm font-medium text-cosmos transition-colors hover:bg-cosmos-elevated"
          >
            Back to sign in
          </Link>
          <p className="text-sm text-cosmos-muted">
            Need a new verification link?{' '}
            <Link href="/resend-verification" className="text-cosmos-action transition-colors hover:text-cosmos-action-soft">
              Resend email
            </Link>
          </p>
        </div>
      </div>
    </AuthShell>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <AuthShell title="Loading…">
          <div className="flex justify-center py-4">
            <span className="h-10 w-10 animate-spin rounded-full border-2 border-cosmos-action border-t-transparent" />
          </div>
        </AuthShell>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
