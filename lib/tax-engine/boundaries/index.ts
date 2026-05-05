/**
 * Phase 41e.0 — AFSL / TPB / NCCP boundaries renderer.
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §1(5) + §5,
 * Monitrax surfaces tax + financial calculations as **general
 * information**, never personal advice. This module assembles the
 * boundary footnote that surfaces wherever a tax-shaped number is
 * shown to the user.
 *
 * Per Reza decision D-2 (2026-05-04), the AFSL boundary is enforced
 * **structurally** (the AI cannot emit personal-advice via tool
 * registry) AND **editorially** (every surface that quotes a number
 * carries a footnote linking the calc to its primary AU authority +
 * stating the boundary). This module produces the editorial half.
 *
 * Three pieces compose the footnote:
 *   1. Authority citations — what ATO sections were applied
 *   2. UNCOMPUTED flags — what was deliberately NOT computed
 *   3. Boundary statement — the canonical "general information only" text
 */

import type { AuthorityCitation, UncomputedFlag } from '../types';

/**
 * Canonical boundary statement. Centralised here so legal copy is
 * never duplicated across surfaces. If the wording changes, every
 * surface that uses `renderBoundaryFootnote()` updates in lock-step.
 *
 * The AFSL / TPB / NCCP boundary applies to:
 *   - AFSL (Australian Financial Services Licence) — financial product
 *     advice, ASIC-regulated. Monitrax does NOT provide.
 *   - TPB (Tax Practitioners Board) — tax-agent services. Monitrax
 *     does NOT provide.
 *   - NCCP (National Consumer Credit Protection Act) — credit
 *     assistance. Monitrax does NOT provide.
 */
export const BOUNDARY_STATEMENT =
  'These figures are general information only — not personal financial, tax, or credit advice. Confirm with a registered tax agent (TPB), financial adviser (AFSL), or credit assistant (NCCP) before acting.' as const;

/**
 * Format an authority citation for display. Examples:
 *   { kind: 'ITAA_1997', reference: 's115-25' } → "ITAA 1997 s115-25"
 *   { kind: 'TR', reference: '2022/4' }         → "TR 2022/4"
 */
export function formatCitation(c: AuthorityCitation): string {
  const kindLabel: Record<AuthorityCitation['kind'], string> = {
    ITAA_1936: 'ITAA 1936',
    ITAA_1997: 'ITAA 1997',
    SIS_ACT: 'SIS Act',
    TR: 'TR',
    TD: 'TD',
    PCG: 'PCG',
    PS_LA: 'PS LA',
    STATE_DUTIES_ACT: 'State Duties Act',
    STATE_LAND_TAX_ACT: 'State Land Tax Act',
  };
  return `${kindLabel[c.kind]} ${c.reference}`;
}

export interface BoundaryFootnoteInput {
  /** Authority sources applied to this surface, in order of relevance. */
  citations: AuthorityCitation[];
  /** UNCOMPUTED items that may affect the figures shown. */
  uncomputed: UncomputedFlag[];
  /** Optional FY label, e.g. "FY24-25". */
  fyLabel?: string;
}

export interface BoundaryFootnote {
  /** "Computed per ITAA 1997 s115-25, ITAA 1997 Div 1-6". */
  computedPer: string;
  /** Plain-English UNCOMPUTED disclosures, one per flag. */
  uncomputedNotes: string[];
  /** The canonical boundary statement (see `BOUNDARY_STATEMENT`). */
  boundary: string;
  /** Optional FY context — "Figures for FY24-25." */
  fyContext?: string;
}

/**
 * Assemble the boundary footnote for a tax-shaped surface. Caller
 * decides how to render the three pieces (compact in a tile, expanded
 * in a hover-card, full in the print-PDF generator).
 */
export function renderBoundaryFootnote(
  input: BoundaryFootnoteInput,
): BoundaryFootnote {
  // De-duplicate citations by `${kind}:${reference}` so the footer
  // doesn't repeat the same section if multiple rule modules cited it.
  const seen = new Set<string>();
  const uniqueCitations = input.citations.filter((c) => {
    const key = `${c.kind}:${c.reference}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const computedPer = uniqueCitations.length
    ? `Computed per ${uniqueCitations.map(formatCitation).join(', ')}.`
    : 'Computed per current Australian tax law.';

  // De-duplicate UNCOMPUTED flags by id.
  const seenIds = new Set<string>();
  const uniqueUncomputed = input.uncomputed.filter((u) => {
    if (seenIds.has(u.id)) return false;
    seenIds.add(u.id);
    return true;
  });

  return {
    computedPer,
    uncomputedNotes: uniqueUncomputed.map((u) => u.rationale),
    boundary: BOUNDARY_STATEMENT,
    fyContext: input.fyLabel ? `Figures for ${input.fyLabel}.` : undefined,
  };
}

/**
 * One-line compact rendering — useful for tile footers where space
 * is tight. Loses UNCOMPUTED detail; full disclosure expects the
 * caller to surface that separately (e.g. as badges).
 */
export function renderBoundaryOneLine(input: BoundaryFootnoteInput): string {
  const footnote = renderBoundaryFootnote(input);
  const parts = [footnote.computedPer, footnote.boundary];
  if (footnote.fyContext) parts.unshift(footnote.fyContext);
  return parts.join(' ');
}
