'use client';

/**
 * EntityBreakdownWidget — Phase 47 Stage C2 (Entity Ownership Fabric).
 *
 * The dashboard's entity lens, v1: a compact glass card answering
 * "what does each entity own and earn?" from the canonical master
 * snapshot's ADDITIVE `byEntity` view (`lib/calculations/entityBreakdown.ts`
 * — same engines, same rows as the flat household numbers above it).
 *
 * Scope decision (delegated, 2026-06-10): v1 is a BREAKDOWN WIDGET, not
 * a global dashboard filter — threading an entity filter through every
 * widget before Stage D's per-entity tax numbers exist would be chrome
 * without payoff. Re-evaluate the full lens after Stage D.
 *
 * Progressive disclosure: renders nothing below 2 real entities (the
 * single-entity majority sees zero added chrome). Pairs with the
 * Wealth Universe widget in the diagnostic grid (the documented empty
 * right column). §18.7.2 polished-tile vocabulary; sky→indigo
 * structure sub-palette; emerald strictly for positive cashflow.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Landmark } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { formatCurrency } from '@/lib/utils/formatters';

interface EntityPositionRow {
  entityId: string;
  entityName: string;
  entityType: string;
  netWorth: number;
  assets: number;
  liabilities: number;
  monthlyCashflow: number;
  counts: { holdings: number };
}

const TYPE_LABEL: Record<string, string> = {
  PERSONAL_NAME: 'You',
  INDIVIDUAL: 'Person',
  COMPANY: 'Company',
  DISCRETIONARY_TRUST: 'Trust',
  UNIT_TRUST: 'Unit trust',
  SMSF: 'SMSF',
  PARTNERSHIP: 'Partnership',
  SOLE_TRADER: 'Sole trader',
};

export default function EntityBreakdownWidget() {
  const { token } = useAuth();
  const [rows, setRows] = useState<EntityPositionRow[] | null>(null);

  useEffect(() => {
    if (!token) return;
    fetch('/api/master-snapshot', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(result => setRows(result?.data?.byEntity ?? null))
      .catch(() => setRows(null));
  }, [token]);

  const realRows = (rows ?? []).filter(r => r.entityId !== '__unattributed__');
  // Progressive disclosure — the entity lens earns its place only when
  // there IS a structure to break down.
  if (realRows.length < 2) return null;

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-foreground/10 bg-card/70 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_36px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      {/* 3px sub-palette top-accent strip (§18.7.2) */}
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-400 to-indigo-500" />

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[12px] bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-[0_4px_12px_rgba(56,189,248,0.35)]">
            <Landmark size={16} strokeWidth={1.8} />
          </span>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-transparent bg-clip-text bg-gradient-to-r from-sky-600 to-indigo-600">
              My structure
            </div>
            <div className="text-sm font-semibold">By entity</div>
          </div>
        </div>
        <Link
          href="/dashboard/entities"
          className="text-[11px] font-medium text-sky-600 hover:underline"
        >
          Open universe →
        </Link>
      </div>

      <div className="space-y-2">
        {realRows.map(row => (
          <div
            key={row.entityId}
            className="flex items-center justify-between gap-3 rounded-[12px] border border-foreground/[0.07] bg-background/50 px-3 py-2.5"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{row.entityName}</div>
              <div className="text-[11px] text-muted-foreground">
                {TYPE_LABEL[row.entityType] ?? row.entityType} · {row.counts.holdings}{' '}
                {row.counts.holdings === 1 ? 'holding' : 'holdings'}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-semibold tabular-nums">
                {formatCurrency(row.netWorth)}
              </div>
              {row.monthlyCashflow !== 0 && (
                <div
                  className={`text-[11px] tabular-nums ${
                    row.monthlyCashflow > 0 ? 'text-emerald-600' : 'text-muted-foreground'
                  }`}
                >
                  {row.monthlyCashflow > 0 ? '+' : ''}
                  {formatCurrency(row.monthlyCashflow)}/mo
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* L2-1 (Option B): "Entity Value" is computed by LEGAL TITLE (binary
          ownerEntityId) — a factual basis. Ownership-share + beneficial-owner
          effects are applied in the per-entity Tax view, so this value and the
          tax position can differ for a co-owned asset. The note names the basis
          and points to Tax; it does not assert a beneficial-ownership conclusion
          (AFSL boundary). */}
      <div className="mt-3 text-[10px] leading-relaxed text-muted-foreground/70">
        Values are by <span className="font-medium">legal title</span> — joint and shared
        assets sit with the recorded legal owner. Ownership-share and beneficial-owner
        effects are applied in each entity&rsquo;s <span className="font-medium">Tax</span> view,
        so a co-owned asset&rsquo;s value here can differ from its tax position.
      </div>
    </div>
  );
}
