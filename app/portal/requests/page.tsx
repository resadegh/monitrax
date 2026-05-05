'use client';

/**
 * Phase 32C PR4c — Adviser inbox.
 *
 * Route: `/portal/requests`
 *
 * Lists incoming marketplace requests for the caller's current org. Defaults
 * to SUBMITTED filter (the queue that needs the adviser's attention). Click
 * a row → drill into `/portal/requests/[id]` for accept / decline.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useOrganization } from '@/lib/portal';
import { PracticeGlassCard, PracticeHeader } from '@/components/portal/practice';
import { getPracticeProfessionConfig } from '@/lib/portal/practice';
import type { OrganizationType } from '@prisma/client';

interface InboxRequest {
  id: string;
  contextLabel: string | null;
  question: string;
  status: string;
  submittedAt: string;
  respondedAt: string | null;
  declineReason: string | null;
  leadFeeTier: string | null;
  leadFeeAmount: string | null;
  clientLinkId: string | null;
  requester: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
  };
  listing: {
    id: string;
    displayName: string;
    publicSlug: string;
    organizationId: string;
  };
  respondedByMember: {
    id: string;
    user: { id: string; name: string; email: string };
  } | null;
}

const STATUS_FILTERS: Array<[string, string]> = [
  ['SUBMITTED', 'Awaiting response'],
  ['ACCEPTED', 'Accepted'],
  ['DECLINED', 'Declined'],
  ['WITHDRAWN', 'Withdrawn'],
  ['', 'All'],
];

const STATUS_PILL: Record<string, { label: string; classes: string }> = {
  SUBMITTED: { label: 'Awaiting', classes: 'bg-amber-50 text-amber-800 ring-amber-200' },
  ACCEPTED: { label: 'Accepted', classes: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  DECLINED: { label: 'Declined', classes: 'bg-rose-50 text-rose-800 ring-rose-200' },
  WITHDRAWN: { label: 'Withdrawn', classes: 'bg-slate-100 text-slate-700 ring-slate-200' },
  EXPIRED: { label: 'Expired', classes: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

export default function PortalRequestsInboxPage() {
  const router = useRouter();
  const { currentOrg } = useOrganization();
  const [items, setItems] = useState<InboxRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState('SUBMITTED');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orgId = currentOrg?.id ?? null;
  const profession = (currentOrg?.profession as OrganizationType | undefined)
    ?? (currentOrg?.organizationType as OrganizationType | undefined)
    ?? 'FINANCIAL_ADVISOR';
  const practiceLabel = getPracticeProfessionConfig(profession).practiceLabel;

  const load = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('organizationId', orgId);
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/portal/professional-requests?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Failed to load inbox');
      }
      const json = await res.json();
      setItems(json.data?.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inbox');
    } finally {
      setIsLoading(false);
    }
  }, [orgId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const submittedCount = useMemo(
    () => items.filter((i) => i.status === 'SUBMITTED').length,
    [items],
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-8">
        <PracticeHeader
          organisationName={currentOrg?.name?.split(' ')[0] ?? 'there'}
          profession={profession}
          practiceLabel={practiceLabel}
        />

        <div>
          <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">
            Marketplace inbox
          </h1>
          <p className="mt-1 text-[14px] text-slate-600 max-w-2xl">
            New requests from the public marketplace. Accept to start the engagement (lead fee billed) or decline with a reason.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`inline-flex items-center rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${
                statusFilter === value
                  ? 'bg-slate-900 text-white'
                  : 'bg-white ring-1 ring-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {label}
              {value === 'SUBMITTED' && submittedCount > 0 && statusFilter !== 'SUBMITTED' && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold px-1">
                  {submittedCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <PracticeGlassCard padding="md" accentTone="critical">
            <p className="text-[14px] text-rose-700">{error}</p>
          </PracticeGlassCard>
        )}

        {isLoading ? (
          <PracticeGlassCard padding="lg">
            <p className="text-[14px] text-slate-500">Loading inbox…</p>
          </PracticeGlassCard>
        ) : items.length === 0 ? (
          <PracticeGlassCard padding="lg">
            <p className="text-[14px] text-slate-700">
              No {statusFilter ? STATUS_FILTERS.find(([v]) => v === statusFilter)?.[1].toLowerCase() : ''} requests.
            </p>
            <p className="mt-2 text-[12px] text-slate-500">
              Marketplace requests appear here once your listing is approved and consumers start reaching out.{' '}
              <Link href="/portal/marketplace/listing" className="text-emerald-700 underline">
                Review your listing →
              </Link>
            </p>
          </PracticeGlassCard>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => router.push(`/portal/requests/${item.id}`)}
                className="w-full text-left rounded-2xl bg-white ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-sm transition-all p-4"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-medium text-[13px] flex-shrink-0">
                      {item.requester.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[14px] font-semibold text-slate-900 truncate">
                        {item.requester.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">{item.requester.email}</div>
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full ring-1 ring-inset px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${STATUS_PILL[item.status]?.classes ?? STATUS_PILL.SUBMITTED.classes}`}>
                    {STATUS_PILL[item.status]?.label ?? item.status}
                  </span>
                </div>
                <p className="text-[13px] text-slate-700 leading-relaxed line-clamp-2 mb-3">{item.question}</p>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="tabular-nums">
                    {new Date(item.submittedAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    {item.contextLabel && (
                      <span className="ml-2 text-emerald-700">· {item.contextLabel}</span>
                    )}
                  </span>
                  {item.leadFeeAmount && (
                    <span className="tabular-nums text-slate-700">
                      Lead fee: AU${parseFloat(item.leadFeeAmount).toFixed(0)}
                      {item.leadFeeTier && (
                        <span className="text-slate-400"> ({item.leadFeeTier.toLowerCase()})</span>
                      )}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
