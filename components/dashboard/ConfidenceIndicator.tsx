/**
 * Phase 12 PR 3c.2e — ConfidenceIndicator.
 *
 * Small ⓘ chip rendered alongside any derived metric (net worth, liquid
 * cash, emergency fund, cashflow forecast, quick-metrics tiles) when
 * the underlying `Account.currentBalance` inputs are stale. The
 * staleness signal is computed by `getMasterFinancialSnapshot()` and
 * exposed on the snapshot's `staleness` block (PR 3c.2e, 2026-05-19) —
 * consumer surfaces import this primitive and pass the metadata
 * through.
 *
 * Visual: small amber chip with an info icon. On hover/tap, surfaces
 * the canonical staleness summary ("3 manual balances last updated 47
 * days ago") + a deep-link to Settings > Data Health (PR J) for the
 * user to act.
 *
 * Per CLAUDE.md §0:
 *   - architect: composes the canonical staleness signal — never
 *     re-derives the rule (single SSOT lives in
 *     `lib/services/masterFinancialService.ts` `staleness` block +
 *     mirrors `isBalanceStale` from `DataSourceChip.tsx`).
 *   - behaviour-psychologist: amber not red — informational, not
 *     alarming. Says "may be stale", not "is wrong". Lets the user
 *     trust the number while knowing its provenance.
 *   - financial-adviser: trust is the currency. A derived metric
 *     that's silently downstream of a 6-month-old manual entry is
 *     more dangerous than no metric at all.
 *   - designer: small, non-intrusive, sits next to the number rather
 *     than disrupting the visual hierarchy.
 *
 * Per CLAUDE.md §13.3: no balance amounts in the tooltip copy — only
 * the count of stale accounts + the oldest age in days. Aggregate-only.
 *
 * Renders nothing when `!staleness.anyStale` — every consumer can pass
 * the metadata unconditionally and let the primitive self-hide.
 */

'use client';

import Link from 'next/link';
import { Info } from 'lucide-react';

interface ConfidenceIndicatorProps {
  /**
   * The `staleness` block from `getMasterFinancialSnapshot()`. When
   * `anyStale === false`, this component renders nothing.
   */
  staleness: {
    anyStale: boolean;
    summary: string | null;
    staleManualCount: number;
    oldestManualAgeDays: number | null;
  };
  /** Optional override for the size — `compact` strips the icon. */
  size?: 'default' | 'compact';
  /** Optional class override for layout integration. */
  className?: string;
}

export function ConfidenceIndicator({
  staleness,
  size = 'default',
  className = '',
}: ConfidenceIndicatorProps) {
  if (!staleness.anyStale) return null;

  const label = staleness.summary ?? 'Manual balances may be stale.';
  const sizing =
    size === 'compact'
      ? 'text-[10px] px-1.5 py-0 gap-0.5'
      : 'text-[11px] px-2 py-0.5 gap-1';

  return (
    <Link
      href="/dashboard/settings/data-health"
      title={`${label} Click to review your balances.`}
      aria-label={`${label} Click to review your balances.`}
      className={`inline-flex items-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-400 font-medium hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors ${sizing} ${className}`.trim()}
    >
      {size !== 'compact' && <Info aria-hidden className="h-2.5 w-2.5" />}
      <span className="whitespace-nowrap">may be stale</span>
    </Link>
  );
}
