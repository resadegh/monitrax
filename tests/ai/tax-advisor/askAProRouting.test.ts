/**
 * Phase 41h.4 — Ask-a-Pro routing helper tests.
 *
 * Locks in the profession → marketplace-discipline mapping. Reviewers
 * reject any change that broadens the mapping (e.g. routing AFSL
 * questions to TPB-only agents).
 */

import { describe, it, expect } from 'vitest';
import {
  professionToDiscipline,
  buildAskAProDeepLink,
} from '@/lib/ai/tax-advisor/askAProRouting';

describe('professionToDiscipline', () => {
  it('ADVISER → FINANCIAL_ADVISOR (AFSL)', () => {
    expect(professionToDiscipline('ADVISER')).toBe('FINANCIAL_ADVISOR');
  });

  it('ACCOUNTANT → TAX_AGENT (TPB)', () => {
    expect(professionToDiscipline('ACCOUNTANT')).toBe('TAX_AGENT');
  });

  it('BROKER → MORTGAGE_BROKER (NCCP)', () => {
    expect(professionToDiscipline('BROKER')).toBe('MORTGAGE_BROKER');
  });
});

describe('buildAskAProDeepLink', () => {
  it('always includes /marketplace base path', () => {
    const href = buildAskAProDeepLink({ profession: 'ADVISER' });
    expect(href.startsWith('/marketplace?')).toBe(true);
  });

  it('encodes the discipline filter', () => {
    const href = buildAskAProDeepLink({ profession: 'ACCOUNTANT' });
    expect(href).toContain('discipline=TAX_AGENT');
  });

  it('encodes question + reason when provided (URL-safe)', () => {
    const href = buildAskAProDeepLink({
      profession: 'ADVISER',
      question: 'Should I transfer my property into a discretionary trust?',
      reason: 'Restructure question — adviser scope.',
    });
    const params = new URL(href, 'https://example.com').searchParams;
    expect(params.get('discipline')).toBe('FINANCIAL_ADVISOR');
    expect(params.get('question')).toBe(
      'Should I transfer my property into a discretionary trust?',
    );
    expect(params.get('reason')).toBe('Restructure question — adviser scope.');
  });

  it('omits question + reason when not supplied', () => {
    const href = buildAskAProDeepLink({ profession: 'BROKER' });
    expect(href).not.toContain('question=');
    expect(href).not.toContain('reason=');
  });

  it('special characters in question are properly URL-encoded', () => {
    const href = buildAskAProDeepLink({
      profession: 'ADVISER',
      question: 'What about & ? = #',
    });
    expect(href).toContain('question=');
    // Round-trip via URL should restore original
    const params = new URL(href, 'https://example.com').searchParams;
    expect(params.get('question')).toBe('What about & ? = #');
  });
});
