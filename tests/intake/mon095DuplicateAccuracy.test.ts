/**
 * MON-095 — duplicate-matcher accuracy: the AIA false-positive class
 * (Reza live review, 2026-07-23).
 *
 * Root cause: `normalizeMerchant` strips 5+ digit runs, so a policy number
 * is discarded before names compare — "Aia Australia . 68718123 /26" and
 * "Aia Australia . 68718100 /26" both normalise to "aia" — and the exact
 * path had NO amount check, so two DIFFERENT policies ($131 vs $158, 20%
 * apart) grouped as exact duplicates. Merging would delete a real policy.
 * Systemic: the same path is the intake guardrail (#1458), so a NEW
 * distinct policy could be silently auto-absorbed at import for any user.
 *
 * The fix (ONE decision layer — classifyIntake, read by both the intake
 * guardrail and the Housekeeping duplicates preview):
 *  - expense exact/near convergence requires the ONE ≤10% amount band
 *    (DUPLICATE_AMOUNT_TOLERANCE — never a second threshold), AND
 *  - the identifier fail-safe: disjoint policy/account tokens → distinct.
 *  - INCOME doctrine untouched: declared↔reconciled amount drift still
 *    converges (Mechanism A, ring2.mechanismA.intakeDedup locks it).
 */
import { describe, it, expect } from 'vitest';
import {
  extractIdentifierTokens,
  hasDisjointIdentifiers,
} from '../../lib/bank/merchantNormalize';
import { classifyIntake } from '../../lib/intake/classifyIntake';
import { findDuplicateGroups, type MergeableRow } from '../../lib/intake/duplicateMerge';

const AIA_1: MergeableRow = {
  id: 'aia-1', name: 'Aia Australia . 68718123 /26', type: 'INSURANCE',
  amount: 131, frequency: 'MONTHLY', isRecurring: true, ownerEntityId: 'own-1',
  propertyId: null, loanId: null, assetId: null, investmentAccountId: null,
  createdAt: new Date('2026-05-01'),
} as unknown as MergeableRow;
const AIA_2: MergeableRow = {
  ...AIA_1, id: 'aia-2', name: 'Aia Australia . 68718100 /26', amount: 158,
  createdAt: new Date('2026-06-01'),
} as unknown as MergeableRow;
const QBE_1: MergeableRow = {
  ...AIA_1, id: 'qbe-1', name: 'QBE Insurance (Australia) Limited', amount: 216,
} as unknown as MergeableRow;
const QBE_2: MergeableRow = {
  ...AIA_1, id: 'qbe-2', name: 'Qbe Insurance (australia) Limited Abn 78 003 191 035',
  amount: 216, createdAt: new Date('2026-06-01'),
} as unknown as MergeableRow;

describe('MON-095 · identifier tokens (the ONE extractor)', () => {
  it('extracts policy numbers, excludes ABN/ACN and short runs', () => {
    expect(extractIdentifierTokens('Aia Australia . 68718123 /26')).toEqual(['68718123']);
    expect(extractIdentifierTokens('Qbe Insurance Abn 78 003 191 035')).toEqual([]);
    expect(extractIdentifierTokens('Mate Communicate')).toEqual([]);
  });

  it('disjoint identifiers = two different policies; shared/absent = no veto', () => {
    expect(hasDisjointIdentifiers('Aia . 68718123', 'Aia . 68718100')).toBe(true);
    expect(hasDisjointIdentifiers('Aia . 68718123', 'Aia . 68718123 /26')).toBe(false);
    expect(hasDisjointIdentifiers('Aia . 68718123', 'Aia Australia')).toBe(false);
  });
});

describe('MON-095 · the AIA reproduction (fails on pre-fix code)', () => {
  it('two DIFFERENT AIA policies (different numbers, 20% apart) do NOT group', () => {
    const groups = findDuplicateGroups('expense', [AIA_1, AIA_2]);
    expect(groups).toHaveLength(0);
  });

  it('two same-provider rows with the SAME amount but DIFFERENT identifiers do NOT group (fail-safe)', () => {
    const b = { ...AIA_2, amount: 131 } as unknown as MergeableRow;
    expect(findDuplicateGroups('expense', [AIA_1, b])).toHaveLength(0);
  });

  it('genuine duplicates still group: QBE $216/$216 (ABN is not an identifier)', () => {
    const groups = findDuplicateGroups('expense', [QBE_1, QBE_2]);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(2);
  });

  it('genuine duplicates still group: identical name + amount (Mate $150/$150)', () => {
    const m1 = { ...AIA_1, id: 'mate-1', name: 'Mate Communicate', amount: 150 } as unknown as MergeableRow;
    const m2 = { ...m1, id: 'mate-2', createdAt: new Date('2026-06-01') } as unknown as MergeableRow;
    expect(findDuplicateGroups('expense', [m1, m2])).toHaveLength(1);
  });
});

describe('MON-095 · the intake guardrail fails safe (same decision layer)', () => {
  it('a NEW expense with a differing policy identifier is NOT auto-absorbed at link time', () => {
    const r = classifyIntake({
      kind: 'expense',
      source: 'TRANSACTION_LINK',
      declaredFrequency: 'MONTHLY',
      streamPolicy: 'source-signature',
      candidate: { name: 'Aia Australia . 68718100 /26', amount: 131, scopeKey: null },
      existingRows: [{ id: 'aia-1', name: 'Aia Australia . 68718123 /26', amount: 131, scopeKey: null }],
    });
    expect(r.streamMatch).toBeNull();
  });

  it('a same-name expense outside the ≤10% band is NOT absorbed', () => {
    const r = classifyIntake({
      kind: 'expense',
      source: 'TRANSACTION_LINK',
      declaredFrequency: 'MONTHLY',
      streamPolicy: 'source-signature',
      candidate: { name: 'Aia Australia', amount: 158, scopeKey: null },
      existingRows: [{ id: 'aia-1', name: 'Aia Australia', amount: 131, scopeKey: null }],
    });
    expect(r.streamMatch).toBeNull();
  });

  it('INCOME doctrine untouched: declared↔reconciled amount drift still converges (Mechanism A)', () => {
    const r = classifyIntake({
      kind: 'income',
      source: 'TRANSACTION_LINK',
      declaredFrequency: 'MONTHLY',
      streamPolicy: 'source-signature',
      // Names normalise equal ("ingeus"); amounts drift 21% — the declared
      // row vs its reconciled twin. Income MUST still converge (the
      // Mechanism A doctrine an expense guard must never break).
      candidate: { name: 'Ingeus Pty Ltd', amount: 4100, scopeKey: null },
      existingRows: [{ id: 'inc-1', name: 'Ingeus Limited', amount: 5200, scopeKey: null }],
    });
    expect(r.streamMatch).toEqual({ id: 'inc-1', confidence: 'exact' });
  });
});
