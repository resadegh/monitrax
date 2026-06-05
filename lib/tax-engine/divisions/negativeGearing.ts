/**
 * Phase 41e.8 — Negative gearing + per-entity loss treatment.
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §11.
 *
 * AU primary authority:
 *   - ITAA 1997 Div 8 — general deductions (s8-1 nexus)
 *   - ITAA 1997 Div 36 — tax loss offset rules (individuals offset
 *     against other income; trusts/companies trap losses)
 *   - ITAA 1997 Div 165 — company loss tests (COT/SBT) — flagged for
 *     41e.15 sub-PR
 *   - ITAA 1936 Sch 2F — trust loss tests — flagged for 41e.15 sub-PR
 *
 * **Phase 41E reform 2026-27 — Measure 1 extension (41E.1):**
 *   - `applyNegativeGearing` now takes an optional `regime` parameter
 *     (defaults `'PRE_REFORM_GRANDFATHERED'` so every existing caller
 *     is byte-for-byte unchanged — back-compat preserved per CLAUDE.md §12.14 FW-1).
 *   - When `regime === 'POST_REFORM_RESTRICTED'`, the function flips
 *     the entity's loss-offset behaviour from offsetting other income
 *     to carrying forward against future property income only. Loss
 *     is quarantined at the entity (the exposure draft will pin
 *     whether quarantining is per-property or per-entity; v1 reports
 *     the carry-forward, surfaces UC-NEG-GEARING-QUARANTINE-SCOPE-PENDING-DRAFT
 *     for the precise scope until then).
 *   - For UC_* regimes (contract date unknown / new build unconfirmed),
 *     the function falls back to the pre-reform behaviour AND surfaces
 *     the UNCOMPUTED — conservative default (per CLAUDE.md §13.3 + HR-3).
 *
 * Caller derives the regime via `deriveNegativeGearingRegime()` in
 * `./negativeGearingRegime.ts`. Single canonical SSOT.
 *
 * **Core principle:** the AU treatment of net rental/business losses
 * differs sharply by entity type:
 *   - **PERSONAL_NAME / SOLE_TRADER** — losses offset other income
 *     (salary, etc.) in the same year. This is "negative gearing" in
 *     the popular sense — a $20k rental loss reduces taxable income
 *     by $20k.
 *   - **PARTNERSHIP** — losses flow to partners per agreement; partners
 *     offset against their own income (effectively same as individual).
 *   - **DISCRETIONARY_TRUST / UNIT_TRUST** — losses TRAP at the trust
 *     level. Cannot be distributed to beneficiaries. Carry forward
 *     and offset trust income in future years (subject to s100A loss
 *     tests). 41e.15 ships the loss-test sub-PR.
 *   - **COMPANY** — losses trap at the company level. Carry forward
 *     subject to COT (Continuity of Ownership) or SBT (Same Business
 *     Test) per Div 165. 41e.15 ships the test classifier.
 *   - **SMSF** — investment losses offset other fund income same year
 *     (super funds work like individuals for this purpose). Special
 *     rules for non-arm's-length losses (NALI) — flagged for 41e.11.
 *
 * Pure functions; no DB. Pairs with the entity-aware aggregators
 * (41e.0 slice C) — caller passes per-entity income/expense totals,
 * receives the loss treatment per entity type.
 */

import type { AuthorityCitation, UncomputedFlag } from '../types';
import type { NegativeGearingRegime } from './negativeGearingRegime';
import { Decimal, toDecimal } from '@/lib/decimal';

export type LossTreatmentEntity =
  | 'PERSONAL_NAME'
  | 'SOLE_TRADER'
  | 'PARTNERSHIP'
  | 'COMPANY'
  | 'DISCRETIONARY_TRUST'
  | 'UNIT_TRUST'
  | 'SMSF';

export interface NegativeGearingInput {
  entityType: LossTreatmentEntity;
  /**
   * Income from the source that may produce a loss. For property:
   * gross rent. For business: gross revenue. Annualised.
   */
  grossIncome: number;
  /**
   * Deductible expenses against that income. For property: interest
   * + rates + insurance + repairs + depreciation. Annualised.
   */
  deductibleExpenses: number;
  /**
   * Other taxable income at the entity level (salary for individuals,
   * other business income for trusts/companies, etc.). Used to
   * determine if losses can be absorbed in the current year.
   */
  otherIncome: number;
  /**
   * Phase 41E.1 — Measure 1 regime (per CLAUDE.md §12.14 FW-1).
   *
   * Defaults to `'PRE_REFORM_GRANDFATHERED'` when omitted — every
   * existing call site (Phase 41e and earlier) is byte-for-byte
   * unchanged. Callers in 41E.2+ derive the regime via
   * `deriveNegativeGearingRegime()` and pass it explicitly per
   * property.
   *
   * Only relevant when the loss is property-related (residential
   * rental). For business losses on non-property activity the
   * caller passes `'PRE_REFORM_GRANDFATHERED'` regardless — Measure 1
   * is scoped to residential property only.
   */
  regime?: NegativeGearingRegime;
}

export type LossTreatment =
  | 'OFFSET_OTHER_INCOME' // individual / sole trader / partnership / SMSF
  | 'TRAPPED_AT_ENTITY' // trust / company → carry forward
  | 'NO_LOSS'; // gain or break-even

export interface NegativeGearingResult {
  netResult: number; // positive → net income, negative → net loss
  /** Where does the loss go? */
  lossTreatment: LossTreatment;
  /** Loss absorbed against other income at the entity level. */
  lossAbsorbedThisFy: number;
  /** Loss that carries forward (trapped) — 0 for individuals/SMSF. */
  lossCarriedForward: number;
  /** Tax-position impact at entity level: net taxable income. */
  taxableIncomeAtEntity: number;
  reason: string;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

const BASE_CITATIONS: AuthorityCitation[] = [
  { kind: 'ITAA_1997', reference: 'Div 8', lastReviewed: '2026-05-05' },
  { kind: 'ITAA_1997', reference: 'Div 36', lastReviewed: '2026-05-05' },
];

const ENTITY_OFFSETS_OWN_INCOME: Record<LossTreatmentEntity, boolean> = {
  PERSONAL_NAME: true, // negative gearing — offset salary
  SOLE_TRADER: true,
  PARTNERSHIP: true, // partners offset their own income (effectively same)
  SMSF: true, // fund income offsets investment losses
  DISCRETIONARY_TRUST: false, // trapped at trust
  UNIT_TRUST: false,
  COMPANY: false,
};

/**
 * Compute the loss treatment for a given entity's income/expense pair.
 *
 * For loss-offsetting entity types (individual / sole trader / partnership /
 * SMSF), the loss reduces other income at the entity level and the
 * remaining "taxable income at entity" is reported. Carry-forward is
 * 0 unless the loss exceeds other income (true tax-loss case — flagged
 * UNCOMPUTED for now since multi-year tax-loss tracking needs caller
 * to pass prior-year balances).
 *
 * For trust/company entities, the entire loss carries forward + is
 * subject to loss-tests in 41e.15.
 */
export function applyNegativeGearing(
  input: NegativeGearingInput,
): NegativeGearingResult {
  const { entityType, grossIncome, deductibleExpenses, otherIncome } = input;
  // Phase 41E.1 — back-compat default. Existing callers omit `regime`
  // and get pre-reform behaviour byte-for-byte.
  const regime: NegativeGearingRegime =
    input.regime ?? 'PRE_REFORM_GRANDFATHERED';

  const netResult = grossIncome - deductibleExpenses;
  const citations = [...BASE_CITATIONS];
  const uncomputed: UncomputedFlag[] = [];

  // Net positive — no loss to treat.
  if (netResult >= 0) {
    return {
      netResult,
      lossTreatment: 'NO_LOSS',
      lossAbsorbedThisFy: 0,
      lossCarriedForward: 0,
      taxableIncomeAtEntity: otherIncome + netResult,
      reason: `Net result $${Math.round(netResult).toLocaleString()} (income ≥ expenses) — no loss treatment required.`,
      citations,
      uncomputed,
    };
  }

  // Net loss — entity-aware treatment.
  const lossAmount = Math.abs(netResult);

  // Phase 41E.1 — Measure 1 regime guard.
  // When the regime restricts offset (POST_REFORM_RESTRICTED), the
  // loss CANNOT offset other income — quarantined at the entity
  // regardless of entity type. The exposure draft will pin whether
  // the carry-forward is per-property or per-entity; v1 surfaces
  // UNCOMPUTED for that precise scope until the draft lands.
  if (regime === 'POST_REFORM_RESTRICTED') {
    uncomputed.push({
      id: 'UC-NEG-GEARING-QUARANTINE-SCOPE-PENDING-DRAFT',
      rationale:
        'Phase 41E Measure 1 — residential property contracted after 7:30pm AEST 12 May 2026 + not a new build → loss does not offset other income from FY 2027-28 (negative-gearing reform). The precise scope of the loss quarantine (per-property vs per-entity) awaits the Treasury exposure draft. v1 reports the full carry-forward at the entity level conservatively.',
      citation: {
        kind: 'ITAA_1997',
        reference: 'Div 36 (proposed Phase 41E Measure 1 amendments)',
        lastReviewed: '2026-05-16',
      },
    });
    return {
      netResult,
      lossTreatment: 'TRAPPED_AT_ENTITY',
      lossAbsorbedThisFy: 0,
      lossCarriedForward: lossAmount,
      taxableIncomeAtEntity: otherIncome,
      reason: `Negative gearing — restricted by Phase 41E Measure 1 (property contracted after 12 May 2026 7:30pm AEST, not a new build). $${Math.round(lossAmount).toLocaleString()} cannot offset other income from FY 2027-28; carries forward against future property income.`,
      citations,
      uncomputed,
    };
  }

  // Phase 41E.1 — surface UNCOMPUTED flags for the UC_* regimes
  // (contract date unknown / new build unconfirmed) but fall back
  // to the conservative pre-reform behaviour for the calc.
  if (regime === 'UC_PROPERTY_CONTRACT_DATE_UNKNOWN') {
    uncomputed.push({
      id: 'UC-PROPERTY-CONTRACT-DATE-UNKNOWN',
      rationale:
        'Property is residential and the target FY is post-1 Jul 2027, but `acquisitionContractDate` is missing. Cannot determine if grandfathered or post-reform. Treating as pre-reform (conservative — gives the user the benefit) until contract date is confirmed.',
      citation: {
        kind: 'ITAA_1997',
        reference: 'Div 36 + s109-5 (CGT event A1 / contract date)',
        lastReviewed: '2026-05-16',
      },
    });
  } else if (regime === 'UC_NEW_BUILD_UNCONFIRMED') {
    uncomputed.push({
      id: 'UC-NEW-BUILD-UNCONFIRMED',
      rationale:
        'Property contracted after 12 May 2026 7:30pm AEST cut-over. Whether it qualifies as a new build (negative gearing still permitted) or restricted (negative gearing denied) needs user confirmation via `Property.isNewBuild` + `Property.newBuildEvidence`. Treating as pre-reform (conservative) until confirmed.',
      citation: {
        kind: 'ITAA_1997',
        reference: 'Div 36 (proposed Phase 41E Measure 1 — new build definition)',
        lastReviewed: '2026-05-16',
      },
    });
  }

  if (ENTITY_OFFSETS_OWN_INCOME[entityType]) {
    // Individual / sole trader / partnership / SMSF — offset other income.
    const absorbed = Math.min(lossAmount, Math.max(0, otherIncome));
    const carriedForward = lossAmount - absorbed;
    const remaining = otherIncome - absorbed;

    if (carriedForward > 0) {
      uncomputed.push({
        id: 'UC-TAX-LOSS-CARRY-FORWARD',
        rationale: `Loss exceeds other income at entity level. $${Math.round(carriedForward).toLocaleString()} carries to next FY as a tax loss. Multi-year tax-loss tracking (Div 36 with prior-year balances) lands in a future sub-PR — caller must persist this carry-forward in the user's tax-loss register.`,
        citation: { kind: 'ITAA_1997', reference: 'Div 36', lastReviewed: '2026-05-05' },
      });
    }

    return {
      netResult,
      lossTreatment: 'OFFSET_OTHER_INCOME',
      lossAbsorbedThisFy: absorbed,
      lossCarriedForward: carriedForward,
      taxableIncomeAtEntity: remaining,
      reason:
        entityType === 'PERSONAL_NAME' || entityType === 'SOLE_TRADER'
          ? `Negative gearing — $${Math.round(lossAmount).toLocaleString()} loss offsets other income (Div 8 + Div 36). $${Math.round(absorbed).toLocaleString()} absorbed; $${Math.round(carriedForward).toLocaleString()} carries forward.`
          : entityType === 'PARTNERSHIP'
            ? `Partnership loss — flows to partners per agreement (s92). Partners offset against their own income; v1 treats partnership-level same as individual.`
            : `SMSF investment loss — offset against other fund income at fund level. Non-arm's-length loss test (NALI) deferred to 41e.11.`,
      citations,
      uncomputed,
    };
  }

  // Trust / company — trap at entity, carry forward.
  const trustOrCompany =
    entityType === 'DISCRETIONARY_TRUST' ||
    entityType === 'UNIT_TRUST' ||
    entityType === 'COMPANY';

  if (trustOrCompany) {
    citations.push(
      entityType === 'COMPANY'
        ? { kind: 'ITAA_1997', reference: 'Div 165', lastReviewed: '2026-05-05' }
        : { kind: 'ITAA_1936', reference: 'Sch 2F', lastReviewed: '2026-05-05' },
    );
    uncomputed.push({
      id: entityType === 'COMPANY' ? 'UC-COMPANY-LOSS-TESTS' : 'UC-TRUST-LOSS-TESTS',
      rationale:
        entityType === 'COMPANY'
          ? `Company tax losses are subject to Continuity of Ownership Test (s165) OR Same Business Test (s165-13). v1 reports the carry-forward amount; loss-test classifier lands with 41e.15.`
          : `Trust tax losses are subject to Sch 2F tests (Income Injection, Pattern of Distributions). v1 reports the carry-forward amount; loss-test classifier lands with 41e.15.`,
      citation:
        entityType === 'COMPANY'
          ? { kind: 'ITAA_1997', reference: 'Div 165', lastReviewed: '2026-05-05' }
          : { kind: 'ITAA_1936', reference: 'Sch 2F', lastReviewed: '2026-05-05' },
    });
  }

  return {
    netResult,
    lossTreatment: 'TRAPPED_AT_ENTITY',
    lossAbsorbedThisFy: 0,
    lossCarriedForward: lossAmount,
    taxableIncomeAtEntity: otherIncome,
    reason: `${entityType} loss of $${Math.round(lossAmount).toLocaleString()} is trapped at the entity level — carries forward (subject to loss-tests in 41e.15). Other income at the entity ($${Math.round(otherIncome).toLocaleString()}) is taxed independently this FY.`,
    citations,
    uncomputed,
  };
}

/**
 * Helper — returns true if the entity type can offset losses against
 * other income in the same FY. Useful for UI tooltips ("your trust
 * cannot use this loss against your salary; it carries forward").
 */
export function entityCanOffsetLossesCurrentFy(
  entityType: LossTreatmentEntity,
): boolean {
  return ENTITY_OFFSETS_OWN_INCOME[entityType];
}

// =============================================================================
// Q-DEC PR 2.D.3c — Decimal sibling path (§12.14 FW-1 preserved)
// =============================================================================

export interface NegativeGearingInputDecimal {
  entityType: LossTreatmentEntity;
  grossIncome: number | string | Decimal;
  deductibleExpenses: number | string | Decimal;
  otherIncome: number | string | Decimal;
  regime?: NegativeGearingRegime;
}

export interface NegativeGearingResultDecimal {
  netResult: Decimal;
  lossTreatment: LossTreatment;
  lossAbsorbedThisFy: Decimal;
  lossCarriedForward: Decimal;
  taxableIncomeAtEntity: Decimal;
  reason: string;
  citations: AuthorityCitation[];
  uncomputed: UncomputedFlag[];
}

/**
 * Decimal sibling of `applyNegativeGearing`. **§12.14 FW-1 Measure 1
 * regime guard preserved bit-for-bit** — POST_REFORM_RESTRICTED branch
 * quarantines the loss; UC_* regimes surface UNCOMPUTED + fall back to
 * pre-reform behaviour conservatively.
 */
export function applyNegativeGearingDecimal(
  input: NegativeGearingInputDecimal,
): NegativeGearingResultDecimal {
  const { entityType } = input;
  const grossIncome = toDecimal(input.grossIncome) ?? new Decimal(0);
  const deductibleExpenses = toDecimal(input.deductibleExpenses) ?? new Decimal(0);
  const otherIncome = toDecimal(input.otherIncome) ?? new Decimal(0);
  const regime: NegativeGearingRegime = input.regime ?? 'PRE_REFORM_GRANDFATHERED';

  const netResult = grossIncome.minus(deductibleExpenses);
  const citations = [...BASE_CITATIONS];
  const uncomputed: UncomputedFlag[] = [];

  if (netResult.gte(0)) {
    return {
      netResult,
      lossTreatment: 'NO_LOSS',
      lossAbsorbedThisFy: new Decimal(0),
      lossCarriedForward: new Decimal(0),
      taxableIncomeAtEntity: otherIncome.plus(netResult),
      reason: `Net result $${netResult.toDecimalPlaces(0).toString()} (income ≥ expenses) — no loss treatment required.`,
      citations,
      uncomputed,
    };
  }

  const lossAmount = netResult.abs();

  if (regime === 'POST_REFORM_RESTRICTED') {
    uncomputed.push({
      id: 'UC-NEG-GEARING-QUARANTINE-SCOPE-PENDING-DRAFT',
      rationale:
        'Phase 41E Measure 1 — residential property contracted after 7:30pm AEST 12 May 2026 + not a new build → loss does not offset other income from FY 2027-28 (negative-gearing reform). The precise scope of the loss quarantine (per-property vs per-entity) awaits the Treasury exposure draft. v1 reports the full carry-forward at the entity level conservatively.',
      citation: {
        kind: 'ITAA_1997',
        reference: 'Div 36 (proposed Phase 41E Measure 1 amendments)',
        lastReviewed: '2026-05-16',
      },
    });
    return {
      netResult,
      lossTreatment: 'TRAPPED_AT_ENTITY',
      lossAbsorbedThisFy: new Decimal(0),
      lossCarriedForward: lossAmount,
      taxableIncomeAtEntity: otherIncome,
      reason: `Negative gearing — restricted by Phase 41E Measure 1 (property contracted after 12 May 2026 7:30pm AEST, not a new build). $${lossAmount.toDecimalPlaces(0).toString()} cannot offset other income from FY 2027-28; carries forward against future property income.`,
      citations,
      uncomputed,
    };
  }

  if (regime === 'UC_PROPERTY_CONTRACT_DATE_UNKNOWN') {
    uncomputed.push({
      id: 'UC-PROPERTY-CONTRACT-DATE-UNKNOWN',
      rationale:
        'Property is residential and the target FY is post-1 Jul 2027, but `acquisitionContractDate` is missing. Cannot determine if grandfathered or post-reform. Treating as pre-reform (conservative — gives the user the benefit) until contract date is confirmed.',
      citation: {
        kind: 'ITAA_1997',
        reference: 'Div 36 + s109-5 (CGT event A1 / contract date)',
        lastReviewed: '2026-05-16',
      },
    });
  } else if (regime === 'UC_NEW_BUILD_UNCONFIRMED') {
    uncomputed.push({
      id: 'UC-NEW-BUILD-UNCONFIRMED',
      rationale:
        'Property contracted after 12 May 2026 7:30pm AEST cut-over. Whether it qualifies as a new build (negative gearing still permitted) or restricted (negative gearing denied) needs user confirmation via `Property.isNewBuild` + `Property.newBuildEvidence`. Treating as pre-reform (conservative) until confirmed.',
      citation: {
        kind: 'ITAA_1997',
        reference: 'Div 36 (proposed Phase 41E Measure 1 — new build definition)',
        lastReviewed: '2026-05-16',
      },
    });
  }

  if (ENTITY_OFFSETS_OWN_INCOME[entityType]) {
    const absorbed = Decimal.min(lossAmount, Decimal.max(new Decimal(0), otherIncome));
    const carriedForward = lossAmount.minus(absorbed);
    const remaining = otherIncome.minus(absorbed);

    if (carriedForward.gt(0)) {
      uncomputed.push({
        id: 'UC-TAX-LOSS-CARRY-FORWARD',
        rationale: `Loss exceeds other income at entity level. $${carriedForward.toDecimalPlaces(0).toString()} carries to next FY as a tax loss. Multi-year tax-loss tracking (Div 36 with prior-year balances) lands in a future sub-PR — caller must persist this carry-forward in the user's tax-loss register.`,
        citation: { kind: 'ITAA_1997', reference: 'Div 36', lastReviewed: '2026-05-05' },
      });
    }

    return {
      netResult,
      lossTreatment: 'OFFSET_OTHER_INCOME',
      lossAbsorbedThisFy: absorbed,
      lossCarriedForward: carriedForward,
      taxableIncomeAtEntity: remaining,
      reason:
        entityType === 'PERSONAL_NAME' || entityType === 'SOLE_TRADER'
          ? `Negative gearing — $${lossAmount.toDecimalPlaces(0).toString()} loss offsets other income (Div 8 + Div 36). $${absorbed.toDecimalPlaces(0).toString()} absorbed; $${carriedForward.toDecimalPlaces(0).toString()} carries forward.`
          : entityType === 'PARTNERSHIP'
            ? `Partnership loss — flows to partners per agreement (s92). Partners offset against their own income; v1 treats partnership-level same as individual.`
            : `SMSF investment loss — offset against other fund income at fund level. Non-arm's-length loss test (NALI) deferred to 41e.11.`,
      citations,
      uncomputed,
    };
  }

  // Trust / company — trap at entity.
  const trustOrCompany =
    entityType === 'DISCRETIONARY_TRUST' ||
    entityType === 'UNIT_TRUST' ||
    entityType === 'COMPANY';

  if (trustOrCompany) {
    citations.push(
      entityType === 'COMPANY'
        ? { kind: 'ITAA_1997', reference: 'Div 165', lastReviewed: '2026-05-05' }
        : { kind: 'ITAA_1936', reference: 'Sch 2F', lastReviewed: '2026-05-05' },
    );
    uncomputed.push({
      id: entityType === 'COMPANY' ? 'UC-COMPANY-LOSS-TESTS' : 'UC-TRUST-LOSS-TESTS',
      rationale:
        entityType === 'COMPANY'
          ? `Company tax losses are subject to Continuity of Ownership Test (s165) OR Same Business Test (s165-13). v1 reports the carry-forward amount; loss-test classifier lands with 41e.15.`
          : `Trust tax losses are subject to Sch 2F tests (Income Injection, Pattern of Distributions). v1 reports the carry-forward amount; loss-test classifier lands with 41e.15.`,
      citation:
        entityType === 'COMPANY'
          ? { kind: 'ITAA_1997', reference: 'Div 165', lastReviewed: '2026-05-05' }
          : { kind: 'ITAA_1936', reference: 'Sch 2F', lastReviewed: '2026-05-05' },
    });
  }

  return {
    netResult,
    lossTreatment: 'TRAPPED_AT_ENTITY',
    lossAbsorbedThisFy: new Decimal(0),
    lossCarriedForward: lossAmount,
    taxableIncomeAtEntity: otherIncome,
    reason: `${entityType} loss of $${lossAmount.toDecimalPlaces(0).toString()} is trapped at the entity level — carries forward (subject to loss-tests in 41e.15). Other income at the entity ($${otherIncome.toDecimalPlaces(0).toString()}) is taxed independently this FY.`,
    citations,
    uncomputed,
  };
}
