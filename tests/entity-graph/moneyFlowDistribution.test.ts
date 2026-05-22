/**
 * Phase 44 Part 2d — money-flow distribution-detail tests.
 *
 * `getMoneyFlow()` is a DB reader (not unit-testable without a
 * database), but the per-recipient distribution mapping —
 * `buildDistributionDetail()` — is a pure function and pinned here.
 * It turns CONFIRMED trust resolutions + company dividends into the
 * detail rows the Sankey renders.
 */

import { describe, it, expect } from 'vitest';
import {
  buildDistributionDetail,
  type RawResolutionForFlow,
  type RawDividendForFlow,
} from '@/lib/services/moneyFlowService';

const names = new Map<string, string>([
  ['trust-1', 'Smith Family Trust'],
  ['co-1', 'Acme Pty Ltd'],
  ['ben-1', 'Jane Smith'],
  ['ben-2', 'John Smith'],
  ['sh-1', 'Holding Trust'],
]);

describe('Phase 44 Part 2d — buildDistributionDetail', () => {
  it('returns an empty array for empty inputs', () => {
    expect(buildDistributionDetail([], [], names)).toEqual([]);
  });

  it('maps a trust resolution to per-beneficiary recipient amounts (Bamford proportionate)', () => {
    const resolutions: RawResolutionForFlow[] = [
      {
        trustEntityId: 'trust-1',
        trustNetIncome: 100_000,
        allocations: [
          { beneficiaryEntityId: 'ben-1', presentlyEntitledShare: 0.6 },
          { beneficiaryEntityId: 'ben-2', presentlyEntitledShare: 0.4 },
        ],
      },
    ];
    const [dist] = buildDistributionDetail(resolutions, [], names);
    expect(dist.kind).toBe('TRUST_DISTRIBUTION');
    expect(dist.fromEntityId).toBe('trust-1');
    expect(dist.fromEntityName).toBe('Smith Family Trust');
    expect(dist.amount).toBe(100_000);
    expect(dist.recipients).toEqual([
      { name: 'Jane Smith', amount: 60_000 },
      { name: 'John Smith', amount: 40_000 },
    ]);
  });

  it('maps a company dividend to its per-shareholder payments verbatim', () => {
    const dividends: RawDividendForFlow[] = [
      {
        companyEntityId: 'co-1',
        totalAmount: 50_000,
        payments: [{ shareholderEntityId: 'sh-1', amount: 50_000 }],
      },
    ];
    const [dist] = buildDistributionDetail([], dividends, names);
    expect(dist.kind).toBe('DIVIDEND');
    expect(dist.fromEntityName).toBe('Acme Pty Ltd');
    expect(dist.amount).toBe(50_000);
    expect(dist.recipients).toEqual([{ name: 'Holding Trust', amount: 50_000 }]);
  });

  it('skips resolutions and dividends with a non-positive amount', () => {
    const resolutions: RawResolutionForFlow[] = [
      { trustEntityId: 'trust-1', trustNetIncome: 0, allocations: [] },
      { trustEntityId: 'trust-1', trustNetIncome: -5_000, allocations: [] },
    ];
    const dividends: RawDividendForFlow[] = [
      { companyEntityId: 'co-1', totalAmount: 0, payments: [] },
    ];
    expect(buildDistributionDetail(resolutions, dividends, names)).toEqual([]);
  });

  it('falls back to the entity id when a name is not in the map', () => {
    const resolutions: RawResolutionForFlow[] = [
      {
        trustEntityId: 'unknown-trust',
        trustNetIncome: 10_000,
        allocations: [{ beneficiaryEntityId: 'unknown-ben', presentlyEntitledShare: 1 }],
      },
    ];
    const [dist] = buildDistributionDetail(resolutions, [], names);
    expect(dist.fromEntityName).toBe('unknown-trust');
    expect(dist.recipients[0].name).toBe('unknown-ben');
  });

  it('returns trust distributions before dividends, preserving input order', () => {
    const resolutions: RawResolutionForFlow[] = [
      {
        trustEntityId: 'trust-1',
        trustNetIncome: 20_000,
        allocations: [{ beneficiaryEntityId: 'ben-1', presentlyEntitledShare: 1 }],
      },
    ];
    const dividends: RawDividendForFlow[] = [
      {
        companyEntityId: 'co-1',
        totalAmount: 30_000,
        payments: [{ shareholderEntityId: 'sh-1', amount: 30_000 }],
      },
    ];
    const result = buildDistributionDetail(resolutions, dividends, names);
    expect(result.map((d) => d.kind)).toEqual(['TRUST_DISTRIBUTION', 'DIVIDEND']);
  });
});
