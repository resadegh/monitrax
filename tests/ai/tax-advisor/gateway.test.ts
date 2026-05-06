/**
 * Phase 41h.1 — AI Policy Gateway tests.
 *
 * The centrepiece is the HR-1/HR-2/D-2 enforcement test matrix:
 * for each rule, we exercise the validator with a "good" AI
 * response (passes) and a "fabricated" AI response (rejected).
 * This locks in the structural defence so a future PR can't relax
 * it by accident.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTaxAdvisorGateway,
  MockProvider,
  InMemoryAuditSink,
  validateAIResponse,
  parseRawAIResponse,
  buildSystemPrompt,
  taxAdvisorToolRegistry,
  bootstrapTaxAdvisorRegistry,
  type ToolSession,
  type RawAIResponse,
} from '@/lib/ai/tax-advisor';

beforeEach(() => {
  taxAdvisorToolRegistry.__testOnlyClear();
  bootstrapTaxAdvisorRegistry();
});

// ============================================================
// Response schema (Zod) — shape validation
// ============================================================

describe('responseSchema — Zod shape validation', () => {
  it('accepts a well-formed Tier 1 response', () => {
    const r = parseRawAIResponse({
      tier: 'TIER_1_FACTS',
      segments: [
        { type: 'TEXT', text: 'Your concessional cap headroom for FY24-25:' },
        {
          type: 'NUMBER_REF',
          ref: 'getContributionCapHeadroom#contributionCaps.concessional.remaining',
          format: 'currency',
        },
        { type: 'CITATION_REF', ref: 'getContributionCapHeadroom#cit-1' },
      ],
    });
    expect(r.tier).toBe('TIER_1_FACTS');
    expect(r.segments).toHaveLength(3);
  });

  it('accepts a Tier 2 response with askAProRouting', () => {
    const r = parseRawAIResponse({
      tier: 'TIER_2_ROUTE_TO_PRO',
      segments: [{ type: 'TEXT', text: 'This requires a registered tax agent.' }],
      askAProRouting: {
        profession: 'ACCOUNTANT',
        reason: 'User asked whether to restructure into a trust.',
      },
    });
    expect(r.tier).toBe('TIER_2_ROUTE_TO_PRO');
  });

  it('rejects malformed NUMBER_REF', () => {
    expect(() =>
      parseRawAIResponse({
        tier: 'TIER_1_FACTS',
        segments: [{ type: 'NUMBER_REF', ref: 'bad-format' }],
      }),
    ).toThrow();
  });

  it('rejects malformed CITATION_REF', () => {
    expect(() =>
      parseRawAIResponse({
        tier: 'TIER_1_FACTS',
        segments: [{ type: 'CITATION_REF', ref: 'no-cit-prefix' }],
      }),
    ).toThrow();
  });

  it('rejects empty segments array', () => {
    expect(() =>
      parseRawAIResponse({ tier: 'TIER_1_FACTS', segments: [] }),
    ).toThrow();
  });

  it('rejects unknown tier', () => {
    expect(() =>
      parseRawAIResponse({
        tier: 'TIER_3_ESCALATE' as never,
        segments: [{ type: 'TEXT', text: 'x' }],
      }),
    ).toThrow();
  });
});

// ============================================================
// HR-1 / HR-2 / D-2 validator (against ToolSession)
// ============================================================

const sessionWith = (overrides: Partial<ToolSession>): ToolSession => ({
  sessionId: 's1',
  startedAt: '2026-05-06T00:00:00Z',
  invocations: [],
  ...overrides,
});

const goodInvocation = {
  toolName: 'getContributionCapHeadroom',
  input: {},
  result: {
    toolName: 'getContributionCapHeadroom',
    computedAt: '2026-05-06T00:00:00Z',
    numericFields: [
      {
        path: 'contributionCaps.concessional.cap',
        value: 30_000,
        unit: 'AUD' as const,
        label: 'Concessional cap',
        citationIds: ['cit-1'],
      },
    ],
    citations: [
      {
        id: 'cit-1',
        kind: 'ITAA_1997' as const,
        reference: 'ITAA 1997 s291-20',
        lastReviewed: '2026-05-05',
      },
    ],
    uncomputed: [],
    narrativeText: 'Cap is $30,000 [cit:cit-1].',
    raw: {},
  },
};

describe('validator — HR-1: numbers must trace to a tool result', () => {
  it('PASS: NUMBER_REF resolving to a real path', () => {
    const session = sessionWith({ invocations: [goodInvocation] });
    const response: RawAIResponse = {
      tier: 'TIER_1_FACTS',
      segments: [
        {
          type: 'NUMBER_REF',
          ref: 'getContributionCapHeadroom#contributionCaps.concessional.cap',
        },
      ],
    };
    const v = validateAIResponse(response, session);
    expect(v.ok).toBe(true);
  });

  it('REJECT: NUMBER_REF to an unknown tool', () => {
    const session = sessionWith({ invocations: [goodInvocation] });
    const response: RawAIResponse = {
      tier: 'TIER_1_FACTS',
      segments: [
        { type: 'NUMBER_REF', ref: 'fakeTool#contributionCaps.concessional.cap' },
      ],
    };
    const v = validateAIResponse(response, session);
    expect(v.ok).toBe(false);
    expect(v.issues[0].code).toBe('HR1_NUMBER_NOT_IN_SESSION');
  });

  it('REJECT: NUMBER_REF to a fabricated path within a real tool', () => {
    const session = sessionWith({ invocations: [goodInvocation] });
    const response: RawAIResponse = {
      tier: 'TIER_1_FACTS',
      segments: [
        {
          type: 'NUMBER_REF',
          ref: 'getContributionCapHeadroom#contributionCaps.fake.path',
        },
      ],
    };
    const v = validateAIResponse(response, session);
    expect(v.ok).toBe(false);
    expect(v.issues[0].code).toBe('HR1_NUMBER_NOT_IN_SESSION');
  });

  it('REJECT: bare financial number embedded in TEXT', () => {
    const session = sessionWith({ invocations: [goodInvocation] });
    const response: RawAIResponse = {
      tier: 'TIER_1_FACTS',
      segments: [
        {
          type: 'TEXT',
          text: 'Your cap is $30,000 for FY24-25.',
        },
      ],
    };
    const v = validateAIResponse(response, session);
    expect(v.ok).toBe(false);
    expect(v.issues[0].code).toBe('HR1_BARE_FINANCIAL_NUMBER_IN_TEXT');
  });

  it('REJECT: bare percentage in TEXT', () => {
    const session = sessionWith({ invocations: [goodInvocation] });
    const response: RawAIResponse = {
      tier: 'TIER_1_FACTS',
      segments: [{ type: 'TEXT', text: 'CGT discount is 50% after 12 months.' }],
    };
    const v = validateAIResponse(response, session);
    expect(v.ok).toBe(false);
    expect(v.issues.map((i) => i.code)).toContain('HR1_BARE_FINANCIAL_NUMBER_IN_TEXT');
  });

  it('PASS: TEXT with no financial numbers', () => {
    const session = sessionWith({ invocations: [goodInvocation] });
    const response: RawAIResponse = {
      tier: 'TIER_1_FACTS',
      segments: [
        { type: 'TEXT', text: 'Your concessional cap headroom for the year:' },
        { type: 'NUMBER_REF', ref: 'getContributionCapHeadroom#contributionCaps.concessional.cap' },
      ],
    };
    const v = validateAIResponse(response, session);
    expect(v.ok).toBe(true);
  });
});

describe('validator — HR-2: citations must trace to a tool result', () => {
  it('PASS: CITATION_REF resolving to a real citation', () => {
    const session = sessionWith({ invocations: [goodInvocation] });
    const response: RawAIResponse = {
      tier: 'TIER_1_FACTS',
      segments: [
        { type: 'CITATION_REF', ref: 'getContributionCapHeadroom#cit-1' },
      ],
    };
    const v = validateAIResponse(response, session);
    expect(v.ok).toBe(true);
  });

  it('REJECT: CITATION_REF to a fabricated citation id', () => {
    const session = sessionWith({ invocations: [goodInvocation] });
    const response: RawAIResponse = {
      tier: 'TIER_1_FACTS',
      segments: [
        { type: 'CITATION_REF', ref: 'getContributionCapHeadroom#cit-99-fake' },
      ],
    };
    const v = validateAIResponse(response, session);
    expect(v.ok).toBe(false);
    expect(v.issues[0].code).toBe('HR2_CITATION_NOT_IN_SESSION');
  });

  it('REJECT: CITATION_REF for a tool that was not invoked', () => {
    const session = sessionWith({ invocations: [goodInvocation] });
    const response: RawAIResponse = {
      tier: 'TIER_1_FACTS',
      segments: [{ type: 'CITATION_REF', ref: 'fakeTool#cit-1' }],
    };
    const v = validateAIResponse(response, session);
    expect(v.ok).toBe(false);
    expect(v.issues[0].code).toBe('HR2_CITATION_NOT_IN_SESSION');
  });
});

describe('validator — D-2: no recommendation language in Tier 1', () => {
  it('REJECT: "you should" language in TEXT', () => {
    const session = sessionWith({ invocations: [goodInvocation] });
    const response: RawAIResponse = {
      tier: 'TIER_1_FACTS',
      segments: [
        {
          type: 'TEXT',
          text: 'You should consider increasing your contributions to fill the cap.',
        },
      ],
    };
    const v = validateAIResponse(response, session);
    expect(v.ok).toBe(false);
    expect(v.issues[0].code).toBe('D2_RECOMMENDATION_LEAK');
  });

  it('REJECT: "I recommend" language', () => {
    const session = sessionWith({ invocations: [goodInvocation] });
    const response: RawAIResponse = {
      tier: 'TIER_1_FACTS',
      segments: [{ type: 'TEXT', text: 'I recommend transferring it to a trust.' }],
    };
    const v = validateAIResponse(response, session);
    expect(v.ok).toBe(false);
    expect(v.issues[0].code).toBe('D2_RECOMMENDATION_LEAK');
  });

  it('PASS: same language is allowed in TIER_2_ROUTE_TO_PRO routing', () => {
    const session = sessionWith({ invocations: [goodInvocation] });
    const response: RawAIResponse = {
      tier: 'TIER_2_ROUTE_TO_PRO',
      segments: [
        {
          type: 'TEXT',
          text: 'A registered adviser can advise whether you should restructure.',
        },
      ],
      askAProRouting: { profession: 'ADVISER', reason: 'Restructure question.' },
    };
    const v = validateAIResponse(response, session);
    expect(v.ok).toBe(true);
  });
});

describe('validator — UNCOMPUTED + Tier 2 routing', () => {
  it('REJECT: UNCOMPUTED_NOTE referencing a flag not in session', () => {
    const session = sessionWith({ invocations: [goodInvocation] });
    const response: RawAIResponse = {
      tier: 'TIER_1_FACTS',
      segments: [{ type: 'UNCOMPUTED_NOTE', flagId: 'UC-FAKE-FLAG' }],
    };
    const v = validateAIResponse(response, session);
    expect(v.ok).toBe(false);
    expect(v.issues[0].code).toBe('UC_FLAG_NOT_IN_SESSION');
  });

  it('REJECT: TIER_2_ROUTE_TO_PRO without askAProRouting', () => {
    const session = sessionWith({ invocations: [goodInvocation] });
    const response: RawAIResponse = {
      tier: 'TIER_2_ROUTE_TO_PRO',
      segments: [{ type: 'TEXT', text: 'See a pro.' }],
    };
    const v = validateAIResponse(response, session);
    expect(v.ok).toBe(false);
    expect(v.issues[0].code).toBe('TIER2_MISSING_ROUTING');
  });
});

// ============================================================
// System prompt — Monitrax persona
// ============================================================

describe('buildSystemPrompt', () => {
  it('embeds HR-1, HR-2, D-2 hard rules', () => {
    const prompt = buildSystemPrompt(taxAdvisorToolRegistry.list());
    expect(prompt).toContain('HR-1');
    expect(prompt).toContain('HR-2');
    expect(prompt).toContain('D-2');
  });

  it('lists every tool in the catalogue', () => {
    const prompt = buildSystemPrompt(taxAdvisorToolRegistry.list());
    expect(prompt).toContain('getContributionCapHeadroom');
    expect(prompt).toContain('getLandTaxPosition');
    expect(prompt).toContain('getEntityTaxPosition');
  });

  it('explicitly forbids recommending', () => {
    const prompt = buildSystemPrompt(taxAdvisorToolRegistry.list());
    expect(prompt.toLowerCase()).toContain('recommend');
    expect(prompt.toLowerCase()).toContain('tier_2_route_to_pro');
  });
});

// ============================================================
// Gateway end-to-end with MockProvider
// ============================================================

describe('Gateway — end-to-end with MockProvider', () => {
  it('OK: valid response passes through', async () => {
    const mock = new MockProvider().queueResponse({
      rawAnswer: {
        tier: 'TIER_1_FACTS',
        segments: [
          { type: 'TEXT', text: 'Your concessional cap headroom:' },
          {
            type: 'NUMBER_REF',
            ref: 'getContributionCapHeadroom#contributionCaps.concessional.cap',
          },
          { type: 'CITATION_REF', ref: 'getContributionCapHeadroom#cit-1' },
        ],
      },
      toolCalls: [
        {
          toolName: 'getContributionCapHeadroom',
          input: {
            financialYear: '2024-25',
            concessionalYTD: 22_000,
            nonConcessionalYTD: 0,
          },
        },
      ],
      tokenUsage: { prompt: 1200, completion: 80, total: 1280 },
    });
    const sink = new InMemoryAuditSink();
    const gateway = createTaxAdvisorGateway({ provider: mock, auditSink: sink });

    const r = await gateway.ask({
      userId: 'user-1',
      question: "What's my super contribution cap headroom?",
      fyLabel: 'FY24-25',
    });

    expect(r.status).toBe('OK');
    expect(r.answer?.tier).toBe('TIER_1_FACTS');
    expect(r.citations.length).toBeGreaterThan(0);
    expect(r.boundary).toBeDefined();
    expect(r.tokenUsage.total).toBe(1280);
    expect(sink.entries[0]?.outcome).toBe('OK');
    expect(sink.entries[0]?.toolsInvoked).toEqual(['getContributionCapHeadroom']);
  });

  it('BLOCKED_VALIDATION: AI fabricates a number → rejected', async () => {
    const mock = new MockProvider().queueResponse({
      rawAnswer: {
        tier: 'TIER_1_FACTS',
        segments: [
          {
            type: 'NUMBER_REF',
            ref: 'getContributionCapHeadroom#contributionCaps.totallyFakePath',
          },
        ],
      },
      toolCalls: [
        {
          toolName: 'getContributionCapHeadroom',
          input: { financialYear: '2024-25', concessionalYTD: 0, nonConcessionalYTD: 0 },
        },
      ],
    });
    const sink = new InMemoryAuditSink();
    const gateway = createTaxAdvisorGateway({ provider: mock, auditSink: sink });

    const r = await gateway.ask({ userId: 'user-1', question: 'Tell me my cap' });

    expect(r.status).toBe('BLOCKED_VALIDATION');
    expect(r.validationIssues?.[0].code).toBe('HR1_NUMBER_NOT_IN_SESSION');
    expect(r.answer).toBeUndefined();
    expect(sink.entries[0]?.outcome).toBe('BLOCKED_VALIDATION');
  });

  it('BLOCKED_VALIDATION: AI fabricates a citation → rejected', async () => {
    const mock = new MockProvider().queueResponse({
      rawAnswer: {
        tier: 'TIER_1_FACTS',
        segments: [
          { type: 'TEXT', text: 'Your position:' },
          { type: 'CITATION_REF', ref: 'getContributionCapHeadroom#cit-99-fake' },
        ],
      },
      toolCalls: [
        {
          toolName: 'getContributionCapHeadroom',
          input: { financialYear: '2024-25', concessionalYTD: 0, nonConcessionalYTD: 0 },
        },
      ],
    });
    const sink = new InMemoryAuditSink();
    const gateway = createTaxAdvisorGateway({ provider: mock, auditSink: sink });

    const r = await gateway.ask({ userId: 'user-1', question: 'Tell me my cap' });

    expect(r.status).toBe('BLOCKED_VALIDATION');
    expect(r.validationIssues?.some((i) => i.code === 'HR2_CITATION_NOT_IN_SESSION')).toBe(true);
  });

  it('BLOCKED_RECOMMENDATION: AI emits "you should" in Tier 1 → rejected', async () => {
    const mock = new MockProvider().queueResponse({
      rawAnswer: {
        tier: 'TIER_1_FACTS',
        segments: [
          {
            type: 'TEXT',
            text: 'You should salary sacrifice more to fill the cap.',
          },
        ],
      },
      toolCalls: [
        {
          toolName: 'getContributionCapHeadroom',
          input: { financialYear: '2024-25', concessionalYTD: 0, nonConcessionalYTD: 0 },
        },
      ],
    });
    const sink = new InMemoryAuditSink();
    const gateway = createTaxAdvisorGateway({ provider: mock, auditSink: sink });

    const r = await gateway.ask({ userId: 'user-1', question: 'What should I do?' });

    expect(r.status).toBe('BLOCKED_RECOMMENDATION');
    expect(r.validationIssues?.some((i) => i.code === 'D2_RECOMMENDATION_LEAK')).toBe(true);
    expect(sink.entries[0]?.outcome).toBe('BLOCKED_RECOMMENDATION');
  });

  it('Tier 2 routing: "should I…?" question → TIER_2_ROUTE_TO_PRO passes', async () => {
    const mock = new MockProvider().queueResponse({
      rawAnswer: {
        tier: 'TIER_2_ROUTE_TO_PRO',
        segments: [
          {
            type: 'TEXT',
            text: 'A registered adviser can determine the best structure for your circumstances.',
          },
        ],
        askAProRouting: {
          profession: 'ADVISER',
          reason: 'Structural recommendation question.',
        },
      },
      toolCalls: [],
    });
    const sink = new InMemoryAuditSink();
    const gateway = createTaxAdvisorGateway({ provider: mock, auditSink: sink });

    const r = await gateway.ask({
      userId: 'user-1',
      question: 'Should I transfer my property into a discretionary trust?',
    });

    expect(r.status).toBe('OK');
    expect(r.answer?.tier).toBe('TIER_2_ROUTE_TO_PRO');
    expect(r.answer?.askAProRouting?.profession).toBe('ADVISER');
  });

  it('SCHEMA_INVALID: provider returns malformed output', async () => {
    const mock = new MockProvider().queueResponse({
      rawAnswer: { not_a_real_response: true },
    });
    const sink = new InMemoryAuditSink();
    const gateway = createTaxAdvisorGateway({ provider: mock, auditSink: sink });

    const r = await gateway.ask({ userId: 'user-1', question: 'x' });

    expect(r.status).toBe('SCHEMA_INVALID');
    expect(r.answer).toBeUndefined();
    expect(sink.entries[0]?.outcome).toBe('SCHEMA_INVALID');
  });

  it('PROVIDER_ERROR: provider throws', async () => {
    const mock = new MockProvider().queueResponse({
      rawAnswer: null,
      throwError: { message: 'Gemini timed out' },
    });
    const sink = new InMemoryAuditSink();
    const gateway = createTaxAdvisorGateway({ provider: mock, auditSink: sink });

    const r = await gateway.ask({ userId: 'user-1', question: 'x' });

    expect(r.status).toBe('PROVIDER_ERROR');
    expect(r.providerError).toContain('Gemini timed out');
    expect(sink.entries[0]?.outcome).toBe('PROVIDER_ERROR');
  });

  it('Tool registry enforcement: AI tries to call an unregistered tool → ProviderError', async () => {
    const mock = new MockProvider().queueResponse({
      rawAnswer: {
        tier: 'TIER_1_FACTS',
        segments: [{ type: 'TEXT', text: 'ok' }],
      },
      toolCalls: [{ toolName: 'recommendStructuralChange', input: {} }],
    });
    const sink = new InMemoryAuditSink();
    const gateway = createTaxAdvisorGateway({ provider: mock, auditSink: sink });

    const r = await gateway.ask({ userId: 'user-1', question: 'x' });

    expect(r.status).toBe('PROVIDER_ERROR');
    expect(r.providerError).toContain('not registered');
  });
});

// ============================================================
// Audit logging
// ============================================================

describe('Audit logger', () => {
  it('records traceId, userId, provider, toolsInvoked, outcome, durationMs', async () => {
    const mock = new MockProvider().queueResponse({
      rawAnswer: {
        tier: 'TIER_1_FACTS',
        segments: [{ type: 'TEXT', text: 'ok' }],
      },
      toolCalls: [
        {
          toolName: 'getContributionCapHeadroom',
          input: { financialYear: '2024-25', concessionalYTD: 0, nonConcessionalYTD: 0 },
        },
      ],
    });
    const sink = new InMemoryAuditSink();
    const gateway = createTaxAdvisorGateway({
      provider: mock,
      auditSink: sink,
      generateTraceId: () => 'fixed-trace-id',
    });

    await gateway.ask({ userId: 'user-42', question: 'x' });

    expect(sink.entries).toHaveLength(1);
    const entry = sink.entries[0];
    expect(entry.traceId).toBe('fixed-trace-id');
    expect(entry.userId).toBe('user-42');
    expect(entry.provider).toBe('mock');
    expect(entry.toolsInvoked).toEqual(['getContributionCapHeadroom']);
    expect(entry.outcome).toBe('OK');
    expect(typeof entry.durationMs).toBe('number');
  });

  it('does NOT include the user question or AI response text (CDR-safe)', async () => {
    const mock = new MockProvider().queueResponse({
      rawAnswer: {
        tier: 'TIER_1_FACTS',
        segments: [{ type: 'TEXT', text: 'CONFIDENTIAL FINANCIAL DATA' }],
      },
    });
    const sink = new InMemoryAuditSink();
    const gateway = createTaxAdvisorGateway({ provider: mock, auditSink: sink });

    await gateway.ask({
      userId: 'user-1',
      question: 'My BSB is 062-000 — what tax is owed?',
    });

    const entryStr = JSON.stringify(sink.entries[0]);
    expect(entryStr).not.toContain('062-000');
    expect(entryStr).not.toContain('CONFIDENTIAL');
  });
});
