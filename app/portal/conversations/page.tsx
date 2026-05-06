'use client';

/**
 * Phase 32C PR4d — Adviser-side conversations inbox.
 *
 * Route: `/portal/conversations`
 *
 * Lists all conversations for the caller's current org, ordered by most-
 * recent message. Each row shows the consumer's name + last message
 * preview + channel indicator (in-app vs email-bridged) + relative time.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useOrganization } from '@/lib/portal';
import { PracticeGlassCard } from '@/components/portal/practice';
import { PortalPageHero } from '@/components/shell';
import { getPracticeProfessionConfig } from '@/lib/portal/practice';
import type { OrganizationType } from '@prisma/client';

interface InboxConversation {
  id: string;
  subject: string;
  lastMessageAt: string;
  isClosed: boolean;
  request: {
    id: string;
    status: string;
    requester: { id: string; name: string; email: string };
    listing: { displayName: string };
  } | null;
  participants: Array<{
    user: { id: string; name: string; email: string } | null;
  }>;
  messages: Array<{
    body: string;
    createdAt: string;
    senderRole: string;
    channel: string;
  }>;
}

export default function PortalConversationsPage() {
  const router = useRouter();
  const { currentOrg } = useOrganization();
  const [items, setItems] = useState<InboxConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orgId = currentOrg?.id ?? null;
  const profession =
    (currentOrg?.profession as OrganizationType | undefined) ??
    (currentOrg?.organizationType as OrganizationType | undefined) ??
    'FINANCIAL_ADVISOR';
  const practiceLabel = getPracticeProfessionConfig(profession).practiceLabel;

  const load = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/conversations?organizationId=${orgId}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Failed to load conversations');
      }
      const json = await res.json();
      setItems(json.data?.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-8">
        <PortalPageHero
          atmosphere="violet"
          greetingName={currentOrg?.name?.split(' ')[0] ?? 'there'}
          practiceLabel={practiceLabel}
          title="Conversations"
          subtitle="All your active engagements. In-app messages and email replies land in the same thread."
        />

        {error && (
          <PracticeGlassCard padding="md" accentTone="critical">
            <p className="text-[14px] text-rose-700">{error}</p>
          </PracticeGlassCard>
        )}

        {isLoading ? (
          <PracticeGlassCard padding="lg">
            <p className="text-[14px] text-slate-500">Loading conversations…</p>
          </PracticeGlassCard>
        ) : items.length === 0 ? (
          <PracticeGlassCard padding="lg">
            <p className="text-[14px] text-slate-700">
              No active conversations yet.
            </p>
            <p className="mt-2 text-[12px] text-slate-500">
              Conversations are auto-created when you accept a marketplace request.{' '}
              <Link href="/portal/requests" className="text-emerald-700 underline">
                Open inbox →
              </Link>
            </p>
          </PracticeGlassCard>
        ) : (
          <div className="space-y-2">
            {items.map((conv) => {
              const consumer = conv.participants[0]?.user;
              const lastMessage = conv.messages[0];
              const lastChannel = lastMessage?.channel ?? 'IN_APP';
              return (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => router.push(`/portal/conversations/${conv.id}`)}
                  className="w-full text-left rounded-2xl bg-white ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-sm transition-all p-4"
                >
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-medium text-[13px] flex-shrink-0">
                        {(consumer?.name ?? '??').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-slate-900 truncate">
                          {consumer?.name ?? 'Unknown'}
                        </div>
                        <div className="text-[12px] text-slate-600 truncate">{conv.subject}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {lastChannel === 'EMAIL_IN' && (
                        <span className="inline-flex items-center rounded-full bg-amber-50 ring-1 ring-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-800">
                          via email
                        </span>
                      )}
                      {conv.isClosed && (
                        <span className="inline-flex items-center rounded-full bg-slate-100 ring-1 ring-slate-200 px-2 py-0.5 text-[10px] font-medium text-slate-700">
                          Closed
                        </span>
                      )}
                      <span className="text-[11px] text-slate-500 tabular-nums">
                        {formatRelative(conv.lastMessageAt)}
                      </span>
                    </div>
                  </div>
                  {lastMessage && (
                    <p className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed">
                      {lastMessage.senderRole === 'PROFESSIONAL' ? 'You: ' : ''}
                      {lastMessage.body}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'now';
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)}h ago`;
  if (ms < 604_800_000) return `${Math.round(ms / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
}
