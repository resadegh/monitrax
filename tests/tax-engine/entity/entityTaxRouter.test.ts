/**
 * `entityTaxRouter` skeleton tests — Phase 41e.0 slice D.
 *
 * Pins both halves of the contract:
 *   - PERSONAL_NAME / SOLE_TRADER → real Phase 20 result + citations
 *   - COMPANY / TRUST / SMSF / PARTNERSHIP → null result + UNCOMPUTED flag
 *     (per audit §10.3 — never false numbers)
 *
 * As 41e.1+ ship per-rule dispatch, the UNCOMPUTED branches flip one
 * by one; these tests update with each PR. Today they lock the
 * skeleton's structural correctness.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateEntityTaxPosition,
  entityHasComputedTax,
} from '@/lib/tax-engine/entity/entityTaxRouter';
import type { EntityTaxFacts } from '@/lib/tax-engine/types';

const baseFacts = (
  overrides: Partial<EntityTaxFacts> = {},
): EntityTaxFacts => ({
  entityId: 'e-test',
  entityType: 'PERSONAL_NAME',
  fy: { financialYear: '2024-25', label: 'FY24-25' },
  incomes: [],
  expenses: [],
  depreciations: [],
  ...overrides,
});

describe('calculateEntityTaxPosition — PERSONAL_NAME / SOLE_TRADER (computed)', () => {
  it('PERSONAL_NAME with no inputs returns zeroed Phase 20 result', () => {
    const result = calculateEntityTaxPosition(baseFacts({ entityType: 'PERSONAL_NAME' }));
    expect(result.entityId).toBe('e-test');
    expect(result.entityType).toBe('PERSONAL_NAME');
    expect(result.result).not.toBeNull();
    expect(result.uncomputed).toEqual([]);
    expect(result.citations.length).toBeGreaterThan(0);
    // Sanity — citations include ITAA 1997 s4-10
    expect(result.citations.some((c) => c.kind === 'ITAA_1997' && c.reference === 's4-10')).toBe(true);
  });

  it('PERSONAL_NAME with $130k salary lands in 30% bracket', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'PERSONAL_NAME',
        incomes: [
          {
            id: 'i1',
            name: 'Salary',
            type: 'SALARY',
            amount: 130000,
            frequency: 'ANNUALLY',
            grossAmount: 130000,
          },
        ],
      }),
    );
    expect(result.uncomputed).toEqual([]);
    // result.result is unknown-typed — narrow for assertion
    const taxResult = result.result as { tax: { marginalRate: number } } | null;
    expect(taxResult?.tax.marginalRate).toBe(30);
  });

  it('SOLE_TRADER routes through Phase 20 with s8-1 citation', () => {
    const result = calculateEntityTaxPosition(baseFacts({ entityType: 'SOLE_TRADER' }));
    expect(result.uncomputed).toEqual([]);
    expect(result.citations.some((c) => c.reference === 's8-1')).toBe(true);
  });
});

describe('calculateEntityTaxPosition — UNCOMPUTED branches', () => {
  const uncomputedTypes = [
    'COMPANY',
    'DISCRETIONARY_TRUST',
    'UNIT_TRUST',
    'SMSF',
    'PARTNERSHIP',
  ] as const;

  uncomputedTypes.forEach((type) => {
    it(`${type} returns null result + UNCOMPUTED flag (no false numbers)`, () => {
      const result = calculateEntityTaxPosition(baseFacts({ entityType: type }));
      expect(result.entityType).toBe(type);
      expect(result.result).toBeNull();
      expect(result.citations).toEqual([]);
      expect(result.uncomputed.length).toBe(1);
      expect(result.uncomputed[0].id).toMatch(/^UC-ENTITY-/);
      expect(result.uncomputed[0].rationale.length).toBeGreaterThan(20);
    });
  });

  it('UNCOMPUTED rationale references the sub-PR that will resolve it', () => {
    const company = calculateEntityTaxPosition(baseFacts({ entityType: 'COMPANY' }));
    expect(company.uncomputed[0].rationale).toMatch(/41e\.\d/);
    const trust = calculateEntityTaxPosition(baseFacts({ entityType: 'DISCRETIONARY_TRUST' }));
    expect(trust.uncomputed[0].rationale).toMatch(/41e\.\d/);
    const smsf = calculateEntityTaxPosition(baseFacts({ entityType: 'SMSF' }));
    expect(smsf.uncomputed[0].rationale).toMatch(/41e\.\d/);
  });
});

describe('entityHasComputedTax', () => {
  it('returns true for PERSONAL_NAME + SOLE_TRADER', () => {
    expect(entityHasComputedTax('PERSONAL_NAME')).toBe(true);
    expect(entityHasComputedTax('SOLE_TRADER')).toBe(true);
  });

  it('returns false for the not-yet-implemented entity types', () => {
    expect(entityHasComputedTax('COMPANY')).toBe(false);
    expect(entityHasComputedTax('DISCRETIONARY_TRUST')).toBe(false);
    expect(entityHasComputedTax('UNIT_TRUST')).toBe(false);
    expect(entityHasComputedTax('SMSF')).toBe(false);
    expect(entityHasComputedTax('PARTNERSHIP')).toBe(false);
  });
});

describe('Phase 41e.1 slice D-1 — TRUST entities flip when trustDistribution provided', () => {
  it('DISCRETIONARY_TRUST WITHOUT trustDistribution → still UNCOMPUTED', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({ entityType: 'DISCRETIONARY_TRUST' }),
    );
    expect(result.result).toBeNull();
    expect(result.uncomputed[0]?.id).toMatch(/^UC-ENTITY-DISCRETIONARY-TRUST/);
  });

  it('DISCRETIONARY_TRUST WITH trustDistribution → computed Div 6 result', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'DISCRETIONARY_TRUST',
        trustDistribution: {
          trustNetIncome: 100000,
          beneficiaries: [
            { id: 'b1', name: 'Sarah', presentlyEntitledShare: 1.0 },
          ],
          hasFamilyTrustElection: true,
        },
      }),
    );
    expect(result.result).not.toBeNull();
    // Result is the trustDistribution payload — narrow to assert
    const distResult = result.result as {
      distributions: Array<{ amount: number }>;
      trusteeRetainedAmount: number;
    };
    expect(distResult.distributions[0].amount).toBe(100000);
    expect(distResult.trusteeRetainedAmount).toBe(0);
    // Citations include ITAA 1936 s95 + s97 from the distribution module
    expect(result.citations.some((c) => c.reference === 's95')).toBe(true);
    expect(result.citations.some((c) => c.reference === 's97')).toBe(true);
    // UNCOMPUTED still includes UC-S100A-RISK + UC-DIV-6E-STREAMING
    expect(result.uncomputed.some((u) => u.id === 'UC-S100A-RISK')).toBe(true);
    expect(result.uncomputed.some((u) => u.id === 'UC-DIV-6E-STREAMING')).toBe(true);
    // No more UC-ENTITY-DISCRETIONARY-TRUST (the placeholder is gone)
    expect(
      result.uncomputed.some((u) => u.id === 'UC-ENTITY-DISCRETIONARY-TRUST'),
    ).toBe(false);
  });

  it('UNIT_TRUST WITH trustDistribution → computed Div 6 result', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'UNIT_TRUST',
        trustDistribution: {
          trustNetIncome: 200000,
          beneficiaries: [
            { id: 'u1', name: 'Unit Holder A', presentlyEntitledShare: 0.6 },
            { id: 'u2', name: 'Unit Holder B', presentlyEntitledShare: 0.4 },
          ],
        },
      }),
    );
    expect(result.result).not.toBeNull();
    const distResult = result.result as {
      distributions: Array<{ amount: number }>;
    };
    expect(distResult.distributions[0].amount).toBe(120000);
    expect(distResult.distributions[1].amount).toBe(80000);
  });

  it('partial entitlement → trustee retains residual at 47% s99A penalty', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'DISCRETIONARY_TRUST',
        trustDistribution: {
          trustNetIncome: 100000,
          beneficiaries: [
            { id: 'b1', name: 'A', presentlyEntitledShare: 0.5 },
          ],
        },
      }),
    );
    const distResult = result.result as {
      trusteeRetainedAmount: number;
      trusteePenaltyTax: number;
    };
    expect(distResult.trusteeRetainedAmount).toBe(50000);
    expect(distResult.trusteePenaltyTax).toBeCloseTo(50000 * 0.47, 6);
    // s99A citation surfaces only when residual > 0
    expect(result.citations.some((c) => c.reference === 's99A')).toBe(true);
  });

  it('COMPANY / SMSF still UNCOMPUTED even without distribution data', () => {
    const company = calculateEntityTaxPosition(
      baseFacts({ entityType: 'COMPANY' }),
    );
    expect(company.result).toBeNull();
    const smsf = calculateEntityTaxPosition(
      baseFacts({ entityType: 'SMSF' }),
    );
    expect(smsf.result).toBeNull();
  });

  it('PERSONAL_NAME ignores trustDistribution (it does not apply)', () => {
    // Pass trustDistribution to a PERSONAL_NAME and verify the router
    // routes through Phase 20 — trust distribution is silently ignored
    // (PERSONAL_NAMEs cannot distribute as trustees).
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'PERSONAL_NAME',
        trustDistribution: {
          trustNetIncome: 100000,
          beneficiaries: [{ id: 'b1', name: 'X', presentlyEntitledShare: 1.0 }],
        },
        incomes: [
          {
            id: 'i1',
            name: 'Salary',
            type: 'SALARY',
            amount: 80000,
            frequency: 'ANNUALLY',
            grossAmount: 80000,
          },
        ],
      }),
    );
    // PERSONAL_NAME used the Phase 20 path — no distribution payload.
    const taxResult = result.result as { tax: { marginalRate: number } } | null;
    expect(taxResult?.tax).toBeDefined();
  });
});

describe('Phase 41e.1 slice D-2 — cgtEvents wired into router', () => {
  it('PERSONAL_NAME with cgtEvents → cgtResult + 50% discount', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'PERSONAL_NAME',
        cgtEvents: [{ id: 'e1', monthsHeld: 24, nominalAmount: 100000 }],
      }),
    );
    expect(result.cgtResult).toBeDefined();
    const cgt = result.cgtResult as {
      assessableNetCapitalGain: number;
      discountResult: { discountRate: number } | null;
    };
    expect(cgt.assessableNetCapitalGain).toBe(50000);
    expect(cgt.discountResult?.discountRate).toBe(0.5);
    // Citations include both Phase 20 base + CGT (s100-50, s115-100, Div 102-A, s115-25)
    expect(result.citations.some((c) => c.reference === 's115-25')).toBe(true);
    expect(result.citations.some((c) => c.reference === 's100-50')).toBe(true);
  });

  it('COMPANY with cgtEvents → cgtResult populated (0% discount per s115-280) BUT result still null (income tax UNCOMPUTED)', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'COMPANY',
        cgtEvents: [{ id: 'e1', monthsHeld: 60, nominalAmount: 200000 }],
      }),
    );
    // Income tax still UNCOMPUTED — that's 41e.7 territory
    expect(result.result).toBeNull();
    expect(result.uncomputed.some((u) => u.id === 'UC-ENTITY-COMPANY')).toBe(true);
    // But CGT is fully computed
    expect(result.cgtResult).toBeDefined();
    const cgt = result.cgtResult as {
      assessableNetCapitalGain: number;
      discountResult: { discountRate: number } | null;
    };
    expect(cgt.assessableNetCapitalGain).toBe(200000); // 0% discount → full gain
    expect(cgt.discountResult?.discountRate).toBe(0);
    // Citations include s115-280 (the COMPANY carve-out — audit-corrected citation)
    expect(result.citations.some((c) => c.reference === 's115-10')).toBe(true);
  });

  it('SMSF with cgtEvents → 33⅓% discount on cgtResult', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'SMSF',
        cgtEvents: [{ id: 'e1', monthsHeld: 18, nominalAmount: 90000 }],
        smsfIsComplying: true,
      }),
    );
    const cgt = result.cgtResult as {
      assessableNetCapitalGain: number;
      discountResult: { discountRate: number } | null;
    };
    expect(cgt.discountResult?.discountRate).toBeCloseTo(1 / 3, 6);
    expect(cgt.assessableNetCapitalGain).toBeCloseTo(60000, 2);
  });

  it('TRUST with BOTH trustDistribution AND cgtEvents → both populated independently', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'DISCRETIONARY_TRUST',
        trustDistribution: {
          trustNetIncome: 100000,
          beneficiaries: [
            { id: 'b1', name: 'Sarah', presentlyEntitledShare: 1.0 },
          ],
        },
        cgtEvents: [{ id: 'e1', monthsHeld: 36, nominalAmount: 80000 }],
      }),
    );
    // Distribution result lives on .result
    const dist = result.result as { distributions: Array<{ amount: number }> };
    expect(dist.distributions[0].amount).toBe(100000);
    // CGT result lives on .cgtResult — TRUST gets 50% discount
    const cgt = result.cgtResult as {
      assessableNetCapitalGain: number;
      discountResult: { discountRate: number };
    };
    expect(cgt.assessableNetCapitalGain).toBe(40000);
    expect(cgt.discountResult.discountRate).toBe(0.5);
    // Citations from BOTH dispatches present, deduplicated
    expect(result.citations.some((c) => c.reference === 's95')).toBe(true);
    expect(result.citations.some((c) => c.reference === 's115-25')).toBe(true);
    // No citation duplicated
    const refs = result.citations.map((c) => `${c.kind}:${c.reference}`);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it('losses > gains → carry-forward residual surfaces; no discount', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'PERSONAL_NAME',
        cgtEvents: [
          { id: 'g1', monthsHeld: 24, nominalAmount: 30000 },
          { id: 'l1', monthsHeld: 18, nominalAmount: -50000 },
        ],
      }),
    );
    const cgt = result.cgtResult as {
      assessableNetCapitalGain: number;
      carryForwardOut: number;
      discountResult: unknown;
    };
    expect(cgt.assessableNetCapitalGain).toBe(0);
    expect(cgt.carryForwardOut).toBe(20000);
    expect(cgt.discountResult).toBeNull();
  });

  it('prior-year carry-forward losses applied via body field', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'PERSONAL_NAME',
        cgtEvents: [{ id: 'g1', monthsHeld: 24, nominalAmount: 80000 }],
        carryForwardCapitalLosses: [
          { financialYear: '2022-23', amount: 20000 },
        ],
      }),
    );
    const cgt = result.cgtResult as { assessableNetCapitalGain: number };
    // Net gain $60k after $20k prior-year loss → 50% discount → $30k assessable
    expect(cgt.assessableNetCapitalGain).toBe(30000);
  });

  it('no cgtEvents → cgtResult is undefined', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({ entityType: 'PERSONAL_NAME' }),
    );
    expect(result.cgtResult).toBeUndefined();
  });

  it('empty cgtEvents array → cgtResult is undefined', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({ entityType: 'PERSONAL_NAME', cgtEvents: [] }),
    );
    expect(result.cgtResult).toBeUndefined();
  });
});

describe('Phase 41e.2 — SMSF contribution caps wired into router', () => {
  it('SMSF without smsfContributions → still UNCOMPUTED', () => {
    const result = calculateEntityTaxPosition(baseFacts({ entityType: 'SMSF' }));
    expect(result.result).toBeNull();
    expect(result.uncomputed[0]?.id).toBe('UC-ENTITY-SMSF');
  });

  it('SMSF with smsfContributions → computed CapTrackingResult', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'SMSF',
        smsfContributions: {
          concessionalYTD: 20000,
          nonConcessionalYTD: 0,
          totalSuperBalance: 600000,
        },
      }),
    );
    expect(result.result).not.toBeNull();
    const cap = (result.result as { capResult: any }).capResult as {
      concessional: { cap: number; remaining: number; isExceeded: boolean };
      nonConcessional: { cap: number };
    };
    // FY24-25 cap is $30,000 — $20,000 used → $10,000 remaining
    expect(cap.concessional.cap).toBe(30000);
    expect(cap.concessional.remaining).toBe(10000);
    expect(cap.concessional.isExceeded).toBe(false);
    expect(cap.nonConcessional.cap).toBe(120000);
    // Citations: s291-20 + s292-85 + Pt 8 SIS
    expect(result.citations.some((c) => c.reference === 's291-20')).toBe(true);
    expect(result.citations.some((c) => c.reference === 's292-85')).toBe(true);
    // SMSF triumvirate UNCOMPUTED still surfaces (full sole-purpose / in-house / LRBA lands in 41e.11)
    expect(result.uncomputed.some((u) => u.id === 'UC-SMSF-SOLE-PURPOSE')).toBe(true);
    // The "ENTITY-SMSF" placeholder flag is GONE
    expect(result.uncomputed.some((u) => u.id === 'UC-ENTITY-SMSF')).toBe(false);
  });

  it('SMSF concessional cap exceeded → isExceeded true + warning', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'SMSF',
        smsfContributions: {
          concessionalYTD: 35000, // over $30k cap
          nonConcessionalYTD: 0,
          totalSuperBalance: 400000,
        },
      }),
    );
    const cap = (result.result as { capResult: any }).capResult as {
      concessional: { isExceeded: boolean; excessAmount: number };
      excessContributionsTax: number;
    };
    expect(cap.concessional.isExceeded).toBe(true);
    expect(cap.concessional.excessAmount).toBe(5000);
    expect(cap.excessContributionsTax).toBeGreaterThan(0);
  });

  it('SMSF carry-forward unused concessional applied (TSB < $500k)', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'SMSF',
        smsfContributions: {
          concessionalYTD: 30000,
          nonConcessionalYTD: 0,
          totalSuperBalance: 400000, // < $500k threshold
          carryForwardAmounts: [
            { financialYear: '2022-23', unusedAmount: 10000 },
          ],
        },
      }),
    );
    const cap = (result.result as { capResult: any }).capResult as {
      concessional: { carryForwardAvailable: number; totalAvailable: number };
    };
    // Carry-forward grants extra $10k headroom; total available $40k
    expect(cap.concessional.carryForwardAvailable).toBe(10000);
    expect(cap.concessional.totalAvailable).toBe(40000);
  });

  it('SMSF with highIncomeSuper → Div 293 surcharge + TBC populated', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'SMSF',
        smsfContributions: {
          concessionalYTD: 30000,
          nonConcessionalYTD: 0,
          totalSuperBalance: 1000000,
        },
        highIncomeSuper: {
          div293Income: 280000,
          concessionalContributions: 30000,
          totalSuperBalance: 1000000,
          transferBalanceUsed: 1500000,
        },
      }),
    );
    const wrapper = result.result as {
      capResult: unknown;
      highIncomeSuperTax: {
        div293: { applies: boolean; tax: number };
        tbc: { headroom: number };
      };
    };
    expect(wrapper.capResult).toBeDefined();
    expect(wrapper.highIncomeSuperTax.div293.applies).toBe(true);
    expect(wrapper.highIncomeSuperTax.div293.tax).toBeGreaterThan(0);
    expect(wrapper.highIncomeSuperTax.tbc.headroom).toBe(400000); // $1.9M cap - $1.5M used
  });

  it('SMSF with both smsfContributions AND cgtEvents → both populated', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'SMSF',
        smsfContributions: {
          concessionalYTD: 15000,
          nonConcessionalYTD: 0,
          totalSuperBalance: 800000,
        },
        cgtEvents: [{ id: 'e1', monthsHeld: 18, nominalAmount: 90000 }],
        smsfIsComplying: true,
      }),
    );
    // result has the cap tracking
    expect(result.result).not.toBeNull();
    // cgtResult has the 33⅓% disposal
    const cgt = result.cgtResult as { discountResult: { discountRate: number } };
    expect(cgt.discountResult.discountRate).toBeCloseTo(1 / 3, 6);
  });
});

// =============================================================================
// Stage D PR-1 — honesty hardening (AD-1, AD-3, AD-4; approved 2026-06-12)
// =============================================================================

describe('Stage D PR-1 — extended entity types never fall through silently (AD-4)', () => {
  const EXTENDED: EntityTaxFacts['entityType'][] = [
    'INDIVIDUAL',
    'FIXED_TRUST',
    'HYBRID_TRUST',
    'BARE_TRUST',
    'TESTAMENTARY_TRUST',
    'DECEASED_ESTATE',
    'FOREIGN_COMPANY',
    'INCORPORATED_ASSOCIATION',
    'CO_OPERATIVE',
    'STRATA_BODY_CORPORATE',
    'CUSTODIAN_PLATFORM',
    'OTHER',
  ];
  it.each(EXTENDED)('%s returns an explicit UNCOMPUTED flag — no false silence', (type) => {
    const result = calculateEntityTaxPosition(baseFacts({ entityType: type }));
    expect(result.result).toBeNull();
    expect(result.uncomputed.length).toBeGreaterThan(0);
    expect(result.uncomputed[0].rationale.length).toBeGreaterThan(20);
  });

  it('deceased estate cites the s99/s99A administration gate', () => {
    const result = calculateEntityTaxPosition(baseFacts({ entityType: 'DECEASED_ESTATE' }));
    expect(result.uncomputed[0].id).toBe('UC-ENTITY-DECEASED-ESTATE');
    expect(result.uncomputed[0].rationale).toContain('s99');
  });
});

describe('Stage D PR-1 — Div 5A partnership subtype dispatch (AD-1)', () => {
  it('a corporate limited partnership is NEVER computed as transparent', () => {
    for (const subtype of ['LIMITED', 'INCORPORATED_LIMITED']) {
      const result = calculateEntityTaxPosition(
        baseFacts({ entityType: 'PARTNERSHIP', partnershipSubtype: subtype }),
      );
      expect(result.result).toBeNull();
      expect(result.uncomputed[0].id).toBe('UC-ENTITY-CLP');
      expect(result.uncomputed[0].citation?.reference).toBe('Div 5A');
    }
  });

  it('VCLP / ESVCLP carry the Measure 7 flag (§12.14 — no post-reform math)', () => {
    for (const subtype of ['VCLP', 'ESVCLP']) {
      const result = calculateEntityTaxPosition(
        baseFacts({ entityType: 'PARTNERSHIP', partnershipSubtype: subtype }),
      );
      expect(result.uncomputed[0].id).toBe('UC-ENTITY-VCLP');
      expect(result.uncomputed[0].rationale).toContain('Measure 7');
    }
  });

  it('a general partnership keeps the generic transparent-partnership flag', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({ entityType: 'PARTNERSHIP', partnershipSubtype: 'GENERAL' }),
    );
    expect(result.uncomputed[0].id).toBe('UC-ENTITY-PARTNERSHIP');
  });
});

describe('Stage D PR-1 — suppressed streaming surfaces UC-DIV-6E-STREAMING (AD-3)', () => {
  it('flags the stripped stream while still computing the proportionate allocation', () => {
    const result = calculateEntityTaxPosition(
      baseFacts({
        entityType: 'DISCRETIONARY_TRUST',
        trustDistribution: {
          trustNetIncome: 100_000,
          beneficiaries: [
            { id: 'b1', name: 'Reza', presentlyEntitledShare: 0.5 },
            { id: 'b2', name: 'Newsha', presentlyEntitledShare: 0.5 },
          ],
          streamingSuppressed: true,
        },
      }),
    );
    expect(result.result).not.toBeNull(); // proportionate allocation computed
    expect(result.uncomputed.some((u) => u.id === 'UC-DIV-6E-STREAMING')).toBe(true);
  });
});

describe('Stage D PR-2 — assembler notes surface on every branch', () => {
  it('merges assemblerNotes into uncomputed (de-duped)', () => {
    const note = {
      id: 'UC-CGT-PARCEL-ID',
      rationale: 'Capital gains were matched first-in-first-out.',
    };
    const result = calculateEntityTaxPosition(
      baseFacts({ entityType: 'PERSONAL_NAME', assemblerNotes: [note, note] }),
    );
    expect(result.uncomputed.filter((u) => u.id === 'UC-CGT-PARCEL-ID')).toHaveLength(1);
  });
});

// =============================================================================
// Conformance audit fixes (2026-06-12) — regression pins
// =============================================================================

import { calculateBringForward } from '@/lib/tax-engine/super/capTracker';
import { getTaxYearConfig } from '@/lib/tax-engine/config/taxYearConfig';
import { determineTaxability } from '@/lib/tax-engine/income/taxabilityRules';

describe('Audit fix 1 — bring-forward bands (s292-85)', () => {
  const fy25 = getTaxYearConfig('2024-25'); // NCC $120k, TBC $1.9M tiers
  it('TSB ≥ general TBC → NIL cap (never the standard cap)', () => {
    const r = calculateBringForward(1_950_000, fy25);
    expect(r.yearsAvailable).toBe(0);
    expect(r.totalCap).toBe(0);
    expect(r.eligible).toBe(false);
  });
  it('reduced band ($1.78M–<$1.9M) → ONE year, standard cap (never $240k)', () => {
    const r = calculateBringForward(1_850_000, fy25);
    expect(r.yearsAvailable).toBe(1);
    expect(r.totalCap).toBe(120_000);
  });
  it('middle band → 2 years; low TSB → 3 years', () => {
    expect(calculateBringForward(1_700_000, fy25).totalCap).toBe(240_000);
    expect(calculateBringForward(1_000_000, fy25).totalCap).toBe(360_000);
  });
  it('FY25-26 tiers index with the $2.0M TBC', () => {
    const fy26 = getTaxYearConfig('2025-26');
    expect(calculateBringForward(1_990_000, fy26).totalCap).toBe(120_000); // reduced band under $2.0M TBC
    expect(calculateBringForward(2_000_000, fy26).totalCap).toBe(0);
  });
});

describe('Audit fix 2 — explicit franking credits win over 30/70 recompute (s202-60)', () => {
  it('a base-rate-entity dividend keeps its 25%-rate credits', () => {
    // $7,500 dividend fully franked at 25% → credits $2,500 (not $3,214 at 30/70).
    const r = determineTaxability({
      incomeType: 'DIVIDEND',
      amount: 7500,
      frequency: 'ANNUALLY',
      frankingPercentage: 100,
      frankingCredits: 2500,
    });
    expect(r.frankingCredits).toBe(2500);
    expect(r.taxableAmount).toBe(10000);
  });
  it('falls back to the 30/70 recompute when no explicit credits exist', () => {
    const r = determineTaxability({
      incomeType: 'DIVIDEND',
      amount: 7000,
      frequency: 'ANNUALLY',
      frankingPercentage: 100,
    });
    expect(r.frankingCredits).toBeCloseTo(3000, 0);
  });
});
