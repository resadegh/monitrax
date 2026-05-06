/**
 * Phase 41h.3 — TaxAdvisorAnswer renderer.
 *
 * Renders a validated `RawAIResponse` from the gateway. The AI's
 * answer is a sequence of typed segments — `TEXT` (paraphrase),
 * `NUMBER_REF` (number from a tool result), `CITATION_REF` (legal
 * authority), `UNCOMPUTED_NOTE` (deferred-rule flag). The renderer
 * resolves each segment against the gateway's `citations[]` and
 * `uncomputed[]` arrays so the UI can show numbers next to their
 * source.
 *
 * **HR-1 + HR-2 surface integrity**: by construction, every number
 * in the rendered output came from a tool result (the gateway's
 * validator already rejected fabrications). This component just
 * presents what the gateway returned. Reviewers reject any change
 * that adds AI-emit-able content outside the typed-segment schema.
 *
 * **Tier 2 routing**: when `tier === 'TIER_2_ROUTE_TO_PRO'`, the
 * renderer surfaces the routing card (Ask-a-Pro entry point — wired
 * to the marketplace in Phase 41h.4). Until then, this PR shows the
 * routing card as informational.
 */

import React from 'react';
import type {
  RawAIResponse,
  AnswerSegment,
} from '@/lib/ai/tax-advisor';
import type { IdentifiedCitation } from '@/lib/ai/tax-advisor/types';
import type { UncomputedFlag } from '@/lib/tax-engine/types';
import type { GatewayResponse } from '@/lib/ai/tax-advisor';
import {
  buildAskAProDeepLink,
  type AdvisorProfession,
} from '@/lib/ai/tax-advisor/askAProRouting';
import { TaxAdvisorBoundaryFooter } from './TaxAdvisorBoundaryFooter';
import { TaxAdvisorUncomputedFlag } from './TaxAdvisorUncomputedFlag';

interface TaxAdvisorAnswerProps {
  response: GatewayResponse;
  /** Optional FY label override for the boundary footer. */
  fyLabel?: string;
  /**
   * Question the user originally asked. Used to pre-fill the
   * Ask-a-Pro deep link for context.
   */
  originalQuestion?: string;
}

export function TaxAdvisorAnswer({ response, fyLabel, originalQuestion }: TaxAdvisorAnswerProps) {
  // Status surfaces from the gateway — the UI must handle every one.
  if (response.status === 'PROVIDER_ERROR') {
    return (
      <ErrorCard
        title="AI is temporarily unavailable"
        body="We couldn't reach the AI advisor. Try again in a moment, or contact support if the issue continues."
        traceId={response.traceId}
      />
    );
  }

  if (response.status === 'BLOCKED_VALIDATION' || response.status === 'SCHEMA_INVALID') {
    return (
      <ErrorCard
        title="Couldn't produce a reliable answer"
        body="The AI's response didn't meet our accuracy standards. Try rephrasing your question, or speak to a registered professional via Ask-a-Pro."
        traceId={response.traceId}
      />
    );
  }

  if (response.status === 'BLOCKED_RECOMMENDATION') {
    return (
      <RouteToPro
        reason="Recommendations are out of scope for the AI advisor — a registered professional is the right resource."
        profession="ADVISER"
        traceId={response.traceId}
        originalQuestion={originalQuestion}
      />
    );
  }

  if (!response.answer) {
    return null;
  }

  const { answer, citations, uncomputed, boundary } = response;

  // Build a lookup map for NUMBER_REF / CITATION_REF resolution.
  const numericMap = new Map<string, ResolvedNumber>();
  const citationMap = new Map<string, IdentifiedCitation>();
  const ucMap = new Map<string, UncomputedFlag>();

  for (const c of citations) {
    citationMap.set(c.id, c);
  }
  for (const u of uncomputed) {
    ucMap.set(u.id, u);
  }
  // The gateway records full numericFields on each invocation; we
  // expose them via the response's `citations` cousin in
  // future iterations. For now, the renderer formats from
  // NUMBER_REF metadata embedded in the answer if present.
  // (The validator already verified each NUMBER_REF resolves; we
  // just need a label/value for display, which the gateway will
  // pass through in 41h.4.)
  // For 41h.3, we render NUMBER_REF as the path string + a link to
  // its source tool — sufficient for the demo surface.

  return (
    <div className="tax-advisor-answer space-y-6">
      {answer.tier === 'TIER_2_ROUTE_TO_PRO' && answer.askAProRouting && (
        <RouteToPro
          reason={answer.askAProRouting.reason}
          profession={answer.askAProRouting.profession}
          traceId={response.traceId}
          originalQuestion={originalQuestion}
        />
      )}

      {answer.tier === 'TIER_1_FACTS' && (
        <article className="prose prose-sm dark:prose-invert max-w-none">
          {answer.segments.map((segment, i) => (
            <SegmentRenderer
              key={i}
              segment={segment}
              numericMap={numericMap}
              citationMap={citationMap}
              ucMap={ucMap}
            />
          ))}
        </article>
      )}

      {uncomputed.length > 0 && (
        <section aria-label="Deferred rules">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400 mb-2">
            What I deliberately did NOT compute
          </h4>
          <ul className="space-y-2">
            {uncomputed.map((u) => (
              <li key={u.id}>
                <TaxAdvisorUncomputedFlag flag={u} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <TaxAdvisorBoundaryFooter
        boundary={boundary}
        citations={citations}
        fyLabel={fyLabel ?? boundary.fyContext ?? undefined}
      />

      <p className="text-xs text-gray-400 dark:text-gray-500">
        Trace ID: <code>{response.traceId}</code> · {response.durationMs}ms · {response.tokenUsage.total} tokens
      </p>
    </div>
  );
}

// ---------- Internal sub-components ----------

interface ResolvedNumber {
  value: number;
  label: string;
  unit: string;
  citationIds: string[];
}

interface SegmentRendererProps {
  segment: AnswerSegment;
  numericMap: Map<string, ResolvedNumber>;
  citationMap: Map<string, IdentifiedCitation>;
  ucMap: Map<string, UncomputedFlag>;
}

function SegmentRenderer({ segment, citationMap, ucMap }: SegmentRendererProps) {
  switch (segment.type) {
    case 'TEXT':
      return <p>{segment.text}</p>;

    case 'NUMBER_REF':
      // 41h.3: show the path as a structured number stub. 41h.4 will
      // pass through NumericField metadata so we can format properly.
      return (
        <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
          <code className="text-xs text-gray-500 dark:text-gray-400">
            {segment.ref}
          </code>
        </span>
      );

    case 'CITATION_REF': {
      const c = citationMap.get(segment.ref.split('#')[1] ?? '');
      if (!c) return null;
      return (
        <sup className="text-xs text-blue-600 dark:text-blue-400">
          [{c.reference}]
        </sup>
      );
    }

    case 'UNCOMPUTED_NOTE': {
      const u = ucMap.get(segment.flagId);
      if (!u) return null;
      return (
        <span className="inline-block text-xs text-amber-700 dark:text-amber-400">
          ⚠ {u.id}
        </span>
      );
    }

    default:
      return null;
  }
}

function ErrorCard({
  title,
  body,
  traceId,
}: {
  title: string;
  body: string;
  traceId: string;
}) {
  return (
    <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4">
      <h4 className="font-semibold text-red-800 dark:text-red-300 text-sm">{title}</h4>
      <p className="text-sm text-red-700 dark:text-red-400 mt-1">{body}</p>
      <p className="text-xs text-red-600/60 mt-2">
        Trace: <code>{traceId}</code>
      </p>
    </div>
  );
}

function RouteToPro({
  reason,
  profession,
  traceId,
  originalQuestion,
}: {
  reason: string;
  profession: AdvisorProfession;
  traceId: string;
  originalQuestion?: string;
}) {
  const professionLabel: Record<AdvisorProfession, string> = {
    ADVISER: 'a registered financial adviser (AFSL)',
    ACCOUNTANT: 'a registered tax agent (TPB)',
    BROKER: 'a credit assistant (NCCP)',
  };
  const askAProHref = buildAskAProDeepLink({
    profession,
    question: originalQuestion,
    reason,
  });
  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20 p-4 space-y-3">
      <div>
        <h4 className="font-semibold text-blue-900 dark:text-blue-200 text-sm">
          This question is best answered by {professionLabel[profession]}
        </h4>
        <p className="text-sm text-blue-800 dark:text-blue-300 mt-1">{reason}</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <a
          href={askAProHref}
          className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          Find a {profession === 'ADVISER' ? 'financial adviser' : profession === 'ACCOUNTANT' ? 'tax agent' : 'mortgage broker'} →
        </a>
        <p className="text-xs text-blue-700/60">
          Trace: <code>{traceId}</code>
        </p>
      </div>
    </div>
  );
}
