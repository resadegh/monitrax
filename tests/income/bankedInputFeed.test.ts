/**
 * MON-140 — THE RATCHET for the input-feed defect class (VR-044).
 *
 * WHAT ESCAPED. T1-B wired every consumer onto the ONE banked-income engine
 * and the whole suite went green — but `masterFinancialService` fed that
 * engine a `select`-narrowed income row that omitted `isRecurring`. The
 * one-off gate is `row.isRecurring === false`; against `undefined` it never
 * fires, so 10 one-off rows annualised ×12 and Home showed $158,401.44/yr of
 * income that was never received, while `moneyFlowService` — fed by
 * `fetchBankedRawData`, which selects everything — returned the correct
 * total. One engine, two feeds, two answers (the MON-028 class).
 *
 * Why nothing caught it: every unit fixture constructs full `BankedIncomeRow`
 * objects by hand, so the engines were always well-fed in tests. The defect
 * lived exclusively in the shape of a Prisma `select` — a place no engine
 * test looks. These are the two guards that close that hole:
 *
 *   Ring 0 — the ENGINE half: prove the divergence is real and is exactly
 *            ×12, so the mechanism is pinned, not just the instance.
 *   Ring 1 — the FEED half: prove the gate-critical fields are in the ONE
 *            shared select AND that no caller hand-rolls its own banked
 *            subset. This is the half that would have failed the merge.
 *
 * Coverage boundary (§22.2.4): this verifies the feed CONTRACT and the
 * engine's response to a starved row. It does NOT verify the rendered values
 * on real data — that is Ring 3 (the Matrix's re-capture).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BANKED_INCOME_SELECT } from '@/lib/income/banked/assembly';
import { buildBankedIncome, bankedTotalsFromResult } from '@/lib/income/banked/aggregator';
import type { BankedIncomeRow } from '@/lib/income/banked/types';
import { TAX_YEAR_2026_27 } from '@/lib/tax-engine/config/taxYearConfig';

const ROOT = resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

const CTX = { config: TAX_YEAR_2026_27, repaymentIncome: null };
const banked = (rows: BankedIncomeRow[]) =>
  bankedTotalsFromResult(
    buildBankedIncome({
      income: rows,
      properties: [],
      derivedAgentExpenses: [],
      transactions: [],
      ctx: CTX,
    }),
  );

// ---------------------------------------------------------------------------
// Ring 0 — the engine half: a starved row diverges by EXACTLY ×12
// ---------------------------------------------------------------------------

describe('MON-140 Ring 0 — a row missing isRecurring annualises a one-off ×12', () => {
  // The VR-044 shape, scaled to one row: a $13,200.12 one-off receipt stored
  // (as the schema default does) with frequency MONTHLY.
  const ONE_OFF = 13_200.12;
  const wellFed: BankedIncomeRow[] = [
    { type: 'OTHER', amount: ONE_OFF, frequency: 'MONTHLY', isTaxable: true, isRecurring: false },
  ];
  // What a `select` that omits the column actually produces: the property is
  // absent, so `row.isRecurring === false` is false and the gate is bypassed.
  const starved = [{ type: 'OTHER', amount: ONE_OFF, frequency: 'MONTHLY', isTaxable: true }] as BankedIncomeRow[];

  it('well-fed: the one-off contributes 0 to the annual run-rate', () => {
    expect(banked(wellFed).monthlyBanked).toBe(0);
  });

  it('starved: the same row annualises — and the gap is EXACTLY the ×12 (VR-044 §3)', () => {
    const gap = banked(starved).monthlyBanked * 12 - banked(wellFed).monthlyBanked * 12;
    expect(gap).toBeCloseTo(ONE_OFF * 12, 2); // 13,200.12 × 12 = 158,401.44
    expect(gap).toBeCloseTo(158_401.44, 2);
  });
});

// ---------------------------------------------------------------------------
// Ring 1 — the feed half: the guard that would have failed the T1-B merge
// ---------------------------------------------------------------------------

describe('MON-140 Ring 1 — the ONE banked input select carries every gate-critical field', () => {
  // Each of these changes a NUMBER when absent, silently:
  //   isRecurring      → one-off gate never fires (the VR-044 defect)
  //   grossAmount      → NET-entered salary degrades to gross ≡ banked
  //   netAmount        → same class on the other branch
  //   paygWithholding  → stored-wedge basis unavailable
  //   actualNetPay     → FACT basis silently downgrades to DERIVED (D33)
  //   salarySacrifice  → the wedge loses its sacrifice component
  //   helpLoanDeclared → a declared study loan reads as undetermined
  //   propertyId       → rental rows detach from their pooled property stream
  //   rentalMode       → MANAGED net credits are not grossed up (Wall B3)
  const GATE_CRITICAL = [
    'isRecurring', 'grossAmount', 'netAmount', 'paygWithholding',
    'actualNetPay', 'salarySacrifice', 'helpLoanDeclared',
    'propertyId', 'rentalMode',
  ] as const;

  it.each(GATE_CRITICAL)('%s is selected', (field) => {
    expect(BANKED_INCOME_SELECT[field as keyof typeof BANKED_INCOME_SELECT]).toBe(true);
  });

  it('every field the engines read off a row is in the select', () => {
    // Derived from the engines themselves, not a hand-list: any `row.<field>`
    // / `r.<field>` access in the banked module must be a selected column.
    const engineSrc = [
      'lib/income/banked/salaryBanked.ts',
      'lib/income/banked/rentalBanked.ts',
      'lib/income/banked/receivedBanked.ts',
      'lib/income/banked/aggregator.ts',
    ].map(read).join('\n');

    const selected = new Set(Object.keys(BANKED_INCOME_SELECT));
    // Column names on the Income model the engines could legitimately read.
    const candidates = [
      'id', 'type', 'name', 'amount', 'frequency', 'isRecurring', 'salaryType',
      'grossAmount', 'netAmount', 'paygWithholding', 'actualNetPay',
      'salarySacrifice', 'helpLoanDeclared', 'isTaxable', 'propertyId',
      'investmentAccountId', 'ownerEntityId', 'rentalMode',
    ];
    const readByEngines = candidates.filter((f) =>
      new RegExp(String.raw`\b(?:row|r|i)\.${f}\b`).test(engineSrc),
    );
    expect(readByEngines.length).toBeGreaterThan(8); // the regex actually matched
    const missing = readByEngines.filter((f) => !selected.has(f));
    expect(missing, `engine reads these but the select omits them: ${missing.join(', ')}`).toEqual([]);
  });
});

describe('MON-140 Ring 1 — no caller hand-rolls its own banked income subset', () => {
  // The source-lock. `masterFinancialService` is the file that regressed;
  // any feed to the banked engines must spread the shared constant so a
  // narrowed select cannot starve the engine again.
  const FEEDS = [
    'lib/services/masterFinancialService.ts',
    'lib/income/banked/assembly.ts',
  ];

  /** Extract each `prisma.income.findMany(...)` call by BALANCED parens — a
   *  non-greedy regex stops at the first `})` inside the select and silently
   *  reports a pass on the very defect this guards (proven: the naive version
   *  passed against the VR-044 code). */
  function incomeFetchCalls(src: string): string[] {
    const out: string[] = [];
    const NEEDLE = 'prisma.income.findMany(';
    for (let i = src.indexOf(NEEDLE); i !== -1; i = src.indexOf(NEEDLE, i + 1)) {
      let depth = 0;
      for (let j = i + NEEDLE.length - 1; j < src.length; j++) {
        if (src[j] === '(') depth++;
        else if (src[j] === ')') {
          depth--;
          if (depth === 0) { out.push(src.slice(i, j + 1)); break; }
        }
      }
    }
    return out;
  }

  it.each(FEEDS)('%s selects income via BANKED_INCOME_SELECT', (file) => {
    const calls = incomeFetchCalls(read(file));
    expect(calls.length).toBeGreaterThan(0); // the extractor actually found the call
    for (const block of calls) {
      if (!/\bselect\s*:/.test(block)) continue; // unrestricted findMany = fully fed
      expect(
        block.includes('BANKED_INCOME_SELECT'),
        `${file}: a select-narrowed income fetch must spread BANKED_INCOME_SELECT (VR-044)`,
      ).toBe(true);
    }
  });

  it('masterFinancialService no longer enumerates the banked columns by hand', () => {
    const src = read('lib/services/masterFinancialService.ts');
    expect(src).toContain('...BANKED_INCOME_SELECT');
  });
});
