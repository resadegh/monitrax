/**
 * Phase 16: Report Context Builder
 * Fetches and normalizes data from GRDCS for report generation
 */

import { prisma } from '@/lib/db';
import type {
  ReportContext,
  ReportType,
  PropertyReportData,
  LoanReportData,
  AccountReportData,
  InvestmentReportData,
  IncomeReportData,
  ExpenseReportData,
  DepreciationReportData,
} from './types';

// ============================================================================
// Context Builder
// ============================================================================

export async function buildReportContext(
  userId: string,
  reportType: ReportType,
  periodStart?: Date,
  periodEnd?: Date
): Promise<ReportContext> {
  const now = new Date();
  const start = periodStart || new Date(now.getFullYear(), 0, 1); // Default: start of year
  const end = periodEnd || now;

  // Fetch base counts and summary data
  const [
    propertiesCount,
    loansCount,
    accountsCount,
    investmentsCount,
    incomesCount,
    expensesCount,
    depreciationCount,
  ] = await Promise.all([
    prisma.property.count({ where: { userId } }),
    prisma.loan.count({ where: { userId } }),
    prisma.account.count({ where: { userId } }),
    prisma.investmentAccount.count({ where: { userId } }),
    prisma.income.count({ where: { userId } }),
    prisma.expense.count({ where: { userId } }),
    prisma.depreciationSchedule.count({ where: { property: { userId } } }),
  ]);

  // Calculate financial summary
  const financialSummary = await calculateFinancialSummary(userId);

  // Build base context
  const context: ReportContext = {
    userId,
    periodStart: start,
    periodEnd: end,
    ...financialSummary,
    counts: {
      properties: propertiesCount,
      loans: loansCount,
      accounts: accountsCount,
      investments: investmentsCount,
      incomes: incomesCount,
      expenses: expensesCount,
      depreciationSchedules: depreciationCount,
    },
  };

  // Load detailed data based on report type
  switch (reportType) {
    case 'financial-overview':
      context.properties = await fetchPropertyData(userId);
      context.loans = await fetchLoanData(userId);
      context.accounts = await fetchAccountData(userId);
      context.investments = await fetchInvestmentData(userId);
      break;

    case 'income-expense':
      context.incomes = await fetchIncomeData(userId);
      context.expenses = await fetchExpenseData(userId);
      break;

    case 'loan-debt':
      context.loans = await fetchLoanData(userId);
      break;

    case 'property-portfolio':
      context.properties = await fetchPropertyData(userId);
      context.depreciationSchedules = await fetchDepreciationData(userId);
      break;

    case 'investment':
      context.investments = await fetchInvestmentData(userId);
      break;

    case 'tax-time':
      context.incomes = await fetchIncomeData(userId);
      context.expenses = await fetchExpenseData(userId);
      context.properties = await fetchPropertyData(userId);
      context.depreciationSchedules = await fetchDepreciationData(userId);
      break;
  }

  return context;
}

// ============================================================================
// Financial Summary Calculator
// ============================================================================

async function calculateFinancialSummary(userId: string) {
  // Fetch all required data
  const [properties, loans, accounts, investmentAccounts] = await Promise.all([
    prisma.property.findMany({
      where: { userId },
      select: { currentValue: true },
    }),
    prisma.loan.findMany({
      where: { userId },
      select: { principal: true },
    }),
    prisma.account.findMany({
      where: { userId },
      select: { currentBalance: true },
    }),
    prisma.investmentAccount.findMany({
      where: { userId },
      include: { holdings: { select: { units: true, averagePrice: true } } },
    }),
  ]);

  // Calculate totals
  let propertyValue = 0;
  for (const p of properties) {
    propertyValue += p.currentValue || 0;
  }

  let accountBalances = 0;
  for (const a of accounts) {
    accountBalances += a.currentBalance || 0;
  }

  let investmentValue = 0;
  for (const acc of investmentAccounts) {
    for (const h of acc.holdings) {
      investmentValue += h.averagePrice * h.units;
    }
  }

  const totalAssets = propertyValue + accountBalances + investmentValue;

  let totalLiabilities = 0;
  for (const l of loans) {
    totalLiabilities += l.principal || 0;
  }
  const netWorth = totalAssets - totalLiabilities;

  // Simple cashflow runway calculation (months of expenses covered by liquid assets)
  const liquidAssets = accountBalances + investmentValue;
  const monthlyExpenses = await calculateMonthlyExpenses(userId);
  const cashflowRunway = monthlyExpenses > 0 ? Math.round(liquidAssets / monthlyExpenses) : 999;

  // Simple health score (0-100)
  const healthScore = calculateHealthScore(netWorth, totalLiabilities, cashflowRunway);

  return {
    netWorth,
    totalAssets,
    totalLiabilities,
    cashflowRunway,
    healthScore,
  };
}

async function calculateMonthlyExpenses(userId: string): Promise<number> {
  const expenses = await prisma.expense.findMany({
    where: { userId },
    select: { amount: true, frequency: true },
  });

  let total = 0;
  for (const e of expenses) {
    total += convertToMonthly(e.amount, e.frequency);
  }
  return total;
}

function convertToMonthly(amount: number, frequency: string): number {
  switch (frequency.toUpperCase()) {
    case 'WEEKLY':
      return amount * 52 / 12;
    case 'FORTNIGHTLY':
      return amount * 26 / 12;
    case 'MONTHLY':
      return amount;
    case 'QUARTERLY':
      return amount / 3;
    case 'ANNUALLY':
    case 'YEARLY':
      return amount / 12;
    default:
      return amount;
  }
}

function calculateHealthScore(
  netWorth: number,
  totalLiabilities: number,
  cashflowRunway: number
): number {
  let score = 50; // Base score

  // Net worth contribution (up to 25 points)
  if (netWorth > 1000000) score += 25;
  else if (netWorth > 500000) score += 20;
  else if (netWorth > 100000) score += 15;
  else if (netWorth > 0) score += 10;
  else score -= 10;

  // Debt ratio contribution (up to 15 points)
  const debtRatio = totalLiabilities > 0 && netWorth > 0
    ? totalLiabilities / (netWorth + totalLiabilities)
    : 0;
  if (debtRatio < 0.3) score += 15;
  else if (debtRatio < 0.5) score += 10;
  else if (debtRatio < 0.7) score += 5;
  else score -= 5;

  // Cashflow runway contribution (up to 10 points)
  if (cashflowRunway >= 12) score += 10;
  else if (cashflowRunway >= 6) score += 5;
  else if (cashflowRunway >= 3) score += 2;

  return Math.max(0, Math.min(100, score));
}

// ============================================================================
// Data Fetchers
// ============================================================================

async function fetchPropertyData(userId: string): Promise<PropertyReportData[]> {
  const properties = await prisma.property.findMany({
    where: { userId },
    include: {
      loans: { select: { principal: true } },
      income: { select: { id: true } },
      expenses: { select: { id: true } },
      depreciationSchedules: { select: { rate: true, cost: true, method: true, category: true } },
    },
  });

  const results: PropertyReportData[] = [];

  for (const p of properties) {
    let totalLoanBalance = 0;
    for (const l of p.loans) {
      totalLoanBalance += l.principal || 0;
    }

    const equity = (p.currentValue || 0) - totalLoanBalance;
    const lvr = p.currentValue && p.currentValue > 0
      ? (totalLoanBalance / p.currentValue) * 100
      : 0;

    let annualDepreciation = 0;
    for (const d of p.depreciationSchedules) {
      const rate = d.rate / 100;
      if (d.method === 'DIMINISHING_VALUE') {
        annualDepreciation += d.cost * rate * 2;
      } else {
        annualDepreciation += d.cost * rate;
      }
    }

    results.push({
      id: p.id,
      name: p.name,
      address: p.address,
      type: p.type,
      purchasePrice: p.purchasePrice || 0,
      purchaseDate: p.purchaseDate,
      currentValue: p.currentValue || 0,
      equity,
      lvr: Math.round(lvr * 10) / 10,
      linkedLoansCount: p.loans.length,
      linkedIncomesCount: p.income.length,
      linkedExpensesCount: p.expenses.length,
      annualDepreciation: Math.round(annualDepreciation),
      rentalYield: null,
    });
  }

  return results;
}

async function fetchLoanData(userId: string): Promise<LoanReportData[]> {
  const loans = await prisma.loan.findMany({
    where: { userId },
    include: {
      property: { select: { name: true } },
    },
  });

  const results: LoanReportData[] = [];
  for (const l of loans) {
    results.push({
      id: l.id,
      name: l.name,
      type: l.type,
      lender: null, // Not in schema
      principal: l.principal,
      currentBalance: l.principal, // principal is the current balance
      interestRate: l.interestRateAnnual,
      rateType: l.rateType,
      monthlyRepayment: l.minRepayment || 0,
      remainingTerm: l.termMonthsRemaining,
      linkedPropertyName: l.property?.name || null,
    });
  }
  return results;
}

async function fetchAccountData(userId: string): Promise<AccountReportData[]> {
  const accounts = await prisma.account.findMany({
    where: { userId },
  });

  const results: AccountReportData[] = [];
  for (const a of accounts) {
    results.push({
      id: a.id,
      name: a.name,
      type: a.type,
      institution: a.institution,
      balance: a.currentBalance || 0,
      interestRate: a.interestRate,
    });
  }
  return results;
}

async function fetchInvestmentData(userId: string): Promise<InvestmentReportData[]> {
  const investmentAccounts = await prisma.investmentAccount.findMany({
    where: { userId },
    include: {
      holdings: true,
    },
  });

  const investments: InvestmentReportData[] = [];
  for (const account of investmentAccounts) {
    for (const holding of account.holdings) {
      // Note: Schema has averagePrice only, no currentPrice for market value
      const costBasis = holding.units * holding.averagePrice;
      const currentValue = costBasis; // No market price available

      investments.push({
        id: holding.id,
        accountName: account.name,
        symbol: holding.ticker,
        name: holding.ticker, // Schema doesn't have name field
        units: holding.units,
        averageCost: holding.averagePrice,
        currentPrice: holding.averagePrice, // Using averagePrice as proxy
        currentValue,
        totalGainLoss: 0, // Cannot calculate without market price
        totalGainLossPercent: 0,
        sector: undefined,
      });
    }
  }

  return investments;
}

async function fetchIncomeData(userId: string): Promise<IncomeReportData[]> {
  const incomes = await prisma.income.findMany({
    where: { userId },
    include: {
      property: { select: { name: true } },
    },
  });

  const results: IncomeReportData[] = [];
  for (const i of incomes) {
    results.push({
      id: i.id,
      source: i.name,
      category: i.type,
      amount: i.amount,
      frequency: i.frequency,
      annualAmount: calculateAnnualAmount(i.amount, i.frequency),
      linkedPropertyName: i.property?.name || null,
      isTaxable: i.isTaxable,
    });
  }
  return results;
}

async function fetchExpenseData(userId: string): Promise<ExpenseReportData[]> {
  const expenses = await prisma.expense.findMany({
    where: { userId },
    include: {
      property: { select: { name: true } },
    },
  });

  const results: ExpenseReportData[] = [];
  for (const e of expenses) {
    results.push({
      id: e.id,
      description: e.name,
      category: e.category,
      amount: e.amount,
      frequency: e.frequency,
      annualAmount: calculateAnnualAmount(e.amount, e.frequency),
      linkedPropertyName: e.property?.name || null,
      isDeductible: e.isTaxDeductible,
    });
  }
  return results;
}

async function fetchDepreciationData(userId: string): Promise<DepreciationReportData[]> {
  const schedules = await prisma.depreciationSchedule.findMany({
    where: { property: { userId } },
    include: {
      property: { select: { name: true } },
    },
  });

  const now = new Date();
  const results: DepreciationReportData[] = [];

  for (const d of schedules) {
    const rate = d.rate / 100;
    const totalYears = 100 / d.rate;
    const yearsElapsed = (now.getTime() - new Date(d.startDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const remainingYears = Math.max(0, totalYears - yearsElapsed);

    // Calculate annual deduction
    let annualDeduction: number;
    if (d.method === 'DIMINISHING_VALUE' && d.category === 'DIV40') {
      annualDeduction = d.cost * rate * 2;
    } else {
      annualDeduction = d.cost * rate;
    }

    // Calculate remaining value
    let remainingValue: number;
    if (d.method === 'PRIME_COST') {
      remainingValue = d.cost * (remainingYears / totalYears);
    } else {
      const effectiveRate = rate * (d.category === 'DIV40' ? 2 : 1);
      remainingValue = d.cost * Math.pow(1 - effectiveRate, yearsElapsed);
    }

    results.push({
      id: d.id,
      assetName: d.assetName,
      propertyName: d.property.name,
      category: d.category,
      method: d.method,
      cost: d.cost,
      rate: d.rate,
      startDate: d.startDate,
      annualDeduction: Math.round(annualDeduction),
      remainingYears: Math.round(remainingYears * 10) / 10,
      remainingValue: Math.round(remainingValue),
    });
  }

  return results;
}

function calculateAnnualAmount(amount: number, frequency: string): number {
  switch (frequency.toUpperCase()) {
    case 'WEEKLY':
      return amount * 52;
    case 'FORTNIGHTLY':
      return amount * 26;
    case 'MONTHLY':
      return amount * 12;
    case 'QUARTERLY':
      return amount * 4;
    case 'ANNUALLY':
    case 'YEARLY':
      return amount;
    default:
      return amount * 12;
  }
}
