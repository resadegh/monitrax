/**
 * Phase 41e.5 — s100A zone classifier tests.
 *
 * Pins the PCG 2022/2 zone dispatch contract for each combination of
 * facts the v1 classifier recognises strongly.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyS100AZones,
  type S100ABeneficiaryFacts,
} from '@/lib/tax-engine/divisions/s100aZoneClassifier';

const baseBen = (
  o: Partial<S100ABeneficiaryFacts> = {},
): S100ABeneficiaryFacts => ({
  beneficiaryId: 'b1',
  beneficiaryName: 'Test',
  amount: 50000,
  ...o,
});

describe('classifyS100AZones — RED zone signals', () => {
  it('UPE + funds used by another → RED', () => {
    const r = classifyS100AZones({
      beneficiaries: [
        baseBen({
          unpaidPresentEntitlement: true,
          fundsUsedByOther: true,
        }),
      ],
    });
    expect(r.classifications[0].zone).toBe('RED');
    expect(r.highestZone).toBe('RED');
    expect(r.classifications[0].requiresAgentReview).toBe(true);
  });

  it('UPE + funds NOT received → RED', () => {
    const r = classifyS100AZones({
      beneficiaries: [
        baseBen({
          unpaidPresentEntitlement: true,
          beneficiaryReceivedFunds: false,
        }),
      ],
    });
    expect(r.classifications[0].zone).toBe('RED');
  });

  it('funds used by another (no UPE) → RED', () => {
    const r = classifyS100AZones({
      beneficiaries: [baseBen({ fundsUsedByOther: true })],
    });
    expect(r.classifications[0].zone).toBe('RED');
  });

  it('minor + funds NOT received → RED', () => {
    const r = classifyS100AZones({
      beneficiaries: [
        baseBen({ isMinor: true, beneficiaryReceivedFunds: false }),
      ],
    });
    expect(r.classifications[0].zone).toBe('RED');
  });
});

describe('classifyS100AZones — WHITE zone (testamentary)', () => {
  it('testamentary trust → WHITE regardless of beneficiary facts', () => {
    const r = classifyS100AZones({
      isTestamentaryTrust: true,
      beneficiaries: [baseBen({ relationshipToController: 'UNRELATED' })],
    });
    expect(r.classifications[0].zone).toBe('WHITE');
    expect(r.classifications[0].requiresAgentReview).toBe(false);
    expect(r.highestZone).toBe('WHITE');
  });

  it('but RED still wins over testamentary if explicit red signals', () => {
    const r = classifyS100AZones({
      isTestamentaryTrust: true,
      beneficiaries: [baseBen({ fundsUsedByOther: true })],
    });
    // RED-zone signals classify before WHITE testamentary fallback.
    expect(r.classifications[0].zone).toBe('RED');
  });
});

describe('classifyS100AZones — GREEN zone (FTE family-group)', () => {
  it('FTE + immediate family + funds received → GREEN', () => {
    const r = classifyS100AZones({
      hasFamilyTrustElection: true,
      beneficiaries: [
        baseBen({
          relationshipToController: 'IMMEDIATE_FAMILY',
          beneficiaryReceivedFunds: true,
        }),
      ],
    });
    expect(r.classifications[0].zone).toBe('GREEN');
    expect(r.classifications[0].requiresAgentReview).toBe(false);
  });

  it('FTE + controller + funds received → GREEN', () => {
    const r = classifyS100AZones({
      hasFamilyTrustElection: true,
      beneficiaries: [
        baseBen({
          relationshipToController: 'CONTROLLER',
          beneficiaryReceivedFunds: true,
        }),
      ],
    });
    expect(r.classifications[0].zone).toBe('GREEN');
  });

  it('FTE without funds received → BLUE (not GREEN)', () => {
    const r = classifyS100AZones({
      hasFamilyTrustElection: true,
      beneficiaries: [
        baseBen({ relationshipToController: 'IMMEDIATE_FAMILY' }),
      ],
    });
    expect(r.classifications[0].zone).toBe('BLUE');
  });

  it('NO FTE + immediate family + funds received → BLUE (not GREEN)', () => {
    const r = classifyS100AZones({
      hasFamilyTrustElection: false,
      beneficiaries: [
        baseBen({
          relationshipToController: 'IMMEDIATE_FAMILY',
          beneficiaryReceivedFunds: true,
        }),
      ],
    });
    expect(r.classifications[0].zone).toBe('BLUE');
  });
});

describe('classifyS100AZones — BLUE default', () => {
  it('no facts → BLUE', () => {
    const r = classifyS100AZones({
      beneficiaries: [baseBen()],
    });
    expect(r.classifications[0].zone).toBe('BLUE');
    expect(r.classifications[0].requiresAgentReview).toBe(true);
  });

  it('extended family → BLUE', () => {
    const r = classifyS100AZones({
      hasFamilyTrustElection: true,
      beneficiaries: [
        baseBen({
          relationshipToController: 'EXTENDED_FAMILY',
          beneficiaryReceivedFunds: true,
        }),
      ],
    });
    expect(r.classifications[0].zone).toBe('BLUE');
  });
});

describe('classifyS100AZones — aggregate result', () => {
  it('highestZone takes the worst across beneficiaries', () => {
    const r = classifyS100AZones({
      hasFamilyTrustElection: true,
      beneficiaries: [
        baseBen({
          beneficiaryId: 'good',
          relationshipToController: 'IMMEDIATE_FAMILY',
          beneficiaryReceivedFunds: true,
        }),
        baseBen({
          beneficiaryId: 'bad',
          fundsUsedByOther: true,
        }),
      ],
    });
    expect(r.classifications[0].zone).toBe('GREEN');
    expect(r.classifications[1].zone).toBe('RED');
    expect(r.highestZone).toBe('RED'); // highestZone = worst
  });

  it('all WHITE → highestZone = WHITE', () => {
    const r = classifyS100AZones({
      isTestamentaryTrust: true,
      beneficiaries: [
        baseBen({ beneficiaryId: 'b1' }),
        baseBen({ beneficiaryId: 'b2' }),
      ],
    });
    expect(r.highestZone).toBe('WHITE');
  });

  it('citations always include s100A + TR 2022/4 + PCG 2022/2', () => {
    const r = classifyS100AZones({ beneficiaries: [baseBen()] });
    expect(r.citations.some((c) => c.reference === 's100A')).toBe(true);
    expect(r.citations.some((c) => c.reference === '2022/4')).toBe(true);
    expect(r.citations.some((c) => c.reference === '2022/2')).toBe(true);
  });

  it('UC-S100A-NUANCED surfaces when any classification is BLUE or RED', () => {
    const r = classifyS100AZones({ beneficiaries: [baseBen()] });
    expect(r.uncomputed.some((u) => u.id === 'UC-S100A-NUANCED')).toBe(true);
  });

  it('UC-S100A-NUANCED does NOT surface when all classifications are WHITE/GREEN', () => {
    const r = classifyS100AZones({
      isTestamentaryTrust: true,
      beneficiaries: [baseBen()],
    });
    expect(r.uncomputed.find((u) => u.id === 'UC-S100A-NUANCED')).toBeUndefined();
  });
});

describe('integration with allocateTrustDistribution', () => {
  it('without s100aFacts → conservative UC-S100A-RISK flag stays', async () => {
    const { allocateTrustDistribution } = await import(
      '@/lib/tax-engine/divisions/trustDistribution'
    );
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [
        { id: 'b1', name: 'A', presentlyEntitledShare: 1.0 },
      ],
    });
    expect(r.s100aClassification).toBeUndefined();
    expect(r.uncomputed.some((u) => u.id === 'UC-S100A-RISK')).toBe(true);
  });

  it('with s100aFacts → real classification + UC-S100A-RISK flag GONE', async () => {
    const { allocateTrustDistribution } = await import(
      '@/lib/tax-engine/divisions/trustDistribution'
    );
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [
        { id: 'b1', name: 'Sarah', presentlyEntitledShare: 1.0 },
      ],
      hasFamilyTrustElection: true,
      s100aFacts: [
        {
          beneficiaryId: 'b1',
          relationshipToController: 'IMMEDIATE_FAMILY',
          beneficiaryReceivedFunds: true,
        },
      ],
    });
    expect(r.s100aClassification).toBeDefined();
    expect(r.s100aClassification?.classifications[0].zone).toBe('GREEN');
    expect(r.s100aClassification?.highestZone).toBe('GREEN');
    expect(r.uncomputed.some((u) => u.id === 'UC-S100A-RISK')).toBe(false);
  });

  it('s100aFacts revealing RED zone → classifier surfaces RED + UC-S100A-NUANCED', async () => {
    const { allocateTrustDistribution } = await import(
      '@/lib/tax-engine/divisions/trustDistribution'
    );
    const r = allocateTrustDistribution({
      trustNetIncome: 100000,
      beneficiaries: [
        { id: 'b1', name: 'A', presentlyEntitledShare: 1.0 },
      ],
      s100aFacts: [
        {
          beneficiaryId: 'b1',
          unpaidPresentEntitlement: true,
          fundsUsedByOther: true,
        },
      ],
    });
    expect(r.s100aClassification?.highestZone).toBe('RED');
    expect(r.uncomputed.some((u) => u.id === 'UC-S100A-NUANCED')).toBe(true);
    expect(r.uncomputed.some((u) => u.id === 'UC-S100A-RISK')).toBe(false);
  });
});
