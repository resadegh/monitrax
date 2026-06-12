'use client';

/**
 * START FRESH DIALOG — account data reset confirmation (Settings →
 * Privacy → Danger Zone).
 *
 * Wipes ALL financial data for the user while keeping the account:
 * login, MFA/passkeys, legal consents, billing, integrations and support
 * history survive. Executor + model classification:
 * `lib/services/accountReset.ts`; endpoint `POST /api/account/reset`.
 *
 * Stitch source (CLAUDE.md §18.2.1): project 1859462351962811110,
 * screen a1e90a99dc7c4ea38bc4d82a96e910b5 (desktop light) + siblings
 *   e25724ebe7ec43d5806268cbf6c0dcb2 (desktop dark)
 *   63d60c3325a2490e8af081b7ec47e197 (mobile light)
 *   e7a8d990084742259a0c8b38d6ef815c (mobile dark)
 * committed at .stitch/designs/start-fresh/start-fresh-dialog{,-dark,-mobile,-mobile-dark}-v1.{html,png}.
 *
 * Composition (§18.7.2 glass vocabulary, modal pattern shared with
 * components/properties/ChangePhotoDialog.tsx):
 *   - Desktop: centred 520px modal, rounded-[24px]; mobile: bottom sheet
 *     (top-only rounded-[28px], grab handle, stacked full-width CTAs).
 *   - 3px rose→amber top-accent strip (destructive sub-palette — rose is
 *     reserved for true destruction per the money-signal rule).
 *   - 44px rose→amber gradient icon gem, glass card, hairline border,
 *     three-tier shadow, 1px inner-top highlight.
 *   - "WHAT GOES" (rose tint) vs "WHAT STAYS" (emerald tint) comparison
 *     grid — transparency reduces anxiety (behaviour-psychology lens):
 *     the user sees exactly what survives before committing.
 *   - Export-first nudge linking to the existing /api/account/export.
 *   - Type-RESET gate; the API re-validates server-side.
 *
 * On success the user is sent to /onboarding — the fresh-start moment
 * lands them at the achievable next action, not an empty dashboard.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Download, RotateCcw, X } from 'lucide-react';

interface StartFreshDialogProps {
  open: boolean;
  onClose: () => void;
  token: string | null;
}

const GOES = [
  'Properties & loans',
  'Accounts & transactions',
  'Income & spending',
  'Investments & super',
  'Budgets, documents & insights',
];

const STAYS = [
  'Your login & security',
  'Legal consents',
  'Billing',
  'App preferences',
];

export default function StartFreshDialog({ open, onClose, token }: StartFreshDialogProps) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState('');
  const [working, setWorking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const armed = confirmText.trim() === 'RESET';

  // Fresh canvas every open.
  useEffect(() => {
    if (open) {
      setConfirmText('');
      setWorking(false);
      setExporting(false);
      setError(null);
    }
  }, [open]);

  // Escape-key dismissal — modal-standard a11y.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !working) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose, working]);

  if (!open) return null;

  const downloadExport = async () => {
    if (!token || exporting) return;
    setExporting(true);
    setError(null);
    try {
      const res = await fetch('/api/account/export', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Export failed — try again in a moment.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `monitrax-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const runReset = async () => {
    if (!token || !armed || working) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch('/api/account/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirm: 'RESET' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        throw new Error(json?.error?.message || 'Could not complete the reset. Nothing was changed.');
      }
      // Clean slate — land in onboarding as a day-one user.
      router.push('/onboarding');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete the reset.');
      setWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* Backdrop — click to dismiss */}
      <button
        type="button"
        aria-label="Close dialog"
        onClick={working ? undefined : onClose}
        disabled={working}
        className="absolute inset-0 cursor-default bg-foreground/40 backdrop-blur-[8px] dark:bg-black/60"
      />

      {/* Dialog / bottom sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="start-fresh-title"
        className="
          relative w-full max-w-[520px]
          overflow-hidden border border-rose-500/15 bg-card/85 backdrop-blur-2xl
          shadow-[0_2px_4px_rgba(15,23,42,0.06),0_24px_64px_rgba(15,23,42,0.14)]
          dark:border-rose-400/30
          dark:shadow-[0_2px_4px_rgba(0,0,0,0.40),inset_0_1px_0_0_rgba(255,255,255,0.04)]
          rounded-t-[28px] sm:rounded-[24px]
          mx-0 sm:mx-4
          max-h-[92vh] overflow-y-auto
        "
      >
        {/* Mobile-only grab handle */}
        <div aria-hidden className="flex justify-center pt-2 sm:hidden">
          <span className="h-1 w-9 rounded-full bg-foreground/15" />
        </div>

        {/* 3px rose→amber top-accent strip */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-rose-500 to-amber-500 sm:rounded-t-[24px]"
        />
        {/* 1px inner-top white highlight — the curved-glass cue */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10"
        />

        <div className="relative p-5 sm:p-7">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-rose-500 to-amber-500 text-white shadow-md shadow-rose-500/30">
                <RotateCcw className="h-5 w-5" strokeWidth={1.5} />
              </div>
              <div>
                <h2
                  id="start-fresh-title"
                  className="text-xl font-semibold tracking-tight text-foreground"
                >
                  Start fresh
                </h2>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  A clean slate — your login stays, your data goes.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={working}
              aria-label="Close"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50"
            >
              <X className="h-5 w-5" strokeWidth={1.5} />
            </button>
          </div>

          {/* What goes / what stays */}
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-[12px] bg-rose-50/40 p-4 ring-1 ring-rose-500/10 dark:bg-rose-500/[0.08] dark:ring-rose-400/20">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-rose-700 dark:text-rose-300">
                What goes
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {GOES.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13px] text-foreground/85">
                    <X aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-none text-rose-500/70" strokeWidth={2} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-[12px] bg-emerald-50/40 p-4 ring-1 ring-emerald-500/10 dark:bg-emerald-500/[0.08] dark:ring-emerald-400/20">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                What stays
              </p>
              <ul className="mt-2.5 space-y-1.5">
                {STAYS.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13px] text-foreground/85">
                    <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 flex-none text-emerald-500/80" strokeWidth={2} />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Export-first nudge */}
          <button
            type="button"
            onClick={downloadExport}
            disabled={exporting || working}
            className="mt-4 flex w-full items-center gap-2 rounded-[12px] bg-sky-50/50 px-4 py-3 text-left text-[13px] text-sky-700 ring-1 ring-sky-500/15 transition-colors hover:bg-sky-50 disabled:opacity-60 dark:bg-sky-500/[0.08] dark:text-sky-300 dark:ring-sky-400/20 dark:hover:bg-sky-500/[0.12]"
          >
            <Download className="h-4 w-4 flex-none" strokeWidth={1.5} />
            {exporting ? 'Preparing your export…' : 'Want a copy first? Download your data as JSON'}
          </button>

          {/* Type-RESET gate */}
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="Type RESET to confirm"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            disabled={working}
            className="mt-4 w-full rounded-[14px] border border-foreground/15 bg-background/50 px-4 py-3 text-sm tracking-wide text-foreground placeholder:text-muted-foreground/70 focus:border-rose-500/50 focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:opacity-60"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            This can&apos;t be undone. Your data is erased immediately.
          </p>

          {error && (
            <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/5 px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Footer — primary above cancel on mobile, right-aligned row on desktop */}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={working}
              className="rounded-full px-5 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runReset}
              disabled={!armed || working}
              className="rounded-[14px] bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-rose-600/25 transition-all hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {working ? 'Erasing your data…' : 'Erase everything & start fresh'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
