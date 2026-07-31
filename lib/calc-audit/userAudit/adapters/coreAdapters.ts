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
import { fetchBankedRawData, type BankedRawData } from '@/lib/income/banked/assembly';
import type { BankedIncomeResult } from '@/lib/income/banked/aggregator';
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
// bankedIncome (MON-131 T1-B — replaces the deleted incomeAggregatorAdapter;
// its engine `core.incomeAggregator` / `aggregateIncome` is retired with the
// income-net-run-rate contract). Runs the ONE L2 banked aggregator on the
// user's live rows and checks the §5.6 identities.
// =============================================================================

export const bankedIncomeAdapter: UserAuditAdapter<
  Omit<BankedRawData, never>,
  BankedIncomeResult
> = {
  engineName: 'income.bankedAggregator',

  async fetchInput(userId) {
    // The SAME canonical fetch the master snapshot's assembler uses — full
    // row set (an input-feed omission is the MON-137 defect class).
    return fetchBankedRawData(userId);
  },

  validateOutput(out): ValidationResult {
    const a = out.annual;
    if (!Number.isFinite(a.banked) || !Number.isFinite(a.gross)) {
      return { ok: false, reason: 'banked/gross not finite', severity: 'HIGH' };
    }
    if (a.banked < 0) {
      return {
        ok: false,
        reason: `banked negative ($${a.banked.toFixed(2)}) — should be ≥ 0`,
        severity: 'HIGH',
      };
    }
    // §5.6 identity: banked can never exceed gross (a wedge is never negative).
    if (a.banked > a.gross + 0.01) {
      return {
        ok: false,
        reason: `banked ($${a.banked.toFixed(2)}) exceeds gross ($${a.gross.toFixed(2)})`,
        severity: 'HIGH',
      };
    }
    // §5.6 identity: sources sum to the total (D20 L2 invariant).
    const sourceSum =
      a.bySource.salary.banked +
      a.bySource.rental.banked +
      a.bySource.investment.banked +
      a.bySource.other.banked;
    if (Math.abs(sourceSum - a.banked) > 0.01) {
      return {
        ok: false,
        reason: `sources ($${sourceSum.toFixed(2)}) do not sum to banked ($${a.banked.toFixed(2)})`,
        severity: 'CRITICAL',
      };
    }
    // §5.6 identity: gross − banked ≡ the withholding wedge.
    if (Math.abs(a.gross - a.banked - a.withholding.total) > 0.01) {
      return {
        ok: false,
        reason: `gross − banked ($${(a.gross - a.banked).toFixed(2)}) != withholding total ($${a.withholding.total.toFixed(2)})`,
        severity: 'CRITICAL',
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
  bankedIncomeAdapter,
  expenseAggregatorAdapter,
  loanAggregatorAdapter,
] as const;
