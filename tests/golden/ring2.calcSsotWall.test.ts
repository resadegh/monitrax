/**
 * Calc-SSOT Wall — B1/B2/B3 ratchets
 * (docs/architecture/CALC_SSOT_WALL.md · MATRIX_FIX_DISCIPLINE.md gates 1/4).
 *
 * Ring-0: interest-only loans never cost $0; a one-off contributes 0 to every
 * monthly run-rate; a managed rental's agent fee is subtracted exactly ONCE
 * in cashflow AND once in tax — never twice, never zero.
 * Ring-2: the same loan / expense / managed rental reads identically across
 * the canonical producers that feed income ↔ tax ↔ cashflow ↔ property ↔
 * expenses surfaces (single-producer identity, §12.2.1).
 */
import { describe, it, expect } from 'vitest';
import {
  computePropertyCashflow,
  resolveLoanMonthlyCost,
} from '../../lib/calculations/propertyCashflow';
import { monthlyRunRate, annualRunRate, toMonthly } from '../../lib/utils/frequencies';
import {
  calculateTaxPosition,
  calculateTaxPositionDecimal,
} from '../../lib/tax-engine/position/taxPositionCalculator';

describe('Wall B1 · resolveLoanMonthlyCost — the ONE per-loan cost, never silently $0', () => {
  const ioLoan = { id: 'l-io', principal: 500_000, interestRateAnnual: 0.06, minRepayment: 0, repaymentFrequency: 'MONTHLY' };

  it('interest-only (no repayment set) → the INTEREST FLOOR, never $0', () => {
    const r = resolveLoanMonthlyCost(ioLoan);
    expect(r.monthly).toBeCloseTo((500_000 * 0.06) / 12, 6); // 2,500
    expect(r.flooredToInterest).toBe(true);
  });

  it('declared repayment wins when set, cadence-normalised (raw minRepayment was cadence-blind)', () => {
    expect(resolveLoanMonthlyCost({ ...ioLoan, minRepayment: 3000 }).monthly).toBeCloseTo(3000, 6);
    expect(
      resolveLoanMonthlyCost({ ...ioLoan, minRepayment: 700, repaymentFrequency: 'WEEKLY' }).monthly,
    ).toBeCloseTo((700 * 52) / 12, 6); // 3,033.33 — NOT 700
  });

  it('Ring-2 identity: the property engine loop and the standalone producer agree by construction', () => {
    const cf = computePropertyCashflow({ loans: [ioLoan] });
    const standalone = resolveLoanMonthlyCost(ioLoan);
    expect(cf.loanLines[0].monthly).toBeCloseTo(standalone.monthly, 9);
    expect(cf.loanLines[0].flooredToInterest).toBe(standalone.flooredToInterest);
  });
});

describe('VR-013 · loan cost is ACTUALS-FIRST everywhere — the Broadbeach five-numbers failure', () => {
  // Live shape from Ring-3 VR-013: $228,000 interest-only @ 6.69%, two linked
  // repayments ($1,131 on 18 May, $1,295 on 18 Jun 2026). Property surfaces
  // showed the actuals figure (~$1,191) while expenses/overview showed the
  // contractual floor (~$1,271) because their resolver calls fed NO
  // transactions. The fix feeds every surface the same linked repayments
  // over the ONE trailing-12-month window (lib/services/loanCosts.ts).
  const bbLoan = { id: 'l-bb', principal: 228_000, interestRateAnnual: 0.0669, minRepayment: 0, repaymentFrequency: 'MONTHLY' };
  const bbTx = [
    { id: 't-may', loanId: 'l-bb', date: new Date(Date.UTC(2026, 4, 18)), amount: 1131 },
    { id: 't-jun', loanId: 'l-bb', date: new Date(Date.UTC(2026, 5, 18)), amount: 1295 },
  ];
  const FLOOR = (228_000 * 0.0669) / 12; // 1,271.10 — the contractual estimate
  const ACTUALS = ((1131 + 1295) / 62) * 30.4375; // day-span run-rate ≈ 1,190.97

  it('with linked repayments: actuals win (≈$1,191), never the floor (≈$1,271)', () => {
    const r = resolveLoanMonthlyCost(bbLoan, bbTx);
    expect(r.monthly).toBeCloseTo(ACTUALS, 6);
    expect(r.monthly).toBeCloseTo(1190.97, 0);
    expect(r.usedActuals).toBe(true);
    expect(r.flooredToInterest).toBe(false);
    expect(r.monthlyInterest).toBeCloseTo(FLOOR, 2); // the estimate stays available as reference
  });

  it('without repayments the floor still guards (never $0) — the declared→floor fallback', () => {
    const r = resolveLoanMonthlyCost(bbLoan);
    expect(r.monthly).toBeCloseTo(FLOOR, 2); // 1,271.10
    expect(r.flooredToInterest).toBe(true);
  });

  it('Ring-2 identity: the property engine fed the SAME transactions lands the SAME actuals number', () => {
    const cf = computePropertyCashflow({ loans: [bbLoan], transactions: bbTx });
    expect(cf.loanLines[0].monthly).toBeCloseTo(ACTUALS, 9);
  });

  it('the window is trailing-12-months, NOT FY-scoped: prior-FY repayments still drive the run-rate', async () => {
    // 18 May / 18 Jun 2026 are FY25-26; "today" 17 Jul 2026 is FY26-27. An
    // FY-scoped filter finds none → floor → the VR-013 divergence. The ONE
    // canonical window keeps them, so the resolver reads actuals.
    const { propertyActualsWindowStart } = await import('../../lib/calculations/propertyActualsWindow');
    const windowStart = propertyActualsWindowStart(new Date(Date.UTC(2026, 6, 17)));
    const inWindow = bbTx.filter((t) => t.date >= windowStart); // the loanCosts.ts filter shape
    expect(inWindow).toHaveLength(2); // an FY filter would keep 0
    const r = resolveLoanMonthlyCost(bbLoan, inWindow);
    expect(r.usedActuals).toBe(true);
    expect(r.monthly).toBeCloseTo(ACTUALS, 6);
  });
});

describe('Wall B2 · monthlyRunRate — a one-off contributes 0 to every run-rate', () => {
  it('one-off → 0; recurring → toMonthly; annual sibling ×12', () => {
    const oneOff = { amount: 11_385, frequency: 'MONTHLY', isRecurring: false };
    expect(monthlyRunRate(oneOff)).toBe(0); // never $136,620/yr of phantom spend
    expect(annualRunRate(oneOff)).toBe(0);
    const recurring = { amount: 2400, frequency: 'ANNUAL', isRecurring: true };
    expect(monthlyRunRate(recurring)).toBeCloseTo(200, 9);
    expect(monthlyRunRate({ amount: 100, frequency: 'WEEKLY' })).toBeCloseTo(toMonthly(100, 'WEEKLY'), 9);
  });

  it('Ring-2 identity: matches the property engine gate (declared path, no actuals)', () => {
    const cf = computePropertyCashflow({
      expenses: [
        { id: 'e1', amount: 11_385, frequency: 'MONTHLY', isRecurring: false }, // one-off
        { id: 'e2', amount: 300, frequency: 'MONTHLY', isRecurring: true },
      ],
    });
    expect(cf.monthlyExpenses).toBeCloseTo(300, 6); // the one-off contributed 0 there too
  });
});

describe('Wall B3 · managed rental — the agent fee is counted EXACTLY ONCE in cashflow, gross matches tax', () => {
  // Broadbeach live shape: $680/wk declared MANAGED gross; agent deposits
  // $2,515/mo NET; the confirmed derived fee $431.67/mo (recurring).
  // Deposits are spaced exactly DAYS_PER_MONTH (30.4375d) apart so the
  // day-span resolver lands on exactly $2,515/mo and the identities below
  // stay exact (calendar-month gaps of 31d resolve to ~2,469 — an artefact
  // of the averaging window, not of the gross-up under test).
  const MONTH_MS = 30.4375 * 86_400_000;
  const DATES = [0, 1, 2, 3].map((m) => new Date(Date.UTC(2026, 3, 1) + m * MONTH_MS));
  const GROSS_MONTHLY = (680 * 52) / 12; // 2,946.67
  const FEE = GROSS_MONTHLY - 2515; // 431.67
  const input = {
    income: [{ id: 'i-bb', type: 'RENTAL', amount: 680, frequency: 'WEEKLY', rentalMode: 'MANAGED' }],
    expenses: [
      { id: 'e-fee', amount: FEE, frequency: 'MONTHLY', isRecurring: true, derivedFromIncomeId: 'i-bb' },
    ],
    transactions: DATES.map((date, i) => ({ id: `t${i}`, incomeId: 'i-bb', date, amount: 2515 })),
  };

  it('rent actuals gross back up: rent reads GROSS, cashflow = net (fee subtracted once, never twice)', () => {
    const cf = computePropertyCashflow(input);
    expect(cf.monthlyRent).toBeCloseTo(GROSS_MONTHLY, 0); // 2,946.67 — not the 2,515 net
    expect(cf.monthlyExpenses).toBeCloseTo(FEE, 0); // the fee, once
    expect(cf.monthlyCashflow).toBeCloseTo(2515, 0); // net once — pre-fix: 2,083 (fee twice)
  });

  it('Ring-2 cross-surface identity: cashflow GROSS === tax GROSS; the fee is the deduction on both', () => {
    const cf = computePropertyCashflow(input);
    const tax = calculateTaxPosition({
      incomes: [{ id: 'i-bb', name: 'Rent — Broadbeach', type: 'RENTAL', amount: 680, frequency: 'WEEKLY', propertyId: 'p-bb' }],
      expenses: [
        { id: 'e-fee', name: 'Agent management & costs', category: 'PROPERTY_MANAGEMENT', amount: FEE, frequency: 'MONTHLY', isTaxDeductible: true, isRecurring: true, propertyId: 'p-bb' },
      ],
      depreciations: [],
      superContributions: { concessional: 0, nonConcessional: 0 },
      financialYear: '2025-26',
    });
    expect(cf.monthlyRent * 12).toBeCloseTo(tax.income.rental, 0); // 35,360 both
    expect(cf.monthlyExpenses * 12).toBeCloseTo(tax.deductions.property, 0); // 5,180 both
    // taxable = gross − fee = the net actually received, annualised — and
    // cashflow lands the same net: the two surfaces agree by construction.
    expect(tax.tax.taxableIncome).toBeCloseTo(cf.monthlyCashflow * 12, 0);
    const dec = calculateTaxPositionDecimal({
      incomes: [{ id: 'i-bb', name: 'Rent — Broadbeach', type: 'RENTAL', amount: 680, frequency: 'WEEKLY', propertyId: 'p-bb' }],
      expenses: [
        { id: 'e-fee', name: 'Agent management & costs', category: 'PROPERTY_MANAGEMENT', amount: FEE, frequency: 'MONTHLY', isTaxDeductible: true, isRecurring: true, propertyId: 'p-bb' },
      ],
      depreciations: [],
      superContributions: { concessional: 0, nonConcessional: 0 },
      financialYear: '2025-26',
    });
    expect(Number(dec.income.rental.toString())).toBeCloseTo(tax.income.rental, 6);
  });

  it('regression guards: DIRECT streams and declared-driven MANAGED streams get NO add-back', () => {
    // DIRECT: the deposit IS gross — grossing up would double-count income.
    const direct = computePropertyCashflow({
      ...input,
      income: [{ id: 'i-bb', type: 'RENTAL', amount: 680, frequency: 'WEEKLY', rentalMode: 'DIRECT' }],
    });
    expect(direct.monthlyRent).toBeCloseTo(2515, 0); // actuals as-is
    // Declared-driven MANAGED (no transactions): declared already IS gross.
    const declared = computePropertyCashflow({ ...input, transactions: [] });
    expect(declared.monthlyRent).toBeCloseTo(GROSS_MONTHLY, 0); // no add-back on top
    expect(declared.monthlyCashflow).toBeCloseTo(2515, 0);
  });

  it('a one-off anomaly excess (repair) never enters the gross-up or the run-rate', () => {
    const cf = computePropertyCashflow({
      ...input,
      expenses: [
        ...input.expenses,
        { id: 'e-excess', amount: 250, frequency: 'MONTHLY', isRecurring: false, derivedFromIncomeId: 'i-bb' },
      ],
    });
    expect(cf.monthlyRent).toBeCloseTo(GROSS_MONTHLY, 0); // unchanged
    expect(cf.monthlyExpenses).toBeCloseTo(FEE, 0); // one-off excluded from run-rate
  });
});
