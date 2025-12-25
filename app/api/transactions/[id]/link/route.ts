/**
 * Transaction Linking API
 * POST /api/transactions/[id]/link - Link transaction to Income/Expense/Loan
 *
 * Actions:
 * - link: Link to existing Income, Expense, or Loan
 * - create: Create new Income or Expense from transaction
 * - update: Update existing Income/Expense amount with transaction amount
 * - unlink: Remove link from transaction
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';

interface LinkRequest {
  action: 'link' | 'create' | 'update' | 'unlink' | 'transfer' | 'investment';
  type?: 'income' | 'expense' | 'loan';
  targetId?: string; // For link/update actions
  updateAmount?: boolean; // Whether to update the linked entry's amount
  // For create action
  name?: string;
  category?: string; // ExpenseCategory for expense, IncomeType for income (system categories)
  customCategoryId?: string; // User-defined custom category ID (takes precedence over category)
  frequency?: string;
  isRecurring?: boolean;
  // Source type and entity linking (for expense creation)
  sourceType?: 'GENERAL' | 'PROPERTY' | 'LOAN' | 'INVESTMENT' | 'ASSET';
  propertyId?: string;
  loanId?: string;
  investmentAccountId?: string;
  assetId?: string;
  // For income
  incomeSourceType?: 'GENERAL' | 'PROPERTY' | 'INVESTMENT';
  isTaxable?: boolean;
  // For expense
  isEssential?: boolean;
  isTaxDeductible?: boolean;
  // For transfer
  transferToAccountId?: string;
  // For investment contribution
  investmentContributionAccountId?: string; // Target investment account for deposit
  investmentIsRecurring?: boolean; // Is this a recurring investment contribution?
  investmentFrequency?: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'; // Frequency of contribution
  // For batch categorization
  additionalTransactionIds?: string[]; // Other transactions to categorize the same way
  learnMerchant?: boolean; // Store merchant -> category mapping for future suggestions
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
          // Link to existing Income, Expense, or Loan
          if (!body.type || !body.targetId) {
            return NextResponse.json(
              { error: 'type and targetId required for link action' },
              { status: 400 }
            );
          }

          let targetName = '';
          let targetCategory = '';

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
            targetName = income.name;
            targetCategory = income.type; // SALARY, RENT, RENTAL, INVESTMENT, OTHER

            // Optionally update the income amount
            if (body.updateAmount) {
              await prisma.income.update({
                where: { id: body.targetId },
                data: { amount: transaction.amount },
              });
            }
          } else if (body.type === 'expense') {
            const expense = await prisma.expense.findFirst({
              where: { id: body.targetId, userId },
            });
            if (!expense) {
              return NextResponse.json(
                { error: 'Expense not found' },
                { status: 404 }
              );
            }
            targetName = expense.name;
            targetCategory = expense.category; // HOUSING, UTILITIES, etc.

            // Optionally update the expense amount
            if (body.updateAmount) {
              await prisma.expense.update({
                where: { id: body.targetId },
                data: { amount: transaction.amount },
              });
            }
          } else if (body.type === 'loan') {
            const loan = await prisma.loan.findFirst({
              where: { id: body.targetId, userId },
            });
            if (!loan) {
              return NextResponse.json(
                { error: 'Loan not found' },
                { status: 404 }
              );
            }
            targetName = loan.name;
            targetCategory = 'Loan Repayment'; // Loan repayments are categorized as such

            // Optionally update the loan minRepayment
            if (body.updateAmount) {
              await prisma.loan.update({
                where: { id: body.targetId },
                data: { minRepayment: transaction.amount },
              });
            }
          }

          // Update transaction with link and category
          const updated = await prisma.unifiedTransaction.update({
            where: { id: transactionId },
            data: {
              incomeId: body.type === 'income' ? body.targetId : null,
              expenseId: body.type === 'expense' ? body.targetId : null,
              loanId: body.type === 'loan' ? body.targetId : null,
              isRecurring: true,
              categoryLevel1: targetCategory,
            },
          });

          // Batch link additional transactions if provided
          let batchCount = 0;
          if (body.additionalTransactionIds && body.additionalTransactionIds.length > 0) {
            // Verify all transactions belong to user
            const validIds = await prisma.unifiedTransaction.findMany({
              where: {
                id: { in: body.additionalTransactionIds },
                userId,
              },
              select: { id: true },
            });

            if (validIds.length > 0) {
              await prisma.unifiedTransaction.updateMany({
                where: {
                  id: { in: validIds.map((t: { id: string }) => t.id) },
                },
                data: {
                  incomeId: body.type === 'income' ? body.targetId : null,
                  expenseId: body.type === 'expense' ? body.targetId : null,
                  loanId: body.type === 'loan' ? body.targetId : null,
                  isRecurring: true,
                  categoryLevel1: targetCategory,
                },
              });
              batchCount = validIds.length;
            }
          }

          // Learn merchant mapping for future suggestions
          if (body.learnMerchant && transaction.merchantStandardised && targetCategory) {
            await prisma.merchantMapping.upsert({
              where: {
                userId_merchantRaw: {
                  userId,
                  merchantRaw: transaction.merchantStandardised,
                },
              },
              update: {
                categoryLevel1: targetCategory,
                usageCount: { increment: 1 },
                updatedAt: new Date(),
              },
              create: {
                userId,
                merchantRaw: transaction.merchantStandardised,
                merchantStandardised: transaction.merchantStandardised,
                categoryLevel1: targetCategory,
                source: 'USER',
                confidence: 1.0,
                usageCount: 1,
              },
            });
          }

          return NextResponse.json({
            success: true,
            transaction: updated,
            batchCount,
            message: batchCount > 0
              ? `Linked ${batchCount + 1} transactions to ${targetName}`
              : (body.updateAmount
                  ? `Linked to ${targetName} and updated amount to $${transaction.amount}`
                  : `Linked to ${targetName}`),
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
            // Create new Income entry with source type support
            type IncomeTypeType = 'SALARY' | 'RENT' | 'RENTAL' | 'INVESTMENT' | 'OTHER';

            const incomeData: {
              userId: string;
              name: string;
              type: IncomeTypeType;
              customCategoryId?: string; // Custom user-defined category
              amount: number;
              frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
              sourceType?: 'GENERAL' | 'PROPERTY' | 'INVESTMENT';
              propertyId?: string;
              investmentAccountId?: string;
              isTaxable?: boolean;
            } = {
              userId,
              name,
              type: (body.category as IncomeTypeType) || 'OTHER',
              amount: transaction.amount,
              frequency: frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
            };

            // If custom category is provided, add it and validate ownership
            if (body.customCategoryId) {
              const customCategory = await prisma.category.findFirst({
                where: { id: body.customCategoryId, userId, type: 'INCOME' },
              });
              if (!customCategory) {
                return NextResponse.json(
                  { error: 'Custom category not found' },
                  { status: 404 }
                );
              }
              incomeData.customCategoryId = body.customCategoryId;
              incomeData.type = 'OTHER'; // Use OTHER as fallback for system type field
            }

            // Add source type and entity linking
            if (body.incomeSourceType) {
              incomeData.sourceType = body.incomeSourceType;
              if (body.incomeSourceType === 'PROPERTY' && body.propertyId) {
                incomeData.propertyId = body.propertyId;
              } else if (body.incomeSourceType === 'INVESTMENT' && body.investmentAccountId) {
                incomeData.investmentAccountId = body.investmentAccountId;
              }
            }
            if (body.isTaxable !== undefined) {
              incomeData.isTaxable = body.isTaxable;
            }

            const income = await prisma.income.create({
              data: incomeData,
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
            // Create new Expense entry with source type and entity linking
            type ExpenseCategoryType = 'HOUSING' | 'RATES' | 'INSURANCE' | 'MAINTENANCE' | 'PERSONAL' | 'UTILITIES' | 'FOOD' | 'GROCERIES' | 'TRANSPORT' | 'ENTERTAINMENT' | 'SUBSCRIPTION' | 'STRATA' | 'LAND_TAX' | 'LOAN_INTEREST' | 'REGISTRATION' | 'MODIFICATIONS' | 'HEALTH' | 'EDUCATION' | 'OTHER';

            const expenseData: {
              userId: string;
              name: string;
              vendorName?: string | null;
              category: ExpenseCategoryType;
              customCategoryId?: string; // Custom user-defined category
              amount: number;
              frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
              sourceType?: 'GENERAL' | 'PROPERTY' | 'LOAN' | 'INVESTMENT' | 'ASSET';
              propertyId?: string;
              loanId?: string;
              investmentAccountId?: string;
              assetId?: string;
              isEssential?: boolean;
              isTaxDeductible?: boolean;
              isRecurring?: boolean;
            } = {
              userId,
              name,
              vendorName: transaction.merchantStandardised,
              category: (body.category as ExpenseCategoryType) || 'OTHER',
              amount: transaction.amount,
              frequency: frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
            };

            // If custom category is provided, add it and validate ownership
            if (body.customCategoryId) {
              const customCategory = await prisma.category.findFirst({
                where: { id: body.customCategoryId, userId, type: 'EXPENSE' },
              });
              if (!customCategory) {
                return NextResponse.json(
                  { error: 'Custom category not found' },
                  { status: 404 }
                );
              }
              expenseData.customCategoryId = body.customCategoryId;
              expenseData.category = 'OTHER'; // Use OTHER as fallback for system category field
            }

            // Add source type and entity linking
            if (body.sourceType) {
              expenseData.sourceType = body.sourceType;
              if (body.sourceType === 'PROPERTY' && body.propertyId) {
                expenseData.propertyId = body.propertyId;
                expenseData.isTaxDeductible = true; // Property expenses are typically tax deductible
              } else if (body.sourceType === 'LOAN' && body.loanId) {
                expenseData.loanId = body.loanId;
                expenseData.category = 'LOAN_INTEREST';
                expenseData.isTaxDeductible = true;
              } else if (body.sourceType === 'INVESTMENT' && body.investmentAccountId) {
                expenseData.investmentAccountId = body.investmentAccountId;
              } else if (body.sourceType === 'ASSET' && body.assetId) {
                expenseData.assetId = body.assetId;
              }
            }
            if (body.isEssential !== undefined) {
              expenseData.isEssential = body.isEssential;
            }
            if (body.isTaxDeductible !== undefined) {
              expenseData.isTaxDeductible = body.isTaxDeductible;
            }
            // Set isRecurring based on the checkbox - defaults to false for one-off/discretionary
            expenseData.isRecurring = body.isRecurring ?? false;

            const expense = await prisma.expense.create({
              data: expenseData,
            });

            // Link transaction to new expense
            await prisma.unifiedTransaction.update({
              where: { id: transactionId },
              data: {
                expenseId: expense.id,
                isRecurring: body.isRecurring ?? false,
                isEssential: body.isEssential ?? false,
                categoryLevel1: body.category || 'Expense',
              },
            });

            // Batch link additional transactions if provided
            let batchCount = 0;
            if (body.additionalTransactionIds && body.additionalTransactionIds.length > 0) {
              // Verify all transactions belong to user
              const validIds = await prisma.unifiedTransaction.findMany({
                where: {
                  id: { in: body.additionalTransactionIds },
                  userId,
                },
                select: { id: true },
              });

              if (validIds.length > 0) {
                await prisma.unifiedTransaction.updateMany({
                  where: {
                    id: { in: validIds.map((t: { id: string }) => t.id) },
                  },
                  data: {
                    expenseId: expense.id,
                    isRecurring: body.isRecurring ?? false,
                    isEssential: body.isEssential ?? false,
                    categoryLevel1: body.category || 'Expense',
                  },
                });
                batchCount = validIds.length;
              }
            }

            // Learn merchant mapping for future suggestions
            if (body.learnMerchant && transaction.merchantStandardised && body.category) {
              await prisma.merchantMapping.upsert({
                where: {
                  userId_merchantRaw: {
                    userId,
                    merchantRaw: transaction.merchantStandardised,
                  },
                },
                update: {
                  categoryLevel1: body.category,
                  usageCount: { increment: 1 },
                  updatedAt: new Date(),
                },
                create: {
                  userId,
                  merchantRaw: transaction.merchantStandardised,
                  merchantStandardised: transaction.merchantStandardised,
                  categoryLevel1: body.category,
                  source: 'USER',
                  confidence: 1.0,
                  usageCount: 1,
                },
              });
            }

            return NextResponse.json({
              success: true,
              created: { type: 'expense', id: expense.id, name: expense.name },
              batchCount,
              message: batchCount > 0
                ? `Categorized ${batchCount + 1} transactions as ${expense.name}`
                : (body.isRecurring
                    ? 'New recurring expense created and linked'
                    : 'Transaction categorized'),
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

            // Also link the transaction with category
            await prisma.unifiedTransaction.update({
              where: { id: transactionId },
              data: {
                incomeId: body.targetId,
                isRecurring: true,
                categoryLevel1: income.type, // Set category from income type
              },
            });

            return NextResponse.json({
              success: true,
              updated: { type: 'income', id: income.id, newAmount: income.amount },
              message: `Income amount updated to $${transaction.amount}`,
            });
          } else if (body.type === 'expense') {
            const expense = await prisma.expense.update({
              where: { id: body.targetId },
              data: { amount: transaction.amount },
            });

            // Also link the transaction with category
            await prisma.unifiedTransaction.update({
              where: { id: transactionId },
              data: {
                expenseId: body.targetId,
                isRecurring: true,
                categoryLevel1: expense.category, // Set category from expense category
              },
            });

            return NextResponse.json({
              success: true,
              updated: { type: 'expense', id: expense.id, newAmount: expense.amount },
              message: `Expense amount updated to $${transaction.amount}`,
            });
          } else if (body.type === 'loan') {
            const loan = await prisma.loan.update({
              where: { id: body.targetId },
              data: { minRepayment: transaction.amount },
            });

            // Also link the transaction with category
            await prisma.unifiedTransaction.update({
              where: { id: transactionId },
              data: {
                loanId: body.targetId,
                isRecurring: true,
                categoryLevel1: 'Loan Repayment', // Set category for loan repayment
              },
            });

            return NextResponse.json({
              success: true,
              updated: { type: 'loan', id: loan.id, newAmount: loan.minRepayment },
              message: `Loan repayment updated to $${transaction.amount}`,
            });
          }

          return NextResponse.json(
            { error: 'Invalid type for update action' },
            { status: 400 }
          );
        }

        case 'unlink': {
          // Remove link from transaction
          // First check if it was an investment contribution and needs cleanup
          const existingTx = await prisma.unifiedTransaction.findFirst({
            where: { id: transactionId, userId },
          });

          if (existingTx?.isInvestmentContribution && existingTx?.investmentTransactionId) {
            // Delete the investment transaction and reverse the balance
            const investmentTx = await prisma.investmentTransaction.findFirst({
              where: { id: existingTx.investmentTransactionId },
            });
            if (investmentTx) {
              await prisma.investmentAccount.update({
                where: { id: investmentTx.investmentAccountId },
                data: { cashBalance: { decrement: investmentTx.price } },
              });
              await prisma.investmentTransaction.delete({
                where: { id: existingTx.investmentTransactionId },
              });
            }
          }

          await prisma.unifiedTransaction.update({
            where: { id: transactionId },
            data: {
              incomeId: null,
              expenseId: null,
              loanId: null,
              isRecurring: false,
              isTransfer: false,
              transferToAccountId: null,
              isInvestmentContribution: false,
              investmentAccountId: null,
              investmentTransactionId: null,
              isEssential: false,
              categoryLevel1: null,
            },
          });

          return NextResponse.json({
            success: true,
            message: 'Transaction unlinked',
          });
        }

        case 'transfer': {
          // Mark transaction as a transfer between accounts
          // This excludes it from income/expense calculations

          // Verify target account exists and belongs to user
          if (body.transferToAccountId) {
            const targetAccount = await prisma.account.findFirst({
              where: { id: body.transferToAccountId, userId },
            });
            if (!targetAccount) {
              return NextResponse.json(
                { error: 'Target account not found' },
                { status: 404 }
              );
            }
          }

          await prisma.unifiedTransaction.update({
            where: { id: transactionId },
            data: {
              isTransfer: true,
              transferToAccountId: body.transferToAccountId || null,
              isRecurring: false,
              isEssential: false,
              // Clear any existing links
              incomeId: null,
              expenseId: null,
              loanId: null,
              categoryLevel1: 'Transfer',
            },
          });

          return NextResponse.json({
            success: true,
            message: body.transferToAccountId
              ? 'Marked as transfer to another account'
              : 'Marked as transfer',
          });
        }

        case 'investment': {
          // Mark transaction as an investment contribution
          // This moves money from bank account to investment account
          // Creates a DEPOSIT transaction in the investment account

          if (!body.investmentContributionAccountId) {
            return NextResponse.json(
              { error: 'investmentContributionAccountId required for investment action' },
              { status: 400 }
            );
          }

          // Verify investment account exists and belongs to user
          const investmentAccount = await prisma.investmentAccount.findFirst({
            where: { id: body.investmentContributionAccountId, userId },
          });

          if (!investmentAccount) {
            return NextResponse.json(
              { error: 'Investment account not found' },
              { status: 404 }
            );
          }

          // Determine if this is a recurring contribution
          const isRecurring = body.investmentIsRecurring ?? false;
          const frequency = body.investmentFrequency || 'MONTHLY';

          // Create an investment transaction (DEPOSIT) to track the contribution
          const investmentTransaction = await prisma.investmentTransaction.create({
            data: {
              investmentAccountId: investmentAccount.id,
              date: transaction.date,
              type: 'DEPOSIT',
              price: transaction.amount, // Amount deposited
              units: 1, // For deposits, units = 1
              totalAmount: transaction.amount,
              notes: isRecurring
                ? `Recurring ${frequency.toLowerCase()} contribution: ${transaction.merchantStandardised || transaction.description}`
                : `Bank transfer: ${transaction.merchantStandardised || transaction.description}`,
            },
          });

          // Update the investment account balance
          await prisma.investmentAccount.update({
            where: { id: investmentAccount.id },
            data: {
              cashBalance: { increment: transaction.amount },
            },
          });

          // Mark the bank transaction as investment contribution
          await prisma.unifiedTransaction.update({
            where: { id: transactionId },
            data: {
              isInvestmentContribution: true,
              investmentAccountId: investmentAccount.id,
              investmentTransactionId: investmentTransaction.id,
              isTransfer: false,
              isRecurring: isRecurring,
              isEssential: false,
              // Clear any existing links
              incomeId: null,
              expenseId: null,
              loanId: null,
              categoryLevel1: 'Investment',
            },
          });

          // Learn merchant mapping for recurring investment contributions
          if (isRecurring && transaction.merchantStandardised) {
            await prisma.merchantMapping.upsert({
              where: {
                userId_merchantRaw: {
                  userId,
                  merchantRaw: transaction.merchantStandardised,
                },
              },
              update: {
                categoryLevel1: 'Investment',
                usageCount: { increment: 1 },
                updatedAt: new Date(),
              },
              create: {
                userId,
                merchantRaw: transaction.merchantStandardised,
                merchantStandardised: transaction.merchantStandardised,
                categoryLevel1: 'Investment',
                source: 'USER',
                confidence: 1.0,
                usageCount: 1,
              },
            });
          }

          return NextResponse.json({
            success: true,
            investmentTransaction: {
              id: investmentTransaction.id,
              type: 'DEPOSIT',
              amount: transaction.amount,
              isRecurring,
              frequency: isRecurring ? frequency : null,
            },
            message: isRecurring
              ? `Recurring ${frequency.toLowerCase()} investment of $${transaction.amount.toFixed(2)} recorded to ${investmentAccount.name}`
              : `Investment contribution of $${transaction.amount.toFixed(2)} recorded to ${investmentAccount.name}`,
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
        },
        orderBy: { name: 'asc' },
      });

      // Get all loan entries
      const loanEntries = await prisma.loan.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
          principal: true,
          minRepayment: true,
          repaymentFrequency: true,
        },
        orderBy: { name: 'asc' },
      });

      // Get all properties for source linking
      const properties = await prisma.property.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
        },
        orderBy: { name: 'asc' },
      });

      // Get all investment accounts for source linking
      const investmentAccounts = await prisma.investmentAccount.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
          platform: true,
        },
        orderBy: { name: 'asc' },
      });

      // Get all assets for source linking
      const assets = await prisma.asset.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
        },
        orderBy: { name: 'asc' },
      });

      // Find same-vendor uncategorized transactions
      const merchantName = transaction.merchantStandardised || transaction.description;
      const sameVendorTransactions = await prisma.unifiedTransaction.findMany({
        where: {
          userId,
          id: { not: transactionId }, // Exclude current transaction
          OR: merchantName
            ? [
                { merchantStandardised: merchantName },
                { description: { contains: merchantName, mode: 'insensitive' as const } },
              ]
            : [{ merchantStandardised: merchantName }],
          // Only uncategorized transactions
          incomeId: null,
          expenseId: null,
          loanId: null,
          isTransfer: false,
        },
        select: {
          id: true,
          date: true,
          description: true,
          merchantStandardised: true,
          amount: true,
          direction: true,
        },
        orderBy: { date: 'desc' },
        take: 20, // Limit to most recent 20
      });

      // Check for existing merchant mapping (learned category)
      let learnedCategory: string | null = null;
      if (transaction.merchantStandardised) {
        const merchantMapping = await prisma.merchantMapping.findFirst({
          where: {
            merchantRaw: transaction.merchantStandardised,
            OR: [
              { userId }, // User-specific mapping takes priority
              { userId: null }, // Fall back to global mapping
            ],
          },
          orderBy: [
            { userId: 'desc' }, // User mappings first (non-null)
            { usageCount: 'desc' },
          ],
        });
        if (merchantMapping) {
          learnedCategory = merchantMapping.categoryLevel1;
        }
      }

      // Find potential matches using similarity
      const searchText = merchantName.toLowerCase();
      const txAmount = transaction.amount;

      // Get the predicted category from the transaction (normalized to uppercase for matching)
      const predictedCategory = transaction.categoryLevel1?.toUpperCase().replace(/[^A-Z_]/g, '_') || null;

      // Map common category names to ExpenseCategory enum values
      const categoryMapping: Record<string, string> = {
        'UTILITIES': 'UTILITIES',
        'UTILITY': 'UTILITIES',
        'GROCERIES': 'GROCERIES',
        'GROCERY': 'GROCERIES',
        'FOOD_DINING': 'FOOD',
        'FOOD___DINING': 'FOOD',
        'FOOD': 'FOOD',
        'DINING': 'FOOD',
        'TRANSPORT': 'TRANSPORT',
        'TRANSPORTATION': 'TRANSPORT',
        'SHOPPING': 'PERSONAL',
        'ENTERTAINMENT': 'ENTERTAINMENT',
        'SUBSCRIPTION': 'SUBSCRIPTION',
        'SUBSCRIPTIONS': 'SUBSCRIPTION',
        'INSURANCE': 'INSURANCE',
        'HOUSING': 'HOUSING',
        'HEALTH': 'PERSONAL',
        'MEDICAL': 'PERSONAL',
      };

      const mappedCategory = predictedCategory ? (categoryMapping[predictedCategory] || predictedCategory) : null;

      interface MatchResult {
        id: string;
        name: string;
        type: 'income' | 'expense' | 'loan';
        category: string;
        amount: number;
        frequency: string;
        confidence: number;
        amountMatch: boolean;
        amountDiff: number;
        categoryMatch?: boolean;
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

          // Check if the expense category matches the predicted category
          const categoryMatch = Boolean(mappedCategory && expense.category === mappedCategory);

          // Include if name matches, amount matches, OR category matches
          if (similarity > 0.3 || amountMatch || categoryMatch) {
            // Boost confidence for category matches
            let confidence = similarity * (amountMatch ? 1.5 : 1);
            if (categoryMatch) {
              confidence += 0.5; // Boost for matching predicted category
            }

            matches.push({
              id: expense.id,
              name: expense.name,
              type: 'expense',
              category: expense.category,
              amount: expense.amount,
              frequency: expense.frequency,
              confidence,
              amountMatch,
              amountDiff,
              categoryMatch,
            });
          }
        }

        // Check loan entries (loan repayments are OUT transactions)
        for (const loan of loanEntries) {
          const nameText = loan.name.toLowerCase();
          const similarity = calculateSimilarity(searchText, nameText);
          const amountDiff = Math.abs(txAmount - loan.minRepayment);
          const amountMatch = amountDiff < 1 || (loan.minRepayment > 0 && amountDiff / loan.minRepayment < 0.1);

          if (similarity > 0.3 || amountMatch) {
            matches.push({
              id: loan.id,
              name: loan.name,
              type: 'loan',
              category: loan.type,
              amount: loan.minRepayment,
              frequency: loan.repaymentFrequency,
              confidence: similarity * (amountMatch ? 1.5 : 1),
              amountMatch,
              amountDiff,
            });
          }
        }
      }

      // Sort by confidence
      matches.sort((a, b) => b.confidence - a.confidence);

      // Get current link status (including transfers and investment contributions)
      let currentLink = null;
      if (transaction.isInvestmentContribution && transaction.investmentAccountId) {
        const invAccount = investmentAccounts.find((a: typeof investmentAccounts[number]) => a.id === transaction.investmentAccountId);
        currentLink = {
          type: 'investment',
          id: transaction.investmentAccountId,
          name: invAccount ? `Investment: ${invAccount.name}` : 'Investment contribution',
        };
      } else if (transaction.isTransfer) {
        currentLink = { type: 'transfer', id: transaction.id, name: 'Transfer between accounts' };
      } else if (transaction.incomeId) {
        const income = incomeEntries.find((i: typeof incomeEntries[number]) => i.id === transaction.incomeId);
        if (income) {
          currentLink = { type: 'income', id: income.id, name: income.name };
        }
      } else if (transaction.expenseId) {
        const expense = expenseEntries.find((e: typeof expenseEntries[number]) => e.id === transaction.expenseId);
        if (expense) {
          currentLink = { type: 'expense', id: expense.id, name: expense.name };
        }
      } else if (transaction.loanId) {
        const loan = loanEntries.find((l: typeof loanEntries[number]) => l.id === transaction.loanId);
        if (loan) {
          currentLink = { type: 'loan', id: loan.id, name: loan.name };
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
          isTransfer: transaction.isTransfer,
          isInvestmentContribution: transaction.isInvestmentContribution,
          investmentAccountId: transaction.investmentAccountId,
        },
        currentLink,
        suggestedMatches: matches.slice(0, 5),
        // Suggested category for creating new expenses based on transaction prediction or learned mapping
        suggestedCategory: learnedCategory || mappedCategory,
        // Learned category from previous user categorizations
        learnedCategory,
        // Same-vendor uncategorized transactions for batch categorization
        sameVendorTransactions,
        availableEntries: {
          income: incomeEntries,
          expenses: expenseEntries,
          loans: loanEntries,
        },
        // For source linking when creating new entries
        availableSources: {
          properties,
          loans: loanEntries,
          investmentAccounts,
          assets,
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
