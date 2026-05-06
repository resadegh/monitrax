/**
 * Phase 41h.4 — runAdvisorQuery shared helper tests.
 *
 * The helper is the single integration point for both the admin
 * demo route and the user-facing route. Test the validation +
 * configuration paths; gateway behaviour is already covered in
 * `gateway.test.ts`.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runAdvisorQuery, QUESTION_MAX_LENGTH } from '@/lib/ai/tax-advisor/runAdvisorQuery';

const ORIG_KEY = process.env.GEMINI_API_KEY;

describe('runAdvisorQuery — validation', () => {
  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key';
  });
  afterEach(() => {
    if (ORIG_KEY === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = ORIG_KEY;
  });

  it('rejects empty question with INVALID_INPUT', async () => {
    const r = await runAdvisorQuery({ userId: 'u1', question: '' });
    expect(r.kind).toBe('INVALID_INPUT');
    if (r.kind === 'INVALID_INPUT') {
      expect(r.field).toBe('question');
      expect(r.message).toMatch(/required/i);
    }
  });

  it('rejects whitespace-only question', async () => {
    const r = await runAdvisorQuery({ userId: 'u1', question: '   \n  ' });
    expect(r.kind).toBe('INVALID_INPUT');
  });

  it('rejects question over the length cap', async () => {
    const long = 'a'.repeat(QUESTION_MAX_LENGTH + 1);
    const r = await runAdvisorQuery({ userId: 'u1', question: long });
    expect(r.kind).toBe('INVALID_INPUT');
    if (r.kind === 'INVALID_INPUT') {
      expect(r.message).toMatch(/2,000 characters/);
    }
  });

  it('accepts question at exactly the length cap', async () => {
    // Won't be NOT_CONFIGURED (key set above); will go to gateway,
    // which will fail without a real Gemini call. We only assert
    // it didn't reject as INVALID_INPUT.
    const ok = 'a'.repeat(QUESTION_MAX_LENGTH);
    const r = await runAdvisorQuery({ userId: 'u1', question: ok });
    // Accept any non-INVALID outcome — a real Gemini call would
    // succeed/fail depending on config. The point: validation
    // accepted it.
    expect(r.kind).not.toBe('INVALID_INPUT');
  });
});

describe('runAdvisorQuery — configuration', () => {
  it('returns NOT_CONFIGURED when GEMINI_API_KEY is unset', async () => {
    const orig = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const r = await runAdvisorQuery({ userId: 'u1', question: 'test question' });
      expect(r.kind).toBe('NOT_CONFIGURED');
      if (r.kind === 'NOT_CONFIGURED') {
        expect(r.message).toMatch(/GEMINI_API_KEY/);
      }
    } finally {
      if (orig !== undefined) process.env.GEMINI_API_KEY = orig;
    }
  });
});
