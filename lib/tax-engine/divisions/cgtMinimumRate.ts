/**
 * Phase 41E.1 — CGT 30% minimum effective tax rate (Measure 2, skeleton).
 *
 * **STAGE 1 SKELETON.** Returns `UC-CGT-MIN-RATE-PENDING-EXPOSURE-DRAFT`
 * for every input until Treasury publishes the exposure draft + the
 * Bill assents. Per CLAUDE.md §12.14 FW-2 — no silent post-reform numbers.
 *
 * Per `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §10.2.
 *
 * **What this module will do (Stage 2 — fills in the mechanic):**
 *   1. Take the `indexedGain` produced by `cgtIndexation.ts` + the
 *      taxpayer's marginal tax rate.
 *   2. Compute the effective CGT rate floor: max(30%, marginalRate).
 *      The 30% floor only bites for users in the 16% / 30% brackets;
 *      above 30%, the marginal rate already exceeds the floor.
 *   3. Apply the floor to the indexed gain → output the tax payable.
 *
 * **Open questions resolved in Stage 2:**
 *   - Q5 (§3 Measure 2) — capital losses applied BEFORE or AFTER the
 *     floor? Either pre- or post-loss-netting changes the effective
 *     bite materially. Awaits exposure draft.
 *   - Floor on gross gain vs floor on indexed gain — Treasury's
 *     announcement reads "floor on the discounted [indexed] gain"
 *     but the precise wording matters.
 *   - Interaction with Div 152 small-business CGT concessions —
 *     does the floor apply after SBC reductions or before?
 *
 * Until exposure draft + Royal Assent: every call returns UNCOMPUTED.
 */

import type { AuthorityCitation, UncomputedFlag, TaxYearConfig } from '../types';
import { Decimal, toDecimal } from '@/lib/decimal';

export interface CgtMinimumRateInput {
  /** The indexed gain (from `cgtIndexation.ts`). May be 0 if Measure 2 isn't live yet. */
  indexedGain: number;
  /**
   * Taxpayer's marginal rate as decimal (e.g. 0.30 for 30% bracket,
   * 0.45 for top bracket). Read from `taxYearConfig.brackets`.
   */
  marginalRate: number;
  /** Resolved `TaxYearConfig` for the disposal FY. */
  config: TaxYearConfig;
}

export interface CgtMinimumRateResult {
  /** The effective CGT rate applied — `max(0.30, marginalRate)` when computed; 0 when UNCOMPUTED. */
  effectiveRate: number;
  /** Tax payable on the indexed gain (`indexedGain × effectiveRate`). 0 when UNCOMPUTED. */
  taxPayable: number;
  /** Whether the module produced a real number or returned UNCOMPUTED. */
  computed: boolean;
  reason: string;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

/**
 * The 30% floor value per Treasury fact sheet. Stored as a constant
 * here for clarity even though it could live on `taxYearConfig` —
 * the floor is a structural reform feature (not an indexed threshold),
 * so it doesn't belong in the per-FY config.
 */
const CGT_MIN_EFFECTIVE_RATE = 0.30;

const STAGE_1_CITATION: AuthorityCitation = {
  kind: 'ITAA_1997',
  reference: 's115-100 amendment (proposed Phase 41E Measure 2 — 30% floor)',
  lastReviewed: '2026-05-16',
};

/**
 * Compute the effective CGT rate + tax payable on an indexed gain.
 *
 * **Stage 1 behaviour:** when `cgtMinRateCommencementVerified === false`,
 * returns `{ computed: false, effectiveRate: 0, taxPayable: 0 }` with
 * the UNCOMPUTED flag. The caller MUST fall back to the pre-reform
 * 50%-discount + marginal-rate flow when `computed === false`.
 */
export function applyCgtMinimumRate(input: CgtMinimumRateInput): CgtMinimumRateResult {
  // Stage 1 — every call returns UNCOMPUTED.
  // FW-2 (CLAUDE.md §12.14): never silent post-reform numbers.
  if (!input.config.cgtMinRateCommencementVerified) {
    return {
      effectiveRate: 0,
      taxPayable: 0,
      computed: false,
      reason:
        'CGT 30% minimum effective rate (Phase 41E Measure 2) — awaiting Treasury exposure draft + Royal Assent. The pre-reform marginal-rate flow applies to this disposal until commencement is verified.',
      citations: [STAGE_1_CITATION],
      uncomputed: [
        {
          id: 'UC-CGT-MIN-RATE-PENDING-EXPOSURE-DRAFT',
          rationale: `Phase 41E Measure 2 (30% minimum effective CGT rate) commences 1 Jul 2027 / FY 2027-28 but requires Treasury exposure draft + Royal Assent before the engine applies the floor. Indexed gain: $${Math.round(input.indexedGain).toLocaleString()}; marginal rate: ${(input.marginalRate * 100).toFixed(1)}%. Pre-reform marginal-rate treatment applies as fallback.`,
          citation: STAGE_1_CITATION,
        },
      ],
    };
  }

  // Stage 2 — populated when commencementVerified flips to true.
  // The actual floor application + loss-ordering depends on the
  // exposure draft. Defensive throw — never silently active.
  throw new Error(
    '[Phase 41E.1] cgtMinRateCommencementVerified is true but the 30% floor mechanic is not yet implemented. Do NOT flip the flag until Stage 2 lands the floor formula + capital-loss ordering (per the published exposure draft).',
  );
}

/**
 * Convenience — exposed for the AI advisor narration tool
 * (`getReformImpactSummaryForUser`) to surface the rate without
 * running a full disposal calc.
 */
export function getCgtMinimumEffectiveRate(): number {
  return CGT_MIN_EFFECTIVE_RATE;
}

// =============================================================================
// Q-DEC PR 2.D.3b — Decimal sibling path (§12.14 FW-2 preserved)
// =============================================================================

export interface CgtMinimumRateInputDecimal {
  indexedGain: number | string | Decimal;
  marginalRate: number | string | Decimal;
  config: TaxYearConfig;
}

export interface CgtMinimumRateResultDecimal {
  effectiveRate: Decimal;
  taxPayable: Decimal;
  computed: boolean;
  reason: string;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

/**
 * Decimal sibling of `applyCgtMinimumRate`. **Stage 1 behaviour preserved
 * exactly** — UNCOMPUTED returned until `cgtMinRateCommencementVerified`
 * flips to true. Stage 2 throws.
 */
export function applyCgtMinimumRateDecimal(input: CgtMinimumRateInputDecimal): CgtMinimumRateResultDecimal {
  const indexedGain = toDecimal(input.indexedGain) ?? new Decimal(0);
  const marginalRate = toDecimal(input.marginalRate) ?? new Decimal(0);

  if (!input.config.cgtMinRateCommencementVerified) {
    return {
      effectiveRate: new Decimal(0),
      taxPayable: new Decimal(0),
      computed: false,
      reason:
        'CGT 30% minimum effective rate (Phase 41E Measure 2) — awaiting Treasury exposure draft + Royal Assent. The pre-reform marginal-rate flow applies to this disposal until commencement is verified.',
      citations: [STAGE_1_CITATION],
      uncomputed: [
        {
          id: 'UC-CGT-MIN-RATE-PENDING-EXPOSURE-DRAFT',
          rationale: `Phase 41E Measure 2 (30% minimum effective CGT rate) commences 1 Jul 2027 / FY 2027-28 but requires Treasury exposure draft + Royal Assent before the engine applies the floor. Indexed gain: $${indexedGain.toDecimalPlaces(0).toString()}; marginal rate: ${marginalRate.times(100).toFixed(1)}%. Pre-reform marginal-rate treatment applies as fallback.`,
          citation: STAGE_1_CITATION,
        },
      ],
    };
  }

  throw new Error(
    '[Phase 41E.1] cgtMinRateCommencementVerified is true but the 30% floor mechanic is not yet implemented. Do NOT flip the flag until Stage 2 lands the floor formula + capital-loss ordering (per the published exposure draft).',
  );
}
