/**
 * Phase 41E.1 — CGT cost-base indexation (Measure 2, skeleton).
 *
 * **STAGE 1 SKELETON.** Returns `UC-CGT-INDEXATION-PENDING-EXPOSURE-DRAFT`
 * for every input until Treasury publishes the exposure draft + the
 * Bill assents. Per CLAUDE.md §12.14 FW-2 — no silent post-reform numbers.
 *
 * Per `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §10.2.
 *
 * **What this module will do (Stage 2 — fills in the mechanic):**
 *   1. Read `costBase` (original acquisition cost + improvements +
 *      incidental costs) + `acquisitionQuarter` + `disposalQuarter`.
 *   2. Look up CPI for each quarter from `taxYearConfig.cpiQuarterlyIndex`
 *      (populated from ATO's published CPI All-Groups Quarterly table).
 *   3. Compute indexed cost base = `costBase × (cpiDisposal / cpiAcquisition)`.
 *   4. Return `{ indexedCostBase, indexedGain, ... }` for the
 *      consumer (the modified `calculateCgtDiscount` flow) to apply
 *      the 30% minimum rate via `cgtMinimumRate.ts`.
 *
 * **Open questions resolved in Stage 2 (see §3 Measure 2 open questions):**
 *   - Q1 — which index? Almost certainly CPI All-Groups Quarterly (matches
 *     pre-1999 regime) but confirm against exposure draft.
 *   - Q2 — cadence: quarter of acquisition vs quarter of disposal?
 *   - Q3 — Div 43 capital-works interaction with indexed cost base.
 *   - Q4 — incidental costs indexed from when incurred vs pooled.
 *   - Q5 — capital losses applied before or after the 30% floor.
 *   - Q6 — Div 152 SBC interaction.
 *   - Q7 — Subdiv 115-D foreign-resident apportionment (interacts with
 *     `foreignResidentCgt.ts` Measure 4).
 *
 * Until exposure draft + Royal Assent: every call returns UNCOMPUTED.
 */

import type { AuthorityCitation, UncomputedFlag, TaxYearConfig } from '../types';

export interface CgtIndexationInput {
  /** Pre-reform cost base — acquisition cost + improvements + incidental. */
  costBase: number;
  /** Quarter of acquisition, e.g. `"2027-Q3"` (Jul-Sep 2027). */
  acquisitionQuarter: string;
  /** Quarter of disposal, e.g. `"2030-Q1"` (Jan-Mar 2030). */
  disposalQuarter: string;
  /** Nominal sale proceeds (gross of indexation). */
  saleProceeds: number;
  /** Resolved `TaxYearConfig` for the disposal FY. */
  config: TaxYearConfig;
}

export interface CgtIndexationResult {
  /** Indexed cost base, computed when commencement is verified. 0 when UNCOMPUTED. */
  indexedCostBase: number;
  /** Indexed gain (sale proceeds − indexed cost base). 0 when UNCOMPUTED. */
  indexedGain: number;
  /** Whether the module produced a real number or returned UNCOMPUTED. */
  computed: boolean;
  /** Human-readable explanation surfaced in the boundary footer. */
  reason: string;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

const STAGE_1_CITATION: AuthorityCitation = {
  kind: 'ITAA_1997',
  reference: 'Div 114 (proposed Phase 41E Measure 2 amendments)',
  lastReviewed: '2026-05-16',
};

/**
 * Compute the indexed cost base + indexed gain for a single CGT
 * event A1 (disposal) under the post-reform regime.
 *
 * **Stage 1 behaviour:** when `cgtIndexationCommencementVerified === false`,
 * returns `{ computed: false, indexedCostBase: 0, indexedGain: 0 }` with
 * the UNCOMPUTED flag surfaced. The caller (`calculateCgtDiscount`'s
 * post-reform branch) MUST fall back to the pre-reform 50% discount
 * for this disposal when `computed === false` — never apply post-reform
 * math without verified commencement.
 *
 * **Stage 2 behaviour (queued):** when the flag flips to `true`,
 * this function computes the actual indexed cost base using the CPI
 * table on `config.cpiQuarterlyIndex`. The rest of the function body
 * is intentionally left as a placeholder — the indexation formula
 * depends on the exposure draft's resolution of Q1-Q7 above, and we
 * do not guess.
 */
export function applyCgtIndexation(input: CgtIndexationInput): CgtIndexationResult {
  // Stage 1 — every call returns UNCOMPUTED.
  // FW-2 (CLAUDE.md §12.14): never silent post-reform numbers.
  if (!input.config.cgtIndexationCommencementVerified) {
    return {
      indexedCostBase: 0,
      indexedGain: 0,
      computed: false,
      reason:
        'CGT indexation regime (Phase 41E Measure 2) — awaiting Treasury exposure draft + Royal Assent of the implementing Bill. The pre-reform 50% discount (Div 115) applies to this disposal until commencement is verified.',
      citations: [STAGE_1_CITATION],
      uncomputed: [
        {
          id: 'UC-CGT-INDEXATION-PENDING-EXPOSURE-DRAFT',
          rationale: `Phase 41E Measure 2 (CGT cost-base indexation) commences 1 Jul 2027 / FY 2027-28 but requires Treasury exposure draft + Royal Assent before the engine activates the indexation mechanic. Acquisition: ${input.acquisitionQuarter}; disposal: ${input.disposalQuarter}; cost base: $${Math.round(input.costBase).toLocaleString()}. Pre-reform 50% discount applies as fallback.`,
          citation: STAGE_1_CITATION,
        },
      ],
    };
  }

  // Stage 2 — populated when commencementVerified flips to true.
  // The actual indexation formula goes here. Leaving this as a
  // defensive throw rather than a stub-that-returns-zero: if a
  // future session flips the flag without also implementing the
  // formula, the calc fails loudly rather than silently producing
  // wrong numbers (CLAUDE.md §12.8 "fail loudly at boundaries").
  throw new Error(
    '[Phase 41E.1] cgtIndexationCommencementVerified is true but the indexation mechanic is not yet implemented. Do NOT flip the flag until Stage 2 lands the per-quarter CPI lookup + the indexed-cost-base formula (per the published exposure draft).',
  );
}
