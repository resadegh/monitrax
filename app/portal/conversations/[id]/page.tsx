'use client';

/**
 * Phase 32C PR4d — Adviser-side conversation thread.
 *
 * Route: `/portal/conversations/[id]`
 *
 * Shows the conversation header (subject, requester profile, request
 * link if any), the thread (`<ConversationThread />`), and a small
 * sidebar with the consumer's headline metrics summary if shared.
 */

import { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useOrganization } from '@/lib/portal';
import { ConversationThread } from '@/components/conversations/ConversationThread';
import { PracticeGlassCard } from '@/components/portal/practice';

interface ConversationDetail {
  id: string;
  subject: string;
  isClosed: boolean;
  closedAt: string | null;
  lastMessageAt: string;
  organization: { id: string; name: string };
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

export default function PortalConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { currentOrg } = useOrganization();
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

  const consumer = data?.participants.find((p) => p.role === 'CONSUMER')?.user;
  const myMemberName = currentOrg?.name ?? 'Your team';

  if (isLoading) {
    return (
      <div className="min-h-screen p-8">
        <PracticeGlassCard padding="lg">
          <p className="text-[14px] text-slate-500">Loading conversation…</p>
        </PracticeGlassCard>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen p-8">
        <PracticeGlassCard padding="lg">
          <p className="text-[14px] text-rose-700">{error ?? 'Conversation not found'}</p>
          <Link href="/portal/conversations" className="mt-3 inline-block text-[13px] text-emerald-700 underline">
            ← Back to inbox
          </Link>
        </PracticeGlassCard>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-6">
        <Link href="/portal/conversations" className="text-[13px] text-emerald-700 hover:underline">
          ← Back to conversations
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold tracking-tight text-slate-900 leading-tight">
              {data.subject}
            </h1>
            <p className="mt-1 text-[13px] text-slate-600">
              with <span className="font-medium text-slate-900">{consumer?.name ?? 'Unknown'}</span>
              <span className="text-slate-500"> · {consumer?.email}</span>
            </p>
            {data.request && (
              <p className="mt-1 text-[11px] text-slate-500">
                From marketplace request{data.request.contextLabel ? ` · ${data.request.contextLabel}` : ''}
                {data.request.id && (
                  <>
                    {' · '}
                    <Link href={`/portal/requests/${data.request.id}`} className="text-emerald-700 underline">
                      View original request
                    </Link>
                  </>
                )}
              </p>
            )}
          </div>
          {data.isClosed && (
            <span className="inline-flex items-center rounded-full bg-slate-100 ring-1 ring-slate-200 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
              Closed
            </span>
          )}
        </div>

        <ConversationThread
          conversationId={id}
          viewerRole="PROFESSIONAL"
          viewerName={myMemberName}
          counterpartyName={consumer?.name ?? 'the client'}
          isClosed={data.isClosed}
        />

        <p className="text-[11px] text-slate-400 text-center pb-4">
          Conversation archived for 7 years per AFSL compliance · {data.organization.name}
        </p>
      </div>
    </div>
  );
}
