/**
 * useUnreadFeedback — Phase 33g.5
 *
 * Tracks unread feedback messages for the current user. Drives the count
 * badge on `<FeedbackButton />` (top-right floating affordance) plus
 * per-thread "unread" dots in the drawer's Your-threads list.
 *
 * No schema change. Unread-tracking is client-side via localStorage:
 *   - Key: `monitrax-feedback-last-opened-at-${userId}`
 *   - Value: ISO timestamp of the last time the user opened the drawer
 *   - A thread is "unread" when:
 *       updatedAt > lastOpenedAt
 *       AND last-message author is NOT the user (i.e. admin or AI replied
 *       since the user last looked)
 *
 * Tradeoff: doesn't sync across devices. Acceptable for v1 — the user
 * always sees the message itself when they open the drawer; the badge is
 * just the cue. Server-side `lastSeenByUserAt` is a Phase 33g.6 candidate
 * once cross-device sync becomes a problem.
 *
 * Polling: 30 seconds. Minimal DB load — the GET endpoint is already a
 * single SELECT for the user's threads (audience-scoped at the service
 * layer). Pauses when the document is hidden (background tab).
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';

const POLL_INTERVAL_MS = 30_000;

const lastOpenedKey = (userId: string): string =>
  `monitrax-feedback-last-opened-at-${userId}`;

interface ThreadShape {
  id: string;
  updatedAt: string;
  messages: Array<{
    id: string;
    authorRole: 'ADVISER' | 'CONSUMER' | 'MONITRAX_ADMIN' | 'CLAUDE_AI';
    createdAt: string;
  }>;
}

export interface UnreadFeedbackResult {
  /** Total unread thread count — drives the badge number on FeedbackButton. */
  unreadCount: number;
  /** Set of thread IDs that have unread messages — drives per-row dots in the drawer list. */
  unreadThreadIds: Set<string>;
  /** Mark "everything seen now" — call on drawer open. Persists to localStorage. */
  markSeen: () => void;
}

const isUserAuthored = (role: ThreadShape['messages'][number]['authorRole']): boolean =>
  role === 'CONSUMER' || role === 'ADVISER';

export function useUnreadFeedback(): UnreadFeedbackResult {
  const { user, token } = useAuth();
  const [threads, setThreads] = useState<ThreadShape[]>([]);
  const [lastOpenedAt, setLastOpenedAt] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Hydrate `lastOpenedAt` from localStorage on mount (per-user keyed so
  // browser swap doesn't leak unread state between accounts).
  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(lastOpenedKey(user.id));
    if (stored) {
      const parsed = new Date(stored);
      if (!isNaN(parsed.getTime())) {
        setLastOpenedAt(parsed);
        return;
      }
    }
    // First-time user: treat "right now" as the watermark so we don't
    // surface every historical thread as unread.
    const now = new Date();
    window.localStorage.setItem(lastOpenedKey(user.id), now.toISOString());
    setLastOpenedAt(now);
  }, [user?.id]);

  const headers = useMemo<Record<string, string>>(() => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }, [token]);

  const fetchThreads = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/portal/feedback', { headers, cache: 'no-store' });
      if (!res.ok) return;
      const j = (await res.json()) as { data: { threads: ThreadShape[] } };
      setThreads(j.data?.threads ?? []);
    } catch {
      // ignore
    }
  }, [headers, token]);

  // Initial fetch + 30s polling. Pause when tab hidden (saves Vercel
  // function invocations on inactive tabs).
  useEffect(() => {
    if (!token) return;
    void fetchThreads();
    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        if (document.visibilityState !== 'hidden') {
          void fetchThreads();
        }
      }, POLL_INTERVAL_MS);
    };
    const handleVisibility = () => {
      if (document.visibilityState !== 'hidden') {
        // Refresh immediately on tab return.
        void fetchThreads();
      }
    };
    startInterval();
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [token, fetchThreads]);

  const markSeen = useCallback(() => {
    if (!user?.id || typeof window === 'undefined') return;
    const now = new Date();
    window.localStorage.setItem(lastOpenedKey(user.id), now.toISOString());
    setLastOpenedAt(now);
  }, [user?.id]);

  const { unreadCount, unreadThreadIds } = useMemo(() => {
    const ids = new Set<string>();
    if (!lastOpenedAt) return { unreadCount: 0, unreadThreadIds: ids };
    for (const t of threads) {
      const updated = new Date(t.updatedAt);
      if (updated <= lastOpenedAt) continue;
      const last = t.messages[t.messages.length - 1];
      if (!last) continue;
      // Only count threads where the latest message is from the *other side*
      // (admin or AI). A user-authored last message means we sent it — no
      // unread state for our own posts.
      if (isUserAuthored(last.authorRole)) continue;
      ids.add(t.id);
    }
    return { unreadCount: ids.size, unreadThreadIds: ids };
  }, [threads, lastOpenedAt]);

  return { unreadCount, unreadThreadIds, markSeen };
}
