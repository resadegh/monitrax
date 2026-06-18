/**
 * Phase 47 Stage D · D6 — per-entity CGT on a property disposal (pure core).
 *
 * The What-If `sellProperty` lever was single-taxpayer: it flagged "CGT may
 * apply" without computing it, so a jointly-owned or entity-owned property
 * gave the same (absent) CGT picture as a personally-owned one. This module
 * closes the D6 gap — it splits the capital gain across the property's legal
 * owners (TR 93/32: joint tenants equally, tenants-in-common per share) and
 * applies each owner's **entity CGT discount rate** (individual/trust 50%,
 * complying SMSF 33⅓%, company 0% — ITAA 1997 Div 115).
 *
 * SSOT discipline (§12.2 / §12.3): this module performs **no new tax
 * arithmetic**. It composes two canonical engines —
 *   • `calculateCgtDiscountDecimal` (Div 115 per-entity discount, incl. the
 *     §12.14 FW-2 reform gate — POST_REFORM disposals return UNCOMPUTED, never
 *     a silent discounted number), and
 *   • `attributeAsset` (the AD-2 ownership attributor the entity-tax assembler
 *     already uses, so the lever and the per-entity tax page never disagree on
 *     who owns what share).
 *
 * Honesty boundary (financial-adviser + compliance lenses):
 *   • We surface every owner's **taxable capital gain** after their correct
 *     entity discount — that figure is certain from entity type + holding
 *     period.
 *   • We estimate the **tax dollar only for the user's own share**, at their
 *     current marginal rate, and label it an estimate. A co-owner's actual tax
 *     depends on *their* other income that year, which a What-If can't know —
 *     so we never fabricate it; we show their taxable gain and say it's taxed
 *     in their own return.
 *
 * Binding contract: `PHASE_47_ENTITY_OWNERSHIP_FABRIC.md` §4B D6 + §4A
 * P2/P3/P8; `PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` §14. Pure — no I/O.
 */

import { Decimal, toDecimal } from '@/lib/decimal';
import {
  calculateCgtDiscountDecimal,
  type CgtEligibleEntityType,
} from '@/lib/tax-engine/divisions/cgtDiscount';
import type { TaxYearConfig, UncomputedFlag } from '@/lib/tax-engine/types';
import {
  attributeAsset,
  type AssetOwnershipContext,
} from '@/lib/services/ownershipAttribution';

/** One legal owner of the property + the facts the CGT dispatch needs. */
export interface PropertyOwner {
  entityId: string;
  /** Warm display name (e.g. "You", "Sarah", "Smith Family Trust"). */
  name: string;
  /** Mapped from `LegalEntityType` to the CGT-eligible discount domain. */
  entityType: CgtEligibleEntityType;
  /** The user's own personal entity — the only owner we estimate tax for. */
  isYou: boolean;
  /** Complying-fund flag (SMSF only). Defaults true (non-complying is rare). */
  isComplying?: boolean;
  /** Foreign-resident flag — denies the discount (Subdiv 115-D), flagged UNCOMPUTED. */
  isForeignResident?: boolean;
}

export interface PropertyDisposalCgtInput {
  proceeds: number | string | Decimal;
  sellingCosts: number | string | Decimal;
  /** Acquisition cost base proxy — the property's recorded purchase price (s110-25). */
  costBase: number | string | Decimal;
  /** Acquisition date (contract date preferred — CGT event A1, s109-5). */
  acquisitionDate: Date;
  /** Disposal date — "now" for a What-If. */
  disposalDate: Date;
  /** Disposal FY string (e.g. "2026-27") — drives the §12.14 reform gate. */
  disposalFy: string;
  /** Resolved tax-year config carrying the reform commencement flags. */
  config: TaxYearConfig;
  /** The legal owners + their weights (resolved via `resolvePropertyOwners`). */
  owners: ResolvedOwner[];
  /** The user's current marginal rate (0..1) — basis of the "your share" estimate. */
  userMarginalRate: number;
}

/** An owner paired with the AD-2 attribution weight for this asset (0..1). */
export interface ResolvedOwner extends PropertyOwner {
  weight: number;
}

export interface OwnerCgtOutcome {
  entityId: string;
  name: string;
  entityType: CgtEligibleEntityType;
  isYou: boolean;
  /** Legal interest applied to the gain (0..1). */
  weight: number;
  /** This owner's share of the nominal gain (before discount). */
  nominalGainShare: Decimal;
  /** Div 115 discount rate for this entity (0.5 / 0.3333… / 0). */
  discountRate: Decimal;
  /** Taxable gain after the entity discount — certain from type + holding. */
  taxableGain: Decimal;
  /** s115-25 12-month rule met for this owner. */
  metHoldingPeriod: boolean;
  /** Plain-English reason the rate was what it was (engine output). */
  reason: string;
  /**
   * Estimated tax dollar — populated ONLY for the user's own share (taxable
   * gain × current marginal rate). Null for every other owner: their tax
   * depends on their own return and we never fabricate it.
   */
  estimatedTax: Decimal | null;
  /** Why `estimatedTax` is what it is (or why it's null). */
  estimatedTaxBasis: string;
  /** UNCOMPUTED flags from the engine (foreign-resident / post-reform). */
  uncomputed: UncomputedFlag[];
}

export interface PropertyDisposalCgtResult {
  /** Acquisition cost base used (echoed for disclosure in the assumptions panel). */
  costBase: Decimal;
  /** Total nominal gain across the whole property (proceeds − costs − cost base). */
  totalNominalGain: Decimal;
  /** Sum of every owner's taxable gain after their entity discount. */
  totalTaxableGain: Decimal;
  /** True when the disposal is a capital loss (no CGT; loss can offset gains). */
  isCapitalLoss: boolean;
  /** The user's own estimated CGT (0 on a loss / no personal share). */
  yourEstimatedTax: Decimal;
  /** Per-owner breakdown. */
  owners: OwnerCgtOutcome[];
  /** Deduped honesty flags to surface to the user. */
  flags: UncomputedFlag[];
}

/**
 * Whole months elapsed, STRICTLY — the same s115-25 convention the entity-tax
 * assembler uses: the same-day 12-month anniversary counts as 11, not 12, so
 * `monthsHeld >= 12` downstream is exactly the statutory ≥12-month test.
 */
function monthsHeldStrict(from: Date, to: Date): number {
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() <= from.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Compute the per-entity CGT picture for a property disposal. Pure — composes
 * the canonical Div 115 engine per owner; no tax arithmetic of its own.
 */
export function computePropertyDisposalCgt(
  input: PropertyDisposalCgtInput,
): PropertyDisposalCgtResult {
  const proceeds = toDecimal(input.proceeds) ?? new Decimal(0);
  const sellingCosts = toDecimal(input.sellingCosts) ?? new Decimal(0);
  const costBase = toDecimal(input.costBase) ?? new Decimal(0);

  // s116-20 capital proceeds less s110-25 cost base (incidental disposal
  // costs reduce the gain). One whole-property gain, then split per owner.
  const totalNominalGain = proceeds.minus(sellingCosts).minus(costBase);
  const isCapitalLoss = totalNominalGain.lte(0);
  const monthsHeld = monthsHeldStrict(input.acquisitionDate, input.disposalDate);

  const flagsById = new Map<string, UncomputedFlag>();
  const owners: OwnerCgtOutcome[] = [];
  let yourEstimatedTax = new Decimal(0);
  let totalTaxableGain = new Decimal(0);

  for (const owner of input.owners) {
    if (owner.weight <= 0) continue;
    const nominalGainShare = totalNominalGain.times(owner.weight);

    // Capital loss → no discount dispatch; the share is a loss carried to
    // the owner's other gains. Surface the share, no tax.
    if (isCapitalLoss) {
      owners.push({
        entityId: owner.entityId,
        name: owner.name,
        entityType: owner.entityType,
        isYou: owner.isYou,
        weight: owner.weight,
        nominalGainShare,
        discountRate: new Decimal(0),
        taxableGain: nominalGainShare, // negative — a loss
        metHoldingPeriod: monthsHeld >= 12,
        reason:
          'Capital loss on disposal — no CGT. The loss can offset capital gains in the same or a future year (s102-10).',
        estimatedTax: owner.isYou ? new Decimal(0) : null,
        estimatedTaxBasis: owner.isYou
          ? 'No CGT — this disposal is a capital loss.'
          : 'No CGT — capital loss; the loss belongs to this owner.',
        uncomputed: [],
      });
      continue;
    }

    const cgt = calculateCgtDiscountDecimal({
      entityType: owner.entityType,
      monthsHeld,
      nominalGain: nominalGainShare,
      isComplying: owner.isComplying ?? true,
      isForeignResident: owner.isForeignResident ?? false,
      acquisitionContractDate: input.acquisitionDate,
      disposalFy: input.disposalFy,
      config: input.config,
    });

    for (const u of cgt.uncomputed) flagsById.set(u.id, u);
    totalTaxableGain = totalTaxableGain.plus(cgt.discountedGain);

    // §12.14 FW-2 — a POST_REFORM disposal returns a non-discounted gain plus
    // a directive to route through indexation. We do NOT present that as a
    // settled "taxable gain"; we surface it as UNCOMPUTED so no silent
    // post-reform number reaches the user.
    const isPostReform = cgt.reason.startsWith('POST_REFORM');
    if (isPostReform) {
      flagsById.set('UC-CGT-POST-REFORM', {
        id: 'UC-CGT-POST-REFORM',
        rationale:
          'This asset was acquired after the 12 May 2026 reform cut-over, so the 50% CGT discount no longer applies. The post-reform indexed-cost-base + 30%-floor figure is not estimated here — see the Tax tab once the new rules commence.',
      });
    }

    let estimatedTax: Decimal | null = null;
    let estimatedTaxBasis: string;
    if (owner.isYou && !isPostReform) {
      // The only tax dollar we estimate — and only at the user's CURRENT
      // marginal rate. A large gain may push part into a higher bracket; the
      // basis copy says so and points at the Tax tab for the precise figure.
      const rate = new Decimal(Math.max(0, Math.min(1, input.userMarginalRate)));
      estimatedTax = cgt.discountedGain.times(rate);
      yourEstimatedTax = yourEstimatedTax.plus(estimatedTax);
      estimatedTaxBasis = `Estimated at your current marginal rate of ${(input.userMarginalRate * 100).toFixed(0)}%. A large gain can push part into a higher bracket — see the Tax tab for the precise figure.`;
    } else if (isPostReform) {
      estimatedTaxBasis =
        'Post-reform acquisition — the discount no longer applies; not estimated here.';
    } else if (owner.entityType === 'COMPANY') {
      estimatedTaxBasis =
        'Taxed in the company’s return at the company rate (25% or 30%) — no CGT discount applies to companies (s115-10).';
    } else if (owner.entityType === 'SMSF') {
      estimatedTaxBasis =
        'Taxed in the fund at the 15% complying-fund rate (less any pension-phase exemption) — confirm with your accountant.';
    } else {
      estimatedTaxBasis =
        'Added to this owner’s assessable income and taxed at their own marginal rate in their own return.';
    }

    owners.push({
      entityId: owner.entityId,
      name: owner.name,
      entityType: owner.entityType,
      isYou: owner.isYou,
      weight: owner.weight,
      nominalGainShare,
      discountRate: cgt.discountRate,
      taxableGain: cgt.discountedGain,
      metHoldingPeriod: cgt.metHoldingPeriod,
      reason: cgt.reason,
      estimatedTax,
      estimatedTaxBasis,
      uncomputed: cgt.uncomputed,
    });
  }

  return {
    costBase,
    totalNominalGain,
    totalTaxableGain,
    isCapitalLoss,
    yourEstimatedTax,
    owners,
    flags: [...flagsById.values()],
  };
}

// =============================================================================
// Ownership resolution — reuse the AD-2 attributor so the lever and the
// per-entity tax page agree on who owns what share of the property.
// =============================================================================

/** The property's ownership context + the candidate owners' entity facts. */
export interface PropertyOwnershipResolution {
  /** The AD-2 attribution context (legal owner + group + override). */
  ownershipContext: AssetOwnershipContext;
  /** Every candidate owner (legal owner, stake holders, beneficial owner). */
  candidates: PropertyOwner[];
}

/**
 * Resolve the property's owners into weighted shares via the canonical
 * `attributeAsset` decision (the same one the entity-tax assembler uses).
 * Pure — the caller does the DB reads and hands in the resolved facts.
 *
 * Returns owners with `weight > 0` only. A beneficial override redirects the
 * whole gain to the beneficial owner; an ownership group splits per legal
 * interest; no group/override leaves the legal owner at 100%.
 */
export function resolvePropertyOwners(
  resolution: PropertyOwnershipResolution,
): { owners: ResolvedOwner[]; flags: UncomputedFlag[] } {
  const flagsById = new Map<string, UncomputedFlag>();
  const owners: ResolvedOwner[] = [];
  // Dedupe candidates by entityId — a stake holder can also be the legal owner.
  const byId = new Map<string, PropertyOwner>();
  for (const c of resolution.candidates) byId.set(c.entityId, c);

  for (const candidate of byId.values()) {
    const outcome = attributeAsset(candidate.entityId, resolution.ownershipContext);
    if (outcome.flag) flagsById.set(outcome.flag.id, outcome.flag);
    if (outcome.weight <= 0) continue;
    owners.push({ ...candidate, weight: outcome.weight });
  }

  return { owners, flags: [...flagsById.values()] };
}

/**
 * Map a `LegalEntityType` to the CGT-eligible discount domain. Trust-family
 * types all take the trust 50% discount at the trust level; company-family
 * types take 0%; INDIVIDUAL/PERSONAL_NAME/SOLE_TRADER take the individual
 * 50%. Exotic / unsupported types fall back to the individual rate and the
 * caller should treat the result as indicative (a note is the honest move).
 */
export function toCgtEntityType(legalType: string): {
  type: CgtEligibleEntityType;
  approximated: boolean;
} {
  switch (legalType) {
    case 'PERSONAL_NAME':
    case 'INDIVIDUAL':
    case 'SOLE_TRADER':
      return { type: legalType === 'SOLE_TRADER' ? 'SOLE_TRADER' : 'PERSONAL_NAME', approximated: false };
    case 'PARTNERSHIP':
      return { type: 'PARTNERSHIP', approximated: false };
    case 'COMPANY':
    case 'FOREIGN_COMPANY':
    case 'INCORPORATED_ASSOCIATION':
    case 'CO_OPERATIVE':
    case 'CUSTODIAN_PLATFORM':
      return { type: 'COMPANY', approximated: legalType !== 'COMPANY' };
    case 'DISCRETIONARY_TRUST':
      return { type: 'DISCRETIONARY_TRUST', approximated: false };
    case 'UNIT_TRUST':
      return { type: 'UNIT_TRUST', approximated: false };
    case 'FIXED_TRUST':
    case 'HYBRID_TRUST':
    case 'TESTAMENTARY_TRUST':
    case 'BARE_TRUST':
    case 'DECEASED_ESTATE':
      return { type: 'DISCRETIONARY_TRUST', approximated: true };
    case 'SMSF':
      return { type: 'SMSF', approximated: false };
    default:
      return { type: 'PERSONAL_NAME', approximated: true };
  }
}
