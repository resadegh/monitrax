/**
 * Phase 51.1 — Loan repayment matching API (build increment 3).
 *
 *   POST  /api/loans/[id]/ledger/match    → compute + persist SUGGESTED matches
 *   PATCH /api/loans/[id]/ledger/match    → resolve one ({ loanTransactionId, accept })
 *
 * Thin wrappers over the matching engine (§12.3). Ownership-checked.
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { suggestMatchesForLoan, resolveRepaymentMatch } from '@/lib/bookkeeping/loanLedger/matchRepayments';

type RouteContext = { params: Promise<{ id: string }> };

async function ownsLoan(userId: string, loanId: string): Promise<boolean> {
  const loan = await prisma.loan.findFirst({ where: { id: loanId, userId }, select: { id: true } });
  return Boolean(loan);
}

export const POST = withPermission<RouteContext>('loan.write', async (_request, auth, context) => {
  const { id: loanId } = await context!.params;
  if (!(await ownsLoan(auth.userId, loanId))) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan not found' } }, { status: 404 });
  }
  const suggestions = await suggestMatchesForLoan(auth.userId, loanId);
  return NextResponse.json({ success: true, data: { suggestions, count: suggestions.length } });
});

export const PATCH = withPermission<RouteContext>('loan.write', async (request, auth, context) => {
  const { id: loanId } = await context!.params;
  if (!(await ownsLoan(auth.userId, loanId))) {
    return NextResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Loan not found' } }, { status: 404 });
  }

  let body: { loanTransactionId?: string; accept?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: { code: 'INVALID_BODY', message: 'Expected JSON body' } }, { status: 400 });
  }
  if (!body.loanTransactionId || typeof body.accept !== 'boolean') {
    return NextResponse.json(
      { success: false, error: { code: 'INVALID_BODY', message: 'loanTransactionId and accept (boolean) are required' } },
      { status: 400 }
    );
  }

  const result = await resolveRepaymentMatch(auth.userId, body.loanTransactionId, body.accept);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: { code: 'NOT_RESOLVABLE', message: 'No suggested match to resolve for that row' } },
      { status: 409 }
    );
  }
  return NextResponse.json({ success: true, data: result });
});
