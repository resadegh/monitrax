'use client';

/**
 * Unified Firebase auth-email action handler — `/auth/action`.
 *
 * This is the single Monitrax-hosted target for Firebase's "Customise action
 * URL" (Authentication → Templates). It replaces Firebase's default hosted
 * handler at `<project>.firebaseapp.com/__/auth/action`, so EVERY auth email
 * (verification, password reset, email-change recovery) is applied by OUR
 * client SDK — which means it uses the app's own API key (Monitrax Auth (Web))
 * on `www.monitrax.com.au`, not the project's default web key. This keeps the
 * Maps/Places key (and any other key) entirely out of the auth path and fixes
 * the API_KEY_HTTP_REFERRER_BLOCKED class of failures (2026-06-12).
 *
 * Prefetch-safe (CLAUDE.md Q-AUTH-1): mail-client privacy protection and
 * email security scanners pre-fetch links, and a GET that consumes a
 * single-use Firebase action code burns it before the human acts. So this
 * page does read-only validation on load (`checkActionCode` /
 * `verifyPasswordResetCode` — neither consumes the code) and only CONSUMES
 * the code on an explicit user gesture (button tap / form submit). A silent
 * prefetch never completes the action.
 *
 * Modes handled (Firebase passes `?mode=…&oobCode=…&continueUrl=…`):
 *   - verifyEmail   → applyActionCode               (button-gated)
 *   - resetPassword → confirmPasswordReset          (new-password form)
 *   - recoverEmail  → applyActionCode               (button-gated)
 *
 * Legacy `/verify-email` remains for the continue-URL bounce + old links.
 */

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  applyActionCode,
  checkActionCode,
  verifyPasswordResetCode,
  confirmPasswordReset,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase/config';
import { useAuth } from '@/lib/context/AuthContext';
import { AuthShell, AuthSubmit, AuthLabel, AuthError } from '@/components/auth/AuthShell';
import { AuthPasswordInput } from '@/components/auth/AuthPasswordInput';

type Mode = 'verifyEmail' | 'resetPassword' | 'recoverEmail';
type Phase = 'checking' | 'ready' | 'working' | 'success' | 'error';

/** Map a Firebase action-code error to warm, plain-English copy. */
function mapActionCodeError(err: unknown): string {
  const code = err instanceof Error ? err.message : '';
  if (code.includes('auth/invalid-action-code') || code.includes('auth/expired-action-code')) {
    return 'This link has expired or was already used. Request a fresh one and try again.';
  }
  if (code.includes('auth/weak-password')) {
    return 'Please choose a stronger password (at least 8 characters).';
  }
  if (code.includes('auth/user-disabled')) {
    return 'This account has been disabled. Contact support if you think this is a mistake.';
  }
  return 'Something went wrong applying this link. Request a fresh one and try again.';
}

function ActionContent() {
  const searchParams = useSearchParams();
  const { confirmEmailVerified } = useAuth();

  const [phase, setPhase] = useState<Phase>('checking');
  const [mode, setMode] = useState<Mode | null>(null);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Reset-password form state
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');

  const continueUrl = searchParams.get('continueUrl');
  const dashboardHref = '/dashboard';

  // On load: validate ONLY (read-only). Never consume the code here.
  useEffect(() => {
    const code = searchParams.get('oobCode');
    const rawMode = searchParams.get('mode') as Mode | null;

    const run = async () => {
      const auth = getFirebaseAuth();
      if (!auth) {
        setPhase('error');
        setErrorMessage('Authentication is not configured.');
        return;
      }
      if (!code || !rawMode) {
        setPhase('error');
        setErrorMessage('This link is missing required information. Request a fresh one.');
        return;
      }
      if (rawMode !== 'verifyEmail' && rawMode !== 'resetPassword' && rawMode !== 'recoverEmail') {
        setPhase('error');
        setErrorMessage('Unsupported link type.');
        return;
      }

      setMode(rawMode);
      setOobCode(code);

      try {
        if (rawMode === 'resetPassword') {
          // Read-only — validates the code + returns the email, does NOT consume.
          const addr = await verifyPasswordResetCode(auth, code);
          setEmail(addr);
        } else {
          // verifyEmail / recoverEmail — read-only check, does NOT consume.
          const info = await checkActionCode(auth, code);
          setEmail(info.data.email ?? null);
        }
        setPhase('ready');
      } catch (err) {
        setPhase('error');
        setErrorMessage(mapActionCodeError(err));
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Consume the code — verifyEmail / recoverEmail (explicit button gesture).
  const handleApply = async () => {
    const auth = getFirebaseAuth();
    if (!auth || !oobCode) return;
    setPhase('working');
    try {
      await applyActionCode(auth, oobCode);
      if (mode === 'verifyEmail') {
        // Refresh the token + true-up the DB so CDR gates unlock immediately
        // (no-op when there's no active session — the email is verified
        // server-side regardless).
        await confirmEmailVerified().catch(() => {});
      }
      setPhase('success');
    } catch (err) {
      setPhase('error');
      setErrorMessage(mapActionCodeError(err));
    }
  };

  // Consume the code — resetPassword (explicit form submit).
  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (password !== confirmPassword) {
      setFormError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }
    const auth = getFirebaseAuth();
    if (!auth || !oobCode) return;
    setPhase('working');
    try {
      await confirmPasswordReset(auth, oobCode, password);
      setPhase('success');
    } catch (err) {
      setPhase('error');
      setErrorMessage(mapActionCodeError(err));
    }
  };

  // ---- Loading ----
  if (phase === 'checking') {
    return (
      <AuthShell title="Checking your link…">
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <span className="h-10 w-10 animate-spin rounded-full border-2 border-cosmos-action border-t-transparent" />
          <p className="text-sm text-cosmos-soft">One moment while we check this link.</p>
        </div>
      </AuthShell>
    );
  }

  // ---- Error ----
  if (phase === 'error') {
    return (
      <AuthShell title="That link didn't work.">
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10">
            <svg className="h-6 w-6 text-red-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="mb-8 text-sm leading-relaxed text-cosmos-soft">{errorMessage}</p>
          <div className="space-y-3">
            <Link href="/signin" className="inline-flex h-12 w-full items-center justify-center rounded-xl border border-cosmos-hairline bg-cosmos-surface/50 text-sm font-medium text-cosmos transition-colors hover:bg-cosmos-elevated">
              Back to sign in
            </Link>
            {mode === 'resetPassword' ? (
              <p className="text-sm text-cosmos-muted">
                Need a new link?{' '}
                <Link href="/forgot-password" className="text-cosmos-action transition-colors hover:text-cosmos-action-soft">
                  Reset password
                </Link>
              </p>
            ) : (
              <p className="text-sm text-cosmos-muted">
                Need a new link?{' '}
                <Link href="/resend-verification" className="text-cosmos-action transition-colors hover:text-cosmos-action-soft">
                  Resend email
                </Link>
              </p>
            )}
          </div>
        </div>
      </AuthShell>
    );
  }

  // ---- Success ----
  if (phase === 'success') {
    const copy =
      mode === 'resetPassword'
        ? 'Your password has been updated. You can now sign in with your new password.'
        : mode === 'recoverEmail'
          ? 'Your email address has been restored. You can sign in again.'
          : 'Your email has been verified. Your account is fully unlocked — including bank connections when you’re ready.';
    const ctaHref = mode === 'verifyEmail' ? continueUrl || dashboardHref : '/signin';
    const ctaLabel = mode === 'verifyEmail' ? 'Go to Dashboard' : 'Go to sign in';
    const title =
      mode === 'resetPassword'
        ? 'Password updated.'
        : mode === 'recoverEmail'
          ? 'Email restored.'
          : 'Email verified.';
    return (
      <AuthShell title={title}>
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-cosmos-action/30 bg-cosmos-action/15">
            <svg className="h-6 w-6 text-cosmos-action" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="mb-8 text-sm leading-relaxed text-cosmos-soft">{copy}</p>
          <Link href={ctaHref} className="cosmos-cta inline-flex h-12 w-full items-center justify-center rounded-xl text-sm font-semibold">
            {ctaLabel}
          </Link>
        </div>
      </AuthShell>
    );
  }

  // ---- Ready / working: password-reset form ----
  if (mode === 'resetPassword') {
    return (
      <AuthShell
        eyebrow="Reset password"
        title="Choose a new password."
        subtitle={
          email ? (
            <>
              For <span className="font-medium text-cosmos">{email}</span>
            </>
          ) : undefined
        }
      >
        {formError ? <AuthError>{formError}</AuthError> : null}
        <form onSubmit={handleResetSubmit} className="space-y-5">
          <div>
            <AuthLabel htmlFor="password">New password</AuthLabel>
            <AuthPasswordInput
              id="password"
              value={password}
              onChange={setPassword}
              placeholder="At least 8 characters"
              required
              disabled={phase === 'working'}
              autoComplete="new-password"
            />
          </div>
          <div>
            <AuthLabel htmlFor="confirmPassword">Confirm new password</AuthLabel>
            <AuthPasswordInput
              id="confirmPassword"
              value={confirmPassword}
              onChange={setConfirmPassword}
              required
              disabled={phase === 'working'}
              autoComplete="new-password"
            />
          </div>
          <AuthSubmit isLoading={phase === 'working'} loadingLabel="Updating...">
            Update password
          </AuthSubmit>
        </form>
      </AuthShell>
    );
  }

  // ---- Ready / working: verifyEmail / recoverEmail (button-gated) ----
  const isRecover = mode === 'recoverEmail';
  return (
    <AuthShell
      eyebrow="One quick step"
      title={isRecover ? 'Restore your email.' : 'Confirm your email.'}
    >
      <div className="text-center">
        <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-cosmos-action/30 bg-cosmos-action/15">
          <svg className="h-6 w-6 text-cosmos-action" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l9 6 9-6M3 8v8a2 2 0 002 2h14a2 2 0 002-2V8M3 8l9-5 9 5" />
          </svg>
        </div>
        <p className="mb-8 text-sm leading-relaxed text-cosmos-soft">
          {email ? (
            <>
              Tap below to {isRecover ? 'restore' : 'confirm'}{' '}
              <span className="font-medium text-cosmos">{email}</span>.
            </>
          ) : (
            `Tap below to ${isRecover ? 'restore' : 'confirm'} your email address.`
          )}
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleApply();
          }}
        >
          <AuthSubmit isLoading={phase === 'working'} loadingLabel="Working...">
            {isRecover ? 'Restore my email' : 'Verify my email'}
          </AuthSubmit>
        </form>
      </div>
    </AuthShell>
  );
}

export default function AuthActionPage() {
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
      <ActionContent />
    </Suspense>
  );
}
