/**
 * Phase 44 Part 2c-ii — entity-tax-facts assembler tests.
 *
 * The assembler is a DB reader (not unit-testable without a database),
 * but its pure mapping logic — the bridge from the persisted Part 2
 * models to the tax engine's `EntityTaxFacts` contract — is extracted
 * as pure functions and pinned here. The Q-UPE decision (only `LOAN`
 * benefits become `div7aLoans`) is enforced in `buildDiv7aLoansFromBenefits`
 * and tested directly.
 */

import { describe, it, expect } from 'vitest';
import {
  buildDiv7aLoansFromBenefits,
  buildTrustDistribution,
  pickOperativeResolution,
} from '@/lib/services/entityTaxFactsAssembler';
import type { PrivateCompanyBenefitSummary } from '@/lib/services/privateCompanyBenefitService';
import type { DistributionResolutionSummary } from '@/lib/services/distributionResolutionService';

function benefit(over: Partial<PrivateCompanyBenefitSummary>): PrivateCompanyBenefitSummary {
  return {
    id: 'b1',
    companyEntityId: 'co1',
    recipientEntityId: 'r1',
    financialYear: '2026-27',
    benefitType: 'LOAN',
    amount: 50000,
    openingBalance: 50000,
    loanTermYears: 7,
    benchmarkRate: 0.0877,
    repaymentsThisFy: 6000,
    hasComplianceAgreement: true,
    isSubTrustUpe: false,
    accountantVerified: false,
    ...over,
  };
}

function resolution(
  over: Partial<DistributionResolutionSummary>,
): DistributionResolutionSummary {
  return {
    id: 'res1',
    trustEntityId: 'trust1',
    financialYear: '2026-27',
    trustNetIncome: 100000,
    distributableIncome: 100000,
    resolutionDate: new Date('2027-06-28T00:00:00Z'),
    frankedDividendPool: null,
    capitalGainPool: null,
    hasFamilyTrustElection: true,
    status: 'CONFIRMED',
    accountantVerified: false,
    allocations: [],
    ...over,
  };
}

describe('Phase 44 Part 2c-ii — buildDiv7aLoansFromBenefits (Q-UPE)', () => {
  it('maps a LOAN benefit to a div7aLoan with the right field mapping', () => {
    const loans = buildDiv7aLoansFromBenefits([benefit({})]);
    expect(loans).toHaveLength(1);
    expect(loans[0]).toMatchObject({
      loanId: 'b1',
      openingBalance: 50000,
      yearsRemaining: 7, // loanTermYears → yearsRemaining
      benchmarkRate: 0.0877,
      paymentsMadeThisFy: 6000, // repaymentsThisFy → paymentsMadeThisFy
      hasComplianceAgreement: true,
    });
  });

  it('excludes UPE / SUB_TRUST_ARRANGEMENT / PAYMENT / DEBT_FORGIVENESS (Q-UPE)', () => {
    const loans = buildDiv7aLoansFromBenefits([
      benefit({ id: 'u', benefitType: 'UPE' }),
      benefit({ id: 's', benefitType: 'SUB_TRUST_ARRANGEMENT' }),
      benefit({ id: 'p', benefitType: 'PAYMENT' }),
      benefit({ id: 'd', benefitType: 'DEBT_FORGIVENESS' }),
    ]);
    expect(loans).toHaveLength(0);
  });

  it('skips a LOAN row missing the loan-shape fields rather than feeding a guessed zero', () => {
    const loans = buildDiv7aLoansFromBenefits([
      benefit({ id: 'incomplete', openingBalance: null }),
      benefit({ id: 'noterm', loanTermYears: null }),
      benefit({ id: 'norate', benchmarkRate: null }),
    ]);
    expect(loans).toHaveLength(0);
  });

  it('defaults a null repaymentsThisFy to 0', () => {
    const loans = buildDiv7aLoansFromBenefits([benefit({ repaymentsThisFy: null })]);
    expect(loans[0].paymentsMadeThisFy).toBe(0);
  });
});

describe('Phase 44 Part 2c-ii — buildTrustDistribution', () => {
  it('maps a resolution + allocations to the engine trustDistribution shape', () => {
    const td = buildTrustDistribution(
      resolution({
        trustNetIncome: 120000,
        frankedDividendPool: 8000,
        capitalGainPool: 4000,
        allocations: [
          {
            id: 'a1',
            beneficiaryEntityId: 'ben1',
            presentlyEntitledShare: 0.6,
            streamedFrankedDividends: 8000,
            streamedCapitalGains: null,
          },
          {
            id: 'a2',
            beneficiaryEntityId: 'ben2',
            presentlyEntitledShare: 0.4,
            streamedFrankedDividends: null,
            streamedCapitalGains: null,
          },
        ],
      }),
      new Map([
        ['ben1', 'Sarah Kim'],
        ['ben2', 'Kim Family Co'],
      ]),
    );
    expect(td.trustNetIncome).toBe(120000);
    expect(td.hasFamilyTrustElection).toBe(true);
    expect(td.characterPools).toEqual({ frankedDividends: 8000, capitalGains: 4000 });
    expect(td.streamingResolutionAt).toBe('2027-06-28T00:00:00.000Z');
    expect(td.beneficiaries).toHaveLength(2);
    expect(td.beneficiaries[0]).toMatchObject({
      id: 'ben1',
      name: 'Sarah Kim',
      presentlyEntitledShare: 0.6,
      streaming: { frankedDividends: 8000 },
    });
    // No streaming object when the beneficiary has no streamed amounts.
    expect(td.beneficiaries[1].streaming).toBeUndefined();
  });

  it('falls back to the entity id when a beneficiary name is unknown', () => {
    const td = buildTrustDistribution(
      resolution({
        allocations: [
          {
            id: 'a1',
            beneficiaryEntityId: 'ghost',
            presentlyEntitledShare: 1,
            streamedFrankedDividends: null,
            streamedCapitalGains: null,
          },
        ],
      }),
      new Map(),
    );
    expect(td.beneficiaries[0].name).toBe('ghost');
  });

  it('omits characterPools when no pools are set', () => {
    const td = buildTrustDistribution(resolution({}), new Map());
    expect(td.characterPools).toBeUndefined();
  });
});

describe('Phase 44 Part 2c-ii — pickOperativeResolution', () => {
  it('picks the first CONFIRMED resolution (the list is newest-first)', () => {
    const picked = pickOperativeResolution([
      resolution({ id: 'draft-new', status: 'DRAFT' }),
      resolution({ id: 'confirmed', status: 'CONFIRMED' }),
    ]);
    expect(picked?.id).toBe('confirmed');
  });

  it('returns null when only DRAFT resolutions exist (never compute off a draft)', () => {
    expect(
      pickOperativeResolution([resolution({ status: 'DRAFT' })]),
    ).toBeNull();
  });

  it('returns null for an empty list', () => {
    expect(pickOperativeResolution([])).toBeNull();
  });
});

// =============================================================================
// Stage D PR-1 — gateStreamingByDeedPower (AD-3)
// =============================================================================

import { gateStreamingByDeedPower } from '@/lib/services/entityTaxFactsAssembler';

describe('Stage D PR-1 — gateStreamingByDeedPower', () => {
  const withStreams = () => ({
    trustNetIncome: 100_000,
    characterPools: { frankedDividends: 20_000, capitalGains: 30_000 },
    streamingResolutionAt: '2025-06-25T00:00:00.000Z',
    beneficiaries: [
      {
        id: 'b1',
        name: 'Reza',
        presentlyEntitledShare: 0.5,
        streaming: { frankedDividends: 20_000 },
      },
      { id: 'b2', name: 'Newsha', presentlyEntitledShare: 0.5 },
    ],
  });

  it('passes streams through untouched when the deed has STREAMING_POWER', () => {
    const gated = gateStreamingByDeedPower(withStreams(), true);
    expect(gated.characterPools).toBeDefined();
    expect(gated.beneficiaries[0].streaming).toBeDefined();
    expect(gated.streamingSuppressed).toBeUndefined();
  });

  it('strips streams + sets streamingSuppressed when no deed power exists', () => {
    const gated = gateStreamingByDeedPower(withStreams(), false);
    expect(gated.characterPools).toBeUndefined();
    expect(gated.streamingResolutionAt).toBeUndefined();
    expect(gated.beneficiaries.every((b) => b.streaming === undefined)).toBe(true);
    expect(gated.streamingSuppressed).toBe(true);
    // The proportionate allocation survives — only the streams are gated.
    expect(gated.trustNetIncome).toBe(100_000);
    expect(gated.beneficiaries[0].presentlyEntitledShare).toBe(0.5);
  });

  it('is a no-op for a distribution with no streams (no false flag)', () => {
    const plain = {
      trustNetIncome: 50_000,
      beneficiaries: [{ id: 'b1', name: 'Reza', presentlyEntitledShare: 1 }],
    };
    const gated = gateStreamingByDeedPower(plain, false);
    expect(gated.streamingSuppressed).toBeUndefined();
    expect(gated).toEqual(plain);
  });
});

// =============================================================================
// Stage D PR-2 — FIFO CGT events + Div 207 dividend feed
// =============================================================================

import {
  buildCgtEventsFifo,
  buildDividendIncomeFromPayments,
  fyDateRange,
  type EquityTxn,
} from '@/lib/services/entityTaxFactsAssembler';

const FY = fyDateRange('2024-25')!;
const d = (iso: string) => new Date(iso);
const buy = (id: string, date: string, units: number, price: number, fees = 0): EquityTxn => ({
  id, holdingId: 'h1', ticker: 'VAS', date: d(date), type: 'BUY', price, units, fees,
});
const sell = (id: string, date: string, units: number, price: number, fees = 0): EquityTxn => ({
  id, holdingId: 'h1', ticker: 'VAS', date: d(date), type: 'SELL', price, units, fees,
});

describe('Stage D PR-2 — fyDateRange', () => {
  it('maps 2024-25 to [1 Jul 2024, 1 Jul 2025)', () => {
    expect(FY.start.toISOString()).toBe('2024-07-01T00:00:00.000Z');
    expect(FY.end.toISOString()).toBe('2025-07-01T00:00:00.000Z');
  });
  it('rejects junk', () => {
    expect(fyDateRange('FY25')).toBeNull();
  });
});

describe('Stage D PR-2 — buildCgtEventsFifo', () => {
  it('computes a simple gain with fees in cost base and proceeds', () => {
    const { events, hadUnmatchedSell } = buildCgtEventsFifo(
      [buy('b1', '2020-01-15', 100, 10, 20), sell('s1', '2025-03-10', 100, 15, 10)],
      FY,
    );
    expect(hadUnmatchedSell).toBe(false);
    expect(events).toHaveLength(1);
    // proceeds 100*(15-0.1)=1490; cost 100*(10+0.2)=1020 → gain 470
    expect(events[0].nominalAmount).toBeCloseTo(470);
    expect(events[0].monthsHeld).toBeGreaterThan(60); // > 5 years held
  });

  it('splits one sell across two lots — each event carries ITS OWN holding period', () => {
    const { events } = buildCgtEventsFifo(
      [
        buy('b1', '2020-01-01', 50, 10),
        buy('b2', '2024-12-01', 50, 12),
        sell('s1', '2025-05-01', 80, 20),
      ],
      FY,
    );
    expect(events).toHaveLength(2);
    expect(events[0].monthsHeld).toBeGreaterThanOrEqual(12); // old lot — discount-eligible
    expect(events[1].monthsHeld).toBeLessThan(12); // new lot — NOT discount-eligible
    expect(events[0].nominalAmount).toBeCloseTo(50 * (20 - 10));
    expect(events[1].nominalAmount).toBeCloseTo(30 * (20 - 12));
  });

  it('pre-FY sells consume lots but emit no events', () => {
    const { events } = buildCgtEventsFifo(
      [
        buy('b1', '2020-01-01', 100, 10),
        sell('s0', '2023-01-01', 100, 30), // prior FY — consumes the lot
        buy('b2', '2024-08-01', 50, 12),
        sell('s1', '2025-05-01', 50, 20), // matches b2, not b1
      ],
      FY,
    );
    expect(events).toHaveLength(1);
    expect(events[0].nominalAmount).toBeCloseTo(50 * (20 - 12));
    expect(events[0].monthsHeld).toBeLessThan(12);
  });

  it('skips the unmatched portion of a sell and flags it — never a zero cost base', () => {
    const { events, hadUnmatchedSell } = buildCgtEventsFifo(
      [buy('b1', '2020-01-01', 30, 10), sell('s1', '2025-05-01', 100, 20)],
      FY,
    );
    expect(events).toHaveLength(1);
    expect(events[0].nominalAmount).toBeCloseTo(30 * (20 - 10));
    expect(hadUnmatchedSell).toBe(true);
  });

  it('emits losses as negative amounts', () => {
    const { events } = buildCgtEventsFifo(
      [buy('b1', '2024-08-01', 100, 20), sell('s1', '2025-05-01', 100, 15)],
      FY,
    );
    expect(events[0].nominalAmount).toBeCloseTo(-500);
  });

  it('ignores transactions with no holding key', () => {
    const orphan: EquityTxn = {
      id: 'x', holdingId: null, ticker: null, date: d('2025-01-01'),
      type: 'SELL', price: 10, units: 5, fees: null,
    };
    expect(buildCgtEventsFifo([orphan], FY).events).toHaveLength(0);
  });
});

describe('Stage D PR-2 — buildDividendIncomeFromPayments', () => {
  it('maps payments to franked income rows with company names', () => {
    const rows = buildDividendIncomeFromPayments(
      [
        {
          id: 'p1',
          amount: 7000,
          frankingCredits: 3000,
          companyEntityId: 'co1',
          frankingPercentage: 100,
        },
      ],
      new Map([['co1', 'Renew Holding Company Pty Ltd']]),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('divreg-p1');
    expect(rows[0].name).toContain('Renew Holding Company');
    expect(rows[0].frankingCredits).toBe(3000);
    expect(rows[0].type).toBe('DIVIDEND');
  });
});
