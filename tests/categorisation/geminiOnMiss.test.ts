/**
 * Phase 52 — Gemini-on-miss tests. Pins the gate (OFF by default → no LLM call)
 * and the pure prompt builder (valid taxonomy + RAG examples; JSON-only contract).
 */

import { describe, it, expect } from 'vitest';
import {
  buildCategorisationPrompt,
  geminiCategoriseOnMiss,
  KB_GEMINI_ENABLED,
} from '@/lib/categorisation/kb/geminiOnMiss';

describe('geminiCategoriseOnMiss — cost gate', () => {
  it('is OFF by default (no LLM call without explicit enable)', async () => {
    expect(KB_GEMINI_ENABLED).toBe(false);
    expect(await geminiCategoriseOnMiss('SOME UNKNOWN MERCHANT')).toBeNull();
  });
});

describe('buildCategorisationPrompt', () => {
  const { systemPrompt, userPrompt } = buildCategorisationPrompt(
    'WOOLWORTHS',
    ['Food & Dining', 'Transport', 'Housing'],
    [{ pattern: 'COLES', category: 'Food & Dining>Groceries' }]
  );

  it('constrains output to JSON only', () => {
    expect(systemPrompt).toMatch(/ONLY JSON/i);
    expect(systemPrompt).toMatch(/categoryLevel1/);
  });
  it('lists the allowed level1 values', () => {
    expect(userPrompt).toContain('Food & Dining, Transport, Housing');
  });
  it('seeds the KB examples (RAG)', () => {
    expect(userPrompt).toContain('COLES');
    expect(userPrompt).toContain('Food & Dining>Groceries');
  });
  it('includes the merchant signature to classify', () => {
    expect(userPrompt).toContain('WOOLWORTHS');
  });
  it('handles the empty-examples case gracefully', () => {
    const { userPrompt: up } = buildCategorisationPrompt('NETFLIX', ['Entertainment'], []);
    expect(up).toContain('no examples yet');
  });
});
