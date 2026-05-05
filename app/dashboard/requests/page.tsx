'use client';

/**
 * Phase 32C PR4c — User-side request tracking.
 *
 * Route: `/dashboard/requests`
 *
 * Lets the user see the status of their marketplace submissions, withdraw a
 * SUBMITTED request, and read decline reasons. Lands here automatically
 * after a successful submit (with a `?just=<id>` highlight).
 *
 * Intentionally minimal at v1 — the in-app conversation thread (PR4d) is
 * the richer interaction surface. This page is the lightweight tracker.
 */

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface UserRequest {
  id: string;
  contextLabel: string | null;
  question: string;
  status: string;
  submittedAt: string;
  respondedAt: string | null;
  declineReason: string | null;
  leadFeeTier: string | null;
  leadFeeAmount: string | null;
  conversation: { id: string } | null;
  listing: {
    id: string;
    publicSlug: string;
    displayName: string;
    discipline: string;
  };
}

const STATUS_PILL: Record<string, { label: string; classes: string }> = {
  SUBMITTED: { label: 'Awaiting response', classes: 'bg-amber-50 text-amber-800 ring-amber-200' },
  ACCEPTED: { label: 'Accepted', classes: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  DECLINED: { label: 'Declined', classes: 'bg-rose-50 text-rose-800 ring-rose-200' },
  WITHDRAWN: { label: 'Withdrawn', classes: 'bg-slate-100 text-slate-700 ring-slate-200' },
  EXPIRED: { label: 'Expired', classes: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

function disciplineLabel(d: string): string {
  switch (d) {
    case 'FINANCIAL_ADVISOR': return 'Financial adviser';
    case 'MORTGAGE_BROKER': return 'Mortgage broker';
    case 'ACCOUNTING_FIRM': return 'Accounting firm';
    case 'TAX_AGENT': return 'Tax agent';
    case 'BOOKKEEPER': return 'Bookkeeper';
    default: return d;
  }
}

function RequestsList() {
  const searchParams = useSearchParams();
  const justSubmitted = searchParams.get('just');

  const [items, setItems] = useState<UserRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/professional-requests', { cache: 'no-store' });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Failed to load requests');
      }
      const json = await res.json();
      setItems(json.data?.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleWithdraw = async (id: string) => {
    setWithdrawingId(id);
    try {
      const res = await fetch(`/api/professional-requests/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'withdraw' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? 'Withdraw failed');
      setItems((prev) => prev.map((it) => (it.id === id ? json.data.request : it)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Withdraw failed');
    } finally {
      setWithdrawingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">My requests</h1>
        <p className="mt-1 text-[14px] text-slate-600 max-w-2xl">
          Track requests you&rsquo;ve sent to professionals on the Monitrax marketplace. You can withdraw a request any time before they respond.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 px-4 py-3 text-[13px] text-rose-700 mb-6">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-slate-100 animate-pulse h-28" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-white/60 ring-1 ring-slate-200/70">
          <p className="text-[15px] text-slate-700 mb-3">You haven&rsquo;t sent any requests yet.</p>
          <Link
            href="/marketplace"
            className="inline-flex items-center rounded-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-[13px] font-medium transition-colors"
          >
            Browse professionals →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const statusEntry = STATUS_PILL[item.status] ?? STATUS_PILL.SUBMITTED;
            const isJustSubmitted = item.id === justSubmitted;
            return (
              <article
                key={item.id}
                className={`rounded-2xl bg-white p-4 ring-1 transition-shadow ${
                  isJustSubmitted ? 'ring-emerald-300 shadow-sm' : 'ring-slate-200/70'
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <Link
                      href={`/marketplace/${item.listing.publicSlug}`}
                      className="text-[15px] font-semibold text-slate-900 hover:text-emerald-700"
                    >
                      {item.listing.displayName}
                    </Link>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {disciplineLabel(item.listing.discipline)}
                      {item.contextLabel && <span className="text-emerald-700"> · {item.contextLabel}</span>}
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full ring-1 ring-inset px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${statusEntry.classes}`}>
                    {statusEntry.label}
                  </span>
                </div>

                <p className="text-[13px] text-slate-700 leading-relaxed line-clamp-3 mb-3">{item.question}</p>

                {item.status === 'DECLINED' && item.declineReason && (
                  <div className="rounded-lg bg-rose-50 ring-1 ring-rose-200 px-3 py-2 mb-3">
                    <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wide mb-1">Their response</div>
                    <p className="text-[12px] text-rose-900 leading-relaxed">{item.declineReason}</p>
                  </div>
                )}

                {item.status === 'ACCEPTED' && (
                  <div className="rounded-lg bg-emerald-50 ring-1 ring-emerald-200 px-3 py-2 mb-3 flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[12px] text-emerald-900">
                      They&rsquo;ve accepted. The conversation is open — keep chatting in-app or by email.
                    </p>
                    {item.conversation?.id && (
                      <Link
                        href={`/dashboard/conversations/${item.conversation.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1 text-[11px] font-medium transition-colors flex-shrink-0"
                      >
                        Open conversation →
                      </Link>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="tabular-nums">
                    Sent {new Date(item.submittedAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  {item.status === 'SUBMITTED' && (
                    <button
                      type="button"
                      onClick={() => handleWithdraw(item.id)}
                      disabled={withdrawingId === item.id}
                      className="text-rose-700 hover:text-rose-800 underline decoration-rose-200 hover:decoration-rose-400 underline-offset-2 disabled:opacity-50"
                    >
                      {withdrawingId === item.id ? 'Withdrawing…' : 'Withdraw request'}
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function DashboardRequestsPage() {
  return (
    <Suspense fallback={null}>
      <RequestsList />
    </Suspense>
  );
}
