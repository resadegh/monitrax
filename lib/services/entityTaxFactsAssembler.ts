/**
 * Phase 44 Part 2c-ii — the entity-tax-facts assembler (SSOT).
 *
 * The canonical builder of `EntityTaxFacts` — the contract the tax
 * engine consumes (PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md §6.1). It
 * is the single place that knows "how the engine gets fed": given
 * `(userId, entityId, fy)` it reads the entity's income / expense rows
 * + the Part 2a/2b persisted money-flow models, and assembles a
 * fully-populated `EntityTaxFacts`.
 *
 * Before Part 2, trust / company dispatch data reached the engine only
 * through a `curl` POST body. This assembler replaces that: `GET
 * /api/tax/entity` now produces real numbers from persisted data.
 *
 * It performs **no tax arithmetic** (§8.3) — it assembles inputs; the
 * engine applies the law. Entities with no persisted resolution /
 * dividend / benefit data still return `UNCOMPUTED` downstream (honest
 * — PHASE_44_ENTITY_GRAPH.md §9, "never false numbers").
 *
 * Q-decisions baked in (design doc §7.2):
 *  - Q-UPE — only `PrivateCompanyBenefit` rows of type `LOAN` become
 *    `div7aLoans`. `UPE` / `SUB_TRUST_ARRANGEMENT` rows are NOT passed
 *    to the engine — that treatment is legally contested; the engine
 *    must not auto-deem them a Div 7A dividend.
 *  - Q-PARTNERSHIP — partnerships are not assembled (stay `UNCOMPUTED`).
 */

import { prisma } from '@/lib/db';
import type { EntityTaxFacts, FYReference } from '@/lib/tax-engine/types';
import {
  listDistributionResolutions,
  type DistributionResolutionSummary,
} from './distributionResolutionService';
import {
  listPrivateCompanyBenefits,
  type PrivateCompanyBenefitSummary,
} from './privateCompanyBenefitService';

/** Entity types for which a `DistributionResolution` feeds `trustDistribution`. */
const TRUST_DISTRIBUTION_TYPES: ReadonlySet<string> = new Set([
  'DISCRETIONARY_TRUST',
  'UNIT_TRUST',
]);

// =============================================================================
// PURE MAPPERS (exported for unit testing)
// =============================================================================

/**
 * Map `PrivateCompanyBenefit` rows to the engine's `div7aLoans` input.
 *
 * Q-UPE: only `LOAN` rows are mapped — `UPE` / `SUB_TRUST_ARRANGEMENT`
 * are deliberately excluded (the engine must not auto-deem a contested
 * UPE a Div 7A dividend). A `LOAN` row missing the loan-shape fields
 * (`openingBalance` / `loanTermYears` / `benchmarkRate`) cannot be
 * computed and is skipped rather than fed a guessed zero.
 */
export function buildDiv7aLoansFromBenefits(
  benefits: readonly PrivateCompanyBenefitSummary[],
): NonNullable<EntityTaxFacts['div7aLoans']> {
  return benefits
    .filter(
      (b) =>
        b.benefitType === 'LOAN' &&
        b.openingBalance !== null &&
        b.loanTermYears !== null &&
        b.benchmarkRate !== null,
    )
    .map((b) => ({
      loanId: b.id,
      openingBalance: b.openingBalance as number,
      yearsRemaining: b.loanTermYears as number,
      benchmarkRate: b.benchmarkRate as number,
      paymentsMadeThisFy: b.repaymentsThisFy ?? 0,
      hasComplianceAgreement: b.hasComplianceAgreement,
      isSubTrustUpe: b.isSubTrustUpe,
    }));
}

/**
 * Map a `DistributionResolution` to the engine's `trustDistribution`
 * input. `nameById` resolves beneficiary entity names. Bamford
 * proportionate model: `presentlyEntitledShare` is the fraction (0..1).
 */
export function buildTrustDistribution(
  resolution: DistributionResolutionSummary,
  nameById: ReadonlyMap<string, string>,
): NonNullable<EntityTaxFacts['trustDistribution']> {
  return {
    trustNetIncome: resolution.trustNetIncome,
    hasFamilyTrustElection: resolution.hasFamilyTrustElection,
    characterPools:
      resolution.frankedDividendPool !== null || resolution.capitalGainPool !== null
        ? {
            frankedDividends: resolution.frankedDividendPool ?? undefined,
            capitalGains: resolution.capitalGainPool ?? undefined,
          }
        : undefined,
    streamingResolutionAt: resolution.resolutionDate
      ? resolution.resolutionDate.toISOString()
      : undefined,
    beneficiaries: resolution.allocations.map((a) => ({
      id: a.beneficiaryEntityId,
      name: nameById.get(a.beneficiaryEntityId) ?? a.beneficiaryEntityId,
      presentlyEntitledShare: a.presentlyEntitledShare,
      streaming:
        a.streamedFrankedDividends !== null || a.streamedCapitalGains !== null
          ? {
              frankedDividends: a.streamedFrankedDividends ?? undefined,
              capitalGains: a.streamedCapitalGains ?? undefined,
            }
          : undefined,
    })),
  };
}

/**
 * Pick the operative resolution for the FY — the most recent
 * `CONFIRMED` one. A `DRAFT`-only trust has no operative resolution
 * (the engine must not compute a tax number off a draft).
 */
export function pickOperativeResolution(
  resolutions: readonly DistributionResolutionSummary[],
): DistributionResolutionSummary | null {
  // `listDistributionResolutions` returns newest-first.
  return resolutions.find((r) => r.status === 'CONFIRMED') ?? null;
}

// =============================================================================
// THE ASSEMBLER
// =============================================================================

/**
 * Assemble the `EntityTaxFacts` for one entity + FY from persisted data.
 * Returns `null` if the entity does not exist / is not owned by the
 * caller.
 */
export async function assembleEntityTaxFacts(
  userId: string,
  entityId: string,
  fy: FYReference,
): Promise<EntityTaxFacts | null> {
  const entity = await prisma.legalEntity.findFirst({
    where: { id: entityId, userId },
    select: { id: true, type: true },
  });
  if (!entity) return null;

  const [incomes, expenses] = await Promise.all([
    prisma.income.findMany({
      where: { userId, ownerEntityId: entityId },
      select: {
        id: true,
        name: true,
        amount: true,
        frequency: true,
        type: true,
        grossAmount: true,
        paygWithholding: true,
        propertyId: true,
        investmentAccountId: true,
      },
    }),
    prisma.expense.findMany({
      where: { userId, ownerEntityId: entityId },
      select: {
        id: true,
        name: true,
        amount: true,
        frequency: true,
        category: true,
        isTaxDeductible: true,
        propertyId: true,
        loanId: true,
      },
    }),
  ]);

  const facts: EntityTaxFacts = {
    entityId: entity.id,
    entityType: entity.type,
    fy,
    incomes: incomes.map((i) => ({
      id: i.id,
      name: i.name,
      type: i.type,
      amount: Number(i.amount),
      frequency: i.frequency,
      propertyId: i.propertyId ?? undefined,
      investmentAccountId: i.investmentAccountId ?? undefined,
      grossAmount: i.grossAmount ? Number(i.grossAmount) : undefined,
      paygWithholding: i.paygWithholding ? Number(i.paygWithholding) : undefined,
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category ?? 'OTHER',
      amount: Number(e.amount),
      frequency: e.frequency,
      isTaxDeductible: e.isTaxDeductible,
      propertyId: e.propertyId ?? undefined,
      loanId: e.loanId ?? undefined,
    })),
    depreciations: [],
  };

  // --- Trust distribution (DISCRETIONARY_TRUST / UNIT_TRUST) -----------
  if (TRUST_DISTRIBUTION_TYPES.has(entity.type)) {
    const resolutions = await listDistributionResolutions(userId, {
      trustEntityId: entityId,
      financialYear: fy.financialYear,
    });
    const operative = pickOperativeResolution(resolutions);
    if (operative) {
      const beneficiaryIds = [
        ...new Set(operative.allocations.map((a) => a.beneficiaryEntityId)),
      ];
      const beneficiaries = await prisma.legalEntity.findMany({
        where: { id: { in: beneficiaryIds }, userId },
        select: { id: true, name: true },
      });
      const nameById = new Map(beneficiaries.map((b) => [b.id, b.name]));
      facts.trustDistribution = buildTrustDistribution(operative, nameById);
    }
  }

  // --- Div 7A loans (COMPANY) — Q-UPE: LOAN rows only -----------------
  if (entity.type === 'COMPANY') {
    const benefits = await listPrivateCompanyBenefits(userId, {
      companyEntityId: entityId,
      financialYear: fy.financialYear,
    });
    const div7aLoans = buildDiv7aLoansFromBenefits(benefits);
    if (div7aLoans.length > 0) facts.div7aLoans = div7aLoans;
  }

  return facts;
}
