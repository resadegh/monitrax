'use client';

/**
 * useTrailStage — Phase 14.10 (2026-06-11)
 *
 * Lightweight client hook that returns the user's current TRAIL stage
 * letter ('T' | 'R' | 'A' | 'I' | 'L'). Reads from `/api/master-snapshot`
 * (the canonical SSOT — see `lib/services/masterFinancialService.ts`) and
 * applies the canonical `determineTrailStage` rules from
 * `lib/cfo/trailStage.ts`. Both surfaces that consume the stage today
 * (the My Guide hero `<TrailStageIndicator />` and the sidebar
 * `<TrailStagePill />`) can route through this hook so the detection
 * logic stays in one place.
 *
 * Failure-mode: silent. If the snapshot fetch fails or returns invalid
 * data, `stage` is `null` and consumers render the empty / loading
 * state — never a wrong stage badge. Mirrors the pattern in
 * `TrailStageIndicator`.
 *
 * The hook does not cache cross-component. If two surfaces use it,
 * `/api/master-snapshot` is fetched twice on first paint — that's fine
 * because the endpoint is fast and the response is small. A future PR
 * can hoist this into AuthContext / React Query if duplicate fetches
 * become a concern.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import {
  determineTrailStage,
  type TrailStage,
  type TrailStageInput,
} from '@/lib/cfo/trailStage';

export interface UseTrailStageResult {
  stage: TrailStage | null;
  loading: boolean;
}

export function useTrailStage(): UseTrailStageResult {
  const { token } = useAuth();
  const [stage, setStage] = useState<TrailStage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    fetch('/api/master-snapshot', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        // Tolerate both the wrapped {success, data} envelope and raw
        // payload shapes — same defensive read as TrailStageIndicator.
        if (!(json?.success || json?.data || json?.netWorth !== undefined)) {
          setLoading(false);
          return;
        }
        const d = json.data || json;
        const input: TrailStageInput = {
          hasAccounts:
            (d.accounts?.length || 0) > 0 || (d.netWorth?.totalAssets || 0) > 0,
          monthlyCashflow:
            d.cashflow?.netMonthlyCashflow ?? d.cashflow?.monthlySurplus ?? 0,
          emergencyFundMonths: d.emergencyFund?.monthsCovered ?? 0,
          hasInvestments:
            (d.investments?.totalValue || 0) > 0 || (d.properties?.length || 0) > 0,
          healthScore: d.healthScore?.score ?? d.health?.score ?? 0,
        };
        setStage(determineTrailStage(input));
      })
      .catch(() => {
        // Silent — pill / hero render their empty / loading state.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return { stage, loading };
}
