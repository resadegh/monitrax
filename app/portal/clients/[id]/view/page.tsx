/**
 * Phase 32B PR3 — Drill-in canonical client view.
 *
 * Renders the SAME canonical consumer dashboard for the named client,
 * with an adviser overlay docked right (desktop, ≥md) or as a bottom-
 * sheet (mobile). The page itself is a thin orchestrator — it fetches
 * `/api/portal/clients/[id]/snapshot` (which calls
 * `getMasterFinancialSnapshot()` with a viewerContext, applying the
 * service-layer scope filter and writing the per-view audit row) and
 * hands the snapshot + overlay support data to the canonical primitives.
 *
 * Per Phase 32B hard constraints (CLAUDE.md §0 architect lens):
 *   - One canonical engine — viewerContext is a parameter, not a fork
 *   - Scope filter at the service layer, not the UI
 *   - Three-layer consent model preserved (CDR / professional / per-view)
 *   - No `mode: 'professional'` conditional inside `app/dashboard/*`
 */

'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import type { OrganizationType, DataAccessScope } from '@prisma/client';
import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import type { PortalClient, ClientNote, ClientTask } from '@/lib/portal/types';
import { ClientCanonicalDashboard } from '@/components/portal/clients/ClientCanonicalDashboard';
import { AdviserOverlay } from '@/components/portal/clients/AdviserOverlay';

interface SnapshotResponse {
  success: boolean;
  data?: {
    snapshot: MasterFinancialSnapshot;
    organizationClientId: string;
    client: PortalClient | null;
    notes: ClientNote[];
    tasks: ClientTask[];
    lastReviewedAt: string | null;
    organization: { name: string; profession: OrganizationType } | null;
  };
  error?: { code: string; message: string };
}

export default function ClientDrillInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<SnapshotResponse['data'] | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
        const res = await fetch(`/api/portal/clients/${id}/snapshot`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
          credentials: 'include',
        });
        const json = (await res.json()) as SnapshotResponse;
        if (cancelled) return;
        if (!json.success || !json.data) {
          setError(json.error ?? { code: 'UNKNOWN', message: 'Failed to load client view' });
        } else {
          setData(json.data);
        }
      } catch (err) {
        if (!cancelled) {
          setError({
            code: 'NETWORK',
            message: err instanceof Error ? err.message : 'Failed to load',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading client view…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link href="/portal/clients" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to clients
        </Link>
        <div className="mt-6 rounded-2xl bg-rose-50 border border-rose-200 p-6">
          <p className="font-semibold text-rose-900">Cannot view this client</p>
          <p className="text-sm text-rose-700 mt-2">{error.message}</p>
          {error.code === 'CONSENT_NOT_GRANTED' && (
            <p className="text-xs text-rose-600 mt-3">
              Send a consent request from the client list to begin reviewing their data.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!data || !data.client || !data.organization) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-slate-500">No data available.</p>
      </div>
    );
  }

  const appliedScopes: DataAccessScope[] = data.snapshot.viewer?.accessScopes ?? data.client.accessScopes;
  const appliedScopeFilter = data.snapshot.viewer?.appliedScopeFilter ?? false;

  return (
    <div className="px-4 md:px-8 py-6 md:py-10 pb-24 md:pb-10 max-w-7xl mx-auto">
      {/* Sticky page header — keeps the back link + client identity visible while scrolling */}
      <header className="flex items-start justify-between mb-6 pb-4 border-b border-slate-200">
        <div>
          <Link
            href="/portal/clients"
            className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1"
          >
            ← Clients
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">
            {data.client.user?.name ?? 'Unknown client'}
          </h1>
          <p className="text-sm text-slate-500">{data.client.user?.email}</p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-slate-500">{data.organization.name}</p>
          <p className="text-xs text-slate-400 mt-1">
            Calculated {new Date(data.snapshot.calculatedAt).toLocaleString('en-AU', {
              hour: 'numeric',
              minute: '2-digit',
              day: 'numeric',
              month: 'short',
            })}
          </p>
        </div>
      </header>

      <div className="md:flex md:gap-8 md:items-start">
        <main className="flex-1 min-w-0">
          <ClientCanonicalDashboard snapshot={data.snapshot} appliedScopes={appliedScopes} />
        </main>
        <AdviserOverlay
          client={data.client}
          notes={data.notes}
          tasks={data.tasks}
          appliedScopes={appliedScopes}
          appliedScopeFilter={appliedScopeFilter}
          profession={data.organization.profession}
          lastReviewedAt={data.lastReviewedAt}
        />
      </div>
    </div>
  );
}
