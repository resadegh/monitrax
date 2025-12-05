import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import {
  GRDCSLinkedEntity,
  GRDCSMissingLink,
  createLinkedEntity,
  extractPropertyLinks,
  extractLoanLinks,
  extractIncomeLinks,
  extractExpenseLinks,
  extractAccountLinks,
  extractInvestmentAccountLinks,
  extractHoldingLinks,
} from '@/lib/grdcs';
import { calculateTakeHomePay } from '@/lib/cashflow/incomeNormalizer';

// ============================================================================
// SNAPSHOT 2.0 - GRDCS-ENHANCED PORTFOLIO SNAPSHOT
// ============================================================================

// Helper to normalize amount to annual
function normalizeToAnnual(amount: number, frequency: string): number {
  switch (frequency) {
    case 'WEEKLY': return amount * 52;
    case 'FORTNIGHTLY': return amount * 26;
    case 'MONTHLY': return amount * 12;
    case 'QUARTERLY': return amount * 4;
    case 'ANNUAL': return amount;
    default: return amount * 12;
  }
}

// Helper to normalize amount to monthly
function normalizeToMonthly(amount: number, frequency: string): number {
  return normalizeToAnnual(amount, frequency) / 12;
}

// Helper to get net income amount after PAYG for salary types
function getNetIncomeAmount(incomeItem: { amount: number; frequency: string; type: string }): number {
  if (incomeItem.type === 'SALARY') {
    const takeHome = calculateTakeHomePay(
      incomeItem.amount,
      incomeItem.frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
    );
    return normalizeToAnnual(takeHome.netAmount, incomeItem.frequency);
  }
  // For non-salary income, use gross amount (tax calculated at year end)
  return normalizeToAnnual(incomeItem.amount, incomeItem.frequency);
}

// Calculate rental yield
function calculateRentalYield(annualRent: number, propertyValue: number): number {
  if (propertyValue <= 0) return 0;
  return (annualRent / propertyValue) * 100;
}

// Calculate LVR
function calculateLVR(loanBalance: number, propertyValue: number): number {
  if (propertyValue <= 0) return 0;
  return (loanBalance / propertyValue) * 100;
}

// ============================================================================
// LINKAGE HEALTH ENGINE
// ============================================================================

interface RelationalWarning {
  type: 'error' | 'warning' | 'info';
  category: 'orphan' | 'missing_link' | 'inconsistency' | 'completeness';
  entityType: string;
  entityId: string;
  entityName: string;
  message: string;
  suggestedAction?: string;
}

interface LinkageHealth {
  completenessScore: number;
  orphanCount: number;
  missingLinks: GRDCSMissingLink[];
  crossModuleConsistency: number;
  warnings: string[];
  relationalWarnings: RelationalWarning[];
}

interface ModuleCompleteness {
  properties: { count: number; linkedCount: number; score: number };
  loans: { count: number; linkedCount: number; score: number };
  income: { count: number; linkedCount: number; score: number };
  expenses: { count: number; linkedCount: number; score: number };
  accounts: { count: number; linkedCount: number; score: number };
  investmentAccounts: { count: number; linkedCount: number; score: number };
  holdings: { count: number; linkedCount: number; score: number };
  transactions: { count: number; linkedCount: number; score: number };
}

/**
 * Calculate linkage health for the portfolio
 */
function calculateLinkageHealth(
  properties: any[],
  loans: any[],
  income: any[],
  expenses: any[],
  accounts: any[],
  investmentAccounts: any[],
  holdings: any[],
  transactions: any[]
): { health: LinkageHealth; moduleCompleteness: ModuleCompleteness } {
  const warnings: string[] = [];
  const relationalWarnings: RelationalWarning[] = [];
  const allMissingLinks: GRDCSMissingLink[] = [];
  let orphanCount = 0;

  // ============================================================================
  // CANONICAL RELATIONSHIP VALIDATION
  // ============================================================================

  // Rule 1: Loans must link to exactly 1 property
  const orphanedLoans = loans.filter((l: any) => !l.propertyId);
  orphanedLoans.forEach((loan: any) => {
    orphanCount++;
    relationalWarnings.push({
      type: 'warning',
      category: 'orphan',
      entityType: 'loan',
      entityId: loan.id,
      entityName: loan.name,
      message: `Loan "${loan.name}" is not linked to any property`,
      suggestedAction: 'Link this loan to a property for accurate LVR and equity tracking',
    });
    allMissingLinks.push({
      type: 'property',
      reason: `Loan "${loan.name}" has no property linked`,
      suggestedAction: 'Link to a property for accurate LVR calculation',
    });
  });
  if (orphanedLoans.length > 0) {
    warnings.push(`${orphanedLoans.length} loan(s) not linked to any property`);
  }

  // Rule 2: Holdings must link to exactly 1 investment account
  const orphanedHoldings = holdings.filter((h: any) => !h.investmentAccountId);
  orphanedHoldings.forEach((holding: any) => {
    orphanCount++;
    relationalWarnings.push({
      type: 'error',
      category: 'orphan',
      entityType: 'investmentHolding',
      entityId: holding.id,
      entityName: holding.ticker,
      message: `Holding "${holding.ticker}" is not linked to any investment account`,
      suggestedAction: 'Link this holding to an investment account',
    });
    allMissingLinks.push({
      type: 'investmentAccount',
      reason: `Holding "${holding.ticker}" has no account linked`,
      suggestedAction: 'Link to an investment account',
    });
  });
  if (orphanedHoldings.length > 0) {
    warnings.push(`${orphanedHoldings.length} holding(s) not linked to any investment account`);
  }

  // Rule 3: Transactions must link to exactly 1 holding (if applicable)
  const transactionsWithoutHolding = transactions.filter((t: any) =>
    !t.holdingId && ['BUY', 'SELL'].includes(t.type)
  );
  transactionsWithoutHolding.forEach((tx: any) => {
    relationalWarnings.push({
      type: 'warning',
      category: 'missing_link',
      entityType: 'investmentTransaction',
      entityId: tx.id,
      entityName: `${tx.type} transaction`,
      message: `Transaction of type "${tx.type}" is not linked to a holding`,
      suggestedAction: 'Link buy/sell transactions to holdings for accurate cost base tracking',
    });
  });
  if (transactionsWithoutHolding.length > 0) {
    warnings.push(`${transactionsWithoutHolding.length} buy/sell transaction(s) not linked to holdings`);
  }

  // Rule 4: Rental income must link to a property
  const rentalIncomeWithoutProperty = income.filter((i: any) =>
    (i.type === 'RENT' || i.type === 'RENTAL') && !i.propertyId
  );
  rentalIncomeWithoutProperty.forEach((inc: any) => {
    orphanCount++;
    relationalWarnings.push({
      type: 'warning',
      category: 'inconsistency',
      entityType: 'income',
      entityId: inc.id,
      entityName: inc.name,
      message: `Rental income "${inc.name}" is not linked to any property`,
      suggestedAction: 'Link rental income to the corresponding property',
    });
    allMissingLinks.push({
      type: 'property',
      reason: `Rental income "${inc.name}" has no property linked`,
      suggestedAction: 'Link to the property generating this rental income',
    });
  });
  if (rentalIncomeWithoutProperty.length > 0) {
    warnings.push(`${rentalIncomeWithoutProperty.length} rental income(s) not linked to properties`);
  }

  // Rule 5: Property expenses should link to their property or loan
  const propertyExpensesWithoutLink = expenses.filter((e: any) =>
    e.sourceType === 'PROPERTY' && !e.propertyId && !e.loanId
  );
  propertyExpensesWithoutLink.forEach((exp: any) => {
    relationalWarnings.push({
      type: 'warning',
      category: 'missing_link',
      entityType: 'expense',
      entityId: exp.id,
      entityName: exp.name,
      message: `Property expense "${exp.name}" is not linked to any property or loan`,
      suggestedAction: 'Link this expense to the relevant property or loan',
    });
  });
  if (propertyExpensesWithoutLink.length > 0) {
    warnings.push(`${propertyExpensesWithoutLink.length} property expense(s) not linked to properties or loans`);
  }

  // ============================================================================
  // ADDITIONAL RELATIONAL INSIGHTS
  // ============================================================================

  // Properties with no income
  const propertiesWithoutIncome = properties.filter((p: any) =>
    p.type === 'INVESTMENT' && !income.some((i: any) => i.propertyId === p.id)
  );
  propertiesWithoutIncome.forEach((prop: any) => {
    relationalWarnings.push({
      type: 'info',
      category: 'completeness',
      entityType: 'property',
      entityId: prop.id,
      entityName: prop.name,
      message: `Investment property "${prop.name}" has no income linked`,
      suggestedAction: 'Add rental income for accurate cashflow analysis',
    });
  });

  // Properties with no expenses
  const propertiesWithoutExpenses = properties.filter((p: any) =>
    !expenses.some((e: any) => e.propertyId === p.id)
  );
  propertiesWithoutExpenses.forEach((prop: any) => {
    relationalWarnings.push({
      type: 'info',
      category: 'completeness',
      entityType: 'property',
      entityId: prop.id,
      entityName: prop.name,
      message: `Property "${prop.name}" has no expenses linked`,
      suggestedAction: 'Add property expenses for accurate cashflow tracking',
    });
  });

  // Investment accounts with no holdings
  const accountsWithoutHoldings = investmentAccounts.filter((a: any) =>
    !holdings.some((h: any) => h.investmentAccountId === a.id)
  );
  accountsWithoutHoldings.forEach((acc: any) => {
    relationalWarnings.push({
      type: 'info',
      category: 'completeness',
      entityType: 'investmentAccount',
      entityId: acc.id,
      entityName: acc.name,
      message: `Investment account "${acc.name}" has no holdings`,
      suggestedAction: 'Add holdings to track portfolio value',
    });
  });

  // Holdings with no transactions
  const holdingsWithoutTransactions = holdings.filter((h: any) =>
    !transactions.some((t: any) => t.holdingId === h.id)
  );
  holdingsWithoutTransactions.forEach((holding: any) => {
    relationalWarnings.push({
      type: 'info',
      category: 'completeness',
      entityType: 'investmentHolding',
      entityId: holding.id,
      entityName: holding.ticker,
      message: `Holding "${holding.ticker}" has no transactions recorded`,
      suggestedAction: 'Add transactions for accurate cost base tracking',
    });
  });

  // Transactions referencing non-existent holdings
  const holdingIds = new Set(holdings.map((h: any) => h.id));
  const transactionsWithMissingHoldings = transactions.filter((t: any) =>
    t.holdingId && !holdingIds.has(t.holdingId)
  );
  transactionsWithMissingHoldings.forEach((tx: any) => {
    orphanCount++;
    relationalWarnings.push({
      type: 'error',
      category: 'inconsistency',
      entityType: 'investmentTransaction',
      entityId: tx.id,
      entityName: `${tx.type} transaction`,
      message: `Transaction references a holding that no longer exists`,
      suggestedAction: 'Update or remove this orphaned transaction',
    });
  });

  // ============================================================================
  // COMPLETENESS SCORING
  // ============================================================================

  const moduleCompleteness: ModuleCompleteness = {
    properties: {
      count: properties.length,
      linkedCount: properties.filter((p: any) =>
        loans.some((l: any) => l.propertyId === p.id) || income.some((i: any) => i.propertyId === p.id)
      ).length,
      score: properties.length > 0
        ? Math.round((properties.filter((p: any) =>
            loans.some((l: any) => l.propertyId === p.id)
          ).length / properties.length) * 100)
        : 100,
    },
    loans: {
      count: loans.length,
      linkedCount: loans.filter((l: any) => l.propertyId).length,
      score: loans.length > 0
        ? Math.round((loans.filter((l: any) => l.propertyId).length / loans.length) * 100)
        : 100,
    },
    income: {
      count: income.length,
      linkedCount: income.filter((i: any) => i.propertyId || i.investmentAccountId).length,
      score: income.length > 0
        ? Math.round((income.filter((i: any) => i.propertyId || i.investmentAccountId).length / income.length) * 100)
        : 100,
    },
    expenses: {
      count: expenses.length,
      linkedCount: expenses.filter((e: any) => e.propertyId || e.loanId || e.investmentAccountId).length,
      score: expenses.length > 0
        ? Math.round((expenses.filter((e: any) => e.propertyId || e.loanId || e.investmentAccountId).length / expenses.length) * 100)
        : 100,
    },
    accounts: {
      count: accounts.length,
      linkedCount: accounts.filter((a: any) => a.linkedLoanId).length,
      score: 100, // Accounts don't require links
    },
    investmentAccounts: {
      count: investmentAccounts.length,
      linkedCount: investmentAccounts.filter((a: any) => holdings.some((h: any) => h.investmentAccountId === a.id)).length,
      score: investmentAccounts.length > 0
        ? Math.round((investmentAccounts.filter((a: any) =>
            holdings.some((h: any) => h.investmentAccountId === a.id)
          ).length / investmentAccounts.length) * 100)
        : 100,
    },
    holdings: {
      count: holdings.length,
      linkedCount: holdings.filter((h: any) => h.investmentAccountId).length,
      score: holdings.length > 0
        ? Math.round((holdings.filter((h: any) => h.investmentAccountId).length / holdings.length) * 100)
        : 100,
    },
    transactions: {
      count: transactions.length,
      linkedCount: transactions.filter((t: any) => t.holdingId || !['BUY', 'SELL'].includes(t.type)).length,
      score: transactions.length > 0
        ? Math.round((transactions.filter((t: any) =>
            t.holdingId || !['BUY', 'SELL'].includes(t.type)
          ).length / transactions.length) * 100)
        : 100,
    },
  };

  // Calculate overall completeness score (weighted average)
  const weights = {
    properties: 0.2,
    loans: 0.2,
    income: 0.1,
    expenses: 0.1,
    accounts: 0.05,
    investmentAccounts: 0.15,
    holdings: 0.1,
    transactions: 0.1,
  };

  const completenessScore = Math.round(
    moduleCompleteness.properties.score * weights.properties +
    moduleCompleteness.loans.score * weights.loans +
    moduleCompleteness.income.score * weights.income +
    moduleCompleteness.expenses.score * weights.expenses +
    moduleCompleteness.accounts.score * weights.accounts +
    moduleCompleteness.investmentAccounts.score * weights.investmentAccounts +
    moduleCompleteness.holdings.score * weights.holdings +
    moduleCompleteness.transactions.score * weights.transactions
  );

  // Calculate cross-module consistency (based on relationship rules)
  const totalEntities = properties.length + loans.length + income.length + expenses.length +
    accounts.length + investmentAccounts.length + holdings.length + transactions.length;
  const errorCount = relationalWarnings.filter(w => w.type === 'error').length;
  const warningCount = relationalWarnings.filter(w => w.type === 'warning').length;

  const crossModuleConsistency = totalEntities > 0
    ? Math.max(0, Math.round(100 - (errorCount * 10) - (warningCount * 3)))
    : 100;

  return {
    health: {
      completenessScore,
      orphanCount,
      missingLinks: allMissingLinks,
      crossModuleConsistency,
      warnings,
      relationalWarnings,
    },
    moduleCompleteness,
  };
}

// ============================================================================
// SNAPSHOT ROUTE HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const userId = authReq.user!.userId;

      // Fetch all user data in parallel with full relational includes
      const [properties, loans, accounts, income, expenses, investmentAccounts, holdings, transactions, assets] = await Promise.all([
        prisma.property.findMany({
          where: { userId },
          include: {
            loans: {
              include: {
                offsetAccount: true,
              },
            },
            income: true,
            expenses: true,
            depreciationSchedules: true,
          },
        }),
        prisma.loan.findMany({
          where: { userId },
          include: {
            property: true,
            offsetAccount: true,
            expenses: true,
          },
        }),
        prisma.account.findMany({
          where: { userId },
          include: {
            linkedLoan: true,
          },
        }),
        prisma.income.findMany({
          where: { userId },
          include: {
            property: true,
            investmentAccount: true,
          },
        }),
        prisma.expense.findMany({
          where: { userId },
          include: {
            property: true,
            loan: true,
            investmentAccount: true,
            asset: true,
          },
        }),
        prisma.investmentAccount.findMany({
          where: { userId },
          include: {
            holdings: true,
            transactions: true,
            incomes: true,
            expenses: true,
          },
        }),
        prisma.investmentHolding.findMany({
          where: {
            investmentAccount: { userId },
          },
          include: {
            investmentAccount: true,
            transactions: true,
          },
        }),
        prisma.investmentTransaction.findMany({
          where: {
            investmentAccount: { userId },
          },
          include: {
            investmentAccount: true,
            holding: true,
          },
        }),
        // Phase 21: Fetch assets with their expenses
        prisma.asset.findMany({
          where: { userId },
          include: {
            expenses: true,
            valueHistory: {
              orderBy: { valuedAt: 'desc' },
              take: 1,
            },
          },
        }),
      ]);

      // ============================================================================
      // CALCULATE LINKAGE HEALTH
      // ============================================================================
      const { health: linkageHealth, moduleCompleteness } = calculateLinkageHealth(
        properties,
        loans,
        income,
        expenses,
        accounts,
        investmentAccounts,
        holdings,
        transactions
      );

      // ============================================================================
      // CALCULATE FINANCIAL TOTALS
      // ============================================================================
      const totalPropertyValue = properties.reduce((sum: number, p: any) => sum + p.currentValue, 0);
      const totalAccountBalances = accounts.reduce((sum: number, a: any) => sum + a.currentBalance, 0);
      // Investment value = holdings value + cash balances in investment accounts
      const holdingsValue = holdings.reduce((sum: number, h: any) => sum + (h.units * h.averagePrice), 0);
      const investmentCashBalances = investmentAccounts.reduce((sum: number, a: any) => sum + (a.cashBalance || 0), 0);
      const totalInvestmentValue = holdingsValue + investmentCashBalances;
      // Phase 21: Include active assets in total value
      const activeAssets = assets.filter((a: any) => a.status === 'ACTIVE');
      const totalAssetValue = activeAssets.reduce((sum: number, a: any) => sum + a.currentValue, 0);
      const totalAssets = totalPropertyValue + totalAccountBalances + totalInvestmentValue + totalAssetValue;
      const totalLiabilities = loans.reduce((sum: number, l: any) => sum + l.principal, 0);
      const netWorth = totalAssets - totalLiabilities;

      // Cashflow calculations with tax-adjusted income
      // Gross income (before tax)
      const totalAnnualGrossIncome = income.reduce((sum: number, i: any) => sum + normalizeToAnnual(i.amount, i.frequency), 0);
      // Net income (after PAYG for salaries)
      const totalAnnualNetIncome = income.reduce((sum: number, i: any) => sum + getNetIncomeAmount(i), 0);
      // PAYG withholding estimate
      const totalAnnualPaygWithholding = totalAnnualGrossIncome - totalAnnualNetIncome;

      const totalAnnualExpenses = expenses.reduce((sum: number, e: any) => sum + normalizeToAnnual(e.amount, e.frequency), 0);
      // Calculate total loan repayments
      const totalAnnualLoanRepayments = loans.reduce((sum: number, l: any) => {
        return sum + normalizeToAnnual(l.minRepayment || 0, l.repaymentFrequency || 'MONTHLY');
      }, 0);
      // Use NET income for cashflow (what's actually available to spend)
      // Cashflow = Income - Expenses - Loan Repayments
      const monthlyNetCashflow = (totalAnnualNetIncome - totalAnnualExpenses - totalAnnualLoanRepayments) / 12;
      const annualNetCashflow = totalAnnualNetIncome - totalAnnualExpenses - totalAnnualLoanRepayments;
      // Keep gross-based calculation for backward compatibility
      const totalAnnualIncome = totalAnnualNetIncome;

      // ============================================================================
      // GRDCS-ENHANCED PROPERTY SNAPSHOTS
      // ============================================================================
      const propertySnapshots = properties.map((property: any) => {
        const propertyLoans = loans.filter((l: any) => l.propertyId === property.id);
        const totalLoanBalance = propertyLoans.reduce((sum: number, l: any) => sum + l.principal, 0);
        const equity = property.currentValue - totalLoanBalance;
        const lvr = calculateLVR(totalLoanBalance, property.currentValue);

        const propertyIncome = income.filter((i: any) => i.propertyId === property.id);
        const annualRentalIncome = propertyIncome
          .filter((i: any) => i.type === 'RENT' || i.type === 'RENTAL')
          .reduce((sum: number, i: any) => sum + normalizeToAnnual(i.amount, i.frequency), 0);
        const rentalYield = calculateRentalYield(annualRentalIncome, property.currentValue);

        const propertyExpenses = expenses.filter((e: any) => e.propertyId === property.id);
        const annualPropertyExpenses = propertyExpenses.reduce((sum: number, e: any) => sum + normalizeToAnnual(e.amount, e.frequency), 0);

        // Calculate interest (for reference/tax purposes)
        const annualInterest = propertyLoans.reduce((sum: number, l: any) => {
          return sum + (l.principal * l.interestRateAnnual);
        }, 0);

        // Calculate actual loan repayments
        const annualLoanRepayments = propertyLoans.reduce((sum: number, l: any) => {
          return sum + normalizeToAnnual(l.minRepayment || 0, l.repaymentFrequency || 'MONTHLY');
        }, 0);

        // Use actual loan repayments for cashflow (not just interest)
        const propertyCashflow = annualRentalIncome - annualPropertyExpenses - annualLoanRepayments;

        // Extract GRDCS links
        const grdcsLinks = extractPropertyLinks(property);

        return {
          id: property.id,
          name: property.name,
          type: property.type,
          address: property.address,
          marketValue: property.currentValue,
          purchasePrice: property.purchasePrice,
          loans: propertyLoans.map((l: any) => ({
            id: l.id,
            name: l.name,
            principal: l.principal,
            interestRate: l.interestRateAnnual,
            rateType: l.rateType,
            isInterestOnly: l.isInterestOnly,
          })),
          equity,
          lvr: Math.round(lvr * 100) / 100,
          rentalYield: Math.round(rentalYield * 100) / 100,
          cashflow: {
            annualIncome: annualRentalIncome,
            annualExpenses: annualPropertyExpenses,
            annualInterest,
            annualLoanRepayments,
            annualNet: propertyCashflow,
            monthlyNet: propertyCashflow / 12,
          },
          depreciationSchedules: property.depreciationSchedules.length,
          _links: {
            related: grdcsLinks.linked,
          },
          _meta: {
            linkedCount: grdcsLinks.linked.length,
            missingLinks: grdcsLinks.missing,
          },
        };
      });

      // ============================================================================
      // GRDCS-ENHANCED INVESTMENT SNAPSHOTS
      // ============================================================================
      const investmentSnapshots = investmentAccounts.map((acc: any) => {
        const accountHoldings = holdings.filter((h: any) => h.investmentAccountId === acc.id);
        const holdingsTotal = accountHoldings.reduce((sum: number, h: any) => sum + (h.units * h.averagePrice), 0);
        const cashBalance = acc.cashBalance || 0;
        const accountValue = holdingsTotal + cashBalance;
        const grdcsLinks = extractInvestmentAccountLinks(acc);

        return {
          id: acc.id,
          name: acc.name,
          type: acc.type,
          platform: acc.platform,
          currency: acc.currency,
          totalValue: accountValue,
          holdingsValue: holdingsTotal,
          cashBalance: cashBalance,
          openingBalance: acc.openingBalance || 0,
          totalDeposits: acc.totalDeposits || 0,
          totalWithdrawals: acc.totalWithdrawals || 0,
          holdings: accountHoldings.map((h: any) => {
            const holdingLinks = extractHoldingLinks(h);
            return {
              id: h.id,
              ticker: h.ticker,
              type: h.type,
              units: h.units,
              averagePrice: h.averagePrice,
              currentValue: h.units * h.averagePrice,
              frankingPercentage: h.frankingPercentage,
              _links: {
                related: holdingLinks.linked,
              },
              _meta: {
                linkedCount: holdingLinks.linked.length,
                missingLinks: holdingLinks.missing,
              },
            };
          }),
          transactionCount: transactions.filter((t: any) => t.investmentAccountId === acc.id).length,
          _links: {
            related: grdcsLinks.linked,
          },
          _meta: {
            linkedCount: grdcsLinks.linked.length,
            missingLinks: grdcsLinks.missing,
          },
        };
      });

      // ============================================================================
      // GRDCS-ENHANCED LOAN SNAPSHOTS
      // ============================================================================
      const loanSnapshots = loans.map((loan: any) => {
        const grdcsLinks = extractLoanLinks(loan);
        const annualRepayment = normalizeToAnnual(loan.minRepayment || 0, loan.repaymentFrequency || 'MONTHLY');
        return {
          id: loan.id,
          name: loan.name,
          principal: loan.principal,
          interestRate: loan.interestRateAnnual,
          rateType: loan.rateType,
          isInterestOnly: loan.isInterestOnly,
          propertyId: loan.propertyId,
          propertyName: loan.property?.name || null,
          offsetAccountId: loan.offsetAccountId,
          offsetBalance: loan.offsetAccount?.currentBalance || 0,
          minRepayment: loan.minRepayment || 0,
          repaymentFrequency: loan.repaymentFrequency || 'MONTHLY',
          annualRepayment,
          _links: {
            related: grdcsLinks.linked,
          },
          _meta: {
            linkedCount: grdcsLinks.linked.length,
            missingLinks: grdcsLinks.missing,
          },
        };
      });

      // ============================================================================
      // EXPENSE SNAPSHOTS FOR CASHFLOW BREAKDOWN
      // ============================================================================
      const expenseSnapshots = expenses.map((expense: any) => {
        const annualAmount = normalizeToAnnual(expense.amount, expense.frequency);
        return {
          id: expense.id,
          name: expense.name,
          category: expense.category,
          sourceType: expense.sourceType,
          amount: expense.amount,
          frequency: expense.frequency,
          annualAmount,
          propertyId: expense.propertyId,
          propertyName: expense.property?.name || null,
          assetId: expense.assetId,
          assetName: expense.asset?.name || null,
          isTaxDeductible: expense.isTaxDeductible || false,
        };
      }).sort((a: any, b: any) => b.annualAmount - a.annualAmount);

      // ============================================================================
      // ASSET SNAPSHOTS (Phase 21)
      // ============================================================================
      const assetSnapshots = assets.map((asset: any) => {
        // Get expenses linked to this asset
        const assetExpenses = expenses.filter((e: any) => e.assetId === asset.id);
        const annualExpenses = assetExpenses.reduce((sum: number, e: any) => {
          return sum + normalizeToAnnual(e.amount, e.frequency);
        }, 0);

        // Calculate depreciation
        const depreciation = asset.purchasePrice - asset.currentValue;
        const depreciationPercent = asset.purchasePrice > 0
          ? (depreciation / asset.purchasePrice) * 100
          : 0;

        // Calculate total cost of ownership
        const totalExpensesCost = assetExpenses.reduce((sum: number, e: any) => sum + e.amount, 0);
        const totalCostOfOwnership = asset.purchasePrice + totalExpensesCost - (asset.salePrice || 0);

        return {
          id: asset.id,
          name: asset.name,
          type: asset.type,
          status: asset.status,
          currentValue: asset.currentValue,
          purchasePrice: asset.purchasePrice,
          purchaseDate: asset.purchaseDate,
          depreciation,
          depreciationPercent: Math.round(depreciationPercent * 100) / 100,
          expenses: {
            count: assetExpenses.length,
            annualTotal: Math.round(annualExpenses * 100) / 100,
            monthlyTotal: Math.round(annualExpenses / 12 * 100) / 100,
          },
          totalCostOfOwnership: Math.round(totalCostOfOwnership * 100) / 100,
          // Vehicle-specific fields
          vehicleMake: asset.vehicleMake,
          vehicleModel: asset.vehicleModel,
          vehicleYear: asset.vehicleYear,
          vehicleOdometer: asset.vehicleOdometer,
        };
      });

      // ============================================================================
      // INCOME SNAPSHOTS FOR CASHFLOW BREAKDOWN
      // ============================================================================
      const incomeSnapshots = income.map((inc: any) => {
        const grossAnnual = normalizeToAnnual(inc.amount, inc.frequency);
        const netAnnual = getNetIncomeAmount(inc);
        return {
          id: inc.id,
          name: inc.name,
          type: inc.type,
          amount: inc.amount,
          frequency: inc.frequency,
          grossAnnual,
          netAnnual,
          propertyId: inc.propertyId,
          propertyName: inc.property?.name || null,
          isTaxable: inc.isTaxable || true,
        };
      }).sort((a: any, b: any) => b.netAnnual - a.netAnnual);

      // ============================================================================
      // TAX EXPOSURE
      // ============================================================================
      const taxableIncome = income
        .filter((i: any) => i.isTaxable)
        .reduce((sum: number, i: any) => sum + normalizeToAnnual(i.amount, i.frequency), 0);

      const deductibleExpenses = expenses
        .filter((e: any) => e.isTaxDeductible)
        .reduce((sum: number, e: any) => sum + normalizeToAnnual(e.amount, e.frequency), 0);

      // ============================================================================
      // BUILD SNAPSHOT 2.0 RESPONSE
      // ============================================================================
      const snapshot = {
        generatedAt: new Date().toISOString(),
        userId,
        version: '2.0',

        // Summary
        netWorth,
        totalAssets,
        totalLiabilities,

        // Cashflow (using NET income - what's actually available after tax)
        cashflow: {
          grossIncome: Math.round(totalAnnualGrossIncome * 100) / 100,
          netIncome: Math.round(totalAnnualNetIncome * 100) / 100,
          paygWithholding: Math.round(totalAnnualPaygWithholding * 100) / 100,
          totalIncome: Math.round(totalAnnualNetIncome * 100) / 100, // Net income for cashflow
          totalExpenses: Math.round(totalAnnualExpenses * 100) / 100,
          totalLoanRepayments: Math.round(totalAnnualLoanRepayments * 100) / 100,
          monthlyLoanRepayments: Math.round(totalAnnualLoanRepayments / 12 * 100) / 100,
          monthlyNetCashflow: Math.round(monthlyNetCashflow * 100) / 100,
          annualNetCashflow: Math.round(annualNetCashflow * 100) / 100,
          savingsRate: totalAnnualNetIncome > 0
            ? Math.round((annualNetCashflow / totalAnnualNetIncome) * 10000) / 100
            : 0,
          _note: 'Cashflow = Income - Expenses - Loan Repayments. Income figures reflect after-tax (net) amounts for salary income.',
        },

        // Assets breakdown
        assets: {
          properties: {
            count: properties.length,
            totalValue: totalPropertyValue,
          },
          accounts: {
            count: accounts.length,
            totalValue: totalAccountBalances,
          },
          investments: {
            count: investmentAccounts.length,
            totalValue: totalInvestmentValue,
          },
          // Phase 21: Personal assets (vehicles, electronics, etc.)
          personalAssets: {
            count: activeAssets.length,
            totalValue: totalAssetValue,
          },
        },

        // Liabilities breakdown
        liabilities: {
          loans: {
            count: loans.length,
            totalValue: totalLiabilities,
          },
        },

        // Gearing metrics
        gearing: {
          portfolioLVR: totalAssets > 0
            ? Math.round((totalLiabilities / totalAssets) * 10000) / 100
            : 0,
          debtToIncome: totalAnnualIncome > 0
            ? Math.round((totalLiabilities / totalAnnualIncome) * 100) / 100
            : 0,
        },

        // ============================================================================
        // GRDCS LINKAGE HEALTH BLOCK
        // ============================================================================
        linkageHealth: {
          completenessScore: linkageHealth.completenessScore,
          orphanCount: linkageHealth.orphanCount,
          missingLinks: linkageHealth.missingLinks,
          crossModuleConsistency: linkageHealth.crossModuleConsistency,
          warnings: linkageHealth.warnings,
        },

        // Module-level completeness breakdown
        moduleCompleteness,

        // Relational warnings for insights engine
        relationalInsights: {
          totalWarnings: linkageHealth.relationalWarnings.length,
          errors: linkageHealth.relationalWarnings.filter((w: RelationalWarning) => w.type === 'error'),
          warnings: linkageHealth.relationalWarnings.filter((w: RelationalWarning) => w.type === 'warning'),
          info: linkageHealth.relationalWarnings.filter((w: RelationalWarning) => w.type === 'info'),
        },

        // GRDCS-enhanced entity details
        properties: propertySnapshots,
        loans: loanSnapshots,
        expenses: expenseSnapshots,
        income: incomeSnapshots,

        // Investment details
        investments: {
          totalValue: totalInvestmentValue,
          accounts: investmentSnapshots,
        },

        // Phase 21: Personal assets (vehicles, electronics, etc.)
        personalAssets: {
          totalValue: totalAssetValue,
          items: assetSnapshots,
        },

        // Tax exposure (estimates)
        taxExposure: {
          taxableIncome,
          deductibleExpenses,
          estimatedTaxableIncome: taxableIncome - deductibleExpenses,
          projectedTax: 0, // TODO: Calculate using tax engine
          cgtExposure: 0, // TODO: Implement proper CGT calculation
          _note: 'Tax projections are estimates. Use /api/calculate/tax for accurate calculations.',
        },

        // Entity counts for quick reference
        entityCounts: {
          properties: properties.length,
          loans: loans.length,
          income: income.length,
          expenses: expenses.length,
          accounts: accounts.length,
          investmentAccounts: investmentAccounts.length,
          holdings: holdings.length,
          transactions: transactions.length,
          assets: assets.length,
        },
      };

      return NextResponse.json(snapshot);
    } catch (error) {
      console.error('Portfolio snapshot error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
