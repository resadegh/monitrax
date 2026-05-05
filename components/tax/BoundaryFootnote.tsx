/**
 * AFSL / TPB / NCCP boundary footnote — Phase 41e.0 slice D.
 *
 * Renders the canonical boundary footnote for surfaces that show
 * tax-shaped numbers. Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md`
 * §1(5) + §5: Monitrax surfaces tax + financial calculations as
 * **general information**, never personal advice. This component is
 * the editorial half of the boundary (the structural half is the
 * Gemini tool registry per Reza decision D-2).
 *
 * Three pieces:
 *   1. "Computed per ITAA 1997 s115-25, ..." — the authority audit trail
 *   2. UNCOMPUTED disclosures — what was deliberately not computed
 *   3. "general information only — not personal advice. Consult a TPB / AFSL / NCCP."
 */

'use client';

import { Info, AlertCircle } from 'lucide-react';
import type { AuthorityCitation, UncomputedFlag } from '@/lib/tax-engine/types';
import {
  renderBoundaryFootnote,
  type BoundaryFootnote as BoundaryFootnoteShape,
} from '@/lib/tax-engine/boundaries';

export interface BoundaryFootnoteProps {
  /**
   * Authority citations that backed the figures shown above this footer.
   * Pass an empty array if the surface didn't apply specific rule modules
   * (the renderer will fall back to "Computed per current Australian tax law.").
   */
  citations: AuthorityCitation[];
  /**
   * UNCOMPUTED items relevant to this surface. Each renders as an
   * AlertCircle row above the boundary statement.
   */
  uncomputed?: UncomputedFlag[];
  /** FY label, e.g. "FY24-25". Optional; used for the "Figures for ..." prefix. */
  fyLabel?: string;
  /** Optional ISO timestamp shown as "Last calculated: ...". */
  calculatedAt?: string | null;
  /** Tighter spacing for in-tile rendering. Default: false (full footer). */
  compact?: boolean;
}

/**
 * Render order mirrors `renderBoundaryFootnote()`:
 *   - FY context (if any)
 *   - Computed-per authority audit trail
 *   - UNCOMPUTED rows (one per flag, with icon)
 *   - Boundary statement (the legal floor)
 *   - Last-calculated timestamp (if provided)
 */
export function BoundaryFootnote(props: BoundaryFootnoteProps) {
  const footnote: BoundaryFootnoteShape = renderBoundaryFootnote({
    citations: props.citations,
    uncomputed: props.uncomputed ?? [],
    fyLabel: props.fyLabel,
  });

  const wrapperClass = props.compact
    ? 'space-y-1 text-[0.7rem] text-muted-foreground'
    : 'space-y-2 text-xs text-muted-foreground';

  return (
    <div className={wrapperClass}>
      {footnote.fyContext && (
        <p>
          <Info className="inline h-3 w-3 mr-1" aria-hidden />
          {footnote.fyContext}
        </p>
      )}
      <p className="font-medium">{footnote.computedPer}</p>
      {footnote.uncomputedNotes.length > 0 && (
        <ul className="space-y-1 list-none pl-0">
          {footnote.uncomputedNotes.map((note, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <AlertCircle className="h-3 w-3 mt-0.5 flex-shrink-0 text-amber-500" aria-hidden />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      )}
      <p>
        <strong>{footnote.boundary}</strong>
      </p>
      {props.calculatedAt && (
        <p className="text-[0.65rem] opacity-75">
          Last calculated: {new Date(props.calculatedAt).toLocaleString('en-AU')}
        </p>
      )}
    </div>
  );
}
