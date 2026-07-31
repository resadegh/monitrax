/**
 * MON-053 — one-off income annualised ×12 (the income-side twin of MON-037).
 *
 * Real-data symptom (VR-007): two single ATO deposits, stored as
 * Income{frequency: MONTHLY}, rendered "$9,098/mo — $109,176/yr" and
 * "$952/mo — $11,424/yr" and inflated the declared-gross tax base of
 * $524,831/yr by ~$120,600 of income never received — and it was taxed.
 *
 * Rings here:
 *  - Ring-0: a one-off income counts ONCE on the Float AND Decimal engines.
 *  - Ring-2 (parity): Float === Decimal on the worked example.
 *  - Ring-1 SOURCE-LOCK (the F1 ancestor-killer): every income/expense
 *    annualisation call site inside taxPositionCalculator.ts must carry the
 *    isRecurring===false guard, and the call-site COUNT is locked — a new
 *    unguarded annualisation cannot be added without failing this test.
 *  - Run-rate: the canonical netIncomeCalculator contributes 0/mo for a
 *    one-off (it is not part of the monthly rhythm).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  calculateTaxPosition,
  calculateTaxPositionDecimal,
} from '../../lib/tax-engine/position/taxPositionCalculator';
// MON-131 T1-B: the netIncomeCalculator producer is deleted — the run-rate
// one-off gate is now proven on the ONE banked engine (income-net-run-rate
// contract; the banked engine gates one-offs out of every run-rate).
import { buildBankedIncome, bankedTotalsFromResult } from '../../lib/income/banked/aggregator';
import type { BankedIncomeRow } from '../../lib/income/banked/types';
import { TAX_YEAR_2026_27 } from '../../lib/tax-engine/config/taxYearConfig';

const NO_SUPER = { concessional: 0, nonConcessional: 0 };
const FY = '2025-26';

const atoOneOff = {
  id: 'ato-1',
  name: 'Ato Ato001100022493651',
  type: 'OTHER',
  amount: 9098,
  frequency: 'MONTHLY', // the stored default — the bug mechanism
  isRecurring: false,   // the fix: the receipt is expressible as one-off
};

describe('MON-053 · Ring-0: a one-off income counts ONCE, never ×frequency', () => {
  it('Float engine: $9,098 one-off contributes $9,098 — not $109,176', () => {
    const r = calculateTaxPosition({
      incomes: [atoOneOff],
      expenses: [],
      depreciations: [],
      superContributions: NO_SUPER,
      financialYear: FY,
    });
    expect(r.income.other).toBe(9098);
    expect(r.income.total).toBe(9098);
  });

  it('Float engine: the same row WITHOUT the flag still annualises (back-compat: default = recurring)', () => {
    const r = calculateTaxPosition({
      incomes: [{ ...atoOneOff, isRecurring: undefined }],
      expenses: [],
      depreciations: [],
      superContributions: NO_SUPER,
      financialYear: FY,
    });
    expect(r.income.total).toBe(9098 * 12); // 109,176 — existing rows unchanged
  });

  it('Decimal engine: identical one-off semantics (the §12.2.1 twin that kept MON-037 alive)', () => {
    const r = calculateTaxPositionDecimal({
      incomes: [atoOneOff],
      expenses: [],
      depreciations: [],
      superContributions: NO_SUPER,
      financialYear: FY,
    });
    expect(Number(r.income.other.toString())).toBe(9098);
    expect(Number(r.income.total.toString())).toBe(9098);
  });

  it('Ring-2 parity: Float === Decimal for a mixed one-off + recurring household', () => {
    const input = {
      incomes: [
        atoOneOff,
        { id: 'ato-2', name: 'Ato 2', type: 'OTHER', amount: 952, frequency: 'MONTHLY', isRecurring: false },
        { id: 'rent', name: 'Rent', type: 'RENTAL', amount: 2000, frequency: 'MONTHLY' }, // recurring
      ],
      expenses: [],
      depreciations: [],
      superContributions: NO_SUPER,
      financialYear: FY,
    };
    const f = calculateTaxPosition(input);
    const d = calculateTaxPositionDecimal(input);
    // one-offs once (9,098 + 952) + rent ×12 (24,000) = 34,050
    expect(f.income.total).toBe(9098 + 952 + 24000);
    expect(Number(d.income.total.toString())).toBeCloseTo(f.income.total, 6);
  });
});

describe('MON-053 · run-rate: the banked engine excludes one-offs (T1-B producer)', () => {
  const bankedTotals = (rows: BankedIncomeRow[]) =>
    bankedTotalsFromResult(
      buildBankedIncome({
        income: rows,
        properties: [],
        derivedAgentExpenses: [],
        transactions: [],
        ctx: { config: TAX_YEAR_2026_27, repaymentIncome: null },
      }),
    );

  it('a one-off contributes 0/mo to the banked run-rate (counted once, never ×frequency)', () => {
    const totals = bankedTotals([atoOneOff as BankedIncomeRow]);
    expect(totals.monthlyBanked).toBe(0);
    expect(totals.monthlyGross).toBe(0);
  });
  it('a recurring row is unchanged', () => {
    const totals = bankedTotals([
      { amount: 2000, frequency: 'MONTHLY', type: 'OTHER', isTaxable: true },
    ]);
    expect(totals.monthlyBanked).toBe(2000);
  });
});

describe('MON-053 · Ring-1 SOURCE-LOCK: no unguarded annualisation can exist or be added', () => {
  const src = readFileSync(
    resolve(__dirname, '../../lib/tax-engine/position/taxPositionCalculator.ts'),
    'utf-8',
  );
  const lines = src.split('\n');

  // Call sites of annualize()/annualizeDecimal() — excluding the two function
  // definitions themselves.
  const callSites = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => /annualize(Decimal)?\(/.test(l) && !/^function|^\s*function/.test(l.trim()) && !/function annualize/.test(l));

  it('exactly 4 annualisation call sites exist (income+expense × Float+Decimal) — adding a 5th requires guarding it here', () => {
    expect(callSites.length).toBe(4);
  });

  it('EVERY call site sits under an isRecurring === false guard (the F1 ancestor-killer)', () => {
    for (const { i } of callSites) {
      const windowBefore = lines.slice(Math.max(0, i - 6), i).join('\n');
      expect(
        /isRecurring === false/.test(windowBefore),
        `annualisation at taxPositionCalculator.ts:${i + 1} lacks the one-off guard within 6 lines above`,
      ).toBe(true);
    }
  });
});
