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

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { classifyIntake } from '@/lib/intake/classifyIntake';
import { detectFrequency } from '@/lib/utils/reconciliation';
import { getDefaultLegalEntityId } from '@/lib/services/legalEntityService';
import { confirmedTransferFields } from '@/lib/bookkeeping/transferCategorisation';
import { pairTransferIfPossible, pairTransferAcrossAccounts } from '@/lib/bookkeeping/transferPairing';
import { applyCategoryToSimilarUnified } from '@/lib/bookkeeping/applyToSimilarUnified';
import { resolveTransactionMatches } from '@/lib/bookkeeping/resolveTransaction';
import { linkRepaymentToTransaction } from '@/lib/bookkeeping/loanLedger/matchRepayments';
import { buildManagedRentalSuggestion } from '@/lib/services/managedRentalService';
import { resolveOrCreateCategory } from '@/lib/bookkeeping/categoryRegistry';
import { recordKbContribution } from '@/lib/categorisation/kb/recordFromConfirmation';
import { lookupSharedCategory } from '@/lib/categorisation/kb/lookupCategory';
import { decodeCategoryPath } from '@/lib/categorisation/kb/categoryPath';
import {
  legacyCodeToCanonical,
  canonicalToLegacyCode,
  type TxDirection,
} from '@/lib/categorisation/kb/categoryBridge';

/**
 * Phase 52.5c — make the Link / reconciliation tool SSOT-aligned + KB-wired.
 *
 * Audit finding (Reza, 2026-06-22): this tool was the one categorisation surface
 * that bypassed BOTH canonical sources — it wrote raw legacy category CODES to the
 * private `merchantMapping` and never touched the `CanonicalCategoryRegistry`
 * (§12.2 SSOT) nor the shared KB. Everywhere else uses the canonical 3-level triple.
 *
 * This helper closes the gap: it bridges the chosen legacy code → the canonical
 * triple (one source: `categoryBridge.ts`), seeds the canonical registry, and feeds
 * the shared KB (gated, de-identified) — the same learn-once path the PATCH / bulk /
 * review surfaces use. Fire-and-forget (never blocks/throws into the link flow).
 * No-op for unknown / custom codes (custom categories are user free-text → never
 * graduate, so they don't belong in the cross-user KB) and for loan repayments
 * (handled by the Phase 51 loan-ledger matcher, not merchant categorisation).
 */
function learnCanonicalFromLink(args: {
  userId: string;
  merchantText: string | null | undefined;
  code: string | null | undefined;
  direction: TxDirection;
  mcc?: string | null;
}): void {
  const canonical = legacyCodeToCanonical(args.code, args.direction);
  if (!canonical || !args.merchantText) return;
  // Seed the canonical category registry (idempotent) — SSOT §12.2.
  resolveOrCreateCategory({
    userId: args.userId,
    level1: canonical.level1,
    level2: canonical.level2,
    subcategory: canonical.subcategory,
  }).catch(() => {});
  // Teach the shared, de-identified KB (gated by KB_WRITE_ENABLED).
  recordKbContribution({
    userId: args.userId,
    rawDescription: args.merchantText,
    categoryLevel1: canonical.level1,
    categoryLevel2: canonical.level2,
    subcategory: canonical.subcategory,
    mcc: args.mcc ?? null,
  });
}

interface LinkRequest {
  action: 'link' | 'create' | 'update' | 'unlink' | 'transfer' | 'investment' | 'linkLoanRepayment';
  /** For linkLoanRepayment — the imported ledger repayment row to link this txn to. */
  loanTransactionId?: string;
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

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withPermission<RouteContext>('transaction.write', async (request, auth, context) => {
    try {
      const userId = auth.userId;
      const { id: transactionId } = await context!.params;
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
          // Phase 59: the linked MANAGED rental stream (drives the
          // suggest-and-confirm card in the response, spec §3/§8).
          let linkedRentalStream: Awaited<ReturnType<typeof prisma.income.findFirst>> = null;

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
            linkedRentalStream = income;

            // Optionally update the income amount (Phase 30: with budget tracking)
            if (body.updateAmount) {
              // Save current amount as budgetedAmount if not already set
              const budgetedAmount = income.budgetedAmount ?? income.amount;
              await prisma.income.update({
                where: { id: body.targetId },
                data: {
                  amount: transaction.amount,
                  budgetedAmount: budgetedAmount,
                  lastReconciled: new Date(),
                },
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

            // Optionally update the expense amount (Phase 30: with budget tracking)
            if (body.updateAmount) {
              // Save current amount as budgetedAmount if not already set
              const budgetedAmount = expense.budgetedAmount ?? expense.amount;
              await prisma.expense.update({
                where: { id: body.targetId },
                data: {
                  amount: transaction.amount,
                  budgetedAmount: budgetedAmount,
                  lastReconciled: new Date(),
                },
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

            // Phase 52.5c — also seed the canonical registry + teach the shared KB
            // (canonical vocabulary). Skip loan links — a loan REPAYMENT merchant is
            // not a spend category (Phase 51 ledger matching owns that).
            if (body.type !== 'loan') {
              learnCanonicalFromLink({
                userId,
                merchantText: transaction.merchantStandardised,
                code: targetCategory,
                direction: body.type === 'income' ? 'IN' : 'OUT',
                mcc: transaction.merchantCategoryCode,
              });
            }
          }

          // Neobrain auto-apply (§ applyToSimilarUnified): propagate this
          // user-confirmed category to OTHER uncategorised same-merchant rows.
          // Gated on learnMerchant — un-ticking "remember" also disables the
          // sweep. Loan repayments are excluded (merchant ≠ spend category).
          let autoApplied = { count: 0, appliedIds: [] as string[] };
          if (body.learnMerchant && body.type !== 'loan') {
            autoApplied = await applyCategoryToSimilarUnified({
              userId,
              sourceTransactionId: transactionId,
              merchantStandardised: transaction.merchantStandardised,
              direction: transaction.direction,
              data: {
                // This block is gated on body.type !== 'loan', so type is
                // narrowed to 'income' | 'expense' and loanId is always null.
                incomeId: body.type === 'income' ? body.targetId : null,
                expenseId: body.type === 'expense' ? body.targetId : null,
                loanId: null,
                isRecurring: true,
                categoryLevel1: targetCategory,
              },
              excludeIds: body.additionalTransactionIds,
            });
          }

          // Phase 59: a disbursement linked to a MANAGED rental stream may
          // reconcile below the declared gross — build the suggest-and-confirm
          // card payload (null = nothing fires; never breaks the link flow).
          const managedRental = linkedRentalStream
            ? await buildManagedRentalSuggestion({
                userId,
                income: linkedRentalStream,
                transaction,
              })
            : null;

          return NextResponse.json({
            success: true,
            transaction: updated,
            batchCount,
            autoApplied,
            managedRental,
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
          // MON-078: no silent-MONTHLY literal here — the declared cadence
          // passes into the ONE intake classifier per branch below.
          const declaredFrequency = body.frequency ?? null;

          // C1 (MON-001): cadence EVIDENCE — the dates of every transaction
          // being linked in this call (primary + batch). With ≥2 the
          // classifier derives the true cadence itself (weekly stays WEEKLY),
          // instead of falling back to monthly when no cadence was declared.
          const evidenceTxs = body.additionalTransactionIds?.length
            ? await prisma.unifiedTransaction.findMany({
                where: { id: { in: body.additionalTransactionIds }, userId },
                select: { date: true },
              })
            : [];
          const evidenceDates: Date[] = [transaction.date, ...evidenceTxs.map((t: { date: Date }) => t.date)];

          if (body.type === 'income') {
            // Create new Income entry with source type support
            type IncomeTypeType = 'SALARY' | 'RENT' | 'RENTAL' | 'INVESTMENT' | 'OTHER';

            const ownerEntityId = await getDefaultLegalEntityId(userId);

            // MON-078: frequency + recurrence via the ONE intake classifier
            // (MON-053: the dialog sends an explicit one-off/recurring choice;
            // the server never silently ×12s a lone deposit).
            const incomeIntake = classifyIntake({
              kind: 'income',
              source: 'TRANSACTION_LINK',
              declaredFrequency,
              transactionDates: evidenceDates, // C1 (MON-001)
              declaredIsRecurring: body.isRecurring !== undefined ? Boolean(body.isRecurring) : null,
            });
            const incomeData: {
              userId: string;
              ownerEntityId: string;
              name: string;
              type: IncomeTypeType;
              customCategoryId?: string; // Custom user-defined category
              amount: number;
              frequency: 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
              sourceType?: 'GENERAL' | 'PROPERTY' | 'INVESTMENT';
              propertyId?: string;
              investmentAccountId?: string;
              isTaxable?: boolean;
              isRecurring?: boolean;
            } = {
              userId,
              ownerEntityId,
              name,
              type: (body.category as IncomeTypeType) || 'OTHER',
              amount: transaction.amount,
              frequency: incomeIntake.frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
              isRecurring: incomeIntake.isRecurring,
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

            // MON-009: don't fragment a property's rental stream into one
            // Income record per payment (the "4 monthly rows" bug). If this
            // property already has a rental income record, LINK the transaction
            // to it instead of minting a duplicate MONTHLY row. The canonical
            // cashflow engine resolves the true cadence from the pooled
            // transaction dates, so one stream stays one record.
            const isRentalIncome = incomeData.type === 'RENT' || incomeData.type === 'RENTAL';
            const rentalScopeRows =
              isRentalIncome && incomeData.propertyId
                ? await prisma.income.findMany({
                    where: { userId, propertyId: incomeData.propertyId, type: { in: ['RENT', 'RENTAL'] } },
                    orderBy: { createdAt: 'asc' },
                  })
                : [];
            // MON-078: stream reuse decided by the ONE classifier — the
            // property's rental scope admits ONE stream (scope-singleton).
            const rentalMatch = classifyIntake({
              kind: 'income',
              source: 'TRANSACTION_LINK',
              declaredFrequency: incomeIntake.frequency,
              streamPolicy: 'scope-singleton',
              existingRows: rentalScopeRows.map((r: any) => ({ id: r.id, name: r.name, amount: r.amount })),
            }).streamMatch;
            const existingRentalStream = rentalMatch
              ? rentalScopeRows.find((r: any) => r.id === rentalMatch.id) ?? null
              : null;

            // Mechanism A (MON-084/074): NON-rental income (SALARY / OTHER /
            // INVESTMENT) previously had NO reuse guard — every link minted a
            // sibling row ("Ingeus Australia" ×3, one job). Reuse is decided by
            // the ONE classifier's source-signature policy (type + normalised
            // name + ownerEntity; cross-scope only when one side is scopeless),
            // and a match takes the UPDATE action (the :831 template — amount ←
            // transaction, prior amount preserved as budgetedAmount,
            // lastReconciled stamped) instead of inserting. Rental income is
            // deliberately excluded: its identity is property-scoped
            // (MON-009 scope-singleton above), and a scopeless rental deposit
            // must never guess which property's stream to join.
            let signatureIncome: Awaited<ReturnType<typeof prisma.income.update>> | null = null;
            if (!isRentalIncome) {
              const signatureRows = await prisma.income.findMany({
                where: { userId, type: incomeData.type, ownerEntityId: incomeData.ownerEntityId },
                orderBy: { createdAt: 'asc' },
              });
              const signatureMatch = classifyIntake({
                kind: 'income',
                source: 'TRANSACTION_LINK',
                declaredFrequency: incomeIntake.frequency,
                streamPolicy: 'source-signature',
                candidate: {
                  name: incomeData.name,
                  amount: incomeData.amount,
                  scopeKey: incomeData.propertyId ?? incomeData.investmentAccountId ?? null,
                },
                existingRows: signatureRows.map((r: any) => ({
                  id: r.id,
                  name: r.name,
                  amount: r.amount,
                  scopeKey: r.propertyId ?? r.investmentAccountId ?? null,
                })),
              }).streamMatch;
              if (signatureMatch) {
                const current = signatureRows.find((r: any) => r.id === signatureMatch.id)!;
                const budgetedAmount = current.budgetedAmount ?? current.amount;
                signatureIncome = await prisma.income.update({
                  where: { id: current.id },
                  data: {
                    amount: transaction.amount,
                    budgetedAmount,
                    lastReconciled: new Date(),
                  },
                });
              }
            }

            const income =
              existingRentalStream ??
              signatureIncome ??
              (await prisma.income.create({ data: incomeData }));

            // Link transaction to the (reused or new) income stream
            await prisma.unifiedTransaction.update({
              where: { id: transactionId },
              data: {
                incomeId: income.id,
                isRecurring: true,
                categoryLevel1: body.category || 'Income',
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
                    incomeId: income.id,
                    isRecurring: true,
                    categoryLevel1: body.category || 'Income',
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

              // Phase 52.5c — seed canonical registry + teach the shared KB (income).
              learnCanonicalFromLink({
                userId,
                merchantText: transaction.merchantStandardised,
                code: body.category,
                direction: 'IN',
                mcc: transaction.merchantCategoryCode,
              });
            }

            // Neobrain auto-apply — propagate this income categorisation to
            // other uncategorised same-merchant rows (§ applyToSimilarUnified).
            let incomeAutoApplied = { count: 0, appliedIds: [] as string[] };
            if (body.learnMerchant) {
              incomeAutoApplied = await applyCategoryToSimilarUnified({
                userId,
                sourceTransactionId: transactionId,
                merchantStandardised: transaction.merchantStandardised,
                direction: transaction.direction,
                data: {
                  incomeId: income.id,
                  isRecurring: true,
                  categoryLevel1: body.category || 'Income',
                },
                excludeIds: body.additionalTransactionIds,
              });
            }

            // Phase 59: when the (reused) stream is a MANAGED rental, the
            // just-linked disbursement may reconcile below the declared gross.
            const managedRental = await buildManagedRentalSuggestion({
              userId,
              income,
              transaction,
            });

            return NextResponse.json({
              success: true,
              created: { type: 'income', id: income.id, name: income.name },
              batchCount,
              autoApplied: incomeAutoApplied,
              managedRental,
              message: batchCount > 0
                ? `Categorized ${batchCount + 1} transactions as ${income.name}`
                : 'New income created and linked',
            });
          } else {
            // Create new Expense entry with source type and entity linking
            type ExpenseCategoryType = 'HOUSING' | 'RENT' | 'RATES' | 'INSURANCE' | 'MAINTENANCE' | 'PERSONAL' | 'UTILITIES' | 'FOOD' | 'GROCERIES' | 'TRANSPORT' | 'ENTERTAINMENT' | 'SUBSCRIPTION' | 'STRATA' | 'LAND_TAX' | 'LOAN_INTEREST' | 'REGISTRATION' | 'MODIFICATIONS' | 'HEALTH' | 'EDUCATION' | 'OTHER';

            const expenseOwnerEntityId = await getDefaultLegalEntityId(userId);
            const expenseData: {
              userId: string;
              ownerEntityId: string;
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
              ownerEntityId: expenseOwnerEntityId,
              name,
              vendorName: transaction.merchantStandardised,
              category: (body.category as ExpenseCategoryType) || 'OTHER',
              amount: transaction.amount,
              // MON-078: cadence via the ONE intake classifier (declared wins;
              // legacy fallback lives in the classifier until C1).
              frequency: classifyIntake({
                kind: 'expense',
                source: 'TRANSACTION_LINK',
                declaredFrequency,
                transactionDates: evidenceDates, // C1 (MON-001)
              }).frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL',
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
            // MON-078: recurrence via the ONE intake classifier (the dialog's
            // checkbox is the explicit choice; expense-side default = one-off).
            expenseData.isRecurring = classifyIntake({
              kind: 'expense',
              source: 'TRANSACTION_LINK',
              declaredFrequency,
              transactionDates: evidenceDates, // C1 (MON-001)
              declaredIsRecurring: body.isRecurring !== undefined ? Boolean(body.isRecurring) : null,
            }).isRecurring;

            // MON-011: don't duplicate an expense on re-reconcile. If an expense
            // with the same name + linking scope already exists (e.g. an orphan
            // left after an earlier unlink, or the record this transaction was
            // reconciled to before), LINK the transaction to it instead of
            // minting a second "Battery" row. The unlink action reverts the
            // amount but doesn't delete the expense, so without this a
            // reconcile→unreconcile→reconcile cycle stacks up duplicates.
            // MON-025: match on the NORMALISED merchant, not an exact string, so
            // the same insurer under two bank spellings ("QBE Insurance
            // (Australia) Limited" vs "Qbe Insurance (australia) Limited Abn…")
            // reuses one record instead of minting a second.
            // MON-037 RC-B → MON-078 → Mechanism A (MON-085): stream reuse via
            // the ONE classifier's source-signature policy. Candidates are the
            // user's expenses ACROSS scopes (the old query filtered to the
            // exact propertyId/loanId/assetId triple, so a "Battery" on HOME
            // and a "Battery" on General were in different candidate sets and
            // never compared — battery ×3). The classifier ranks same-scope
            // matches first and permits a cross-scope match ONLY when one side
            // is scopeless (General) — two DIFFERENTLY-scoped rows (QBE on
            // property A vs property B) are distinct real streams and never
            // converge.
            const expenseScopeKey =
              expenseData.propertyId ??
              expenseData.loanId ??
              expenseData.investmentAccountId ??
              expenseData.assetId ??
              null;
            const expenseCandidates = await prisma.expense.findMany({
              where: { userId },
              orderBy: { createdAt: 'asc' },
            });
            const expenseMatch = classifyIntake({
              kind: 'expense',
              source: 'TRANSACTION_LINK',
              declaredFrequency,
              streamPolicy: 'source-signature',
              candidate: {
                name: expenseData.name,
                vendorName: expenseData.vendorName,
                amount: expenseData.amount,
                scopeKey: expenseScopeKey,
              },
              existingRows: expenseCandidates.map((e: any) => ({
                id: e.id,
                name: e.name,
                vendorName: e.vendorName,
                amount: e.amount,
                scopeKey: e.propertyId ?? e.loanId ?? e.investmentAccountId ?? e.assetId ?? null,
              })),
            }).streamMatch;
            const matchedExpense = expenseMatch
              ? expenseCandidates.find((e: any) => e.id === expenseMatch.id) ?? null
              : null;

            let expense;
            if (
              matchedExpense &&
              (matchedExpense.propertyId ?? matchedExpense.loanId ?? matchedExpense.investmentAccountId ?? matchedExpense.assetId ?? null) ===
                expenseScopeKey
            ) {
              // Same-scope match — the established #1427 behaviour: link the
              // transaction to the existing row, no field changes.
              expense = matchedExpense;
            } else if (matchedExpense) {
              // Cross-scope match (Mechanism A, new): reconciliation takes the
              // UPDATE action (the :831 template) against the canonical row —
              // amount ← transaction, prior amount preserved as budgetedAmount,
              // lastReconciled stamped — instead of minting a scoped/scopeless
              // sibling of the same real cost.
              const budgetedAmount = matchedExpense.budgetedAmount ?? matchedExpense.amount;
              expense = await prisma.expense.update({
                where: { id: matchedExpense.id },
                data: {
                  amount: expenseData.amount,
                  budgetedAmount,
                  lastReconciled: new Date(),
                },
              });
            } else {
              expense = await prisma.expense.create({ data: expenseData });
            }

            // Link transaction to the (reused or new) expense
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
            // Use the actual category (or custom category name if custom)
            const categoryToLearn = body.customCategoryId
              ? (await prisma.category.findUnique({ where: { id: body.customCategoryId }, select: { name: true } }))?.name || body.category
              : body.category;

            if (body.learnMerchant && transaction.merchantStandardised && categoryToLearn) {
              await prisma.merchantMapping.upsert({
                where: {
                  userId_merchantRaw: {
                    userId,
                    merchantRaw: transaction.merchantStandardised,
                  },
                },
                update: {
                  categoryLevel1: categoryToLearn,
                  customCategoryId: body.customCategoryId || null,
                  usageCount: { increment: 1 },
                  updatedAt: new Date(),
                },
                create: {
                  userId,
                  merchantRaw: transaction.merchantStandardised,
                  merchantStandardised: transaction.merchantStandardised,
                  categoryLevel1: categoryToLearn,
                  customCategoryId: body.customCategoryId || null,
                  source: 'USER',
                  confidence: 1.0,
                  usageCount: 1,
                },
              });

              // Phase 52.5c — seed canonical registry + teach the shared KB
              // (expense). Only for SYSTEM codes — custom categories are free-text
              // user labels that can't map to the canonical hierarchy and never
              // graduate, so they stay out of the cross-user KB.
              if (!body.customCategoryId) {
                learnCanonicalFromLink({
                  userId,
                  merchantText: transaction.merchantStandardised,
                  code: body.category,
                  direction: 'OUT',
                  mcc: transaction.merchantCategoryCode,
                });
              }
            }

            // Neobrain auto-apply — propagate this expense categorisation to
            // other uncategorised same-merchant rows (§ applyToSimilarUnified).
            let expenseAutoApplied = { count: 0, appliedIds: [] as string[] };
            if (body.learnMerchant) {
              expenseAutoApplied = await applyCategoryToSimilarUnified({
                userId,
                sourceTransactionId: transactionId,
                merchantStandardised: transaction.merchantStandardised,
                direction: transaction.direction,
                data: {
                  expenseId: expense.id,
                  isRecurring: body.isRecurring ?? false,
                  isEssential: body.isEssential ?? false,
                  categoryLevel1: body.category || 'Expense',
                },
                excludeIds: body.additionalTransactionIds,
              });
            }

            return NextResponse.json({
              success: true,
              created: { type: 'expense', id: expense.id, name: expense.name },
              batchCount,
              autoApplied: expenseAutoApplied,
              message: batchCount > 0
                ? `Categorized ${batchCount + 1} transactions as ${expense.name}`
                : (body.isRecurring
                    ? 'New recurring expense created and linked'
                    : 'Transaction categorized'),
            });
          }
        }

        case 'update': {
          // Update existing Income/Expense amount with transaction amount (Phase 30: with budget tracking)
          if (!body.type || !body.targetId) {
            return NextResponse.json(
              { error: 'type and targetId required for update action' },
              { status: 400 }
            );
          }

          if (body.type === 'income') {
            // First get current income to preserve budgetedAmount
            const currentIncome = await prisma.income.findFirst({
              where: { id: body.targetId, userId },
            });
            if (!currentIncome) {
              return NextResponse.json(
                { error: 'Income not found' },
                { status: 404 }
              );
            }

            // Save current amount as budgetedAmount if not already set
            const budgetedAmount = currentIncome.budgetedAmount ?? currentIncome.amount;
            const income = await prisma.income.update({
              where: { id: body.targetId },
              data: {
                amount: transaction.amount,
                budgetedAmount: budgetedAmount,
                lastReconciled: new Date(),
              },
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
              updated: { type: 'income', id: income.id, newAmount: income.amount, budgetedAmount },
              message: `Income amount updated to $${transaction.amount}${budgetedAmount !== transaction.amount ? ` (budget: $${budgetedAmount})` : ''}`,
            });
          } else if (body.type === 'expense') {
            // First get current expense to preserve budgetedAmount
            const currentExpense = await prisma.expense.findFirst({
              where: { id: body.targetId, userId },
            });
            if (!currentExpense) {
              return NextResponse.json(
                { error: 'Expense not found' },
                { status: 404 }
              );
            }

            // Save current amount as budgetedAmount if not already set
            const budgetedAmount = currentExpense.budgetedAmount ?? currentExpense.amount;
            const expense = await prisma.expense.update({
              where: { id: body.targetId },
              data: {
                amount: transaction.amount,
                budgetedAmount: budgetedAmount,
                lastReconciled: new Date(),
              },
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
              updated: { type: 'expense', id: expense.id, newAmount: expense.amount, budgetedAmount },
              message: `Expense amount updated to $${transaction.amount}${budgetedAmount !== transaction.amount ? ` (budget: $${budgetedAmount})` : ''}`,
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

        case 'linkLoanRepayment': {
          // Phase 51.2 — confirm a resolution-surfaced loan-repayment match:
          // links this offset/funding transaction to the imported ledger
          // repayment, marks it isTransfer (principal out of spending) + sets
          // loanId. The category KB write-back is deliberately skipped — a
          // repayment is not a merchant categorisation.
          if (!body.loanTransactionId) {
            return NextResponse.json(
              { error: 'loanTransactionId required for linkLoanRepayment action' },
              { status: 400 }
            );
          }
          const result = await linkRepaymentToTransaction(
            userId,
            body.loanTransactionId,
            transactionId
          );
          if (!result.ok) {
            return NextResponse.json(
              { error: 'Could not link this transaction to the loan repayment' },
              { status: 404 }
            );
          }
          return NextResponse.json({ success: true, message: 'Linked to loan repayment' });
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

          // Phase 30: Revert income/expense amount to budgetedAmount if set
          if (existingTx?.incomeId) {
            const income = await prisma.income.findFirst({
              where: { id: existingTx.incomeId, userId },
            });
            if (income?.budgetedAmount !== null && income?.budgetedAmount !== undefined) {
              // Revert to budgeted amount and clear reconciliation
              await prisma.income.update({
                where: { id: existingTx.incomeId },
                data: {
                  amount: income.budgetedAmount,
                  lastReconciled: null,
                },
              });
            }
          }

          if (existingTx?.expenseId) {
            const expense = await prisma.expense.findFirst({
              where: { id: existingTx.expenseId, userId },
            });
            if (expense?.budgetedAmount !== null && expense?.budgetedAmount !== undefined) {
              // Revert to budgeted amount and clear reconciliation
              await prisma.expense.update({
                where: { id: existingTx.expenseId },
                data: {
                  amount: expense.budgetedAmount,
                  lastReconciled: null,
                },
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

          // Batch unlink — powers the "Undo" on a Neobrain auto-apply sweep.
          // Clears the same categorisation fields on the user-scoped ids
          // (§12.11 — validate ownership before the write).
          let unlinkBatchCount = 0;
          if (body.additionalTransactionIds && body.additionalTransactionIds.length > 0) {
            const validIds = await prisma.unifiedTransaction.findMany({
              where: { id: { in: body.additionalTransactionIds }, userId },
              select: { id: true },
            });
            if (validIds.length > 0) {
              await prisma.unifiedTransaction.updateMany({
                where: { id: { in: validIds.map((t: { id: string }) => t.id) } },
                data: {
                  incomeId: null,
                  expenseId: null,
                  loanId: null,
                  isRecurring: false,
                  isEssential: false,
                  categoryLevel1: null,
                },
              });
              unlinkBatchCount = validIds.length;
            }
          }

          return NextResponse.json({
            success: true,
            unlinkBatchCount,
            message: unlinkBatchCount > 0
              ? `Undone — cleared ${unlinkBatchCount + 1} transactions`
              : 'Transaction unlinked',
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

          const transferData = {
            // Fully categorise + confirm the transfer (§12.2.1) so it leaves
            // the Uncategorised / Not-confirmed review surfaces.
            ...confirmedTransferFields(),
            transferToAccountId: body.transferToAccountId || null,
            isRecurring: false,
            isEssential: false,
            // Clear any existing links
            incomeId: null,
            expenseId: null,
            loanId: null,
          };

          await prisma.unifiedTransaction.update({
            where: { id: transactionId },
            data: transferData,
          });

          // Auto-mark the OTHER leg (Reza directive 2026-06-29: the target-account
          // transaction should also be marked as transfer automatically). With an
          // explicit destination we search that account; without one we auto-discover
          // across all the user's accounts. Either way we only pair on a UNIQUE
          // match (no false pairs). Guarded so a pairing miss never fails the mark.
          let pairedTxId: string | null = null;
          try {
            pairedTxId = body.transferToAccountId
              ? await pairTransferIfPossible(transactionId, body.transferToAccountId)
              : await pairTransferAcrossAccounts(transactionId);
          } catch (pairErr) {
            console.error('[link route] transfer pairing failed (source still marked):', pairErr);
          }

          // Batch-mark additional transactions as the same transfer (§12.2.1 —
          // the batch path must apply to transfers too, not just expense/income).
          let transferBatchCount = 0;
          if (body.additionalTransactionIds && body.additionalTransactionIds.length > 0) {
            // Verify all transactions belong to user (§12.11 — scope every write to userId).
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
                data: transferData,
              });
              transferBatchCount = validIds.length;
            }
          }

          return NextResponse.json({
            success: true,
            batchCount: transferBatchCount,
            pairedTransactionId: pairedTxId,
            message: transferBatchCount > 0
              ? `Marked ${transferBatchCount + 1} transactions as transfers`
              : pairedTxId
                ? 'Marked as transfer — matched the other account automatically'
                : body.transferToAccountId
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

          // Batch-mark additional transactions as investment contributions
          // (§12.2.1 — the batch path must apply to investments too). Each
          // contribution needs its OWN investment DEPOSIT (amounts differ), so
          // we loop rather than updateMany.
          let investmentBatchCount = 0;
          if (body.additionalTransactionIds && body.additionalTransactionIds.length > 0) {
            // Fetch + scope to the user (§12.11) in one query.
            const additionalTxs = await prisma.unifiedTransaction.findMany({
              where: {
                id: { in: body.additionalTransactionIds },
                userId,
              },
              select: {
                id: true,
                amount: true,
                date: true,
                description: true,
                merchantStandardised: true,
              },
            });

            for (const addTx of additionalTxs) {
              const addInvestmentTransaction = await prisma.investmentTransaction.create({
                data: {
                  investmentAccountId: investmentAccount.id,
                  date: addTx.date,
                  type: 'DEPOSIT',
                  price: addTx.amount,
                  units: 1,
                  totalAmount: addTx.amount,
                  notes: isRecurring
                    ? `Recurring ${frequency.toLowerCase()} contribution: ${addTx.merchantStandardised || addTx.description}`
                    : `Bank transfer: ${addTx.merchantStandardised || addTx.description}`,
                },
              });

              await prisma.investmentAccount.update({
                where: { id: investmentAccount.id },
                data: { cashBalance: { increment: addTx.amount } },
              });

              await prisma.unifiedTransaction.update({
                where: { id: addTx.id },
                data: {
                  isInvestmentContribution: true,
                  investmentAccountId: investmentAccount.id,
                  investmentTransactionId: addInvestmentTransaction.id,
                  isTransfer: false,
                  isRecurring: isRecurring,
                  isEssential: false,
                  incomeId: null,
                  expenseId: null,
                  loanId: null,
                  categoryLevel1: 'Investment',
                },
              });
              investmentBatchCount += 1;
            }
          }

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
            batchCount: investmentBatchCount,
            investmentTransaction: {
              id: investmentTransaction.id,
              type: 'DEPOSIT',
              amount: transaction.amount,
              isRecurring,
              frequency: isRecurring ? frequency : null,
            },
            message: investmentBatchCount > 0
              ? `Recorded ${investmentBatchCount + 1} investment contributions to ${investmentAccount.name}`
              : isRecurring
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

// GET - Get matching Income/Expense entries for a transaction
export const GET = withPermission<RouteContext>('transaction.read', async (request, auth, context) => {
    try {
      const userId = auth.userId;
      const { id: transactionId } = await context!.params;

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

      // Get all income entries (including budget/reconciliation fields)
      const incomeEntries = await prisma.income.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          type: true,
          amount: true,
          frequency: true,
          netAmount: true,
          propertyId: true,
          investmentAccountId: true,
          budgetedAmount: true,
          lastReconciled: true,
        },
        orderBy: { name: 'asc' },
      });

      // Get all expense entries (including budget/reconciliation fields)
      const expenseEntries = await prisma.expense.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          vendorName: true,
          category: true,
          amount: true,
          frequency: true,
          propertyId: true,
          investmentAccountId: true,
          budgetedAmount: true,
          lastReconciled: true,
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
          // Only unlinked transactions (no links to income/expense/loan, not transfer, not investment)
          // Note: categoryLevel1 may be auto-populated but still unlinked - don't filter by it
          incomeId: null,
          expenseId: null,
          loanId: null,
          isTransfer: { not: true }, // matches false OR null
          isInvestmentContribution: { not: true }, // matches false OR null
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

      // Phase 52.5c — KB read: with no private/global learned mapping AND no engine
      // prediction, consult the shared, GRADUATED community KB and map its canonical
      // answer back to the legacy code the dialog's CategorySelect expects. Gated by
      // KB_READ_ENABLED (no DB hit when off); only ≥k-graduated patterns return.
      let kbSuggestedCategory: string | null = null;
      if (!learnedCategory && !mappedCategory) {
        const kbHit = await lookupSharedCategory(transaction.description || merchantName || '');
        if (kbHit) {
          const decoded = decodeCategoryPath(kbHit.category);
          kbSuggestedCategory = canonicalToLegacyCode(
            decoded.level1,
            decoded.level2,
            transaction.direction as TxDirection
          );
        }
      }

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
        // Phase 30: Reconciliation fields
        propertyId?: string | null;
        propertyName?: string | null;
        budgetedAmount?: number | null;
        lastReconciled?: Date | null;
        reconciliationRecommendation?: 'update_amount' | 'link_only' | 'create_new';
      }

      const matches: MatchResult[] = [];

      // Phase 30: Analyze same-vendor transaction pattern
      let transactionPattern = null;
      if (sameVendorTransactions.length > 0) {
        // Include current transaction in pattern analysis
        const allVendorTxs = [
          { date: transaction.date, amount: transaction.amount },
          ...sameVendorTransactions.map(t => ({ date: t.date, amount: t.amount })),
        ];

        // Filter to last 12 months
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        const recentTxs = allVendorTxs.filter(t => new Date(t.date) >= twelveMonthsAgo);

        if (recentTxs.length >= 2) {
          // Sort by date to detect frequency
          const sortedTxs = recentTxs
            .map(t => ({ date: new Date(t.date), amount: Math.abs(t.amount) }))
            .sort((a, b) => a.date.getTime() - b.date.getTime());

          const sortedDates = sortedTxs.map(t => t.date);

          // Calculate intervals between transactions
          const intervals: number[] = [];
          for (let i = 1; i < sortedDates.length; i++) {
            const days = Math.round((sortedDates[i].getTime() - sortedDates[i - 1].getTime()) / (1000 * 60 * 60 * 24));
            if (days > 0) intervals.push(days);
          }

          if (intervals.length > 0) {
            const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
            const amounts = sortedTxs.map(t => t.amount);
            const avgAmount = amounts.reduce((sum, a) => sum + a, 0) / amounts.length;

            // C1 (MON-001): cadence via the ONE canonical detector — this
            // inline block was a duplicate producer with identical thresholds.
            const detectedFrequency = detectFrequency(sortedDates).frequency;

            // Calculate TRUE monthly average based on payment timing
            // ADVANCE payments (rent): exclude last payment (covers future period)
            // ARREARS payments (salary, utilities): include all payments (all completed)
            const firstDate = sortedDates[0];
            const lastDate = sortedDates[sortedDates.length - 1];
            const daysCovered = Math.round((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
            const monthsCovered = daysCovered / 30.44; // Average days per month

            // Determine payment timing based on category
            // RENTAL is typically paid in ADVANCE, everything else is ARREARS
            const isRentalCategory =
              transaction.categoryLevel1?.toUpperCase() === 'RENTAL' ||
              transaction.categoryLevel1?.toUpperCase() === 'RENT' ||
              learnedCategory?.toUpperCase() === 'RENTAL' ||
              learnedCategory?.toUpperCase() === 'RENT' ||
              merchantName?.toLowerCase().includes('rent') ||
              merchantName?.toLowerCase().includes('trust'); // Property trust accounts

            const paymentTiming = isRentalCategory ? 'ADVANCE' : 'ARREARS';

            // Calculate sum based on payment timing
            let sumForAverage: number;
            if (paymentTiming === 'ADVANCE') {
              // Exclude last payment (covers future period)
              sumForAverage = sortedTxs.slice(0, -1).reduce((sum, t) => sum + t.amount, 0);
            } else {
              // Include all payments (all cover completed periods)
              sumForAverage = amounts.reduce((sum, a) => sum + a, 0);
            }

            const trueMonthlyAverage = monthsCovered > 0 ? sumForAverage / monthsCovered : avgAmount;

            transactionPattern = {
              count: recentTxs.length,
              detectedFrequency,
              averageAmount: avgAmount,
              averageIntervalDays: avgInterval,
              // New fields for accurate monthly calculation
              trueMonthlyAverage: Math.round(trueMonthlyAverage * 100) / 100,
              totalAmount: amounts.reduce((sum, a) => sum + a, 0),
              sumForAverage: Math.round(sumForAverage * 100) / 100,
              monthsCovered: Math.round(monthsCovered * 100) / 100,
              paymentTiming, // 'ADVANCE' or 'ARREARS'
              dateRange: {
                first: sortedDates[0],
                last: sortedDates[sortedDates.length - 1],
              },
            };
          }
        }
      }

      // Check income entries (only for IN transactions)
      if (transaction.direction === 'IN') {
        // Determine if this is a rental/property-related transaction
        const isRentalTransaction = Boolean(
          learnedCategory?.toUpperCase() === 'RENTAL' ||
          learnedCategory?.toUpperCase() === 'RENT' ||
          transaction.categoryLevel1?.toUpperCase() === 'RENTAL' ||
          transaction.categoryLevel1?.toUpperCase() === 'RENT' ||
          merchantName?.toLowerCase().includes('rent') ||
          merchantName?.toLowerCase().includes('trust') ||
          merchantName?.toLowerCase().includes('property')
        );

        for (const income of incomeEntries) {
          const nameText = income.name.toLowerCase();
          const similarity = calculateSimilarity(searchText, nameText);
          const effectiveAmount = income.netAmount || income.amount;
          const amountDiff = Math.abs(txAmount - effectiveAmount);
          const amountDiffPercent = effectiveAmount > 0 ? amountDiff / effectiveAmount : 1;
          const amountMatch = amountDiff < 1 || amountDiffPercent < 0.05;

          // Check if the income type matches the predicted/learned category
          const mappedIncomeCategory = learnedCategory || transaction.categoryLevel1;
          const categoryMatch = Boolean(
            mappedIncomeCategory &&
            (income.type?.toUpperCase() === mappedIncomeCategory.toUpperCase() ||
             (mappedIncomeCategory.toUpperCase() === 'RENTAL' && income.type?.toUpperCase() === 'RENTAL') ||
             (mappedIncomeCategory.toUpperCase() === 'RENT' && income.type?.toUpperCase() === 'RENTAL'))
          );

          // Check if this income entry is property-linked (rental income from a property)
          const isPropertyLinkedRental = Boolean(
            income.propertyId && income.type?.toUpperCase() === 'RENTAL'
          );

          // Get the property name if linked
          const linkedProperty = income.propertyId
            ? properties.find((p: { id: string; name: string }) => p.id === income.propertyId)
            : null;

          // Check if this is any kind of rental income (type RENTAL or property-linked)
          const isRentalIncome = Boolean(
            income.type?.toUpperCase() === 'RENTAL' || income.propertyId
          );

          // Include if:
          // 1. Name matches (similarity > 0.3)
          // 2. Amount matches
          // 3. Category matches
          // 4. For rental transactions: include ALL rental income entries so user can pick the right property
          const shouldInclude = similarity > 0.3 || amountMatch || categoryMatch ||
            (isRentalTransaction && isRentalIncome);

          if (shouldInclude) {
            // Calculate confidence with strong boosts for property-linked entries
            let confidence = similarity * (amountMatch ? 1.5 : 1);

            if (categoryMatch) {
              confidence += 1.0; // Strong boost for matching category
            }

            // Property-linked rental income gets highest priority for rental transactions
            if (isRentalTransaction && isPropertyLinkedRental) {
              confidence += 2.0; // Very strong boost - property-linked rentals should be top suggestions
            }

            // All rental income entries get a boost for rental transactions
            if (isRentalTransaction && isRentalIncome) {
              confidence += 0.5; // Ensure all rental options appear
            }

            matches.push({
              id: income.id,
              name: income.name,
              type: 'income',
              category: income.type,
              amount: effectiveAmount,
              frequency: income.frequency,
              confidence,
              amountMatch,
              amountDiff,
              propertyId: income.propertyId,
              propertyName: linkedProperty?.name || null,
              budgetedAmount: income.budgetedAmount,
              lastReconciled: income.lastReconciled,
              categoryMatch,
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
          const amountDiffPercent = expense.amount > 0 ? amountDiff / expense.amount : 1;
          const amountMatch = amountDiff < 1 || amountDiffPercent < 0.05;

          // Check if the expense category matches the predicted category
          const categoryMatch = Boolean(mappedCategory && expense.category === mappedCategory);

          // Include if name matches, amount matches, OR category matches
          if (similarity > 0.3 || amountMatch || categoryMatch) {
            // Boost confidence for category matches
            let confidence = similarity * (amountMatch ? 1.5 : 1);
            if (categoryMatch) {
              confidence += 0.5; // Boost for matching predicted category
            }

            // Phase 30: Determine reconciliation recommendation
            let reconciliationRecommendation: 'update_amount' | 'link_only' | 'create_new' = 'link_only';
            if (amountDiffPercent > 0.05 && amountDiffPercent <= 0.50) {
              reconciliationRecommendation = 'update_amount';
            } else if (amountDiffPercent > 0.50) {
              reconciliationRecommendation = 'create_new';
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
              propertyId: expense.propertyId,
              budgetedAmount: expense.budgetedAmount,
              lastReconciled: expense.lastReconciled,
              reconciliationRecommendation,
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

      // Phase 51.2 — Transaction Resolution Precedence: BEFORE offering merchant
      // categorisation, check the user's own loans + accounts. A txn that is
      // really a loan repayment or an internal transfer must be surfaced as such
      // (and must NOT be batch-grouped with same-description payments to OTHER
      // loans — the bug Reza hit). Best-effort; a failure degrades to no match.
      let resolution = { loanRepayments: [], transfers: [] } as Awaited<
        ReturnType<typeof resolveTransactionMatches>
      >;
      try {
        resolution = await resolveTransactionMatches(userId, transactionId);
      } catch {
        // non-fatal — fall through to ordinary categorisation suggestions
      }
      const hasResolution =
        resolution.loanRepayments.length > 0 || resolution.transfers.length > 0;

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
        // Phase 51.2 — structural matches (loan repayment / transfer) take
        // precedence; the dialog surfaces these above categorisation.
        resolution,
        suggestedMatches: matches.slice(0, 10), // Increased to show all rental property options
        // Suggested category for creating new expenses based on transaction prediction or learned mapping
        suggestedCategory: learnedCategory || mappedCategory || kbSuggestedCategory,
        // Learned category from previous user categorizations
        learnedCategory,
        // Same-vendor batch — SUPPRESSED when this txn resolves to a loan
        // repayment / transfer (never batch a repayment as an expense, and never
        // group repayments across different loans).
        sameVendorTransactions: hasResolution ? [] : sameVendorTransactions,
        // Phase 30: Transaction pattern analysis for reconciliation
        transactionPattern,
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
