/**
 * MON-031 (Reza decision 2026-07-12, option a) — the Balances "Liquid today"
 * figure is liquid cash NET of credit cards, so it reads ~$2.5k below My Safety
 * Net's gross "Liquid savings". This is not a discrepancy — they are two
 * distinct measures. The fix makes that legible in the tile's micro-copy.
 *
 * Source-lock (the copy helper is module-private): assert the cards-aware
 * micro branch exists and that the real card balance is threaded into it, so a
 * future edit can't silently drop the clarification and re-open the confusion.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const src = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'components/balances/HiddenWealthLens.tsx'),
  'utf8',
);

describe('MON-031: Balances "Liquid today" declares it is net of credit cards', () => {
  it('the liquid micro-copy has a cards-aware branch', () => {
    expect(src).toContain('after your credit cards');
    expect(src).toContain('creditCards > 0');
  });

  it('the real card balance is threaded into the micro (not hardcoded)', () => {
    expect(src).toContain("getMicro('liquid', liquidPct, breakdown?.creditCards ?? 0)");
  });
});
