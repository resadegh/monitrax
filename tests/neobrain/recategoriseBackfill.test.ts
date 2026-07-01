/**
 * Phase 54.2d — re-categorise backfill tests.
 *
 * The §12.11-critical write-policy (`planBackfillWrite`) + the deterministic-only
 * cascade option (`skipAiOnMiss`). The backfill must NEVER fill a category from
 * an AI/FALLBACK source, only from a deterministic (RULE/USER/KB) high-confidence
 * match — and must clean the merchant name only when re-normalisation changed it.
 */

import { describe, it, expect } from 'vitest';
import { planBackfillWrite, planAiSuggestionWrite } from '@/lib/bank/recategoriseExisting';
import { categoriseTransaction } from '@/lib/tie/categorisation';
import type { UnifiedTransaction } from '@/lib/tie/types';

const R = (source: string, confidence: number) => ({
  source,
  confidence,
  categoryLevel1: 'Food & Dining',
  categoryLevel2: 'Fast Food',
  subcategory: null,
});

describe('planBackfillWrite — the §12.11 write policy', () => {
  it('fills the category from a RULE match at/above threshold', () => {
    const p = planBackfillWrite('Old Name', 'Hungry Jacks', R('RULE', 0.9));
    expect(p.recategorised).toBe(true);
    expect(p.data.categoryLevel1).toBe('Food & Dining');
    expect(p.data.merchantStandardised).toBe('Hungry Jacks');
    expect(p.renamed).toBe(true);
  });
  it('fills from USER and KB matches too', () => {
    expect(planBackfillWrite('x', 'x', R('USER', 1.0)).recategorised).toBe(true);
    expect(planBackfillWrite('x', 'x', R('KB', 0.95)).recategorised).toBe(true);
  });
  it('NEVER fills from an AI source (AI never auto-files, §54.2)', () => {
    const p = planBackfillWrite('x', 'x', R('AI', 0.99));
    expect(p.recategorised).toBe(false);
    expect(p.data.categoryLevel1).toBeUndefined();
  });
  it('NEVER fills from a FALLBACK source', () => {
    expect(planBackfillWrite('x', 'x', R('FALLBACK', 0.1)).recategorised).toBe(false);
  });
  it('does NOT fill a deterministic match below the threshold', () => {
    expect(planBackfillWrite('x', 'x', R('RULE', 0.7)).recategorised).toBe(false);
  });
  it('renames only when re-normalisation actually changed the name', () => {
    expect(planBackfillWrite('Hungry Jacks', 'Hungry Jacks', R('RULE', 0.9)).renamed).toBe(false);
    expect(planBackfillWrite('Old', 'New', R('FALLBACK', 0.1)).renamed).toBe(true);
  });
  it('never writes an "Unknown" name', () => {
    const p = planBackfillWrite('Old', 'Unknown', R('FALLBACK', 0.1));
    expect(p.renamed).toBe(false);
    expect(p.data.merchantStandardised).toBeUndefined();
  });
});

describe('planAiSuggestionWrite — the §54.2 AI-suggestion policy (opt-in tail)', () => {
  const AI = (over: Partial<Parameters<typeof planAiSuggestionWrite>[1]> = {}) => ({
    categoryLevel1: 'Food & Dining',
    categoryLevel2: 'Fast Food',
    subcategory: null,
    confidence: 0.82,
    merchantGuess: null,
    ...over,
  });

  it('writes the AI category as a SUGGESTION with confidence', () => {
    const p = planAiSuggestionWrite('16 49hjs North Parramatta', AI());
    expect(p.suggested).toBe(true);
    expect(p.data.categoryLevel1).toBe('Food & Dining');
    expect(p.data.confidenceScore).toBe(0.82);
  });

  it('NEVER sets userCorrectedCategory — the row stays in review (§54.2, never auto-files)', () => {
    const p = planAiSuggestionWrite('x', AI({ confidence: 0.99 }));
    expect(p.data.userCorrectedCategory).toBeUndefined();
  });

  it('cleans the display name when a grounded pass named the merchant', () => {
    const p = planAiSuggestionWrite('16 49hjs North Parramatta', AI({ merchantGuess: 'Hungry Jacks' }));
    expect(p.data.merchantStandardised).toBe('Hungry Jacks');
  });

  it('does NOT rewrite the name when the guess equals the current name', () => {
    const p = planAiSuggestionWrite('Hungry Jacks', AI({ merchantGuess: 'Hungry Jacks' }));
    expect(p.data.merchantStandardised).toBeUndefined();
  });

  it('writes nothing when the AI produced no usable category (null / no level1)', () => {
    expect(planAiSuggestionWrite('x', null).suggested).toBe(false);
    expect(planAiSuggestionWrite('x', AI({ categoryLevel1: '' })).suggested).toBe(false);
    expect(Object.keys(planAiSuggestionWrite('x', null).data)).toHaveLength(0);
  });
});

describe('categoriseTransaction — skipAiOnMiss (deterministic-only)', () => {
  const tx = (merchant: string): UnifiedTransaction =>
    ({
      id: 't1',
      userId: 'u1',
      accountId: 'a1',
      date: new Date('2026-07-01T00:00:00Z'),
      amount: 6,
      currency: 'AUD',
      direction: 'OUT',
      description: merchant,
      merchantStandardised: merchant,
      merchantRaw: merchant,
      tags: [],
      userCorrectedCategory: false,
      isRecurring: false,
      anomalyFlags: [],
      source: 'CSV',
      createdAt: new Date('2026-07-01T00:00:00Z'),
      updatedAt: new Date('2026-07-01T00:00:00Z'),
    }) as UnifiedTransaction;

  it('still resolves a known merchant via the RULES layer', async () => {
    const r = await categoriseTransaction(tx('Hungry Jacks'), { skipAiOnMiss: true });
    expect(r.source).toBe('RULE');
    expect(r.categoryLevel1).toBe('Food & Dining');
  });
  it('an unknown merchant falls back to Uncategorised (no LLM called)', async () => {
    const r = await categoriseTransaction(tx('Zzq Obscure Merchant 999'), { skipAiOnMiss: true });
    expect(r.source).toBe('FALLBACK');
    expect(r.categoryLevel2).toBe('Uncategorised');
  });
});
