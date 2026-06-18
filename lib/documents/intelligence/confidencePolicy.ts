/**
 * Phase 50 D.3 — Confidence policy (the DIE's "how sure am I, and what should I
 * do about it?" SSOT).
 *
 * ONE canonical place for the document-intelligence confidence thresholds + the
 * autonomy bands they map to. Before D.3 these thresholds (0.9 / 0.7) were
 * duplicated across `GlobalScanReceipt`, `AnalysisPreviewCard`,
 * `ExtractionReviewForm`, etc. — drift waiting to happen (§12.3). This module is
 * now the single source; every confidence display + the (future) auto-apply
 * decision read from here.
 *
 * Bands:
 *   - AUTO    (≥ 0.9) — the engine is confident enough to act on its own.
 *               NOTE (D.3 scope): the BAND is defined here; actually executing a
 *               write without user confirmation is deliberately NOT wired yet —
 *               auto-writing a financial record is a product + §12.11 decision
 *               pending Reza sign-off + a Stitch UX pass. Today AUTO still routes
 *               through the one-tap confirm.
 *   - CONFIRM (0.7–0.9) — show the extracted fields, one-tap confirm (today's UX).
 *   - ASK     (< 0.7) — low confidence; surface the fields for edit before saving.
 *
 * Behaviour-psychology lens: autonomy is EARNED, not assumed. For users early in
 * TRAIL (Track / Reduce) the AUTO band is downgraded to CONFIRM — keep them in
 * the loop while trust is being built; later stages keep AUTO. The stage is an
 * optional input (callers pass it when known) so this module stays decoupled
 * from the CFO/TRAIL engine.
 */

export const CONFIDENCE_AUTO_THRESHOLD = 0.9;
export const CONFIDENCE_CONFIRM_THRESHOLD = 0.7;

export type ConfidenceBand = 'AUTO' | 'CONFIRM' | 'ASK';

/** TRAIL stages, loosely typed so this module doesn't depend on the CFO engine. */
export type TrailStageLike = 'TRACK' | 'REDUCE' | 'ANCHOR' | 'INVEST' | 'LIVE';

export interface ConfidenceVerdict {
  band: ConfidenceBand;
  /** Short user-facing label for a confidence pill. */
  label: string;
  /** Semantic tone — the UI maps this to its own palette (no Tailwind in lib). */
  tone: 'emerald' | 'amber' | 'slate';
}

/**
 * Classify a 0–1 confidence into an autonomy band + display label/tone.
 * Pass `trailStage` to apply the earned-autonomy downgrade.
 */
export function classifyConfidence(
  confidence: number,
  opts?: { trailStage?: TrailStageLike },
): ConfidenceVerdict {
  const c = Number.isFinite(confidence) ? confidence : 0;

  let band: ConfidenceBand =
    c >= CONFIDENCE_AUTO_THRESHOLD
      ? 'AUTO'
      : c >= CONFIDENCE_CONFIRM_THRESHOLD
        ? 'CONFIRM'
        : 'ASK';

  // Earned autonomy — never auto for early-stage users.
  if (band === 'AUTO' && (opts?.trailStage === 'TRACK' || opts?.trailStage === 'REDUCE')) {
    band = 'CONFIRM';
  }

  switch (band) {
    case 'AUTO':
      return { band, label: 'High confidence', tone: 'emerald' };
    case 'CONFIRM':
      return { band, label: 'Looks good — worth a check', tone: 'amber' };
    default:
      return { band, label: 'Please review', tone: 'slate' };
  }
}
