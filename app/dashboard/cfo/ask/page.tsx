'use client';

/**
 * Phase 41h.4 — User-facing AI advisor surface.
 *
 * The graduated version of the admin demo from 41h.3. Uses the
 * same `components/ai-advisor/` primitives + the same gateway, but
 * authenticates as the end user (`report.read` permission) and
 * lives under the consumer dashboard.
 *
 * **HR-1 + HR-2 + D-2 are structurally enforced upstream** — by the
 * time the gateway returns a `GatewayResponse` to this page, every
 * number traces to a tool result, every citation to a real
 * `AuthorityCitation`, and recommendation-shaped responses route
 * to Tier 2 (Ask-a-Pro) rather than emit advice.
 *
 * **HR-3 alignment** — calc errors that escape the gateway's HR-1
 * rejection net are caught silently by the calc-audit system in 41i;
 * users never see "we think there might be an error" UI here.
 *
 * **TRAIL framing** — sits under the existing CFO surface (TRAIL
 * Stage 5 "Live"). Future iterations may hoist this to "My Guide"
 * once the user-facing IA settles.
 */

import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TaxAdvisorAskForm,
  TaxAdvisorAnswer,
} from '@/components/ai-advisor';
import type { GatewayResponse } from '@/lib/ai/tax-advisor';

const EXAMPLE_QUESTIONS = [
  "What's my super contribution cap headroom for FY24-25?",
  "How does land tax apply to my NSW property?",
  "What's a Div 7A loan and does it apply to me?",
];

export default function AskAdvisorPage() {
  const [response, setResponse] = useState<GatewayResponse | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (question: string) => {
    setLoading(true);
    setError(null);
    setLastQuestion(question);
    setResponse(null);
    try {
      const res = await fetch('/api/ai-advisor/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const json = (await res.json()) as
        | { success: true; data: GatewayResponse }
        | { success: false; error: { code: string; message: string } };

      if (!res.ok || !('success' in json) || !json.success) {
        const code = 'error' in json ? json.error.code : 'UNKNOWN';
        const message = 'error' in json ? json.error.message : `HTTP ${res.status}`;
        setError(code === 'AI_ADVISOR_NOT_CONFIGURED'
          ? "The AI advisor is being set up — please check back soon."
          : message);
      } else {
        setResponse(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Ask the AI advisor"
        description="Get plain-English answers about your tax position. Numbers come from your data; legal references come from Australian law. The AI never invents either — and recommendation-shaped questions route you to a registered professional."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your question</CardTitle>
          </CardHeader>
          <CardContent>
            <TaxAdvisorAskForm
              onSubmit={handleAsk}
              loading={loading}
              examples={EXAMPLE_QUESTIONS}
            />
          </CardContent>
        </Card>

        {error && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-amber-800 dark:text-amber-300">{error}</p>
            </CardContent>
          </Card>
        )}

        {response && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Answer</CardTitle>
            </CardHeader>
            <CardContent>
              <TaxAdvisorAnswer
                response={response}
                originalQuestion={lastQuestion ?? undefined}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
