'use client';

/**
 * Mechanism A PART 2 — duplicate-source preview + per-group confirmed merge
 * (MON-074/076; docs/architecture/CALC_SSOT_WALL.md "Mechanism A").
 *
 * Admin-surface tool (admin design system — §18.2 exempt): shows every
 * income/expense duplicate group under the Part-1 signature policy with the
 * proposed survivor, the rows that would be deleted, and the net effect on
 * the declared annual gross. Each group merges ONLY via its own confirm
 * step (type MERGE) — there is deliberately NO merge-all (§12.11).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader, EmptyState } from '@/components/admin/ui/AdminCard';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { AdminBadge } from '@/components/admin/ui/AdminBadge';
import { safeAdminFetch } from '@/lib/admin/safeFetch';

interface PreviewRow {
  id: string;
  name: string;
  type?: string | null;
  amount: number;
  frequency: string;
  isRecurring?: boolean | null;
  propertyId?: string | null;
  loanId?: string | null;
  assetId?: string | null;
  investmentAccountId?: string | null;
  createdAt: string;
}

interface PreviewGroup {
  groupId: string;
  kind: 'income' | 'expense';
  type: string;
  survivorId: string;
  rows: PreviewRow[];
  mergeIds: string[];
  annualDeclaredEffect: number;
  warnings: string[];
}

const aud = (n: number) =>
  n.toLocaleString('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

export default function IntakeDuplicatesPage() {
  const [groups, setGroups] = useState<PreviewGroup[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null); // groupId awaiting typed confirm
  const [confirmText, setConfirmText] = useState('');
  const [merging, setMerging] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await safeAdminFetch<{ groups: PreviewGroup[] }>('/api/intake/duplicates');
    if (result.ok && result.data) setGroups(result.data.groups);
    else setError(result.error || 'Failed to load the duplicate preview');
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchPreview();
  }, [fetchPreview]);

  const runMerge = async (g: PreviewGroup) => {
    setMerging(g.groupId);
    setError(null);
    const result = await safeAdminFetch<{ deleted: number; droppedDisbursementRule: boolean }>(
      '/api/intake/duplicates',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: g.kind,
          survivorId: g.survivorId,
          mergeIds: g.mergeIds,
          confirm: 'MERGE',
        }),
      },
    );
    setMerging(null);
    setConfirming(null);
    setConfirmText('');
    if (result.ok && result.data) {
      setDone((d) => ({
        ...d,
        [g.groupId]: `Merged — ${result.data!.deleted} duplicate row(s) removed${result.data!.droppedDisbursementRule ? ' (a sibling disbursement rule was dropped — survivor already had one)' : ''}`,
      }));
      void fetchPreview();
    } else {
      setError(result.error || 'Merge failed — no rows were changed');
    }
  };

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Intake duplicates"
        description="Mechanism A Part 2 — same-source duplicate groups under the Part-1 signature policy. Each merge needs its own confirmation; there is no merge-all."
      />

      {error && (
        <AdminCard>
          <p className="text-sm text-red-600">{error}</p>
        </AdminCard>
      )}

      {loading && (
        <AdminCard>
          <p className="text-sm text-muted-foreground">Scanning income and expense rows…</p>
        </AdminCard>
      )}

      {!loading && groups && groups.length === 0 && (
        <EmptyState
          title="No duplicate groups"
          description="Every income and expense source resolves to one canonical row under the signature policy."
        />
      )}

      {!loading &&
        groups?.map((g) => (
          <AdminCard key={g.groupId}>
            <AdminCardHeader
              title={`${g.kind === 'income' ? 'Income' : 'Expense'} · ${g.type} — ${g.rows[0]?.name ?? ''}`}
              description={`${g.rows.length} rows → 1 canonical row · declared annual effect ${aud(g.annualDeclaredEffect)}`}
            />
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-4">Row</th>
                    <th className="py-1 pr-4">Amount</th>
                    <th className="py-1 pr-4">Cadence</th>
                    <th className="py-1 pr-4">Scope</th>
                    <th className="py-1 pr-4">Created</th>
                    <th className="py-1">Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => {
                    const survivor = r.id === g.survivorId;
                    const scope = r.propertyId ?? r.loanId ?? r.investmentAccountId ?? r.assetId ?? null;
                    return (
                      <tr key={r.id} className="border-t border-border/50">
                        <td className="py-1.5 pr-4 font-medium">{r.name}</td>
                        <td className="py-1.5 pr-4 tabular-nums">{aud(r.amount)}</td>
                        <td className="py-1.5 pr-4">{r.isRecurring === false ? 'One-off' : r.frequency}</td>
                        <td className="py-1.5 pr-4">{scope ? 'Scoped' : 'General'}</td>
                        <td className="py-1.5 pr-4">{new Date(r.createdAt).toLocaleDateString('en-AU')}</td>
                        <td className="py-1.5">
                          {survivor ? (
                            <AdminBadge variant="success">Kept (canonical)</AdminBadge>
                          ) : (
                            <AdminBadge variant="warning">Deleted — links repointed</AdminBadge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {g.warnings.length > 0 && (
              <ul className="mt-2 text-xs text-amber-600">
                {g.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex items-center gap-3">
              {done[g.groupId] ? (
                <p className="text-sm text-emerald-600">{done[g.groupId]}</p>
              ) : confirming === g.groupId ? (
                <>
                  <input
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder='Type MERGE to confirm'
                    className="rounded border border-border bg-background px-2 py-1 text-sm"
                  />
                  <AdminButton
                    onClick={() => void runMerge(g)}
                    disabled={confirmText !== 'MERGE' || merging === g.groupId}
                  >
                    {merging === g.groupId ? 'Merging…' : 'Confirm merge'}
                  </AdminButton>
                  <AdminButton variant="secondary" onClick={() => { setConfirming(null); setConfirmText(''); }}>
                    Cancel
                  </AdminButton>
                </>
              ) : (
                <AdminButton onClick={() => setConfirming(g.groupId)}>
                  Merge this group…
                </AdminButton>
              )}
            </div>
          </AdminCard>
        ))}
    </div>
  );
}
