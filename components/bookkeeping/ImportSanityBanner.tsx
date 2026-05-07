/**
 * Phase 42 PR4 — Import sanity-check banner.
 *
 * Renders the result of `lib/bookkeeping/importSanity.ts:computeBalanceSanityCheck`.
 * Shown after a batch import (or a dry-run preview) when the source
 * file's stated opening + closing balance don't reconcile with the
 * sum of imported rows.
 *
 * NOT formal bank reconciliation (Xero owns that) — this is a
 * one-line nudge with a single primary purpose: tell the user there's
 * a $X gap so they can decide whether to re-import or investigate.
 *
 * Design lens (CLAUDE.md §0): the banner is amber, not rose. A gap
 * is a *signal*, not a failure. Friendly tone matches Phase 42's
 * engagement principle.
 */

'use client';

import { AlertTriangle, X } from 'lucide-react';
import { useState } from 'react';

interface ImportSanityBannerProps {
  /** The `sanity` field of the batch-import API response. */
  sanity?: {
    ran: boolean;
    expectedClosing: number | null;
    gap: number;
    hasGap: boolean;
    message: string | null;
  } | null;
  /** Optional: the import-batch id, surfaced in the secondary text. */
  batchId?: string;
}

export function ImportSanityBanner({ sanity, batchId }: ImportSanityBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (!sanity?.hasGap || !sanity.message || dismissed) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 px-4 py-3 rounded-2xl border border-amber-200 bg-amber-50/70 text-amber-900"
    >
      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" aria-hidden />
      <div className="flex-1 text-sm leading-relaxed">
        <p>{sanity.message}</p>
        {batchId && (
          <p className="text-xs text-amber-700/80 mt-0.5">
            Reference: <span className="font-mono">{batchId}</span>
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="p-1 rounded-full text-amber-700/60 hover:text-amber-900 hover:bg-amber-100 transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
