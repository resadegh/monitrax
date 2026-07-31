/**
 * MON-131 Tranche 1 — T1 INCOME COMPARE relay (the expectedMoves computer).
 *
 * GET /api/admin/matrix/golden-baseline/t1-income[?userId=<id>]
 *
 * Runs the OLD producers (live legacy path — exactly what production renders
 * today) and the NEW banked-income engines (the T1-B wiring, via the SAME
 * shared assembly the flip will use — lib/income/banked/assembly.ts) against
 * the SAME live data, and returns per-path before/after values. This is how
 * the `PENDING_RELAY` entries in `.audit/expected-moves-t1.json` are filled
 * — COMPUTED, never estimated (build brief §4; spec §1 item 5). A
 * PENDING_RELAY entry at T1-B merge time fails G3.
 *
 * Also returns:
 *   - the rental three-value localisation (Σ per-property engine rent vs
 *     byType.RENTAL vs declared run-rate — settles the Δ3 attribution from
 *     the T1 trace before the flip is designed final)
 *   - the salary plausibility block (implied wedge vs schedule wedge —
 *     the 9,932.00 / 11,128.70 / schedule reconciliation, surfaced not fixed)
 *
 * SCAFFOLD-ONLY GUARANTEE: this route READS both paths; it changes no
 * producer, no consumer, no rendered number. The golden baseline at the
 * T1-A merge must hash IDENTICAL to the pre-merge reference.
 *
 * Per HR-3: admin-side surface only. No user-facing variant exists.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminGCPAuth } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { isAdminPortalAccessible } from '@/lib/admin/featureFlags';
import { ADMIN_ERROR_CODES } from '@/lib/admin/constants';
import { resolveSoleUserId, deployedSha } from '@/lib/matrix/goldenBaseline';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import { buildHealthInput } from '@/lib/health/buildHealthInput';
import { generateHealthReport } from '@/lib/health/aggregateEngine';
import { getMoneyFlow } from '@/lib/services/moneyFlowService';
import {
  assembleBankedIncomeForUser,
  fetchBankedRawData,
  bankedMonthlyPerRow,
} from '@/lib/income/banked/assembly';
import { projectAggregation } from '@/lib/income/banked/aggregator';
import { toAnnual } from '@/lib/utils/frequencies';
import type { Frequency } from '@/lib/types/prisma-enums';

interface ComparedPath {
  path: string;
  before: number;
  after: number | null;
  arithmetic: string;
}

export async function GET(request: NextRequest) {
  if (!isAdminPortalAccessible()) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.ADMIN_PORTAL_NOT_ENABLED, message: 'Admin portal is not enabled' } },
      { status: 503 },
    );
  }
  const authResult = await verifyAdminGCPAuth(request);
  if (!authResult.success || !authResult.context) {
    return NextResponse.json({ error: authResult.error }, { status: 401 });
  }
  if (!hasPermission(authResult.context.role, 'audit:read')) {
    return NextResponse.json(
      { error: { code: ADMIN_ERROR_CODES.INSUFFICIENT_PERMISSIONS, message: 'Insufficient permissions' } },
      { status: 403 },
    );
  }

  let userId = request.nextUrl.searchParams.get('userId') || undefined;
  if (!userId) {
    const r = await resolveSoleUserId();
    if ('candidates' in r) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'MULTIPLE_USERS', message: 'More than one user exists — pass ?userId=<id>', details: r.candidates },
        },
        { status: 400 },
      );
    }
    userId = r.userId;
  }

  // ---- OLD: the live legacy producers, exactly as production renders ------
  const [snapshot, healthInput, moneyFlow] = await Promise.all([
    getMasterFinancialSnapshot(userId),
    buildHealthInput(userId),
    getMoneyFlow(userId),
  ]);
  const oldHealth = generateHealthReport(healthInput);

  // ---- NEW: the banked engines through the SAME assembly T1-B will wire ---
  const [{ banked, repaymentIncome, config }, rawData] = await Promise.all([
    assembleBankedIncomeForUser(userId),
    fetchBankedRawData(userId),
  ]);
  const allMonthly = projectAggregation(banked, 'all', 'monthly');
  const allAnnual = projectAggregation(banked, 'all', 'annual');

  // T1-B cashflow wiring: income legs from the banked aggregator; expense and
  // loan legs UNCHANGED (T3/T2 own those) — read from the legacy result.
  const cf = snapshot.cashflow;
  const bankedMonthly = banked.annual.banked / 12;
  const grossMonthly = banked.annual.gross / 12;
  const paygMonthly = (banked.annual.withholding.payg + banked.annual.withholding.help) / 12;
  const newMonthlyCashflow = bankedMonthly - cf.monthlyExpenses - cf.monthlyLoanRepayments; // @financial-math-allowed: admin compare relay — replicates the T1-B flip formula to COMPUTE the declared after-value (expense/loan legs unchanged); not a user-facing producer (HR-3)
  const newSavingsRate = bankedMonthly > 0 ? (newMonthlyCashflow / bankedMonthly) * 100 : 0;
  const newExpenseRatio = bankedMonthly > 0 ? (cf.monthlyExpenses / bankedMonthly) * 100 : 0;
  const newDebtServiceRatio = bankedMonthly > 0 ? (cf.monthlyLoanRepayments / bankedMonthly) * 100 : 0;

  // T1-B health wiring: same input, income rows re-fed with banked per-row
  // monthly values (the flip replaces buildHealthInput's private
  // getNetMonthlyIncome — this transformation IS that replacement, applied
  // to the already-assembled input so the pure engine re-runs unchanged).
  const perRow = bankedMonthlyPerRow(banked, rawData.income);
  const bankedHealthInput = {
    ...healthInput,
    portfolioSnapshot: {
      ...healthInput.portfolioSnapshot,
      income: healthInput.portfolioSnapshot.income.map((row) => ({
        ...row,
        monthlyAmount: perRow.get(row.id) ?? row.monthlyAmount,
      })),
    },
  };
  const newHealth = generateHealthReport(bankedHealthInput);

  const r2 = (n: number) => Math.round(n * 100) / 100;
  const paths: ComparedPath[] = [
    // — the committed PENDING_RELAY set (.audit/expected-moves-t1.json) —
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.cashflow.annualPaygWithholding',
      before: cf.annualPaygWithholding,
      after: r2(paygMonthly * 12),
      arithmetic: `banked withholding (payg ${r2(banked.annual.withholding.payg)} + help ${r2(banked.annual.withholding.help)})`,
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.income.annual.all.paygWithholding',
      before: snapshot.income.annual.all.paygWithholding,
      after: r2(allAnnual.paygWithholding),
      arithmetic: 'identity: grossTotal − bankedTotal (wedge by construction; stored paygWithholding column retired as a read source)',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.income.monthly.all.paygWithholding',
      before: snapshot.income.monthly.all.paygWithholding,
      after: r2(allMonthly.paygWithholding),
      arithmetic: 'annual ÷ 12',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.cashflow.annualNetIncome',
      before: cf.annualNetIncome,
      after: r2(banked.annual.banked),
      arithmetic: 'banked income (D17) — single deduction, double-deduction removed (MON-137)',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.cashflow.annualIncome',
      before: cf.annualIncome,
      after: r2(banked.annual.banked),
      arithmetic: 'alias of annualNetIncome (banked)',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.cashflow.monthlyCashflow',
      before: cf.monthlyCashflow,
      after: r2(newMonthlyCashflow),
      arithmetic: `banked ${r2(bankedMonthly)} − expenses ${r2(cf.monthlyExpenses)} − loans ${r2(cf.monthlyLoanRepayments)} (expense/loan legs unchanged — T3/T2)`,
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.cashflow.savingsRate', // @financial-math-allowed: a PATH STRING for the expected-moves declaration, not a cashflow read
      before: cf.savingsRate,
      after: r2(newSavingsRate),
      arithmetic: 'T1 basis: (banked − expenses − loan repayments) ÷ banked × 100. DECLARED MOVING AGAIN in T2 (X3: principal separates from spending, D18)',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.cashflow.debtServiceRatio',
      before: cf.debtServiceRatio,
      after: r2(newDebtServiceRatio),
      arithmetic: 'loan repayments ÷ banked × 100',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.quickMetrics.monthlyIncome',
      before: snapshot.quickMetrics.monthlyIncome,
      after: r2(bankedMonthly),
      arithmetic: 'banked monthly income (D17)',
    },
    {
      path: 'lib/health/aggregateEngine.ts:generateHealthReport.score',
      before: oldHealth.healthScore.score,
      after: newHealth.healthScore.score,
      arithmetic: 'health engine re-run with banked per-row income (T1 contribution ONLY — T3 expenses + T6 runway declare their own moves, X8)',
    },
    {
      path: 'lib/services/moneyFlowService.ts:getMoneyFlow.totalIncome',
      before: moneyFlow.totalIncome,
      after: r2(banked.annual.banked),
      arithmetic: 'banked annual income (D17) — money-in = cash received',
    },
    // — identity pair already COMPUTED_IDENTITY in the file; returned as
    //   verification that the identities hold on live data —
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.cashflow.monthlyGrossIncome',
      before: cf.monthlyGrossIncome,
      after: r2(grossMonthly),
      arithmetic: 'identity target: ≡ income.monthly.all.grossTotal',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.cashflow.annualGrossIncome',
      before: cf.annualGrossIncome,
      after: r2(banked.annual.gross),
      arithmetic: 'identity target: ≡ income.annual.all.grossTotal',
    },
    // — additional paths the flip mechanically moves; enumerated here so the
    //   expected-moves file can declare them per-path BEFORE the T1-B merge —
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.income.annual.all.netTotal',
      before: snapshot.income.annual.all.netTotal,
      after: r2(allAnnual.netTotal),
      arithmetic: 'netTotal field carries BANKED after the flip (path kept for baseline continuity; on-wire rename queued)',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.income.monthly.all.netTotal',
      before: snapshot.income.monthly.all.netTotal,
      after: r2(allMonthly.netTotal),
      arithmetic: 'annual ÷ 12',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.income.annual.all.grossTotal',
      before: snapshot.income.annual.all.grossTotal,
      after: r2(allAnnual.grossTotal),
      arithmetic: 'banked-engine gross (undetermined gross floors at banked, flagged)',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.income.annual.all.byType.RENTAL.gross',
      before: snapshot.income.annual.all.byType?.RENTAL?.gross ?? 0,
      after: r2(banked.rental.bankedAnnual),
      arithmetic: 'canonical actuals-first rental (rentalBankedActuals — same computePropertyCashflow engine, now via the named L1 home)',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.cashflow.taxableIncome',
      before: cf.taxableIncome,
      after: r2(banked.annual.grossTaxable),
      arithmetic: 'legacy gross-basis semantic now fed real gross (side-effect move; the taxable-income NAME reconciliation stays T4 per start-gate §2.4)',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.quickMetrics.monthlyGrossIncome',
      before: snapshot.quickMetrics.monthlyGrossIncome,
      after: r2(grossMonthly),
      arithmetic: 'reads cashflow.monthlyGrossIncome (separate leaf path — declared separately)',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.quickMetrics.monthlyCashflow',
      before: snapshot.quickMetrics.monthlyCashflow,
      after: r2(newMonthlyCashflow),
      arithmetic: 'reads cashflow.monthlyCashflow (separate leaf path)',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.quickMetrics.savingsRate',
      before: snapshot.quickMetrics.savingsRate,
      after: r2(newSavingsRate),
      arithmetic: 'reads cashflow.savingsRate (separate leaf path)',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.quickMetrics.keptAfterEssentials',
      before: snapshot.quickMetrics.keptAfterEssentials,
      after: r2(bankedMonthly - snapshot.expenses.monthly.essential.total),
      arithmetic: 'banked monthly − essential expenses (expense leg unchanged)',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.quickMetrics.keptMargin',
      before: snapshot.quickMetrics.keptMargin,
      after: grossMonthly > 0 ? r2(((bankedMonthly - snapshot.expenses.monthly.essential.total) / grossMonthly) * 100) : 0,
      arithmetic: 'kept ÷ banked gross × 100',
    },
    {
      path: 'lib/services/masterFinancialService.ts:getMasterFinancialSnapshot.debt.metrics.debtToIncomeRatio',
      before: snapshot.debt.metrics.debtToIncomeRatio,
      after: bankedMonthly > 0 ? r2((snapshot.debt.summary.totalPrincipal / (bankedMonthly * 12)) * 100) : 0,
      arithmetic: 'total principal ÷ banked annual × 100 (denominator moves with T1)',
    },
  ];

  // Rental three-value localisation (T1 trace Δ2/Δ3 settlement).
  const rentalLocalisation = {
    perPropertyEngine: banked.rental.perProperty,
    sumPerPropertyAnnual: r2(banked.rental.perProperty.reduce((s, p) => s + p.bankedAnnual, 0)),
    nonPropertyAnnual: r2(banked.rental.nonPropertyBankedAnnual),
    byTypeRentalLegacy: snapshot.income.annual.all.byType?.RENTAL ?? null,
    declaredRunRateAnnual: r2(
      banked.rental.perProperty.reduce((s, p) => s + p.declaredMonthly * 12, 0) +
        banked.rental.nonPropertyBankedAnnual,
    ),
    oneOffRentalAmount: r2(banked.rental.oneOffAmount),
    misattachedRows: banked.rental.misattachedRows,
  };

  // §1.3 — the TAX-side declared rental basis, NAMED + attributed per row:
  // `rentalTaxableGrossDeclared` = grossAmount ?? (one-off ? amount :
  // annualised) — the exact per-row resolution taxPositionCalculator's income
  // loop applies (its :180-184 branch). This is the $121,881-class figure: a
  // DECLARED tax-basis quantity, deliberately DISTINCT from the banked
  // actuals-first rental; reconciling the two is T4 scope (V4 stays open).
  const rentalTaxableGrossDeclared = rawData.income
    .filter((i) => i.type === 'RENT' || i.type === 'RENTAL')
    .map((i) => ({
      incomeId: i.id ?? null,
      propertyId: i.propertyId ?? null,
      declaredAmount: i.amount,
      frequency: i.frequency,
      isRecurring: i.isRecurring ?? null,
      storedGrossAmount: i.grossAmount ?? null,
      // @financial-math-allowed: admin compare relay — replicates the tax
      // calculator's per-row resolution to ATTRIBUTE it, not to produce it (HR-3).
      rentalTaxableGrossDeclared: r2(
        i.grossAmount
          ? i.grossAmount
          : i.isRecurring === false
            ? i.amount
            : toAnnual(i.amount, i.frequency as Frequency), // @source-lock-allowed: §1.3 attribution — mirrors taxPositionCalculator's declared-basis branch verbatim so the Matrix can attribute the $121,881-class figure per row; not a user-facing producer (deliberately NOT monthlyRunRate — the tax loop annualises recurring rows with plain toAnnual)
      ),
    }));

  return NextResponse.json({
    success: true,
    data: {
      sha: deployedSha(),
      capturedAt: new Date().toISOString(),
      userId,
      financialYear: config.financialYear,
      paths,
      rentalLocalisation,
      rentalTaxableGrossDeclared,
      salaryPlausibility: banked.salaryRows.map((r) => ({
        incomeId: r.id,
        basis: r.basis,
        bankedAnnual: r2(r.bankedAnnual),
        grossAnnual: r.grossAnnual === null ? null : r2(r.grossAnnual),
        plausibility: r.plausibility,
        flags: r.flags,
      })),
      repaymentIncome,
      bankedSummary: {
        annual: banked.annual,
        oneOff: banked.oneOff,
        undetermined: banked.undetermined,
        flags: banked.flags,
      },
    },
    meta: { timestamp: new Date().toISOString() },
  });
}
