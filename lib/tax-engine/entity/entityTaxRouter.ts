/**
 * Phase 41e.0 — entity-aware tax router (skeleton).
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §3 + audit doc
 * §6.2, this is the dispatch entry point for the entity-aware tax layer.
 * It takes an `EntityTaxFacts` (per-entity inputs from the new
 * aggregator extensions in slice C) and routes to the right calc path
 * based on `LegalEntityType`:
 *
 *   - PERSONAL_NAME / SOLE_TRADER → wraps Phase 20's `calculateTaxPosition()`
 *   - COMPANY / DISCRETIONARY_TRUST / UNIT_TRUST / SMSF / PARTNERSHIP →
 *     stubbed with `UncomputedFlag` until 41e.1+ ship the rule modules
 *
 * The skeleton is deliberately conservative: each entity-type branch
 * returns a structurally-correct `EntityTaxPosition` carrying an
 * UNCOMPUTED flag with a plain-English rationale. This keeps the audit
 * trail honest (no false numbers — see audit §10.3) while the rule
 * modules ship one by one.
 *
 * Sub-PR ownership (per audit §8.1):
 *   - 41e.1   replaces COMPANY → adds CGT discount + capital loss netting
 *   - 41e.2/3 replaces SMSF → adds caps + Div 293/296 dispatch
 *   - 41e.4   replaces DISCRETIONARY_TRUST → adds Div 6/6E streaming
 *   - 41e.7   replaces COMPANY for small-business CGT (Div 152)
 *   - 41e.11  finalises SMSF triumvirate (sole purpose / in-house / LRBA)
 *   - 41e.17  the orchestrator; no longer goes through this skeleton
 */

import {
  calculateTaxPosition,
  type IncomeItem,
  type ExpenseItem,
  type DepreciationItem,
} from '../position/taxPositionCalculator';
import {
  getTaxYearConfig,
  getCurrentTaxYearConfig,
} from '../config/taxYearConfig';
import { allocateTrustDistribution } from '../divisions/trustDistribution';
import {
  applyCapitalLossNetting,
  type CapitalLossNettingResult,
  type CgtEvent,
  type CarryForwardLoss,
} from '../divisions/capitalLossNetting';
import type { CgtEligibleEntityType } from '../divisions/cgtDiscount';
import { trackContributionCaps } from '../super/capTracker';
import { calculateHighIncomeSuperTax } from '../super/highIncomeSuperTax';
import { calculateSmsfIncomeTax } from '../super/smsfIncomeTax';
import { classifyDiv7ALoans } from '../divisions/div7aLoanClassifier';
import type {
  AuthorityCitation,
  EntityTaxFacts,
  EntityTaxPosition,
  UncomputedFlag,
} from '../types';

const UNCOMPUTED_ENTITY_TAX: Record<string, UncomputedFlag> = {
  COMPANY: {
    id: 'UC-ENTITY-COMPANY',
    rationale:
      'Company-level tax dispatch (Div 7A, base-rate entity 25% / 30%, franking) lands with Phase 41e.6 and 41e.7. Until then, company income is flagged here and not netted into the household total.',
  },
  DISCRETIONARY_TRUST: {
    id: 'UC-ENTITY-DISCRETIONARY-TRUST',
    rationale:
      'Trust streaming + Div 6 / Div 6E + s100A zone classification lands with Phase 41e.1, 41e.4 and 41e.5. Until then, trust income is flagged and the household roll-up applies a default-distribution penalty rate per s99A.',
  },
  UNIT_TRUST: {
    id: 'UC-ENTITY-UNIT-TRUST',
    rationale:
      'Unit-trust pro-rata distribution (incl. NALI checks for SMSF unit-holders) lands with Phase 41e.4 and 41e.11. Until then, unit-trust income is flagged.',
  },
  SMSF: {
    id: 'UC-ENTITY-SMSF',
    rationale:
      'SMSF tax dispatch (15% accumulation / 0% pension / Div 296 from FY25-26) + sole-purpose + in-house-asset + LRBA compliance lands with Phase 41e.2, 41e.3 and 41e.11.',
  },
  PARTNERSHIP: {
    id: 'UC-ENTITY-PARTNERSHIP',
    rationale:
      'Partnership-level distribution to partners is deferred — partnerships are tax-transparent (s92), but the per-partner attribution requires the Phase 41e.17 orchestrator.',
  },
};

const BASE_CITATIONS: Record<string, AuthorityCitation[]> = {
  PERSONAL_NAME: [
    { kind: 'ITAA_1997', reference: 's4-10', lastReviewed: '2026-05-05' },
    { kind: 'ITAA_1997', reference: 'Div 1-6', lastReviewed: '2026-05-05' },
  ],
  SOLE_TRADER: [
    { kind: 'ITAA_1997', reference: 's4-10', lastReviewed: '2026-05-05' },
    { kind: 'ITAA_1997', reference: 's8-1', lastReviewed: '2026-05-05' },
  ],
};

/**
 * The seven entity types the CGT discount + loss-netting path supports
 * (Div 115). Phase 44 widened `EntityTaxFacts.entityType` to the full
 * structural grammar; the twelve new types are not yet reachable at
 * runtime (no UI creates them) and Part 1b wires their CGT dispatch.
 * Until then this guard narrows the type so the build stays sound —
 * for any non-eligible type CGT simply returns null (no CGT computed),
 * identical to an entity with no CGT events.
 */
const CGT_ELIGIBLE_ENTITY_TYPES: ReadonlySet<CgtEligibleEntityType> = new Set<CgtEligibleEntityType>([
  'PERSONAL_NAME',
  'SOLE_TRADER',
  'PARTNERSHIP',
  'COMPANY',
  'DISCRETIONARY_TRUST',
  'UNIT_TRUST',
  'SMSF',
]);

function isCgtEligibleEntityType(
  entityType: EntityTaxFacts['entityType'],
): entityType is CgtEligibleEntityType {
  return CGT_ELIGIBLE_ENTITY_TYPES.has(entityType as CgtEligibleEntityType);
}

/**
 * Compute CGT side calc if `cgtEvents` is non-empty. Returns null
 * otherwise. Independent of entity-specific income-tax dispatch so a
 * COMPANY entity (income tax UNCOMPUTED) can still surface a
 * fully-computed CGT figure with the right per-entity discount rate.
 */
function dispatchCgtIfPresent(
  facts: EntityTaxFacts,
): CapitalLossNettingResult | null {
  if (!facts.cgtEvents || facts.cgtEvents.length === 0) {
    return null;
  }
  if (!isCgtEligibleEntityType(facts.entityType)) {
    return null;
  }
  return applyCapitalLossNetting({
    entityType: facts.entityType,
    events: facts.cgtEvents.map((e) => ({
      id: e.id,
      monthsHeld: e.monthsHeld,
      nominalAmount: e.nominalAmount,
      label: e.label,
    })) as CgtEvent[],
    carryForwardLosses: facts.carryForwardCapitalLosses?.map((l) => ({
      financialYear: l.financialYear,
      amount: l.amount,
    })) as CarryForwardLoss[] | undefined,
    isComplying: facts.smsfIsComplying,
    isForeignResident: facts.isForeignResident,
  });
}

/**
 * Merge CGT citations + UNCOMPUTED into the cumulative position arrays
 * without duplicating entries. De-dup keys: `${kind}:${reference}` for
 * citations, `id` for flags.
 */
function mergeCgt(
  citations: AuthorityCitation[],
  uncomputed: UncomputedFlag[],
  cgt: CapitalLossNettingResult,
): { citations: AuthorityCitation[]; uncomputed: UncomputedFlag[] } {
  const seenCit = new Set(citations.map((c) => `${c.kind}:${c.reference}`));
  const mergedCitations = [...citations];
  for (const c of cgt.citations) {
    const key = `${c.kind}:${c.reference}`;
    if (!seenCit.has(key)) {
      seenCit.add(key);
      mergedCitations.push(c);
    }
  }
  const seenFlags = new Set(uncomputed.map((u) => u.id));
  const mergedUncomputed = [...uncomputed];
  for (const u of cgt.uncomputed) {
    if (!seenFlags.has(u.id)) {
      seenFlags.add(u.id);
      mergedUncomputed.push(u);
    }
  }
  return { citations: mergedCitations, uncomputed: mergedUncomputed };
}

/**
 * Dispatch a single `EntityTaxFacts` through the right calc path and
 * produce a structurally-correct `EntityTaxPosition`. PERSONAL_NAME and
 * SOLE_TRADER flow through the existing Phase 20 engine; TRUST entities
 * with distribution data flow through Div 6; everything else is
 * flagged UNCOMPUTED until the relevant sub-PR lands.
 *
 * Phase 41e.1 slice D-2 — independent of the income-tax dispatch above,
 * if `cgtEvents` is provided the router runs the loss-netting +
 * Div 115 discount calc and attaches the result to
 * `EntityTaxPosition.cgtResult`. This lets a COMPANY entity surface a
 * full CGT calc (with 0% discount per s115-280) even while its income
 * tax is still UNCOMPUTED — never false numbers, but no false silence.
 */
export function calculateEntityTaxPosition(
  facts: EntityTaxFacts,
): EntityTaxPosition {
  const config = facts.fy.financialYear
    ? getTaxYearConfig(facts.fy.financialYear)
    : getCurrentTaxYearConfig();

  // Phase 41e.1 slice D-2 — CGT side calc (independent of entity income tax).
  const cgt = dispatchCgtIfPresent(facts);

  if (facts.entityType === 'PERSONAL_NAME' || facts.entityType === 'SOLE_TRADER') {
    const result = calculateTaxPosition(
      {
        // Cast through unknown — the tax-engine input shape is structurally
        // identical to what `EntityTaxFacts` carries (slice A locked the
        // shapes), but TS's variance checks treat the readonly field as
        // distinct. See `lib/tax-engine/types.ts` JSDoc on `EntityTaxFacts`
        // for the rationale on inlined row shapes.
        incomes: facts.incomes as unknown as IncomeItem[],
        expenses: facts.expenses as unknown as ExpenseItem[],
        depreciations: facts.depreciations as unknown as DepreciationItem[],
        superContributions: facts.superContributions,
        financialYear: facts.fy.financialYear,
      },
      config,
    );

    const baseCitations = BASE_CITATIONS[facts.entityType] ?? [];
    const merged = cgt
      ? mergeCgt(baseCitations, [], cgt)
      : { citations: baseCitations, uncomputed: [] };

    return {
      entityId: facts.entityId,
      entityType: facts.entityType,
      fy: facts.fy,
      result,
      cgtResult: cgt ?? undefined,
      citations: merged.citations,
      uncomputed: merged.uncomputed,
    };
  }

  // Phase 41e.1 slice D-1 — TRUST entities flip to computed when
  // distribution data is provided. Otherwise still UNCOMPUTED.
  // (UNIT_TRUST follows the same Div 6 mechanism in v1; per-unit
  // pro-rata allocation refines in 41e.4 alongside Div 6E streaming.)
  if (
    (facts.entityType === 'DISCRETIONARY_TRUST' ||
      facts.entityType === 'UNIT_TRUST') &&
    facts.trustDistribution
  ) {
    const distributionResult = allocateTrustDistribution({
      trustNetIncome: facts.trustDistribution.trustNetIncome,
      beneficiaries: facts.trustDistribution.beneficiaries.map((b) => ({
        id: b.id,
        name: b.name,
        presentlyEntitledShare: b.presentlyEntitledShare,
        isNonResidentOrDisabled: b.isNonResidentOrDisabled,
        streaming: b.streaming
          ? {
              frankedDividends: b.streaming.frankedDividends,
              capitalGains: b.streaming.capitalGains,
            }
          : undefined,
      })),
      hasFamilyTrustElection: facts.trustDistribution.hasFamilyTrustElection,
      characterPools: facts.trustDistribution.characterPools,
      streamingResolutionAt: facts.trustDistribution.streamingResolutionAt,
      financialYear: facts.fy.financialYear,
      isTestamentaryTrust: facts.trustDistribution.isTestamentaryTrust,
      s100aFacts: facts.trustDistribution.s100aFacts,
    });

    const merged = cgt
      ? mergeCgt(distributionResult.citations, distributionResult.uncomputed, cgt)
      : {
          citations: distributionResult.citations,
          uncomputed: distributionResult.uncomputed,
        };

    return {
      entityId: facts.entityId,
      entityType: facts.entityType,
      fy: facts.fy,
      result: distributionResult,
      cgtResult: cgt ?? undefined,
      citations: merged.citations,
      uncomputed: merged.uncomputed,
    };
  }

  // Phase 41e.2 — SMSF entities flip to computed when SMSF dispatch data
  // is provided. The three SMSF computations are independent: cap
  // tracking (Phase 41e.2), Div 293/296/TBC (41e.3), and — Phase 44
  // Part 2c-i — the fund-earnings income tax (Div 295). The branch fires
  // when ANY of them has input; each runs only when its own input is
  // present. Without any SMSF dispatch data, SMSF stays UNCOMPUTED.
  if (
    facts.entityType === 'SMSF' &&
    (facts.smsfContributions || facts.highIncomeSuper || facts.smsfIncomeTax)
  ) {
    const capResult = facts.smsfContributions
      ? trackContributionCaps(
          {
            concessionalYTD: facts.smsfContributions.concessionalYTD,
            nonConcessionalYTD: facts.smsfContributions.nonConcessionalYTD,
            totalSuperBalance: facts.smsfContributions.totalSuperBalance,
            carryForwardAmounts: facts.smsfContributions.carryForwardAmounts?.map(
              (c) => ({ financialYear: c.financialYear, unusedAmount: c.unusedAmount }),
            ),
          },
          config,
        )
      : null;

    // Phase 41e.3 — Div 293 / 296 / TBC if data provided
    const highIncomeResult = facts.highIncomeSuper
      ? calculateHighIncomeSuperTax(facts.highIncomeSuper, config)
      : null;

    // Phase 44 Part 2c-i — fund-earnings income tax (Div 295) if provided.
    const smsfIncomeResult = facts.smsfIncomeTax
      ? calculateSmsfIncomeTax(facts.smsfIncomeTax, config)
      : null;

    const smsfCitations: AuthorityCitation[] = [
      { kind: 'ITAA_1997', reference: 's291-20', lastReviewed: '2026-05-05' },
      { kind: 'ITAA_1997', reference: 's292-85', lastReviewed: '2026-05-05' },
      { kind: 'SIS_ACT', reference: 'Pt 8 (in-house asset cap)', lastReviewed: '2026-05-05' },
    ];
    const smsfUncomputed: UncomputedFlag[] = [
      {
        id: 'UC-SMSF-SOLE-PURPOSE',
        rationale:
          'Sole purpose test (SIS Act s62) + in-house asset 5% cap (Pt 8 SIS) + LRBA compliance per PCG 2016/5 — full SMSF triumvirate dispatch lands with Phase 41e.11. Until then, SMSF figures cover contribution-cap headroom only.',
        citation: { kind: 'SIS_ACT', reference: 's62', lastReviewed: '2026-05-05' },
      },
    ];

    // Merge the citations + UNCOMPUTED of every SMSF sub-computation
    // (Div 293/296/TBC + Part 2c-i fund-earnings income tax).
    const citations = smsfCitations;
    const uncomputed = smsfUncomputed;
    const mergeInto = (
      cs: AuthorityCitation[] | undefined,
      us: UncomputedFlag[] | undefined,
    ): void => {
      if (cs) {
        const seenC = new Set(citations.map((c) => `${c.kind}:${c.reference}`));
        for (const c of cs) {
          const key = `${c.kind}:${c.reference}`;
          if (!seenC.has(key)) {
            seenC.add(key);
            citations.push(c);
          }
        }
      }
      if (us) {
        const seenU = new Set(uncomputed.map((u) => u.id));
        for (const u of us) {
          if (!seenU.has(u.id)) {
            seenU.add(u.id);
            uncomputed.push(u);
          }
        }
      }
    };
    if (highIncomeResult) mergeInto(highIncomeResult.citations, highIncomeResult.uncomputed);
    if (smsfIncomeResult) mergeInto(smsfIncomeResult.citations, smsfIncomeResult.uncomputed);

    const merged = cgt ? mergeCgt(citations, uncomputed, cgt) : { citations, uncomputed };

    return {
      entityId: facts.entityId,
      entityType: facts.entityType,
      fy: facts.fy,
      result: {
        capResult: capResult ?? undefined,
        highIncomeSuperTax: highIncomeResult ?? undefined,
        smsfIncomeTax: smsfIncomeResult ?? undefined,
      },
      cgtResult: cgt ?? undefined,
      citations: merged.citations,
      uncomputed: merged.uncomputed,
    };
  }

  // Phase 41e.6 — COMPANY entities flip to computed (for Div 7A) when
  // div7aLoans data is provided. Income tax dispatch (base-rate
  // 25%/30%) still UNCOMPUTED — that's 41e.7 territory. So COMPANY
  // result here carries Div 7A classification only; the income-tax
  // UNCOMPUTED flag stays. "Never false silence" pattern.
  if (
    facts.entityType === 'COMPANY' &&
    facts.div7aLoans &&
    facts.div7aLoans.length > 0
  ) {
    const div7aResult = classifyDiv7ALoans(
      facts.div7aLoans.map((l) => ({
        loanId: l.loanId,
        loanLabel: l.loanLabel,
        openingBalance: l.openingBalance,
        yearsRemaining: l.yearsRemaining,
        benchmarkRate: l.benchmarkRate,
        paymentsMadeThisFy: l.paymentsMadeThisFy,
        hasComplianceAgreement: l.hasComplianceAgreement,
        isSubTrustUpe: l.isSubTrustUpe,
      })),
    );

    // COMPANY income tax dispatch (base-rate / franking) still
    // UNCOMPUTED — surface the placeholder so the user knows that the
    // 25%/30% dispatch + s115-280 CGT carve-out lands in 41e.7.
    const companyFlag = UNCOMPUTED_ENTITY_TAX.COMPANY!;
    let citations: AuthorityCitation[] = [...div7aResult.citations];
    let uncomputed: UncomputedFlag[] = [companyFlag, ...div7aResult.uncomputed];

    if (cgt) {
      const m = mergeCgt(citations, uncomputed, cgt);
      citations = m.citations;
      uncomputed = m.uncomputed;
    }

    return {
      entityId: facts.entityId,
      entityType: facts.entityType,
      fy: facts.fy,
      result: { div7aClassification: div7aResult },
      cgtResult: cgt ?? undefined,
      citations,
      uncomputed,
    };
  }

  // Net-new entity types without slice-D dispatch data — income tax
  // still UNCOMPUTED. But: if cgtEvents is provided, the CGT side
  // calc still surfaces (with the right per-entity discount rate). A
  // COMPANY entity hitting this branch with cgtEvents returns
  // `result: null + UC-ENTITY-COMPANY` AND `cgtResult: <real number>`.
  const flag = UNCOMPUTED_ENTITY_TAX[facts.entityType];
  const baseUncomputed: UncomputedFlag[] = flag ? [flag] : [];
  const merged = cgt
    ? mergeCgt([], baseUncomputed, cgt)
    : { citations: [] as AuthorityCitation[], uncomputed: baseUncomputed };

  return {
    entityId: facts.entityId,
    entityType: facts.entityType,
    fy: facts.fy,
    result: null,
    cgtResult: cgt ?? undefined,
    citations: merged.citations,
    uncomputed: merged.uncomputed,
  };
}

/**
 * Returns true if this entity type produces a computed result via the
 * router *unconditionally* (i.e. without needing slice-specific
 * dispatch inputs like `trustDistribution` or `cgtEvents`).
 *
 * As 41e.1+ slices ship, more entity types become *conditionally*
 * computed — TRUST entities now produce real numbers when
 * `EntityTaxFacts.trustDistribution` is provided (Phase 41e.1 slice
 * D-1). Use `entityHasConditionalComputedTax` to test those.
 */
export function entityHasComputedTax(
  entityType: EntityTaxFacts['entityType'],
): boolean {
  return entityType === 'PERSONAL_NAME' || entityType === 'SOLE_TRADER';
}

/**
 * Returns true if the entity type can produce a computed result when
 * the relevant slice-specific dispatch input is provided. Mirrors the
 * router's actual capability matrix as 41e.1+ slices ship.
 */
export function entityHasConditionalComputedTax(
  entityType: EntityTaxFacts['entityType'],
): boolean {
  return (
    entityHasComputedTax(entityType) ||
    entityType === 'DISCRETIONARY_TRUST' ||
    entityType === 'UNIT_TRUST' ||
    entityType === 'SMSF'
  );
}
