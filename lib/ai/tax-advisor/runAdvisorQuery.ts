/**
 * Phase 41h.4 — Shared advisor query helper.
 *
 * Wraps the gateway construction + invocation. Both the admin demo
 * route (`/api/admin/ai-advisor/ask`) and the user-facing route
 * (`/api/ai-advisor/ask`) call this. Keeps the provider + audit-sink
 * wiring in one place.
 *
 * Returns a discriminated result so route handlers can branch on
 * configuration / validation errors without duplicating the
 * `GEMINI_API_KEY` check.
 */

import {
  createTaxAdvisorGateway,
  GeminiProvider,
  ProductionAuditSink,
  ProviderError,
  type GatewayResponse,
} from '@/lib/ai/tax-advisor';

export type AdvisorQueryOutcome =
  | { kind: 'OK'; response: GatewayResponse }
  | { kind: 'NOT_CONFIGURED'; message: string }
  | { kind: 'INVALID_INPUT'; field: string; message: string };

interface AdvisorQueryParams {
  userId: string;
  question: string;
  fyLabel?: string;
}

const QUESTION_MAX_LENGTH = 2_000;

export async function runAdvisorQuery(
  params: AdvisorQueryParams,
): Promise<AdvisorQueryOutcome> {
  const question = (params.question ?? '').toString().trim();
  if (!question) {
    return {
      kind: 'INVALID_INPUT',
      field: 'question',
      message: 'A `question` field is required.',
    };
  }
  if (question.length > QUESTION_MAX_LENGTH) {
    return {
      kind: 'INVALID_INPUT',
      field: 'question',
      message: `Question must be ${QUESTION_MAX_LENGTH.toLocaleString()} characters or fewer.`,
    };
  }

  if (!process.env.GEMINI_API_KEY) {
    return {
      kind: 'NOT_CONFIGURED',
      message:
        'AI advisor is not configured: GEMINI_API_KEY is not set. The advisor surface will become available once the API key is wired in production.',
    };
  }

  let provider: GeminiProvider;
  try {
    provider = new GeminiProvider();
  } catch (err) {
    if (err instanceof ProviderError) {
      return { kind: 'NOT_CONFIGURED', message: err.message };
    }
    throw err;
  }

  const gateway = createTaxAdvisorGateway({
    provider,
    auditSink: new ProductionAuditSink(),
  });

  const response = await gateway.ask({
    userId: params.userId,
    question,
    fyLabel: params.fyLabel,
  });

  return { kind: 'OK', response };
}

export { QUESTION_MAX_LENGTH };
