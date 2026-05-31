/**
 * useWealthExplorerData — load the user's real entity structure for the
 * Wealth Universe canvas.
 *
 * Source of truth: `/api/entities` → `legalEntityService.listEntitiesForUser`.
 * The hook fetches once on mount (and on refetch); the layout function in
 * `wealthExplorerLayout.ts` turns the raw `LegalEntitySummary[]` into
 * positioned nodes + derived relationships for the canvas.
 *
 * Asset detail (per-entity properties / investments / accounts) is fetched
 * on demand by `EntityDetailPanel` when the user clicks a tile — we don't
 * pre-load all assets here because the canvas only needs counts at this
 * level of zoom.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import {
  layoutWealthExplorer,
  type LayoutEntityInput,
  type LayoutResult,
} from '@/lib/data/wealthExplorerLayout';

interface UseWealthExplorerDataResult {
  layout: LayoutResult | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useWealthExplorerData(): UseWealthExplorerDataResult {
  const { token } = useAuth();
  const [layout, setLayout] = useState<LayoutResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch('/api/entities', { headers });
      if (!res.ok) {
        throw new Error(`Failed to load entities: ${res.status}`);
      }
      const json = await res.json();
      // The /api/entities response wraps the array as `entities`.
      const entitiesRaw: LayoutEntityInput[] = Array.isArray(json)
        ? json
        : json.entities ?? json.data ?? [];
      const result = layoutWealthExplorer(entitiesRaw);
      setLayout(result);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Unknown error';
      setError(message);
      setLayout(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { layout, loading, error, refetch: fetchData };
}
