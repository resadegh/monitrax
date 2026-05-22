/**
 * Phase 44 Part 2b — distribution-resolution service (SSOT writer).
 *
 * The ONLY writer of `DistributionResolution` / `DistributionAllocation`
 * — a trust's per-FY resolution that the Part 2c fact-assembler feeds to
 * the tax engine as `EntityTaxFacts.trustDistribution`
 * (PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md §4.1, §5).
 *
 * Digital twin (PHASE_44_ENTITY_GRAPH.md §6.1): data-quality problems —
 * a beneficiary the graph does not show as `BENEFICIARY_OF` /
 * `UNITHOLDER_OF` the trust, allocation shares that do not sum to 100% —
 * are RECORDED and returned as `warnings`, never rejected. Only the
 * data-model-impossible cases (an entity not owned by the user) are
 * hard-rejected. The §13-F21 boundary: the service *records* an
 * inconsistent resolution; it is the assembler/engine (Part 2c) that
 * returns `UNCOMPUTED` rather than a number computed from it.
 *
 * No tax or financial arithmetic here (PHASE_44_PART_2 §8.3).
 */

import { prisma } from '@/lib/db';
import type { Prisma, PrismaClient, ResolutionStatus } from '@prisma/client';
import { logCRUD } from '@/lib/security/auditLog';

type PrismaTxOrClient = PrismaClient | Prisma.TransactionClient;

/** Tolerance for the allocation shares summing to 1.0 (Decimal rounding). */
const SHARE_SUM_TOLERANCE = 0.0001;

export type DistributionResolutionErrorCode =
  | 'ENTITY_NOT_FOUND'
  | 'NO_ALLOCATIONS'
  | 'RESOLUTION_NOT_FOUND';

export class DistributionResolutionValidationError extends Error {
  constructor(
    public readonly code: DistributionResolutionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DistributionResolutionValidationError';
  }
}

export interface DistributionAllocationInput {
  beneficiaryEntityId: string;
  /** Fraction of distributable income (0..1) — the Bamford proportionate share. */
  presentlyEntitledShare: number;
  streamedFrankedDividends?: number | null;
  streamedCapitalGains?: number | null;
  notes?: string | null;
}

export interface CreateDistributionResolutionInput {
  trustEntityId: string;
  financialYear: string;
  trustNetIncome: number;
  distributableIncome?: number | null;
  resolutionDate?: Date | null;
  frankedDividendPool?: number | null;
  capitalGainPool?: number | null;
  hasFamilyTrustElection?: boolean;
  sourceDocumentId?: string | null;
  allocations: DistributionAllocationInput[];
}

export interface DistributionResolutionWriteResult {
  resolutionId: string;
  /** Non-fatal data-quality flags — the resolution is recorded regardless. */
  warnings: string[];
}

/**
 * Pure data-quality check — do the allocation shares (fractions 0..1)
 * sum to ~100%? Returns a warning string, or null if they reconcile.
 * Exported for unit testing (the `validateOwnershipStakes` precedent).
 */
export function allocationShareWarning(shares: readonly number[]): string | null {
  const sum = shares.reduce((acc, s) => acc + (s ?? 0), 0);
  if (Math.abs(sum - 1) > SHARE_SUM_TOLERANCE) {
    return `Allocation shares sum to ${(sum * 100).toFixed(2)}%, not 100%.`;
  }
  return null;
}

/**
 * Create a `DistributionResolution` + its `DistributionAllocation` rows
 * in one transaction. Hard-rejects only the impossible cases; soft
 * data-quality issues are returned as warnings.
 */
export async function createDistributionResolution(
  userId: string,
  input: CreateDistributionResolutionInput,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<DistributionResolutionWriteResult> {
  if (input.allocations.length === 0) {
    throw new DistributionResolutionValidationError(
      'NO_ALLOCATIONS',
      'A distribution resolution needs at least one beneficiary allocation.',
    );
  }

  const warnings: string[] = [];

  // Soft check — do the shares sum to 1.0 (100%)?
  const shareWarning = allocationShareWarning(
    input.allocations.map((a) => a.presentlyEntitledShare),
  );
  if (shareWarning) warnings.push(shareWarning);

  const resolutionId = await prisma.$transaction(async (tx) => {
    // Hard check — every referenced entity must belong to the caller.
    const entityIds = [
      ...new Set([
        input.trustEntityId,
        ...input.allocations.map((a) => a.beneficiaryEntityId),
      ]),
    ];
    const owned = await tx.legalEntity.count({
      where: { id: { in: entityIds }, userId },
    });
    if (owned !== entityIds.length) {
      throw new DistributionResolutionValidationError(
        'ENTITY_NOT_FOUND',
        'The trust or one or more beneficiaries do not exist or are not owned by you.',
      );
    }

    // Soft check — is each beneficiary a current BENEFICIARY_OF / UNITHOLDER_OF
    // edge of the trust in the graph? Recorded + flagged, never rejected.
    const eligibleEdges = await tx.entityRelationship.findMany({
      where: {
        userId,
        toEntityId: input.trustEntityId,
        type: { in: ['BENEFICIARY_OF', 'UNITHOLDER_OF'] },
        effectiveTo: null,
      },
      select: { fromEntityId: true },
    });
    const eligible = new Set(eligibleEdges.map((e) => e.fromEntityId));
    for (const a of input.allocations) {
      if (!eligible.has(a.beneficiaryEntityId)) {
        warnings.push(
          `Allocated entity ${a.beneficiaryEntityId} is not recorded as a beneficiary or unitholder of the trust.`,
        );
      }
    }

    const created = await tx.distributionResolution.create({
      data: {
        userId,
        trustEntityId: input.trustEntityId,
        financialYear: input.financialYear,
        trustNetIncome: input.trustNetIncome,
        distributableIncome: input.distributableIncome ?? null,
        resolutionDate: input.resolutionDate ?? null,
        frankedDividendPool: input.frankedDividendPool ?? null,
        capitalGainPool: input.capitalGainPool ?? null,
        hasFamilyTrustElection: input.hasFamilyTrustElection ?? false,
        sourceDocumentId: input.sourceDocumentId ?? null,
        allocations: {
          create: input.allocations.map((a) => ({
            beneficiaryEntityId: a.beneficiaryEntityId,
            presentlyEntitledShare: a.presentlyEntitledShare,
            streamedFrankedDividends: a.streamedFrankedDividends ?? null,
            streamedCapitalGains: a.streamedCapitalGains ?? null,
            notes: a.notes ?? null,
          })),
        },
      },
      select: { id: true },
    });
    return created.id;
  });

  void logCRUD({
    userId,
    action: 'CREATE',
    entityType: 'DistributionResolution',
    entityId: resolutionId,
    metadata: {
      financialYear: input.financialYear,
      allocationCount: input.allocations.length,
    },
    ...requestMeta,
  }).catch(() => {});

  return { resolutionId, warnings };
}

/** Move a resolution between `DRAFT` and `CONFIRMED`. */
export async function updateDistributionResolutionStatus(
  userId: string,
  resolutionId: string,
  status: ResolutionStatus,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  const existing = await prisma.distributionResolution.findFirst({
    where: { id: resolutionId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new DistributionResolutionValidationError(
      'RESOLUTION_NOT_FOUND',
      'Distribution resolution not found or not owned by you.',
    );
  }
  // §12.11 — composite `where` confines the write; `status` only.
  await prisma.distributionResolution.update({
    where: { id: resolutionId, userId },
    data: { status },
  });
  void logCRUD({
    userId,
    action: 'UPDATE',
    entityType: 'DistributionResolution',
    entityId: resolutionId,
    metadata: { status },
    ...requestMeta,
  }).catch(() => {});
}

/** Hard-delete a resolution (a mistaken entry). Allocations cascade-delete. */
export async function deleteDistributionResolution(
  userId: string,
  resolutionId: string,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  const existing = await prisma.distributionResolution.findFirst({
    where: { id: resolutionId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new DistributionResolutionValidationError(
      'RESOLUTION_NOT_FOUND',
      'Distribution resolution not found or not owned by you.',
    );
  }
  // §12.11 — composite `where` confines the delete to the caller's row.
  await prisma.distributionResolution.delete({
    where: { id: resolutionId, userId },
  });
  void logCRUD({
    userId,
    action: 'DELETE',
    entityType: 'DistributionResolution',
    entityId: resolutionId,
    ...requestMeta,
  }).catch(() => {});
}

export interface DistributionResolutionSummary {
  id: string;
  trustEntityId: string;
  financialYear: string;
  trustNetIncome: number;
  distributableIncome: number | null;
  resolutionDate: Date | null;
  frankedDividendPool: number | null;
  capitalGainPool: number | null;
  hasFamilyTrustElection: boolean;
  status: ResolutionStatus;
  accountantVerified: boolean;
  allocations: {
    id: string;
    beneficiaryEntityId: string;
    presentlyEntitledShare: number;
    streamedFrankedDividends: number | null;
    streamedCapitalGains: number | null;
  }[];
}

/** List a user's distribution resolutions, optionally filtered to one trust / FY. */
export async function listDistributionResolutions(
  userId: string,
  filter?: { trustEntityId?: string; financialYear?: string },
  client: PrismaTxOrClient = prisma,
): Promise<DistributionResolutionSummary[]> {
  const rows = await client.distributionResolution.findMany({
    where: {
      userId,
      ...(filter?.trustEntityId && { trustEntityId: filter.trustEntityId }),
      ...(filter?.financialYear && { financialYear: filter.financialYear }),
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      trustEntityId: true,
      financialYear: true,
      trustNetIncome: true,
      distributableIncome: true,
      resolutionDate: true,
      frankedDividendPool: true,
      capitalGainPool: true,
      hasFamilyTrustElection: true,
      status: true,
      accountantVerified: true,
      allocations: {
        select: {
          id: true,
          beneficiaryEntityId: true,
          presentlyEntitledShare: true,
          streamedFrankedDividends: true,
          streamedCapitalGains: true,
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    trustEntityId: r.trustEntityId,
    financialYear: r.financialYear,
    trustNetIncome: Number(r.trustNetIncome),
    distributableIncome: r.distributableIncome === null ? null : Number(r.distributableIncome),
    resolutionDate: r.resolutionDate,
    frankedDividendPool: r.frankedDividendPool === null ? null : Number(r.frankedDividendPool),
    capitalGainPool: r.capitalGainPool === null ? null : Number(r.capitalGainPool),
    hasFamilyTrustElection: r.hasFamilyTrustElection,
    status: r.status,
    accountantVerified: r.accountantVerified,
    allocations: r.allocations.map((a) => ({
      id: a.id,
      beneficiaryEntityId: a.beneficiaryEntityId,
      presentlyEntitledShare: Number(a.presentlyEntitledShare),
      streamedFrankedDividends:
        a.streamedFrankedDividends === null ? null : Number(a.streamedFrankedDividends),
      streamedCapitalGains:
        a.streamedCapitalGains === null ? null : Number(a.streamedCapitalGains),
    })),
  }));
}
