/**
 * Phase 41h.3 — AI advisor UI component tests.
 *
 * Uses `react-dom/server.renderToString` for lightweight render
 * checks without an RTL setup. Focus: verify each component
 * branches correctly per gateway response status, and that the
 * boundary footer + UNCOMPUTED flags + Tier 2 routing card all
 * render with the right content.
 */

import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  TaxAdvisorAnswer,
  TaxAdvisorBoundaryFooter,
  TaxAdvisorUncomputedFlag,
} from '@/components/ai-advisor';
import type { GatewayResponse } from '@/lib/ai/tax-advisor';
import type { BoundaryFootnote } from '@/lib/tax-engine/boundaries';
import type { UncomputedFlag } from '@/lib/tax-engine/types';

const baseBoundary: BoundaryFootnote = {
  computedPer: 'ITAA 1997 s291-20',
  uncomputedNotes: [],
  boundary:
    'These figures are general information only — not personal financial, tax, or credit advice. Confirm with a registered professional before acting.',
  fyContext: 'FY24-25',
};

const baseResponse = (overrides: Partial<GatewayResponse> = {}): GatewayResponse => ({
  traceId: 'trace_test',
  status: 'OK',
  citations: [],
  uncomputed: [],
  boundary: baseBoundary,
  durationMs: 100,
  tokenUsage: { prompt: 0, completion: 0, total: 0 },
  ...overrides,
});

describe('TaxAdvisorBoundaryFooter', () => {
  it('renders the AFSL/TPB/NCCP boundary statement verbatim', () => {
    const html = renderToString(
      <TaxAdvisorBoundaryFooter
        boundary={baseBoundary}
        citations={[]}
        fyLabel="FY24-25"
      />,
    );
    expect(html).toContain('not personal financial, tax, or credit advice');
    expect(html).toContain('FY24-25');
  });

  it('renders citations inline when supplied', () => {
    const html = renderToString(
      <TaxAdvisorBoundaryFooter
        boundary={baseBoundary}
        citations={[
          {
            id: 'cit-1',
            kind: 'ITAA_1997',
            reference: 'ITAA 1997 s291-20',
            lastReviewed: '2026-05-05',
          },
          {
            id: 'cit-2',
            kind: 'ITAA_1997',
            reference: 'ITAA 1997 s292-85',
            lastReviewed: '2026-05-05',
          },
        ]}
      />,
    );
    expect(html).toContain('ITAA 1997 s291-20');
    expect(html).toContain('ITAA 1997 s292-85');
    expect(html).toContain('Computed per');
  });
});

describe('TaxAdvisorUncomputedFlag', () => {
  it('renders flag id + rationale + citation when present', () => {
    const flag: UncomputedFlag = {
      id: 'UC-MULTI-STATE-LAND-TAX',
      rationale: 'Cross-state aggregation rules NOT computed in v1.',
      citation: {
        kind: 'STATE_LAND_TAX_ACT',
        reference: 'NSW Land Tax Mgmt Act 1956 Pt 4',
        lastReviewed: '2026-05-05',
      },
    };
    const html = renderToString(<TaxAdvisorUncomputedFlag flag={flag} />);
    expect(html).toContain('UC-MULTI-STATE-LAND-TAX');
    expect(html).toContain('Cross-state aggregation rules NOT computed');
    expect(html).toContain('NSW Land Tax Mgmt Act 1956 Pt 4');
  });

  it('renders without citation when absent', () => {
    const flag: UncomputedFlag = {
      id: 'UC-PSI-DEDUCTION-RESTRICTIONS',
      rationale: 'PSI deduction-restriction calc deferred.',
    };
    const html = renderToString(<TaxAdvisorUncomputedFlag flag={flag} />);
    expect(html).toContain('UC-PSI-DEDUCTION-RESTRICTIONS');
    expect(html).toContain('PSI deduction-restriction calc deferred');
  });
});

describe('TaxAdvisorAnswer — status routing', () => {
  it('PROVIDER_ERROR → renders error card with trace id', () => {
    const html = renderToString(
      <TaxAdvisorAnswer
        response={baseResponse({
          status: 'PROVIDER_ERROR',
          providerError: 'Gemini timed out',
          traceId: 'trace_provider_err',
        })}
      />,
    );
    expect(html).toContain('AI is temporarily unavailable');
    expect(html).toContain('trace_provider_err');
  });

  it('BLOCKED_VALIDATION → renders generic accuracy error', () => {
    const html = renderToString(
      <TaxAdvisorAnswer
        response={baseResponse({
          status: 'BLOCKED_VALIDATION',
          traceId: 'trace_blocked',
        })}
      />,
    );
    expect(html).toContain('produce a reliable answer');
  });

  it('SCHEMA_INVALID → same generic error surface', () => {
    const html = renderToString(
      <TaxAdvisorAnswer
        response={baseResponse({
          status: 'SCHEMA_INVALID',
          traceId: 'trace_schema',
        })}
      />,
    );
    expect(html).toContain('produce a reliable answer');
  });

  it('BLOCKED_RECOMMENDATION → routes to ADVISER (default Ask-a-Pro card)', () => {
    const html = renderToString(
      <TaxAdvisorAnswer
        response={baseResponse({
          status: 'BLOCKED_RECOMMENDATION',
          traceId: 'trace_rec',
        })}
      />,
    );
    expect(html).toContain('registered financial adviser');
  });

  it('OK + TIER_1_FACTS renders segments + boundary footer', () => {
    const html = renderToString(
      <TaxAdvisorAnswer
        response={baseResponse({
          status: 'OK',
          answer: {
            tier: 'TIER_1_FACTS',
            segments: [
              { type: 'TEXT', text: 'Your concessional cap headroom:' },
              {
                type: 'NUMBER_REF',
                ref: 'getContributionCapHeadroom#contributionCaps.concessional.cap',
              },
              {
                type: 'CITATION_REF',
                ref: 'getContributionCapHeadroom#cit-1',
              },
            ],
          },
          citations: [
            {
              id: 'cit-1',
              kind: 'ITAA_1997',
              reference: 'ITAA 1997 s291-20',
              lastReviewed: '2026-05-05',
            },
          ],
        })}
      />,
    );
    expect(html).toContain('Your concessional cap headroom');
    expect(html).toContain('ITAA 1997 s291-20');
    expect(html).toContain('not personal financial, tax, or credit advice');
  });

  it('OK + TIER_2_ROUTE_TO_PRO renders the routing card with the right profession', () => {
    const html = renderToString(
      <TaxAdvisorAnswer
        response={baseResponse({
          status: 'OK',
          answer: {
            tier: 'TIER_2_ROUTE_TO_PRO',
            segments: [
              { type: 'TEXT', text: 'A registered adviser can answer this.' },
            ],
            askAProRouting: {
              profession: 'ACCOUNTANT',
              reason: 'Trust restructure question.',
            },
          },
        })}
      />,
    );
    expect(html).toContain('registered tax agent');
    expect(html).toContain('Trust restructure question');
  });

  it('Tier 2 routing card has clickable CTA linking to /marketplace with discipline filter', () => {
    const html = renderToString(
      <TaxAdvisorAnswer
        originalQuestion="Should I transfer my property into a trust?"
        response={baseResponse({
          status: 'OK',
          answer: {
            tier: 'TIER_2_ROUTE_TO_PRO',
            segments: [{ type: 'TEXT', text: 'Adviser scope.' }],
            askAProRouting: {
              profession: 'ADVISER',
              reason: 'Structural restructure question.',
            },
          },
        })}
      />,
    );
    // Anchor href must point at marketplace with discipline filter
    expect(html).toMatch(/href="\/marketplace\?[^"]*discipline=FINANCIAL_ADVISOR/);
    // Question + reason carried as URL params
    expect(html).toContain('question=');
    expect(html).toContain('reason=');
    // CTA copy is profession-specific
    expect(html).toMatch(/Find a[^a-z]*financial adviser/i);
  });

  it('BLOCKED_RECOMMENDATION CTA defaults to ADVISER discipline with original question', () => {
    const html = renderToString(
      <TaxAdvisorAnswer
        originalQuestion="Should I salary sacrifice?"
        response={baseResponse({
          status: 'BLOCKED_RECOMMENDATION',
          traceId: 'trace_blocked_rec',
        })}
      />,
    );
    expect(html).toMatch(/href="\/marketplace\?[^"]*discipline=FINANCIAL_ADVISOR/);
    expect(html).toMatch(/Find a[^a-z]*financial adviser/i);
  });

  it('Tier 2 ACCOUNTANT routing → TAX_AGENT discipline + tax-agent CTA copy', () => {
    const html = renderToString(
      <TaxAdvisorAnswer
        response={baseResponse({
          status: 'OK',
          answer: {
            tier: 'TIER_2_ROUTE_TO_PRO',
            segments: [{ type: 'TEXT', text: 'Tax agent scope.' }],
            askAProRouting: {
              profession: 'ACCOUNTANT',
              reason: 'BAS / GST registration question.',
            },
          },
        })}
      />,
    );
    expect(html).toMatch(/discipline=TAX_AGENT/);
    expect(html).toMatch(/Find a[^a-z]*tax agent/i);
  });

  it('Tier 2 BROKER routing → MORTGAGE_BROKER discipline + broker CTA copy', () => {
    const html = renderToString(
      <TaxAdvisorAnswer
        response={baseResponse({
          status: 'OK',
          answer: {
            tier: 'TIER_2_ROUTE_TO_PRO',
            segments: [{ type: 'TEXT', text: 'Broker scope.' }],
            askAProRouting: {
              profession: 'BROKER',
              reason: 'Refinance question.',
            },
          },
        })}
      />,
    );
    expect(html).toMatch(/discipline=MORTGAGE_BROKER/);
    expect(html).toMatch(/Find a[^a-z]*mortgage broker/i);
  });

  it('UNCOMPUTED flags render in their own section', () => {
    const html = renderToString(
      <TaxAdvisorAnswer
        response={baseResponse({
          status: 'OK',
          answer: {
            tier: 'TIER_1_FACTS',
            segments: [{ type: 'TEXT', text: 'ok' }],
          },
          uncomputed: [
            {
              id: 'UC-SMSF-NALI',
              rationale: 'NALI calc deferred.',
            },
          ],
        })}
      />,
    );
    expect(html).toContain('What I deliberately did NOT compute');
    expect(html).toContain('UC-SMSF-NALI');
  });

  it('always shows trace id + duration + token total at the bottom', () => {
    const html = renderToString(
      <TaxAdvisorAnswer
        response={baseResponse({
          status: 'OK',
          answer: {
            tier: 'TIER_1_FACTS',
            segments: [{ type: 'TEXT', text: 'ok' }],
          },
          traceId: 'visible_trace_42',
          durationMs: 1234,
          tokenUsage: { prompt: 100, completion: 50, total: 150 },
        })}
      />,
    );
    expect(html).toContain('visible_trace_42');
    // React SSR may insert <!-- --> between text nodes, so check
    // each value separately rather than concatenated.
    expect(html).toContain('1234');
    expect(html).toContain('150');
    expect(html).toContain('tokens');
  });
});
