'use client';

/**
 * Phase 32C PR4d — Consumer-side conversation thread.
 *
 * Route: `/dashboard/conversations/[id]`
 *
 * Mirrors the portal-side conversation page but from the consumer
 * perspective (sender role: CONSUMER, counterparty: the org's display
 * name + member who responded).
 */

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { ConversationThread } from '@/components/conversations/ConversationThread';

interface ConversationDetail {
  id: string;
  subject: string;
  isClosed: boolean;
  lastMessageAt: string;
  organization: { id: string; name: string; profession: string | null };
  request: {
    id: string;
    status: string;
    contextLabel: string | null;
    listing: { displayName: string; publicSlug: string };
  } | null;
  participants: Array<{
    id: string;
    role: 'CONSUMER' | 'PROFESSIONAL' | 'AI_HELPER';
    user: { id: string; name: string; email: string } | null;
    member: {
      id: string;
      user: { id: string; name: string; email: string };
    } | null;
  }>;
}

export default function DashboardConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<ConversationDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/conversations/${id}`, { cache: 'no-store' });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Failed to load conversation');
      }
      const json = await res.json();
      setData(json.data?.conversation ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversation');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const myParticipant = data?.participants.find((p) => p.role === 'CONSUMER')?.user;
  const counterpartyMember = data?.participants.find((p) => p.role === 'PROFESSIONAL')?.member?.user;

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="rounded-2xl bg-slate-100 animate-pulse h-72" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          <p className="text-[14px] text-rose-700">{error ?? 'Conversation not found'}</p>
          <Link href="/dashboard/conversations" className="mt-4 inline-block text-[13px] text-emerald-700 underline">
            ← Back to conversations
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-6">
      <Link href="/dashboard/conversations" className="text-[13px] text-slate-500 hover:text-slate-900">
        ← Conversations
      </Link>

      <div>
        <h1 className="text-[24px] font-semibold tracking-tight text-slate-900 leading-tight">
          {data.subject}
        </h1>
        <p className="mt-1 text-[13px] text-slate-600">
          with{' '}
          <span className="font-medium text-slate-900">{data.organization.name}</span>
          {counterpartyMember && (
            <span className="text-slate-500"> · {counterpartyMember.name}</span>
          )}
        </p>
        {data.request?.listing && (
          <p className="mt-1 text-[11px] text-slate-500">
            <Link href={`/marketplace/${data.request.listing.publicSlug}`} className="underline decoration-slate-200 hover:decoration-slate-400">
              View {data.request.listing.displayName} on the marketplace
            </Link>
          </p>
        )}
      </div>

      <ConversationThread
        conversationId={id}
        viewerRole="CONSUMER"
        viewerName={myParticipant?.name ?? 'You'}
        counterpartyName={counterpartyMember?.name ?? data.organization.name}
        isClosed={data.isClosed}
      />

      <p className="text-[11px] text-slate-400 text-center pb-4">
        This conversation is archived for 7 years per AFSL compliance · {data.organization.name}
      </p>
    </div>
  );
}
