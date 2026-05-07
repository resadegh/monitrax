/**
 * Phase 42 PR6.5e — Pending-reconciliation count hook.
 *
 * Exposes the live `CATEGORISE` count from
 * `/api/bookkeeping/engagement/pending-actions` so persistent
 * surfaces (sidebar badges, header chips) can render a
 * Slack/Mail-style count without re-implementing the aggregator.
 *
 * Per CLAUDE.md §12.3 — composes the existing route. No parallel
 * data path.
 *
 * **Auth note (2026-05-08 fix):** the Firebase ID token lives in
 * the `<AuthContext>` provider via `useAuth().token`, NOT in
 * `localStorage`. Reading `localStorage.getItem('token')`
 * returned null for users authed via Firebase, sending requests
 * with no Bearer header → server returned 401 silently and the
 * badge never rendered. The hook now consumes the auth context
 * directly, matching the pattern used by `<DashboardLayout>` for
 * its own data fetches.
 */

'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';

interface PendingActionsResult {
  actions: Array<{ kind: string; count: number }>;
  totalCount: number;
  alreadyShownToday: boolean;
  optedOut: boolean;
}

export interface PendingReconciliationCount {
  /** Number of uncategorised transactions in the current month. */
  count: number;
  /** True while the first fetch is in flight. */
  loading: boolean;
}

/**
 * Render-cap helper — keeps the sidebar badge from blowing out
 * to 4 digits on edge-case users.
 */
export function formatReconciliationCount(n: number): string {
  if (n <= 0) return '';
  if (n > 99) return '99+';
  return String(n);
}

export function usePendingReconciliationCount(): PendingReconciliationCount {
  const { token } = useAuth();
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Wait until the auth context has resolved a token — fetching
    // before that returns 401 from the bookkeeping route.
    if (!token) {
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/bookkeeping/engagement/pending-actions', {
          headers: { Authorization: `Bearer ${token}` },
          credentials: 'include',
        });
        if (cancelled) return;
        if (!res.ok) {
          setLoading(false);
          return;
        }
        const json = (await res.json()) as { success?: boolean; data?: PendingActionsResult };
        if (cancelled || !json?.data) {
          setLoading(false);
          return;
        }
        const categorise = json.data.actions.find((a) => a.kind === 'CATEGORISE');
        setCount(categorise ? categorise.count : 0);
        setLoading(false);
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return { count, loading };
}
