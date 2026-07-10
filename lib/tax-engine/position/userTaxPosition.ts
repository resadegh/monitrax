/**
 * getUserTaxPosition — the ONE user-level tax-position source (MON-020).
 *
 * Before this, two surfaces computed a user's annual tax independently:
 *   • My Guide / CFO (`calculateCFOTaxInsights`) → `calculateTaxPosition(...)`
 *     — FULL position: assessable income by type, all deductions, Medicare,
 *     offsets, PAYG.
 *   • /cashflow (`buildTaxOptimization`) → `calculateIncomeTax(gross − adHoc).taxPayable`
 *     — income tax ONLY (no Medicare), with an ad-hoc, much smaller deduction set.
 * So the same user saw two different tax numbers ($153,278 on /cashflow vs
 * $104,323 in My Guide) — a §12.2.1 duplicate-source defect.
 *
 * This fetches the user's tax data ONCE, assembles the canonical inputs, and
 * calls the ONE reform-aware engine `calculateTaxPosition` (§12.14 compliance is
 * inherited — no tax math lives here). Every tax surface reads the returned
 * `taxPosition` (Medicare included), so the numbers converge by construction.
 *
 * @see lib/tax-engine/position/taxPositionCalculator.ts (the engine)
 * @see lib/cfo/decisionSupport/taxIntegration.ts (CFO consumer)
 * @see app/api/cashflow/intelligence/route.ts (/cashflow consumer)
 */

import { prisma } from '@/lib/db';
import { calculateTaxPosition, getCurrentFinancialYear } from '@/lib/tax-engine';
import type {
  IncomeItem,
  ExpenseItem,
  DepreciationItem,
} from './taxPositionCalculator';
import type { TaxPositionResult } from '../types';

export interface UserTaxPositionBundle {
  /** The canonical tax position — the single source every tax surface reads. */
  taxPosition: TaxPositionResult;
  financialYear: string;
  /** Raw fetched rows, reused by the CFO extras (CGT, negative gearing, risks)
   *  so they don't re-fetch. `/cashflow` uses only `taxPosition`. */
  incomes: any[];
  expenses: any[];
  depreciations: any[];
  properties: any[];
  holdings: any[];
  superTotals: { concessional: number; nonConcessional: number };
}

/**
 * Compute a user's canonical tax position (income + deductions + Medicare +
 * offsets + PAYG). One fetch, one assemble, one `calculateTaxPosition` call.
 */
export async function getUserTaxPosition(
  userId: string,
): Promise<UserTaxPositionBundle> {
  const fyInfo = getCurrentFinancialYear();

  const [incomes, expenses, depreciations, superAccounts, holdings] =
    await Promise.all([
      prisma.income.findMany({
        where: { userId },
        include: {
          property: { select: { id: true, name: true } },
          investmentAccount: { select: { id: true, name: true } },
        },
      }),
      prisma.expense.findMany({
        where: { userId },
        include: {
          property: { select: { id: true, name: true } },
          loan: { select: { id: true, name: true } },
        },
      }),
      prisma.depreciationSchedule.findMany({
        where: { property: { userId } },
        include: { property: { select: { id: true, name: true } } },
      }),
      prisma.superannuationAccount.findMany({
        where: { userId },
        select: { concessionalYTD: true, nonConcessionalYTD: true },
      }),
      prisma.investmentHolding.findMany({
        where: { investmentAccount: { userId } },
        include: { investmentAccount: { select: { id: true, name: true } } },
      }),
    ]);

  const properties = await prisma.property.findMany({
    where: { userId },
    include: { income: true, expenses: true, loans: true },
  });

  const incomeItems: IncomeItem[] = incomes.map((income: any) => ({
    id: income.id,
    name: income.name,
    type: income.type,
    amount: income.amount,
    frequency: income.frequency,
    propertyId: income.propertyId || undefined,
    investmentAccountId: income.investmentAccountId || undefined,
    grossAmount: income.grossAmount || undefined,
    paygWithholding: income.paygWithholding || undefined,
    frankingPercentage: income.frankingPercentage || undefined,
    frankingCredits: income.frankingCredits || undefined,
  }));

  const expenseItems: ExpenseItem[] = expenses.map((expense: any) => ({
    id: expense.id,
    name: expense.name,
    category: expense.category,
    amount: expense.amount,
    frequency: expense.frequency,
    isTaxDeductible: expense.isTaxDeductible,
    propertyId: expense.propertyId || undefined,
    loanId: expense.loanId || undefined,
  }));

  const depreciationItems: DepreciationItem[] = depreciations.map((dep: any) => ({
    id: dep.id,
    propertyId: dep.propertyId,
    currentYearDeduction: dep.cost * dep.rate,
    type: dep.category,
  }));

  const superTotals = superAccounts.reduce(
    (acc: { concessional: number; nonConcessional: number }, account: any) => ({
      concessional: acc.concessional + (account.concessionalYTD || 0),
      nonConcessional: acc.nonConcessional + (account.nonConcessionalYTD || 0),
    }),
    { concessional: 0, nonConcessional: 0 },
  );

  const taxPosition = calculateTaxPosition({
    incomes: incomeItems,
    expenses: expenseItems,
    depreciations: depreciationItems,
    superContributions: superTotals,
    financialYear: fyInfo.year,
  });

  return {
    taxPosition,
    financialYear: fyInfo.year,
    incomes,
    expenses,
    depreciations,
    properties,
    holdings,
    superTotals,
  };
}
