'use client';

/**
 * Phase 32C PR4c — Adviser request detail + accept/decline action.
 *
 * Route: `/portal/requests/[id]`
 *
 * Shows the full request: requester (with snapshot-context preview if shared),
 * question text, lead-fee tier + amount, lifecycle metadata. Accept and
 * Decline buttons live at the bottom; declining requires a reason text.
 *
 * Read-only for VIEWER role. Other roles can act.
 *
 * Note: PR4d will add the in-app conversation thread under this view once a
 * request is ACCEPTED. For now, accepted requests show the link to the
 * client's drill-in page (`/portal/clients/[id]/view`) so the engagement
 * picks up where the existing Phase 32B drill-in left off.
 */

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useOrganization } from '@/lib/portal';
import { useAuth } from '@/lib/context/AuthContext';
import { PracticeGlassCard } from '@/components/portal/practice';

interface RequestDetail {
  id: string;
  contextLabel: string | null;
  question: string;
  snapshotContextJson: unknown;
  status: string;
  submittedAt: string;
  respondedAt: string | null;
  declineReason: string | null;
  leadFeeTier: string | null;
  leadFeeAmount: string | null;
  leadFeeChargedAt: string | null;
  clientLinkId: string | null;
  conversation: { id: string } | null;
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

const STATUS_PILL: Record<string, { label: string; classes: string }> = {
  SUBMITTED: { label: 'Awaiting your response', classes: 'bg-amber-50 text-amber-800 ring-amber-200' },
  ACCEPTED: { label: 'Accepted', classes: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  DECLINED: { label: 'Declined', classes: 'bg-rose-50 text-rose-800 ring-rose-200' },
  WITHDRAWN: { label: 'Withdrawn by user', classes: 'bg-slate-100 text-slate-700 ring-slate-200' },
  EXPIRED: { label: 'Expired', classes: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

export default function PortalRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { currentOrg } = useOrganization();
  const { token } = useAuth();
  // 2026-05-18 — auth header required; without it the 401 trips
  // SessionExpiryHandler → logout. See Tech Debt #20.
  const authHeaders: HeadersInit | undefined = token
    ? { Authorization: `Bearer ${token}` }
    : undefined;

  const [data, setData] = useState<RequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  const orgId = currentOrg?.id ?? null;
  const userRole = currentOrg?.role ?? 'VIEWER';
  const canRespond = userRole !== 'VIEWER';

  const load = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set('organizationId', orgId);
      const res = await fetch(`/api/portal/professional-requests/${id}?${params.toString()}`, {
        cache: 'no-store',
        headers: authHeaders,
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Failed to load request');
      }
      const json = await res.json();
      setData(json.data?.request ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load request');
    } finally {
      setIsLoading(false);
    }
  }, [id, orgId, authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const respond = useCallback(
    async (action: 'accept' | 'decline') => {
      if (!orgId) return;
      setActionInFlight(action);
      setError(null);
      try {
        const res = await fetch(`/api/portal/professional-requests/${id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            action,
            organizationId: orgId,
            ...(action === 'decline' ? { declineReason } : {}),
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error?.message ?? `${action} failed`);
        setData(json.data.request);
        setShowDeclineForm(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : `${action} failed`);
      } finally {
        setActionInFlight(null);
      }
    },
    [id, orgId, declineReason],
  );

  if (isLoading) {
    return (
      <div className="min-h-screen p-8">
        <PracticeGlassCard padding="lg">
          <p className="text-[14px] text-slate-500">Loading request…</p>
        </PracticeGlassCard>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="min-h-screen p-8">
        <PracticeGlassCard padding="lg">
          <p className="text-[14px] text-rose-700">{error ?? 'Request not found'}</p>
          <button
            type="button"
            onClick={() => router.push('/portal/requests')}
            className="mt-3 text-[13px] text-emerald-700 underline"
          >
            ← Back to inbox
          </button>
        </PracticeGlassCard>
      </div>
    );
  }

  const isPending = data.status === 'SUBMITTED';
  const sharedMetricsCount = data.snapshotContextJson && typeof data.snapshotContextJson === 'object'
    ? Object.keys(data.snapshotContextJson as Record<string, unknown>).length
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-6">
        <Link href="/portal/requests" className="text-[13px] text-emerald-700 hover:underline">
          ← Back to inbox
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-semibold tracking-tight text-slate-900">
              Request from {data.requester.name}
            </h1>
            <p className="mt-1 text-[12px] text-slate-500">
              Sent {new Date(data.submittedAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              {data.contextLabel && <span> · context: {data.contextLabel}</span>}
            </p>
          </div>
          <span className={`inline-flex items-center rounded-full ring-1 ring-inset px-3 py-1 text-[12px] font-medium ${STATUS_PILL[data.status]?.classes ?? STATUS_PILL.SUBMITTED.classes}`}>
            {STATUS_PILL[data.status]?.label ?? data.status}
          </span>
        </div>

        {error && (
          <PracticeGlassCard padding="md" accentTone="critical">
            <p className="text-[14px] text-rose-700">{error}</p>
          </PracticeGlassCard>
        )}

        <PracticeGlassCard padding="lg">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Question</h2>
          <p className="text-[15px] text-slate-800 leading-relaxed whitespace-pre-wrap">{data.question}</p>
        </PracticeGlassCard>

        <PracticeGlassCard padding="lg">
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-slate-500 mb-3">Requester</h2>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-medium text-[15px]">
              {data.requester.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-[14px] font-semibold text-slate-900">{data.requester.name}</div>
              <div className="text-[12px] text-slate-500">{data.requester.email}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Monitrax member since {new Date(data.requester.createdAt).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
          {sharedMetricsCount > 0 ? (
            <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-100 px-3.5 py-2.5 text-[12px] text-emerald-900">
              <strong>Headline metrics shared.</strong> Once you accept, you&rsquo;ll see their canonical financial snapshot via the
              standard client drill-in.
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 ring-1 ring-slate-200 px-3.5 py-2.5 text-[12px] text-slate-700">
              No financial context shared at this stage. You can request more detail before responding.
            </div>
          )}
        </PracticeGlassCard>

        {data.leadFeeAmount && (
          <PracticeGlassCard padding="md">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-500">Lead fee</div>
                <div className="text-[18px] font-semibold text-slate-900 mt-1">
                  AU${parseFloat(data.leadFeeAmount).toFixed(2)}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  {data.leadFeeTier?.toLowerCase()} tier · resolved at submit time
                </div>
              </div>
              {data.leadFeeChargedAt ? (
                <span className="text-[11px] text-emerald-700">
                  Recorded {new Date(data.leadFeeChargedAt).toLocaleDateString('en-AU')}
                </span>
              ) : (
                <span className="text-[11px] text-slate-500">Charged on accept</span>
              )}
            </div>
          </PracticeGlassCard>
        )}

        {data.status === 'DECLINED' && data.declineReason && (
          <PracticeGlassCard padding="md" accentTone="critical">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-rose-700 mb-2">Decline reason</h3>
            <p className="text-[14px] text-slate-700 leading-relaxed">{data.declineReason}</p>
            {data.respondedByMember && (
              <p className="mt-2 text-[11px] text-slate-500">
                Responded by {data.respondedByMember.user.name}
              </p>
            )}
          </PracticeGlassCard>
        )}

        {data.status === 'ACCEPTED' && data.clientLinkId && (
          <PracticeGlassCard padding="md" accentTone="opportunity">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-emerald-700 mb-2">Engagement created</h3>
            <p className="text-[14px] text-slate-700 leading-relaxed mb-3">
              The client invitation was sent. Once they grant consent, they&rsquo;ll appear in your client book and you&rsquo;ll see their canonical snapshot.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {data.conversation?.id && (
                <Link
                  href={`/portal/conversations/${data.conversation.id}`}
                  className="inline-flex items-center rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1.5 text-[12px] font-medium transition-colors"
                >
                  Open conversation →
                </Link>
              )}
              <Link
                href={`/portal/clients/${data.clientLinkId}/view`}
                className="inline-flex items-center rounded-full bg-white ring-1 ring-emerald-200 hover:bg-emerald-50 text-emerald-800 px-3 py-1.5 text-[12px] font-medium transition-colors"
              >
                Open client view →
              </Link>
            </div>
          </PracticeGlassCard>
        )}

        {isPending && canRespond && !showDeclineForm && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => respond('accept')}
              disabled={actionInFlight !== null}
              className="inline-flex items-center rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {actionInFlight === 'accept' ? 'Accepting…' : 'Accept'}
            </button>
            <button
              type="button"
              onClick={() => setShowDeclineForm(true)}
              disabled={actionInFlight !== null}
              className="inline-flex items-center rounded-full bg-white ring-1 ring-slate-200 hover:bg-slate-50 text-slate-900 px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50"
            >
              Decline…
            </button>
          </div>
        )}

        {isPending && canRespond && showDeclineForm && (
          <PracticeGlassCard padding="md">
            <label className="block">
              <span className="block text-[12px] font-medium text-slate-700 mb-1.5">Decline reason (sent to user)</span>
              <textarea
                className="block w-full rounded-xl border-0 bg-white py-2.5 px-3.5 text-[14px] text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-emerald-500 transition-shadow min-h-[100px]"
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="e.g. Not currently taking on new clients in this discipline. We recommend trying [...] who specialises in [...]."
                maxLength={500}
              />
              <p className="mt-1 text-[11px] text-slate-400 tabular-nums">{declineReason.length} / 500 · min 5 chars</p>
            </label>
            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={() => respond('decline')}
                disabled={actionInFlight !== null || declineReason.trim().length < 5}
                className="inline-flex items-center rounded-full bg-rose-700 hover:bg-rose-800 text-white px-4 py-2 text-[13px] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionInFlight === 'decline' ? 'Declining…' : 'Confirm decline'}
              </button>
              <button
                type="button"
                onClick={() => setShowDeclineForm(false)}
                disabled={actionInFlight !== null}
                className="inline-flex items-center rounded-full hover:bg-slate-100 px-3 py-1.5 text-[12px] text-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </PracticeGlassCard>
        )}

        {!canRespond && isPending && (
          <PracticeGlassCard padding="md">
            <p className="text-[12px] text-slate-500">
              Your role is read-only. An OWNER, ADMIN, or ADVISOR member can accept or decline.
            </p>
          </PracticeGlassCard>
        )}
      </div>
    </div>
  );
}
