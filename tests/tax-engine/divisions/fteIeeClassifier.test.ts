/**
 * Phase 41e.10 — FTE / IEE / TFN withholding classifier tests.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyFteIeeDistributions,
  FAMILY_TRUST_DISTRIBUTION_TAX_RATE,
  TFN_WITHHOLDING_RATE,
  type FteIeeBeneficiaryInput,
} from '@/lib/tax-engine/divisions/fteIeeClassifier';

const ben = (
  o: Partial<FteIeeBeneficiaryInput> = {},
): FteIeeBeneficiaryInput => ({
  beneficiaryId: 'b1',
  beneficiaryName: 'Sarah',
  distributionAmount: 100000,
  relationship: 'FAMILY_MEMBER',
  hasQuotedTfn: true,
  ...o,
});

describe('classifyFteIeeDistributions — INSIDE_FAMILY (normal)', () => {
  it('TEST_INDIVIDUAL → INSIDE_FAMILY, no FTDT, no withholding', () => {
    const r = classifyFteIeeDistributions({
      hasFamilyTrustElection: true,
      beneficiaries: [ben({ relationship: 'TEST_INDIVIDUAL' })],
    });
    const c = r.classifications[0];
    expect(c.outcome).toBe('INSIDE_FAMILY');
    expect(c.ftdtPayableByTrustee).toBe(0);
    expect(c.tfnWithholdingDeducted).toBe(0);
    expect(c.netToBeneficiary).toBe(100000);
  });

  it('FAMILY_MEMBER (spouse, parent, child) → INSIDE_FAMILY', () => {
    const r = classifyFteIeeDistributions({
      hasFamilyTrustElection: true,
      beneficiaries: [ben({ relationship: 'FAMILY_MEMBER' })],
    });
    expect(r.classifications[0].outcome).toBe('INSIDE_FAMILY');
    expect(r.totalFtdtPayable).toBe(0);
  });

  it('CONTROLLED_ENTITY → INSIDE_FAMILY + UC-FTE-CONTROL-TEST', () => {
    const r = classifyFteIeeDistributions({
      hasFamilyTrustElection: true,
      beneficiaries: [ben({ relationship: 'CONTROLLED_ENTITY' })],
    });
    expect(r.classifications[0].outcome).toBe('INSIDE_FAMILY');
    expect(r.uncomputed.some((u) => u.id === 'UC-FTE-CONTROL-TEST')).toBe(true);
  });
});

describe('classifyFteIeeDistributions — OUTSIDE_FAMILY (FTDT applies)', () => {
  it('OUTSIDE_FAMILY beneficiary with TFN → 47% FTDT payable by trustee', () => {
    const r = classifyFteIeeDistributions({
      hasFamilyTrustElection: true,
      beneficiaries: [ben({ relationship: 'OUTSIDE_FAMILY' })],
    });
    const c = r.classifications[0];
    expect(c.outcome).toBe('OUTSIDE_FAMILY_FTDT');
    expect(c.ftdtPayableByTrustee).toBeCloseTo(47000, 2);
    expect(c.tfnWithholdingDeducted).toBe(0); // TFN was quoted
    expect(c.netToBeneficiary).toBe(100000); // beneficiary still gets gross
    expect(r.totalFtdtPayable).toBeCloseTo(47000, 2);
    expect(r.uncomputed.some((u) => u.id === 'UC-FTDT-OUTSIDE-FAMILY')).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('s271-15'))).toBe(true);
  });

  it('FTDT rate constant exposed at 47%', () => {
    expect(FAMILY_TRUST_DISTRIBUTION_TAX_RATE).toBe(0.47);
  });

  it('IEE override → INSIDE_VIA_IEE, no FTDT', () => {
    const r = classifyFteIeeDistributions({
      hasFamilyTrustElection: true,
      beneficiaries: [
        ben({ relationship: 'OUTSIDE_FAMILY', coveredByIee: true }),
      ],
    });
    expect(r.classifications[0].outcome).toBe('INSIDE_VIA_IEE');
    expect(r.classifications[0].ftdtPayableByTrustee).toBe(0);
    expect(r.citations.some((c) => c.reference.includes('s272-85'))).toBe(true);
  });

  it('custom FTDT rate honoured', () => {
    const r = classifyFteIeeDistributions({
      hasFamilyTrustElection: true,
      beneficiaries: [ben({ relationship: 'OUTSIDE_FAMILY' })],
      ftdtRate: 0.45,
    });
    expect(r.classifications[0].ftdtPayableByTrustee).toBeCloseTo(45000, 2);
  });
});

describe('classifyFteIeeDistributions — TFN_WITHHOLDING (47%)', () => {
  it('beneficiary did not quote TFN → 47% withheld by trustee', () => {
    const r = classifyFteIeeDistributions({
      hasFamilyTrustElection: true,
      beneficiaries: [ben({ hasQuotedTfn: false })],
    });
    const c = r.classifications[0];
    expect(c.outcome).toBe('TFN_WITHHOLDING');
    expect(c.tfnWithholdingDeducted).toBeCloseTo(47000, 2);
    expect(c.ftdtPayableByTrustee).toBe(0); // no FTDT — beneficiary in family
    expect(c.netToBeneficiary).toBeCloseTo(53000, 2);
    expect(r.totalTfnWithholding).toBeCloseTo(47000, 2);
  });

  it('TFN withholding rate constant at 47%', () => {
    expect(TFN_WITHHOLDING_RATE).toBe(0.47);
  });

  it('TFN withholding takes priority over OUTSIDE_FAMILY', () => {
    // Beneficiary outside family AND no TFN — TFN withholding wins
    // (no FTDT because beneficiary still receives less than gross
    // due to withholding).
    const r = classifyFteIeeDistributions({
      hasFamilyTrustElection: true,
      beneficiaries: [
        ben({ relationship: 'OUTSIDE_FAMILY', hasQuotedTfn: false }),
      ],
    });
    expect(r.classifications[0].outcome).toBe('TFN_WITHHOLDING');
    expect(r.classifications[0].ftdtPayableByTrustee).toBe(0);
  });
});

describe('classifyFteIeeDistributions — multi-beneficiary aggregation', () => {
  it('mixed inside / outside / TFN-withheld → totals aggregate correctly', () => {
    const r = classifyFteIeeDistributions({
      hasFamilyTrustElection: true,
      beneficiaries: [
        ben({ beneficiaryId: 'spouse', distributionAmount: 50000 }),
        ben({
          beneficiaryId: 'cousin',
          relationship: 'OUTSIDE_FAMILY',
          distributionAmount: 30000,
        }),
        ben({
          beneficiaryId: 'no-tfn',
          relationship: 'FAMILY_MEMBER',
          hasQuotedTfn: false,
          distributionAmount: 20000,
        }),
      ],
    });
    expect(r.totalFtdtPayable).toBeCloseTo(30000 * 0.47, 2);
    expect(r.totalTfnWithholding).toBeCloseTo(20000 * 0.47, 2);
  });
});

describe('classifyFteIeeDistributions — no FTE in force', () => {
  it('no FTE → no FTDT, but TFN withholding still applies to non-quoting', () => {
    const r = classifyFteIeeDistributions({
      hasFamilyTrustElection: false,
      beneficiaries: [
        ben({ hasQuotedTfn: false }),
        ben({ beneficiaryId: 'b2', relationship: 'OUTSIDE_FAMILY' }),
      ],
    });
    expect(r.totalFtdtPayable).toBe(0);
    expect(r.totalTfnWithholding).toBeCloseTo(47000, 2);
  });
});

describe('classifyFteIeeDistributions — citations', () => {
  it('always cites Sch 2F + s272-75 + s272-95', () => {
    const r = classifyFteIeeDistributions({
      hasFamilyTrustElection: true,
      beneficiaries: [ben()],
    });
    expect(r.citations.some((c) => c.reference === 'Sch 2F')).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('s272-75'))).toBe(true);
    expect(r.citations.some((c) => c.reference.includes('s272-95'))).toBe(true);
  });

  it('cites s271-15 when FTDT applies', () => {
    const r = classifyFteIeeDistributions({
      hasFamilyTrustElection: true,
      beneficiaries: [ben({ relationship: 'OUTSIDE_FAMILY' })],
    });
    expect(r.citations.some((c) => c.reference.includes('s271-15'))).toBe(true);
  });

  it('cites Pt VA when TFN withholding applies', () => {
    const r = classifyFteIeeDistributions({
      hasFamilyTrustElection: true,
      beneficiaries: [ben({ hasQuotedTfn: false })],
    });
    expect(r.citations.some((c) => c.reference.includes('Pt VA'))).toBe(true);
  });
});

describe('classifyFteIeeDistributions — edge cases', () => {
  it('zero distribution → zero FTDT/withholding', () => {
    const r = classifyFteIeeDistributions({
      hasFamilyTrustElection: true,
      beneficiaries: [
        ben({ relationship: 'OUTSIDE_FAMILY', distributionAmount: 0 }),
      ],
    });
    expect(r.totalFtdtPayable).toBe(0);
  });

  it('empty beneficiary list → empty result', () => {
    const r = classifyFteIeeDistributions({
      hasFamilyTrustElection: true,
      beneficiaries: [],
    });
    expect(r.classifications).toEqual([]);
    expect(r.totalFtdtPayable).toBe(0);
    expect(r.totalTfnWithholding).toBe(0);
  });
});
