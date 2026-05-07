/**
 * Phase 42 PR2 — QIF split extraction parity test.
 *
 * The QIF parser already extracted `S`/`$` split fields into
 * QIFTransaction.splits. PR2 propagates them onto RawTransaction.splits
 * so the import path can persist them as TransactionSplit rows.
 *
 * This test pins the parser-side contract: a real QIF fragment with
 * splits parses into the expected RawTransaction shape with the
 * `splits` array populated.
 */

import { describe, it, expect } from 'vitest';
import { parseQIF } from '../../lib/bank/parsers/qif';

const QIF_WITH_SPLITS = `!Type:Bank
D18/12/25
T-300.00
PBUNNINGS
MOffice + personal supplies
S[Investment Property]/Repairs
$-200.00
SHousehold/Tools
$-100.00
^
D19/12/25
T-50.00
PCOLES
LGroceries
^`;

describe('QIF split parser', () => {
  it('extracts splits from S/$ fields onto RawTransaction.splits', () => {
    const result = parseQIF(QIF_WITH_SPLITS);
    expect(result.format).toBe('QIF');
    expect(result.transactions).toHaveLength(2);

    const bunnings = result.transactions[0];
    expect(bunnings.splits).toBeDefined();
    expect(bunnings.splits).toHaveLength(2);
    expect(bunnings.splits?.[0].amount).toBe(-200);
    expect(bunnings.splits?.[0].category).toBe('[Investment Property]/Repairs');
    expect(bunnings.splits?.[1].amount).toBe(-100);
    expect(bunnings.splits?.[1].category).toBe('Household/Tools');
  });

  it('does NOT add splits when none are present in the source row', () => {
    const result = parseQIF(QIF_WITH_SPLITS);
    const coles = result.transactions[1];
    expect(coles.splits).toBeUndefined();
  });

  it('split sum equals the parent transaction amount (engagement guarantee)', () => {
    const result = parseQIF(QIF_WITH_SPLITS);
    const bunnings = result.transactions[0];
    const splitSum = (bunnings.splits ?? []).reduce((s, x) => s + x.amount, 0);
    // Parent amount on a QIF is signed (-$300); the parser stores the
    // absolute value on RawTransaction.amount + a separate direction
    // string. The sum-validation contract pertains to the original
    // signed amount.
    expect(splitSum).toBe(-300);
  });
});
