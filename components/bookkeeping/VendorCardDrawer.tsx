'use client';

/**
 * Phase 42 PR 5.6 — Vendor card drawer.
 *
 * Right-edge slide-in (mobile: bottom-sheet) showing vendor detail:
 * annual totals (12-month trailing) + linked properties + contract
 * document + cancel-subscription affordance. Reuses the existing
 * Phase 42 PR6 `<CancelSubscriptionLink>` primitive.
 *
 * Accepts EITHER a `vendorId` (when the caller already knows it,
 * e.g. from a vendor list) OR a `merchantStandardised` string (when
 * opening from a transaction row — drawer resolves merchant → vendor
 * via `/api/bookkeeping/vendors?merchantStandardised=` in one
 * round-trip, then fetches the full card via `/api/bookkeeping/vendors/[id]`).
 *
 * When the merchant has no vendor row yet, shows an empty state +
 * the user can keep using the merchant — no auto-create (vendor rows
 * are server-created by `resolveOrCreateVendor` in the import path).
 *
 * Per CLAUDE.md §0:
 *   - Designer lens: restrained + single-column + 28px corner radius
 *     mobile / no corner radius right-edge desktop. Sky-tone header.
 *   - Behaviour-psychologist lens: no advice verbs, no shame copy.
 *     The cancel link is a FACT ("here's the cancellation page"),
 *     never a recommendation ("you should cancel").
 *   - Architect lens: presentational only — all aggregation already
 *     lives in the existing `getVendorAnnualTotals` service.
 */

import { useEffect, useState } from 'react';
import { X, Building2, Calendar, FileText, MapPin, AlertCircle } from 'lucide-react';
import { CancelSubscriptionLink } from './CancelSubscriptionLink';
import { useAuth } from '@/lib/context/AuthContext';

interface VendorCardData {
  vendor: {
    id: string;
    name: string;
    mcc: string | null;
    abn: string | null;
    cancelUrl: string | null;
    contractDocumentId: string | null;
    notes: string | null;
  };
  totals: {
    transactionCount: number;
    totalSpent: number;
    totalReceived: number;
    lastSeen: string | null;
    accountCount: number;
  };
  relatedProperties: Array<{ id: string; name: string }>;
  contract: {
    id: string;
    filename: string;
    category: string | null;
  } | null;
  cancelUrl: string | null;
}

type DrawerState =
  | { status: 'closed' }
  | { status: 'loading' }
  | { status: 'no-vendor'; merchantStandardised: string }
  | { status: 'loaded'; data: VendorCardData }
  | { status: 'error'; message: string };

export interface VendorCardDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Pass exactly ONE of these. */
  vendorId?: string;
  merchantStandardised?: string;
}

export function VendorCardDrawer({
  open,
  onClose,
  vendorId,
  merchantStandardised,
}: VendorCardDrawerProps) {
  const { token } = useAuth();
  const [state, setState] = useState<DrawerState>({ status: 'closed' });

  // Fetch on open + when the merchant/vendor changes.
  useEffect(() => {
    if (!open) {
      setState({ status: 'closed' });
      return;
    }
    let active = true;
    setState({ status: 'loading' });

    // Hotfix 2026-05-18: MUST pass Authorization header on every API
    // call — otherwise 401 → SessionExpiryHandler logs the user out.
    const authHeaders = token ? { Authorization: `Bearer ${token}` } : undefined;

    const load = async (): Promise<void> => {
      try {
        // Step 1 — resolve to a vendor id.
        let resolvedVendorId = vendorId ?? null;
        if (!resolvedVendorId && merchantStandardised) {
          const res = await fetch(
            `/api/bookkeeping/vendors?merchantStandardised=${encodeURIComponent(merchantStandardised)}`,
            { headers: authHeaders },
          );
          if (!res.ok) {
            if (active) setState({ status: 'error', message: `Lookup failed (${res.status})` });
            return;
          }
          const json = await res.json();
          const vendor = json?.data?.vendors?.[0];
          if (!vendor) {
            if (active) setState({ status: 'no-vendor', merchantStandardised });
            return;
          }
          resolvedVendorId = vendor.id;
        }

        if (!resolvedVendorId) {
          if (active) setState({ status: 'error', message: 'No vendor id or merchant supplied.' });
          return;
        }

        // Step 2 — fetch full card data.
        const res = await fetch(`/api/bookkeeping/vendors/${resolvedVendorId}`, {
          headers: authHeaders,
        });
        if (!res.ok) {
          if (active) setState({ status: 'error', message: `Card fetch failed (${res.status})` });
          return;
        }
        const json = await res.json();
        if (!json?.data?.vendor) {
          if (active) setState({ status: 'error', message: 'Card response malformed.' });
          return;
        }
        if (active) setState({ status: 'loaded', data: json.data });
      } catch (err) {
        if (active) setState({ status: 'error', message: 'Network error.' });
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [open, vendorId, merchantStandardised, token]);

  // ESC closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="vendor-card-title"
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/50 dark:bg-slate-950/70"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-full overflow-hidden"
        data-testid="vendor-card-drawer"
      >
        <header className="flex items-start justify-between gap-3 p-4 border-b border-slate-200 dark:border-slate-800 bg-sky-50/60 dark:bg-sky-950/30">
          <div className="min-w-0 flex-1">
            <h2 id="vendor-card-title" className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
              {state.status === 'loaded'
                ? state.data.vendor.name
                : state.status === 'no-vendor'
                  ? state.merchantStandardised
                  : 'Vendor card'}
            </h2>
            {state.status === 'loaded' && state.data.vendor.abn && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                ABN {state.data.vendor.abn}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 -m-1 rounded-md p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {state.status === 'loading' && (
            <div className="text-sm text-slate-500 dark:text-slate-400">Loading vendor card…</div>
          )}

          {state.status === 'error' && (
            <div className="flex items-start gap-2 rounded-md bg-rose-50 dark:bg-rose-950/40 p-3 text-sm text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-200 dark:ring-rose-900">
              <AlertCircle aria-hidden className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{state.message}</span>
            </div>
          )}

          {state.status === 'no-vendor' && (
            <div className="rounded-md bg-slate-50 dark:bg-slate-800/50 p-3 text-sm text-slate-600 dark:text-slate-400">
              <p>
                No vendor profile saved for <span className="font-medium">{state.merchantStandardised}</span> yet.
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                Vendor profiles are created automatically when a transaction is categorised. Categorise this transaction
                to start tracking annual totals + linked properties for this merchant.
              </p>
            </div>
          )}

          {state.status === 'loaded' && (
            <VendorCardBody data={state.data} />
          )}
        </div>
      </aside>
    </div>
  );
}

function VendorCardBody({ data }: { data: VendorCardData }) {
  const fmt = (n: number) =>
    new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);
  const lastSeenLabel = data.totals.lastSeen
    ? new Date(data.totals.lastSeen).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="space-y-4">
      {/* 12-month totals */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          12-month totals
        </h3>
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Total spent</dt>
            <dd className="mt-0.5 text-base font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {fmt(data.totals.totalSpent)}
            </dd>
          </div>
          {data.totals.totalReceived > 0 && (
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Received</dt>
              <dd className="mt-0.5 text-base font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {fmt(data.totals.totalReceived)}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Transactions</dt>
            <dd className="mt-0.5 text-base font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {data.totals.transactionCount}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Across accounts</dt>
            <dd className="mt-0.5 text-base font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {data.totals.accountCount}
            </dd>
          </div>
        </dl>
        {lastSeenLabel && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <Calendar aria-hidden className="h-3 w-3" />
            Last transaction {lastSeenLabel}
          </p>
        )}
      </section>

      {/* Cancel link */}
      {data.cancelUrl && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Subscription management
          </h3>
          <CancelSubscriptionLink cancelUrl={data.cancelUrl} vendorName={data.vendor.name} />
        </section>
      )}

      {/* Related properties */}
      {data.relatedProperties.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Linked properties
          </h3>
          <ul className="space-y-1.5">
            {data.relatedProperties.map((p) => (
              <li key={p.id} className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                <MapPin aria-hidden className="h-3.5 w-3.5 text-slate-400" />
                {p.name}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Contract document */}
      {data.contract && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Contract on file
          </h3>
          <a
            href={`/dashboard/vault?document=${data.contract.id}`}
            className="inline-flex items-center gap-1.5 text-sm text-sky-700 dark:text-sky-300 hover:underline"
          >
            <FileText aria-hidden className="h-3.5 w-3.5" />
            {data.contract.filename}
          </a>
        </section>
      )}

      {/* MCC code if available */}
      {data.vendor.mcc && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            Classification
          </h3>
          <p className="inline-flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
            <Building2 aria-hidden className="h-3.5 w-3.5 text-slate-400" />
            MCC {data.vendor.mcc}
          </p>
        </section>
      )}
    </div>
  );
}
