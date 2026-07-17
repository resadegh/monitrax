/**
 * MON-078 — Ring-0 contract tests for the ONE intake classifier.
 *
 * Part-1 (keystone) semantics are BEHAVIOUR-PRESERVING: every legacy default
 * the producers carried is now named here — these tests pin exactly that
 * behaviour so the C1/C2/C3 controls change it DELIBERATELY (by editing these
 * expectations in the same PR as the control), never by drift.
 */
import { describe, it, expect } from 'vitest';
import { classifyIntake, normalizeFrequency } from '../../lib/intake/classifyIntake';

describe('MON-078 · normalizeFrequency', () => {
  it('accepts the Frequency enum, case-insensitively, ANNUALLY → ANNUAL', () => {
    expect(normalizeFrequency('WEEKLY')).toBe('WEEKLY');
    expect(normalizeFrequency('fortnightly')).toBe('FORTNIGHTLY');
    expect(normalizeFrequency('ANNUALLY')).toBe('ANNUAL');
    expect(normalizeFrequency('HALF_YEARLY')).toBe('HALF_YEARLY');
  });
  it('rejects junk and empties', () => {
    expect(normalizeFrequency('SOMETIMES')).toBe(null);
    expect(normalizeFrequency('')).toBe(null);
    expect(normalizeFrequency(null)).toBe(null);
  });
});

describe('MON-078 · frequency resolution', () => {
  it('C1 rule (in force for explicit input): WEEKLY/FORTNIGHTLY are stored as themselves', () => {
    expect(
      classifyIntake({ kind: 'income', source: 'MANUAL', declaredFrequency: 'WEEKLY' }).frequency,
    ).toBe('WEEKLY');
    expect(
      classifyIntake({ kind: 'expense', source: 'TRANSACTION_LINK', declaredFrequency: 'FORTNIGHTLY' }).frequency,
    ).toBe('FORTNIGHTLY');
  });

  it('declared wins over detected', () => {
    expect(
      classifyIntake({
        kind: 'expense', source: 'RECURRING_DETECTION',
        declaredFrequency: 'QUARTERLY', detectedFrequency: 'MONTHLY',
      }).frequency,
    ).toBe('QUARTERLY');
  });

  it('detected evidence used when nothing declared (recurring detection)', () => {
    expect(
      classifyIntake({ kind: 'expense', source: 'RECURRING_DETECTION', detectedFrequency: 'FORTNIGHTLY' }).frequency,
    ).toBe('FORTNIGHTLY');
  });

  it('MANUAL/ONBOARDING without a cadence is a caller bug — throws, never silently MONTHLY', () => {
    expect(() => classifyIntake({ kind: 'income', source: 'MANUAL' })).toThrow(/requires an explicit frequency/);
    expect(() => classifyIntake({ kind: 'income', source: 'ONBOARDING', declaredFrequency: 'SOMETIMES' })).toThrow();
  });

  it('LEGACY (C2 residual): import paths with NO evidence at all fall back to MONTHLY — in the classifier only', () => {
    expect(classifyIntake({ kind: 'income', source: 'TRANSACTION_LINK' }).frequency).toBe('MONTHLY');
    expect(classifyIntake({ kind: 'expense', source: 'DOCUMENT_IMPORT' }).frequency).toBe('MONTHLY');
  });

  // ── C1 (MON-001): cadence from transaction EVIDENCE ──
  const weekly = (n: number) =>
    Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 0, 2 + i * 7)));

  it('C1 census case: weekly rent payments → stored WEEKLY, never monthly (the ~4.3× class)', () => {
    const r = classifyIntake({
      kind: 'income',
      source: 'TRANSACTION_LINK',
      transactionDates: weekly(5), // 7-day deltas
    });
    expect(r.frequency).toBe('WEEKLY');
  });

  it('C1: fortnightly evidence → FORTNIGHTLY', () => {
    const dates = Array.from({ length: 4 }, (_, i) => new Date(Date.UTC(2026, 0, 2 + i * 14)));
    expect(classifyIntake({ kind: 'expense', source: 'TRANSACTION_LINK', transactionDates: dates }).frequency).toBe('FORTNIGHTLY');
  });

  it('C1: the user\'s explicit choice still WINS over evidence (suggest-and-confirm)', () => {
    const r = classifyIntake({
      kind: 'income',
      source: 'TRANSACTION_LINK',
      declaredFrequency: 'MONTHLY',
      transactionDates: weekly(5),
    });
    expect(r.frequency).toBe('MONTHLY');
  });

  it('C1: fewer than 2 valid dates is NOT evidence — falls through as before', () => {
    expect(
      classifyIntake({ kind: 'income', source: 'TRANSACTION_LINK', transactionDates: [new Date()] }).frequency,
    ).toBe('MONTHLY');
    expect(
      classifyIntake({ kind: 'income', source: 'TRANSACTION_LINK', transactionDates: ['garbage', new Date()] }).frequency,
    ).toBe('MONTHLY');
  });
});

describe('MON-078 · recurrence resolution (the source-default table, spec §3)', () => {
  it('an explicit choice always wins', () => {
    expect(
      classifyIntake({ kind: 'income', source: 'DOCUMENT_IMPORT', declaredFrequency: 'MONTHLY', declaredIsRecurring: false }).isRecurring,
    ).toBe(false);
    expect(
      classifyIntake({ kind: 'expense', source: 'TRANSACTION_LINK', declaredFrequency: 'MONTHLY', declaredIsRecurring: true }).isRecurring,
    ).toBe(true);
  });

  it('manual/declared = recurring (Reza decision 2026-07-15)', () => {
    expect(classifyIntake({ kind: 'income', source: 'MANUAL', declaredFrequency: 'MONTHLY' }).isRecurring).toBe(true);
    expect(classifyIntake({ kind: 'income', source: 'ONBOARDING', declaredFrequency: 'ANNUAL' }).isRecurring).toBe(true);
  });

  it('detected recurring pattern = recurring', () => {
    expect(classifyIntake({ kind: 'expense', source: 'RECURRING_DETECTION', detectedFrequency: 'MONTHLY' }).isRecurring).toBe(true);
  });

  it('transaction-link server default: expense one-off (#1421), income recurring (LEGACY, C2 target)', () => {
    expect(classifyIntake({ kind: 'expense', source: 'TRANSACTION_LINK' }).isRecurring).toBe(false);
    expect(classifyIntake({ kind: 'income', source: 'TRANSACTION_LINK' }).isRecurring).toBe(true);
  });

  it('document-import default recurring (LEGACY, C2 target)', () => {
    expect(classifyIntake({ kind: 'expense', source: 'DOCUMENT_IMPORT' }).isRecurring).toBe(true);
  });
});

describe('MON-078 · stream matching', () => {
  const battery = { id: 'e1', name: 'Battery', amount: 11385 };
  const rates = { id: 'e2', name: 'Council rates', amount: 500 };

  it('scope-singleton: any row on the scope IS the stream (MON-009 rental rule)', () => {
    const r = classifyIntake({
      kind: 'income', source: 'TRANSACTION_LINK', declaredFrequency: 'MONTHLY',
      streamPolicy: 'scope-singleton',
      existingRows: [{ id: 'inc1', name: 'Rent — Thornland', amount: 2000 }],
    });
    expect(r.streamMatch).toEqual({ id: 'inc1', confidence: 'exact' });
  });

  it('merchant: normalised equality → exact', () => {
    const r = classifyIntake({
      kind: 'expense', source: 'TRANSACTION_LINK', declaredFrequency: 'MONTHLY',
      streamPolicy: 'merchant',
      candidate: { name: 'battery', amount: 11385 },
      existingRows: [rates, battery],
    });
    expect(r.streamMatch).toEqual({ id: 'e1', confidence: 'exact' });
  });

  it('merchant: RC-B near-duplicate (containment + ≤10% amount) → near-duplicate', () => {
    const r = classifyIntake({
      kind: 'expense', source: 'TRANSACTION_LINK', declaredFrequency: 'MONTHLY',
      streamPolicy: 'merchant',
      candidate: { name: 'Battery Replacement', amount: 11385 },
      existingRows: [rates, battery],
    });
    expect(r.streamMatch).toEqual({ id: 'e1', confidence: 'near-duplicate' });
  });

  it('no policy / no rows / no candidate → null (create as normal)', () => {
    expect(classifyIntake({ kind: 'expense', source: 'MANUAL', declaredFrequency: 'MONTHLY' }).streamMatch).toBe(null);
    expect(
      classifyIntake({
        kind: 'expense', source: 'TRANSACTION_LINK', declaredFrequency: 'MONTHLY',
        streamPolicy: 'merchant', existingRows: [battery],
      }).streamMatch,
    ).toBe(null);
  });
});
