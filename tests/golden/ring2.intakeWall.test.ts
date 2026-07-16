/**
 * R3 — Golden-household intake-trap fixtures (wall Part 5,
 * INTAKE_INTEGRITY_GUARDRAIL.md §4 R3).
 *
 * The three traps that produced the recurring bug families, reproduced as
 * golden shapes and locked end-to-end:
 *   1. WEEKLY RENT  (MON-001)  — payments 7 days apart must classify + store
 *      WEEKLY and annualise ×52 identically on Float and Decimal engines.
 *   2. SINGLE ATO DEPOSIT (MON-053) — one lone deposit must classify one-off
 *      and be counted ONCE by both engines, never ×frequency.
 *   3. FRAGMENTED STREAM (MON-076/037) — a payment for an existing stream
 *      must match the existing row (exact or near-duplicate), never mint a
 *      name-variant sibling.
 *
 * These fixtures are ADDITIVE — they deliberately do NOT touch GOLDEN_DB
 * (whose EXPECTED values many Ring-2 suites pin).
 */
import { describe, it, expect } from 'vitest';
import { classifyIntake } from '../../lib/intake/classifyIntake';
import { detectCadenceMismatch, detectOneOffFingerprint } from '../../lib/intake/detectors';
import {
  calculateTaxPosition,
  calculateTaxPositionDecimal,
} from '../../lib/tax-engine/position/taxPositionCalculator';

const NO_SUPER = { concessional: 0, nonConcessional: 0 };
const FY = '2025-26';

/** Trap 1 — a weekly rent stream: 8 payments, exactly 7 days apart. */
const WEEKLY_RENT_DATES = Array.from(
  { length: 8 },
  (_, i) => new Date(Date.UTC(2026, 0, 2 + i * 7)),
);

/** Trap 2 — one lone ATO deposit (the MON-053 shape). */
const ATO_DEPOSIT = { name: 'Ato Ato001100022493651', amount: 9098 };

/** Trap 3 — a fragmented stream: the existing row + an incoming name variant. */
const EXISTING_STREAM = { id: 'inc-ingeus', name: 'Ingeus Salary', amount: 4200 };

describe('R3 trap 1 · weekly rent (MON-001)', () => {
  it('classifies WEEKLY from the payment dates — never silently monthly', () => {
    const r = classifyIntake({
      kind: 'income',
      source: 'TRANSACTION_LINK',
      transactionDates: WEEKLY_RENT_DATES,
    });
    expect(r.frequency).toBe('WEEKLY');
  });

  it('a mis-stored MONTHLY row over the same payments is flagged by D2', () => {
    const flag = detectCadenceMismatch({
      frequency: 'MONTHLY',
      isRecurring: true,
      transactionDates: WEEKLY_RENT_DATES,
    });
    expect(flag?.implied).toBe('WEEKLY');
  });

  it('WEEKLY annualises ×52 identically on Float and Decimal engines ($600/wk → $31,200/yr)', () => {
    const input = {
      incomes: [{ id: 'i-w', name: 'Rent', type: 'RENTAL', amount: 600, frequency: 'WEEKLY' }],
      expenses: [],
      depreciations: [],
      superContributions: NO_SUPER,
      financialYear: FY,
    };
    const f = calculateTaxPosition(input);
    const d = calculateTaxPositionDecimal(input);
    expect(f.income.rental).toBe(600 * 52);
    expect(Number(d.income.rental.toString())).toBeCloseTo(f.income.rental, 6);
  });
});

describe('R3 trap 2 · single ATO deposit (MON-053)', () => {
  it('a single-import deposit classifies one-off when the dialog says so', () => {
    const r = classifyIntake({
      kind: 'income',
      source: 'TRANSACTION_LINK',
      declaredFrequency: 'MONTHLY',
      declaredIsRecurring: false, // the dialog's count≤1 gate
    });
    expect(r.isRecurring).toBe(false);
  });

  it('counted ONCE by both engines — never ×12 (Float/Decimal parity)', () => {
    const input = {
      incomes: [{ id: 'i-ato', name: ATO_DEPOSIT.name, type: 'OTHER', amount: ATO_DEPOSIT.amount, frequency: 'MONTHLY', isRecurring: false }],
      expenses: [],
      depreciations: [],
      superContributions: NO_SUPER,
      financialYear: FY,
    };
    const f = calculateTaxPosition(input);
    const d = calculateTaxPositionDecimal(input);
    expect(f.income.total).toBe(ATO_DEPOSIT.amount); // once, not 109,176
    expect(Number(d.income.total.toString())).toBeCloseTo(f.income.total, 6);
  });

  it('a leftover recurring row with this shape is flagged by D1', () => {
    expect(
      detectOneOffFingerprint({ isRecurring: true, transactionCount: 1, inWindowActual: 0 }),
    ).toEqual({ transactionCount: 1 });
  });
});

describe('R3 trap 3 · fragmented stream (MON-076/037)', () => {
  it('an exact-name payment reuses the existing row', () => {
    const r = classifyIntake({
      kind: 'expense',
      source: 'TRANSACTION_LINK',
      declaredFrequency: 'MONTHLY',
      streamPolicy: 'merchant',
      candidate: { name: 'ingeus salary', amount: 4200 },
      existingRows: [EXISTING_STREAM],
    });
    expect(r.streamMatch).toEqual({ id: 'inc-ingeus', confidence: 'exact' });
  });

  it('a name-variant payment near the same amount matches near-duplicate — never a sibling', () => {
    const r = classifyIntake({
      kind: 'expense',
      source: 'TRANSACTION_LINK',
      declaredFrequency: 'MONTHLY',
      streamPolicy: 'merchant',
      candidate: { name: 'Ingeus Salary Payment', amount: 4180 },
      existingRows: [EXISTING_STREAM],
    });
    expect(r.streamMatch).toEqual({ id: 'inc-ingeus', confidence: 'near-duplicate' });
  });

  it('a rental scope admits ONE stream regardless of name drift (MON-009 rule)', () => {
    const r = classifyIntake({
      kind: 'income',
      source: 'TRANSACTION_LINK',
      declaredFrequency: 'WEEKLY',
      streamPolicy: 'scope-singleton',
      existingRows: [{ id: 'i-rent', name: 'Rent — Avalon St', amount: 600 }],
    });
    expect(r.streamMatch).toEqual({ id: 'i-rent', confidence: 'exact' });
  });

  it('a genuinely different cost on the same scope does NOT match (no false merges)', () => {
    const r = classifyIntake({
      kind: 'expense',
      source: 'TRANSACTION_LINK',
      declaredFrequency: 'MONTHLY',
      streamPolicy: 'merchant',
      candidate: { name: 'Council rates', amount: 500 },
      existingRows: [EXISTING_STREAM],
    });
    expect(r.streamMatch).toBe(null);
  });
});
