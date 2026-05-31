/**
 * useWealthExplorerData — load the user's wealth graph for the
 * Wealth Universe canvas.
 *
 * Source of truth: `/api/wealth-graph` → `getWealthGraphSnapshot`.
 * Returns entities + assets + relationships + ownership groups +
 * beneficial overrides — all in canvas-ready shape. The layout function
 * in `wealthExplorerLayout.ts` turns the snapshot into positioned
 * nodes + ribbons.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import {
  layoutWealthExplorer,
  type LayoutResult,
} from '@/lib/data/wealthExplorerLayout';
import type { WealthGraphSnapshot } from '@/lib/services/wealthGraphService';

interface UseWealthExplorerDataResult {
  layout: LayoutResult | null;
  /**
   * Phase 3 — raw snapshot exposed alongside the layout so consumers
   * needing source data (e.g. the detail panel's linked-assets list)
   * can read it without re-fetching. Same data, no extra request.
   */
  snapshot: WealthGraphSnapshot | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWealthExplorerData(): UseWealthExplorerDataResult {
  const { token } = useAuth();
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [snapshot, setSnapshot] = useState<WealthGraphSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/wealth-graph', { headers });
      if (!res.ok) {
        throw new Error(`Failed to load wealth graph: ${res.status}`);
      }
      const json = await res.json();
      const next: WealthGraphSnapshot | undefined = json.data;
      if (!next) {
        throw new Error('Empty wealth-graph response');
      }
      const result = layoutWealthExplorer(next);
      setSnapshot(next);
      setLayout(result);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setError(message);
      setLayout(null);
      setSnapshot(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { layout, snapshot, loading, error, refetch: fetchData };
}
