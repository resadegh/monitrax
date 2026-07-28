'use client';

/**
 * MON-103 (capture Stage 3) — the Div 152 small-business CGT concession
 * self-assessment card on /dashboard/entities/[id]/tax. MON-105: rendered
 * for every Div 152-eligible entity type (its OWN grammar in
 * lib/tax-engine/eligibility.ts — entity-type-agnostic per s152-10, never
 * the PSI list).
 *
 * Anatomy (ITAA 1997 Div 152): the disposal (gain after any Div 115
 * discount + months held + active-asset tri-state) → the size tests (MNAV
 * $6M s152-15 / aggregated turnover $2M s152-20 — either passing satisfies
 * the basic conditions) → retirement & elections (retirement/incapacity
 * tri-state s152-105; the three elections with the ENGINE's own defaults
 * pre-selected: 50% reduction ON s152-205, retirement exemption OFF
 * s152-305 with the conditional lifetime-used field, rollover OFF s152-410)
 * → the step-ladder result strip. The card WRITES facts via
 * PUT /api/tax/entity/[id]/div152-assessment and READS the outcome from the
 * parent's entity-position response (`crossCutting.div152ByEntity` — the
 * ONE wired overlay, §12.2.1; this component performs NO tax arithmetic).
 *
 * Safe defaults (Reza standing GO 2026-07-27): the four numerics AND the
 * two eligibility answers are all-or-nothing — for isActiveAsset /
 * isRetirementOrIncapacity NEITHER default is safe (false denies real
 * concessions on display; true fabricates them), so "Not sure" keeps the
 * overlay inert. Electing the retirement exemption REQUIRES the
 * lifetime-used figure — we never assume $0 of the $500k cap.
 *
 * Stitch design: project 1859462351962811110, screen
 * 8ff4092f751544688de33f8574c1232b (§18.8 9.2/10 — v1 8.3 → v3: emerald
 * control/CTA/panel leakage replaced with the indigo identity; two DOM ops
 * Stitch reported but did not persist to the export are hand-applied in the
 * committed artefact, disclosed in the changelog).
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Info, Loader2, Store } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import {
  FIFTEEN_YEAR_MONTHS,
  MNAV_THRESHOLD,
  RETIREMENT_LIFETIME_CAP,
  TURNOVER_THRESHOLD,
} from '@/lib/tax-engine/divisions/div152SmallBusinessConcessions';

export interface Div152OverlayResult {
  basicConditionsMet: boolean;
  fifteenYearExemptionApplied: boolean;
  assessableGain: number;
  /** MON-110 — stated by the engine; the card renders it, never re-derives it. */
  gainBeforeConcessions: number;
  steps: Array<{ concession: string; reduction: number; runningGain: number; citation: string }>;
}

interface SavedAssessment {
  gainAfterDiv115: number | null;
  maxNetAssetValue: number | null;
  aggregatedTurnover: number | null;
  monthsHeld: number | null;
  isActiveAsset: boolean | null;
  isRetirementOrIncapacity: boolean | null;
  electActiveAssetReduction: boolean | null;
  electRetirementExemption: boolean | null;
  electRollover: boolean | null;
  retirementExemptionUsedToDate: number | null;
}

function TriState({
  value,
  onChange,
}: {
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const opts: Array<[boolean | null, string]> = [
    [true, 'Yes'],
    [false, 'No'],
    [null, 'Not sure'],
  ];
  return (
    <span className="flex flex-shrink-0 overflow-hidden rounded-full border border-foreground/10 bg-background/50">
      {opts.map(([v, label]) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(v)}
          className={`px-3 py-1.5 text-xs font-medium transition ${
            value === v
              ? v === null
                ? 'bg-foreground/10 text-foreground'
                : 'bg-indigo-500 text-white'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </span>
  );
}

/** Two-state Yes/No election pill — elections carry the engine's own default, so no "Not sure". */
function Election({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const opts: Array<[boolean, string]> = [
    [true, 'Yes'],
    [false, 'No'],
  ];
  return (
    <span className="flex flex-shrink-0 overflow-hidden rounded-full border border-foreground/10 bg-background/50">
      {opts.map(([v, label]) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(v)}
          className={`px-3 py-1.5 text-xs font-medium transition ${
            value === v ? 'bg-indigo-500 text-white' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </span>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </div>
  );
}

export function Div152AssessmentCard({
  entityId,
  fy,
  authHeaders,
  div152Result,
  onSaved,
}: {
  entityId: string;
  fy: string;
  authHeaders: () => Record<string, string>;
  /** The LIVE overlay result from the entity-position response (crossCutting.div152ByEntity[entityId]) — never re-derived here. */
  div152Result: Div152OverlayResult | null;
  /** Parent reloads the position so the result strip reflects the saved facts. */
  onSaved: () => void;
}) {
  const [gain, setGain] = useState('');
  const [months, setMonths] = useState('');
  const [mnav, setMnav] = useState('');
  const [turnover, setTurnover] = useState('');
  const [activeAsset, setActiveAsset] = useState<boolean | null>(null);
  const [retirement, setRetirement] = useState<boolean | null>(null);
  // Elections pre-select the ENGINE's own defaults (s152 contract).
  const [electReduction, setElectReduction] = useState(true);
  const [electExemption, setElectExemption] = useState(false);
  const [electRollover, setElectRollover] = useState(false);
  const [lifetimeUsed, setLifetimeUsed] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tax/entity/${entityId}/div152-assessment?fy=${fy}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        const a: SavedAssessment | null = json?.data?.assessment ?? null;
        if (a) {
          setGain(a.gainAfterDiv115 === null ? '' : String(a.gainAfterDiv115));
          setMonths(a.monthsHeld === null ? '' : String(a.monthsHeld));
          setMnav(a.maxNetAssetValue === null ? '' : String(a.maxNetAssetValue));
          setTurnover(a.aggregatedTurnover === null ? '' : String(a.aggregatedTurnover));
          setActiveAsset(a.isActiveAsset);
          setRetirement(a.isRetirementOrIncapacity);
          setElectReduction(a.electActiveAssetReduction ?? true);
          setElectExemption(a.electRetirementExemption ?? false);
          setElectRollover(a.electRollover ?? false);
          setLifetimeUsed(
            a.retirementExemptionUsedToDate === null ? '' : String(a.retirementExemptionUsedToDate),
          );
        }
      }
    } finally {
      setLoading(false);
    }
  }, [entityId, fy, authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const factsComplete =
    gain !== '' &&
    months !== '' &&
    mnav !== '' &&
    turnover !== '' &&
    activeAsset !== null &&
    retirement !== null &&
    (!electExemption || lifetimeUsed !== '');

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tax/entity/${entityId}/div152-assessment?fy=${fy}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          gainAfterDiv115: gain === '' ? null : Number(gain),
          monthsHeld: months === '' ? null : Number(months),
          maxNetAssetValue: mnav === '' ? null : Number(mnav),
          aggregatedTurnover: turnover === '' ? null : Number(turnover),
          isActiveAsset: activeAsset,
          isRetirementOrIncapacity: retirement,
          electActiveAssetReduction: electReduction,
          electRetirementExemption: electExemption,
          electRollover: electRollover,
          retirementExemptionUsedToDate:
            electExemption && lifetimeUsed !== '' ? Number(lifetimeUsed) : null,
        }),
      });
      if (!res.ok) throw new Error('Failed to save the assessment.');
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save the assessment.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="relative overflow-hidden rounded-[22px] border-foreground/10 bg-card/70 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)]">
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-500 to-indigo-500" />
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text text-[11px] font-semibold uppercase tracking-[0.18em] text-transparent">
              Small business CGT concessions · FY {fy}
            </div>
            <h2 className="mt-1 text-lg font-semibold">Sold a business asset this year?</h2>
          </div>
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-lg shadow-indigo-500/25">
            <Store size={20} strokeWidth={1.5} />
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          Answer these to see which concessions could reduce the capital gain. ITAA 1997 Div 152 —
          nothing is assumed.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Loading your assessment&hellip;
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <SectionLabel>The disposal</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Capital gain (after any 50% CGT discount)
                  </div>
                  <Input inputMode="decimal" value={gain} onChange={(e) => setGain(e.target.value)} placeholder="$" className="tabular-nums" />
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Months the asset was held
                  </div>
                  <Input inputMode="numeric" value={months} onChange={(e) => setMonths(e.target.value)} placeholder="0" className="tabular-nums" />
                  {months !== '' && Number(months) >= FIFTEEN_YEAR_MONTHS && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      15+ years &mdash; the full exemption may apply (s152-105)
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 py-1">
                <div className="min-w-0">
                  <div className="text-[13px]">Was it an active business asset?</div>
                  <div className="text-[11px] text-muted-foreground">
                    Used in carrying on a business for at least half the ownership period (s152-35)
                  </div>
                </div>
                <TriState value={activeAsset} onChange={setActiveAsset} />
              </div>
            </div>

            <div className="space-y-3">
              <SectionLabel>The size tests</SectionLabel>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Net assets of you + connected entities
                  </div>
                  <Input inputMode="decimal" value={mnav} onChange={(e) => setMnav(e.target.value)} placeholder="$" className="tabular-nums" />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Under {formatCurrency(MNAV_THRESHOLD)} passes the MNAV test (s152-15)
                  </p>
                </div>
                <div>
                  <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Aggregated annual turnover
                  </div>
                  <Input inputMode="decimal" value={turnover} onChange={(e) => setTurnover(e.target.value)} placeholder="$" className="tabular-nums" />
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Under {formatCurrency(TURNOVER_THRESHOLD)} qualifies as a CGT small business entity (s152-20)
                  </p>
                </div>
              </div>
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Info size={12} strokeWidth={1.5} /> Either test passing satisfies the basic conditions.
              </p>
            </div>

            <div className="space-y-1">
              <SectionLabel>Retirement &amp; elections</SectionLabel>
              <div className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <div className="text-[13px]">Is the sale connected to retirement or permanent incapacity?</div>
                  <div className="text-[11px] text-muted-foreground">Required for the 15-year exemption (s152-105)</div>
                </div>
                <TriState value={retirement} onChange={setRetirement} />
              </div>
              <div className="divide-y divide-foreground/5">
                <div className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="text-[13px]">Apply the 50% active asset reduction</div>
                    <div className="text-[11px] text-muted-foreground">Applied by default &mdash; s152-205</div>
                  </div>
                  <Election value={electReduction} onChange={setElectReduction} />
                </div>
                <div className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-[13px]">Apply the retirement exemption</div>
                      <div className="text-[11px] text-muted-foreground">
                      Lifetime cap {formatCurrency(RETIREMENT_LIFETIME_CAP)} &mdash; s152-305
                    </div>
                    </div>
                    <Election value={electExemption} onChange={setElectExemption} />
                  </div>
                  {electExemption && (
                    <div className="mt-3 border-l border-foreground/10 pl-4">
                      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Retirement exemption already used in your lifetime
                      </div>
                      <Input inputMode="decimal" value={lifetimeUsed} onChange={(e) => setLifetimeUsed(e.target.value)} placeholder="$" className="max-w-[240px] tabular-nums" />
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Required when this election is on &mdash; we never assume zero.
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="text-[13px]">Roll the remaining gain into a replacement asset</div>
                    <div className="text-[11px] text-muted-foreground">
                      Deferral tracking is coming later &mdash; the amount shows as deferred, not computed
                    </div>
                  </div>
                  <Election value={electRollover} onChange={setElectRollover} />
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
              <Info size={13} strokeWidth={1.5} className="mt-0.5 flex-shrink-0" />
              This assessment only computes once every question above is answered. &ldquo;Not
              sure&rdquo; keeps the concessions off &mdash; nothing is ever assumed.
            </div>

            {div152Result ? (
              <div className="rounded-[12px] border border-indigo-500/15 bg-indigo-500/5 p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Assessed outcome
                </div>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-[13px]">
                    <span>Gain after CGT discount</span>
                    <span className="tabular-nums">
                      {formatCurrency(div152Result.gainBeforeConcessions)}
                    </span>
                  </div>
                  {div152Result.steps.map((s) => (
                    <div key={s.concession} className="flex items-center justify-between text-[13px]">
                      <span className="text-muted-foreground">
                        {s.concession} <span className="font-mono text-[10px]">({s.citation})</span>
                      </span>
                      <span className="tabular-nums text-muted-foreground">
                        &minus;{formatCurrency(s.reduction)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-foreground/10 pt-1.5 text-[13px] font-semibold">
                    <span>Assessable gain</span>
                    <span className="text-xl tabular-nums">{formatCurrency(div152Result.assessableGain)}</span>
                  </div>
                </div>
                <div className="mt-2 font-mono text-[10px] text-muted-foreground">
                  ITAA 1997 Div 152 · s152-10 basic conditions {div152Result.basicConditionsMet ? 'met' : 'not met'}
                </div>
              </div>
            ) : (
              <div className="rounded-[12px] border border-foreground/10 bg-background/50 p-4 text-[12px] text-muted-foreground">
                {factsComplete
                  ? 'Save the assessment to see the outcome.'
                  : 'The assessment stays off until every question is answered — an incomplete answer never creates a tax outcome.'}
              </div>
            )}

            {error && <div className="text-xs text-red-600">{error}</div>}

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setGain(''); setMonths(''); setMnav(''); setTurnover('');
                  setActiveAsset(null); setRetirement(null);
                  setElectReduction(true); setElectExemption(false); setElectRollover(false);
                  setLifetimeUsed('');
                }}
              >
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => void save()}
                disabled={saving}
                className="bg-gradient-to-r from-sky-500 to-indigo-500 text-white hover:opacity-90"
              >
                {saving && <Loader2 size={13} className="mr-1.5 animate-spin" />}
                Save assessment
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
