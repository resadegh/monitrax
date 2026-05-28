'use client';

/**
 * Error boundary for the /dashboard/labs/* route segment. Next.js App
 * Router renders this automatically when any client component in a labs
 * page throws during render — replacing the silent blank screen with a
 * legible error surface (the actual message + a retry button).
 *
 * Added 2026-05-28 after a "doesn't load" report on
 * /dashboard/labs/kpi-tiles that produced no server-side log (client
 * crashes never reach the Vercel runtime logs). This boundary makes any
 * future client throw self-evident + screenshot-able instead of blank.
 */

import { useEffect } from 'react';

export default function LabsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the browser console so it's captured in any client
    // error reporting and visible in devtools.
    // eslint-disable-next-line no-console
    console.error('[labs] route error boundary caught:', error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-editorial-slate">
        Lab preview error
      </p>
      <h1 className="text-headline-sm text-editorial-ink">
        This preview hit a snag rendering.
      </h1>
      <p className="text-sm leading-relaxed text-editorial-slate">
        {error?.message || 'An unexpected client-side error occurred.'}
        {error?.digest ? ` (digest: ${error.digest})` : ''}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-2 rounded-xl bg-editorial-emerald px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        Try again
      </button>
    </div>
  );
}
