/**
 * RECURRING PAYMENTS API
 * Phase 13 - Transactional Intelligence
 *
 * GET  - List detected recurring payments
 * POST - Run recurring detection on transactions
 *
 * Blueprint reference: PHASE_13_TRANSACTIONAL_INTELLIGENCE.md Section 13.5.3
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import {
  detectRecurringPayments,
  UnifiedTransaction,
} from '@/lib/tie';

// =============================================================================
// GET - List Recurring Payments
// =============================================================================

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;
      const { searchParams } = new URL(request.url);

      const isActive = searchParams.get('active');
      const accountId = searchParams.get('accountId');

      const where: Record<string, unknown> = { userId };
      if (isActive === 'true') where.isActive = true;
      if (isActive === 'false') where.isActive = false;
      if (accountId) where.accountId = accountId;

      const recurringPayments = await prisma.recurringPayment.findMany({
        where,
        include: { account: true },
        orderBy: { nextExpected: 'asc' },
      });

      // Calculate totals
      const activePayments = recurringPayments.filter((p: typeof recurringPayments[number]) => p.isActive);
      const monthlyTotal = activePayments.reduce((sum: number, p: typeof recurringPayments[number]) => {
        switch (p.pattern) {
          case 'WEEKLY':
            return sum + p.expectedAmount * 4.33;
          case 'FORTNIGHTLY':
            return sum + p.expectedAmount * 2.17;
          case 'MONTHLY':
            return sum + p.expectedAmount;
          case 'QUARTERLY':
            return sum + p.expectedAmount / 3;
          case 'ANNUALLY':
            return sum + p.expectedAmount / 12;
          default:
            return sum + p.expectedAmount;
        }
      }, 0);

      return NextResponse.json({
        success: true,
        data: recurringPayments,
        summary: {
          total: recurringPayments.length,
          active: activePayments.length,
          paused: recurringPayments.filter((p: typeof recurringPayments[number]) => p.isPaused).length,
          monthlyTotal: Math.round(monthlyTotal * 100) / 100,
          priceAlerts: recurringPayments.filter((p: typeof recurringPayments[number]) => p.priceIncreaseAlert).length,
        },
      });
    } catch (error) {
      console.error('Get recurring payments error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch recurring payments' },
        { status: 500 }
      );
    }
  });
}

// =============================================================================
// POST - Detect Recurring Payments
// =============================================================================

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;

      // Fetch all user transactions (last 12 months)
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 12);

      const transactions = await prisma.unifiedTransaction.findMany({
        where: {
          userId,
          date: { gte: startDate },
        },
        orderBy: { date: 'desc' },
      });

      // Convert to TIE types
      const tieTransactions: UnifiedTransaction[] = transactions.map((tx: typeof transactions[number]) => ({
        id: tx.id,
        userId: tx.userId,
        accountId: tx.accountId,
        date: tx.date,
        postDate: tx.postDate,
        amount: tx.amount,
        currency: tx.currency,
        direction: tx.direction as 'IN' | 'OUT',
        merchantRaw: tx.merchantRaw,
        merchantStandardised: tx.merchantStandardised,
        merchantCategoryCode: tx.merchantCategoryCode,
        description: tx.description,
        categoryLevel1: tx.categoryLevel1,
        categoryLevel2: tx.categoryLevel2,
        subcategory: tx.subcategory,
        tags: tx.tags,
        userCorrectedCategory: tx.userCorrectedCategory,
        confidenceScore: tx.confidenceScore,
        isRecurring: tx.isRecurring,
        recurrencePattern: tx.recurrencePattern as UnifiedTransaction['recurrencePattern'],
        recurrenceGroupId: tx.recurrenceGroupId,
        anomalyFlags: tx.anomalyFlags as UnifiedTransaction['anomalyFlags'],
        source: tx.source as UnifiedTransaction['source'],
        externalId: tx.externalId,
        importBatchId: tx.importBatchId,
        propertyId: tx.propertyId,
        loanId: tx.loanId,
        incomeId: tx.incomeId,
        expenseId: tx.expenseId,
        investmentAccountId: tx.investmentAccountId,
        createdAt: tx.createdAt,
        updatedAt: tx.updatedAt,
        processedAt: tx.processedAt,
      }));

      // Get existing recurring payments
      const existingRecurring = await prisma.recurringPayment.findMany({
        where: { userId },
      });

      // Detect recurring patterns
      const { detected, updated } = detectRecurringPayments(
        tieTransactions,
        existingRecurring.map((r: typeof existingRecurring[number]) => ({
          ...r,
          pattern: r.pattern as UnifiedTransaction['recurrencePattern'] & string,
        }))
      );

      // Create new recurring payments
      const created = await Promise.all(
        detected.map((payment) =>
          prisma.recurringPayment.create({
            data: {
              userId: payment.userId,
              merchantStandardised: payment.merchantStandardised,
              accountId: payment.accountId,
              pattern: payment.pattern,
              expectedAmount: payment.expectedAmount,
              amountVariance: payment.amountVariance,
              lastOccurrence: payment.lastOccurrence,
              nextExpected: payment.nextExpected,
              occurrenceCount: payment.occurrenceCount,
              priceIncreaseAlert: payment.priceIncreaseAlert,
              isActive: payment.isActive,
              isPaused: payment.isPaused,
            },
          })
        )
      );

      // Update existing recurring payments
      await Promise.all(
        updated.map((update) =>
          prisma.recurringPayment.update({
            where: { id: update.id },
            data: update.updates,
          })
        )
      );

      // Mark transactions as recurring
      const merchantsToMark = new Set([
        ...detected.map((d: typeof detected[number]) => d.merchantStandardised.toLowerCase()),
        ...existingRecurring.map((e: typeof existingRecurring[number]) => e.merchantStandardised.toLowerCase()),
      ]);

      await prisma.unifiedTransaction.updateMany({
        where: {
          userId,
          merchantStandardised: {
            in: Array.from(merchantsToMark),
            mode: 'insensitive',
          },
        },
        data: { isRecurring: true },
      });

      return NextResponse.json({
        success: true,
        data: {
          newDetected: created.length,
          updated: updated.length,
          total: existingRecurring.length + created.length,
        },
      });
    } catch (error) {
      console.error('Detect recurring payments error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to detect recurring payments' },
        { status: 500 }
      );
    }
  });
}
