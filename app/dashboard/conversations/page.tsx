'use client';

/**
 * Phase 32C PR4d — Consumer-side conversations list.
 *
 * Route: `/dashboard/conversations`
 *
 * Lists all the user's active conversations with professionals. Click a
 * row → drill into `/dashboard/conversations/[id]`.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Conversation {
  id: string;
  subject: string;
  lastMessageAt: string;
  isClosed: boolean;
  organization: { id: string; name: string; profession: string | null };
  messages: Array<{ body: string; createdAt: string; senderRole: string }>;
  participants: Array<{ lastReadAt: string | null; hiddenFromUser: boolean }>;
}

export default function DashboardConversationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/conversations', { cache: 'no-store' });
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
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">Conversations</h1>
        <p className="mt-1 text-[14px] text-slate-600 max-w-2xl">
          Your active engagements with professionals. In-app messages and email replies land in the same thread.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 px-4 py-3 text-[13px] text-rose-700 mb-6">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl bg-slate-100 animate-pulse h-20" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-white/60 ring-1 ring-slate-200/70">
          <p className="text-[15px] text-slate-700 mb-3">No active conversations.</p>
          <p className="text-[12px] text-slate-500 mb-4">
            Conversations are created when a professional accepts your request.
          </p>
          <Link
            href="/marketplace"
            className="inline-flex items-center rounded-full bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 text-[13px] font-medium transition-colors"
          >
            Browse professionals →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((conv) => {
            const lastMessage = conv.messages[0];
            const lastReadAt = conv.participants[0]?.lastReadAt;
            const hasUnread =
              lastMessage &&
              (!lastReadAt || new Date(lastMessage.createdAt) > new Date(lastReadAt));
            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => router.push(`/dashboard/conversations/${conv.id}`)}
                className="w-full text-left rounded-2xl bg-white ring-1 ring-slate-200 hover:ring-slate-300 hover:shadow-sm transition-all p-4"
              >
                <div className="flex items-start justify-between gap-4 mb-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      {hasUnread && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" aria-label="Unread" />
                      )}
                      <div className="text-[14px] font-semibold text-slate-900 truncate">
                        {conv.organization.name}
                      </div>
                    </div>
                    <div className="text-[12px] text-slate-600 truncate">{conv.subject}</div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
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
                    {lastMessage.senderRole === 'CONSUMER' ? 'You: ' : ''}
                    {lastMessage.body}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
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
