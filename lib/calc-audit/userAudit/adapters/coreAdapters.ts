/**
 * Phase 41i.3b — User-audit adapters for core calc engines.
 *
 * Each adapter:
 *   - `fetchInput(userId)` — pulls the user's data via Prisma + shapes
 *     it into the engine's input.
 *   - `validateOutput(out)` — sanity invariants the output must
 *     satisfy for ANY user. Failures fire findings.
 *
 * Returning `null` from `fetchInput` is "this engine doesn't apply
 * for this user" — for these core engines the user almost always has
 * data, so null is rare (typically a brand-new user with no rows).
 */

import 'server-only';
import prisma from '@/lib/db';
import type {
  NetWorthResult,
  PropertyInput,
  AccountInput,
  InvestmentInput,
  LoanInput as NwLoanInput,
  SuperInput,
  AssetInput,
} from '@/lib/calculations/netWorthCalculator';
import type {
  IncomeInput,
  IncomeAggregation,
} from '@/lib/calculations/incomeAggregator';
import type {
  ExpenseInput,
  ExpenseAggregation,
} from '@/lib/calculations/expenseAggregator';
import type {
  LoanInput as LaLoanInput,
  LoanAggregation,
} from '@/lib/calculations/loanAggregator';
import type { UserAuditAdapter, ValidationResult } from '../types';

// =============================================================================
// netWorth — assets (properties + accounts + investments + super + personal
//             assets) - liabilities (loans).
// =============================================================================

interface NetWorthInput {
  properties: PropertyInput[];
  accounts: AccountInput[];
  investments: InvestmentInput[];
  loans: NwLoanInput[];
  superannuation: SuperInput[];
  personalAssets: AssetInput[];
}

export const netWorthAdapter: UserAuditAdapter<NetWorthInput, NetWorthResult> = {
  engineName: 'core.netWorth',

  async fetchInput(userId) {
    const [properties, accounts, holdings, loans, supers, personalAssets] = await Promise.all([
      prisma.property.findMany({
        where: { userId },
        select: { currentValue: true, type: true, ownerEntityId: true },
      }),
      prisma.account.findMany({
        where: { userId },
        select: { currentBalance: true, type: true, ownerEntityId: true },
      }),
      prisma.investmentHolding.findMany({
        where: { investmentAccount: { userId } },
        select: {
          units: true,
          currentPrice: true,
          averagePrice: true,
        },
      }),
      prisma.loan.findMany({
        where: { userId },
        select: { principal: true, type: true, ownerEntityId: true },
      }),
      prisma.superannuationAccount.findMany({
        where: { userId },
        select: { currentBalance: true },
      }),
      prisma.asset.findMany({
        where: { userId },
        select: { currentValue: true, type: true, ownerEntityId: true },
      }),
    ]);

    return {
      properties: properties.map((p) => ({
        currentValue: Number(p.currentValue),
        type: p.type ?? undefined,
        ownerEntityId: p.ownerEntityId,
      })),
      accounts: accounts.map((a) => ({
        currentBalance: Number(a.currentBalance),
        type: a.type ?? undefined,
        ownerEntityId: a.ownerEntityId,
      })),
      investments: holdings.map((h) => ({
        units: Number(h.units),
        currentPrice: h.currentPrice == null ? undefined : Number(h.currentPrice),
        averagePrice: h.averagePrice == null ? undefined : Number(h.averagePrice),
      })),
      loans: loans.map((l) => ({
        principal: Number(l.principal),
        type: l.type ?? undefined,
        ownerEntityId: l.ownerEntityId,
      })),
      superannuation: supers.map((s) => ({
        balance: Number(s.currentBalance),
      })),
      personalAssets: personalAssets.map((a) => ({
        currentValue: Number(a.currentValue),
        type: a.type ?? undefined,
        ownerEntityId: a.ownerEntityId,
      })),
    };
  },

  validateOutput(out): ValidationResult {
    if (!Number.isFinite(out.assets.total)) {
      return { ok: false, reason: 'assets.total is not finite (NaN/Infinity)', severity: 'HIGH' };
    }
    if (!Number.isFinite(out.liabilities.total)) {
      return {
        ok: false,
        reason: 'liabilities.total is not finite (NaN/Infinity)',
        severity: 'HIGH',
      };
    }
    if (!Number.isFinite(out.netWorth)) {
      return { ok: false, reason: 'netWorth is not finite (NaN/Infinity)', severity: 'HIGH' };
    }
    if (out.assets.total < 0) {
      return {
        ok: false,
        reason: `assets.total negative ($${out.assets.total.toFixed(2)}) — invariant violation`,
        severity: 'HIGH',
      };
    }
    if (out.liabilities.total < 0) {
      return {
        ok: false,
        reason: `liabilities.total negative ($${out.liabilities.total.toFixed(2)}) — invariant violation`,
        severity: 'HIGH',
      };
    }
    // SSOT invariant: net worth must equal assets - liabilities
    // (within 1c rounding tolerance).
    const computed = out.assets.total - out.liabilities.total;
    if (Math.abs(out.netWorth - computed) > 0.01) {
      return {
        ok: false,
        reason: `netWorth ($${out.netWorth.toFixed(2)}) != assets ($${out.assets.total.toFixed(2)}) - liabilities ($${out.liabilities.total.toFixed(2)})`,
        severity: 'CRITICAL',
      };
    }
    return { ok: true };
  },
};

// =============================================================================
// incomeAggregator
// =============================================================================

export const incomeAggregatorAdapter: UserAuditAdapter<
  { incomes: IncomeInput[]; targetFrequency: 'MONTHLY' | 'ANNUAL' },
  IncomeAggregation
> = {
  engineName: 'core.incomeAggregator',

  async fetchInput(userId) {
    const incomes = await prisma.income.findMany({
      where: { userId },
      select: {
        amount: true,
        frequency: true,
        type: true,
        salaryType: true,
        grossAmount: true,
        netAmount: true,
        paygWithholding: true,
        isTaxable: true,
      },
    });
    return {
      incomes: incomes.map((i) => ({
        amount: Number(i.amount),
        frequency: String(i.frequency),
        type: i.type ? String(i.type) : undefined,
        salaryType: i.salaryType ? String(i.salaryType) : null,
        grossAmount: i.grossAmount == null ? null : Number(i.grossAmount),
        netAmount: i.netAmount == null ? null : Number(i.netAmount),
        paygWithholding: i.paygWithholding == null ? null : Number(i.paygWithholding),
        isTaxable: i.isTaxable ?? undefined,
      })),
      targetFrequency: 'MONTHLY',
    };
  },

  validateOutput(out): ValidationResult {
    if (!Number.isFinite(out.grossTotal)) {
      return { ok: false, reason: 'grossTotal is not finite', severity: 'HIGH' };
    }
    if (!Number.isFinite(out.netTotal)) {
      return { ok: false, reason: 'netTotal is not finite', severity: 'HIGH' };
    }
    if (out.grossTotal < 0) {
      return {
        ok: false,
        reason: `grossTotal negative ($${out.grossTotal.toFixed(2)}) — should be ≥ 0`,
        severity: 'HIGH',
      };
    }
    if (out.netTotal < 0) {
      return {
        ok: false,
        reason: `netTotal negative ($${out.netTotal.toFixed(2)}) — should be ≥ 0`,
        severity: 'HIGH',
      };
    }
    // Net should not exceed gross (PAYG cannot be negative).
    if (out.netTotal > out.grossTotal + 0.01) {
      return {
        ok: false,
        reason: `netTotal ($${out.netTotal.toFixed(2)}) exceeds grossTotal ($${out.grossTotal.toFixed(2)})`,
        severity: 'HIGH',
      };
    }
    return { ok: true };
  },
};

// =============================================================================
// expenseAggregator
// =============================================================================

export const expenseAggregatorAdapter: UserAuditAdapter<
  { expenses: ExpenseInput[]; targetFrequency: 'MONTHLY' | 'ANNUAL' },
  ExpenseAggregation
> = {
  engineName: 'core.expenseAggregator',

  async fetchInput(userId) {
    const expenses = await prisma.expense.findMany({
      where: { userId },
      select: {
        amount: true,
        frequency: true,
        category: true,
        isEssential: true,
        isTaxDeductible: true,
      },
    });
    return {
      expenses: expenses.map((e) => ({
        amount: Number(e.amount),
        frequency: String(e.frequency),
        category: e.category ? String(e.category) : undefined,
        isEssential: e.isEssential ?? undefined,
        isTaxDeductible: e.isTaxDeductible ?? undefined,
      })),
      targetFrequency: 'MONTHLY',
    };
  },

  validateOutput(out): ValidationResult {
    if (!Number.isFinite(out.total)) {
      return { ok: false, reason: 'expense total is not finite', severity: 'HIGH' };
    }
    if (out.total < 0) {
      return {
        ok: false,
        reason: `expense total negative ($${out.total.toFixed(2)}) — should be ≥ 0`,
        severity: 'HIGH',
      };
    }
    // SSOT invariant: essential + discretionary should equal total
    // (within 1c rounding tolerance).
    const split = (out.essential ?? 0) + (out.discretionary ?? 0);
    if (Math.abs(out.total - split) > 0.01) {
      return {
        ok: false,
        reason: `total ($${out.total.toFixed(2)}) != essential ($${(out.essential ?? 0).toFixed(2)}) + discretionary ($${(out.discretionary ?? 0).toFixed(2)})`,
        severity: 'MEDIUM',
      };
    }
    return { ok: true };
  },
};

// =============================================================================
// loanAggregator
// =============================================================================

export const loanAggregatorAdapter: UserAuditAdapter<
  { loans: LaLoanInput[]; targetFrequency: 'MONTHLY' | 'ANNUAL' },
  LoanAggregation
> = {
  engineName: 'core.loanAggregator',

  async fetchInput(userId) {
    const loans = await prisma.loan.findMany({
      where: { userId },
      select: {
        principal: true,
        minRepayment: true,
        repaymentFrequency: true,
        interestRateAnnual: true,
        isInterestOnly: true,
        type: true,
      },
    });
    return {
      loans: loans.map((l) => ({
        principal: Number(l.principal),
        minRepayment: Number(l.minRepayment),
        repaymentFrequency: String(l.repaymentFrequency),
        interestRateAnnual: Number(l.interestRateAnnual),
        isInterestOnly: l.isInterestOnly ?? false,
        type: l.type ? String(l.type) : undefined,
      })),
      targetFrequency: 'MONTHLY',
    };
  },

  validateOutput(out): ValidationResult {
    if (!Number.isFinite(out.totalPrincipal)) {
      return { ok: false, reason: 'totalPrincipal is not finite', severity: 'HIGH' };
    }
    if (!Number.isFinite(out.totalRepayments)) {
      return { ok: false, reason: 'totalRepayments is not finite', severity: 'HIGH' };
    }
    if (out.totalPrincipal < 0) {
      return {
        ok: false,
        reason: `totalPrincipal negative ($${out.totalPrincipal.toFixed(2)})`,
        severity: 'HIGH',
      };
    }
    if (out.totalRepayments < 0) {
      return {
        ok: false,
        reason: `totalRepayments negative ($${out.totalRepayments.toFixed(2)})`,
        severity: 'HIGH',
      };
    }
    if (!Number.isFinite(out.weightedInterestRate)) {
      return {
        ok: false,
        reason: 'weightedInterestRate is not finite (probable divide-by-zero on totalPrincipal=0)',
        severity: 'HIGH',
      };
    }
    return { ok: true };
  },
};

export const CORE_USER_AUDIT_ADAPTERS = [
  netWorthAdapter,
  incomeAggregatorAdapter,
  expenseAggregatorAdapter,
  loanAggregatorAdapter,
] as const;
