'use client';

/**
 * Email-verification landing page — GCP Identity Platform (2026-06-10).
 *
 * Prefetch-safe (2026-06-10 hardening): mail clients and email security
 * scanners pre-fetch links to inspect them, and a GET that consumes a
 * single-use Firebase action code burns it before the human clicks
 * ("link already used"). To defend against that, this page does NOT apply
 * the action code on load. On load it only runs `checkActionCode`
 * (read-only — does NOT consume the code) to validate the link + read the
 * email, then waits for an explicit button tap before calling
 * `applyActionCode` (which consumes it). A silent prefetch never taps the
 * button, so the code survives for the real user.
 *
 * Two entry shapes, both from the Firebase verification email:
 *   1. Custom action URL: `?mode=verifyEmail&oobCode=<code>` — validated on
 *      load, applied on button tap.
 *   2. Continue URL: Firebase's hosted handler already applied the code and
 *      bounced the user back here with no oobCode — we confirm via
 *      `confirmEmailVerified()` (reload + token refresh; no code to consume).
 *
 * After a successful apply, `confirmEmailVerified()` force-refreshes the ID
 * token (server gates read the live `email_verified` claim) and trues-up
 * the DB row via POST /api/auth/verify-email.
 */

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { applyActionCode, checkActionCode } from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/config';
import { useAuth } from '@/lib/context/AuthContext';
import { AuthShell, AuthSubmit } from '@/components/auth/AuthShell';

type Status = 'checking' | 'ready' | 'verifying' | 'success' | 'error';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const { confirmEmailVerified } = useAuth();
  const [status, setStatus] = useState<Status>('checking');
  const [errorMessage, setErrorMessage] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const [oobCode, setOobCode] = useState<string | null>(null);

  // On load: validate ONLY. Never consume the code here — a prefetch must
  // not be able to burn it. checkActionCode is read-only.
  useEffect(() => {
    const code = searchParams.get('oobCode');
    const mode = searchParams.get('mode');

    const run = async () => {
      const auth = getFirebaseAuth();
      if (!auth) {
        setStatus('error');
        setErrorMessage('Authentication is not configured');
        return;
      }

      // Continue-URL shape — Firebase already applied the code on its hosted
      // handler. No code to consume; confirm the session is verified. Safe to
      // auto-run (a scanner has no session, so it harmlessly returns false).
      if (!code) {
        const verified = await confirmEmailVerified().catch(() => false);
        if (verified) {
          setStatus('success');
        } else {
          setStatus('error');
          setErrorMessage(
            'This verification link is missing or no longer valid. Request a fresh one below.'
          );
        }
        return;
      }

      if (mode && mode !== 'verifyEmail') {
        setStatus('error');
        setErrorMessage('Unsupported verification link.');
        return;
      }

      try {
        // Read-only validation — does NOT consume the code.
        const info = await checkActionCode(auth, code);
        setEmail(info.data.email ?? null);
        setOobCode(code);
        setStatus('ready');
      } catch (err) {
        setStatus('error');
        setErrorMessage(mapActionCodeError(err));
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Explicit human gesture — only NOW do we consume the code.
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const auth = getFirebaseAuth();
    if (!auth || !oobCode) return;
    setStatus('verifying');
    try {
      await applyActionCode(auth, oobCode);
      // If a session exists, refresh token + true-up the DB so CDR gates
      // unlock immediately. No session is fine — the email is verified
      // server-side regardless; the claim is fresh on next sign-in.
      await confirmEmailVerified().catch(() => {});
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setErrorMessage(mapActionCodeError(err));
    }
  };

  if (status === 'checking') {
    return (
      <AuthShell title="Checking your link…">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-cosmos-action border-t-transparent" />
          <p className="text-sm text-cosmos-soft">One moment while we check your verification link.</p>
        </div>
      </AuthShell>
    );
  }

  if (status === 'ready' || status === 'verifying') {
    return (
      <AuthShell eyebrow="One quick step" title="Confirm your email.">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-cosmos-action/30 bg-cosmos-action/15">
            <svg className="h-6 w-6 text-cosmos-action" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M3 8v8a2 2 0 002 2h14a2 2 0 002-2V8M3 8l9-5 9 5" />
            </svg>
          </div>
          <p className="mb-8 text-sm leading-relaxed text-cosmos-soft">
            {email ? (
              <>
                Tap below to confirm <span className="font-medium text-cosmos">{email}</span> is yours.
              </>
            ) : (
              'Tap below to confirm your email address.'
            )}
          </p>
          <form onSubmit={handleVerify}>
            <AuthSubmit isLoading={status === 'verifying'} loadingLabel="Verifying...">
              Verify my email
            </AuthSubmit>
          </form>
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

/** Map a Firebase action-code error to warm, plain-English copy. */
function mapActionCodeError(err: unknown): string {
  const code = err instanceof Error ? err.message : '';
  if (code.includes('auth/invalid-action-code') || code.includes('auth/expired-action-code')) {
    return 'This verification link has expired or was already used. Request a fresh one below.';
  }
  return 'An error occurred during verification. Request a fresh link below.';
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
