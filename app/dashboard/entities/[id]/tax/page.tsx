'use client';

/**
 * Phase 44.2 — /dashboard/entities/[id]/tax (SMSF tax position)
 *
 * Surfaces the already-built SMSF fund-income tax engine
 * (`calculateSmsfIncomeTax` — Div 295 / ECPI / NALI) for a
 * LegalEntity(type=SMSF). The page is a thin client over two endpoints:
 *
 *   - GET  /api/tax/entity/[id]?fy=        → EntityTaxPosition (real number,
 *     because `assembleEntityTaxFacts` now reads the persisted
 *     SmsfAnnualReturn — Phase 44.2 assembler branch).
 *   - GET/PUT /api/tax/entity/[id]/smsf-return?fy= → the saved fund figures.
 *
 * Four-lens discipline:
 *  - Financial adviser: every figure is an ESTIMATE with citations + the
 *    canonical boundary footnote; the ECPI-missing case shows UNCOMPUTED,
 *    never a guessed number (the engine returns null tax in that case).
 *  - Behaviour psychologist: UNCOMPUTED renders as a calm "complete your
 *    estimate" prompt (amber, never red); warm plain-English labels.
 *  - Architect: zero new tax math — reuses the engine + router via the API.
 *  - Security: read/write gated by tax_data.*; the entity is verified to be
 *    the caller's own SMSF server-side.
 *
 * Deferred (later slices): per-member balances, TBC tracking, franking
 * refunds, the household-tax-page entity breakdown.
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { BoundaryFootnote } from '@/components/tax/BoundaryFootnote';
import { ArrowLeft, Loader2, Landmark, Info, Pencil } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { formatCurrency } from '@/lib/utils/formatters';

interface SmsfIncomeTaxResult {
  tax: number | null;
  investmentIncomeTax: number | null;
  contributionsTax: number;
  naliTax: number;
  ecpiExemptAmount: number | null;
  isComplying: boolean;
}

interface EntityTaxPosition {
  entityType: string;
  result?: { smsfIncomeTax?: SmsfIncomeTaxResult } | null;
  citations: Array<{ kind: string; reference: string }>;
  uncomputed: Array<{ id: string; rationale: string }>;
}

interface SavedReturn {
  assessableInvestmentIncome: number;
  deductions: number;
  assessableContributions: number;
  nonArmsLengthIncome: number;
  isComplying: boolean;
  isInPensionPhase: boolean;
  ecpiExemptProportion: number | null;
}

type FormState = {
  assessableInvestmentIncome: string;
  deductions: string;
  assessableContributions: string;
  nonArmsLengthIncome: string;
  isComplying: boolean;
  isInPensionPhase: boolean;
  ecpiExemptPercent: string; // shown as a percentage (0-100); '' = unknown
};

const EMPTY_FORM: FormState = {
  assessableInvestmentIncome: '',
  deductions: '',
  assessableContributions: '',
  nonArmsLengthIncome: '',
  isComplying: true,
  isInPensionPhase: false,
  ecpiExemptPercent: '',
};

const FY_OPTIONS = ['2025-26', '2024-25', '2023-24'];

export default function SmsfTaxPage() {
  const params = useParams();
  const entityId = params?.id as string;
  const { token } = useAuth();

  const [fy, setFy] = useState('2025-26');
  const [entityName, setEntityName] = useState<string>('');
  const [isSmsf, setIsSmsf] = useState<boolean | null>(null);
  const [position, setPosition] = useState<EntityTaxPosition | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editing, setEditing] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const authHeaders = useCallback(
    () => ({ Authorization: `Bearer ${token}` }),
    [token],
  );

  const hydrateForm = useCallback((ret: SavedReturn | null) => {
    if (!ret) {
      setForm(EMPTY_FORM);
      setHasSaved(false);
      return;
    }
    setForm({
      assessableInvestmentIncome: String(ret.assessableInvestmentIncome ?? ''),
      deductions: String(ret.deductions ?? ''),
      assessableContributions: String(ret.assessableContributions ?? ''),
      nonArmsLengthIncome: String(ret.nonArmsLengthIncome ?? ''),
      isComplying: ret.isComplying,
      isInPensionPhase: ret.isInPensionPhase,
      ecpiExemptPercent:
        ret.ecpiExemptProportion === null || ret.ecpiExemptProportion === undefined
          ? ''
          : String(Math.round(ret.ecpiExemptProportion * 1000) / 10),
    });
    setHasSaved(true);
  }, []);

  const load = useCallback(async () => {
    if (!entityId || !token) return;
    setLoading(true);
    try {
      const [entityRes, posRes, retRes] = await Promise.all([
        fetch(`/api/entities/${entityId}`, { headers: authHeaders() }),
        fetch(`/api/tax/entity/${entityId}?fy=${fy}`, { headers: authHeaders() }),
        fetch(`/api/tax/entity/${entityId}/smsf-return?fy=${fy}`, { headers: authHeaders() }),
      ]);

      if (entityRes.ok) {
        const e = await entityRes.json();
        setEntityName(typeof e?.name === 'string' ? e.name : 'SMSF');
        setIsSmsf(e?.type === 'SMSF');
      } else {
        setIsSmsf(false);
      }

      if (posRes.ok) {
        const p = await posRes.json();
        setPosition(p?.data?.entityPosition ?? null);
      }
      if (retRes.ok) {
        const r = await retRes.json();
        hydrateForm(r?.data?.return ?? null);
      }
    } catch (err) {
      console.error('Failed to load SMSF tax position:', err);
    } finally {
      setLoading(false);
    }
  }, [entityId, token, fy, authHeaders, hydrateForm]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!entityId || !token) return;
    setSaving(true);
    try {
      const ecpiRaw = form.ecpiExemptPercent.trim();
      const body = {
        assessableInvestmentIncome: Number(form.assessableInvestmentIncome) || 0,
        deductions: Number(form.deductions) || 0,
        assessableContributions: Number(form.assessableContributions) || 0,
        nonArmsLengthIncome: Number(form.nonArmsLengthIncome) || 0,
        isComplying: form.isComplying,
        isInPensionPhase: form.isInPensionPhase,
        ecpiExemptProportion: ecpiRaw === '' ? null : Number(ecpiRaw) / 100,
      };
      const res = await fetch(`/api/tax/entity/${entityId}/smsf-return?fy=${fy}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditing(false);
        await load();
      }
    } catch (err) {
      console.error('Failed to save SMSF figures:', err);
    } finally {
      setSaving(false);
    }
  };

  const smsf = position?.result?.smsfIncomeTax;
  const ecpiPending = position?.uncomputed?.some((u) => u.id === 'UC-SMSF-ECPI-PROPORTION');

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <Link
          href="/dashboard/entities"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> My Structure
        </Link>

        <PageHeader
          title={entityName ? `${entityName} — tax position` : 'SMSF tax position'}
          description="An estimate of your fund's income tax for the year. Confirm final figures with your SMSF accountant or auditor."
        />

        {/* FY selector */}
        <div className="flex items-center gap-2">
          <Label htmlFor="fy" className="text-sm text-muted-foreground">Financial year</Label>
          <select
            id="fy"
            value={fy}
            onChange={(e) => setFy(e.target.value)}
            className="rounded-[10px] border border-input bg-background px-3 py-1.5 text-sm"
          >
            {FY_OPTIONS.map((y) => (
              <option key={y} value={y}>{`FY ${y}`}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : isSmsf === false ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              This page is for self-managed super funds. This structure isn&apos;t an SMSF.
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Result */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Landmark className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Fund income tax estimate
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!hasSaved ? (
                  <div className="rounded-[14px] border border-dashed border-foreground/15 bg-background/50 p-5 text-center">
                    <p className="text-sm text-muted-foreground">
                      Add your fund&apos;s figures for this year to see its estimated tax.
                    </p>
                    <Button className="mt-3" onClick={() => setEditing(true)}>
                      Add fund figures
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Estimated total fund tax
                        </p>
                        <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
                          {smsf?.tax === null || smsf?.tax === undefined
                            ? '—'
                            : formatCurrency(smsf.tax)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit figures
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Stat
                        label="Contributions tax (15%)"
                        value={smsf ? formatCurrency(smsf.contributionsTax) : '—'}
                      />
                      <Stat
                        label="Investment income tax"
                        value={
                          smsf?.investmentIncomeTax === null || smsf?.investmentIncomeTax === undefined
                            ? 'Uncomputed'
                            : formatCurrency(smsf.investmentIncomeTax)
                        }
                        muted={smsf?.investmentIncomeTax === null}
                      />
                      <Stat
                        label="Non-arm's-length income tax (45%)"
                        value={smsf ? formatCurrency(smsf.naliTax) : '—'}
                      />
                      <Stat
                        label="Pension-phase exempt (ECPI)"
                        value={
                          smsf?.ecpiExemptAmount === null || smsf?.ecpiExemptAmount === undefined
                            ? '—'
                            : formatCurrency(smsf.ecpiExemptAmount)
                        }
                      />
                    </div>

                    {ecpiPending && (
                      <div className="flex items-start gap-2.5 rounded-[12px] border border-amber-400/30 bg-amber-50/60 px-4 py-3 dark:bg-amber-950/20">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <p className="text-sm text-amber-900 dark:text-amber-100">
                          Your fund is in pension phase, so its investment-income tax depends on the
                          exempt current pension income (ECPI) proportion. Add it below — from your
                          actuary&apos;s certificate or the segregated-assets method — to complete the estimate.
                          We never estimate ECPI.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Edit form */}
            {editing && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Your fund&apos;s figures — FY {fy}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <MoneyField
                    id="aii"
                    label="Assessable investment income"
                    help="Rent, dividends, interest, distributions (before deductions)."
                    value={form.assessableInvestmentIncome}
                    onChange={(v) => setForm({ ...form, assessableInvestmentIncome: v })}
                  />
                  <MoneyField
                    id="ded"
                    label="Deductions"
                    help="Expenses against investment income (fees, insurance, interest)."
                    value={form.deductions}
                    onChange={(v) => setForm({ ...form, deductions: v })}
                  />
                  <MoneyField
                    id="contrib"
                    label="Assessable contributions"
                    help="Employer SG + salary sacrifice + personal deductible. Taxed at 15%."
                    value={form.assessableContributions}
                    onChange={(v) => setForm({ ...form, assessableContributions: v })}
                  />
                  <MoneyField
                    id="nali"
                    label="Non-arm's-length income (NALI)"
                    help="Income not on commercial terms. Taxed at the top rate; leave 0 if none."
                    value={form.nonArmsLengthIncome}
                    onChange={(v) => setForm({ ...form, nonArmsLengthIncome: v })}
                  />

                  <div className="flex items-center justify-between rounded-[12px] border border-foreground/10 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">Complying fund</p>
                      <p className="text-xs text-muted-foreground">Registered with the ATO as a complying SMSF.</p>
                    </div>
                    <Switch
                      checked={form.isComplying}
                      onCheckedChange={(v) => setForm({ ...form, isComplying: v })}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-[12px] border border-foreground/10 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">In pension phase</p>
                      <p className="text-xs text-muted-foreground">One or more members drawing a retirement-phase pension.</p>
                    </div>
                    <Switch
                      checked={form.isInPensionPhase}
                      onCheckedChange={(v) => setForm({ ...form, isInPensionPhase: v })}
                    />
                  </div>

                  {form.isInPensionPhase && (
                    <div className="space-y-1.5">
                      <Label htmlFor="ecpi">ECPI exempt proportion (%)</Label>
                      <Input
                        id="ecpi"
                        type="number"
                        min={0}
                        max={100}
                        placeholder="e.g. 60 — leave blank if unknown"
                        value={form.ecpiExemptPercent}
                        onChange={(e) => setForm({ ...form, ecpiExemptPercent: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        From your actuary&apos;s certificate (proportionate method) or 100% if fully segregated.
                        Leave blank if you don&apos;t have it yet — we won&apos;t guess.
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="outline" onClick={() => { setEditing(false); }} disabled={saving}>
                      Cancel
                    </Button>
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                      Save figures
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Boundary + citations */}
            {position && (
              <BoundaryFootnote
                citations={position.citations as never}
                uncomputed={position.uncomputed as never}
                fyLabel={`FY ${fy}`}
              />
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="rounded-[12px] border border-foreground/10 bg-background/50 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-lg font-semibold tabular-nums ${muted ? 'text-muted-foreground' : 'text-foreground'}`}>
        {value}
      </p>
    </div>
  );
}

function MoneyField({
  id, label, help, value, onChange,
}: {
  id: string; label: string; help: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={0}
        inputMode="decimal"
        placeholder="0"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">{help}</p>
    </div>
  );
}
