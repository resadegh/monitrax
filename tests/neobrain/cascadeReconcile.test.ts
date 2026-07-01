/**
 * Phase 54.2 — AI-categoriser reconciliation (import onto the KB cascade).
 *
 * Pins the two safety-critical pure pieces:
 *   1. classifyByConfidence — AI-sourced results NEVER auto-file (always land in
 *      review for the user to confirm); deterministic sources still auto-file.
 *   2. cascadeResultToAIResult / mapNormalisedToUnified — the adapter that lets
 *      the cascade feed the existing import consumers unchanged.
 *
 * §19.2 worked examples: an AI proposal at 0.97 must be demoted to needsReview,
 * while a RULE match at 0.97 auto-files — otherwise an AI guess reaches the
 * ledger without a human confirm (echo-chamber breach + wrong-number risk).
 */

import { describe, it, expect } from 'vitest';

import {
  classifyByConfidence,
  cascadeResultToAIResult,
  mapNormalisedToUnified,
  type AICategorizationResult,
} from '@/lib/bank/aiCategorisation';
import type { NormalisedTransaction } from '@/lib/bank/types';
import type { CategorisationResult } from '@/lib/tie/types';

const SETTINGS = { autoAcceptThreshold: 0.9, showForReviewThreshold: 0.7, enableAI: true, batchSize: 20 };

function tx(overrides: Partial<NormalisedTransaction> = {}): NormalisedTransaction {
  return {
    id: 'tx-1',
    date: new Date('2026-07-01T00:00:00Z'),
    description: 'SOMESHOP SYDNEY',
    rawDescription: 'SOMESHOP SYDNEY',
    amount: 42,
    direction: 'OUT',
    sourceFileId: 'file-1',
    hash: 'h1',
    merchantRaw: 'SOMESHOP SYDNEY',
    merchantStandardised: 'Someshop Sydney',
    ...overrides,
  };
}

function result(source: AICategorizationResult['source'], conf: number): AICategorizationResult {
  return {
    transaction: tx(),
    prediction: {
      categoryLevel1: 'Shopping',
      categoryLevel2: null,
      subcategory: null,
      direction: 'EXPENSE',
      isEssential: false,
      isRecurring: false,
      suggestedFrequency: null,
      confidence: conf,
      reasoning: 'x',
    },
    adjustedConfidence: conf,
    source,
    boostReasons: [],
    penaltyReasons: [],
  };
}

describe('classifyByConfidence — AI never auto-files (Phase 54.2)', () => {
  it('AI proposal at 0.97 is demoted to needsReview, NOT autoAccept', () => {
    const c = classifyByConfidence([result('AI', 0.97)], SETTINGS);
    expect(c.autoAccept).toHaveLength(0);
    expect(c.needsReview).toHaveLength(1);
    expect(c.requiresManual).toHaveLength(0);
  });
  it('a RULE match at 0.97 DOES auto-file (deterministic source)', () => {
    const c = classifyByConfidence([result('RULE', 0.97)], SETTINGS);
    expect(c.autoAccept).toHaveLength(1);
  });
  it('USER and KB matches above threshold auto-file', () => {
    const c = classifyByConfidence([result('USER', 0.95), result('KB', 0.92)], SETTINGS);
    expect(c.autoAccept).toHaveLength(2);
  });
  it('AI in the 0.70–0.90 band lands in needsReview (as any source would)', () => {
    const c = classifyByConfidence([result('AI', 0.8)], SETTINGS);
    expect(c.needsReview).toHaveLength(1);
    expect(c.autoAccept).toHaveLength(0);
  });
  it('anything below showForReview is requiresManual, regardless of source', () => {
    const c = classifyByConfidence([result('AI', 0.4), result('RULE', 0.4)], SETTINGS);
    expect(c.requiresManual).toHaveLength(2);
    expect(c.autoAccept).toHaveLength(0);
  });
  it('legacy result with no source still auto-files above threshold (back-compat)', () => {
    const legacy = { ...result('RULE', 0.95), source: undefined };
    const c = classifyByConfidence([legacy], SETTINGS);
    expect(c.autoAccept).toHaveLength(1);
  });
});

describe('cascadeResultToAIResult — adapter', () => {
  it('maps category + confidence + source, defaults isEssential/isRecurring false', () => {
    const cr: CategorisationResult = {
      categoryLevel1: 'Food & Dining',
      categoryLevel2: 'Fast Food',
      subcategory: null,
      confidence: 0.82,
      source: 'AI',
    };
    const out = cascadeResultToAIResult(tx({ direction: 'OUT' }), cr);
    expect(out.prediction.categoryLevel1).toBe('Food & Dining');
    expect(out.prediction.categoryLevel2).toBe('Fast Food');
    expect(out.adjustedConfidence).toBe(0.82);
    expect(out.source).toBe('AI');
    expect(out.prediction.isEssential).toBe(false);
    expect(out.prediction.isRecurring).toBe(false);
    expect(out.prediction.direction).toBe('EXPENSE');
  });
  it('derives INCOME direction for an IN transaction', () => {
    const out = cascadeResultToAIResult(
      tx({ direction: 'IN' }),
      { categoryLevel1: 'Income', categoryLevel2: null, subcategory: null, confidence: 0.9, source: 'RULE' }
    );
    expect(out.prediction.direction).toBe('INCOME');
  });
  it('an undefined cascade result falls back to Uncategorised (never drops the row)', () => {
    const out = cascadeResultToAIResult(tx(), undefined);
    expect(out.prediction.categoryLevel1).toBe('Other');
    expect(out.prediction.categoryLevel2).toBe('Uncategorised');
    expect(out.source).toBe('FALLBACK');
    expect(out.adjustedConfidence).toBeLessThan(0.7); // → requiresManual
  });
});

describe('mapNormalisedToUnified — adapter input', () => {
  it('injects userId and preserves id / direction / merchant identity', () => {
    const u = mapNormalisedToUnified(tx({ id: 'abc', direction: 'OUT' }), 'user-9');
    expect(u.id).toBe('abc');
    expect(u.userId).toBe('user-9');
    expect(u.direction).toBe('OUT');
    expect(u.merchantStandardised).toBe('Someshop Sydney');
    expect(u.currency).toBe('AUD');
  });
});
