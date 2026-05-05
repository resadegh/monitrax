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
