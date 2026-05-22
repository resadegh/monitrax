'use client';

/**
 * /dashboard/entities/accountant-review — Phase 44 Part 1c (Q4)
 *
 * The accountant-review share-pass (PHASE_44_ENTITY_GRAPH.md §9). A
 * clean, print-friendly report of the user's whole entity structure —
 * every entity and every relationship, with its §6.1 structural state
 * and its accountant-verified status.
 *
 * The flow §9 describes: the user opens this report, prints it (browser
 * → Save as PDF) and hands it to their accountant; the accountant
 * confirms the structure is recorded correctly; the user marks the
 * confirmed entities + relationships verified here — turning
 * `accountantVerified` into a professional sign-off.
 *
 * Deliberately NOT a public token-shared link: the entity structure is
 * CDR-adjacent and a public unauthenticated surface would broaden the
 * data-egress surface (security lens). This is the SharePackage
 * *pattern* — an export the owner controls — not the model (§9).
 *
 * Standalone page (no dashboard chrome) so the browser print output is
 * clean. Action controls carry `print:hidden`.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Printer,
  ShieldCheck,
  CheckCircle2,
  Circle,
  AlertTriangle,
  XCircle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import type { StructuralState } from '@prisma/client';
import { useAuth } from '@/lib/context/AuthContext';
import {
  fetchEntityGraph,
  verifyEntityRequest,
  verifyRelationshipRequest,
  type CanvasGraph,
} from '@/components/entities/canvas/entityGraphClient';
import { entityTypeMeta, relationshipTypeMeta } from '@/components/entities/canvas/graphMeta';
import { ROLE_LABELS } from '@/components/entities/types';
import { classifyGraph } from '@/lib/entity-graph/validityMatrix';

const STATE_META: Record<StructuralState, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  VALID: { label: 'Valid', icon: CheckCircle2, cls: 'text-emerald-600' },
  NON_COMPLIANT_BUT_RECORDED: {
    label: 'Recorded — flagged',
    icon: AlertTriangle,
    cls: 'text-amber-600',
  },
  IMPOSSIBLE_SYSTEM_ERROR: { label: 'Error', icon: XCircle, cls: 'text-rose-600' },
};

function fmtDate(d: Date | null): string {
  if (!d) return 'current';
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AccountantReviewPage() {
  const { token, user } = useAuth();
  const [graph, setGraph] = useState<CanvasGraph | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setGraph(await fetchEntityGraph(token));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your structure.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    reload();
  }, [reload]);

  const report = useMemo(
    () => (graph ? classifyGraph(graph, new Date()) : null),
    [graph],
  );

  // Active relationships only — the review confirms the current structure.
  const activeEdges = useMemo(
    () => (graph ? graph.edges.filter((e) => e.effectiveTo === null) : []),
    [graph],
  );

  const verifiedStats = useMemo(() => {
    if (!graph) return { done: 0, total: 0 };
    const entitiesDone = graph.nodes.filter((n) => n.accountantVerified).length;
    const edgesDone = activeEdges.filter((e) => e.accountantVerified).length;
    return {
      done: entitiesDone + edgesDone,
      total: graph.nodes.length + activeEdges.length,
    };
  }, [graph, activeEdges]);

  const toggleEntity = async (entityId: string, next: boolean) => {
    if (!token || !graph) return;
    setBusyId(entityId);
    setError(null);
    try {
      await verifyEntityRequest(token, entityId, next);
      setGraph({
        ...graph,
        nodes: graph.nodes.map((n) =>
          n.id === entityId ? { ...n, accountantVerified: next } : n,
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update verification.');
    } finally {
      setBusyId(null);
    }
  };

  const toggleEdge = async (edgeId: string, next: boolean) => {
    if (!token || !graph) return;
    setBusyId(edgeId);
    setError(null);
    try {
      await verifyRelationshipRequest(token, edgeId, next);
      setGraph({
        ...graph,
        edges: graph.edges.map((e) =>
          e.id === edgeId ? { ...e, accountantVerified: next } : e,
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update verification.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="text-sm text-slate-600">Please sign in to view your structure report.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 print:bg-white print:py-0">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Action bar — hidden in print */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/dashboard/entities"
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to my structure
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            <Printer className="h-4 w-4" />
            Print / Save as PDF
          </button>
        </div>

        {/* Report header */}
        <header className="space-y-1 border-b border-slate-200 pb-4">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
            Entity structure report
          </p>
          <h1 className="text-2xl font-semibold">Accountant review</h1>
          <p className="max-w-2xl text-sm text-slate-600">
            A complete record of how your wealth is structured. Hand this to your accountant to
            confirm every entity and relationship is recorded correctly — then mark the confirmed
            items as verified. Prepared for {user?.name || user?.email || 'the account holder'} on{' '}
            {new Date().toLocaleDateString('en-AU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
            .
          </p>
        </header>

        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 print:hidden">
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Verification progress */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Accountant verification</span>
            <span className="text-sm text-slate-600">
              {verifiedStats.done} of {verifiedStats.total} items verified
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{
                width:
                  verifiedStats.total > 0
                    ? `${(verifiedStats.done / verifiedStats.total) * 100}%`
                    : '0%',
              }}
            />
          </div>
        </div>

        {/* Entities */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Entities ({graph?.nodes.length ?? 0})
          </h2>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-medium">Entity</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Structure</th>
                  <th className="px-3 py-2 font-medium">Verified</th>
                </tr>
              </thead>
              <tbody>
                {(graph?.nodes ?? []).map((n) => {
                  const state = report?.entities.get(n.id)?.state ?? n.structuralState;
                  const stateMeta = STATE_META[state] ?? STATE_META.VALID;
                  const StateIcon = stateMeta.icon;
                  return (
                    <tr key={n.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 font-medium">{n.name}</td>
                      <td className="px-3 py-2 text-slate-600">{entityTypeMeta(n.type).label}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {ROLE_LABELS[n.role] ?? n.role}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 ${stateMeta.cls}`}>
                          <StateIcon className="h-3.5 w-3.5" />
                          {stateMeta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <VerifyCell
                          verified={n.accountantVerified}
                          busy={busyId === n.id}
                          onToggle={() => toggleEntity(n.id, !n.accountantVerified)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Relationships */}
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Relationships ({activeEdges.length})
          </h2>
          {activeEdges.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-white px-3 py-4 text-center text-xs italic text-slate-500">
              No current relationships recorded.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-3 py-2 font-medium">Relationship</th>
                    <th className="px-3 py-2 font-medium">From → To</th>
                    <th className="px-3 py-2 font-medium">Since</th>
                    <th className="px-3 py-2 font-medium">Verified</th>
                  </tr>
                </thead>
                <tbody>
                  {activeEdges.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2 font-medium">{relationshipTypeMeta(e.type).label}</td>
                      <td className="px-3 py-2 text-slate-600">
                        {e.fromEntityName} → {e.toEntityName}
                      </td>
                      <td className="px-3 py-2 text-slate-600">{fmtDate(e.effectiveFrom)}</td>
                      <td className="px-3 py-2">
                        <VerifyCell
                          verified={e.accountantVerified}
                          busy={busyId === e.id}
                          onToggle={() => toggleEdge(e.id, !e.accountantVerified)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Accountant sign-off block — useful on the printed copy */}
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Accountant sign-off
          </h2>
          <div className="grid gap-x-8 gap-y-5 text-xs text-slate-600 sm:grid-cols-2">
            <div>
              <div className="h-7 border-b border-slate-300" />
              <p className="mt-1">Accountant name</p>
            </div>
            <div>
              <div className="h-7 border-b border-slate-300" />
              <p className="mt-1">Firm</p>
            </div>
            <div>
              <div className="h-7 border-b border-slate-300" />
              <p className="mt-1">Signature</p>
            </div>
            <div>
              <div className="h-7 border-b border-slate-300" />
              <p className="mt-1">Date reviewed</p>
            </div>
          </div>
          <p className="mt-4 text-[11px] italic text-slate-400">
            Monitrax records the structure you describe — it is a digital twin, not a determination
            of tax or legal position. This report is for your accountant&rsquo;s review.
          </p>
        </section>
      </div>
    </div>
  );
}

// =============================================================================
// VERIFY CELL
// =============================================================================

function VerifyCell({
  verified,
  busy,
  onToggle,
}: {
  verified: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      {/* Always-visible status — prints. */}
      <span
        className={`inline-flex items-center gap-1 text-xs ${
          verified ? 'text-emerald-600' : 'text-slate-400'
        }`}
      >
        {verified ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
        {verified ? 'Verified' : 'Not verified'}
      </span>
      {/* Toggle — hidden in print. */}
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 print:hidden"
      >
        {busy ? '…' : verified ? 'Unverify' : 'Mark verified'}
      </button>
    </div>
  );
}
