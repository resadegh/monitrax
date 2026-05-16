/**
 * Phase 41E.1 — Negative gearing regime classifier (Measure 1).
 *
 * Pure helper. Given a property's metadata + the target FY + the
 * current `TaxYearConfig`, returns which regime applies to the
 * property's negative-gearing treatment. Consumed by
 * `applyNegativeGearing` (existing `divisions/negativeGearing.ts`)
 * at function entry — defaults `'PRE_REFORM_GRANDFATHERED'` when
 * not supplied, so existing call sites are byte-for-byte unchanged.
 *
 * Per `docs/blueprint/PHASE_41E_REFORM_2026_27.md` §10.1 + CLAUDE.md §12.14.
 *
 * **Why a separate classifier helper:** the regime decision touches
 * 5 inputs (property type, contract date, isNewBuild flag, target FY,
 * the per-FY commencement flag). Inlining the test inside
 * `applyNegativeGearing` would clutter that function with reform
 * dispatch logic. Keeping the classifier pure + isolated:
 *   (a) makes it independently testable (boundary-day at the second),
 *   (b) lets other consumers reuse it (AI advisor `getReformedTaxRegimeStatus`
 *       tool — Phase 41E.2 — calls this same function),
 *   (c) keeps the regime decision in one canonical place (per CLAUDE.md
 *       §12.2 SSOT — no other file may compute "is this property
 *       grandfathered?" by hand).
 *
 * **What this does NOT do:** apply post-reform tax math. This only
 * classifies. The consuming module (`applyNegativeGearing`) decides
 * what to do with each regime label.
 */

import {
  REFORM_CUT_OVER_UTC,
  classifyAcquisitionGrandfathering,
  isPostCommencementFy,
} from '../config/reformConstants';
import type { TaxYearConfig } from '../types';

/**
 * Closed discriminant for the negative-gearing regime that applies
 * to a single property in a single FY. Every consumer must handle
 * every variant — TypeScript exhaustiveness will catch a missing
 * branch at compile time.
 */
export type NegativeGearingRegime =
  /**
   * Pre-reform rules apply indefinitely. The property's loss offsets
   * other income at the entity level per Div 8 + Div 36 (existing
   * behaviour). Default for: any FY before 1 Jul 2027; any
   * non-residential property; any residential property whose contract
   * was signed at or before `REFORM_CUT_OVER_UTC`.
   */
  | 'PRE_REFORM_GRANDFATHERED'
  /**
   * Post-reform but the property qualifies as a new build → existing
   * loss-offset treatment still applies (the reform's safe-harbour
   * for new construction). Applies when: target FY ≥ 2027-28 AND
   * residential AND contract > cut-over AND `isNewBuild === true`.
   */
  | 'POST_REFORM_NEW_BUILD'
  /**
   * Post-reform restricted — the property's negative-gearing loss
   * cannot offset other income at the entity level. The loss is
   * quarantined (carries forward against future income from the
   * same property, per the exposure draft when it lands). Applies
   * when: target FY ≥ 2027-28 AND residential AND contract > cut-over
   * AND `isNewBuild === false`.
   */
  | 'POST_REFORM_RESTRICTED'
  /**
   * Property is residential and post-cut-over, but
   * `acquisitionContractDate` is missing — the classifier cannot
   * determine whether grandfathering applies. The caller MUST
   * surface this as UNCOMPUTED (per HR-3 — never invent the
   * regime). UI nudges the user to confirm the contract date.
   */
  | 'UC_PROPERTY_CONTRACT_DATE_UNKNOWN'
  /**
   * Property is residential, post-cut-over, but the user has not
   * confirmed whether it's a new build. The classifier cannot
   * decide between `POST_REFORM_NEW_BUILD` and `POST_REFORM_RESTRICTED`.
   * The caller MUST surface this as UNCOMPUTED. UI prompts the user
   * with the `NewBuildEvidence` enum on the property detail dialog.
   */
  | 'UC_NEW_BUILD_UNCONFIRMED';

/**
 * Inputs the classifier needs. Caller composes from `Property` +
 * the current FY + the resolved `TaxYearConfig` for that FY.
 *
 * `propertyType` is the existing Prisma `PropertyType` enum value.
 * The reform only touches `RESIDENTIAL`-equivalent — we read
 * `HOME` + `INVESTMENT` as residential (in scope) and `RENTAL`
 * as out-of-scope (the user doesn't own it). Commercial /
 * industrial property is *not yet* modelled in Prisma; if/when
 * it lands, add the type here.
 */
export interface NegativeGearingRegimeInput {
  /** The Prisma `PropertyType` value — `HOME` / `INVESTMENT` / `RENTAL`. */
  propertyType: 'HOME' | 'INVESTMENT' | 'RENTAL';
  /** Contract date from `Property.acquisitionContractDate`. Nullable. */
  contractDate: Date | null;
  /** User-confirmed `Property.isNewBuild`. Nullable. */
  isNewBuild: boolean | null;
  /** Target FY string — `"2026-27"` / `"2027-28"` / etc. */
  fy: string;
  /** Resolved `TaxYearConfig` for `fy`. Used for the commencement gate. */
  config: TaxYearConfig;
}

/**
 * Is this property type within the scope of Measure 1?
 *
 * Measure 1 = residential property. Phase 41a's `PropertyType` enum
 * has `HOME` (primary residence) + `INVESTMENT` (rental investment)
 * + `RENTAL` (user is the renter, not owner).
 *
 *   - `HOME` → in scope (a primary residence with a loan can still
 *     produce a loss if the loan is investment-purpose; treat as
 *     residential).
 *   - `INVESTMENT` → in scope (the canonical negatively-geared
 *     residential investment property).
 *   - `RENTAL` → out of scope (the user doesn't own this property;
 *     it's their accommodation, not an investment).
 *
 * Commercial / industrial property is not yet modelled in Prisma.
 * When that PropertyType lands, this function gets a new branch.
 */
function isResidential(propertyType: NegativeGearingRegimeInput['propertyType']): boolean {
  return propertyType === 'HOME' || propertyType === 'INVESTMENT';
}

/**
 * Classify the negative-gearing regime for a single property.
 *
 * Pure function — no I/O, no Date.now(), no globals. Suitable for
 * use inside any tax-engine consumer.
 *
 * **Decision order matters:**
 *   1. Reform commencement gate first — if Treasury / Royal Assent
 *      hasn't activated Measure 1, every property is grandfathered
 *      regardless of contract date. This protects against silent
 *      post-reform numbers before the law is in force (FW-2).
 *   2. FY commencement second — pre-FY-2027-28 always grandfathered.
 *   3. Property-type scope — non-residential is out of scope.
 *   4. Contract date classification — uses `REFORM_CUT_OVER_UTC`.
 *   5. New-build confirmation — only relevant for post-cut-over.
 */
export function deriveNegativeGearingRegime(
  input: NegativeGearingRegimeInput,
): NegativeGearingRegime {
  // Gate 1 — Royal Assent not yet confirmed → everything grandfathered.
  // This is the FW-2 wall (no silent post-reform numbers).
  if (!input.config.negativeGearingReformCommencementVerified) {
    return 'PRE_REFORM_GRANDFATHERED';
  }

  // Gate 2 — pre-commencement FY (target FY before 1 Jul 2027) →
  // existing rules regardless of when the contract was signed.
  if (!isPostCommencementFy(input.fy, 'NEGATIVE_GEARING_NEW_BUILDS_ONLY')) {
    return 'PRE_REFORM_GRANDFATHERED';
  }

  // Gate 3 — non-residential is out of scope for Measure 1.
  if (!isResidential(input.propertyType)) {
    return 'PRE_REFORM_GRANDFATHERED';
  }

  // Gate 4 — contract date classification.
  const grandfathering = classifyAcquisitionGrandfathering(input.contractDate);
  if (grandfathering === 'UNKNOWN') {
    return 'UC_PROPERTY_CONTRACT_DATE_UNKNOWN';
  }
  if (grandfathering === 'GRANDFATHERED') {
    return 'PRE_REFORM_GRANDFATHERED';
  }

  // Gate 5 — post-cut-over → newness gates the regime.
  if (input.isNewBuild === null || input.isNewBuild === undefined) {
    return 'UC_NEW_BUILD_UNCONFIRMED';
  }
  return input.isNewBuild ? 'POST_REFORM_NEW_BUILD' : 'POST_REFORM_RESTRICTED';
}

/**
 * Convenience — does the regime permit the loss to offset other
 * income at the entity level? Used by `applyNegativeGearing` to
 * decide between the existing `OFFSET_OTHER_INCOME` path and the
 * new `RESTRICTED_TO_PROPERTY` path.
 *
 * `UNCOMPUTED` regimes default to `true` here — they ALWAYS read as
 * "permits offset" so that UNCOMPUTED-flagged properties get the
 * conservative (pre-reform) treatment in the calc. The caller is
 * responsible for surfacing the UNCOMPUTED to the user separately.
 */
export function regimePermitsLossOffsetOtherIncome(
  regime: NegativeGearingRegime,
): boolean {
  switch (regime) {
    case 'PRE_REFORM_GRANDFATHERED':
    case 'POST_REFORM_NEW_BUILD':
    case 'UC_PROPERTY_CONTRACT_DATE_UNKNOWN':
    case 'UC_NEW_BUILD_UNCONFIRMED':
      return true;
    case 'POST_REFORM_RESTRICTED':
      return false;
  }
}

/**
 * Re-export the cut-over constant for callers that need the
 * timestamp without pulling from `reformConstants.ts` directly.
 * Defensive — every code path that classifies a property reads
 * the same constant.
 */
export { REFORM_CUT_OVER_UTC };
