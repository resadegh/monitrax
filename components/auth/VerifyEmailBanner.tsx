'use client';

/**
 * Soft-gate email-verification banner — in-app dashboard surface.
 *
 * Email verification via GCP Identity Platform (2026-06-10). Shows for
 * signed-in email/password users whose Firebase `emailVerified` is false.
 * OAuth users (Google etc.) arrive verified and never see it.
 *
 * Soft-gate posture: the dashboard stays fully usable; this banner names
 * the one thing that's locked (bank connections — CDR surface, see
 * `requireVerifiedEmail` in lib/auth/guards.ts) and offers the two useful
 * actions: resend and re-check. Dismissible per session only — it returns
 * next visit until verified, but never blocks.
 *
 * In-app design system (CLAUDE.md §18.7.2), NOT cosmos: amber is the
 * caution hue, glass card vocabulary, warm non-shaming copy.
 */

import { useState } from 'react';
import { Mail, X } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

export function VerifyEmailBanner() {
  const { firebaseUser, resendVerificationEmail, confirmEmailVerified } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'checking' | 'verified' | 'error'>(
    'idle'
  );

  const isPasswordUser = firebaseUser?.providerData.some((p) => p.providerId === 'password');

  if (!firebaseUser || firebaseUser.emailVerified || !isPasswordUser || dismissed) {
    return null;
  }

  const handleResend = async () => {
    setState('sending');
    try {
      await resendVerificationEmail();
      setState('sent');
    } catch {
      setState('error');
    }
  };

  const handleCheck = async () => {
    setState('checking');
    const verified = await confirmEmailVerified().catch(() => false);
    if (verified) {
      setState('verified');
      // Brief celebration, then the banner removes itself.
      setTimeout(() => setDismissed(true), 2500);
    } else {
      setState('idle');
    }
  };

  if (state === 'verified') {
    return (
      <div
        role="status"
        className="mb-4 rounded-[14px] border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"
      >
        Email verified — your account is fully unlocked. Nice one.
      </div>
    );
  }

  return (
    <div
      role="status"
      className="mb-4 flex flex-col gap-3 rounded-[14px] border border-amber-400/30 bg-amber-500/10 px-4 py-3 backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <Mail className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <p className="text-sm leading-relaxed text-amber-800 dark:text-amber-200">
          <span className="font-medium">Verify your email to unlock bank connections.</span>{' '}
          We sent a link to {firebaseUser.email}.
          {state === 'sent' ? ' A fresh link is on its way.' : ''}
          {state === 'error' ? ' Resend failed — try again in a minute.' : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">
        <button
          type="button"
          onClick={handleResend}
          disabled={state === 'sending' || state === 'sent'}
          className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-200"
        >
          {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Sent' : 'Resend'}
        </button>
        <button
          type="button"
          onClick={handleCheck}
          disabled={state === 'checking'}
          className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-200"
        >
          {state === 'checking' ? 'Checking…' : "I've verified"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss for now"
          className="rounded-full p-1 text-amber-700/70 transition-colors hover:text-amber-800 dark:text-amber-300/70 dark:hover:text-amber-200"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
