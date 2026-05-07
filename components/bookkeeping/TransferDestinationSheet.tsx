/**
 * Phase 42 PR6.5h — Transfer destination picker bottom-sheet.
 *
 * Per Reza directive 2026-05-08: the swipe-right "Transfer" gesture
 * was previously a one-shot mark — `categoryLevel1='Transfer'` with
 * no destination. Reza asked: *"when I swipe right to transfer it
 * should ask where to — that can be an account, an investment
 * account, SMSF or any other transferable accounts available in
 * the portfolio"*.
 *
 * This sheet opens after a right-swipe and lets the user pick the
 * destination. It composes:
 *   - `/api/accounts` (cash / transactional / savings / offset / cc)
 *   - `/api/investments/accounts` (shares / super / SMSF)
 *
 * Per CLAUDE.md §12.3 — no parallel data path. The actual mutation
 * goes through the existing `/api/unified-transactions/[id]` PATCH
 * with three fields: `categoryLevel1='Transfer'`,
 * `isTransfer=true`, and `transferToAccountId={picked.id}`.
 *
 * Per CLAUDE.md §0 designer lens — Apple-glass bottom-sheet
 * matching `<CategoryPickerSheet />` — same 28px-radius, 220ms
 * slide-up, ≥52pt destination cards. Grouped by account type so
 * the user can find their destination quickly.
 */

'use client';

import { useEffect, useState } from 'react';
import { Loader2, X, Wallet, TrendingUp, Building2 } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';

interface TransferDestinationSheetProps {
  open: boolean;
  transactionId: string | null;
  context: {
    merchant?: string | null;
    amount?: number;
  } | null;
  /** Don't allow transferring to the same account the tx came from. */
  excludeAccountId?: string | null;
  onSuccess: () => void;
  onClose: () => void;
}

interface AccountOption {
  id: string;
  name: string;
  /** Display label for the institution / provider. */
  subtitle: string;
  /** Coarse group used for sectioning the list. */
  group: 'CASH' | 'INVESTMENT' | 'OTHER';
}

export function TransferDestinationSheet({
  open,
  transactionId,
  context,
  excludeAccountId,
  onSuccess,
  onClose,
}: TransferDestinationSheetProps) {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<AccountOption[] | null>(null);

  // Reset transient state on close.
  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError(null);
    }
  }, [open]);

  // Esc-to-close.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Fetch the destination list when the sheet opens.
  useEffect(() => {
    if (!open || !token) return;
    let cancelled = false;
    async function load() {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [accountsRes, investmentsRes] = await Promise.all([
          fetch('/api/accounts', { headers, credentials: 'include' }),
          fetch('/api/investments/accounts', { headers, credentials: 'include' }).catch(() => null),
        ]);
        if (cancelled) return;

        const out: AccountOption[] = [];

        if (accountsRes.ok) {
          const json = await accountsRes.json().catch(() => null);
          const list: Array<Record<string, unknown>> =
            (json?.data?.accounts as Array<Record<string, unknown>>) ??
            (json?.accounts as Array<Record<string, unknown>>) ??
            (Array.isArray(json) ? (json as Array<Record<string, unknown>>) : []);
          for (const a of list) {
            const id = String(a.id ?? '');
            if (!id || id === excludeAccountId) continue;
            out.push({
              id,
              name: String(a.name ?? a.nickname ?? 'Account'),
              subtitle: String(a.institution ?? a.type ?? ''),
              group: 'CASH',
            });
          }
        }

        if (investmentsRes && investmentsRes.ok) {
          const json = await investmentsRes.json().catch(() => null);
          const list: Array<Record<string, unknown>> =
            (json?.data?.accounts as Array<Record<string, unknown>>) ??
            (json?.accounts as Array<Record<string, unknown>>) ??
            (Array.isArray(json) ? (json as Array<Record<string, unknown>>) : []);
          for (const a of list) {
            const id = String(a.id ?? '');
            if (!id || id === excludeAccountId) continue;
            out.push({
              id,
              name: String(a.name ?? a.nickname ?? 'Investment'),
              subtitle: String(a.provider ?? a.type ?? 'Investment'),
              group: 'INVESTMENT',
            });
          }
        }

        if (!cancelled) setOptions(out);
      } catch {
        if (!cancelled) setError('Could not load accounts');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [open, token, excludeAccountId]);

  async function selectDestination(dest: AccountOption) {
    if (!transactionId || !token || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/unified-transactions/${transactionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          categoryLevel1: 'Transfer',
          categoryLevel2: dest.group === 'INVESTMENT' ? 'Investment' : 'Internal',
          isTransfer: true,
          transferToAccountId: dest.id,
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        setError(json?.error?.message ?? 'Failed to mark as transfer');
        return;
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const merchant = context?.merchant ?? 'Transaction';
  const amount = context?.amount;

  const cashOptions = (options ?? []).filter((o) => o.group === 'CASH');
  const investmentOptions = (options ?? []).filter((o) => o.group === 'INVESTMENT');

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close picker"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/40 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Transfer ${merchant} to`}
        className="fixed inset-x-0 bottom-0 z-50 bg-background border-t border-border rounded-t-3xl shadow-2xl px-4 sm:px-6 pt-3 pb-6 sm:pb-8 max-h-[80vh] overflow-y-auto motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-300"
      >
        <div className="flex justify-center pt-1 pb-2">
          <span className="block w-10 h-1 rounded-full bg-slate-300" aria-hidden />
        </div>

        <header className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Transfer to
            </p>
            <p className="text-base font-semibold text-foreground truncate mt-0.5">{merchant}</p>
            {amount !== undefined && (
              <p className="text-sm text-muted-foreground tabular-nums mt-0.5">
                {Math.abs(amount).toLocaleString('en-AU', {
                  style: 'currency',
                  currency: 'AUD',
                })}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-11 h-11 rounded-full text-muted-foreground hover:bg-muted active:bg-muted/80 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {options === null && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {options !== null && options.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No other accounts found. Add an account in Balances to enable transfers.
          </p>
        )}

        {cashOptions.length > 0 && (
          <DestinationGroup
            title="Cash & bank"
            icon={Wallet}
            options={cashOptions}
            busy={busy}
            onSelect={selectDestination}
          />
        )}

        {investmentOptions.length > 0 && (
          <DestinationGroup
            title="Investment & super"
            icon={TrendingUp}
            options={investmentOptions}
            busy={busy}
            onSelect={selectDestination}
          />
        )}

        {/* Manual fallback — for users whose destination isn't in
            the system yet. Sets isTransfer=true without a target. */}
        <div className="mt-4 pt-3 border-t border-border">
          <button
            type="button"
            disabled={busy || !transactionId || !token}
            onClick={async () => {
              if (!transactionId || !token || busy) return;
              setBusy(true);
              try {
                await fetch(`/api/unified-transactions/${transactionId}`, {
                  method: 'PATCH',
                  headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                  },
                  credentials: 'include',
                  body: JSON.stringify({
                    categoryLevel1: 'Transfer',
                    categoryLevel2: 'Internal',
                    isTransfer: true,
                  }),
                });
                onSuccess();
              } finally {
                setBusy(false);
              }
            }}
            className="w-full text-sm text-muted-foreground hover:text-foreground py-3 min-h-[44px] inline-flex items-center justify-center gap-2"
          >
            <Building2 className="w-4 h-4" />
            Mark as transfer (no destination)
          </button>
        </div>

        {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
      </div>
    </>
  );
}

function DestinationGroup({
  title,
  icon: Icon,
  options,
  busy,
  onSelect,
}: {
  title: string;
  icon: typeof Wallet;
  options: AccountOption[];
  busy: boolean;
  onSelect: (o: AccountOption) => void;
}) {
  return (
    <section className="mb-4">
      <div className="flex items-center gap-1.5 mb-2 px-1">
        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </p>
      </div>
      <ul className="space-y-1.5">
        {options.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSelect(o)}
              className="w-full text-left px-4 py-3 rounded-2xl bg-muted hover:bg-muted/70 active:bg-muted/60 text-foreground transition-colors disabled:opacity-60 min-h-[52px]"
            >
              <p className="text-sm font-medium truncate">{o.name}</p>
              {o.subtitle && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{o.subtitle}</p>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
