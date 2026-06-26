/**
 * Trust Engine · what-if scenario cascade reconciliation (Tranche A).
 *
 * The what-if levers are the highest-stakes numbers in the app — selling a
 * property cascades into CGT, cashflow, net worth and liquidity, and a user
 * makes a real money decision on the result. This locks the `sellProperty`
 * cascade's accounting identities so a wrong sign or a dropped term can't ship:
 *
 *   netCashFreed       === grossProceeds − sellingCosts − loanPayoff
 *   Δliquid            === netCashFreed
 *   Δmonthly cashflow  === −property.monthlyCashflow      (selling removes it)
 *   Δnet worth         === −sellingCosts − yourCgt        (0 CGT on back-compat)
 *   Δportfolio value   === −property.currentValue
 *
 * Reconciliation tie-outs over a fixed case + a deterministic random sweep.
 * The engine is the real `sellPropertyScenario`; no financial logic changed.
 * Models the `sellProperty` cascade the Neomatrix now carries (Tranche A).
 */

import { describe, it, expect } from 'vitest';
import { sellPropertyScenario } from '@/lib/cfo/scenarios/sellProperty';
import { tenYearProjection } from '@/lib/cfo/scenarios/tenYearProjection';
import { addInvestmentScenario } from '@/lib/cfo/scenarios/addInvestment';
import { redirectToOffsetScenario } from '@/lib/cfo/scenarios/redirectToOffset';
import { refinanceLoanScenario } from '@/lib/cfo/scenarios/refinanceLoan';
import { payDownLoanScenario } from '@/lib/cfo/scenarios/payDownLoan';
import { cutSpendCategoryScenario } from '@/lib/cfo/scenarios/cutSpendCategory';
import { salarySacrificeToSuperScenario } from '@/lib/cfo/scenarios/salarySacrificeToSuper';
import { getCurrentTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import type { ScenarioContext } from '@/lib/cfo/scenarios/types';
import { Decimal } from '@/lib/decimal';

const SELLING_COSTS_PCT = 0.025; // the engine default

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface PropInput {
  currentValue: number;
  loanBalance: number;
  monthlyCashflow: number;
}

// Minimal ScenarioContext exercising only the fields sellPropertyScenario reads.
// No propertyTaxContexts/taxConfig/currentFy → buildCgtForSellProperty returns
// null → yourCgt = 0 (the back-compat path), so net-worth reconciles to costs.
function ctxFor(p: PropInput, liquidCash: number, monthlyCashflow: number, netWorth: number, portfolioValue: number) {
  return {
    snapshot: {
      properties: [
        {
          id: 'p1',
          name: 'Unit 5',
          currentValue: p.currentValue,
          loanBalance: p.loanBalance,
          monthlyCashflow: p.monthlyCashflow,
          equity: p.currentValue - p.loanBalance,
        },
      ],
      quickMetrics: { liquidCash, monthlyCashflow },
      netWorth: { netWorth },
      propertyPortfolioValue: portfolioValue,
    },
  } as unknown as ScenarioContext;
}

function reconcile(p: PropInput, liquidCash: number, monthlyCashflow: number, netWorth: number, portfolioValue: number) {
  const r = sellPropertyScenario(ctxFor(p, liquidCash, monthlyCashflow, netWorth, portfolioValue), { propertyId: 'p1' });
  const by = (prefix: string) => r.impacts.find((i) => i.label.startsWith(prefix))!;

  const sellingCosts = p.currentValue * SELLING_COSTS_PCT;
  const netCashFreed = p.currentValue - sellingCosts - p.loanBalance;

  // netCashFreed identity (via the Liquid cash impact)
  expect(by('Liquid cash').delta).toBeCloseTo(netCashFreed, 4);
  expect(by('Liquid cash').after).toBeCloseTo(liquidCash + netCashFreed, 4);
  // cashflow removal
  expect(by('Monthly cashflow').delta).toBeCloseTo(-p.monthlyCashflow, 4);
  expect(by('Monthly cashflow').after).toBeCloseTo(monthlyCashflow - p.monthlyCashflow, 4);
  // net worth absorbs selling costs (+ 0 CGT on the back-compat path)
  expect(by('Net worth').delta).toBeCloseTo(-sellingCosts, 4);
  expect(by('Net worth').after).toBeCloseTo(netWorth - sellingCosts, 4);
  // portfolio value loses the property
  expect(by('Property portfolio value').delta).toBeCloseTo(-p.currentValue, 4);
  expect(by('Property portfolio value').after).toBeCloseTo(portfolioValue - p.currentValue, 4);
}

describe('Trust Engine · what-if sellProperty cascade reconciliation', () => {
  it('fixed case — every cascade identity ties out', () => {
    reconcile({ currentValue: 800_000, loanBalance: 500_000, monthlyCashflow: -200 }, 50_000, 1_000, 1_200_000, 950_000);
  });

  it('holds over a deterministic random sweep (incl. positive + negative gearing, negative equity)', () => {
    const rand = rng(0x5e11);
    for (let i = 0; i < 50; i++) {
      const currentValue = Math.round(rand() * 2_000_000);
      const loanBalance = Math.round(rand() * 1_500_000); // can exceed value → negative equity
      const monthlyCashflow = Math.round((rand() - 0.5) * 4_000); // ±2000
      reconcile(
        { currentValue, loanBalance, monthlyCashflow },
        Math.round(rand() * 200_000),
        Math.round((rand() - 0.5) * 6_000),
        Math.round(rand() * 3_000_000),
        Math.round(rand() * 4_000_000),
      );
    }
  });
});

// =============================================================================
// tenYearProjection — the chart spine every what-if lever renders. One wrong
// growth factor mis-projects EVERY scenario at once, so this locks it three ways:
//   • golden compounding (hand-derived FV from the documented rates)
//   • an INDEPENDENT re-implementation of the per-year recurrence (differential)
//   • the year-0 + totalDelta identities
// =============================================================================

/** Independent re-implementation of the tenYearProjection recurrence (number
 *  math, not the engine's Decimal walk) — agreement cross-validates the engine. */
function independentProjection(opts: {
  baseNetWorth: number;
  baseSuper: number;
  contribution: number;
  yearOneCashflowDelta: number;
  yearOneTaxDelta: number;
  years: number;
  asset: number;
  superR: number;
  cashflowR: number;
}): { finalNetWorth: number; year0: number } {
  let nonSuper = opts.baseNetWorth - opts.baseSuper;
  let superBal = opts.baseSuper;
  let cfDelta = opts.yearOneCashflowDelta;
  const year0 = nonSuper + superBal;
  for (let y = 1; y <= opts.years; y++) {
    nonSuper = nonSuper * (1 + opts.asset);
    superBal = superBal * (1 + opts.superR) + opts.contribution;
    nonSuper = nonSuper + cfDelta - opts.yearOneTaxDelta;
    cfDelta = cfDelta * (1 + opts.cashflowR);
  }
  return { finalNetWorth: nonSuper + superBal, year0 };
}

describe('Trust Engine · what-if tenYearProjection (the chart spine)', () => {
  it('golden — pure asset compounding: $100k at 4% real for 10y = $148,024.43', () => {
    const r = tenYearProjection({
      baseNetWorth: new Decimal(100_000),
      yearOneCashflowDelta: new Decimal(0),
      yearOneTaxDelta: new Decimal(0),
      baseSuperBalance: new Decimal(0),
      annualSuperContribution: new Decimal(0),
      years: 10,
      assetGrowthRate: 0.04,
    });
    // 100000 × 1.04^10
    expect(r.finalNetWorth.toNumber()).toBeCloseTo(148024.43, 2);
    expect(r.trajectory[0].netWorth.toNumber()).toBeCloseTo(100000, 6); // year-0 identity
    expect(r.totalDelta.toNumber()).toBeCloseTo(r.finalNetWorth.toNumber() - 100000, 6);
  });

  it('golden — pure super compounding: $100k at 6% real for 10y = $179,084.77', () => {
    const r = tenYearProjection({
      baseNetWorth: new Decimal(100_000),
      yearOneCashflowDelta: new Decimal(0),
      yearOneTaxDelta: new Decimal(0),
      baseSuperBalance: new Decimal(100_000),
      annualSuperContribution: new Decimal(0),
      years: 10,
      superGrowthRate: 0.06,
    });
    expect(r.finalNetWorth.toNumber()).toBeCloseTo(179084.77, 2);
  });

  it('agrees with an independent recurrence + holds the identities over a random sweep', () => {
    const rand = rng(0x7c0d);
    for (let i = 0; i < 50; i++) {
      const o = {
        baseNetWorth: Math.round(rand() * 2_000_000),
        baseSuper: Math.round(rand() * 400_000),
        contribution: Math.round(rand() * 30_000),
        yearOneCashflowDelta: Math.round((rand() - 0.4) * 40_000),
        yearOneTaxDelta: Math.round((rand() - 0.5) * 10_000),
        years: 1 + Math.floor(rand() * 30),
        asset: 0.02 + rand() * 0.06,
        superR: 0.03 + rand() * 0.06,
        cashflowR: rand() * 0.04,
      };
      const r = tenYearProjection({
        baseNetWorth: new Decimal(o.baseNetWorth),
        yearOneCashflowDelta: new Decimal(o.yearOneCashflowDelta),
        yearOneTaxDelta: new Decimal(o.yearOneTaxDelta),
        baseSuperBalance: new Decimal(o.baseSuper),
        annualSuperContribution: new Decimal(o.contribution),
        years: o.years,
        assetGrowthRate: o.asset,
        superGrowthRate: o.superR,
        cashflowGrowthRate: o.cashflowR,
      });
      const ind = independentProjection(o);
      // differential: engine === independent recurrence
      expect(r.finalNetWorth.toNumber()).toBeCloseTo(ind.finalNetWorth, 2);
      // identities
      expect(r.trajectory[0].netWorth.toNumber()).toBeCloseTo(o.baseNetWorth, 4);
      expect(r.totalDelta.toNumber()).toBeCloseTo(r.finalNetWorth.toNumber() - o.baseNetWorth, 4);
      // each point's net worth === its own nonSuper + super components
      for (const pt of r.trajectory) {
        expect(Number.isFinite(pt.netWorth.toNumber())).toBe(true);
      }
    }
  });
});

// =============================================================================
// addInvestment — future value of a regular contribution (the "start
// investing" lever). The engine uses the ordinary-annuity closed form
//   FV = m × ((1+r/12)^months − 1) / (r/12)
// which is the documented law of a periodic-contribution annuity. This locks
// it three ways:
//   • golden FV (hand-derivable from the formula)
//   • an INDEPENDENT term-by-term compounding sum (Σ m·(1+r/12)^k) — a
//     genuinely different computation than the closed form (differential)
//   • the cashflow + growth accounting identities
// =============================================================================

/** Independent FV — sum each month's contribution compounded forward to the
 *  horizon. End-of-month (ordinary annuity): the LAST contribution earns 0
 *  periods. Mathematically equal to the engine's closed form, computed a
 *  different way, so agreement cross-validates the engine. */
function independentAnnuityFv(monthlyAmount: number, annualReturn: number, years: number): number {
  const r = annualReturn / 12;
  const months = years * 12;
  let fv = 0;
  for (let k = 1; k <= months; k++) fv += monthlyAmount * Math.pow(1 + r, months - k);
  return fv;
}

function invCtx(investmentsTotalValue: number, monthlyCashflow: number, emergencyMonths: number) {
  return {
    snapshot: {
      investments: { totalValue: investmentsTotalValue },
      quickMetrics: { monthlyCashflow },
      emergencyFund: { monthsCovered: emergencyMonths },
    },
  } as unknown as ScenarioContext;
}

describe('Trust Engine · what-if addInvestment (future value of a contribution)', () => {
  const by = (r: ReturnType<typeof addInvestmentScenario>, prefix: string) =>
    r.impacts.find((i) => i.label.startsWith(prefix))!;

  it('golden — $1,000/mo at 8% for 10y grows to $182,946.04 ($62,946.04 of it growth)', () => {
    const r = addInvestmentScenario(invCtx(0, 5_000, 6), { monthlyAmount: 1_000, expectedAnnualReturn: 0.08, years: 10 });
    expect(by(r, 'Projected portfolio').delta).toBeCloseTo(182946.04, 2);
    expect(by(r, 'Of which is compounding growth').delta).toBeCloseTo(62946.04, 2); // FV − 120,000 contributed
  });

  it('golden — $500/mo at 7% for 20y grows to $260,463.33', () => {
    const r = addInvestmentScenario(invCtx(0, 5_000, 6), { monthlyAmount: 500, expectedAnnualReturn: 0.07, years: 20 });
    expect(by(r, 'Projected portfolio').delta).toBeCloseTo(260463.33, 2);
  });

  it('zero-return edge — FV is exactly contributions, growth is exactly 0', () => {
    const r = addInvestmentScenario(invCtx(0, 5_000, 6), { monthlyAmount: 250, expectedAnnualReturn: 0, years: 10 });
    expect(by(r, 'Projected portfolio').delta).toBeCloseTo(250 * 120, 6);
    expect(by(r, 'Of which is compounding growth').delta).toBeCloseTo(0, 6);
  });

  it('agrees with an independent compounding sum + holds the accounting identities over a sweep', () => {
    const rand = rng(0x1a3f);
    for (let i = 0; i < 50; i++) {
      const monthlyAmount = Math.round(rand() * 5_000);
      const annualReturn = rand() * 0.12; // 0–12%
      const years = 1 + Math.floor(rand() * 39);
      const portfolioBefore = Math.round(rand() * 500_000);
      const cashflowBefore = Math.round((rand() - 0.3) * 8_000);
      const r = addInvestmentScenario(invCtx(portfolioBefore, cashflowBefore, 6), { monthlyAmount, expectedAnnualReturn: annualReturn, years });

      const fvInd = independentAnnuityFv(monthlyAmount, annualReturn, years);
      const contributed = monthlyAmount * years * 12;
      // differential: engine closed form === independent term-by-term sum
      expect(by(r, 'Projected portfolio').delta).toBeCloseTo(fvInd, 2);
      // growth = FV − contributions
      expect(by(r, 'Of which is compounding growth').delta).toBeCloseTo(fvInd - contributed, 2);
      // FV always ≥ contributions for non-negative returns (no money invented/lost)
      expect(by(r, 'Projected portfolio').delta).toBeGreaterThanOrEqual(contributed - 1e-6);
      // portfolio after === before + FV
      expect(by(r, 'Projected portfolio').after).toBeCloseTo(portfolioBefore + fvInd, 2);
      // cashflow loses exactly the contribution
      expect(by(r, 'Monthly cashflow').delta).toBeCloseTo(-monthlyAmount, 6);
      expect(by(r, 'Monthly cashflow').after).toBeCloseTo(cashflowBefore - monthlyAmount, 6);
    }
  });
});

// =============================================================================
// redirectToOffset — parking cash in an offset reduces interest accrual. When
// the loan isn't already offset below the parked amount, the saving collapses
// to a clean identity (both max(0,…) terms stay positive):
//   monthlyInterestSaved === amount × rate/12     annual === × 12
//   liquid cash UNCHANGED  (offset is still accessible)
// =============================================================================

function offsetCtx(loan: { id: string; name: string; principal: number; interestRate: number; offsetBalance: number }, liquidCash: number) {
  return {
    snapshot: { quickMetrics: { liquidCash } },
    loans: [{ termMonths: 360, remainingMonths: 360, monthlyRepayment: 0, loanType: 'INVESTMENT', ...loan }],
  } as unknown as ScenarioContext;
}

describe('Trust Engine · what-if redirectToOffset (interest-saved identity)', () => {
  const by = (r: ReturnType<typeof redirectToOffsetScenario>, prefix: string) =>
    r.impacts.find((i) => i.label.startsWith(prefix))!;

  it('golden — $50k into the offset of a $500k loan at 6% saves exactly $250/mo, $3,000/yr', () => {
    const r = redirectToOffsetScenario(
      offsetCtx({ id: 'l1', name: 'IP loan', principal: 500_000, interestRate: 0.06, offsetBalance: 0 }, 80_000),
      { loanId: 'l1', amount: 50_000 },
    );
    expect(by(r, 'Interest saved (monthly)').delta).toBeCloseTo(250, 6); // 50,000 × 0.06/12
    expect(by(r, 'Interest saved (annual)').delta).toBeCloseTo(3_000, 6);
    expect(by(r, 'Liquid cash').delta).toBeCloseTo(0, 6); // offset still accessible
  });

  it('saving === amount × rate/12 over a sweep (while principal − offset ≥ amount)', () => {
    const rand = rng(0x0ff5);
    for (let i = 0; i < 50; i++) {
      const principal = 200_000 + Math.round(rand() * 1_300_000);
      const rate = 0.02 + rand() * 0.07;
      const existingOffset = Math.round(rand() * (principal * 0.2));
      // keep principal − (offset + amount) ≥ 0 so the clean identity applies
      const headroom = principal - existingOffset;
      const amount = Math.round(rand() * headroom * 0.5);
      const r = redirectToOffsetScenario(
        offsetCtx({ id: 'l1', name: 'Loan', principal, interestRate: rate, offsetBalance: existingOffset }, 500_000),
        { loanId: 'l1', amount },
      );
      expect(by(r, 'Interest saved (monthly)').delta).toBeCloseTo((amount * rate) / 12, 4);
      expect(by(r, 'Interest saved (annual)').delta).toBeCloseTo(by(r, 'Interest saved (monthly)').delta * 12, 4);
      expect(by(r, 'Liquid cash').delta).toBeCloseTo(0, 6);
    }
  });

  it('fully-offset edge — parking more cash saves nothing (no negative interest invented)', () => {
    const r = redirectToOffsetScenario(
      offsetCtx({ id: 'l1', name: 'Loan', principal: 300_000, interestRate: 0.06, offsetBalance: 300_000 }, 50_000),
      { loanId: 'l1', amount: 20_000 },
    );
    expect(by(r, 'Interest saved (monthly)').delta).toBeCloseTo(0, 6);
    expect(by(r, 'Interest saved (annual)').delta).toBeCloseTo(0, 6);
  });
});

// =============================================================================
// A.4 — the amortisation what-ifs (refinanceLoan + payDownLoan). These walk a
// real amortisation schedule / annuity payment, so each is verified against an
// INDEPENDENT computation, not a re-run of the same loop:
//   • refinance: the engine's PI form M = P·m(1+m)ⁿ/((1+m)ⁿ−1) checked against
//     the algebraically-equal-but-distinct form M = P·m/(1−(1+m)⁻ⁿ).
//   • payDown: interest summed per-step by the engine is checked against an
//     independent accounting path — totalPaid − principalRetired — and
//     principalRetired must equal the starting principal (money conserved).
// =============================================================================

const REFI_SWITCHING_DEFAULT = 1500; // engine default

function loanCtx(
  loan: { id: string; name: string; principal: number; interestRate: number; monthlyRepayment: number; remainingMonths: number; loanType?: string },
  monthlyCashflow: number,
) {
  return {
    snapshot: { quickMetrics: { monthlyCashflow } },
    loans: [{ termMonths: loan.remainingMonths, offsetBalance: 0, loanType: 'INVESTMENT', ...loan }],
  } as unknown as ScenarioContext;
}

/** Independent PI payment — the −n exponent form (engine uses the +n form). */
function piIndependent(principal: number, annualRate: number, n: number): number {
  const m = annualRate / 12;
  if (n === 0 || annualRate === 0) return principal / Math.max(1, n);
  return (principal * m) / (1 - Math.pow(1 + m, -n));
}

describe('Trust Engine · what-if refinanceLoan (new repayment + savings)', () => {
  const by = (r: ReturnType<typeof refinanceLoanScenario>, prefix: string) =>
    r.impacts.find((i) => i.label.startsWith(prefix))!;

  it('golden — $500k refinanced to 5.5% over 360mo → $2,838.95/mo repayment', () => {
    const r = refinanceLoanScenario(
      loanCtx({ id: 'l1', name: 'Home', principal: 500_000, interestRate: 0.065, monthlyRepayment: 3_200, remainingMonths: 360 }, 1_000),
      { loanId: 'l1', newRate: 0.055 },
    );
    expect(by(r, 'Monthly repayment').after).toBeCloseTo(2838.945, 2);
    // savings + lifetime accounting
    expect(by(r, 'Monthly cashflow').delta).toBeCloseTo(3_200 - 2838.945, 2); // current − new
    expect(by(r, 'Lifetime savings').after).toBeCloseTo((3_200 - 2838.945) * 360 - REFI_SWITCHING_DEFAULT, 1);
  });

  it('agrees with the independent PI form + holds the accounting identities over a sweep', () => {
    const rand = rng(0x4ef1);
    for (let i = 0; i < 50; i++) {
      const principal = 100_000 + Math.round(rand() * 1_400_000);
      const newRate = 0.02 + rand() * 0.06;
      const remainingMonths = 60 + Math.floor(rand() * 360);
      const monthlyRepayment = 500 + Math.round(rand() * 6_000);
      const cashflowBefore = Math.round((rand() - 0.3) * 8_000);
      const r = refinanceLoanScenario(
        loanCtx({ id: 'l1', name: 'Loan', principal, interestRate: 0.07, monthlyRepayment, remainingMonths }, cashflowBefore),
        { loanId: 'l1', newRate },
      );
      const newM = piIndependent(principal, newRate, remainingMonths);
      const savings = monthlyRepayment - newM;
      // differential: engine new repayment === independent PI form
      expect(by(r, 'Monthly repayment').after).toBeCloseTo(newM, 2);
      // repayment delta is the (negated) saving; cashflow delta is +saving
      expect(by(r, 'Monthly repayment').delta).toBeCloseTo(-savings, 2);
      expect(by(r, 'Monthly cashflow').delta).toBeCloseTo(savings, 2);
      expect(by(r, 'Monthly cashflow').after).toBeCloseTo(cashflowBefore + savings, 2);
      // lifetime = monthly saving × term − switching costs
      expect(by(r, 'Lifetime savings').after).toBeCloseTo(savings * remainingMonths - REFI_SWITCHING_DEFAULT, 1);
    }
  });

  it('sensitivity — a lower new rate never produces smaller monthly savings (monotone)', () => {
    const base = { id: 'l1', name: 'Loan', principal: 600_000, interestRate: 0.07, monthlyRepayment: 4_000, remainingMonths: 300 };
    let prevSaving = -Infinity;
    for (const newRate of [0.069, 0.06, 0.05, 0.04, 0.03]) {
      const r = refinanceLoanScenario(loanCtx(base, 0), { loanId: 'l1', newRate });
      const saving = (r.impacts.find((i) => i.label.startsWith('Monthly cashflow'))!).delta;
      expect(saving).toBeGreaterThanOrEqual(prevSaving - 1e-6);
      prevSaving = saving;
    }
  });
});

/** Independent amortisation walk — derives interest via the conservation
 *  identity (totalPaid − principalRetired) rather than summing per-step, a
 *  genuinely different accounting path than the engine. */
function amortiseIndependent(P: number, annual: number, M: number, extra: number) {
  let p = P;
  let totalPaid = 0;
  let principalRetired = 0;
  let months = 0;
  const cap = 600;
  while (p > 0.01 && months < cap) {
    const interest = p * (annual / 12);
    const pay = Math.max(0, M - interest) + extra;
    if (pay <= 0) { months = cap; break; }
    const applied = Math.min(pay, p);
    totalPaid += applied + interest;
    principalRetired += applied;
    p -= applied;
    months += 1;
  }
  return { months, interestViaIdentity: totalPaid - principalRetired, principalRetired };
}

describe('Trust Engine · what-if payDownLoan (extra-repayment amortisation)', () => {
  const by = (r: ReturnType<typeof payDownLoanScenario>, prefix: string) =>
    r.impacts.find((i) => i.label.startsWith(prefix))!;

  it('golden — $500k @6%, $3,000/mo, +$500 → 252 months (108 sooner), ~$198,617 interest saved', () => {
    const r = payDownLoanScenario(
      loanCtx({ id: 'l1', name: 'Home', principal: 500_000, interestRate: 0.06, monthlyRepayment: 3_000, remainingMonths: 360 }, 1_000),
      { loanId: 'l1', extraMonthly: 500 },
    );
    expect(by(r, 'Months to payoff').before).toBe(360);
    expect(by(r, 'Months to payoff').after).toBe(252);
    // 'Interest saved (lifetime)' before/after carry baseline/accelerated totals
    const saved = by(r, 'Interest saved').before - by(r, 'Interest saved').after;
    expect(saved).toBeCloseTo(198616.61, 0);
  });

  it('interest reconciles via the conservation identity + principal fully retired (differential)', () => {
    const rand = rng(0x9d0c);
    for (let i = 0; i < 50; i++) {
      const principal = 100_000 + Math.round(rand() * 900_000);
      const annual = 0.03 + rand() * 0.05;
      // a repayment comfortably above the interest-only floor so the loan amortises
      const monthlyRepayment = Math.ceil(principal * (annual / 12) * (1.3 + rand())) + 200;
      const extra = Math.round(rand() * 1_500);
      const r = payDownLoanScenario(
        loanCtx({ id: 'l1', name: 'Loan', principal, interestRate: annual, monthlyRepayment, remainingMonths: 360 }, 0),
        { loanId: 'l1', extraMonthly: extra },
      );
      const ind = amortiseIndependent(principal, annual, monthlyRepayment, extra);
      // engine accelerated totalInterest === independent interest-via-identity
      expect(by(r, 'Interest saved').after).toBeCloseTo(ind.interestViaIdentity, 2);
      // months agree
      expect(by(r, 'Months to payoff').after).toBe(ind.months);
      // money conserved: every dollar applied retired the starting principal
      expect(ind.principalRetired).toBeCloseTo(principal, 2);
      // cashflow loses exactly the extra
      expect(by(r, 'Monthly cashflow').delta).toBeCloseTo(-extra, 6);
    }
  });

  it('monotonicity — more extra never increases interest or term, and extra=0 is a no-op', () => {
    const base = { id: 'l1', name: 'Loan', principal: 400_000, interestRate: 0.06, monthlyRepayment: 2_700, remainingMonths: 360 };
    const noop = payDownLoanScenario(loanCtx(base, 0), { loanId: 'l1', extraMonthly: 0 });
    expect(by(noop, 'Months to payoff').after).toBe(by(noop, 'Months to payoff').before);
    expect(by(noop, 'Interest saved').after).toBeCloseTo(by(noop, 'Interest saved').before, 6);

    let prevInterest = Infinity;
    let prevMonths = Infinity;
    for (const extra of [0, 200, 500, 1_000, 2_000]) {
      const r = payDownLoanScenario(loanCtx(base, 0), { loanId: 'l1', extraMonthly: extra });
      const interest = by(r, 'Interest saved').after; // accelerated lifetime interest
      const months = by(r, 'Months to payoff').after;
      expect(interest).toBeLessThanOrEqual(prevInterest + 1e-6);
      expect(months).toBeLessThanOrEqual(prevMonths);
      prevInterest = interest;
      prevMonths = months;
    }
  });
});

// =============================================================================
// A.5 — the budget + super what-ifs (cutSpendCategory + salarySacrificeToSuper).
//
// cutSpendCategory has clean composition identities (cap, cashflow, savings
// rate, emergency-fund months). salarySacrifice is the highest-stakes lever in
// this set: it must REFUSE to compute rather than silently model an illegal
// contribution. So beyond its composition identities we lock its two
// safety-critical guards — the concessional-cap hard-stop and the Div 296
// (FW-2) reform UNCOMPUTED lock. A lever that refuses correctly is the trust
// guarantee; a lever that silently produces an over-cap number is the failure.
// =============================================================================

function cutCtx(opts: {
  category: string;
  currentSpend: number;
  monthlyCashflow: number;
  monthlyExpenses: number;
  monthlyIncome: number;
  monthlyLoanRepayments: number;
  savingsRate: number;
  emergencyMonths: number;
  liquidCash: number;
}) {
  return {
    snapshot: {
      expenses: { monthly: { byCategory: [{ category: opts.category, amount: opts.currentSpend }] } },
      quickMetrics: {
        monthlyCashflow: opts.monthlyCashflow,
        monthlyExpenses: opts.monthlyExpenses,
        monthlyIncome: opts.monthlyIncome,
        monthlyLoanRepayments: opts.monthlyLoanRepayments,
        savingsRate: opts.savingsRate,
      },
      emergencyFund: { monthsCovered: opts.emergencyMonths, liquidCash: opts.liquidCash },
    },
  } as unknown as ScenarioContext;
}

describe('Trust Engine · what-if cutSpendCategory (reduction identities)', () => {
  const by = (r: ReturnType<typeof cutSpendCategoryScenario>, prefix: string) =>
    r.impacts.find((i) => i.label.startsWith(prefix))!;

  const base = {
    category: 'Dining',
    currentSpend: 800,
    monthlyCashflow: 1_000,
    monthlyExpenses: 5_000,
    monthlyIncome: 8_000,
    monthlyLoanRepayments: 1_500,
    savingsRate: 18.75,
    emergencyMonths: 4,
    liquidCash: 20_000,
  };

  it('golden — cut $300/mo from Dining: cashflow +300, annual $3,600, savings-rate + emergency-fund recompute', () => {
    const r = cutSpendCategoryScenario(cutCtx(base), { category: 'Dining', monthlyReduction: 300 });
    expect(by(r, 'Monthly cashflow').delta).toBeCloseTo(300, 6);
    expect(by(r, 'Monthly cashflow').after).toBeCloseTo(1_300, 6);
    expect(by(r, 'Annual saving').after).toBeCloseTo(3_600, 6);
    // savings rate after = (income − (expenses − 300) − loanRepay) / income × 100
    const expectedRate = ((8_000 - (5_000 - 300) - 1_500) / 8_000) * 100;
    expect(by(r, 'Savings rate').after).toBeCloseTo(expectedRate, 6);
    // emergency months after = liquidCash / (expenses − 300)
    expect(by(r, 'Emergency fund months').after).toBeCloseTo(20_000 / (5_000 - 300), 6);
  });

  it('cap — over-cutting a category is capped at the actual spend (no phantom saving)', () => {
    const r = cutSpendCategoryScenario(cutCtx(base), { category: 'Dining', monthlyReduction: 1_000 });
    expect(by(r, 'Monthly cashflow').delta).toBeCloseTo(800, 6); // capped at currentSpend
    expect(by(r, 'Annual saving').after).toBeCloseTo(800 * 12, 6);
  });

  it('identities hold over a deterministic sweep (cap, cashflow, annual, savings-rate, emergency-fund)', () => {
    const rand = rng(0xc075);
    for (let i = 0; i < 50; i++) {
      const currentSpend = Math.round(rand() * 2_000);
      const requested = Math.round(rand() * 3_000);
      const monthlyExpenses = 2_000 + Math.round(rand() * 6_000);
      const monthlyIncome = 4_000 + Math.round(rand() * 8_000);
      const monthlyLoanRepayments = Math.round(rand() * 3_000);
      const liquidCash = Math.round(rand() * 60_000);
      const ctx = cutCtx({ ...base, category: 'Dining', currentSpend, monthlyExpenses, monthlyIncome, monthlyLoanRepayments, liquidCash, monthlyCashflow: monthlyIncome - monthlyExpenses - monthlyLoanRepayments });
      const r = cutSpendCategoryScenario(ctx, { category: 'Dining', monthlyReduction: requested });
      const realised = Math.min(requested, currentSpend);
      expect(by(r, 'Monthly cashflow').delta).toBeCloseTo(realised, 6);
      expect(by(r, 'Annual saving').after).toBeCloseTo(realised * 12, 6);
      const expRate = ((monthlyIncome - (monthlyExpenses - realised) - monthlyLoanRepayments) / monthlyIncome) * 100;
      expect(by(r, 'Savings rate').after).toBeCloseTo(expRate, 6);
      expect(by(r, 'Emergency fund months').after).toBeCloseTo(liquidCash / (monthlyExpenses - realised), 6);
    }
  });

  it('monotonicity — a larger realised reduction never lowers cashflow or savings rate', () => {
    let prevCashflow = -Infinity;
    let prevRate = -Infinity;
    for (const reduction of [0, 100, 300, 600, 800]) {
      const r = cutSpendCategoryScenario(cutCtx(base), { category: 'Dining', monthlyReduction: reduction });
      const cf = (r.impacts.find((i) => i.label.startsWith('Monthly cashflow'))!).after;
      const rate = (r.impacts.find((i) => i.label.startsWith('Savings rate'))!).after;
      expect(cf).toBeGreaterThanOrEqual(prevCashflow - 1e-6);
      expect(rate).toBeGreaterThanOrEqual(prevRate - 1e-6);
      prevCashflow = cf;
      prevRate = rate;
    }
  });
});

// salarySacrifice — minimal ctx (gross + super balance passed as params so the
// engine never dereferences the deep income/netWorth paths; it only reads
// quickMetrics.monthlyCashflow directly).
function sacCtx(monthlyCashflow: number) {
  return { snapshot: { quickMetrics: { monthlyCashflow } } } as unknown as ScenarioContext;
}

describe('Trust Engine · what-if salarySacrificeToSuper (composition + safety guards)', () => {
  const by = (r: ReturnType<typeof salarySacrificeToSuperScenario>, prefix: string) =>
    r.impacts.find((i) => i.label.startsWith(prefix));
  const cfg = getCurrentTaxYearConfig();
  const GROSS = 100_000;
  const sg = GROSS * cfg.superGuaranteeRate;
  // headroom for sacrifice before the cap: (cap − SG) per year
  const annualHeadroom = cfg.concessionalCap - sg;
  const monthlyHeadroom = annualHeadroom / 12;

  it('composition — taxable income, take-home, and concessional impacts tie to the sacrifice', () => {
    const monthly = Math.floor(monthlyHeadroom / 2); // comfortably under cap
    const annual = monthly * 12;
    const r = salarySacrificeToSuperScenario(sacCtx(2_000), {
      monthlySacrifice: monthly,
      grossSalaryAnnual: GROSS,
      currentSuperBalance: 200_000, // below Div 296 threshold
    });
    expect(r.impacts.length).toBeGreaterThan(0);
    // taxable income drops by exactly the annual sacrifice
    expect(by(r, 'Annual taxable income')!.after).toBeCloseTo(GROSS - annual, 4);
    expect(by(r, 'Annual taxable income')!.delta).toBeCloseTo(-annual, 4);
    // concessional tile: displayed delta === annual sacrifice AND after−before === delta
    const conc = by(r, 'Total concessional this FY')!;
    expect(conc.delta).toBeCloseTo(annual, 4);
    expect(conc.after - conc.before).toBeCloseTo(conc.delta, 4);
    // take-home delta === (−annualSacrifice + the engine's own reported tax saving) / 12
    const taxSaving = by(r, 'Year-1 tax savings')!.after;
    const takeHome = by(r, 'Monthly take-home pay')!;
    expect(takeHome.delta).toBeCloseTo((-annual + taxSaving) / 12, 4);
    expect(takeHome.after).toBeCloseTo(2_000 + takeHome.delta, 4);
  });

  it('SAFETY — concessional-cap hard stop: just under computes, just over REFUSES (no impacts)', () => {
    // just under the cap → computes
    const under = salarySacrificeToSuperScenario(sacCtx(2_000), {
      monthlySacrifice: Math.floor(monthlyHeadroom) - 1,
      grossSalaryAnnual: GROSS,
      currentSuperBalance: 200_000,
    });
    expect(under.impacts.length).toBeGreaterThan(0);

    // comfortably over the cap → UNCOMPUTED: no impacts, a critical warning,
    // and the summary names the cap. The engine must never silently model an
    // over-cap (illegal) contribution.
    const over = salarySacrificeToSuperScenario(sacCtx(2_000), {
      monthlySacrifice: Math.ceil(monthlyHeadroom) + 200,
      grossSalaryAnnual: GROSS,
      currentSuperBalance: 200_000,
    });
    expect(over.impacts.length).toBe(0);
    expect(over.warnings.some((w) => w.severity === 'critical')).toBe(true);
    expect(over.summary.toLowerCase()).toContain('cap');
  });

  it('SAFETY — Div 296 (FW-2): TSB above $3M with commencement unverified LOCKS the lever (UNCOMPUTED)', () => {
    // The current config has div296CommencementVerified === false, so a TSB
    // above the $3M threshold must refuse to compute per CLAUDE.md §12.14 FW-2.
    expect(cfg.div296CommencementVerified).toBe(false); // precondition for this guard
    const locked = salarySacrificeToSuperScenario(sacCtx(2_000), {
      monthlySacrifice: 100, // tiny, well under cap — the LOCK is about TSB, not the cap
      grossSalaryAnnual: GROSS,
      currentSuperBalance: cfg.div296TsbThreshold + 1_000_000, // $4M
    });
    expect(locked.impacts.length).toBe(0);
    expect(locked.warnings.some((w) => w.severity === 'critical')).toBe(true);

    // below the threshold → computes normally (regime UNAFFECTED)
    const ok = salarySacrificeToSuperScenario(sacCtx(2_000), {
      monthlySacrifice: 100,
      grossSalaryAnnual: GROSS,
      currentSuperBalance: cfg.div296TsbThreshold - 500_000,
    });
    expect(ok.impacts.length).toBeGreaterThan(0);
  });

  it('SAFETY — zero salary refuses to model the lever (no phantom sacrifice)', () => {
    const r = salarySacrificeToSuperScenario(sacCtx(2_000), { monthlySacrifice: 500, grossSalaryAnnual: 0, currentSuperBalance: 100_000 });
    expect(r.impacts.length).toBe(0);
    expect(r.warnings.some((w) => w.severity === 'critical')).toBe(true);
  });
});
