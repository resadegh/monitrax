/**
 * Phase 41h.3 — UNCOMPUTED flag renderer.
 *
 * Per Phase 41 §1 invariant 6 ("Uncomputed is documented"):
 * every rule the engine deliberately skipped (PSI deep cases,
 * deceased estates, cross-border, FTE nuance, etc.) gets surfaced
 * to the user as an explicit "I deliberately did NOT compute X
 * because Y" rather than glossed over.
 *
 * Visual treatment: amber accent (drawing attention without
 * triggering anxiety), short id badge, plain-English rationale,
 * optional citation link.
 */

import React from 'react';
import type { UncomputedFlag } from '@/lib/tax-engine/types';

interface TaxAdvisorUncomputedFlagProps {
  flag: UncomputedFlag;
}

export function TaxAdvisorUncomputedFlag({ flag }: TaxAdvisorUncomputedFlagProps) {
  return (
    <div className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm">
      <div className="flex items-start gap-2">
        <span
          aria-hidden="true"
          className="mt-0.5 flex-shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-200 dark:bg-amber-900 text-amber-800 dark:text-amber-200 text-xs font-bold"
        >
          !
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-wide text-amber-800 dark:text-amber-300 mb-1">
            {flag.id}
          </p>
          <p className="text-amber-900 dark:text-amber-200 leading-relaxed">
            {flag.rationale}
          </p>
          {flag.citation && (
            <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
              <span className="font-medium">Authority: </span>
              <span className="font-mono">{flag.citation.reference}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
