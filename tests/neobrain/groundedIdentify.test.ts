/**
 * Phase 54.2b — grounded merchant-identify tests.
 *
 * Pins the pure parser for the grounded (web-search) response and the gating.
 * Grounding returns TEXT (incompatible with JSON mode), so the parser must be
 * robust to markdown fences + surrounding prose, validate the taxonomy, and
 * never fabricate a category.
 */

import { describe, it, expect } from 'vitest';

import {
  parseGroundedMerchantResult,
  geminiIdentifyMerchantGrounded,
  KB_GEMINI_GROUNDING_ENABLED,
} from '@/lib/categorisation/kb/geminiOnMiss';

const L1 = ['Food & Dining', 'Transport', 'Shopping', 'Other'];

describe('parseGroundedMerchantResult', () => {
  it('parses a clean JSON object with a merchant name', () => {
    const r = parseGroundedMerchantResult(
      '{"merchantName":"Hungry Jacks","categoryLevel1":"Food & Dining","categoryLevel2":"Fast Food","subcategory":null,"confidence":0.88}',
      L1
    );
    expect(r).not.toBeNull();
    expect(r!.merchantGuess).toBe('Hungry Jacks');
    expect(r!.categoryLevel1).toBe('Food & Dining');
    expect(r!.categoryLevel2).toBe('Fast Food');
    expect(r!.confidence).toBe(0.88);
    expect(r!.source).toBe('AI');
    expect(r!.grounded).toBe(true);
  });
  it('strips ```json markdown fences', () => {
    const r = parseGroundedMerchantResult(
      '```json\n{"merchantName":"Coles","categoryLevel1":"Shopping","confidence":0.9}\n```',
      L1
    );
    expect(r!.merchantGuess).toBe('Coles');
    expect(r!.categoryLevel1).toBe('Shopping');
  });
  it('isolates the JSON object from surrounding prose', () => {
    const r = parseGroundedMerchantResult(
      'Based on the web search, here is the result: {"merchantName":"Uber","categoryLevel1":"Transport","confidence":0.8}. Hope that helps!',
      L1
    );
    expect(r!.merchantGuess).toBe('Uber');
    expect(r!.categoryLevel1).toBe('Transport');
  });
  it('returns merchantGuess null when the model could not identify it', () => {
    const r = parseGroundedMerchantResult(
      '{"merchantName":null,"categoryLevel1":"Other","confidence":0.2}',
      L1
    );
    expect(r).not.toBeNull();
    expect(r!.merchantGuess).toBeNull();
    expect(r!.confidence).toBe(0.2); // → below auto-accept, lands in review
  });
  it('REJECTS a level1 outside the taxonomy (never fabricates a category)', () => {
    const r = parseGroundedMerchantResult(
      '{"merchantName":"X","categoryLevel1":"Crypto Casino","confidence":0.99}',
      L1
    );
    expect(r).toBeNull();
  });
  it('clamps confidence to [0,1]', () => {
    const r = parseGroundedMerchantResult(
      '{"merchantName":"Y","categoryLevel1":"Other","confidence":5}',
      L1
    );
    expect(r!.confidence).toBe(1);
  });
  it('returns null on unparseable / empty / no-JSON text', () => {
    expect(parseGroundedMerchantResult('', L1)).toBeNull();
    expect(parseGroundedMerchantResult('I could not find anything.', L1)).toBeNull();
    expect(parseGroundedMerchantResult('{not valid json', L1)).toBeNull();
  });
});

describe('geminiIdentifyMerchantGrounded — gating', () => {
  it('is OFF by default (KB_GEMINI_GROUNDING_ENABLED unset)', () => {
    expect(KB_GEMINI_GROUNDING_ENABLED).toBe(false);
  });
  it('returns null (no web-search call) when the flag is off', async () => {
    // With the gate off, it must short-circuit before any Gemini call — safe to
    // await without mocking the client.
    await expect(geminiIdentifyMerchantGrounded('SOME UNKNOWN MERCHANT')).resolves.toBeNull();
  });
});
