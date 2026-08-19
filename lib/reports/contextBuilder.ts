/**
 * Phase 16: Report Context Builder
 * Fetches and normalizes data from GRDCS for report generation
 */

import { prisma } from '@/lib/db';
import { sumHoldingsMarketValue, sumLoanBalances } from '@/lib/calculations/assetValuation';
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
  EntityReportData,
} from './types';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { toAnnual } from '@/lib/utils/frequencies';
import { calculateMonthlyAverage } from '@/lib/calculations/actualsMonthlyAverage';
import { calculateEquity, calculateLVR } from '@/lib/utils/calculations';
import { calculateDepreciationAnnual } from '@/lib/depreciation';
import type { Frequency } from '@/lib/types/prisma-enums';
import { UNATTRIBUTED_ENTITY_ID } from '@/lib/calculations/entityBreakdown';
import { ENTITY_TYPE_LABELS } from '@/lib/entities/entityTypeCatalog';
import { assembleEntityTaxFacts } from '@/lib/services/entityTaxFactsAssembler';
import { calculateEntityTaxPositionDecimal } from '@/lib/tax-engine/entity/entityTaxRouter';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import type { LegalEntityType } from '@prisma/client';

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
      // Phase 47 E1 — per-entity breakdown (with tax status).
      context.entityBreakdown = await fetchEntityBreakdown(userId);
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
      // Phase 47 E1 — per-entity breakdown (with tax status).
      context.entityBreakdown = await fetchEntityBreakdown(userId);
      break;
  }

  return context;
}

// ============================================================================
// Per-Entity Breakdown (Phase 47 Stage E1)
// ============================================================================

/**
 * Build the per-entity report rows. Net position comes from the canonical
 * master snapshot `byEntity` (SSOT — same engines the dashboard uses); the
 * tax status comes from the per-entity tax engine and surfaces honest
 * caveats (`uncomputed` + assembler notes, incl. AD-2 ownership flags),
 * never a fabricated tax dollar. Entities without holdings are already
 * omitted by `byEntity`. The unattributed sentinel bucket is skipped — it
 * has no entity to compute a tax position for.
 */
async function fetchEntityBreakdown(userId: string): Promise<EntityReportData[]> {
  const snapshot = await getMasterFinancialSnapshot(userId);
  const positions = snapshot.byEntity.filter((p) => p.entityId !== UNATTRIBUTED_ENTITY_ID);
  if (positions.length === 0) return [];

  const fyConfig = getCurrentTaxYearConfig();
  const fy = { financialYear: fyConfig.financialYear, label: fyConfig.label };

  return Promise.all(
    positions.map(async (p): Promise<EntityReportData> => {
      const facts = await assembleEntityTaxFacts(userId, p.entityId, fy);
      let tax: EntityReportData['tax'] = null;
      if (facts) {
        const position = calculateEntityTaxPositionDecimal(facts);
        tax = {
          computed: position.uncomputed.length === 0,
          caveats: position.uncomputed.map((u) => ({ id: u.id, rationale: u.rationale })),
        };
      }
      return {
        entityId: p.entityId,
        entityName: p.entityName,
        entityType: p.entityType,
        entityTypeLabel:
          ENTITY_TYPE_LABELS[p.entityType as LegalEntityType] ?? p.entityType,
        netWorth: p.netWorth,
        assets: p.assets,
        liabilities: p.liabilities,
        monthlyCashflow: p.monthlyCashflow,
        holdingsCount: p.counts.holdings,
        tax,
      };
    }),
  );
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
      include: { holdings: { select: { units: true, currentPrice: true, averagePrice: true } } },
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

  // Phase 3 fix PR1 (audit L1-2): value holdings by the canonical net-worth
  // basis (units × live price) via the shared helper, not cost basis.
  let investmentValue = 0;
  for (const acc of investmentAccounts) {
    investmentValue += sumHoldingsMarketValue(acc.holdings);
  }

  const totalAssets = propertyValue + accountBalances + investmentValue;

  // Phase 3 fix PR1 (audit L1-2): canonical loan-balance basis (`Loan.principal`
  // is the current balance) via the shared helper.
  const totalLiabilities = sumLoanBalances(loans);
  const netWorth = totalAssets - totalLiabilities;

  // Cashflow runway (months of burn covered by liquid assets).
  // P0 fix (2026-06-23, audit domain B): must use REAL burn, not declared
  // expenses. Previously divided by `calculateMonthlyExpenses` (a declared
  // `prisma.expense` reduce) → overstated runway when actual spend > declared,
  // in a report a user hands an adviser. Use the canonical snapshot's actual
  // avg monthly outflow (all OUT txns incl. loans + uncategorised) when
  // transactions exist; fall back to declared only when there are none.
  const liquidAssets = accountBalances + investmentValue;
  const runwaySnapshot = await getMasterFinancialSnapshot(userId);
  const monthlyBurn = runwaySnapshot.quickMetrics.hasActualData
    ? runwaySnapshot.quickMetrics.actualAvgMonthlyOutflow
    : await calculateMonthlyExpenses(userId);
  const cashflowRunway = monthlyBurn > 0 ? Math.round(liquidAssets / monthlyBurn) : 999;

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
    case 'HALF_YEARLY':
      return amount / 6;
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
      depreciationSchedules: {
        select: { id: true, assetName: true, rate: true, cost: true, method: true, category: true, startDate: true },
      },
    },
  });

  const results: PropertyReportData[] = [];

  for (const p of properties) {
    let totalLoanBalance = 0;
    for (const l of p.loans) {
      totalLoanBalance += l.principal || 0;
    }

    // MON-164/MON-165: equity, LVR and depreciation come from the ONE
    // canonical producer each (§12.2.1) — the pack must never re-derive.
    // The old inline depreciation loop was first-year-only AND dropped the
    // DIV43 guard (a DIV43 diminishing-value schedule was doubled here and
    // nowhere else).
    const equity = calculateEquity(p.currentValue || 0, totalLoanBalance);
    const lvr = calculateLVR(totalLoanBalance, p.currentValue || 0);

    let annualDepreciation = 0;
    for (const d of p.depreciationSchedules) {
      annualDepreciation += calculateDepreciationAnnual(d).annualDepreciation;
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

/**
 * MON-164 — per-row ANNUAL contribution, canonical (§19.1 actuals-first):
 *   - one-off rows (isRecurring === false) count ONCE at their amount —
 *     mirrors the salaryBanked oneOffAmount convention and MON-094's
 *     "genuine one-offs count once"; never annualised.
 *   - recurring rows with ≥1 reconciled transaction: the ONE modelled
 *     day-span producer `calculateMonthlyAverage` × 12 (the same figure
 *     the income/expenses routes attach as monthlyAverageActual).
 *   - recurring rows with no transactions: declared toAnnual fallback,
 *     labelled by callers as the plan.
 * The old code annualised every row's DECLARED amount unconditionally —
 * no actuals, no one-off gate — feeding the pack figures wrong by the
 * full frequency ratio (worked example −54%) and inflating deductions
 * ×12 on one-off rows (the MON-037 battery class).
 */
export function annualContribution(
  row: { amount: number; frequency: string; isRecurring: boolean | null },
  transactions: Array<{ date: Date; amount: number }> | undefined,
  isAdvance: boolean,
): number {
  if (row.isRecurring === false) return row.amount; // once, never × frequency
  if (transactions && transactions.length > 0) {
    const monthly = calculateMonthlyAverage(transactions, isAdvance);
    if (monthly !== null) return monthly * 12;
  }
  return toAnnual(row.amount, row.frequency as Frequency);
}

function groupTxByKey(
  rows: Array<{ date: Date; amount: number; key: string | null }>,
): Map<string, Array<{ date: Date; amount: number }>> {
  const map = new Map<string, Array<{ date: Date; amount: number }>>();
  for (const r of rows) {
    if (!r.key) continue;
    const list = map.get(r.key) ?? [];
    list.push({ date: r.date, amount: r.amount });
    map.set(r.key, list);
  }
  return map;
}

async function fetchIncomeData(userId: string): Promise<IncomeReportData[]> {
  const [incomes, linkedTx] = await Promise.all([
    prisma.income.findMany({
      where: { userId },
      include: {
        property: { select: { name: true } },
      },
    }),
    // Same join the income route uses (Phase 30) — ALL reconciled
    // transactions per stream, the evidence the report must not ignore.
    prisma.unifiedTransaction.findMany({
      where: { userId, incomeId: { not: null } },
      select: { date: true, amount: true, incomeId: true },
    }),
  ]);
  const txByIncome = groupTxByKey(
    linkedTx.map((t) => ({ date: t.date, amount: t.amount, key: t.incomeId })),
  );

  const results: IncomeReportData[] = [];
  for (const i of incomes) {
    // Rent is paid in ADVANCE (same rule as the income route / MON-089).
    const isAdvance = i.type === 'RENTAL' || i.type === 'RENT' || Boolean(i.propertyId);
    results.push({
      id: i.id,
      source: i.name,
      category: i.type,
      amount: i.amount,
      frequency: i.frequency,
      annualAmount: annualContribution(i, txByIncome.get(i.id), isAdvance),
      linkedPropertyName: i.property?.name || null,
      isTaxable: i.isTaxable,
    });
  }
  return results;
}

async function fetchExpenseData(userId: string): Promise<ExpenseReportData[]> {
  const [expenses, linkedTx] = await Promise.all([
    prisma.expense.findMany({
      where: { userId },
      include: {
        property: { select: { name: true } },
      },
    }),
    prisma.unifiedTransaction.findMany({
      where: { userId, expenseId: { not: null } },
      select: { date: true, amount: true, expenseId: true },
    }),
  ]);
  const txByExpense = groupTxByKey(
    linkedTx.map((t) => ({ date: t.date, amount: t.amount, key: t.expenseId })),
  );

  const results: ExpenseReportData[] = [];
  for (const e of expenses) {
    results.push({
      id: e.id,
      description: e.name,
      category: e.category,
      amount: e.amount,
      frequency: e.frequency,
      annualAmount: annualContribution(e, txByExpense.get(e.id), false),
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

  const results: DepreciationReportData[] = [];

  for (const d of schedules) {
    // MON-165: the ONE canonical engine (§12.2.1). The old inline math was
    // first-year-only for diminishing-value schedules (cost × rate × 2,
    // yearsElapsed ignored) — 1.95× over-claim on a 3-year-old DV DIV40
    // asset vs the written-down-value method the property page shows.
    const dep = calculateDepreciationAnnual(d);

    results.push({
      id: d.id,
      assetName: d.assetName,
      propertyName: d.property.name,
      category: d.category,
      method: d.method,
      cost: d.cost,
      rate: d.rate,
      startDate: d.startDate,
      annualDeduction: Math.round(dep.annualDepreciation),
      remainingYears: Math.round(dep.yearsRemaining * 10) / 10,
      remainingValue: Math.round(dep.currentWrittenDownValue),
    });
  }

  return results;
}
