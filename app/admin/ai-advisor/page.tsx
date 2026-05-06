'use client';

/**
 * Phase 41h.3 — AI Advisor admin demo page.
 *
 * Internal-only surface where admins can exercise the gateway
 * end-to-end (against the real Gemini provider when configured).
 * Acts as the integration test surface until 41h.4+ graduates the
 * advisor to user-facing dashboards.
 *
 * Per HR-1 + HR-2 + D-2 (CLAUDE.md / Phase 41 §1 invariants 9-11),
 * the AI cannot:
 *   - emit numbers not produced by a calc engine (HR-1)
 *   - cite Australian law not surfaced by a tool result (HR-2)
 *   - emit recommendations (D-2 — there is no `recommend*` tool in
 *     the registry; recommendation-shaped responses route to
 *     Tier 2 Ask-a-Pro)
 */

import React, { useState } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminFeatureGate } from '@/components/admin/AdminFeatureGate';
import {
  TaxAdvisorAskForm,
  TaxAdvisorAnswer,
} from '@/components/ai-advisor';
import type { GatewayResponse } from '@/lib/ai/tax-advisor';

const EXAMPLE_QUESTIONS = [
  "What's my super contribution cap headroom for FY24-25?",
  "If I have a $1.5M property in NSW, what's the land tax?",
  "Should I transfer my property into a discretionary trust?", // routes to Tier 2
];

export default function AiAdvisorDemoPage() {
  const [response, setResponse] = useState<GatewayResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuestion, setLastQuestion] = useState<string | null>(null);

  const handleAsk = async (question: string) => {
    setLoading(true);
    setError(null);
    setLastQuestion(question);
    try {
      const res = await fetch('/api/admin/ai-advisor/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const json = (await res.json()) as
        | { success: true; data: GatewayResponse }
        | { error: { code: string; message: string } };

      if (!res.ok || !('success' in json) || !json.success) {
        const msg =
          'error' in json && json.error
            ? `${json.error.code}: ${json.error.message}`
            : `HTTP ${res.status}`;
        setError(msg);
        setResponse(null);
      } else {
        setResponse(json.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setResponse(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminFeatureGate feature="adminPortalEnabled">
      <AdminHeader
        title="AI Advisor"
        description="Internal demo surface for the Phase 41h AI advisor. Asks go through the gateway (HR-1/HR-2/D-2 enforced); answers render with citations next to numbers and the AFSL/TPB/NCCP boundary footer. Until 41h.4+ graduates this to a user-facing dashboard, this page is admin-only."
      />

      <AdminCard>
        <AdminCardHeader title="Ask the advisor" />
        <div className="p-4">
          <TaxAdvisorAskForm
            onSubmit={handleAsk}
            loading={loading}
            examples={EXAMPLE_QUESTIONS}
          />
        </div>
      </AdminCard>

      {error && (
        <AdminCard>
          <AdminCardHeader title="Request failed" />
          <div className="p-4">
            <p className="text-sm text-red-700 dark:text-red-400 font-mono whitespace-pre-wrap">
              {error}
            </p>
            {error.includes('AI_ADVISOR_NOT_CONFIGURED') && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                Set the <code>GEMINI_API_KEY</code> environment variable to
                enable real Gemini calls. Without it, the advisor surface is
                inert.
              </p>
            )}
          </div>
        </AdminCard>
      )}

      {response && (
        <AdminCard>
          <AdminCardHeader title={`Answer · "${truncate(lastQuestion ?? '', 80)}"`} />
          <div className="p-4">
            <TaxAdvisorAnswer response={response} />
          </div>
        </AdminCard>
      )}
    </AdminFeatureGate>
  );
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
