/**
 * MON-025 — merchant normalisation for expense/income dedup.
 * The QBE case: two bank spellings of one insurer must collapse to one key.
 */
import { describe, it, expect } from 'vitest';
import { normalizeMerchant, sameMerchant } from '../../lib/bank/merchantNormalize';

describe('normalizeMerchant', () => {
  it('collapses the two QBE spellings to the same key', () => {
    const a = 'QBE Insurance (Australia) Limited';
    const b = 'Qbe Insurance (australia) Limited Abn 78 003 191 035';
    expect(normalizeMerchant(a)).toBe('qbe insurance');
    expect(normalizeMerchant(b)).toBe('qbe insurance');
    expect(sameMerchant(a, b)).toBe(true);
  });

  it('strips legal suffixes + noise but keeps the distinguishing name', () => {
    expect(normalizeMerchant('Petcover Broking Pty Ltd')).toBe('petcover broking');
    expect(normalizeMerchant('Hunter Premium')).toBe('hunter premium');
  });

  it('keeps genuinely different merchants distinct', () => {
    expect(sameMerchant('QBE Insurance', 'Allianz Insurance')).toBe(false);
    expect(sameMerchant('Woolworths', 'Coles')).toBe(false);
  });

  it('handles empty / null safely', () => {
    expect(normalizeMerchant(null)).toBe('');
    expect(sameMerchant('', 'x')).toBe(false);
    expect(sameMerchant(null, null)).toBe(false);
  });
});
