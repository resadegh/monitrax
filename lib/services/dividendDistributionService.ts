/**
 * Phase 44 Part 2b — dividend-distribution service (SSOT writer).
 *
 * The ONLY writer of `DividendDistribution` / `DividendPayment` — an
 * actual dividend a company declared. Feeds the Div 207 imputation
 * computation in the tax engine; franking is recorded explicitly, never
 * inferred from a rate guess (PHASE_44_ENTITY_GRAPH.md §8.2,
 * PHASE_44_PART_2_MONEY_FLOW_TAX_REWIRE.md §4.2, §5).
 *
 * Digital twin (§6.1): data-quality problems — a payee the graph does
 * not show as `SHAREHOLDER_OF` the company, per-shareholder payments
 * that do not sum to the declared total — are RECORDED + returned as
 * `warnings`, never rejected. Only entity-not-owned is hard-rejected.
 *
 * No tax or financial arithmetic here (§8.3).
 */

import { prisma } from '@/lib/db';
import type { Prisma, PrismaClient, ResolutionStatus } from '@prisma/client';
import { logCRUD } from '@/lib/security/auditLog';

type PrismaTxOrClient = PrismaClient | Prisma.TransactionClient;

/** Tolerance for the per-shareholder payments summing to the declared total. */
const AMOUNT_SUM_TOLERANCE = 0.01;

export type DividendDistributionErrorCode =
  | 'ENTITY_NOT_FOUND'
  | 'NO_PAYMENTS'
  | 'DIVIDEND_NOT_FOUND';

export class DividendDistributionValidationError extends Error {
  constructor(
    public readonly code: DividendDistributionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DividendDistributionValidationError';
  }
}

export interface DividendPaymentInput {
  shareholderEntityId: string;
  amount: number;
  frankingCredits: number;
}

export interface CreateDividendDistributionInput {
  companyEntityId: string;
  financialYear: string;
  declaredDate: Date;
  paymentDate?: Date | null;
  totalAmount: number;
  frankingPercentage: number;
  frankingCreditsTotal: number;
  payments: DividendPaymentInput[];
}

export interface DividendDistributionWriteResult {
  dividendId: string;
  warnings: string[];
}

/**
 * Pure data-quality check — do the per-shareholder payment amounts sum
 * to the declared total? Returns a warning string, or null if they
 * reconcile. Exported for unit testing.
 */
export function paymentSumWarning(
  amounts: readonly number[],
  total: number,
): string | null {
  const sum = amounts.reduce((acc, a) => acc + (a ?? 0), 0);
  if (Math.abs(sum - total) > AMOUNT_SUM_TOLERANCE) {
    return `Per-shareholder payments sum to ${sum}, not the declared total of ${total}.`;
  }
  return null;
}

/**
 * Create a `DividendDistribution` + its `DividendPayment` rows in one
 * transaction. Hard-rejects only the impossible cases.
 */
export async function createDividendDistribution(
  userId: string,
  input: CreateDividendDistributionInput,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<DividendDistributionWriteResult> {
  if (input.payments.length === 0) {
    throw new DividendDistributionValidationError(
      'NO_PAYMENTS',
      'A dividend distribution needs at least one shareholder payment.',
    );
  }

  const warnings: string[] = [];

  const sumWarning = paymentSumWarning(
    input.payments.map((p) => p.amount),
    input.totalAmount,
  );
  if (sumWarning) warnings.push(sumWarning);

  const dividendId = await prisma.$transaction(async (tx) => {
    const entityIds = [
      ...new Set([
        input.companyEntityId,
        ...input.payments.map((p) => p.shareholderEntityId),
      ]),
    ];
    const owned = await tx.legalEntity.count({
      where: { id: { in: entityIds }, userId },
    });
    if (owned !== entityIds.length) {
      throw new DividendDistributionValidationError(
        'ENTITY_NOT_FOUND',
        'The company or one or more shareholders do not exist or are not owned by you.',
      );
    }

    // Soft check — each payee should be a current SHAREHOLDER_OF the company.
    const shareholderEdges = await tx.entityRelationship.findMany({
      where: {
        userId,
        toEntityId: input.companyEntityId,
        type: 'SHAREHOLDER_OF',
        effectiveTo: null,
      },
      select: { fromEntityId: true },
    });
    const shareholders = new Set(shareholderEdges.map((e) => e.fromEntityId));
    for (const p of input.payments) {
      if (!shareholders.has(p.shareholderEntityId)) {
        warnings.push(
          `Payee ${p.shareholderEntityId} is not recorded as a shareholder of the company.`,
        );
      }
    }

    const created = await tx.dividendDistribution.create({
      data: {
        userId,
        companyEntityId: input.companyEntityId,
        financialYear: input.financialYear,
        declaredDate: input.declaredDate,
        paymentDate: input.paymentDate ?? null,
        totalAmount: input.totalAmount,
        frankingPercentage: input.frankingPercentage,
        frankingCreditsTotal: input.frankingCreditsTotal,
        payments: {
          create: input.payments.map((p) => ({
            shareholderEntityId: p.shareholderEntityId,
            amount: p.amount,
            frankingCredits: p.frankingCredits,
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
    entityType: 'DividendDistribution',
    entityId: dividendId,
    metadata: {
      financialYear: input.financialYear,
      paymentCount: input.payments.length,
    },
    ...requestMeta,
  }).catch(() => {});

  return { dividendId, warnings };
}

/** Move a dividend distribution between `DRAFT` and `CONFIRMED`. */
export async function updateDividendDistributionStatus(
  userId: string,
  dividendId: string,
  status: ResolutionStatus,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  const existing = await prisma.dividendDistribution.findFirst({
    where: { id: dividendId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new DividendDistributionValidationError(
      'DIVIDEND_NOT_FOUND',
      'Dividend distribution not found or not owned by you.',
    );
  }
  // §12.11 — composite `where` confines the write; `status` only.
  await prisma.dividendDistribution.update({
    where: { id: dividendId, userId },
    data: { status },
  });
  void logCRUD({
    userId,
    action: 'UPDATE',
    entityType: 'DividendDistribution',
    entityId: dividendId,
    metadata: { status },
    ...requestMeta,
  }).catch(() => {});
}

/** Hard-delete a dividend distribution. Payments cascade-delete. */
export async function deleteDividendDistribution(
  userId: string,
  dividendId: string,
  requestMeta?: { ipAddress?: string; userAgent?: string },
): Promise<void> {
  const existing = await prisma.dividendDistribution.findFirst({
    where: { id: dividendId, userId },
    select: { id: true },
  });
  if (!existing) {
    throw new DividendDistributionValidationError(
      'DIVIDEND_NOT_FOUND',
      'Dividend distribution not found or not owned by you.',
    );
  }
  // §12.11 — composite `where` confines the delete to the caller's row.
  await prisma.dividendDistribution.delete({
    where: { id: dividendId, userId },
  });
  void logCRUD({
    userId,
    action: 'DELETE',
    entityType: 'DividendDistribution',
    entityId: dividendId,
    ...requestMeta,
  }).catch(() => {});
}

export interface DividendDistributionSummary {
  id: string;
  companyEntityId: string;
  financialYear: string;
  declaredDate: Date;
  paymentDate: Date | null;
  totalAmount: number;
  frankingPercentage: number;
  frankingCreditsTotal: number;
  status: ResolutionStatus;
  accountantVerified: boolean;
  payments: {
    id: string;
    shareholderEntityId: string;
    amount: number;
    frankingCredits: number;
  }[];
}

/** List a user's dividend distributions, optionally filtered to one company / FY. */
export async function listDividendDistributions(
  userId: string,
  filter?: { companyEntityId?: string; financialYear?: string },
  client: PrismaTxOrClient = prisma,
): Promise<DividendDistributionSummary[]> {
  const rows = await client.dividendDistribution.findMany({
    where: {
      userId,
      ...(filter?.companyEntityId && { companyEntityId: filter.companyEntityId }),
      ...(filter?.financialYear && { financialYear: filter.financialYear }),
    },
    orderBy: { declaredDate: 'desc' },
    select: {
      id: true,
      companyEntityId: true,
      financialYear: true,
      declaredDate: true,
      paymentDate: true,
      totalAmount: true,
      frankingPercentage: true,
      frankingCreditsTotal: true,
      status: true,
      accountantVerified: true,
      payments: {
        select: {
          id: true,
          shareholderEntityId: true,
          amount: true,
          frankingCredits: true,
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    companyEntityId: r.companyEntityId,
    financialYear: r.financialYear,
    declaredDate: r.declaredDate,
    paymentDate: r.paymentDate,
    totalAmount: Number(r.totalAmount),
    frankingPercentage: Number(r.frankingPercentage),
    frankingCreditsTotal: Number(r.frankingCreditsTotal),
    status: r.status,
    accountantVerified: r.accountantVerified,
    payments: r.payments.map((p) => ({
      id: p.id,
      shareholderEntityId: p.shareholderEntityId,
      amount: Number(p.amount),
      frankingCredits: Number(p.frankingCredits),
    })),
  }));
}
