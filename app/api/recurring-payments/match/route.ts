/**
 * RECURRING PAYMENTS MATCHING API
 * Phase 29 - Expense Linking
 *
 * GET  - Get match suggestions for recurring payments
 * POST - Run matching algorithm on all unlinked payments
 *
 * Blueprint reference: PHASE_29_RECURRING_EXPENSE_LINKING.md
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import {
  findAllExpenseMatches,
  getMatchSummary,
  type RecurringPaymentForMatch,
  type ExpenseForMatch,
} from '@/lib/recurring/expenseMatcher';

// =============================================================================
// GET - Get Match Suggestions
// =============================================================================

export const GET = withPermission('expense.read', async (request, auth) => {
    try {
      const userId = auth.userId;
      const { searchParams } = new URL(request.url);

      const includeLinked = searchParams.get('includeLinked') === 'true';
      const minConfidence = parseFloat(searchParams.get('minConfidence') || '0.5');

      // Fetch recurring payments
      const recurringPayments = await prisma.recurringPayment.findMany({
        where: {
          userId,
          isActive: true,
          ...(includeLinked ? {} : {
            matchStatus: { in: ['UNMATCHED', 'SUGGESTED'] }
          }),
        },
        include: {
          account: true,
          linkedExpense: true,
        },
        orderBy: { expectedAmount: 'desc' },
      });

      // Fetch all expenses for matching
      const expenses = await prisma.expense.findMany({
        where: { userId },
      });

      // Convert to matcher types
      const paymentsForMatch: RecurringPaymentForMatch[] = recurringPayments.map((p: typeof recurringPayments[0]) => ({
        id: p.id,
        merchantStandardised: p.merchantStandardised,
        pattern: p.pattern as RecurringPaymentForMatch['pattern'],
        expectedAmount: p.expectedAmount,
        linkedExpenseId: p.linkedExpenseId,
        matchStatus: p.matchStatus as RecurringPaymentForMatch['matchStatus'],
      }));

      const expensesForMatch: ExpenseForMatch[] = expenses.map((e: typeof expenses[0]) => ({
        id: e.id,
        name: e.name,
        vendorName: e.vendorName,
        category: e.category,
        amount: e.amount,
        frequency: e.frequency as ExpenseForMatch['frequency'],
      }));

      // Find matches
      const matchResults = findAllExpenseMatches(paymentsForMatch, expensesForMatch);
      const summary = getMatchSummary(matchResults);

      // Filter by minimum confidence
      const filteredResults = matchResults.filter(r =>
        r.suggestedExpense === null || r.confidence >= minConfidence
      );

      // Enrich results with full recurring payment data
      const enrichedResults = filteredResults.map(result => {
        const payment = recurringPayments.find((p: typeof recurringPayments[0]) => p.id === result.recurringPaymentId);
        return {
          ...result,
          recurringPayment: payment ? {
            id: payment.id,
            merchantStandardised: payment.merchantStandardised,
            pattern: payment.pattern,
            expectedAmount: payment.expectedAmount,
            nextExpected: payment.nextExpected,
            occurrenceCount: payment.occurrenceCount,
            matchStatus: payment.matchStatus,
            linkedExpense: payment.linkedExpense,
            account: {
              id: payment.account.id,
              name: payment.account.name,
            },
          } : null,
        };
      });

      return NextResponse.json({
        success: true,
        data: enrichedResults,
        summary: {
          ...summary,
          totalRecurringPayments: recurringPayments.length,
          alreadyLinked: recurringPayments.filter((p: typeof recurringPayments[0]) => p.matchStatus === 'LINKED').length,
        },
      });
    } catch (error) {
      console.error('Get match suggestions error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to get match suggestions' },
        { status: 500 }
      );
    }
});

// =============================================================================
// POST - Run Matching and Update Suggestions
// =============================================================================

export const POST = withPermission('expense.write', async (request, auth) => {
    try {
      const userId = auth.userId;

      // Fetch unlinked recurring payments
      const recurringPayments = await prisma.recurringPayment.findMany({
        where: {
          userId,
          isActive: true,
          matchStatus: { in: ['UNMATCHED', 'SUGGESTED'] },
        },
      });

      // Fetch all expenses
      const expenses = await prisma.expense.findMany({
        where: { userId },
      });

      // Convert to matcher types
      const paymentsForMatch: RecurringPaymentForMatch[] = recurringPayments.map((p: typeof recurringPayments[0]) => ({
        id: p.id,
        merchantStandardised: p.merchantStandardised,
        pattern: p.pattern as RecurringPaymentForMatch['pattern'],
        expectedAmount: p.expectedAmount,
        linkedExpenseId: p.linkedExpenseId,
        matchStatus: p.matchStatus as RecurringPaymentForMatch['matchStatus'],
      }));

      const expensesForMatch: ExpenseForMatch[] = expenses.map((e: typeof expenses[0]) => ({
        id: e.id,
        name: e.name,
        vendorName: e.vendorName,
        category: e.category,
        amount: e.amount,
        frequency: e.frequency as ExpenseForMatch['frequency'],
      }));

      // Find matches
      const matchResults = findAllExpenseMatches(paymentsForMatch, expensesForMatch);

      // Update payments with high-confidence matches
      const updates = await Promise.all(
        matchResults
          .filter(r => r.suggestedExpense !== null && r.confidence >= 0.5)
          .map(result =>
            prisma.recurringPayment.update({
              where: { id: result.recurringPaymentId },
              data: {
                matchStatus: 'SUGGESTED',
                matchConfidence: result.confidence,
              },
            })
          )
      );

      const summary = getMatchSummary(matchResults);

      return NextResponse.json({
        success: true,
        data: {
          processed: recurringPayments.length,
          suggestionsFound: updates.length,
          ...summary,
        },
      });
    } catch (error) {
      console.error('Run matching error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to run matching' },
        { status: 500 }
      );
    }
});
