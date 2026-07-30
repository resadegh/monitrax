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

import { describe, it, expect, vi } from 'vitest';

// MON-135: mock ONLY the DB-backed learning fetchers so categoriseWithLearning
// can run its REAL pipeline (transfer detection → cascade → recurring-pattern
// overlay) without a database. Everything else stays the real module.
vi.mock('@/lib/bank/aiLearning', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/bank/aiLearning')>();
  return {
    ...real,
    getMerchantLearnings: vi.fn(async () => new Map()),
    getRecurringPatterns: vi.fn(async () => [
      { merchant: 'Netflix Australia', amount: 22.99, frequency: 'MONTHLY' },
    ]),
  };
});

import {
  classifyByConfidence,
  cascadeResultToAIResult,
  mapNormalisedToUnified,
  categoriseWithLearning,
  type AICategorizationResult,
} from '@/lib/bank/aiCategorisation';
import { categoriseTransactionBatch } from '@/lib/tie/categorisation';
import type { NormalisedTransaction } from '@/lib/bank/types';
import type { CategorisationResult, UnifiedTransaction } from '@/lib/tie/types';

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
  it('maps category + confidence + source; isEssential false; isRecurring NULL (MON-135)', () => {
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
    // MON-135: no recurrence determination → null, NEVER false (a false here
    // becomes a one-off assertion the T3 gate zeroes).
    expect(out.prediction.isRecurring).toBeNull();
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

// =============================================================================
// MON-135 — the categoriser NEVER emits isRecurring:false (the T3 precondition)
// =============================================================================
//
// §19.2 grounding: `false` is an assertion the row is a ONE-OFF. The canonical
// one-off gate (lib/utils/frequencies.ts monthlyRunRate, strictly `=== false`)
// zeroes such a row's contribution to every migrated run-rate. The categoriser
// never attempts a recurrence judgement on these paths, so its output must be
// null (no determination) — the moment T3 lands, a default `false` here would
// silently remove every AI-categorised recurring cost from every run-rate at
// once, and the golden baseline would absorb it as an expected downward move
// (brief §2). These assertions run on the REAL prediction paths, not mocks.
describe('MON-135 — prediction paths never assert one-off', () => {
  it('cascade adapter emits null for every source, including FALLBACK', () => {
    const sources: CategorisationResult['source'][] = ['RULE', 'KB', 'AI', 'USER', 'FALLBACK'];
    for (const source of sources) {
      const out = cascadeResultToAIResult(tx(), {
        categoryLevel1: 'Shopping',
        categoryLevel2: null,
        subcategory: null,
        confidence: 0.8,
        source,
      });
      expect(out.prediction.isRecurring).toBeNull();
    }
    // undefined result (fallback synthesis inside the adapter)
    expect(cascadeResultToAIResult(tx(), undefined).prediction.isRecurring).toBeNull();
  });

  it('the whole-batch cascade path (real categoriseTransactionBatch, known + unknown merchants) emits no false', async () => {
    const { categoriseUnknownsViaCascade } = await import('@/lib/bank/aiCategorisation');
    const { results } = await categoriseUnknownsViaCascade('user-1', [
      tx({ id: 'known', description: 'Hungry Jacks', merchantStandardised: 'Hungry Jacks' }),
      tx({ id: 'unknown', description: 'Zzq Obscure Merchant 999', merchantStandardised: 'Zzq Obscure Merchant 999' }),
    ]);
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.prediction.isRecurring).not.toBe(false);
      expect(r.prediction.isRecurring).toBeNull();
    }
  });

  it('§3.2 — recurrence IS determined where the learned evidence exists (pattern merchant + similar amount → true + cadence)', async () => {
    const { results } = await categoriseWithLearning('user-1', [
      // matches the mocked pattern (same merchant, amount within the ONE ≤10% tolerance)
      tx({ id: 'match', description: 'NETFLIX', merchantStandardised: 'Netflix Australia', amount: 22.99 }),
      // same merchant, wildly different amount → NOT similar → stays undetermined
      tx({ id: 'amount-off', description: 'NETFLIX', merchantStandardised: 'Netflix Australia', amount: 500 }),
      // no pattern at all → undetermined
      tx({ id: 'no-pattern', description: 'Zzq Obscure Merchant 999', merchantStandardised: 'Zzq Obscure Merchant 999', amount: 80 }),
    ]);
    const byId = new Map(results.map((r) => [r.transaction.id, r]));
    expect(byId.get('match')!.prediction.isRecurring).toBe(true);
    expect(byId.get('match')!.prediction.suggestedFrequency).toBe('MONTHLY');
    expect(byId.get('amount-off')!.prediction.isRecurring).toBeNull();
    expect(byId.get('no-pattern')!.prediction.isRecurring).toBeNull();
  });

  it('the transfer-detection branch emits null too (real path through categoriseWithLearning)', async () => {
    const { results } = await categoriseWithLearning('user-1', [
      tx({ id: 'tr', description: 'Transfer To Reza Sadegh', merchantStandardised: 'Transfer To Reza Sadegh' }),
    ]);
    expect(results[0].prediction.categoryLevel1).toBe('Transfer');
    expect(results[0].prediction.isRecurring).toBeNull();
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

// Import-timeout fix (2026-07-02): the import path is DETERMINISTIC-ONLY — it must
// never run the slow Gemini-on-miss layer inline (that 504'd on a small QIF).
describe('categoriseTransactionBatch — skipAiOnMiss (the import path)', () => {
  const uni = (merchant: string): UnifiedTransaction =>
    ({
      id: `t-${merchant}`,
      userId: 'u1',
      accountId: 'a1',
      date: new Date('2026-07-01T00:00:00Z'),
      amount: 9,
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

  it('a known merchant still resolves deterministically (RULE)', async () => {
    const map = await categoriseTransactionBatch([uni('Hungry Jacks')], { skipAiOnMiss: true });
    const r = map.get('t-Hungry Jacks');
    expect(r?.source).toBe('RULE');
    expect(r?.categoryLevel1).toBe('Food & Dining');
  });

  it('an unknown merchant falls back to Uncategorised with NO LLM call (no timeout)', async () => {
    const map = await categoriseTransactionBatch([uni('Zzq Obscure Merchant 999')], { skipAiOnMiss: true });
    const r = map.get('t-Zzq Obscure Merchant 999');
    expect(r?.source).toBe('FALLBACK');
    expect(r?.categoryLevel2).toBe('Uncategorised');
  });
});
