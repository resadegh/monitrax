/**
 * Phase 59 — the managed-rental suggest-and-confirm card
 * (PHASE_59_MANAGED_RENTAL_INCOME.md §3/§8; Stitch design system SSOT:
 * docs/design/MONITRAX_STITCH_DESIGN_SYSTEM.md).
 *
 * Fires inside the Link dialog when a disbursement reconciles materially
 * below the stream's declared gross. ONE calm question (Phase 55 one-status
 * rule) with the math shown transparently:
 *
 *   period gross − net disbursement = gap → "usually tax-deductible"
 *
 * Design tokens (spec §8, applied verbatim):
 *   card       surface-container-low #FAF8F3 on outline-variant border, 16px
 *   question   headline-sm navy on-surface #0B1220
 *   the gap    primary EMERALD #16A34A — a WIN, never red
 *   confirm    emerald filled (primary/on-primary)
 *   statement  navy ghost/outline (secondary)
 *   other      slate text (tertiary)
 *   anomaly    trail-amber #F59E0B chip at 10% bg — attention, not error
 *   learn-once Stitch switch — "Apply to future [agent] disbursements"
 *
 * Compliance (spec §10): the copy stays "usually tax-deductible — confirm
 * with your statement or tax agent"; the card never rules immediate-vs-
 * capital. Numbers shown are the server's engine output (display only —
 * the confirm endpoint recomputes via the ONE engine before persisting).
 */

'use client';

import { useState } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { formatCurrency } from '@/lib/utils/formatters';
import type { ManagedRentalSuggestion } from '@/lib/services/managedRentalService';

const FREQ_LABEL: Record<string, string> = {
  WEEKLY: 'week',
  FORTNIGHTLY: 'fortnight',
  MONTHLY: 'month',
  QUARTERLY: 'quarter',
  HALF_YEARLY: 'half-year',
  ANNUAL: 'year',
};

export interface ManagedRentalReconcileCardProps {
  suggestion: ManagedRentalSuggestion;
  token: string | null;
  /** Called after a successful confirm (refresh + advance). */
  onResolved: (message: string) => void | Promise<void>;
  /** "Something else" — close the card without recording anything. */
  onDismiss: () => void;
}

export function ManagedRentalReconcileCard({
  suggestion,
  token,
  onResolved,
  onDismiss,
}: ManagedRentalReconcileCardProps) {
  const [applyToFuture, setApplyToFuture] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAnomaly = suggestion.kind === 'anomaly';
  const period = FREQ_LABEL[suggestion.disbursementFrequency] ?? 'period';
  const agent = suggestion.managingAgentName || 'your agent';
  const amountToRecord = isAnomaly ? (suggestion.anomalyExcess ?? 0) : suggestion.gap;

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/rental-reconciliation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: isAnomaly ? 'confirm-anomaly' : 'confirm',
          incomeStreamId: suggestion.incomeStreamId,
          transactionId: suggestion.transactionId,
          applyToFuture,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to record');
      await onResolved(data.message || 'Recorded as management & costs');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record');
      setSaving(false);
    }
  };

  return (
    <div className="rounded-[16px] border border-[#0B1220]/10 bg-[#FAF8F3] p-4 dark:border-white/10 dark:bg-[#0E1424]">
      {/* Anomaly chip — trail-amber at 10% bg: attention, never error */}
      {isAnomaly && (
        <span className="mb-2 inline-flex items-center rounded-full bg-[#F59E0B]/10 px-2.5 py-0.5 text-xs font-medium text-[#B45309] dark:text-[#FBBF24]">
          Higher than usual — a repair?
        </span>
      )}

      {/* The one calm question — headline-sm navy */}
      <h3 className="text-base font-semibold text-[#0B1220] dark:text-[#FAFAF7]">
        {isAnomaly
          ? `${agent} kept ${formatCurrency(suggestion.gap)} this ${period} — more than the usual ${formatCurrency(suggestion.baselineGapAmount ?? 0)}. Does this look right?`
          : `It looks like ${formatCurrency(suggestion.gap)} was taken out before this rent reached you. Does this look like ${agent}'s management & costs?`}
      </h3>

      {/* The math, shown transparently (warm words, no jargon) */}
      <div className="mt-3 rounded-[12px] bg-white/60 p-3 text-sm text-[#64748B] dark:bg-white/5">
        <div className="flex items-center justify-between">
          <span>
            Your rent for the {period} ({formatCurrency(suggestion.declaredGross.amount)}/
            {FREQ_LABEL[suggestion.declaredGross.frequency] ?? 'period'})
          </span>
          <span className="tabular-nums text-[#0B1220] dark:text-[#FAFAF7]">
            {formatCurrency(suggestion.grossPerPeriod)}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span>What reached your account</span>
          <span className="tabular-nums text-[#0B1220] dark:text-[#FAFAF7]">
            {formatCurrency(suggestion.netDisbursement)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-[#0B1220]/10 pt-2 dark:border-white/10">
          <span>{isAnomaly ? 'Above the usual costs' : 'Taken out before it reached you'}</span>
          {/* The gap is a WIN — emerald, never red */}
          <span className="font-semibold tabular-nums text-[#16A34A] dark:text-[#22C55E]">
            {formatCurrency(amountToRecord)} tax-deductible*
          </span>
        </div>
      </div>

      {/* Learn-once switch (first confirm only) */}
      {!isAnomaly && (
        <label className="mt-3 flex items-center gap-2 text-sm text-[#64748B]">
          <Switch checked={applyToFuture} onCheckedChange={setApplyToFuture} />
          <span>
            Apply to future {agent} disbursements for this property
          </span>
        </label>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {/* Actions: emerald filled · navy outline · slate text */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-[14px] bg-[#16A34A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#15803D] disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isAnomaly ? 'Yes — record the one-off cost' : 'Yes — record as management & costs'}
        </button>
        <a
          href="/dashboard/documents"
          className="inline-flex items-center gap-1.5 rounded-[14px] border border-[#0B1220]/25 px-4 py-2 text-sm font-medium text-[#0B1220] transition-colors hover:bg-[#0B1220]/5 dark:border-white/25 dark:text-[#FAFAF7] dark:hover:bg-white/10"
        >
          <Upload className="h-4 w-4" />
          Upload statement
        </a>
        <button
          type="button"
          onClick={onDismiss}
          disabled={saving}
          className="px-2 py-2 text-sm text-[#64748B] transition-colors hover:text-[#0B1220] dark:hover:text-[#FAFAF7]"
        >
          Something else
        </button>
      </div>

      {/* Compliance boundary (spec §10) — information, not advice */}
      <p className="mt-3 text-[11px] leading-snug text-[#64748B]/80">
        *Agent management costs are usually deductible — confirm with your rental statement or tax
        agent. Uploading your statement itemises this into exact line items.
      </p>
    </div>
  );
}
