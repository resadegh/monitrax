'use client';

/**
 * "Check your inbox" email-verification interstitial.
 *
 * Email verification via GCP Identity Platform (2026-06-10). Shown
 * immediately after an email/password signup (`/register` routes here).
 * Soft-gate posture: the user can skip to the dashboard, but bank
 * connections (Basiq/CDR surfaces) stay locked until verified —
 * see `requireVerifiedEmail` in lib/auth/guards.ts.
 *
 * Stitch screen ID: 33717abc960b4fb6881a5de0d077abff
 * (project 1859462351962811110, "Monitrax - Verify Email Interstitial").
 * Artefacts: .stitch/designs/email-verification/verify-email-sent.{html,png}
 *
 * Behaviour-psychology notes (CLAUDE.md §0): this is a small-win moment,
 * not a security scolding — warm copy, no timers, no red. The "I've
 * verified" CTA force-refreshes the Firebase token (via
 * `confirmEmailVerified`) because the server gates read the live claim.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { AuthShell, AuthSubmit, AuthGhostButton } from '@/components/auth/AuthShell';

const RESEND_COOLDOWN_SECONDS = 60;

export default function VerifyEmailSentPage() {
  const { firebaseUser, isLoading, resendVerificationEmail, confirmEmailVerified, logout } =
    useAuth();
  const router = useRouter();

  const [isChecking, setIsChecking] = useState(false);
  const [notYetVerified, setNotYetVerified] = useState(false);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [cooldown, setCooldown] = useState(0);

  // No session → nothing to verify; send the visitor to sign in.
  useEffect(() => {
    if (!isLoading && !firebaseUser) {
      router.push('/signin');
    }
  }, [isLoading, firebaseUser, router]);

  // Already verified (e.g. OAuth account or returning after clicking the
  // link) — celebrate by skipping straight to the dashboard.
  useEffect(() => {
    if (firebaseUser?.emailVerified) {
      router.push('/dashboard');
    }
  }, [firebaseUser, router]);

  // Resend cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsChecking(true);
    setNotYetVerified(false);
    try {
      const verified = await confirmEmailVerified();
      if (verified) {
        router.push('/dashboard');
      } else {
        setNotYetVerified(true);
      }
    } catch {
      setNotYetVerified(true);
    } finally {
      setIsChecking(false);
    }
  };

  const handleResend = async () => {
    setResendState('sending');
    try {
      await resendVerificationEmail();
      setResendState('sent');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      // Firebase rate-limits aggressive resends (auth/too-many-requests) —
      // surface gently, no error theatre.
      setResendState('error');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  };

  const handleSignOut = () => {
    logout();
    router.push('/register');
  };

  if (isLoading || !firebaseUser) {
    return (
      <AuthShell title="Loading…">
        <div className="flex justify-center py-4">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-cosmos-action border-t-transparent" />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell eyebrow="One quick step" title="Check your inbox.">
      <div className="text-center">
        {/* Envelope badge — same badge pattern as the verify-email success state */}
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-cosmos-action/30 bg-cosmos-action/15">
          <svg
            className="h-6 w-6 text-cosmos-action"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 8l9 6 9-6M3 8v8a2 2 0 002 2h14a2 2 0 002-2V8M3 8l9-5 9 5"
            />
          </svg>
        </div>

        <p className="mb-8 text-sm leading-relaxed text-cosmos-soft">
          We&apos;ve sent a verification link to{' '}
          <span className="font-medium text-cosmos">{firebaseUser.email}</span>. Click it to
          confirm this address is yours — it keeps your account and your financial data safe.
        </p>

        {notYetVerified ? (
          <p className="mb-4 rounded-xl border border-cosmos-hairline bg-cosmos-surface/40 px-4 py-3 text-sm text-cosmos-soft">
            We can&apos;t see the verification yet — give the link in your email a click first,
            then try again. It can take a few seconds to come through.
          </p>
        ) : null}

        {resendState === 'sent' ? (
          <p className="mb-4 text-sm text-cosmos-action">
            A fresh link is on its way. Check your inbox (and spam folder).
          </p>
        ) : null}
        {resendState === 'error' ? (
          <p className="mb-4 text-sm text-cosmos-soft">
            We couldn&apos;t send another email just now — wait a minute and try again.
          </p>
        ) : null}

        <form onSubmit={handleContinue} className="space-y-3">
          <AuthSubmit isLoading={isChecking} loadingLabel="Checking...">
            I&apos;ve verified — continue
          </AuthSubmit>
          <AuthGhostButton
            onClick={handleResend}
            disabled={resendState === 'sending' || cooldown > 0}
            title={cooldown > 0 ? `You can resend in ${cooldown}s` : undefined}
          >
            {cooldown > 0 ? `Resend email (${cooldown}s)` : 'Resend email'}
          </AuthGhostButton>
        </form>

        <p className="mt-4 text-xs text-cosmos-muted">
          Wrong address?{' '}
          <button
            type="button"
            onClick={handleSignOut}
            className="text-cosmos-action transition-colors hover:text-cosmos-action-soft"
          >
            Sign out
          </button>{' '}
          and create your account again.
        </p>

        <div className="mt-8 border-t border-cosmos-hairline pt-6">
          <Link
            href="/dashboard"
            className="text-sm font-medium text-cosmos-soft transition-colors hover:text-cosmos"
          >
            Skip for now — explore my dashboard →
          </Link>
          <p className="mt-2 text-xs text-cosmos-muted">
            You can verify later. Bank connections stay locked until you do.
          </p>
        </div>
      </div>
    </AuthShell>
  );
}
