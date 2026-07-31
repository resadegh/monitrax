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
// MON-131 T1-B §1.1 — the two pass wedge credit (all pure imports):
import { assembleRepaymentIncome } from './repaymentIncome';
import { salaryWithholdingWedgeAnnual } from '@/lib/income/banked/salaryBanked';
import type { BankedIncomeRow } from '@/lib/income/banked/types';
import { getTaxYearConfig } from '../config/taxYearConfig';

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

  // MON-088: household composition + hospital cover drive the Medicare legs
  // (family threshold, MLS combined-income tier, cover). One fetch here —
  // never re-derived per surface (§12.2.1).
  const householdProfile = await prisma.householdProfile.findUnique({
    where: { userId },
    select: {
      adultsCount: true,
      childrenCount: true,
      members: {
        select: { relationship: true, hasPrivateHospitalCover: true },
      },
    },
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

  // MON-088: the Medicare context, derived ONCE from the household profile.
  // Family = 2+ adults or an explicit SPOUSE member. Cover is the ATO
  // all-or-nothing rule: the family is covered only when every ADULT answered
  // "Yes"; a child left blank follows the adults (family policies typically
  // cover children — approximation surfaced in the PR), a child answered "No"
  // breaks cover; an adult blank ("Not sure") = conservatively NOT covered.
  const memberRows = householdProfile?.members ?? [];
  const adultRows = memberRows.filter((m: any) => m.relationship !== 'CHILD');
  const isFamily =
    (householdProfile?.adultsCount ?? adultRows.length) >= 2 ||
    memberRows.some((m: any) => m.relationship === 'SPOUSE');
  const dependentChildren =
    householdProfile?.childrenCount ??
    memberRows.filter((m: any) => m.relationship === 'CHILD').length;
  const familyCovered: boolean | null =
    adultRows.length > 0
      ? adultRows.every((m: any) => m.hasPrivateHospitalCover === true) &&
        !memberRows.some(
          (m: any) => m.relationship === 'CHILD' && m.hasPrivateHospitalCover === false,
        )
      : null; // no members recorded → unknown → engine treats as uncovered
  const medicareContext = {
    familyStatus: (isFamily ? 'FAMILY' : 'SINGLE') as 'FAMILY' | 'SINGLE',
    dependentChildren,
    // The household bundle's taxableIncome is already the COMBINED income of
    // every earner, so no spouse income is added on top here.
    spouseIncome: 0,
    familyCovered,
  };

  const baseEngineInputs: TaxPositionCalculationInput = {
    incomes: incomeItems,
    expenses: expenseItems,
    depreciations: depreciationItems,
    propertyLoans: propertyLoanItems, // MON-045: auto-derived deductible interest
    superContributions: superTotals,
    financialYear: fyYear,
    medicareContext,
  };

  // MON-131 T1B §1.1, two pass derivation of the wedge credit.
  // Pass 1 yields the position from stored rows only; taxable income,
  // deductions and Medicare never read the credit, so there is no cycle.
  // From it: repayment income (D42 C3, an estimate; componentBasis records
  // the unmodelled DEFAULT_ZERO legs) feeds the ONE salary banked engine,
  // which derives each salary row's annual wedge (FACT bases win over the
  // schedule; an UNDETERMINED study loan component contributes 0, flagged,
  // never asserted). Pass 2 recomputes the SAME position with that wedge as
  // the credit (the §1.1 ruling: 11,129 grows to 43,004 credit and the
  // refund moves from −26,657 to 5,218 on VR‑043 data). Per member
  // positions below stay on stored rows this tranche (their movement is
  // NOT declared in expectedMoves; T6 scope).
  const pass1Position = calculateTaxPosition(baseEngineInputs);
  const repayment = assembleRepaymentIncome(pass1Position, incomes as any[]);
  const derivedWedgeAnnual = salaryWithholdingWedgeAnnual(
    incomes as unknown as BankedIncomeRow[],
    { config: getTaxYearConfig(fyYear), repaymentIncome: repayment.repaymentIncome },
  );

  const engineInputs: TaxPositionCalculationInput = {
    ...baseEngineInputs,
    derivedPaygWithheldAnnual: derivedWedgeAnnual,
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

  const perMemberDraft = earners.map((earner) => {
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
    return { earner, memberInputs };
  });

  // MON-088 two-pass: each member's MLS tier needs the OTHER members'
  // taxable income (combined family income). Pass 1 = the SAME engine on the
  // partition without context (yields each taxable income — no second
  // producer, §12.2.1); pass 2 = final positions with the family context.
  const pass1Taxable = perMemberDraft.map(
    ({ memberInputs }) => calculateTaxPosition(memberInputs).tax.taxableIncome,
  );
  const perMember = perMemberDraft.map(({ earner, memberInputs }, i) => {
    const spouseIncome = pass1Taxable.reduce((s, t, j) => (j === i ? s : s + t), 0);
    const inputs: TaxPositionCalculationInput = {
      ...memberInputs,
      medicareContext: { ...medicareContext, spouseIncome },
    };
    return {
      entityId: earner.entityId,
      memberName: earner.memberName,
      isPrimary: earner.isPrimary,
      taxPosition: calculateTaxPosition(inputs),
      engineInputs: inputs,
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
