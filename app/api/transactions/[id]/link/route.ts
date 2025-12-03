/**
 * Transaction Linking API
 * POST /api/transactions/[id]/link - Link transaction to Income/Expense
 *
 * Actions:
 * - link: Link to existing Income or Expense
 * - create: Create new Income or Expense from transaction
 * - update: Update existing Income/Expense amount with transaction amount
 * - unlink: Remove link from transaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

interface LinkRequest {
  action: 'link' | 'create' | 'update' | 'unlink';
  type?: 'income' | 'expense';
  targetId?: string; // For link/update actions
  // For create action
  name?: string;
  category?: string; // ExpenseCategory for expense, IncomeType for income
  frequency?: string;
  isRecurring?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;
      const { id: transactionId } = await params;
      const body: LinkRequest = await request.json();

      // Verify transaction belongs to user
      const transaction = await prisma.unifiedTransaction.findFirst({
        where: { id: transactionId, userId },
      });

      if (!transaction) {
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }

      switch (body.action) {
        case 'link': {
          // Link to existing Income or Expense
          if (!body.type || !body.targetId) {
            return NextResponse.json(
              { error: 'type and targetId required for link action' },
              { status: 400 }
            );
          }

          // Verify target exists and belongs to user
          if (body.type === 'income') {
            const income = await prisma.income.findFirst({
              where: { id: body.targetId, userId },
            });
            if (!income) {
              return NextResponse.json(
                { error: 'Income not found' },
                { status: 404 }
              );
            }
          } else {
            const expense = await prisma.expense.findFirst({
              where: { id: body.targetId, userId },
            });
            if (!expense) {
              return NextResponse.json(
                { error: 'Expense not found' },
                { status: 404 }
              );
            }
          }

          // Update transaction with link
          const updated = await prisma.unifiedTransaction.update({
            where: { id: transactionId },
            data: {
              incomeId: body.type === 'income' ? body.targetId : null,
              expenseId: body.type === 'expense' ? body.targetId : null,
              isRecurring: true,
            },
          });

          return NextResponse.json({
            success: true,
            transaction: updated,
            message: `Transaction linked to ${body.type}`,
          });
        }

        case 'create': {
          // Create new Income or Expense from transaction
          if (!body.type) {
            return NextResponse.json(
              { error: 'type required for create action' },
              { status: 400 }
            );
          }

          const name = body.name || transaction.merchantStandardised || transaction.description;
          const frequency = body.frequency || 'MONTHLY';

          if (body.type === 'income') {
            // Create new Income entry
            const income = await prisma.income.create({
              data: {
                userId,
                name,
                type: (body.category as 'SALARY' | 'RENT' | 'RENTAL' | 'INVESTMENT' | 'OTHER') || 'OTHER',
                amount: transaction.amount,
                frequency: frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
                isRecurring: body.isRecurring ?? true,
              },
            });

            // Link transaction to new income
            await prisma.unifiedTransaction.update({
              where: { id: transactionId },
              data: {
                incomeId: income.id,
                isRecurring: true,
                categoryLevel1: body.category || 'Income',
              },
            });

            return NextResponse.json({
              success: true,
              created: { type: 'income', id: income.id, name: income.name },
              message: 'New income created and linked',
            });
          } else {
            // Create new Expense entry
            const expense = await prisma.expense.create({
              data: {
                userId,
                name,
                vendorName: transaction.merchantStandardised,
                category: (body.category as 'HOUSING' | 'RATES' | 'INSURANCE' | 'MAINTENANCE' | 'PERSONAL' | 'UTILITIES' | 'FOOD' | 'TRANSPORT' | 'ENTERTAINMENT' | 'STRATA' | 'LAND_TAX' | 'LOAN_INTEREST' | 'OTHER') || 'OTHER',
                amount: transaction.amount,
                frequency: frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
                isRecurring: body.isRecurring ?? true,
              },
            });

            // Link transaction to new expense
            await prisma.unifiedTransaction.update({
              where: { id: transactionId },
              data: {
                expenseId: expense.id,
                isRecurring: true,
                categoryLevel1: body.category || 'Expense',
              },
            });

            return NextResponse.json({
              success: true,
              created: { type: 'expense', id: expense.id, name: expense.name },
              message: 'New expense created and linked',
            });
          }
        }

        case 'update': {
          // Update existing Income/Expense amount with transaction amount
          if (!body.type || !body.targetId) {
            return NextResponse.json(
              { error: 'type and targetId required for update action' },
              { status: 400 }
            );
          }

          if (body.type === 'income') {
            const income = await prisma.income.update({
              where: { id: body.targetId },
              data: { amount: transaction.amount },
            });

            // Also link the transaction
            await prisma.unifiedTransaction.update({
              where: { id: transactionId },
              data: {
                incomeId: body.targetId,
                isRecurring: true,
              },
            });

            return NextResponse.json({
              success: true,
              updated: { type: 'income', id: income.id, newAmount: income.amount },
              message: `Income amount updated to $${transaction.amount}`,
            });
          } else {
            const expense = await prisma.expense.update({
              where: { id: body.targetId },
              data: { amount: transaction.amount },
            });

            // Also link the transaction
            await prisma.unifiedTransaction.update({
              where: { id: transactionId },
              data: {
                expenseId: body.targetId,
                isRecurring: true,
              },
            });

            return NextResponse.json({
              success: true,
              updated: { type: 'expense', id: expense.id, newAmount: expense.amount },
              message: `Expense amount updated to $${transaction.amount}`,
            });
          }
        }

        case 'unlink': {
          // Remove link from transaction
          await prisma.unifiedTransaction.update({
            where: { id: transactionId },
            data: {
              incomeId: null,
              expenseId: null,
              isRecurring: false,
            },
          });

          return NextResponse.json({
            success: true,
            message: 'Transaction unlinked',
          });
        }

        default:
          return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
          );
      }
    } catch (error) {
      console.error('Transaction link error:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Failed to process request' },
        { status: 500 }
      );
    }
  });
}

// GET - Get matching Income/Expense entries for a transaction
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;
      const { id: transactionId } = await params;

      // Get transaction
      const transaction = await prisma.unifiedTransaction.findFirst({
        where: { id: transactionId, userId },
        include: {
          account: { select: { id: true, name: true } },
        },
      });

      if (!transaction) {
        return NextResponse.json(
          { error: 'Transaction not found' },
          { status: 404 }
        );
      }

      // Get all income entries
      const incomeEntries = await prisma.income.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
          amount: true,
          frequency: true,
          netAmount: true,
          isRecurring: true,
        },
        orderBy: { name: 'asc' },
      });

      // Get all expense entries
      const expenseEntries = await prisma.expense.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          vendorName: true,
          category: true,
          amount: true,
          frequency: true,
          isRecurring: true,
        },
        orderBy: { name: 'asc' },
      });

      // Find potential matches using similarity
      const searchText = (transaction.merchantStandardised || transaction.description).toLowerCase();
      const txAmount = transaction.amount;

      interface MatchResult {
        id: string;
        name: string;
        type: 'income' | 'expense';
        category: string;
        amount: number;
        frequency: string;
        confidence: number;
        amountMatch: boolean;
        amountDiff: number;
      }

      const matches: MatchResult[] = [];

      // Check income entries (only for IN transactions)
      if (transaction.direction === 'IN') {
        for (const income of incomeEntries) {
          const nameText = income.name.toLowerCase();
          const similarity = calculateSimilarity(searchText, nameText);
          const effectiveAmount = income.netAmount || income.amount;
          const amountDiff = Math.abs(txAmount - effectiveAmount);
          const amountMatch = amountDiff < 1 || amountDiff / effectiveAmount < 0.05;

          if (similarity > 0.3 || amountMatch) {
            matches.push({
              id: income.id,
              name: income.name,
              type: 'income',
              category: income.type,
              amount: effectiveAmount,
              frequency: income.frequency,
              confidence: similarity * (amountMatch ? 1.5 : 1),
              amountMatch,
              amountDiff,
            });
          }
        }
      }

      // Check expense entries (only for OUT transactions)
      if (transaction.direction === 'OUT') {
        for (const expense of expenseEntries) {
          const nameText = `${expense.name} ${expense.vendorName || ''}`.toLowerCase();
          const similarity = calculateSimilarity(searchText, nameText);
          const amountDiff = Math.abs(txAmount - expense.amount);
          const amountMatch = amountDiff < 1 || amountDiff / expense.amount < 0.05;

          if (similarity > 0.3 || amountMatch) {
            matches.push({
              id: expense.id,
              name: expense.name,
              type: 'expense',
              category: expense.category,
              amount: expense.amount,
              frequency: expense.frequency,
              confidence: similarity * (amountMatch ? 1.5 : 1),
              amountMatch,
              amountDiff,
            });
          }
        }
      }

      // Sort by confidence
      matches.sort((a, b) => b.confidence - a.confidence);

      // Get current link status
      let currentLink = null;
      if (transaction.incomeId) {
        const income = incomeEntries.find((i: typeof incomeEntries[number]) => i.id === transaction.incomeId);
        if (income) {
          currentLink = { type: 'income', id: income.id, name: income.name };
        }
      } else if (transaction.expenseId) {
        const expense = expenseEntries.find((e: typeof expenseEntries[number]) => e.id === transaction.expenseId);
        if (expense) {
          currentLink = { type: 'expense', id: expense.id, name: expense.name };
        }
      }

      return NextResponse.json({
        transaction: {
          id: transaction.id,
          date: transaction.date,
          description: transaction.description,
          merchantStandardised: transaction.merchantStandardised,
          amount: transaction.amount,
          direction: transaction.direction,
          categoryLevel1: transaction.categoryLevel1,
          isRecurring: transaction.isRecurring,
        },
        currentLink,
        suggestedMatches: matches.slice(0, 5),
        availableEntries: {
          income: incomeEntries,
          expenses: expenseEntries,
        },
      });
    } catch (error) {
      console.error('Get matches error:', error);
      return NextResponse.json(
        { error: 'Failed to get matches' },
        { status: 500 }
      );
    }
  });
}

// Simple text similarity function
function calculateSimilarity(text1: string, text2: string): number {
  const words1 = text1.split(/\s+/).filter(w => w.length > 2);
  const words2 = text2.split(/\s+/).filter(w => w.length > 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  let matches = 0;
  for (const word1 of words1) {
    for (const word2 of words2) {
      if (word1.includes(word2) || word2.includes(word1)) {
        matches++;
        break;
      }
    }
  }

  return matches / Math.max(words1.length, words2.length);
}
