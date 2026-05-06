/**
 * Phase 41h.3 — AFSL/TPB/NCCP boundary footer renderer.
 *
 * Per Phase 41 §5.3 (D-2 boundary): every personal-advice-shaped
 * surface MUST render this footer. The boundary is enforced
 * structurally (no `recommend*` tool exists) AND visually (this
 * component is on every AI advisor response).
 *
 * Reuses the typed `BoundaryFootnote` already produced by the
 * gateway via `lib/tax-engine/boundaries/index.ts`.
 */

import React from 'react';
import type { BoundaryFootnote } from '@/lib/tax-engine/boundaries';
import type { IdentifiedCitation } from '@/lib/ai/tax-advisor/types';

interface TaxAdvisorBoundaryFooterProps {
  boundary: BoundaryFootnote;
  citations: IdentifiedCitation[];
  fyLabel?: string;
}

export function TaxAdvisorBoundaryFooter({
  boundary,
  citations,
  fyLabel,
}: TaxAdvisorBoundaryFooterProps) {
  return (
    <footer
      role="note"
      aria-label="AFSL/TPB/NCCP boundary footer"
      className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400 space-y-2"
    >
      {fyLabel && (
        <p className="text-[11px] uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-500">
          Figures for {fyLabel}
        </p>
      )}

      {citations.length > 0 && (
        <p>
          <span className="font-medium text-gray-700 dark:text-gray-300">
            Computed per:{' '}
          </span>
          {citations.map((c, i) => (
            <React.Fragment key={c.id ?? i}>
              <span className="font-mono text-[11px]">{c.reference}</span>
              {i < citations.length - 1 && <span>{', '}</span>}
            </React.Fragment>
          ))}
        </p>
      )}

      <p className="text-gray-700 dark:text-gray-300 font-medium leading-relaxed">
        {boundary.boundary}
      </p>
    </footer>
  );
}
