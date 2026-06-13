/**
 * TrustDistributionsSection — Stage D capture: the trustee's yearly
 * distribution resolution ("who is presently entitled to what share").
 *
 * Reza spot-check (2026-06-13): *"I can't see any selection to nominate
 * myself and Newsha as beneficiary with the ownership share percentage."*
 * The financial-adviser answer: in a DISCRETIONARY family trust,
 * beneficiaries hold NO fixed percentage — that is the defining feature.
 * Eligibility lives on the BENEFICIARY_OF edges (the Roles & People
 * rows); the percentages live on the per-FY `DistributionResolution`
 * the trustee passes before 30 June — and THAT is what the tax engine
 * consumes (Div 6, Bamford proportionate shares). This section is the
 * missing capture surface for those resolutions; the engine + API
 * (`/api/tax/distribution-resolutions`) shipped in Phase 44 Part 2a.
 *
 * - Lists the trust's resolutions (FY, status pill, per-beneficiary
 *   shares, net income). Drafts can be confirmed in place.
 * - "Record this year's split": per-beneficiary percentage inputs
 *   prefilled from the trust's active BENEFICIARY_OF edges, live
 *   100%-sum check, optional net-income estimate, and a "signed before
 *   30 June" toggle (CONFIRMED resolutions drive tax numbers; drafts
 *   don't — honest by construction).
 *
 * Surface SoT: Stitch screen `29d8f3b2ac3f43adae74e673bfde4995`
 * artefact `.stitch/designs/phase47-f2/trust-distributions-mobile-dark.{html,png}`.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, X, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { extractApiError } from '@/components/entities/canvas/entityGraphClient';

interface AllocationRow {
  beneficiaryEntityId: string;
  beneficiaryName?: string;
  presentlyEntitledShare: number;
}

interface ResolutionRow {
  id: string;
  financialYear: string;
  status: 'DRAFT' | 'CONFIRMED';
  trustNetIncome: number;
  allocations: AllocationRow[];
}

/** Current AU financial year as "2025-26" (FY starts 1 July). */
function currentFyLabel(now = new Date()): string {
  const y = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
}

export default function TrustDistributionsSection({
  trustEntityId,
  beneficiaries,
}: {
  trustEntityId: string;
  /** The trust's ACTIVE beneficiaries (id + name) from the graph. */
  beneficiaries: ReadonlyArray<{ id: string; name: string }>;
}) {
  const { token } = useAuth();
  const [resolutions, setResolutions] = useState<ResolutionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(
        `/api/tax/distribution-resolutions?trustEntityId=${encodeURIComponent(trustEntityId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractApiError(json, res.status, 'Failed to load distributions.'));
      setResolutions((json as { data?: ResolutionRow[] }).data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load distributions.');
      setResolutions([]);
    }
  }, [token, trustEntityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirm(id: string) {
    if (!token) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/tax/distribution-resolutions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: 'CONFIRMED' }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(extractApiError(json, res.status, 'Failed to confirm.'));
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to confirm.');
    } finally {
      setBusyId(null);
    }
  }

  const nameById = useMemo(
    () => new Map(beneficiaries.map(b => [b.id, b.name])),
    [beneficiaries],
  );

  return (
    <div>
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.16em] text-white/40">
        Distributions
      </div>
      {error && (
        <div className="mb-2 flex items-start gap-2 rounded-xl p-3 text-[11px]" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <AlertTriangle size={13} color="#FBBF24" strokeWidth={1.5} />
          <span className="text-amber-200/80">{error}</span>
        </div>
      )}
      <div className="space-y-1.5">
        {resolutions === null && (
          <div className="text-[11px] text-white/40">Loading…</div>
        )}
        {resolutions?.map(r => (
          <div
            key={r.id}
            className="rounded-xl p-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-medium text-white/90">FY {r.financialYear}</span>
              {r.status === 'CONFIRMED' ? (
                <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(52,211,153,0.1)', color: '#6EE7B7', border: '1px solid rgba(52,211,153,0.3)' }}>
                  Confirmed
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void confirm(r.id)}
                  disabled={busyId === r.id}
                  className="rounded-full px-2 py-0.5 text-[10px] font-medium text-amber-200 transition hover:bg-amber-400/10 disabled:opacity-50"
                  style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}
                  title="Drafts don't drive tax numbers — confirm once the trustee has signed"
                >
                  {busyId === r.id ? 'Confirming…' : 'Draft — confirm'}
                </button>
              )}
            </div>
            <div className="mt-1 text-[11px] text-white/60">
              {r.allocations
                .map(a => `${nameById.get(a.beneficiaryEntityId) ?? a.beneficiaryName ?? 'Beneficiary'} ${(a.presentlyEntitledShare * 100).toFixed(0)}%`)
                .join(' · ')}
            </div>
            {r.trustNetIncome > 0 && (
              <div className="mt-0.5 text-[11px] tabular-nums text-white/45">
                ${r.trustNetIncome.toLocaleString()} net income
              </div>
            )}
          </div>
        ))}
        {beneficiaries.length > 0 ? (
          <button
            type="button"
            onClick={() => setRecordOpen(true)}
            className="flex w-full items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] text-white/45 transition hover:text-white/70"
            style={{ border: '1px dashed rgba(255,255,255,0.15)' }}
          >
            <Plus size={12} strokeWidth={1.5} />
            Record this year&rsquo;s split
          </button>
        ) : (
          <div className="text-[11px] text-white/40">
            Add beneficiaries above first — then record who gets what share each year.
          </div>
        )}
      </div>

      {recordOpen && (
        <RecordSplitDialog
          trustEntityId={trustEntityId}
          beneficiaries={beneficiaries}
          onClose={() => setRecordOpen(false)}
          onSaved={() => {
            setRecordOpen(false);
            void load();
          }}
        />
      )}
    </div>
  );
}

function RecordSplitDialog({
  trustEntityId,
  beneficiaries,
  onClose,
  onSaved,
}: {
  trustEntityId: string;
  beneficiaries: ReadonlyArray<{ id: string; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { token } = useAuth();
  const [fy, setFy] = useState(currentFyLabel());
  const [netIncome, setNetIncome] = useState('');
  // Default to an equal split — the most common starting point; the
  // user adjusts from there (psychology lens: edit beats blank).
  const even = beneficiaries.length > 0 ? Math.floor(100 / beneficiaries.length) : 0;
  const [shares, setShares] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      beneficiaries.map((b, i) => [
        b.id,
        String(i === 0 ? 100 - even * (beneficiaries.length - 1) : even),
      ]),
    ),
  );
  const [signed, setSigned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = beneficiaries.reduce((sum, b) => sum + (Number(shares[b.id]) || 0), 0);
  const sums = Math.abs(total - 100) < 0.01;
  const canSave = !saving && sums && fy.match(/^\d{4}-\d{2}$/) !== null;

  async function save() {
    if (!token || !canSave) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/tax/distribution-resolutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          trustEntityId,
          financialYear: fy,
          trustNetIncome: Number(netIncome) || 0,
          resolutionDate: signed ? new Date().toISOString() : null,
          allocations: beneficiaries
            .filter(b => (Number(shares[b.id]) || 0) > 0)
            .map(b => ({
              beneficiaryEntityId: b.id,
              presentlyEntitledShare: (Number(shares[b.id]) || 0) / 100,
            })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractApiError(json, res.status, 'Failed to record the split.'));
      // "Signed before 30 June" → confirm immediately so the engine
      // consumes it (drafts never drive numbers).
      if (signed) {
        const created = (json as { data?: { resolutionId?: string } }).data;
        if (created?.resolutionId) {
          await fetch(`/api/tax/distribution-resolutions/${created.resolutionId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ status: 'CONFIRMED' }),
          });
        }
      }
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to record the split.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative z-10 max-h-[85vh] w-full max-w-md space-y-4 overflow-y-auto rounded-2xl p-5"
        style={{
          background: 'rgba(13, 18, 32, 0.97)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[15px] font-semibold text-white">Record this year&rsquo;s split</div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-white/50">
              The trustee&rsquo;s distribution resolution — who is presently
              entitled to what share.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-white/60 hover:bg-white/10">
            <X size={13} strokeWidth={1.5} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="mb-1 text-[11px] font-medium text-white/60">Financial year</div>
            <input
              value={fy}
              onChange={e => setFy(e.target.value)}
              placeholder="2025-26"
              className="w-full rounded-lg bg-white/5 px-3 py-2 text-[13px] text-white outline-none"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
            />
          </div>
          <div>
            <div className="mb-1 text-[11px] font-medium text-white/60">Net income (estimate is fine)</div>
            <input
              value={netIncome}
              onChange={e => setNetIncome(e.target.value)}
              placeholder="$"
              inputMode="decimal"
              className="w-full rounded-lg bg-white/5 px-3 py-2 text-[13px] tabular-nums text-white outline-none"
              style={{ border: '1px solid rgba(255,255,255,0.12)' }}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          {beneficiaries.map(b => (
            <div key={b.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-[12px] text-white/85">{b.name}</span>
              <span className="flex flex-shrink-0 items-center gap-1">
                <input
                  value={shares[b.id] ?? ''}
                  onChange={e => setShares({ ...shares, [b.id]: e.target.value })}
                  inputMode="decimal"
                  className="w-16 rounded-lg bg-white/5 px-2 py-1.5 text-right text-[13px] tabular-nums text-white outline-none"
                  style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                />
                <span className="text-[12px] text-white/50">%</span>
              </span>
            </div>
          ))}
          <div className={`flex items-center gap-1.5 text-[11px] ${sums ? 'text-emerald-300/90' : 'text-amber-300/90'}`}>
            {sums ? <CheckCircle2 size={12} strokeWidth={1.5} /> : <AlertTriangle size={12} strokeWidth={1.5} />}
            Total: {total.toFixed(0)}%{!sums && ' — shares must add to 100%'}
          </div>
        </div>

        <label className="flex items-start justify-between gap-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <span className="min-w-0">
            <span className="block text-[12px] font-medium text-white/85">Resolution signed before 30 June</span>
            <span className="mt-0.5 block text-[11px] text-white/50">
              Confirmed resolutions drive your tax numbers; drafts don&rsquo;t.
            </span>
          </span>
          <input
            type="checkbox"
            checked={signed}
            onChange={e => setSigned(e.target.checked)}
            className="mt-1 h-4 w-4 flex-shrink-0 accent-emerald-500"
          />
        </label>

        {error && <div className="text-[11px] text-rose-300/90">{error}</div>}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-[12px] text-white/60 transition hover:text-white/90">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!canSave}
            className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-medium text-white transition disabled:opacity-40"
            style={{ background: '#059669' }}
          >
            {saving && <Loader2 size={12} className="animate-spin" />}
            Record
          </button>
        </div>
      </div>
    </div>
  );
}
