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
 *
 * Stage D PR-1 — honesty hardening (AD-1..AD-3, approved by Reza
 * 2026-06-12 after the adversarial design review):
 *  - Residency passes through (`taxResidencyStatus` / `isForeignResident`)
 *    so the CGT discount is correct for foreign residents (§7.1
 *    G-RESIDENCY — was contracted but never wired).
 *  - Streaming amounts are STRIPPED unless a STREAMING_POWER
 *    `TrustDeedRule` exists for the trust (§4.1 F4 — streaming is only
 *    valid if the deed permits it); the router surfaces
 *    `UC-DIV-6E-STREAMING` so the omission is visible.
 *  - `partnershipSubtype` passes through so the router can refuse to
 *    treat a Div 5A corporate limited partnership as transparent (AD-1).
 */

import { prisma } from '@/lib/db';
import type { EntityTaxFacts, FYReference, UncomputedFlag } from '@/lib/tax-engine/types';
import type { FteIeeInput } from '@/lib/tax-engine/divisions/fteIeeClassifier';
import type { PsiInput } from '@/lib/tax-engine/divisions/psiClassifier';
import {
  listDistributionResolutions,
  type DistributionResolutionSummary,
} from './distributionResolutionService';
import {
  listPrivateCompanyBenefits,
  type PrivateCompanyBenefitSummary,
} from './privateCompanyBenefitService';
import { listOwnershipGroups } from './ownershipService';
import { listBeneficialOwnershipOverrides } from './beneficialOwnershipService';
import {
  attributeAsset,
  isActiveInFy,
  type AssetOwnershipContext,
  type OwnershipGroupLite,
  type BeneficialOverrideLite,
} from './ownershipAttribution';

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
 * MON-101 (capture Stage 1) — map an operative resolution's allocations to
 * the FTE/IEE classifier's input. THE all-or-nothing safe-default gate
 * (Reza GO 2026-07-26):
 *
 *   - returns null unless the trust's family-trust election is ON;
 *   - returns null unless EVERY allocated beneficiary has `relationship`
 *     AND `hasQuotedTfn` explicitly set (null = never-asked — neither
 *     direction of defaulting `hasQuotedTfn` is safe: null→false would
 *     FABRICATE a 47% Pt VA withholding, null→true would suppress a real
 *     one; a naked default is not a classification).
 *
 * `distributionAmount` = presentlyEntitledShare × trustNetIncome — the same
 * s95 net-income base the Div 6 trustDistribution allocation uses (one
 * basis, §12.2.1). Pure; exported for unit testing.
 */
export function buildFteIeeInput(
  resolution: DistributionResolutionSummary,
  nameById: ReadonlyMap<string, string>,
): FteIeeInput | null {
  if (!resolution.hasFamilyTrustElection) return null;
  if (resolution.allocations.length === 0) return null;
  const complete = resolution.allocations.every(
    (a) => a.relationship !== null && a.hasQuotedTfn !== null,
  );
  if (!complete) return null;
  return {
    hasFamilyTrustElection: true,
    beneficiaries: resolution.allocations.map((a) => ({
      beneficiaryId: a.beneficiaryEntityId,
      beneficiaryName: nameById.get(a.beneficiaryEntityId) ?? a.beneficiaryEntityId,
      distributionAmount: a.presentlyEntitledShare * resolution.trustNetIncome,
      relationship: a.relationship as NonNullable<typeof a.relationship>,
      hasQuotedTfn: a.hasQuotedTfn as boolean,
      ...(a.coveredByIee !== null ? { coveredByIee: a.coveredByIee } : {}),
    })),
  };
}

/**
 * MON-101 — the ONE producer of the orchestrator's `fteIeeByEntity` input
 * for an entity (§12.2.1). Reads the SAME operative resolution the
 * trust-distribution feed uses (one source), applies the all-or-nothing
 * gate above. Returns null (overlay inert) for: non-trust entities, no
 * operative resolution, election off, or incomplete beneficiary facts.
 */
export async function assembleFteIeeInput(
  userId: string,
  entityId: string,
  fy: FYReference,
): Promise<FteIeeInput | null> {
  const entity = await prisma.legalEntity.findFirst({
    where: { id: entityId, userId },
    select: { type: true },
  });
  if (!entity || !TRUST_DISTRIBUTION_TYPES.has(entity.type)) return null;
  const resolutions = await listDistributionResolutions(userId, {
    trustEntityId: entityId,
    financialYear: fy.financialYear,
  });
  const operative = pickOperativeResolution(resolutions);
  if (!operative) return null;
  const beneficiaryIds = [...new Set(operative.allocations.map((a) => a.beneficiaryEntityId))];
  const beneficiaries = await prisma.legalEntity.findMany({
    where: { id: { in: beneficiaryIds }, userId },
    select: { id: true, name: true },
  });
  return buildFteIeeInput(operative, new Map(beneficiaries.map((b) => [b.id, b.name])));
}

/**
 * MON-102 (capture Stage 2) — map a persisted `PsiAssessment` row to the
 * PSI classifier's input. THE all-or-nothing NUMERICS gate (Reza GO
 * 2026-07-27): returns null unless totalPsiIncome, incomeFromLargestClient
 * AND unrelatedClientCount are all explicitly set — an incomplete
 * assessment can never produce a PSI attribution. Unanswered test booleans
 * (null) pass through as undefined = not-established — the engine's own
 * contract and the ATO's posture (a PSB test must be positively
 * demonstrable); the null direction can only move the result toward MORE
 * attribution (a warning), never hide one. Pure; exported for unit testing.
 */
export function buildPsiInput(assessment: {
  totalPsiIncome: number | null;
  incomeFromLargestClient: number | null;
  unrelatedClientCount: number | null;
  gainedClientsViaDirectAdvertising: boolean | null;
  meetsResultsTest: boolean | null;
  meetsEmploymentTest: boolean | null;
  meetsBusinessPremisesTest: boolean | null;
  hasPsbDetermination: boolean | null;
}): PsiInput | null {
  if (
    assessment.totalPsiIncome === null ||
    assessment.incomeFromLargestClient === null ||
    assessment.unrelatedClientCount === null
  ) {
    return null;
  }
  return {
    totalPsiIncome: assessment.totalPsiIncome,
    incomeFromLargestClient: assessment.incomeFromLargestClient,
    unrelatedClientCount: assessment.unrelatedClientCount,
    ...(assessment.gainedClientsViaDirectAdvertising !== null
      ? { gainedClientsViaDirectAdvertising: assessment.gainedClientsViaDirectAdvertising }
      : {}),
    ...(assessment.meetsResultsTest !== null ? { meetsResultsTest: assessment.meetsResultsTest } : {}),
    ...(assessment.meetsEmploymentTest !== null
      ? { meetsEmploymentTest: assessment.meetsEmploymentTest }
      : {}),
    ...(assessment.meetsBusinessPremisesTest !== null
      ? { meetsBusinessPremisesTest: assessment.meetsBusinessPremisesTest }
      : {}),
    ...(assessment.hasPsbDetermination !== null
      ? { hasPsbDetermination: assessment.hasPsbDetermination }
      : {}),
  };
}

/**
 * MON-102 — the ONE producer of the orchestrator's `psiByEntity` input for
 * an entity (§12.2.1). Reads the persisted per-FY `PsiAssessment`, applies
 * the numerics gate above. Returns null (overlay inert) for: no assessment
 * row, incomplete numerics, or an entity the caller doesn't own.
 */
export async function assemblePsiInput(
  userId: string,
  entityId: string,
  fy: FYReference,
): Promise<PsiInput | null> {
  const row = await prisma.psiAssessment.findFirst({
    where: { entityId, userId, financialYear: fy.financialYear },
  });
  if (!row) return null;
  return buildPsiInput({
    totalPsiIncome: row.totalPsiIncome === null ? null : Number(row.totalPsiIncome),
    incomeFromLargestClient:
      row.incomeFromLargestClient === null ? null : Number(row.incomeFromLargestClient),
    unrelatedClientCount: row.unrelatedClientCount,
    gainedClientsViaDirectAdvertising: row.gainedClientsViaDirectAdvertising,
    meetsResultsTest: row.meetsResultsTest,
    meetsEmploymentTest: row.meetsEmploymentTest,
    meetsBusinessPremisesTest: row.meetsBusinessPremisesTest,
    hasPsbDetermination: row.hasPsbDetermination,
  });
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

/**
 * Stage D PR-1 (AD-3) — gate Div 6E streaming on deed power. When the
 * trust has NO active STREAMING_POWER `TrustDeedRule`, the streaming
 * amounts the user recorded are stripped from the engine input (the
 * deed doesn't permit them — computing them would bless an invalid
 * stream) and `streamingSuppressed` is set so the router surfaces
 * `UC-DIV-6E-STREAMING`. The default Bamford proportionate allocation
 * still computes. Pure function — exported for unit testing.
 */
export function gateStreamingByDeedPower(
  distribution: NonNullable<EntityTaxFacts['trustDistribution']>,
  hasStreamingPower: boolean,
): NonNullable<EntityTaxFacts['trustDistribution']> {
  const hasStreams =
    distribution.characterPools !== undefined ||
    distribution.beneficiaries.some((b) => b.streaming !== undefined);
  if (hasStreamingPower || !hasStreams) return distribution;
  return {
    ...distribution,
    characterPools: undefined,
    streamingResolutionAt: undefined,
    beneficiaries: distribution.beneficiaries.map((b) => ({
      ...b,
      streaming: undefined,
    })),
    streamingSuppressed: true,
  };
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
    select: {
      id: true,
      type: true,
      // Stage D PR-1 — residency + partnership-subtype pass-through.
      taxResidencyStatus: true,
      isForeignResident: true,
      partnershipSubtype: true,
    },
  });
  if (!entity) return null;

  // Phase 47 Stage D (AD-2) — attribute income / expense by LEGAL
  // INTEREST (TR 93/32 co-ownership splits) and BENEFICIAL ownership
  // (bare-trust / nominee / LRBA overrides), not flat by `ownerEntityId`.
  // Additive guarantee: an entity with no ownership group and no
  // beneficial override on any of its assets receives byte-for-byte the
  // prior flat attribution. The attribution notes flow into
  // `assemblerNotes` so a split / redirect is never silent.
  const attributed = await loadAttributedIncomeExpense(userId, entityId, fy);

  const facts: EntityTaxFacts = {
    entityId: entity.id,
    entityType: entity.type,
    fy,
    incomes: attributed.incomes,
    expenses: attributed.expenses,
    depreciations: [],
  };

  // Stage D PR-1 (G-RESIDENCY) — pass residency through so the CGT
  // discount is denied to foreign residents (s855; the engine's
  // capital-loss netting already accepts the flag — it was simply
  // never fed). Null status keeps the existing "treated as resident"
  // convention; the explicit boolean or FOREIGN_RESIDENT status wins.
  const foreign =
    entity.isForeignResident === true ||
    entity.taxResidencyStatus === 'FOREIGN_RESIDENT';
  if (foreign) facts.isForeignResident = true;

  // Stage D PR-1 (AD-1) — partnership subtype pass-through for the
  // router's Div 5A / Measure 7 dispatch.
  if (entity.type === 'PARTNERSHIP' && entity.partnershipSubtype) {
    facts.partnershipSubtype = entity.partnershipSubtype;
  }

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
      const distribution = buildTrustDistribution(operative, nameById);
      // Stage D PR-1 (AD-3) — streaming is only valid if the deed
      // permits it. Active STREAMING_POWER rule present → pass through;
      // absent → strip streams, surface UC-DIV-6E-STREAMING downstream.
      const streamingRule = await prisma.trustDeedRule.findFirst({
        where: {
          userId,
          trustEntityId: entityId,
          ruleType: 'STREAMING_POWER',
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        },
        select: { id: true },
      });
      facts.trustDistribution = gateStreamingByDeedPower(
        distribution,
        streamingRule !== null,
      );
    }
  }

  // AD-2 attribution notes seed the channel (TR 93/32 split / beneficial
  // redirect / uncomputable-split) so the no-false-silence rule holds.
  const assemblerNotes: NonNullable<EntityTaxFacts['assemblerNotes']>[number][] = [
    ...attributed.notes,
  ];

  // --- Stage D PR-2: Div 207 dividend feed (any recipient) -------------
  // CONFIRMED DividendPayment rows where this entity is the shareholder
  // become synthetic income items carrying their franking credits. The
  // register is the source of truth; a manual duplicate is surfaced via
  // UC-DIVIDEND-REGISTER, never silently double-counted.
  const dividendPayments = await prisma.dividendPayment.findMany({
    where: {
      shareholderEntityId: entityId,
      dividend: { userId, financialYear: fy.financialYear, status: 'CONFIRMED' },
    },
    select: {
      id: true,
      amount: true,
      frankingCredits: true,
      dividend: { select: { companyEntityId: true, frankingPercentage: true } },
    },
  });
  if (dividendPayments.length > 0) {
    const companyIds = [...new Set(dividendPayments.map((p) => p.dividend.companyEntityId))];
    const companies = await prisma.legalEntity.findMany({
      where: { id: { in: companyIds }, userId },
      select: { id: true, name: true },
    });
    const companyNameById = new Map(companies.map((c) => [c.id, c.name]));
    const dividendIncomes = buildDividendIncomeFromPayments(
      dividendPayments.map((p) => ({
        id: p.id,
        amount: Number(p.amount),
        frankingCredits: Number(p.frankingCredits),
        companyEntityId: p.dividend.companyEntityId,
        frankingPercentage: Number(p.dividend.frankingPercentage),
      })),
      companyNameById,
    );
    facts.incomes = [...facts.incomes, ...dividendIncomes];
    assemblerNotes.push({
      id: 'UC-DIVIDEND-REGISTER',
      rationale:
        'Dividends from your companies were included from the dividend register with their franking credits (Div 207). If you also recorded the same dividend manually as income, remove the manual entry to avoid double counting.',
      citation: { kind: 'ITAA_1997', reference: 'Div 207', lastReviewed: '2026-06-12' },
    });
  }

  // --- Stage D PR-2: CGT events for trust / SMSF (Q-CGT-FEED) ----------
  // Capital gains form part of the s 95 net income a trust distributes
  // (Subdiv 115-C) — the trust path is not real without them (review
  // F13). FIFO-matched from persisted BUY/SELL investment transactions
  // on accounts this entity owns; the FIFO assumption is surfaced.
  if (
    entity.type === 'DISCRETIONARY_TRUST' ||
    entity.type === 'UNIT_TRUST' ||
    entity.type === 'SMSF'
  ) {
    const range = fyDateRange(fy.financialYear);
    if (range) {
      const txns = await prisma.investmentTransaction.findMany({
        where: {
          investmentAccount: { userId, ownerEntityId: entityId },
          type: { in: ['BUY', 'SELL'] },
          date: { lt: range.end }, // full buy history up to FY end
        },
        select: {
          id: true,
          holdingId: true,
          ticker: true,
          date: true,
          type: true,
          price: true,
          units: true,
          fees: true,
        },
        orderBy: { date: 'asc' },
      });
      const fifo = buildCgtEventsFifo(
        txns.map((t) => ({
          id: t.id,
          holdingId: t.holdingId,
          ticker: t.ticker,
          date: t.date,
          type: t.type as 'BUY' | 'SELL',
          price: t.price,
          units: t.units,
          fees: t.fees,
        })),
        range,
      );
      if (fifo.events.length > 0) {
        facts.cgtEvents = fifo.events;
        assemblerNotes.push({
          id: 'UC-CGT-PARCEL-ID',
          rationale:
            'Capital gains were computed by matching sold units to the earliest purchases (first-in-first-out). You may choose specific parcels instead — confirm the identification method with your accountant.',
          citation: { kind: 'ITAA_1997', reference: 'Subdiv 115-A', lastReviewed: '2026-06-12' },
        });
      }
      if (fifo.hadUnmatchedSell) {
        assemblerNotes.push({
          id: 'UC-CGT-UNMATCHED-SELL',
          rationale:
            'Some sold units had no recorded purchase history, so their gain was NOT computed (a guessed cost base would overstate it). Add the missing buy transactions to complete the picture.',
        });
      }
    }
  }

  if (assemblerNotes.length > 0) facts.assemblerNotes = assemblerNotes;

  // --- Div 7A loans (COMPANY) — Q-UPE: LOAN rows only -----------------
  if (entity.type === 'COMPANY') {
    const benefits = await listPrivateCompanyBenefits(userId, {
      companyEntityId: entityId,
      financialYear: fy.financialYear,
    });
    const div7aLoans = buildDiv7aLoansFromBenefits(benefits);
    if (div7aLoans.length > 0) facts.div7aLoans = div7aLoans;
  }

  // --- SMSF fund-earnings income tax (Div 295 / ECPI / NALI) ----------
  // Phase 44.2: populate `smsfIncomeTax` from the persisted SmsfAnnualReturn
  // so the GET entity-tax path returns a real number instead of UNCOMPUTED.
  // When no return is saved, the SMSF dispatch stays UNCOMPUTED (honest).
  if (entity.type === 'SMSF') {
    const smsfReturn = await prisma.smsfAnnualReturn.findUnique({
      where: {
        legalEntityId_financialYear: {
          legalEntityId: entityId,
          financialYear: fy.financialYear,
        },
      },
    });
    if (smsfReturn) {
      facts.smsfIncomeTax = {
        assessableInvestmentIncome: Number(smsfReturn.assessableInvestmentIncome),
        deductions: Number(smsfReturn.deductions),
        assessableContributions: Number(smsfReturn.assessableContributions),
        nonArmsLengthIncome: Number(smsfReturn.nonArmsLengthIncome),
        isComplying: smsfReturn.isComplying,
        isInPensionPhase: smsfReturn.isInPensionPhase,
        ecpiExemptProportion: smsfReturn.ecpiExemptProportion ?? undefined,
        frankingCredits: Number(smsfReturn.frankingCredits),
      };
    }
  }

  return facts;
}

// =============================================================================
// STAGE D PR-2 — the contracted feeds (Q-CGT-FEED + Div 207 franking)
// =============================================================================

/** '2024-25' → the FY's UTC date range [1 Jul 2024, 1 Jul 2025). Null on junk. */
export function fyDateRange(financialYear: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(financialYear);
  if (!m) return null;
  const startYear = parseInt(m[1], 10);
  return {
    start: new Date(Date.UTC(startYear, 6, 1)),
    end: new Date(Date.UTC(startYear + 1, 6, 1)),
  };
}

export interface EquityTxn {
  id: string;
  /** Matching key — holdingId when linked, else ticker. Null = unmatchable. */
  holdingId: string | null;
  ticker: string | null;
  date: Date;
  type: 'BUY' | 'SELL';
  price: number;
  units: number;
  fees: number | null;
}

export interface FifoCgtResult {
  events: NonNullable<EntityTaxFacts['cgtEvents']>[number][];
  /** True when an in-FY sell could not be fully matched to buy history. */
  hadUnmatchedSell: boolean;
}

/**
 * Whole months between two dates — STRICTLY-elapsed (audit fix
 * 2026-06-12, finding 14): the same-day anniversary counts as 11, not
 * 12, because s115-25(1) requires acquisition AT LEAST 12 months
 * BEFORE the CGT event (the ATO reading excludes both days — an asset
 * bought 10 Jan and sold the following 10 Jan does NOT qualify; sold
 * 11 Jan it does). With this convention `monthsHeld >= 12` downstream
 * is exactly the statutory test.
 */
function monthsBetween(from: Date, to: Date): number {
  let months =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() <= from.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Q-CGT-FEED (design doc §7.2, revised up by review F13) — build CGT
 * events from persisted BUY/SELL investment transactions, matched
 * **first-in-first-out**. One event per (sell, matched-lot) pair so
 * each carries ITS OWN holding period — never an averaged `monthsHeld`
 * (the Div 115 discount depends on it).
 *
 * Honesty rules:
 *  - Sells BEFORE the target FY still consume lots (so the queue is
 *    correct) but emit no events.
 *  - An in-FY sell that cannot be fully matched to buy history emits
 *    events only for the MATCHED portion; the unmatched units are
 *    skipped (a fabricated zero cost base would OVERSTATE the gain)
 *    and `hadUnmatchedSell` is set so the caller surfaces a flag.
 *  - FIFO is an assumption — the taxpayer may choose specific parcel
 *    identification. The caller attaches `UC-CGT-PARCEL-ID`.
 *
 * Pure function — exported for unit testing.
 */
export function buildCgtEventsFifo(
  transactions: readonly EquityTxn[],
  fyRange: { start: Date; end: Date },
): FifoCgtResult {
  const events: FifoCgtResult['events'] = [];
  let hadUnmatchedSell = false;

  // Group by holding (holdingId preferred, ticker fallback).
  const groups = new Map<string, EquityTxn[]>();
  for (const t of transactions) {
    const key = t.holdingId ?? (t.ticker ? `ticker:${t.ticker}` : null);
    if (!key) continue;
    const arr = groups.get(key) ?? [];
    arr.push(t);
    groups.set(key, arr);
  }

  for (const [, txns] of groups) {
    const sorted = [...txns].sort((a, b) => a.date.getTime() - b.date.getTime());
    // FIFO queue of open lots.
    const lots: Array<{ date: Date; unitsLeft: number; unitCost: number }> = [];
    for (const t of sorted) {
      if (t.type === 'BUY') {
        if (t.units > 0) {
          lots.push({
            date: t.date,
            unitsLeft: t.units,
            // Acquisition fees form part of the cost base (s110-25).
            unitCost: t.price + (t.fees ?? 0) / t.units,
          });
        }
        continue;
      }
      // SELL — match against the queue.
      let remaining = t.units;
      const inFy = t.date >= fyRange.start && t.date < fyRange.end;
      // Disposal fees reduce proceeds, apportioned per matched unit.
      const sellFeePerUnit = t.units > 0 ? (t.fees ?? 0) / t.units : 0;
      while (remaining > 0 && lots.length > 0) {
        const lot = lots[0];
        const take = Math.min(remaining, lot.unitsLeft);
        if (inFy) {
          const proceeds = take * (t.price - sellFeePerUnit);
          const costBase = take * lot.unitCost;
          events.push({
            id: `cgt-${t.id}-${events.length}`,
            monthsHeld: monthsBetween(lot.date, t.date),
            nominalAmount: proceeds - costBase,
            label: `${t.ticker ?? 'Holding'} — ${take} units`,
          });
        }
        lot.unitsLeft -= take;
        remaining -= take;
        if (lot.unitsLeft <= 0) lots.shift();
      }
      if (remaining > 0 && inFy) hadUnmatchedSell = true;
    }
  }

  return { events, hadUnmatchedSell };
}

export interface DividendPaymentRow {
  id: string;
  amount: number;
  frankingCredits: number;
  companyEntityId: string;
  frankingPercentage: number;
}

/**
 * Div 207 feed — map the recipient's CONFIRMED `DividendPayment` rows
 * to synthetic income items carrying their franking credits (the
 * engine's gross-up reads `frankingCredits` off the income row). The
 * caller attaches `UC-DIVIDEND-REGISTER` so a manually-recorded
 * duplicate is the user's to remove, never silently double-counted.
 * Pure function — exported for unit testing.
 */
export function buildDividendIncomeFromPayments(
  payments: readonly DividendPaymentRow[],
  companyNameById: ReadonlyMap<string, string>,
): EntityTaxFacts['incomes'][number][] {
  return payments.map((p) => ({
    id: `divreg-${p.id}`,
    name: `Dividend — ${companyNameById.get(p.companyEntityId) ?? 'company'} (from dividend register)`,
    type: 'DIVIDEND',
    amount: p.amount,
    frequency: 'ANNUALLY',
    frankingPercentage: p.frankingPercentage,
    frankingCredits: p.frankingCredits,
  }));
}

// =============================================================================
// PHASE 47 STAGE D (AD-2) — stake & beneficial attribution feed
// Reads OwnershipStake percentages (TR 93/32) + BeneficialOwnershipOverride
// so a co-owned asset's income/deductions split per legal interest and a
// bare-trust / nominee asset attributes to its beneficial owner. The pure
// decision lives in `lib/services/ownershipAttribution.ts`; this section is
// the DB plumbing + the asset-key resolution that feeds it.
// =============================================================================

/** Asset key matching `OwnershipGroup.ownedObjectType` + the FK the row links to. */
export type AssetKey = { type: 'property' | 'investmentAccount' | 'asset' | 'loan'; id: string };

/** Income rows link to a property or an investment account. Pure. */
export function resolveIncomeAssetKey(row: {
  propertyId: string | null;
  investmentAccountId: string | null;
}): AssetKey | null {
  if (row.propertyId) return { type: 'property', id: row.propertyId };
  if (row.investmentAccountId) return { type: 'investmentAccount', id: row.investmentAccountId };
  return null;
}

/**
 * Expense rows can link to a property, a loan, an investment account or a
 * standalone asset. Property wins (a property's loan-interest expense
 * splits with the property), then the other holdings. Pure.
 */
export function resolveExpenseAssetKey(row: {
  propertyId: string | null;
  loanId: string | null;
  investmentAccountId: string | null;
  assetId: string | null;
}): AssetKey | null {
  if (row.propertyId) return { type: 'property', id: row.propertyId };
  if (row.investmentAccountId) return { type: 'investmentAccount', id: row.investmentAccountId };
  if (row.assetId) return { type: 'asset', id: row.assetId };
  if (row.loanId) return { type: 'loan', id: row.loanId };
  return null;
}

/** Asset types that bear income / expense and so participate in attribution. */
const INCOME_BEARING_GROUP_TYPES: ReadonlySet<string> = new Set([
  'property',
  'investmentAccount',
  'asset',
  'loan',
]);

interface AttributedFacts {
  incomes: EntityTaxFacts['incomes'][number][];
  expenses: EntityTaxFacts['expenses'][number][];
  notes: UncomputedFlag[];
}

/**
 * Load + attribute the entity's income / expense for the FY. The flat
 * `ownerEntityId === entityId` pull is the base; on top of it, assets the
 * entity CO-OWNS (a stake in an `OwnershipGroup`) or BENEFICIALLY owns (a
 * `BeneficialOwnershipOverride`) are pulled even when another co-owner is
 * the stamped legal owner, and every row is scaled by the entity's legal
 * interest (TR 93/32) or redirected per beneficial ownership.
 *
 * Additive: with no group / override touching any of the entity's assets
 * the output equals the prior flat mapping exactly (every weight is 1).
 */
async function loadAttributedIncomeExpense(
  userId: string,
  entityId: string,
  fy: FYReference,
): Promise<AttributedFacts> {
  const fyRange = fyDateRange(fy.financialYear);

  // --- Ownership context (groups + overrides active in the FY) --------
  const [allGroups, allOverrides] = await Promise.all([
    listOwnershipGroups(userId),
    listBeneficialOwnershipOverrides(userId),
  ]);

  const groupByAssetKey = new Map<string, OwnershipGroupLite>();
  const claimAssetIds = new Set<string>(); // assets this entity may claim beyond its flat rows
  for (const g of allGroups) {
    if (!INCOME_BEARING_GROUP_TYPES.has(g.ownedObjectType)) continue;
    if (fyRange && !isActiveInFy(g.effectiveFrom, g.effectiveTo, fyRange)) continue;
    // listOwnershipGroups is newest-first — first write per asset wins.
    const key = `${g.ownedObjectType}:${g.ownedObjectId}`;
    if (!groupByAssetKey.has(key)) {
      groupByAssetKey.set(key, {
        tenancyType: g.tenancyType,
        stakes: g.stakes.map((s) => ({ entityId: s.entityId, sharePct: s.sharePct })),
      });
    }
    if (g.stakes.some((s) => s.entityId === entityId)) claimAssetIds.add(g.ownedObjectId);
  }

  // Overrides are keyed by the bare object id — the create paths disagree
  // on the type vocabulary ('property' vs 'asset'), but ids are uuids.
  const overrideByObjectId = new Map<string, BeneficialOverrideLite>();
  for (const o of allOverrides) {
    if (o.legalOwnerEntityId !== entityId && o.beneficialOwnerEntityId !== entityId) continue;
    if (fyRange && !isActiveInFy(o.effectiveFrom, o.effectiveTo, fyRange)) continue;
    // Newest-first — first write per asset wins.
    if (!overrideByObjectId.has(o.ownedObjectId)) {
      overrideByObjectId.set(o.ownedObjectId, {
        legalOwnerEntityId: o.legalOwnerEntityId,
        beneficialOwnerEntityId: o.beneficialOwnerEntityId,
        basis: o.basis,
      });
    }
    if (o.beneficialOwnerEntityId === entityId) claimAssetIds.add(o.ownedObjectId);
  }

  // --- Pull rows: flat (legal-owned) + claimed (co-owned / beneficial)
  const claimIds = [...claimAssetIds];
  const incomeSelect = {
    id: true,
    name: true,
    amount: true,
    frequency: true,
    type: true,
    grossAmount: true,
    paygWithholding: true,
    ownerEntityId: true,
    propertyId: true,
    investmentAccountId: true,
  } as const;
  const expenseSelect = {
    id: true,
    name: true,
    amount: true,
    frequency: true,
    category: true,
    isTaxDeductible: true,
    isRecurring: true, // MON-037: count one-offs once, not ×frequency
    ownerEntityId: true,
    propertyId: true,
    loanId: true,
    investmentAccountId: true,
    assetId: true,
  } as const;

  const [flatIncomes, claimIncomes, flatExpenses, claimExpenses] = await Promise.all([
    prisma.income.findMany({ where: { userId, ownerEntityId: entityId }, select: incomeSelect }),
    claimIds.length > 0
      ? prisma.income.findMany({
          where: {
            userId,
            OR: [
              { propertyId: { in: claimIds } },
              { investmentAccountId: { in: claimIds } },
            ],
          },
          select: incomeSelect,
        })
      : Promise.resolve([]),
    prisma.expense.findMany({ where: { userId, ownerEntityId: entityId }, select: expenseSelect }),
    claimIds.length > 0
      ? prisma.expense.findMany({
          where: {
            userId,
            OR: [
              { propertyId: { in: claimIds } },
              { investmentAccountId: { in: claimIds } },
              { assetId: { in: claimIds } },
              { loanId: { in: claimIds } },
            ],
          },
          select: expenseSelect,
        })
      : Promise.resolve([]),
  ]);

  // Merge unique by id (a row can be both legal-owned AND on a co-owned asset).
  const incomeById = new Map<string, (typeof flatIncomes)[number]>();
  for (const r of [...flatIncomes, ...claimIncomes]) incomeById.set(r.id, r);
  const expenseById = new Map<string, (typeof flatExpenses)[number]>();
  for (const r of [...flatExpenses, ...claimExpenses]) expenseById.set(r.id, r);

  const notesById = new Map<string, UncomputedFlag>();
  const ctxFor = (key: AssetKey | null, legalOwnerEntityId: string): AssetOwnershipContext => ({
    legalOwnerEntityId,
    group: key ? groupByAssetKey.get(`${key.type}:${key.id}`) : undefined,
    override: key ? overrideByObjectId.get(key.id) : undefined,
  });

  const incomes: EntityTaxFacts['incomes'][number][] = [];
  for (const i of incomeById.values()) {
    const outcome = attributeAsset(entityId, ctxFor(resolveIncomeAssetKey(i), i.ownerEntityId));
    if (outcome.flag) notesById.set(outcome.flag.id, outcome.flag);
    if (outcome.weight <= 0) continue;
    const w = outcome.weight;
    incomes.push({
      id: i.id,
      name: i.name,
      type: i.type,
      amount: Number(i.amount) * w,
      frequency: i.frequency,
      propertyId: i.propertyId ?? undefined,
      investmentAccountId: i.investmentAccountId ?? undefined,
      grossAmount: i.grossAmount ? Number(i.grossAmount) * w : undefined,
      paygWithholding: i.paygWithholding ? Number(i.paygWithholding) * w : undefined,
    });
  }

  const expenses: EntityTaxFacts['expenses'][number][] = [];
  for (const e of expenseById.values()) {
    const outcome = attributeAsset(entityId, ctxFor(resolveExpenseAssetKey(e), e.ownerEntityId));
    if (outcome.flag) notesById.set(outcome.flag.id, outcome.flag);
    if (outcome.weight <= 0) continue;
    const w = outcome.weight;
    expenses.push({
      id: e.id,
      name: e.name,
      category: e.category ?? 'OTHER',
      amount: Number(e.amount) * w,
      frequency: e.frequency,
      isTaxDeductible: e.isTaxDeductible,
      isRecurring: e.isRecurring, // MON-037: count one-offs once, not ×frequency
      propertyId: e.propertyId ?? undefined,
      loanId: e.loanId ?? undefined,
    });
  }

  return { incomes, expenses, notes: [...notesById.values()] };
}
