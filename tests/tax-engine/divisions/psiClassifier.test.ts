/**
 * Phase 41e.9 — PSI classifier tests.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyPsi,
  type PsiInput,
} from '@/lib/tax-engine/divisions/psiClassifier';

const baseInput = (o: Partial<PsiInput> = {}): PsiInput => ({
  totalPsiIncome: 200000,
  incomeFromLargestClient: 100000, // 50% — passes 80% test
  unrelatedClientCount: 0,
  ...o,
});

describe('classifyPsi — no PSI income', () => {
  it('zero income → not PSI, not PSB, no attribution', () => {
    const r = classifyPsi(baseInput({ totalPsiIncome: 0, incomeFromLargestClient: 0 }));
    expect(r.isPsi).toBe(false);
    expect(r.isPsb).toBe(false);
    expect(r.psiAttributedToIndividual).toBe(0);
  });
});

describe('classifyPsi — PSB Determination short-circuit', () => {
  it('holds determination → automatic PSB', () => {
    const r = classifyPsi(
      baseInput({
        hasPsbDetermination: true,
        // Even with all tests failing
        incomeFromLargestClient: 200000, // 100% one client
      }),
    );
    expect(r.isPsb).toBe(true);
    expect(r.psiAttributedToIndividual).toBe(0);
    expect(r.citations.some((c) => c.reference === 's87-60')).toBe(true);
  });
});

describe('classifyPsi — Results test (s87-18)', () => {
  it('results test passes → automatic PSB', () => {
    const r = classifyPsi(
      baseInput({
        meetsResultsTest: true,
        incomeFromLargestClient: 200000, // 100% — would otherwise fail
      }),
    );
    expect(r.isPsb).toBe(true);
    expect(r.tests.resultsTest).toBe('PASS');
    expect(r.psiAttributedToIndividual).toBe(0);
    expect(r.citations.some((c) => c.reference.includes('results test'))).toBe(true);
  });
});

describe('classifyPsi — 80%-one-client test', () => {
  it('income from one client < 80% → can use alternative tests', () => {
    const r = classifyPsi(
      baseInput({
        incomeFromLargestClient: 100000, // 50%
        unrelatedClientCount: 2,
        gainedClientsViaDirectAdvertising: true,
      }),
    );
    expect(r.tests.eightyPercentOneClient).toBe('PASS');
    expect(r.isPsb).toBe(true); // unrelated clients test passes
  });

  it('income from one client ≥ 80% → must use results test or determination', () => {
    const r = classifyPsi(
      baseInput({
        incomeFromLargestClient: 180000, // 90%
        meetsResultsTest: false,
        meetsEmploymentTest: true, // alternative tests no longer count
      }),
    );
    expect(r.tests.eightyPercentOneClient).toBe('FAIL');
    expect(r.isPsb).toBe(false);
    expect(r.psiAttributedToIndividual).toBe(200000);
  });

  it('income exactly 80% → fails the test (≥ 80%)', () => {
    const r = classifyPsi(
      baseInput({
        incomeFromLargestClient: 160000, // 80%
        meetsResultsTest: false,
      }),
    );
    expect(r.tests.eightyPercentOneClient).toBe('FAIL');
    expect(r.isPsb).toBe(false);
  });

  it('income just under 80% → passes', () => {
    const r = classifyPsi(
      baseInput({
        incomeFromLargestClient: 159000, // ~79.5%
        unrelatedClientCount: 2,
        gainedClientsViaDirectAdvertising: true,
      }),
    );
    expect(r.tests.eightyPercentOneClient).toBe('PASS');
  });
});

describe('classifyPsi — Unrelated Clients test (s87-20)', () => {
  it('< 80% one client + 2 unrelated clients via direct ads → PSB', () => {
    const r = classifyPsi(
      baseInput({
        unrelatedClientCount: 2,
        gainedClientsViaDirectAdvertising: true,
      }),
    );
    expect(r.tests.unrelatedClientsTest).toBe('PASS');
    expect(r.isPsb).toBe(true);
  });

  it('2 unrelated clients but NO direct advertising → fail unrelated test', () => {
    const r = classifyPsi(
      baseInput({
        unrelatedClientCount: 2,
        gainedClientsViaDirectAdvertising: false,
      }),
    );
    expect(r.tests.unrelatedClientsTest).toBe('FAIL');
    // PSI rules apply since no other test passes
    expect(r.isPsb).toBe(false);
    expect(r.psiAttributedToIndividual).toBe(200000);
  });

  it('only 1 unrelated client → fail unrelated test', () => {
    const r = classifyPsi(
      baseInput({
        unrelatedClientCount: 1,
        gainedClientsViaDirectAdvertising: true,
      }),
    );
    expect(r.tests.unrelatedClientsTest).toBe('FAIL');
  });
});

describe('classifyPsi — Employment test (s87-25)', () => {
  it('< 80% + employment test passes → PSB', () => {
    const r = classifyPsi(
      baseInput({
        incomeFromLargestClient: 100000, // 50%
        meetsEmploymentTest: true,
      }),
    );
    expect(r.isPsb).toBe(true);
    expect(r.tests.employmentTest).toBe('PASS');
  });
});

describe('classifyPsi — Business Premises test (s87-30)', () => {
  it('< 80% + premises test passes → PSB', () => {
    const r = classifyPsi(
      baseInput({
        incomeFromLargestClient: 100000,
        meetsBusinessPremisesTest: true,
      }),
    );
    expect(r.isPsb).toBe(true);
    expect(r.tests.businessPremisesTest).toBe('PASS');
  });
});

describe('classifyPsi — full attribution (no PSB qualifies)', () => {
  it('no tests pass → full PSI attributed to individual + UC-PSI-DEDUCTION-RESTRICTIONS', () => {
    const r = classifyPsi(baseInput()); // 50% one client but no alt tests
    expect(r.isPsi).toBe(true);
    expect(r.isPsb).toBe(false);
    expect(r.psiAttributedToIndividual).toBe(200000);
    expect(r.uncomputed.some((u) => u.id === 'UC-PSI-DEDUCTION-RESTRICTIONS')).toBe(true);
    expect(r.citations.some((c) => c.reference === 's86-15')).toBe(true);
  });

  it('100% one client + no results test → full PSI attribution', () => {
    const r = classifyPsi(
      baseInput({
        incomeFromLargestClient: 200000,
      }),
    );
    expect(r.isPsb).toBe(false);
    expect(r.psiAttributedToIndividual).toBe(200000);
  });
});

describe('classifyPsi — citation completeness', () => {
  it('always cites Part 2-42 + s84-5 + s87-15 + TR 2022/3', () => {
    const r = classifyPsi(baseInput());
    expect(r.citations.some((c) => c.reference.includes('Part 2-42'))).toBe(true);
    expect(r.citations.some((c) => c.reference === 's84-5')).toBe(true);
    expect(r.citations.some((c) => c.reference === 's87-15 (PSB)')).toBe(true);
    expect(r.citations.some((c) => c.reference === '2022/3')).toBe(true);
  });

  it('PSB by determination cites s87-60', () => {
    const r = classifyPsi(baseInput({ hasPsbDetermination: true }));
    expect(r.citations.some((c) => c.reference === 's87-60')).toBe(true);
  });

  it('PSB by results test cites s87-18', () => {
    const r = classifyPsi(baseInput({ meetsResultsTest: true }));
    expect(r.citations.some((c) => c.reference.includes('s87-18'))).toBe(true);
  });
});

describe('classifyPsi — test outcome reporting', () => {
  it('reports all 5 test outcomes for AFSL footer', () => {
    const r = classifyPsi(
      baseInput({
        meetsResultsTest: false,
        unrelatedClientCount: 1,
        gainedClientsViaDirectAdvertising: false,
        meetsEmploymentTest: false,
        meetsBusinessPremisesTest: false,
      }),
    );
    expect(r.tests).toMatchObject({
      eightyPercentOneClient: 'PASS',
      resultsTest: 'FAIL',
      unrelatedClientsTest: 'FAIL',
      employmentTest: 'FAIL',
      businessPremisesTest: 'FAIL',
    });
  });
});
