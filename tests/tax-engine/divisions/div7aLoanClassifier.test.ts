/**
 * Phase 41e.6 — Div 7A loan classifier tests.
 *
 * Pins the s109D / s109N dispatch contract for each combination of
 * loan facts.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyDiv7ALoans,
  calculateMinimumYearlyRepayment,
  type Div7ALoanInput,
} from '@/lib/tax-engine/divisions/div7aLoanClassifier';

const baseLoan = (o: Partial<Div7ALoanInput> = {}): Div7ALoanInput => ({
  loanId: 'loan-1',
  openingBalance: 100000,
  yearsRemaining: 7,
  benchmarkRate: 0.0837, // FY24-25 ATO benchmark
  paymentsMadeThisFy: 0,
  hasComplianceAgreement: true,
  ...o,
});

describe('calculateMinimumYearlyRepayment — s109N annuity formula', () => {
  it('basic 7-year amortising loan', () => {
    // $100k, 7yr, 8.37% — annuity formula
    const mrp = calculateMinimumYearlyRepayment(100000, 7, 0.0837);
    // Expected ≈ $19,476 (manual: 100000 * (0.0837 * 1.0837^7) / (1.0837^7 - 1))
    expect(mrp).toBeGreaterThan(19000);
    expect(mrp).toBeLessThan(20000);
  });

  it('zero balance → zero MRP', () => {
    expect(calculateMinimumYearlyRepayment(0, 7, 0.05)).toBe(0);
  });

  it('zero years → zero MRP', () => {
    expect(calculateMinimumYearlyRepayment(50000, 0, 0.05)).toBe(0);
  });

  it('zero rate → straight-line repayment', () => {
    // $70k over 7 years, no interest = $10k/year
    expect(calculateMinimumYearlyRepayment(70000, 7, 0)).toBe(10000);
  });

  it('higher rate → higher MRP', () => {
    const lowRate = calculateMinimumYearlyRepayment(100000, 7, 0.05);
    const highRate = calculateMinimumYearlyRepayment(100000, 7, 0.12);
    expect(highRate).toBeGreaterThan(lowRate);
  });
});

describe('classifyDiv7ALoans — COMPLIANT path', () => {
  it('payments meet MRP → COMPLIANT, no deemed dividend', () => {
    const r = classifyDiv7ALoans([
      baseLoan({ paymentsMadeThisFy: 25000 }), // > MRP of ~19.5k
    ]);
    expect(r.classifications[0].status).toBe('COMPLIANT');
    expect(r.classifications[0].deemedDividendAmount).toBe(0);
    expect(r.totalDeemedDividend).toBe(0);
    expect(r.highestSeverity).toBe('COMPLIANT');
  });

  it('payments exactly equal MRP → COMPLIANT', () => {
    const mrp = calculateMinimumYearlyRepayment(100000, 7, 0.0837);
    const r = classifyDiv7ALoans([
      baseLoan({ paymentsMadeThisFy: mrp }),
    ]);
    expect(r.classifications[0].status).toBe('COMPLIANT');
  });
});

describe('classifyDiv7ALoans — MRP_SHORTFALL path', () => {
  it('partial payment → shortfall → deemed dividend on shortfall', () => {
    const r = classifyDiv7ALoans([
      baseLoan({ paymentsMadeThisFy: 10000 }), // less than MRP ~19.5k
    ]);
    expect(r.classifications[0].status).toBe('MRP_SHORTFALL');
    expect(r.classifications[0].mrpShortfall).toBeGreaterThan(0);
    expect(r.classifications[0].deemedDividendAmount).toBeGreaterThan(0);
    // Deemed dividend = shortfall, NOT entire balance
    expect(r.classifications[0].deemedDividendAmount).toBeLessThan(100000);
    expect(r.highestSeverity).toBe('MRP_SHORTFALL');
  });

  it('zero payments → full MRP as deemed dividend', () => {
    const r = classifyDiv7ALoans([
      baseLoan({ paymentsMadeThisFy: 0 }),
    ]);
    expect(r.classifications[0].status).toBe('MRP_SHORTFALL');
    const mrp = calculateMinimumYearlyRepayment(100000, 7, 0.0837);
    expect(r.classifications[0].mrpShortfall).toBeCloseTo(mrp, 2);
  });
});

describe('classifyDiv7ALoans — NO_AGREEMENT path', () => {
  it('no written agreement → entire balance as deemed dividend (s109D)', () => {
    const r = classifyDiv7ALoans([
      baseLoan({ hasComplianceAgreement: false, paymentsMadeThisFy: 50000 }),
    ]);
    expect(r.classifications[0].status).toBe('NO_AGREEMENT');
    expect(r.classifications[0].deemedDividendAmount).toBe(100000); // full balance
    expect(r.totalDeemedDividend).toBe(100000);
  });
});

describe('classifyDiv7ALoans — SUB_TRUST_UPE path', () => {
  it('sub-trust UPE flagged → status SUB_TRUST_UPE, zero deemed dividend (deferred)', () => {
    const r = classifyDiv7ALoans([
      baseLoan({ isSubTrustUpe: true, hasComplianceAgreement: false }),
    ]);
    // Sub-trust UPE takes priority over NO_AGREEMENT
    expect(r.classifications[0].status).toBe('SUB_TRUST_UPE');
    expect(r.classifications[0].deemedDividendAmount).toBe(0);
    expect(r.uncomputed.some((u) => u.id === 'UC-DIV7A-SUBTRUST-UPE')).toBe(true);
    // TR 2010/3 + PCG 2017/13 cited
    expect(r.citations.some((c) => c.reference === '2010/3')).toBe(true);
    expect(r.citations.some((c) => c.reference === '2017/13')).toBe(true);
  });
});

describe('classifyDiv7ALoans — UNCOMPUTED + citations', () => {
  it('any deemed dividend → UC-DIV7A-DISTRIBUTABLE-SURPLUS surfaces (s109Y cap)', () => {
    const r = classifyDiv7ALoans([
      baseLoan({ paymentsMadeThisFy: 0 }),
    ]);
    expect(r.uncomputed.some((u) => u.id === 'UC-DIV7A-DISTRIBUTABLE-SURPLUS')).toBe(true);
    expect(r.citations.some((c) => c.reference === 's109Y')).toBe(true);
  });

  it('compliant loans → no DISTRIBUTABLE-SURPLUS flag', () => {
    const r = classifyDiv7ALoans([
      baseLoan({ paymentsMadeThisFy: 25000 }),
    ]);
    expect(r.uncomputed.find((u) => u.id === 'UC-DIV7A-DISTRIBUTABLE-SURPLUS')).toBeUndefined();
  });

  it('always cites Div 7A + s109D + s109N', () => {
    const r = classifyDiv7ALoans([baseLoan()]);
    expect(r.citations.some((c) => c.reference === 'Div 7A')).toBe(true);
    expect(r.citations.some((c) => c.reference === 's109D')).toBe(true);
    expect(r.citations.some((c) => c.reference === 's109N')).toBe(true);
  });

  it('empty loan list → COMPLIANT highestSeverity, no flags', () => {
    const r = classifyDiv7ALoans([]);
    expect(r.classifications).toEqual([]);
    expect(r.totalDeemedDividend).toBe(0);
    expect(r.highestSeverity).toBe('COMPLIANT');
    expect(r.uncomputed).toEqual([]);
  });
});

describe('classifyDiv7ALoans — multi-loan aggregation', () => {
  it('mixed compliant + non-compliant → highestSeverity = worst, totalDeemedDividend sums', () => {
    const r = classifyDiv7ALoans([
      baseLoan({ loanId: 'good', paymentsMadeThisFy: 25000 }),
      baseLoan({
        loanId: 'bad',
        openingBalance: 50000,
        hasComplianceAgreement: false,
      }),
    ]);
    expect(r.classifications[0].status).toBe('COMPLIANT');
    expect(r.classifications[1].status).toBe('NO_AGREEMENT');
    expect(r.highestSeverity).toBe('NO_AGREEMENT');
    expect(r.totalDeemedDividend).toBe(50000); // only the bad loan
  });

  it('NO_AGREEMENT + MRP_SHORTFALL → highestSeverity = NO_AGREEMENT', () => {
    const r = classifyDiv7ALoans([
      baseLoan({ loanId: 'shortfall', paymentsMadeThisFy: 5000 }),
      baseLoan({ loanId: 'noagree', hasComplianceAgreement: false }),
    ]);
    expect(r.highestSeverity).toBe('NO_AGREEMENT');
  });
});

describe('integration with entityTaxRouter — COMPANY dispatch', () => {
  it('COMPANY without div7aLoans → still UNCOMPUTED', async () => {
    const { calculateEntityTaxPosition } = await import(
      '@/lib/tax-engine/entity/entityTaxRouter'
    );
    const result = calculateEntityTaxPosition({
      entityId: 'co',
      entityType: 'COMPANY',
      fy: { financialYear: '2024-25', label: 'FY24-25' },
      incomes: [],
      expenses: [],
      depreciations: [],
    });
    expect(result.result).toBeNull();
    expect(result.uncomputed.some((u) => u.id === 'UC-ENTITY-COMPANY')).toBe(true);
  });

  it('COMPANY with div7aLoans → real classification on result.div7aClassification', async () => {
    const { calculateEntityTaxPosition } = await import(
      '@/lib/tax-engine/entity/entityTaxRouter'
    );
    const result = calculateEntityTaxPosition({
      entityId: 'co',
      entityType: 'COMPANY',
      fy: { financialYear: '2024-25', label: 'FY24-25' },
      incomes: [],
      expenses: [],
      depreciations: [],
      div7aLoans: [
        {
          loanId: 'l1',
          openingBalance: 100000,
          yearsRemaining: 7,
          benchmarkRate: 0.0837,
          paymentsMadeThisFy: 0,
          hasComplianceAgreement: true,
        },
      ],
    });
    expect(result.result).not.toBeNull();
    const wrapper = result.result as {
      div7aClassification: { highestSeverity: string; totalDeemedDividend: number };
    };
    expect(wrapper.div7aClassification.highestSeverity).toBe('MRP_SHORTFALL');
    expect(wrapper.div7aClassification.totalDeemedDividend).toBeGreaterThan(0);
    // Citations include Div 7A + s109D + s109N + s109Y
    expect(result.citations.some((c) => c.reference === 'Div 7A')).toBe(true);
    expect(result.citations.some((c) => c.reference === 's109Y')).toBe(true);
    // UC-ENTITY-COMPANY still surfaces (income tax dispatch is 41e.7)
    expect(result.uncomputed.some((u) => u.id === 'UC-ENTITY-COMPANY')).toBe(true);
    // Plus the surplus-cap UNCOMPUTED
    expect(result.uncomputed.some((u) => u.id === 'UC-DIV7A-DISTRIBUTABLE-SURPLUS')).toBe(true);
  });

  it('COMPANY with both div7aLoans AND cgtEvents → both populated', async () => {
    const { calculateEntityTaxPosition } = await import(
      '@/lib/tax-engine/entity/entityTaxRouter'
    );
    const result = calculateEntityTaxPosition({
      entityId: 'co',
      entityType: 'COMPANY',
      fy: { financialYear: '2024-25', label: 'FY24-25' },
      incomes: [],
      expenses: [],
      depreciations: [],
      div7aLoans: [
        {
          loanId: 'l1',
          openingBalance: 50000,
          yearsRemaining: 7,
          benchmarkRate: 0.0837,
          paymentsMadeThisFy: 25000,
          hasComplianceAgreement: true,
        },
      ],
      cgtEvents: [{ id: 'e1', monthsHeld: 60, nominalAmount: 200000 }],
    });
    // result has Div 7A
    const wrapper = result.result as { div7aClassification: { highestSeverity: string } };
    expect(wrapper.div7aClassification.highestSeverity).toBe('COMPLIANT');
    // cgtResult has 0% discount per s115-280
    const cgt = result.cgtResult as {
      discountResult: { discountRate: number };
      assessableNetCapitalGain: number;
    };
    expect(cgt.discountResult.discountRate).toBe(0);
    expect(cgt.assessableNetCapitalGain).toBe(200000);
  });
});
