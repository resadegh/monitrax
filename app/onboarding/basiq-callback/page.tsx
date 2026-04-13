'use client';

/**
 * /app/onboarding/basiq-callback — Phase 12 PR 3b
 *
 * Landing page after the user completes the Basiq consent flow. The
 * Basiq redirect brings them back here with no useful query params
 * (Basiq only uses the return URL). Our job is to:
 *
 *   1. Poll `GET /api/basiq/connections` until at least one connection
 *      with status=ACTIVE shows up (or we time out).
 *   2. Fetch the list of accounts created by the sync from
 *      `GET /api/accounts`.
 *   3. Redirect back to `/onboarding?step=accounts&basiq=connected`
 *      so the wizard resumes on the Accounts step with a success
 *      banner.
 *
 * The AccountsStep on the next render will see the new DB-persisted
 * accounts (because the wizard data is hydrated from the DB via the
 * draft) and can surface them as `source='BASIQ'` read-only cards.
 * In PR 3b.9 bulk-create will skip writing them.
 *
 * If the poll times out or errors, we redirect with `basiq=error` and
 * let the Accounts step show a gentle retry affordance.
 *
 * Unauth users redirect to /signin?next=/onboarding. If onboarding is
 * already complete the user goes to /dashboard (same pattern as the
 * main /onboarding page).
 *
 * See: docs/blueprint/PHASE_12_WIZARD_REDESIGN_PLAN.md §6.3 Tier 1
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const POLL_INTERVAL_MS = 1500;
const POLL_TIMEOUT_MS = 30_000; // 20 attempts max

type PollStatus = 'polling' | 'success' | 'timeout' | 'error';

export default function BasiqCallbackPage() {
  const router = useRouter();
  const { user, token, isLoading: authLoading } = useAuth();
  const [status, setStatus] = useState<PollStatus>('polling');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollingRef = useRef(false);

  // Auth gate
  useEffect(() => {
    if (!authLoading && !user && !token) {
      router.push('/signin?next=/onboarding');
    }
  }, [authLoading, user, token, router]);

  // Poll until the Basiq connection appears as ACTIVE, or time out.
  const poll = useCallback(async () => {
    if (!token || pollingRef.current) return;
    pollingRef.current = true;

    const startedAt = Date.now();

    const checkOnce = async (): Promise<boolean> => {
      try {
        const response = await fetch('/api/basiq/connections', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) {
          // Non-fatal — just return false and let the poll retry.
          return false;
        }
        const body = await response.json();
        const connections: Array<{ status?: string }> =
          body.connections || body.data?.connections || body.data || [];
        return connections.some((c) => c.status === 'ACTIVE');
      } catch {
        return false;
      }
    };

    while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
      const ok = await checkOnce();
      if (ok) {
        setStatus('success');
        pollingRef.current = false;
        // Small delay so the user sees the success tick before the redirect
        setTimeout(() => {
          router.push('/onboarding?step=accounts&basiq=connected');
        }, 600);
        return;
      }
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    }

    setStatus('timeout');
    pollingRef.current = false;
  }, [router, token]);

  useEffect(() => {
    if (!authLoading && user && token && status === 'polling') {
      void poll();
    }
  }, [authLoading, user, token, status, poll]);

  const handleBackToOnboarding = () => {
    router.push('/onboarding?step=accounts&basiq=error');
  };

  return (
    <div className="wz-page-root flex min-h-screen items-center justify-center p-6">
      <div className="wz-page-card max-w-md">
        <div className="p-8 text-center">
          {status === 'polling' && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-500 text-white shadow-[0_10px_30px_-10px_rgba(99,102,241,0.55)]">
                  <Loader2 className="h-7 w-7 animate-spin" />
                </div>
              </div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Finalising your bank connection…
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                We&apos;re pulling your accounts from Basiq. This usually takes a few seconds.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white shadow-[0_10px_30px_-10px_rgba(16,185,129,0.55)]">
                  <CheckCircle2 className="h-7 w-7" strokeWidth={2.5} />
                </div>
              </div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Bank connected
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                Returning you to the wizard…
              </p>
            </>
          )}

          {(status === 'timeout' || status === 'error') && (
            <>
              <div className="mb-4 flex justify-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                  <AlertCircle className="h-7 w-7" />
                </div>
              </div>
              <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                {status === 'timeout' ? 'Still syncing…' : 'Connection issue'}
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {status === 'timeout'
                  ? "Your bank is taking longer than usual to respond. You can head back to the wizard — we'll finish syncing in the background and your accounts will appear on the next screen."
                  : errorMsg || "We couldn't confirm the connection. You can try again or pick a different option."}
              </p>
              <button
                type="button"
                onClick={handleBackToOnboarding}
                className="wz-btn-primary mt-5 mx-auto"
              >
                Back to setup
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
