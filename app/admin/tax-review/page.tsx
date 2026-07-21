'use client';

/**
 * MON-094 — non-assessable receipt review (per-row confirmed reclassify).
 *
 * Admin-surface tool (admin design system — §18.2 exempt): lists every
 * existing Income row the canonical detector (`detectNonAssessable`,
 * lib/intake/classifyIntake.ts) flags as a non-assessable receipt (ATO tax
 * refund / internal transfer / loan drawdown) that is still counted in the
 * taxable gross. Confirming a row stores `taxCategory: TAX_EXEMPT` (+ the
 * reason as taxNotes) so the ONE taxability engine counts it at $0.
 * Per-row confirmation only (type RECLASSIFY) — no reclassify-all (§12.11);
 * the server re-derives the detection before writing.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, EmptyState } from '@/components/admin/ui/AdminCard';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { safeAdminFetch } from '@/lib/admin/safeFetch';
import { getFirebaseAuth } from '@/lib/firebase/config';

/** Same explicit-token rule as /admin/intake-duplicates — this page calls a
 *  user-scoped API, outside the AdminLayoutClient `/api/admin/*` interceptor. */
async function authHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const user = getFirebaseAuth()?.currentUser;
  const idToken = user ? await user.getIdToken() : null;
  return { ...(extra ?? {}), ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) };
}

interface Suggestion {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
  isRecurring: boolean | null;
  currentTaxCategory: string | null;
  suggestedTaxCategory: string;
  kind: 'ATO_REFUND' | 'INTERNAL_TRANSFER' | 'LOAN_DRAWDOWN';
  reason: string;
}

const aud = (n: number) =>
  n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

const KIND_LABEL: Record<Suggestion['kind'], string> = {
  ATO_REFUND: 'ATO tax refund',
  INTERNAL_TRANSFER: 'Internal transfer',
  LOAN_DRAWDOWN: 'Loan drawdown',
};

export default function TaxNonAssessableReviewPage() {
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null); // row id awaiting typed confirm
  const [confirmText, setConfirmText] = useState('');
  const [applying, setApplying] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await safeAdminFetch<{ suggestions: Suggestion[] }>(
      '/api/tax/non-assessable-review',
      { headers: await authHeaders() },
    );
    if (result.ok && result.data) setSuggestions(result.data.suggestions);
    else setError(result.error || 'Failed to load the non-assessable review');
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  const runReclassify = async (s: Suggestion) => {
    setApplying(s.id);
    setError(null);
    const result = await safeAdminFetch<{ updated: number }>('/api/tax/non-assessable-review', {
      method: 'POST',
      headers: await authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ids: [s.id], confirm: 'RECLASSIFY' }),
    });
    setApplying(null);
    setConfirming(null);
    setConfirmText('');
    if (result.ok && result.data) {
      setDone((d) => ({
        ...d,
        [s.id]: 'Reclassified non-assessable — this receipt no longer counts in your taxable income.',
      }));
      void fetchPreview();
    } else {
      setError(result.error || 'Reclassification failed — no rows were changed');
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Tax review — non-assessable receipts"
        description="Income rows that look like ATO refunds, internal transfers, or loan drawdowns but are still counted in the taxable gross. Each reclassification needs its own confirmation; only the tax classification changes — the row itself is untouched."
      />

      {error && (
        <AdminCard>
          <p className="text-sm text-red-600">{error}</p>
        </AdminCard>
      )}

      {loading && (
        <AdminCard>
          <p className="text-sm text-muted-foreground">Scanning income rows…</p>
        </AdminCard>
      )}

      {!loading && suggestions && suggestions.length === 0 && (
        <EmptyState
          title="Nothing to review"
          description="No income row matches the non-assessable detector, or every match already carries its exempt classification."
        />
      )}

      {!loading &&
        suggestions?.map((s) => (
          <AdminCard key={s.id}>
            <AdminCardHeader
              title={`${s.name} — ${aud(s.amount)}`}
              description={s.reason}
            />
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <AdminBadge variant="warning">{KIND_LABEL[s.kind]}</AdminBadge>
              <span className="text-muted-foreground">
                {s.isRecurring === false ? 'One-off' : s.frequency} · type {s.type} · currently{' '}
                {s.currentTaxCategory ?? 'counted as taxable (safety default)'}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-3">
              {done[s.id] ? (
                <p className="text-sm text-emerald-600">{done[s.id]}</p>
              ) : confirming === s.id ? (
                <>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="Type RECLASSIFY to confirm"
                    className="rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                  <AdminButton
                    onClick={() => void runReclassify(s)}
                    disabled={confirmText !== 'RECLASSIFY' || applying === s.id}
                  >
                    {applying === s.id ? 'Applying…' : 'Confirm — not taxable income'}
                  </AdminButton>
                  <AdminButton
                    variant="secondary"
                    onClick={() => {
                      setConfirming(null);
                      setConfirmText('');
                    }}
                  >
                    Cancel
                  </AdminButton>
                </>
              ) : (
                <AdminButton onClick={() => setConfirming(s.id)}>Reclassify this receipt…</AdminButton>
              )}
            </div>
          </AdminCard>
        ))}
    </div>
  );
}
