/**
 * Phase 52 — PII scrubber tests (the de-identification gate). Privacy-critical:
 * a *merchant* may enter the shared KB; a *person* never does. These pins lock
 * the reject rules (transfers / names / account numbers) + the strip rules.
 */

import { describe, it, expect } from 'vitest';
import { scrubToSignature } from '@/lib/categorisation/kb/scrubSignature';

function pattern(raw: string): string | null {
  const r = scrubToSignature(raw);
  return r.ok ? r.pattern : null;
}

describe('scrubToSignature — accepts merchants (de-identified)', () => {
  it('strips store numbers + location digits', () => {
    expect(pattern('WOOLWORTHS 1234 SYDNEY')).toBe('WOOLWORTHS SYDNEY');
  });
  it('strips payment-method noise (EFTPOS / card)', () => {
    expect(pattern('EFTPOS BUNNINGS WAREHOUSE')).toBe('BUNNINGS WAREHOUSE');
    expect(pattern('VISA PURCHASE BP CONNECT')).toBe('BP CONNECT');
  });
  it('strips dates and reference tails', () => {
    expect(pattern('TELSTRA 05/06/2026 REF: 99812')).toBe('TELSTRA');
  });
  it('keeps a clean merchant unchanged (uppercased)', () => {
    expect(pattern('Netflix')).toBe('NETFLIX');
  });
  it('strips card masks', () => {
    expect(pattern('AMAZON xxxx4521')).toBe('AMAZON');
  });
});

describe('scrubToSignature — REJECTS person/transfer/non-merchant', () => {
  it('rejects person-to-person transfers (names live here)', () => {
    expect(pattern('TFR TO JOHN SMITH')).toBeNull();
    expect(pattern('Transfer to Jane Doe')).toBeNull();
    expect(pattern('INTERNAL TRANSFER 12345678')).toBeNull();
  });
  it('rejects PayID / Osko / NPP', () => {
    expect(pattern('PAYID PAYMENT FROM SARAH')).toBeNull();
    expect(pattern('OSKO WITHDRAWAL')).toBeNull();
  });
  it('rejects ATM / cash withdrawals', () => {
    expect(pattern('ATM CASH WITHDRAWAL')).toBeNull();
    expect(pattern('CASH OUT')).toBeNull();
  });
  it('rejects empty / too short / numbers-only', () => {
    expect(pattern('')).toBeNull();
    expect(pattern('  ')).toBeNull();
    expect(pattern('12345678')).toBeNull();
  });
  it('rejects when nothing but stripped noise remains', () => {
    expect(pattern('EFTPOS 0042 1234')).toBeNull();
  });
});

describe('scrubToSignature — determinism (same merchant → same signature)', () => {
  it('two variants of the same merchant collapse to one pattern', () => {
    expect(pattern('WOOLWORTHS 1234 SYDNEY')).toBe(pattern('WOOLWORTHS 9981 SYDNEY'));
  });
});
