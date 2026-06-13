/**
 * Phase 47 Stage D — AD-2: stake & beneficial attribution (pure core).
 *
 * The TR 93/32 split + beneficial-override attributor for the
 * `entityTaxFactsAssembler`. Given an entity and the ownership context
 * of an income/expense-bearing asset, it returns the FRACTION of that
 * asset's income/deductions that belongs to the entity — so a jointly
 * held rental splits 50/50 (joint tenants) or per the legal share
 * percentages (tenants in common), and an asset under a bare-trust /
 * nominee arrangement attributes to its BENEFICIAL owner, not the legal
 * title holder.
 *
 * Binding contract: `PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md` §14 AD-2
 * + `PHASE_47_ENTITY_OWNERSHIP_FABRIC.md` §4A P2/P3/P5/P8 + D6.
 *
 * Three dimensions stay separable (Phase 44 §3A): legal title
 * (`OwnershipStake`), beneficial ownership (`BeneficialOwnershipOverride`),
 * and control (relationship edges). This module reads the first two; it
 * never invents a number — when a tenants-in-common split cannot be
 * computed (shares missing / not summing to 100%) it falls back to the
 * documented pre-AD-2 behaviour (flat by legal owner) and the caller
 * surfaces an honest flag. PURE — no I/O, no tax arithmetic (§8.3).
 */

import type { UncomputedFlag } from '@/lib/tax-engine/types';

/** Mirrors `OwnershipStake` (only the fields attribution needs). */
export interface StakeLite {
  entityId: string;
  /** Required for TENANTS_IN_COMMON; reporting-only / null for JOINT_TENANTS. */
  sharePct: number | null;
}

/** Mirrors `OwnershipGroup` (active for the FY), with its stakes. */
export interface OwnershipGroupLite {
  tenancyType: 'SOLE' | 'JOINT_TENANTS' | 'TENANTS_IN_COMMON' | 'OTHER';
  stakes: StakeLite[];
}

/** Mirrors `BeneficialOwnershipOverride` (active for the FY). */
export interface BeneficialOverrideLite {
  legalOwnerEntityId: string;
  beneficialOwnerEntityId: string;
  basis: string;
}

/** The ownership context of ONE asset the engine is attributing. */
export interface AssetOwnershipContext {
  /** The `ownerEntityId` stamped on the row (the legal-title default). */
  legalOwnerEntityId: string;
  /** The `OwnershipGroup` covering the asset, if any. */
  group?: OwnershipGroupLite;
  /** The `BeneficialOwnershipOverride` on the asset, if any. */
  override?: BeneficialOverrideLite;
}

export interface AttributionOutcome {
  /** Fraction (0..1) of the asset's income/deductions belonging to the entity. */
  weight: number;
  /** A TR 93/32 co-ownership split was applied. */
  splitApplied: boolean;
  /** Beneficial ownership redirected the income (to or away from the entity). */
  overrideApplied: boolean;
  /**
   * Honesty flag the caller should surface (deduped by `id`). Set when a
   * split / override changed the attribution, or when a split was
   * REQUESTED but could not be computed (fall-back to flat).
   */
  flag?: UncomputedFlag;
}

const TR_93_32 = { kind: 'TR' as const, reference: 'TR 93/32', lastReviewed: '2026-06-13' };
const SHARE_SUM_TOLERANCE = 0.01;

/**
 * Is a date-bounded record (group / override) active at any point during
 * the financial-year window? Active = starts before the FY ends AND
 * (never ended OR ends on/after the FY start). Pure.
 */
export function isActiveInFy(
  effectiveFrom: Date,
  effectiveTo: Date | null,
  fyRange: { start: Date; end: Date },
): boolean {
  if (effectiveFrom >= fyRange.end) return false;
  if (effectiveTo !== null && effectiveTo < fyRange.start) return false;
  return true;
}

/**
 * The single attribution decision for an asset → entity. Precedence:
 *   1. Beneficial override wins outright — beneficial owner takes 100%,
 *      everyone else (incl. the legal owner) takes 0 (CGT + income follow
 *      the beneficial owner, §4A P8). Both sides get a flag so neither is
 *      silent.
 *   2. Ownership group splits per legal interest (TR 93/32) — joint
 *      tenants share equally (survivorship, not fractions); tenants in
 *      common follow `sharePct`. An uncomputable TIC split falls back to
 *      flat-by-legal-owner and flags it.
 *   3. No group / override → flat: the legal owner takes 100%.
 * Pure — exported for unit testing.
 */
export function attributeAsset(
  entityId: string,
  ctx: AssetOwnershipContext,
): AttributionOutcome {
  // --- 1. Beneficial ownership override (supersedes legal title) -------
  if (ctx.override) {
    const { beneficialOwnerEntityId, legalOwnerEntityId } = ctx.override;
    if (entityId === beneficialOwnerEntityId) {
      return {
        weight: 1,
        splitApplied: false,
        overrideApplied: true,
        flag: {
          id: 'UC-BENEFICIAL-OWNED',
          rationale:
            'Income and deductions from one or more assets are attributed to you as the BENEFICIAL owner — another entity holds the legal title (e.g. a bare trustee). CGT and income follow beneficial ownership; confirm the arrangement with your accountant.',
          citation: TR_93_32,
        },
      };
    }
    if (entityId === legalOwnerEntityId) {
      // Legal title held, but income belongs to the beneficial owner.
      return {
        weight: 0,
        splitApplied: false,
        overrideApplied: true,
        flag: {
          id: 'UC-BENEFICIAL-REDIRECTED',
          rationale:
            'You hold the legal title to one or more assets that are beneficially owned by another entity, so their income and deductions are recorded against that beneficial owner — not you — and are excluded from your position.',
          citation: TR_93_32,
        },
      };
    }
    // Neither legal nor beneficial owner — nothing to attribute.
    return { weight: 0, splitApplied: false, overrideApplied: true };
  }

  // --- 2. Ownership group (TR 93/32 split by legal interest) ----------
  if (ctx.group && ctx.group.tenancyType !== 'SOLE') {
    const { tenancyType, stakes } = ctx.group;
    const mine = stakes.find((s) => s.entityId === entityId);

    // Defensive: a group exists but the entity holds no stake. If it is
    // nonetheless the legal owner, fall back to flat (don't silently drop
    // its income); otherwise it has no claim.
    if (!mine) {
      if (entityId === ctx.legalOwnerEntityId) {
        return {
          weight: 1,
          splitApplied: false,
          overrideApplied: false,
          flag: unknownSplitFlag(),
        };
      }
      return { weight: 0, splitApplied: false, overrideApplied: false };
    }

    if (tenancyType === 'JOINT_TENANTS') {
      // Joint tenants hold equal undivided shares regardless of who paid.
      const n = stakes.length;
      return {
        weight: n > 0 ? 1 / n : 0,
        splitApplied: true,
        overrideApplied: false,
        flag: splitFlag(),
      };
    }

    if (tenancyType === 'TENANTS_IN_COMMON') {
      const allHavePct = stakes.every(
        (s) => s.sharePct !== null && s.sharePct !== undefined,
      );
      const sum = stakes.reduce((acc, s) => acc + (s.sharePct ?? 0), 0);
      const sumsTo100 = Math.abs(sum - 100) <= SHARE_SUM_TOLERANCE;
      if (allHavePct && sumsTo100) {
        return {
          weight: (mine.sharePct ?? 0) / 100,
          splitApplied: true,
          overrideApplied: false,
          flag: splitFlag(),
        };
      }
      // Cannot compute the split honestly — fall back to flat (the
      // documented pre-AD-2 behaviour) and surface the gap.
      return {
        weight: entityId === ctx.legalOwnerEntityId ? 1 : 0,
        splitApplied: false,
        overrideApplied: false,
        flag: unknownSplitFlag(),
      };
    }

    // tenancyType OTHER — exotic / unsupported; flat fall-back + flag.
    return {
      weight: entityId === ctx.legalOwnerEntityId ? 1 : 0,
      splitApplied: false,
      overrideApplied: false,
      flag: unknownSplitFlag(),
    };
  }

  // --- 3. No group / override (or SOLE group) → flat ------------------
  return {
    weight: entityId === ctx.legalOwnerEntityId ? 1 : 0,
    splitApplied: false,
    overrideApplied: false,
  };
}

function splitFlag(): UncomputedFlag {
  return {
    id: 'UC-OWNERSHIP-SPLIT',
    rationale:
      'Income and deductions from one or more co-owned assets were split to your legal interest (joint tenants share equally; tenants in common follow the recorded percentages) per ATO TR 93/32 — not attributed in full to a single owner.',
    citation: TR_93_32,
  };
}

function unknownSplitFlag(): UncomputedFlag {
  return {
    id: 'UC-OWNERSHIP-SPLIT-UNKNOWN',
    rationale:
      'A co-owned asset could not be split by legal interest (ownership percentages are missing or do not sum to 100%), so it is attributed in full to the legal owner for now. Set the ownership percentages to split it correctly.',
  };
}
