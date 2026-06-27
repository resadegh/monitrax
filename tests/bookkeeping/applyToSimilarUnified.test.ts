import { describe, it, expect } from 'vitest';
import {
  buildSimilarUncategorisedWhere,
  getLearnedCategorySuggestions,
} from '@/lib/bookkeeping/applyToSimilarUnified';

/**
 * Neobrain auto-apply guardrails (2026-06-27). The where-builder is the
 * safety contract: when the user categorises a transaction, Neobrain sweeps
 * OTHER rows — and a wrong sweep would silently corrupt the books. These tests
 * pin each guardrail so a regression can't loosen them.
 */
describe('buildSimilarUncategorisedWhere — Neobrain sweep guardrails', () => {
  const base = {
    userId: 'user-1',
    sourceTransactionId: 'tx-source',
    merchantStandardised: 'ANTHROPIC',
    direction: 'OUT' as const,
  };

  it('returns null when there is no merchant to match on (no sweep)', () => {
    expect(buildSimilarUncategorisedWhere({ ...base, merchantStandardised: null })).toBeNull();
    expect(buildSimilarUncategorisedWhere({ ...base, merchantStandardised: undefined })).toBeNull();
  });

  it('Guardrail 1 — matches the EXACT standardised merchant (never fuzzy)', () => {
    const w = buildSimilarUncategorisedWhere(base)!;
    // exact string equality — Prisma treats a bare string as `equals`, not contains
    expect(w.merchantStandardised).toBe('ANTHROPIC');
  });

  it('Guardrail 2 — constrains to the SAME direction', () => {
    expect(buildSimilarUncategorisedWhere({ ...base, direction: 'OUT' })!.direction).toBe('OUT');
    expect(buildSimilarUncategorisedWhere({ ...base, direction: 'IN' })!.direction).toBe('IN');
  });

  it('Guardrail 3 — only still-uncategorised, unlinked, non-transfer/investment rows', () => {
    const w = buildSimilarUncategorisedWhere(base)!;
    expect(w.OR).toEqual([{ categoryLevel1: null }, { categoryLevel1: '' }]);
    expect(w.expenseId).toBeNull();
    expect(w.incomeId).toBeNull();
    expect(w.loanId).toBeNull();
    expect(w.isTransfer).toBe(false);
    expect(w.isInvestmentContribution).toBe(false);
  });

  it('Guardrail 4 — scopes to the user and excludes the source row', () => {
    const w = buildSimilarUncategorisedWhere(base)!;
    expect(w.userId).toBe('user-1');
    expect(w.id).toEqual({ notIn: ['tx-source'] });
  });

  it('excludes already-handled batch ids and de-dups them', () => {
    const w = buildSimilarUncategorisedWhere({
      ...base,
      excludeIds: ['tx-a', 'tx-b', 'tx-source'],
    })!;
    expect(w.id).toEqual({ notIn: ['tx-source', 'tx-a', 'tx-b'] });
  });
});

describe('getLearnedCategorySuggestions — empty-merchant short-circuit', () => {
  it('returns an empty map without querying when no usable merchants are given', async () => {
    const out = await getLearnedCategorySuggestions('user-1', [null, undefined, '', '  ']);
    expect(out.size).toBe(0);
  });
});
