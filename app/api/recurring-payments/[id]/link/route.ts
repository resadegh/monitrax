/**
 * RECURRING PAYMENT LINKING API
 * Phase 29 - Expense Linking
 *
 * POST   - Link recurring payment to an expense
 * DELETE - Unlink recurring payment from expense
 * PATCH  - Dismiss match suggestion
 *
 * Blueprint reference: PHASE_29_RECURRING_EXPENSE_LINKING.md
 */

import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { getDefaultLegalEntityId } from '@/lib/services/legalEntityService';
import { classifyIntake } from '@/lib/intake/classifyIntake';

type RouteContext = { params: Promise<{ id: string }> };

// =============================================================================
// POST - Link to Expense
// =============================================================================

export const POST = withPermission<RouteContext>('expense.write', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const userId = auth.userId;
      const body = await request.json();

      const { expenseId, createExpense } = body;

      // Verify recurring payment belongs to user
      const recurringPayment = await prisma.recurringPayment.findFirst({
        where: { id, userId },
      });

      if (!recurringPayment) {
        return NextResponse.json(
          { success: false, error: 'Recurring payment not found' },
          { status: 404 }
        );
      }

      // If createExpense is true, create a new expense from the recurring payment
      if (createExpense) {
        const {
          name,
          category,
          frequency,
          amount,
          isEssential,
          isTaxDeductible,
          vendorName,
          propertyId,
          loanId,
          investmentAccountId,
          assetId,
          sourceType,
        } = body;

        // Create the expense
        // MON-078: the user's explicit cadence wins; else the DETECTED pattern
        // cadence (evidence) — resolved by the ONE intake classifier.
        const intake = classifyIntake({
          kind: 'expense',
          source: 'RECURRING_DETECTION',
          declaredFrequency: frequency,
          detectedFrequency: mapPatternToFrequency(recurringPayment.pattern),
        });
        const ownerEntityId = await getDefaultLegalEntityId(userId);
        const newExpense = await prisma.expense.create({
          data: {
            userId,
            ownerEntityId,
            name: name || recurringPayment.merchantStandardised,
            vendorName: vendorName || recurringPayment.merchantStandardised,
            category: category || 'OTHER',
            sourceType: sourceType || 'GENERAL',
            amount: amount || recurringPayment.expectedAmount,
            frequency: intake.frequency,
            isRecurring: intake.isRecurring,
            isEssential: isEssential ?? true,
            isTaxDeductible: isTaxDeductible ?? false,
            propertyId: propertyId || null,
            loanId: loanId || null,
            investmentAccountId: investmentAccountId || null,
            assetId: assetId || null,
          },
        });

        // Link the recurring payment to the new expense
        const updatedPayment = await prisma.recurringPayment.update({
          where: { id },
          data: {
            linkedExpenseId: newExpense.id,
            matchStatus: 'CREATED',
            matchConfidence: 1.0,
          },
          include: {
            linkedExpense: true,
            account: true,
          },
        });

        return NextResponse.json({
          success: true,
          data: updatedPayment,
          expense: newExpense,
          message: 'Expense created and linked successfully',
        });
      }

      // Otherwise, link to existing expense
      if (!expenseId) {
        return NextResponse.json(
          { success: false, error: 'expenseId is required when not creating new expense' },
          { status: 400 }
        );
      }

      // Verify expense belongs to user
      const expense = await prisma.expense.findFirst({
        where: { id: expenseId, userId },
      });

      if (!expense) {
        return NextResponse.json(
          { success: false, error: 'Expense not found' },
          { status: 404 }
        );
      }

      // Link the recurring payment to the expense
      const updatedPayment = await prisma.recurringPayment.update({
        where: { id },
        data: {
          linkedExpenseId: expenseId,
          matchStatus: 'LINKED',
          matchConfidence: body.confidence || null,
        },
        include: {
          linkedExpense: true,
          account: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: updatedPayment,
        message: 'Recurring payment linked to expense',
      });
    } catch (error) {
      console.error('Link recurring payment error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to link recurring payment' },
        { status: 500 }
      );
    }
});

// =============================================================================
// DELETE - Unlink from Expense
// =============================================================================

export const DELETE = withPermission<RouteContext>('expense.write', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const userId = auth.userId;

      // Verify recurring payment belongs to user
      const recurringPayment = await prisma.recurringPayment.findFirst({
        where: { id, userId },
      });

      if (!recurringPayment) {
        return NextResponse.json(
          { success: false, error: 'Recurring payment not found' },
          { status: 404 }
        );
      }

      // Unlink the recurring payment
      const updatedPayment = await prisma.recurringPayment.update({
        where: { id },
        data: {
          linkedExpenseId: null,
          matchStatus: 'UNMATCHED',
          matchConfidence: null,
        },
        include: {
          account: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: updatedPayment,
        message: 'Recurring payment unlinked from expense',
      });
    } catch (error) {
      console.error('Unlink recurring payment error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to unlink recurring payment' },
        { status: 500 }
      );
    }
});

// =============================================================================
// PATCH - Dismiss Match Suggestion
// =============================================================================

export const PATCH = withPermission<RouteContext>('expense.write', async (request, auth, context) => {
    try {
      const { id } = await context!.params;
      const userId = auth.userId;

      // Verify recurring payment belongs to user
      const recurringPayment = await prisma.recurringPayment.findFirst({
        where: { id, userId },
      });

      if (!recurringPayment) {
        return NextResponse.json(
          { success: false, error: 'Recurring payment not found' },
          { status: 404 }
        );
      }

      // Dismiss the match suggestion
      const updatedPayment = await prisma.recurringPayment.update({
        where: { id },
        data: {
          matchStatus: 'DISMISSED',
          matchConfidence: null,
        },
        include: {
          account: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: updatedPayment,
        message: 'Match suggestion dismissed',
      });
    } catch (error) {
      console.error('Dismiss match suggestion error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to dismiss match suggestion' },
        { status: 500 }
      );
    }
});

// =============================================================================
// HELPERS
// =============================================================================

function mapPatternToFrequency(
  pattern: string
): 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL' {
  if (pattern === 'ANNUALLY') return 'ANNUAL';
  if (pattern === 'IRREGULAR') return 'MONTHLY';
  return pattern as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY';
}
