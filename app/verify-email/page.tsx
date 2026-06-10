'use client';

/**
 * Email-verification landing page — GCP Identity Platform (2026-06-10).
 *
 * Two entry shapes, both from the Firebase verification email:
 *   1. Custom action URL: `?mode=verifyEmail&oobCode=<code>` — we apply the
 *      action code client-side via `applyActionCode` (Firebase SDK).
 *   2. Continue URL: the user verified on Firebase's hosted action handler
 *      and clicked "Continue" — no oobCode present; if a session exists we
 *      confirm via `confirmEmailVerified()` (reload + forced token refresh).
 *
 * After a successful apply, `confirmEmailVerified()` force-refreshes the ID
 * token (server gates read the live `email_verified` claim) and trues-up
 * the DB row via POST /api/auth/verify-email.
 *
 * Replaces the Phase 05 `?token=` flow whose in-memory store never worked
 * on serverless. Visual chrome unchanged (Phase 48 Deep Cosmos AuthShell).
 */

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { applyActionCode } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/config';
import { useAuth } from '@/lib/context/AuthContext';
import { AuthShell } from '@/components/auth/AuthShell';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { confirmEmailVerified } = useAuth();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const oobCode = searchParams.get('oobCode');
    const mode = searchParams.get('mode');

    const run = async () => {
      const auth = getFirebaseAuth();
      if (!auth) {
        setStatus('error');
        setErrorMessage('Authentication is not configured');
        return;
      }

      try {
        if (oobCode && (!mode || mode === 'verifyEmail')) {
          // Entry shape 1 — apply the action code ourselves. Works whether
          // or not the user is signed in in this browser.
          await applyActionCode(auth, oobCode);
          // If a session exists, refresh the token + true-up the DB so the
          // CDR gates unlock immediately. No session is fine too — the gates
          // read the claim, which is fresh on next sign-in.
          await confirmEmailVerified().catch(() => {});
          setStatus('success');
          return;
        }

        // Entry shape 2 — continue-URL landing (Firebase already applied the
        // code on its hosted handler) or a stale/legacy link.
        const verified = await confirmEmailVerified();
        if (verified) {
          setStatus('success');
        } else {
          setStatus('error');
          setErrorMessage(
            'This verification link is missing or no longer valid. Request a fresh one below.'
          );
        }
      } catch (err) {
        const code = err instanceof Error ? err.message : '';
        setStatus('error');
        if (code.includes('auth/invalid-action-code') || code.includes('auth/expired-action-code')) {
          setErrorMessage('This verification link has expired or was already used. Request a fresh one below.');
        } else {
          setErrorMessage('An error occurred during verification. Request a fresh link below.');
        }
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
            Your email has been verified. Your account is fully unlocked — including bank
            connections when you&apos;re ready.
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
