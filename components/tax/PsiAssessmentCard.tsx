'use client';

/**
 * MON-102 (capture Stage 2) — the PSI self-assessment card on
 * /dashboard/entities/[id]/tax for PSI-relevant entity types
 * (COMPANY / SOLE_TRADER / PARTNERSHIP / DISCRETIONARY_TRUST / UNIT_TRUST).
 *
 * The ATO PSB self-assessment shape (ITAA 1997 Part 2-42): three numerics
 * (primary) → four tests + the PSB-determination row (secondary, tri-state
 * Yes/No/Not sure) → the result strip (the payoff). The card WRITES facts
 * via PUT /api/tax/entity/[id]/psi-assessment and READS the assessment
 * result from the parent's entity-position response
 * (`crossCutting.psiByEntity` — the ONE wired overlay, §12.2.1; this
 * component performs NO tax arithmetic and never re-derives the outcome).
 *
 * Safe defaults (Reza GO 2026-07-27): the numerics are all-or-nothing (an
 * incomplete assessment never produces an attribution — the overlay stays
 * inert); unanswered tests persist as null and count as not-established
 * (the engine's own contract + the ATO's posture — stated in-UI by the
 * amber note, which can only move the result toward MORE attribution).
 *
 * Stitch design: project 1859462351962811110, screen
 * 73a1f75151a24eadb9dd179cd307d533 (§18.8 9.1/10, Reza-approved 2026-07-27).
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Briefcase, Info, Loader2 } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { ONE_CLIENT_THRESHOLD } from '@/lib/tax-engine/divisions/psiClassifier';
import { formatCitationLine, type CitationRef } from '@/components/tax/citationLine';

export interface PsiOverlayResult {
  isPsi: boolean;
  isPsb: boolean;
  psiAttributedToIndividual: number;
  /** MON-107 — the engine's per-branch citation trail, rendered verbatim
   *  (s87-60 on the determination PSB route, s86-15 only on attribution). */
  citations?: CitationRef[];
}

interface SavedAssessment {
  totalPsiIncome: number | null;
  incomeFromLargestClient: number | null;
  unrelatedClientCount: number | null;
  gainedClientsViaDirectAdvertising: boolean | null;
  meetsResultsTest: boolean | null;
  meetsEmploymentTest: boolean | null;
  meetsBusinessPremisesTest: boolean | null;
  hasPsbDetermination: boolean | null;
}

const TESTS: Array<{ key: keyof SavedAssessment & string; question: string; caption?: string }> = [
  { key: 'meetsResultsTest', question: 'Paid for results, providing your own tools, liable to fix defects?', caption: 'the results test' },
  { key: 'gainedClientsViaDirectAdvertising', question: 'Did unrelated clients come from public advertising or tenders?' },
  { key: 'meetsEmploymentTest', question: 'Do you employ or contract others to do the principal work?' },
  { key: 'meetsBusinessPremisesTest', question: 'Separate business premises from your home and clients?' },
  { key: 'hasPsbDetermination', question: 'Do you hold an ATO personal services business determination?' },
];

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

export function PsiAssessmentCard({
  entityId,
  fy,
  authHeaders,
  psiResult,
  onSaved,
}: {
  entityId: string;
  fy: string;
  authHeaders: () => Record<string, string>;
  /** The LIVE overlay result from the entity-position response (crossCutting.psiByEntity[entityId]) — never re-derived here. */
  psiResult: PsiOverlayResult | null;
  /** Parent reloads the position so the result strip reflects the saved facts. */
  onSaved: () => void;
}) {
  const [totalPsi, setTotalPsi] = useState('');
  const [largestClient, setLargestClient] = useState('');
  const [unrelatedClients, setUnrelatedClients] = useState('');
  const [tests, setTests] = useState<Record<string, boolean | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tax/entity/${entityId}/psi-assessment?fy=${fy}`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const json = await res.json();
        const a: SavedAssessment | null = json?.data?.assessment ?? null;
        setTotalPsi(a?.totalPsiIncome === null || a?.totalPsiIncome === undefined ? '' : String(a.totalPsiIncome));
        setLargestClient(a?.incomeFromLargestClient === null || a?.incomeFromLargestClient === undefined ? '' : String(a.incomeFromLargestClient));
        setUnrelatedClients(a?.unrelatedClientCount === null || a?.unrelatedClientCount === undefined ? '' : String(a.unrelatedClientCount));
        setTests({
          meetsResultsTest: a?.meetsResultsTest ?? null,
          gainedClientsViaDirectAdvertising: a?.gainedClientsViaDirectAdvertising ?? null,
          meetsEmploymentTest: a?.meetsEmploymentTest ?? null,
          meetsBusinessPremisesTest: a?.meetsBusinessPremisesTest ?? null,
          hasPsbDetermination: a?.hasPsbDetermination ?? null,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [entityId, fy, authHeaders]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = Number(totalPsi) || 0;
  const largest = Number(largestClient) || 0;
  const largestShare = total > 0 && largestClient !== '' ? largest / total : null;
  const numericsComplete = totalPsi !== '' && largestClient !== '' && unrelatedClients !== '';

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tax/entity/${entityId}/psi-assessment?fy=${fy}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          totalPsiIncome: totalPsi === '' ? null : Number(totalPsi),
          incomeFromLargestClient: largestClient === '' ? null : Number(largestClient),
          unrelatedClientCount: unrelatedClients === '' ? null : Number(unrelatedClients),
          meetsResultsTest: tests.meetsResultsTest ?? null,
          gainedClientsViaDirectAdvertising: tests.gainedClientsViaDirectAdvertising ?? null,
          meetsEmploymentTest: tests.meetsEmploymentTest ?? null,
          meetsBusinessPremisesTest: tests.meetsBusinessPremisesTest ?? null,
          hasPsbDetermination: tests.hasPsbDetermination ?? null,
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
      <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 to-violet-500" />
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-[11px] font-semibold uppercase tracking-[0.18em] text-transparent">
              Personal services income · FY {fy}
            </div>
            <h2 className="mt-1 text-lg font-semibold">Personal services income</h2>
          </div>
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-500/25">
            <Briefcase size={20} strokeWidth={1.5} />
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted-foreground">
          If this entity&rsquo;s income comes mainly from one person&rsquo;s skills or effort, the
          ATO&rsquo;s personal services rules may attribute it to that person. Answer what you know
          &mdash; nothing is assumed.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" /> Loading your assessment&hellip;
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total PSI income</div>
                <Input inputMode="decimal" value={totalPsi} onChange={(e) => setTotalPsi(e.target.value)} placeholder="$" className="tabular-nums" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Largest client</div>
                <Input inputMode="decimal" value={largestClient} onChange={(e) => setLargestClient(e.target.value)} placeholder="$" className="tabular-nums" />
                {largestShare !== null && largestShare >= ONE_CLIENT_THRESHOLD && (
                  <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400">
                    {(largestShare * 100).toFixed(0)}% of total &mdash; the{' '}
                    {(ONE_CLIENT_THRESHOLD * 100).toFixed(0)}% one-client test applies
                  </p>
                )}
              </div>
              <div>
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Unrelated clients</div>
                <Input inputMode="numeric" value={unrelatedClients} onChange={(e) => setUnrelatedClients(e.target.value)} placeholder="0" className="tabular-nums" />
              </div>
            </div>

            <div className="divide-y divide-foreground/5">
              {TESTS.map((t) => (
                <div key={t.key} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="text-[13px]">{t.question}</div>
                    {t.caption && <div className="text-[11px] text-muted-foreground">{t.caption}</div>}
                  </div>
                  <TriState value={tests[t.key] ?? null} onChange={(v) => setTests({ ...tests, [t.key]: v })} />
                </div>
              ))}
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
              <Info size={13} strokeWidth={1.5} className="mt-0.5 flex-shrink-0" />
              Unanswered tests count as not established &mdash; the ATO requires a test to be
              positively met before it changes the outcome.
            </div>

            {psiResult ? (
              <div className="flex items-center justify-between gap-4 rounded-[12px] border border-indigo-500/15 bg-indigo-500/5 p-4">
                <div className="min-w-0">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Current assessment</div>
                  <div className="mt-1 text-[13px] font-medium">
                    {psiResult.isPsb
                      ? 'Personal services business — income not attributed'
                      : psiResult.isPsi
                        ? 'Personal services income — attributed to the individual'
                        : 'Not personal services income'}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {formatCitationLine(psiResult.citations)}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-2xl font-semibold tabular-nums">{formatCurrency(psiResult.psiAttributedToIndividual)}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">attributed</div>
                </div>
              </div>
            ) : (
              <div className="rounded-[12px] border border-foreground/10 bg-background/50 p-4 text-[12px] text-muted-foreground">
                {numericsComplete
                  ? 'Save the assessment to see the outcome.'
                  : 'The assessment stays off until all three numbers are entered — an incomplete answer never creates a tax outcome.'}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground">
              Deduction restrictions (s86-60) are flagged for your accountant &mdash; not yet
              calculated.
            </p>

            {error && <div className="text-xs text-red-600">{error}</div>}

            <div className="flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setTotalPsi(''); setLargestClient(''); setUnrelatedClients(''); setTests({}); }}>
                Clear
              </Button>
              <Button
                size="sm"
                onClick={() => void save()}
                disabled={saving}
                className="bg-gradient-to-r from-indigo-500 to-violet-500 text-white hover:opacity-90"
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
