/**
 * Phase 41e.11 — SMSF triumvirate classifier tests.
 */

import { describe, it, expect } from 'vitest';
import {
  classifySmsfTriumvirate,
  NON_COMPLYING_SMSF_RATE,
  NALI_RATE,
  IN_HOUSE_ASSET_CAP,
  type SmsfTriumvirateInput,
} from '@/lib/tax-engine/divisions/smsfTriumvirateClassifier';

const baseInput = (
  o: Partial<SmsfTriumvirateInput> = {},
): SmsfTriumvirateInput => ({
  totalFundValue: 1_000_000,
  meetsSolePurposeTest: true,
  fyIncome: 50000,
  hasNonArmsLengthIncome: false,
  ...o,
});

describe('classifySmsfTriumvirate — Sole purpose test (s62)', () => {
  it('PASS → 15% rate, no breach', () => {
    const r = classifySmsfTriumvirate(baseInput());
    expect(r.solePurpose.status).toBe('PASS');
    expect(r.applicableIncomeRate).toBe(0.15);
    expect(r.anyBreach).toBe(false);
  });

  it('FAIL → 45% rate, anyBreach + UC-SMSF-NON-COMPLYING', () => {
    const r = classifySmsfTriumvirate(baseInput({ meetsSolePurposeTest: false }));
    expect(r.solePurpose.status).toBe('FAIL');
    expect(r.applicableIncomeRate).toBe(NON_COMPLYING_SMSF_RATE);
    expect(r.applicableIncomeRate).toBe(0.45);
    expect(r.anyBreach).toBe(true);
    expect(r.uncomputed.some((u) => u.id === 'UC-SMSF-NON-COMPLYING')).toBe(true);
  });
});

describe('classifySmsfTriumvirate — In-house asset cap (Pt 8 SIS)', () => {
  it('no in-house assets → NO_IN_HOUSE_ASSETS', () => {
    const r = classifySmsfTriumvirate(baseInput());
    expect(r.inHouseAsset.status).toBe('NO_IN_HOUSE_ASSETS');
  });

  it('within 5% cap → COMPLIANT', () => {
    const r = classifySmsfTriumvirate(
      baseInput({
        totalFundValue: 1_000_000,
        inHouseAssets: [{ assetId: 'a1', marketValue: 30_000 }], // 3%
      }),
    );
    expect(r.inHouseAsset.status).toBe('COMPLIANT');
    expect(r.inHouseAsset.breachAmount).toBe(0);
  });

  it('exceeds 5% cap → BREACH + UC-SMSF-IN-HOUSE-BREACH', () => {
    const r = classifySmsfTriumvirate(
      baseInput({
        totalFundValue: 1_000_000,
        inHouseAssets: [{ assetId: 'a1', marketValue: 80_000 }], // 8%
      }),
    );
    expect(r.inHouseAsset.status).toBe('BREACH');
    expect(r.inHouseAsset.breachAmount).toBe(30_000); // 80k - 50k cap
    expect(r.inHouseAsset.breachPercentage).toBeCloseTo(0.08, 4);
    expect(r.anyBreach).toBe(true);
    expect(r.uncomputed.some((u) => u.id === 'UC-SMSF-IN-HOUSE-BREACH')).toBe(true);
  });

  it('BRP exception excluded from cap', () => {
    const r = classifySmsfTriumvirate(
      baseInput({
        totalFundValue: 1_000_000,
        inHouseAssets: [
          { assetId: 'brp', marketValue: 500_000, isBrpException: true },
          { assetId: 'a1', marketValue: 30_000 },
        ],
      }),
    );
    // BRP excluded → only $30k counts → 3% → compliant
    expect(r.inHouseAsset.status).toBe('COMPLIANT');
    expect(r.inHouseAsset.inHouseValue).toBe(30_000);
    expect(r.citations.some((c) => c.reference.includes('BRP'))).toBe(true);
  });

  it('IN_HOUSE_ASSET_CAP constant exposed at 5%', () => {
    expect(IN_HOUSE_ASSET_CAP).toBe(0.05);
  });
});

describe('classifySmsfTriumvirate — LRBA compliance (s67A + PCG 2016/5)', () => {
  it('no LRBAs → NO_LRBA', () => {
    const r = classifySmsfTriumvirate(baseInput());
    expect(r.lrba.status).toBe('NO_LRBA');
  });

  it('compliant LRBA → COMPLIANT', () => {
    const r = classifySmsfTriumvirate(
      baseInput({
        lrbaArrangements: [
          {
            loanId: 'l1',
            outstandingBalance: 500000,
            hasBareTrust: true,
            isNonRecourse: true,
            isArmsLength: true,
            isSingleAcquirableAsset: true,
          },
        ],
      }),
    );
    expect(r.lrba.status).toBe('COMPLIANT');
    expect(r.anyBreach).toBe(false);
  });

  it('multi-asset LRBA → BREACH_MULTI_ASSET', () => {
    const r = classifySmsfTriumvirate(
      baseInput({
        lrbaArrangements: [
          {
            loanId: 'l1',
            outstandingBalance: 500000,
            hasBareTrust: true,
            isNonRecourse: true,
            isArmsLength: true,
            isSingleAcquirableAsset: false,
          },
        ],
      }),
    );
    expect(r.lrba.status).toBe('BREACH_MULTI_ASSET');
    expect(r.anyBreach).toBe(true);
    expect(r.uncomputed.some((u) => u.id === 'UC-SMSF-LRBA-BREACH')).toBe(true);
  });

  it('no bare trust → BREACH_BARE_TRUST', () => {
    const r = classifySmsfTriumvirate(
      baseInput({
        lrbaArrangements: [
          {
            loanId: 'l1',
            outstandingBalance: 500000,
            hasBareTrust: false,
            isNonRecourse: true,
            isArmsLength: true,
            isSingleAcquirableAsset: true,
          },
        ],
      }),
    );
    expect(r.lrba.status).toBe('BREACH_BARE_TRUST');
  });

  it('recourse loan → BREACH_RECOURSE', () => {
    const r = classifySmsfTriumvirate(
      baseInput({
        lrbaArrangements: [
          {
            loanId: 'l1',
            outstandingBalance: 500000,
            hasBareTrust: true,
            isNonRecourse: false,
            isArmsLength: true,
            isSingleAcquirableAsset: true,
          },
        ],
      }),
    );
    expect(r.lrba.status).toBe('BREACH_RECOURSE');
  });

  it('non-arm\'s-length LRBA → NALI_RISK', () => {
    const r = classifySmsfTriumvirate(
      baseInput({
        lrbaArrangements: [
          {
            loanId: 'l1',
            outstandingBalance: 500000,
            hasBareTrust: true,
            isNonRecourse: true,
            isArmsLength: false,
            isSingleAcquirableAsset: true,
          },
        ],
      }),
    );
    expect(r.lrba.status).toBe('NALI_RISK');
    // NALI applied — UC-SMSF-NALI surfaces (not LRBA-BREACH for this state)
    expect(r.uncomputed.some((u) => u.id === 'UC-SMSF-NALI')).toBe(true);
  });
});

describe('classifySmsfTriumvirate — NALI (s295-550)', () => {
  it('hasNonArmsLengthIncome → 45% NALI on whole income', () => {
    const r = classifySmsfTriumvirate(
      baseInput({ fyIncome: 100000, hasNonArmsLengthIncome: true }),
    );
    expect(r.naliTax).toBeCloseTo(45000, 2);
    expect(r.uncomputed.some((u) => u.id === 'UC-SMSF-NALI')).toBe(true);
  });

  it('arm\'s-length → no NALI', () => {
    const r = classifySmsfTriumvirate(
      baseInput({ fyIncome: 100000, hasNonArmsLengthIncome: false }),
    );
    expect(r.naliTax).toBe(0);
  });

  it('NALI_RATE constant exposed at 45%', () => {
    expect(NALI_RATE).toBe(0.45);
  });

  it('NALI also triggers via non-arm\'s-length LRBA', () => {
    const r = classifySmsfTriumvirate(
      baseInput({
        fyIncome: 80000,
        lrbaArrangements: [
          {
            loanId: 'l1',
            outstandingBalance: 500000,
            hasBareTrust: true,
            isNonRecourse: true,
            isArmsLength: false,
            isSingleAcquirableAsset: true,
          },
        ],
      }),
    );
    expect(r.naliTax).toBeCloseTo(36000, 2);
  });
});

describe('classifySmsfTriumvirate — combinations', () => {
  it('all-clear fund → no breach, 15% rate, no NALI', () => {
    const r = classifySmsfTriumvirate(baseInput());
    expect(r.anyBreach).toBe(false);
    expect(r.applicableIncomeRate).toBe(0.15);
    expect(r.naliTax).toBe(0);
  });

  it('worst-case fund — sole purpose fail + in-house breach + LRBA breach + NALI', () => {
    const r = classifySmsfTriumvirate(
      baseInput({
        meetsSolePurposeTest: false,
        totalFundValue: 1_000_000,
        inHouseAssets: [{ assetId: 'a1', marketValue: 100_000 }],
        lrbaArrangements: [
          {
            loanId: 'l1',
            outstandingBalance: 500000,
            hasBareTrust: false,
            isNonRecourse: true,
            isArmsLength: false,
            isSingleAcquirableAsset: true,
          },
        ],
        hasNonArmsLengthIncome: true,
        fyIncome: 100000,
      }),
    );
    expect(r.anyBreach).toBe(true);
    expect(r.solePurpose.status).toBe('FAIL');
    expect(r.inHouseAsset.status).toBe('BREACH');
    expect(r.lrba.status).toBe('BREACH_BARE_TRUST');
    expect(r.applicableIncomeRate).toBe(0.45); // non-complying
    expect(r.naliTax).toBeCloseTo(45000, 2);
    // 4 UNCOMPUTED flags surfaced
    const flagIds = r.uncomputed.map((u) => u.id);
    expect(flagIds).toContain('UC-SMSF-NON-COMPLYING');
    expect(flagIds).toContain('UC-SMSF-IN-HOUSE-BREACH');
    expect(flagIds).toContain('UC-SMSF-LRBA-BREACH');
    expect(flagIds).toContain('UC-SMSF-NALI');
  });
});

describe('classifySmsfTriumvirate — citations', () => {
  it('always cites s62 + Pt 8 + s67A + PCG 2016/5', () => {
    const r = classifySmsfTriumvirate(baseInput());
    expect(r.citations.some((c) => c.reference.includes('s62'))).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('Pt 8'))).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('s67A'))).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('2016/5'))).toBe(true);
  });

  it('cites s295-550 when NALI applies', () => {
    const r = classifySmsfTriumvirate(
      baseInput({ hasNonArmsLengthIncome: true }),
    );
    expect(r.citations.some((c) => c.reference.includes('s295-550'))).toBe(true);
  });

  it('cites s295-160 when non-complying', () => {
    const r = classifySmsfTriumvirate(baseInput({ meetsSolePurposeTest: false }));
    expect(r.citations.some((c) => c.reference.includes('s295-160'))).toBe(true);
  });
});

describe('classifySmsfTriumvirate — edge cases', () => {
  it('zero fund value → 0% in-house percentage', () => {
    const r = classifySmsfTriumvirate(
      baseInput({ totalFundValue: 0, inHouseAssets: [{ assetId: 'a1', marketValue: 0 }] }),
    );
    expect(r.inHouseAsset.breachPercentage).toBe(0);
  });

  it('zero income → no NALI tax even when flagged', () => {
    const r = classifySmsfTriumvirate(
      baseInput({ fyIncome: 0, hasNonArmsLengthIncome: true }),
    );
    expect(r.naliTax).toBe(0);
  });
});
