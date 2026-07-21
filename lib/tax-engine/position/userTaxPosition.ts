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
import {
  listIncomeEarnerEntities,
  type IncomeEarnerEntity,
} from '@/lib/services/legalEntityService';
// MON-026: depreciation via the ONE canonical engine — DepreciationSchedule.rate
// is stored as a PERCENTAGE (validator max(100), writer ×100), so `cost × rate`
// was 100× too high. calculateDepreciationAnnual does the /100 + method-aware math.
import { calculateDepreciationAnnual } from '@/lib/depreciation';
import type {
  IncomeItem,
  ExpenseItem,
  DepreciationItem,
  TaxPositionCalculationInput,
} from './taxPositionCalculator';
import type { TaxPositionResult } from '../types';

export interface UserTaxPositionBundle {
  /** The canonical tax position — the single source every tax surface reads. */
  taxPosition: TaxPositionResult;
  /**
   * MON-020/060: the EXACT assembled engine input that produced `taxPosition`.
   * Any consumer needing a sibling computation over the same position (e.g.
   * the Decimal twin on /api/tax/position) calls its engine with THIS object —
   * never a re-fetched/re-assembled input set. Same engine + same inputs =
   * one number (the F2 same-engine-different-inputs class, FIX_PROTOCOL §1).
   */
  engineInputs: TaxPositionCalculationInput;
  financialYear: string;
  /**
   * MON-076 Part A (2026-07-20): PER-PERSON tax positions — AU income tax is
   * assessed per individual, so a household member's salary must produce
   * THEIR taxable income + tax owing, not inflate the primary's. Computed by
   * PARTITIONING the same fetched rows by owner entity (income/expense rows
   * by `ownerEntityId`; property loans + depreciation follow their property's
   * owner; super by account owner; unattributed → the primary) and running
   * the SAME `calculateTaxPosition` engine per partition — attribution +
   * splitting, no new tax math (§12.14 lineage inherited). The household
   * `taxPosition` above is unchanged (all rows, back-compat) — surfaces that
   * show it must LABEL it as the household roll-up.
   */
  perMember: Array<{
    entityId: string;
    memberName: string;
    isPrimary: boolean;
    taxPosition: TaxPositionResult;
    engineInputs: TaxPositionCalculationInput;
  }>;
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
  /** Optional FY override (e.g. "2025-26"); defaults to the current FY.
   *  Preserves /api/tax/position's ?financialYear= contract (MON-020/060). */
  financialYear?: string | null,
): Promise<UserTaxPositionBundle> {
  const fyInfo = getCurrentFinancialYear();
  const fyYear = financialYear || fyInfo.year;
  // FY bounds for the requested year (same July-1→June-30 convention as
  // getCurrentFinancialYear) — the MON-045 interest window must match the FY
  // the position is computed for, not unconditionally the current one.
  const fyStartYear = Number(fyYear.slice(0, 4));
  const fyBounds = Number.isFinite(fyStartYear)
    ? { start: new Date(fyStartYear, 6, 1), end: new Date(fyStartYear + 1, 5, 30) }
    : { start: fyInfo.startDate, end: fyInfo.endDate };

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
    // MON-045: offsetAccount balance is an input to the auto-derived deductible
    // loan interest ((principal − offset) × rate × fraction, actuals-first).
    include: { income: true, expenses: true, loans: { include: { offsetAccount: true } } },
  });

  // MON-045: actuals-first interest — Σ INTEREST_CHARGED ledger rows this FY,
  // per loan (the same source app/api/loans/[id]/ledger reads). One grouped
  // query for all property loans (§12.10 — no N+1).
  const allPropertyLoanIds = properties.flatMap((p: any) => p.loans.map((l: any) => l.id));
  const interestSums = allPropertyLoanIds.length
    ? await prisma.loanTransaction.groupBy({
        by: ['loanId'],
        where: {
          loanId: { in: allPropertyLoanIds },
          kind: 'INTEREST_CHARGED',
          date: { gte: fyBounds.start, lte: fyBounds.end },
        },
        _sum: { amount: true },
      })
    : [];
  const actualInterestByLoan = new Map<string, number>(
    interestSums.map((r: any) => [r.loanId, Math.abs(r._sum.amount ?? 0)]),
  );

  // MON-045: the engine applies the ONE deductibility rule (type !== 'HOME');
  // the caller just supplies every property loan with its property type.
  const propertyLoanItems = properties.flatMap((p: any) =>
    p.loans.map((l: any) => ({
      id: l.id,
      propertyType: p.type,
      principal: l.principal,
      interestRateAnnual: l.interestRateAnnual,
      offsetBalance: l.offsetAccount?.currentBalance ?? null,
      deductibleFraction: l.deductibleFraction ?? null,
      actualInterestCharged: actualInterestByLoan.get(l.id) ?? null,
    })),
  );

  const incomeItems: IncomeItem[] = incomes.map((income: any) => ({
    id: income.id,
    name: income.name,
    type: income.type,
    amount: income.amount,
    frequency: income.frequency,
    isRecurring: income.isRecurring, // MON-053: one-off income counts once, not ×frequency
    propertyId: income.propertyId || undefined,
    investmentAccountId: income.investmentAccountId || undefined,
    grossAmount: income.grossAmount || undefined,
    paygWithholding: income.paygWithholding || undefined,
    frankingPercentage: income.frankingPercentage || undefined,
    frankingCredits: income.frankingCredits || undefined,
    // MON-094: carry the stored taxCategory so a non-assessable row (ATO
    // refund tagged TAX_EXEMPT) contributes $0 — this was the severed link
    // that let refunds ride into "Other Income" as taxable-for-safety.
    taxCategory: income.taxCategory ?? undefined,
  }));

  const expenseItems: ExpenseItem[] = expenses.map((expense: any) => ({
    id: expense.id,
    name: expense.name,
    category: expense.category,
    amount: expense.amount,
    frequency: expense.frequency,
    isTaxDeductible: expense.isTaxDeductible,
    isRecurring: expense.isRecurring, // MON-037: count one-offs once, not ×frequency
    propertyId: expense.propertyId || undefined,
    loanId: expense.loanId || undefined,
  }));

  const depreciationItems: DepreciationItem[] = depreciations.map((dep: any) => ({
    id: dep.id,
    propertyId: dep.propertyId,
    currentYearDeduction: calculateDepreciationAnnual(dep).annualDepreciation, // MON-026: rate is %, /100 inside
    type: dep.category,
  }));

  const superTotals = superAccounts.reduce(
    (acc: { concessional: number; nonConcessional: number }, account: any) => ({
      concessional: acc.concessional + (account.concessionalYTD || 0),
      nonConcessional: acc.nonConcessional + (account.nonConcessionalYTD || 0),
    }),
    { concessional: 0, nonConcessional: 0 },
  );

  const engineInputs: TaxPositionCalculationInput = {
    incomes: incomeItems,
    expenses: expenseItems,
    depreciations: depreciationItems,
    propertyLoans: propertyLoanItems, // MON-045: auto-derived deductible interest
    superContributions: superTotals,
    financialYear: fyYear,
  };
  const taxPosition = calculateTaxPosition(engineInputs);

  // MON-076 Part A: per-person positions — same rows, same engine, one
  // partition per income-earning household member. Attribution rules in the
  // bundle JSDoc. With a single earner this degenerates to one partition
  // identical in shape to the household position.
  const earners = await listIncomeEarnerEntities(userId);
  const primary = earners.find((e) => e.isPrimary) ?? earners[0];
  const entityToEarner = new Map<string, IncomeEarnerEntity>(
    earners.map((e) => [e.entityId, e]),
  );
  const ownerOf = (ownerEntityId: string | null | undefined): string =>
    (ownerEntityId && entityToEarner.get(ownerEntityId)?.entityId) || primary.entityId;
  const propertyOwner = new Map<string, string>(
    properties.map((p: any) => [p.id, ownerOf(p.ownerEntityId)]),
  );
  const propertyIdOfLoan = new Map<string, string>(
    properties.flatMap((p: any) => p.loans.map((l: any) => [l.id, p.id] as [string, string])),
  );

  const perMember = earners.map((earner) => {
    const mine = (ownerEntityId: string | null | undefined) =>
      ownerOf(ownerEntityId) === earner.entityId;
    // A property-attached item follows its property's owner; a property we
    // can't resolve (or no property) defaults to the primary — same rule as
    // unattributed rows.
    const mineViaProperty = (propertyId: string | null | undefined) =>
      ((propertyId && propertyOwner.get(propertyId)) || primary.entityId) === earner.entityId;

    const memberInputs: TaxPositionCalculationInput = {
      // incomeItems/expenseItems map 1:1 (same order) from incomes/expenses —
      // the index lookup reads the raw row's ownerEntityId.
      incomes: incomeItems.filter((_it, idx) => mine((incomes[idx] as any).ownerEntityId)),
      expenses: expenseItems.filter((_it, idx) => mine((expenses[idx] as any).ownerEntityId)),
      depreciations: depreciationItems.filter((d) => mineViaProperty(d.propertyId)),
      propertyLoans: propertyLoanItems.filter((l: any) =>
        mineViaProperty(propertyIdOfLoan.get(l.id)),
      ),
      superContributions:
        earner.entityId === primary.entityId
          ? superTotals // account-level owner split is a follow-up; today all super YTD sits with the primary
          : { concessional: 0, nonConcessional: 0 },
      financialYear: fyYear,
    };
    return {
      entityId: earner.entityId,
      memberName: earner.memberName,
      isPrimary: earner.isPrimary,
      taxPosition: calculateTaxPosition(memberInputs),
      engineInputs: memberInputs,
    };
  });

  return {
    taxPosition,
    engineInputs,
    perMember,
    financialYear: fyYear,
    incomes,
    expenses,
    depreciations,
    properties,
    holdings,
    superTotals,
  };
}
