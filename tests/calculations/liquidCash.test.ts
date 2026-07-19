/**
 * MON-031/064 — `computeLiquidCash`, THE canonical deployable-liquid producer
 * (§19.2 worked examples; VR-017 re-fix).
 *
 * Revolving credit has two representations — CREDIT_CARD loans and
 * negative-balance CREDIT_CARD accounts — and BOTH must net from the
 * spendable-cash gross. The live VR-017 shape (account-typed card) is the
 * type-specimen worked example.
 */
import { describe, it, expect } from 'vitest';
import { computeLiquidCash, computeLiquidCashDecimal } from '../../lib/calculations/liquidCash';
import { Decimal } from '../../lib/decimal';

describe('MON-031/064: computeLiquidCash — one deployable-liquid formula', () => {
  it('the LIVE VR-017 shape: account-typed card nets (304,304 − 2,496 = 301,808)', () => {
    const r = computeLiquidCash(
      [
        { type: 'TRANSACTIONAL', currentBalance: 4_304 },
        { type: 'OFFSET', currentBalance: 300_000 },
        { type: 'CREDIT_CARD', currentBalance: -2_496 }, // the Qantas card
      ],
      0, // no CREDIT_CARD loans — liabilities.creditCards is 0 on this topology
    );
    expect(r.gross).toBe(304_304);
    expect(r.accountCardDebt).toBe(2_496);
    expect(r.revolvingCredit).toBe(2_496);
    expect(r.net).toBe(301_808);
    // The VR-017 months identity: 301,808 ÷ 25,973 burn = 11.6 (1dp), not 11.7.
    expect(Math.round((r.net / 25_973) * 10) / 10).toBe(11.6);
  });

  it('loan-typed card nets via the caller-passed loan total (the golden topology)', () => {
    const r = computeLiquidCash(
      [
        { type: 'TRANSACTIONAL', currentBalance: 8_000 },
        { type: 'SAVINGS', currentBalance: 42_000 },
      ],
      2_496, // netWorth.liabilities.creditCards (a CREDIT_CARD loan)
    );
    expect(r.gross).toBe(50_000);
    expect(r.accountCardDebt).toBe(0);
    expect(r.revolvingCredit).toBe(2_496);
    expect(r.net).toBe(47_504);
  });

  it('mixed representations: both net, no double-count', () => {
    const r = computeLiquidCash(
      [
        { type: 'SAVINGS', currentBalance: 20_000 },
        { type: 'CREDIT_CARD', currentBalance: -1_000 },
      ],
      3_000,
    );
    expect(r.revolvingCredit).toBe(4_000);
    expect(r.net).toBe(16_000);
  });

  it('an overpaid (positive-balance) card contributes zero revolving credit and zero gross', () => {
    const r = computeLiquidCash(
      [
        { type: 'SAVINGS', currentBalance: 10_000 },
        { type: 'CREDIT_CARD', currentBalance: 250 }, // credit balance on the card
      ],
      0,
    );
    expect(r.gross).toBe(10_000); // CREDIT_CARD is not a LIQUID_ACCOUNT_TYPE
    expect(r.accountCardDebt).toBe(0);
    expect(r.net).toBe(10_000);
  });

  it('non-liquid types (term-deposit-style) are excluded from gross', () => {
    const r = computeLiquidCash(
      [
        { type: 'SAVINGS', currentBalance: 30_000 },
        { type: 'TERM_DEPOSIT', currentBalance: 50_000 },
      ],
      0,
    );
    expect(r.gross).toBe(30_000);
    expect(r.net).toBe(30_000);
  });

  it('empty inputs → all zeros; a negative loan total is clamped to 0', () => {
    expect(computeLiquidCash([], 0)).toEqual({
      gross: 0,
      accountCardDebt: 0,
      revolvingCredit: 0,
      net: 0,
    });
    expect(computeLiquidCash([{ type: 'SAVINGS', currentBalance: 100 }], -50).net).toBe(100);
  });

  it('Decimal sibling matches the Float path on the VR-017 shape (shadow parity)', () => {
    const accounts = [
      { type: 'TRANSACTIONAL', currentBalance: 4_304 },
      { type: 'OFFSET', currentBalance: 300_000 },
      { type: 'CREDIT_CARD', currentBalance: -2_496 },
    ];
    const f = computeLiquidCash(accounts, 0);
    const d = computeLiquidCashDecimal(accounts, new Decimal(0));
    expect(d.gross.toNumber()).toBe(f.gross);
    expect(d.accountCardDebt.toNumber()).toBe(f.accountCardDebt);
    expect(d.revolvingCredit.toNumber()).toBe(f.revolvingCredit);
    expect(d.net.toNumber()).toBe(f.net);
  });
});
