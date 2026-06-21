/**
 * Phase 51.1 — Loan ledger read API (build increment 4).
 *
 *   GET /api/loans/[id]/ledger  → the loan's ledger rows + FY summary
 *
 * Powers the Repayments tab. Read-only; ownership-checked. The summary takes
 * interest from the ACTUAL `INTEREST_CHARGED` rows (the tax-deductible figure),
 * never a rate × balance estimate.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { buildAuFyWindow } from '@/lib/bookkeeping/taxPack/summary';

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withPermission<RouteContext>('loan.read', async (_request, auth, context) => {
  const { id: loanId } = await context!.params;

  const loan = await prisma.loan.findFirst({
    where: { id: loanId, userId: auth.userId },
    select: { id: true, principal: true },
  });
  if (!loan) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan not found' } }, { status: 404 });
  }

  const rows = await prisma.loanTransaction.findMany({
    where: { userId: auth.userId, loanId },
    orderBy: { date: 'desc' },
    take: 250,
    select: {
      id: true, date: true, amount: true, direction: true, kind: true, description: true,
      balanceAfter: true, interestPortion: true, principalPortion: true,
      matchStatus: true, matchConfidence: true, matchedTransactionId: true,
    },
  });

  // FY summary from the actual ledger (interest = the deductible figure).
  const fy = buildAuFyWindow();
  const fyWhere = { userId: auth.userId, loanId, date: { gte: fy.start, lte: fy.end } } as const;
  const [interestAgg, repaidAgg, latestBalance] = await Promise.all([
    prisma.loanTransaction.aggregate({ where: { ...fyWhere, kind: 'INTEREST_CHARGED' }, _sum: { amount: true } }),
    prisma.loanTransaction.aggregate({ where: { ...fyWhere, kind: 'REPAYMENT_RECEIVED' }, _sum: { amount: true } }),
    prisma.loanTransaction.findFirst({
      where: { userId: auth.userId, loanId, balanceAfter: { not: null } },
      orderBy: { date: 'desc' },
      select: { balanceAfter: true },
    }),
  ]);

  const interestThisFy = interestAgg._sum.amount ?? 0;
  const repaidThisFy = repaidAgg._sum.amount ?? 0;
  const suggestedCount = rows.filter((r) => r.matchStatus === 'SUGGESTED').length;

  return NextResponse.json({
    success: true,
    data: {
      rows,
      summary: {
        fyLabel: fy.label,
        interestThisFy,
        principalPaid: Math.max(0, repaidThisFy - interestThisFy),
        currentBalance: latestBalance?.balanceAfter ?? loan.principal,
        suggestedCount,
      },
    },
  });
});
