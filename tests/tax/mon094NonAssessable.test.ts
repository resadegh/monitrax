/**
 * MON-094 — tax "Other Income" pulled non-assessable ATO refunds into the
 * taxable gross (VR-019 items 11/19; VR-020 §D pre-fix baseline $10,300).
 *
 * The defect was CLASSIFICATION, not annualisation (MON-053's one-off guard
 * already counts one-offs once): an ATO-refund row can only be typed OTHER
 * (IncomeType enum), OTHER defaults to taxable-for-safety
 * (taxabilityRules.ts), and the exemption mechanism that already existed
 * (Income.taxCategory TAX_EXEMPT, Phase 20) never reached the engine — the
 * userTaxPosition IncomeItem map dropped it.
 *
 * Reza's rule (2026-07-21): tax gross = assessable income only — recurring
 * declared + genuine one-off assessable receipts (counted once); ATO
 * refunds / internal transfers / loan drawdowns excluded, auto.
 *
 * Rings here:
 *  - Ring-0: the row-level non-assessable override — taxCategory TAX_EXEMPT
 *    → $0 taxable on BOTH engines (Float + Decimal), regardless of type.
 *  - Ring-0: detectNonAssessable — the live ATO descriptor shapes match;
 *    ordinary income names do NOT (conservative, taxable-for-safety stays).
 *  - Ring-2 (worked example, live shape): salary + two tagged ATO refunds +
 *    a genuine one-off → Other Income = the genuine one-off ONLY; the
 *    pre-fix behaviour ($10,300) is pinned dead.
 *  - Ring-1 topology lock: the userTaxPosition IncomeItem map CARRIES
 *    taxCategory (the severed link this bug lived in), and the engine's
 *    determineTaxability call sites pass it through.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  calculateTaxPosition,
  calculateTaxPositionDecimal,
} from '../../lib/tax-engine/position/taxPositionCalculator';
import {
  determineTaxability,
  determineTaxabilityDecimal,
  NON_ASSESSABLE_TAX_CATEGORIES,
} from '../../lib/tax-engine/income/taxabilityRules';
import { detectNonAssessable } from '../../lib/intake/classifyIntake';

const NO_SUPER = { concessional: 0, nonConcessional: 0 };
const FY = '2025-26';

// The live descriptor shapes (VR-019/VR-020) — amounts are the worked
// example's arithmetic, not a pin of Reza's account.
const atoRefundBig = {
  id: 'ato-1',
  name: 'Ato Ato002000023189359',
  type: 'OTHER',
  amount: 9098,
  frequency: 'MONTHLY',
  isRecurring: false,
  taxCategory: 'TAX_EXEMPT', // tagged (at intake or via the review surface)
};
const atoRefundSmall = { ...atoRefundBig, id: 'ato-2', name: 'Ato Ato001100022493651', amount: 952 };
const genuineOneOff = {
  id: 'casual-1',
  name: 'Casual gardening job',
  type: 'OTHER',
  amount: 250,
  frequency: 'MONTHLY',
  isRecurring: false,
  // no taxCategory — genuine assessable one-off
};
const salary = {
  id: 'sal-1',
  name: 'Salary',
  type: 'SALARY',
  amount: 10000,
  frequency: 'MONTHLY',
  isRecurring: true,
};

describe('MON-094 · Ring-0: row-level non-assessable override (the ONE assessability decider)', () => {
  it('Float: taxCategory TAX_EXEMPT → $0 taxable, full amount exempt, regardless of type', () => {
    const r = determineTaxability({
      incomeType: 'OTHER',
      amount: 9098,
      frequency: 'ANNUALLY',
      taxCategory: 'TAX_EXEMPT',
    });
    expect(r.taxableAmount).toBe(0);
    expect(r.exemptAmount).toBe(9098);
    expect(r.category).toBe('TAX_EXEMPT');
  });

  it('Decimal twin: identical semantics (§12.2.1 — the paths never disagree)', () => {
    const r = determineTaxabilityDecimal({
      incomeType: 'OTHER',
      amount: 9098,
      taxCategory: 'TAX_EXEMPT',
    });
    expect(r.taxableAmount.toNumber()).toBe(0);
    expect(r.exemptAmount.toNumber()).toBe(9098);
  });

  it('an UNTAGGED OTHER row keeps the taxable-for-safety default (no silent exemption)', () => {
    const r = determineTaxability({ incomeType: 'OTHER', amount: 9098, frequency: 'ANNUALLY' });
    expect(r.taxableAmount).toBe(9098);
  });

  it('the non-assessable set is the ONE list and contains the exempt categories', () => {
    for (const c of ['TAX_EXEMPT', 'GOVERNMENT_EXEMPT', 'GIFTS', 'INHERITANCE', 'INSURANCE_PAYOUT']) {
      expect(NON_ASSESSABLE_TAX_CATEGORIES.has(c)).toBe(true);
    }
    expect(NON_ASSESSABLE_TAX_CATEGORIES.has('SALARY_WAGES')).toBe(false);
    expect(NON_ASSESSABLE_TAX_CATEGORIES.has('RENTAL')).toBe(false);
  });
});

describe('MON-094 · Ring-0: detectNonAssessable (conservative descriptor detection)', () => {
  it('matches the live ATO descriptor shapes', () => {
    expect(detectNonAssessable('Ato Ato002000023189359')?.kind).toBe('ATO_REFUND');
    expect(detectNonAssessable('Ato Ato001100022493651')?.kind).toBe('ATO_REFUND');
    expect(detectNonAssessable('Australian Taxation Office refund')?.kind).toBe('ATO_REFUND');
    expect(detectNonAssessable('Tax refund FY25')?.kind).toBe('ATO_REFUND');
  });

  it('matches transfers and drawdowns', () => {
    expect(detectNonAssessable('Internal transfer from savings')?.kind).toBe('INTERNAL_TRANSFER');
    expect(detectNonAssessable('Loan drawdown - Bankwest')?.kind).toBe('LOAN_DRAWDOWN');
    expect(detectNonAssessable('Redraw facility')?.kind).toBe('LOAN_DRAWDOWN');
  });

  it('does NOT match ordinary income names (false negative costs a click; false positive understates tax)', () => {
    expect(detectNonAssessable('Salary Transportservice')).toBeNull();
    expect(detectNonAssessable('Rent - Broadbeach')).toBeNull();
    expect(detectNonAssessable('Mrs Newsha Javahe Am 18may Credit To Acc')).toBeNull();
    expect(detectNonAssessable('Tomato stall takings')).toBeNull(); // "ato" inside a word never matches
    expect(detectNonAssessable('')).toBeNull();
    expect(detectNonAssessable(null)).toBeNull();
  });
});

describe('MON-094 · Ring-2 worked example (the live shape): assessable-only Other Income', () => {
  const incomes = [salary, atoRefundBig, atoRefundSmall, genuineOneOff];

  it('Float: Other Income = the genuine one-off ONLY ($250) — the ATO $10,050 contributes $0', () => {
    const r = calculateTaxPosition({
      incomes,
      expenses: [],
      depreciations: [],
      superContributions: NO_SUPER,
      financialYear: FY,
    });
    expect(r.income.other).toBe(250); // pre-fix: 10,300
    expect(r.income.salary).toBe(120000); // recurring salary untouched (12 × 10,000)
    expect(r.income.total).toBe(120250);
  });

  it('Decimal parity on the same shape', () => {
    const r = calculateTaxPositionDecimal({
      incomes,
      expenses: [],
      depreciations: [],
      superContributions: NO_SUPER,
      financialYear: FY,
    });
    expect(r.income.other.toNumber()).toBe(250);
    expect(r.income.total.toNumber()).toBe(120250);
  });

  it('a genuine one-off assessable receipt counts ONCE (not ×12, not $0) — MON-053 untouched', () => {
    const r = calculateTaxPosition({
      incomes: [genuineOneOff],
      expenses: [],
      depreciations: [],
      superContributions: NO_SUPER,
      financialYear: FY,
    });
    expect(r.income.other).toBe(250);
  });
});

describe('MON-094 · Ring-1 topology lock: the severed link stays closed', () => {
  it('userTaxPosition.ts carries taxCategory into the IncomeItem map', () => {
    const src = readFileSync(
      resolve(__dirname, '../../lib/tax-engine/position/userTaxPosition.ts'),
      'utf8',
    );
    expect(src).toMatch(/taxCategory:\s*income\.taxCategory/);
  });

  it('both determineTaxability call sites in the engine pass taxCategory through', () => {
    const src = readFileSync(
      resolve(__dirname, '../../lib/tax-engine/position/taxPositionCalculator.ts'),
      'utf8',
    );
    const passes = src.match(/taxCategory:\s*income\.taxCategory/g) ?? [];
    expect(passes.length).toBe(2); // Float + Decimal loops — a third caller must wire it too
  });

  it('the link-route income create tags non-assessable receipts via the ONE detector', () => {
    const src = readFileSync(
      resolve(__dirname, '../../app/api/transactions/[id]/link/route.ts'),
      'utf8',
    );
    expect(src).toMatch(/detectNonAssessable\(/);
  });
});
