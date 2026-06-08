'use client';

/**
 * Phase 45 PR 2.B — interactive lever-detail page.
 *
 * Screen B from `docs/blueprint/PHASE_45_WHAT_IF_SCENARIOS.md` §6.4.
 * Canonical Stitch artefact: `.stitch/designs/what-if-lever-detail{,-v1-desktop,-v1-mobile}.{html,png}`
 * (PR #977 v1-desktop light is the canonical reference; dark mode is
 * derived via §18.7.2 token substitution — Reza directive 2026-06-08,
 * the v1-dark cosmos artefact is treated as superseded).
 *
 * Salary-sacrifice is the showcase lever — fully wired: snapshot defaults,
 * slider with current-value pill, H1 source line, H2 RegimeBadge,
 * H3 concessional-cap headroom card with hard-stop, super-account
 * destination selector (consumes ctx.superAccounts from PR 2.A.1 TSB fix),
 * quick-pick chips, 10-year projection chart, tax-saved + cap-used pills,
 * collapsible Assumptions panel, GAW footer.
 *
 * Other 4 levers (refinanceLoan / sellProperty / payDownLoan / addInvestment)
 * route to the same shell but render a "This lever uses this surface — full
 * wiring ships in PR 2.C" placeholder in the inputs column. The Salary-
 * sacrifice flow is the reference implementation per Stitch §6.3 + Reza
 * directive 2026-06-08.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Info,
  Lock,
  PiggyBank,
  Percent,
  Home as HomeIcon,
  TrendingDown,
  Building2,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useAuth } from '@/lib/context/AuthContext';
import { SCENARIO_TYPES, type ScenarioType } from '@/lib/cfo/scenarios';
import {
  tenYearProjection,
} from '@/lib/cfo/scenarios/tenYearProjection';
import type { TenYearProjectionResult } from '@/lib/cfo/scenarios';
import { Decimal, toDecimal } from '@/lib/decimal';

// =============================================================================
// LEVER METADATA — anatomy shared across the lever-detail shell
// =============================================================================

interface LeverMeta {
  title: string;
  trailStage: string;
  topStripClass: string;
  iconBadgeClass: string;
  iconColor: string;
  Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

const LEVER_META: Record<ScenarioType, LeverMeta> = {
  refinanceLoan: {
    title: 'Refinance a loan',
    trailStage: 'REDUCE · DEBT',
    topStripClass: 'bg-gradient-to-r from-amber-400 to-rose-400',
    iconBadgeClass: 'bg-gradient-to-br from-amber-400/20 to-rose-400/20',
    iconColor: 'text-amber-500 dark:text-amber-400',
    Icon: Percent,
  },
  salarySacrificeToSuper: {
    title: 'Salary-sacrifice to super',
    trailStage: 'INVEST · SUPER',
    topStripClass: 'bg-gradient-to-r from-emerald-400 to-indigo-400',
    iconBadgeClass: 'bg-gradient-to-br from-emerald-400/20 to-indigo-400/20',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    Icon: PiggyBank,
  },
  sellProperty: {
    title: 'Sell a property',
    trailStage: 'LIVE · EXIT',
    topStripClass: 'bg-gradient-to-r from-violet-400 to-fuchsia-400',
    iconBadgeClass: 'bg-gradient-to-br from-violet-400/20 to-fuchsia-400/20',
    iconColor: 'text-violet-600 dark:text-violet-400',
    Icon: HomeIcon,
  },
  payDownLoan: {
    title: 'Pay extra off a debt',
    trailStage: 'ANCHOR · DEBT FREEDOM',
    topStripClass: 'bg-gradient-to-r from-indigo-400 to-blue-400',
    iconBadgeClass: 'bg-gradient-to-br from-indigo-400/20 to-blue-400/20',
    iconColor: 'text-indigo-600 dark:text-indigo-400',
    Icon: TrendingDown,
  },
  addInvestment: {
    title: 'Buy an investment property',
    trailStage: 'INVEST · PROPERTY',
    topStripClass: 'bg-gradient-to-r from-teal-400 to-cyan-400',
    iconBadgeClass: 'bg-gradient-to-br from-teal-400/20 to-cyan-400/20',
    iconColor: 'text-teal-600 dark:text-teal-400',
    Icon: Building2,
  },
  redirectToOffset: {
    title: 'Redirect to offset',
    trailStage: 'REDUCE · DEBT',
    topStripClass: 'bg-gradient-to-r from-amber-400 to-rose-400',
    iconBadgeClass: 'bg-gradient-to-br from-amber-400/20 to-rose-400/20',
    iconColor: 'text-amber-500 dark:text-amber-400',
    Icon: Percent,
  },
  cutSpendCategory: {
    title: 'Cut a spending category',
    trailStage: 'REDUCE · DEBT',
    topStripClass: 'bg-gradient-to-r from-amber-400 to-rose-400',
    iconBadgeClass: 'bg-gradient-to-br from-amber-400/20 to-rose-400/20',
    iconColor: 'text-amber-500 dark:text-amber-400',
    Icon: Percent,
  },
};

function isScenarioType(value: string): value is ScenarioType {
  return (SCENARIO_TYPES as string[]).includes(value);
}

// =============================================================================
// TYPES — match server response shapes
// =============================================================================

interface SuperAccountResp {
  id: string;
  name?: string;
  currentBalance: number;
  fundType: 'INDUSTRY' | 'RETAIL' | 'SMSF' | null;
}

interface LeverContext {
  grossSalaryAnnual: number;
  monthlyCashflow: number;
  totalSuperBalance: number;
  superAccounts: SuperAccountResp[];
  loans: unknown[];
  properties: unknown[];
  computedAt: string;
}

interface ScenarioImpactResp {
  label: string;
  before: number;
  after: number;
  delta: number;
  format: 'currency' | 'percent' | 'number';
  direction: 'positive' | 'negative' | 'neutral';
}

interface ScenarioWarningResp {
  severity: 'info' | 'caution' | 'critical';
  message: string;
}

interface ScenarioResultResp {
  type: ScenarioType;
  title: string;
  summary: string;
  impacts: ScenarioImpactResp[];
  warnings: ScenarioWarningResp[];
  assumptions: string[];
  computedAt: string;
}

// =============================================================================
// FORMATTERS
// =============================================================================

function formatCurrency(value: number, opts: { precise?: boolean } = {}): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: opts.precise ? 2 : 0,
  }).format(value);
}

function formatCompactCurrency(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}m`;
  if (Math.abs(value) >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return formatCurrency(value);
}

// =============================================================================
// PAGE
// =============================================================================

export default function LeverDetailPage() {
  const { token } = useAuth();
  const params = useParams<{ lever: string }>();
  const leverParam = params.lever;
  const isValid = typeof leverParam === 'string' && isScenarioType(leverParam);
  const lever = isValid ? leverParam : null;
  const meta = lever ? LEVER_META[lever] : null;

  const [ctx, setCtx] = useState<LeverContext | null>(null);
  const [ctxError, setCtxError] = useState<string | null>(null);

  // Slider state — salary-sacrifice is the showcase; other levers stub.
  const [monthlySacrifice, setMonthlySacrifice] = useState<number>(500);
  const [selectedFundId, setSelectedFundId] = useState<string | null>(null);
  const [result, setResult] = useState<ScenarioResultResp | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // 1. Fetch context on mount.
  useEffect(() => {
    if (!token || !lever) return;
    let active = true;
    fetch('/api/cfo/scenarios/context', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok || !body.success) {
          throw new Error(body?.error?.message ?? 'Failed to load context.');
        }
        return body.data as LeverContext;
      })
      .then((data) => {
        if (!active) return;
        setCtx(data);
        // Default fund selection: largest-balance non-SMSF, else largest overall.
        const apraAccts = data.superAccounts.filter((a) => a.fundType !== 'SMSF');
        const choices = apraAccts.length > 0 ? apraAccts : data.superAccounts;
        const largest = [...choices].sort((a, b) => b.currentBalance - a.currentBalance)[0];
        if (largest) setSelectedFundId(largest.id);
      })
      .catch((err) => {
        if (active) setCtxError(err?.message ?? 'Failed to load context.');
      });
    return () => {
      active = false;
    };
  }, [token, lever]);

  // 2. Re-run scenario whenever the slider value changes (debounced).
  useEffect(() => {
    if (!token || !ctx || lever !== 'salarySacrificeToSuper') return;
    const handle = window.setTimeout(() => {
      setRunning(true);
      setRunError(null);
      fetch('/api/cfo/scenarios/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'salarySacrificeToSuper',
          params: { monthlySacrifice },
        }),
      })
        .then(async (r) => {
          const body = await r.json();
          if (!r.ok || !body.success) {
            throw new Error(body?.error?.message ?? 'Scenario run failed.');
          }
          return body.data as ScenarioResultResp;
        })
        .then((data) => {
          setResult(data);
        })
        .catch((err) => {
          setRunError(err?.message ?? 'Scenario run failed.');
        })
        .finally(() => setRunning(false));
    }, 250); // 250ms debounce — feels live without spamming.
    return () => window.clearTimeout(handle);
  }, [token, ctx, lever, monthlySacrifice]);

  // 3. Derive H3 cap-headroom + H2 regime locally from the result.
  const annualSacrifice = monthlySacrifice * 12;
  const cap = useMemo(() => {
    // FY25-26 concessional cap = $30,000 + SG 12% (mirrors taxYearConfig).
    // Pre-fetch this server-side in PR 2.C — for now hard-code the FY25-26
    // values so the slider math feels instant. The scenario API still
    // produces the authoritative numbers; this is UI ergonomics only.
    const grossSalary = ctx?.grossSalaryAnnual ?? 0;
    const sgRate = 0.12;
    const concessionalCap = 30_000;
    const sg = grossSalary * sgRate;
    const proposed = sg + annualSacrifice;
    const headroom = Math.max(0, concessionalCap - proposed);
    const isOver = proposed > concessionalCap;
    return { sg, proposed, concessionalCap, headroom, isOver };
  }, [ctx?.grossSalaryAnnual, annualSacrifice]);

  // Cap-derived slider max (hard stop at the cap).
  const sliderMax = useMemo(() => {
    if (!ctx) return 5000;
    const remainingPerYear = Math.max(0, cap.concessionalCap - cap.sg);
    return Math.max(100, Math.floor(remainingPerYear / 12 / 100) * 100);
  }, [ctx, cap.concessionalCap, cap.sg]);

  // 4. 10-year projection — computed client-side from the scenario result
  //    so the chart re-renders instantly on slider changes (no extra
  //    server roundtrip). The server-side composer (tenYearProjection)
  //    is the canonical engine; this client call uses the same exported
  //    pure function.
  const projection = useMemo<TenYearProjectionResult | null>(() => {
    if (!ctx || !result || lever !== 'salarySacrificeToSuper') return null;
    // Pull year-1 cashflow + tax deltas from the impacts.
    const takeHomeImpact = result.impacts.find((i) => i.label === 'Monthly take-home pay');
    const taxSavingsImpact = result.impacts.find((i) =>
      i.label.startsWith('Year-1 tax savings'),
    );
    const netToSuperImpact = result.impacts.find((i) =>
      i.label.startsWith('Year-1 net added to super'),
    );
    if (!takeHomeImpact || !taxSavingsImpact || !netToSuperImpact) return null;
    const yearOneCashflowDelta = new Decimal(takeHomeImpact.delta).times(12);
    const yearOneTaxDelta = new Decimal(0); // tax already in cashflow delta for sacrifice
    const baseNetWorth = new Decimal(ctx.totalSuperBalance);
    const baseSuperBalance = new Decimal(ctx.totalSuperBalance);
    const annualSuperContribution = new Decimal(netToSuperImpact.after);
    return tenYearProjection({
      baseNetWorth,
      yearOneCashflowDelta,
      yearOneTaxDelta,
      baseSuperBalance,
      annualSuperContribution,
      years: 10,
    });
  }, [ctx, result, lever]);

  const baselineProjection = useMemo<TenYearProjectionResult | null>(() => {
    if (!ctx || lever !== 'salarySacrificeToSuper') return null;
    // Baseline = SG only, no sacrifice. Year-1 super contribution = SG only.
    const sgPerYear = new Decimal(ctx.grossSalaryAnnual).times('0.12'); // FY25-26 SG
    const sgAfterContribTax = sgPerYear.times('0.85'); // 15% contributions tax
    return tenYearProjection({
      baseNetWorth: new Decimal(ctx.totalSuperBalance),
      yearOneCashflowDelta: new Decimal(0),
      yearOneTaxDelta: new Decimal(0),
      baseSuperBalance: new Decimal(ctx.totalSuperBalance),
      annualSuperContribution: sgAfterContribTax,
      years: 10,
    });
  }, [ctx, lever]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isValid || !meta || !lever) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/dashboard/cfo/what-if"
            className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={2} />
            Back to lever picker
          </Link>
          <h1 className="text-2xl font-semibold">Unknown lever</h1>
          <p className="mt-2 text-rose-600 dark:text-rose-400 text-sm">
            That lever doesn&apos;t exist. Go back and pick one from the lever
            picker.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const isSacrifice = lever === 'salarySacrificeToSuper';
  const isUncomputed = result !== null && result.impacts.length === 0;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
        <LeverHeader meta={meta} />

        {ctxError && (
          <div className="mt-6 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
            Couldn&apos;t load your snapshot. {ctxError}
          </div>
        )}

        {!ctx && !ctxError && (
          <div className="mt-8 flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500/30 border-t-emerald-500" />
          </div>
        )}

        {ctx && (
          <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Left column — inputs */}
            <GlassPanel topStrip={meta.topStripClass}>
              {isSacrifice ? (
                <SacrificeInputs
                  ctx={ctx}
                  monthlySacrifice={monthlySacrifice}
                  setMonthlySacrifice={setMonthlySacrifice}
                  cap={cap}
                  sliderMax={sliderMax}
                  selectedFundId={selectedFundId}
                  setSelectedFundId={setSelectedFundId}
                />
              ) : (
                <StubInputs meta={meta} />
              )}
            </GlassPanel>

            {/* Right column — projection */}
            <GlassPanel topStrip={meta.topStripClass}>
              {isSacrifice ? (
                <SacrificeProjection
                  ctx={ctx}
                  result={result}
                  projection={projection}
                  baselineProjection={baselineProjection}
                  running={running}
                  isUncomputed={isUncomputed}
                  runError={runError}
                />
              ) : (
                <StubProjection meta={meta} />
              )}
            </GlassPanel>
          </div>
        )}

        {/* Bottom row — assumptions + GAW */}
        {ctx && (
          <>
            {result && result.assumptions.length > 0 && (
              <div className="mt-5">
                <AssumptionsPanel assumptions={result.assumptions} />
              </div>
            )}
            <div className="mt-5">
              <GAWFooter />
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

// =============================================================================
// COMPONENTS
// =============================================================================

function LeverHeader({ meta }: { meta: LeverMeta }) {
  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/dashboard/cfo/what-if"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
          What if?
        </Link>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          My Guide · Decision support
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span
          className={`inline-flex h-5 items-center rounded-md px-2 text-[10px] font-medium uppercase tracking-wider ${meta.iconBadgeClass} border border-foreground/10`}
        >
          {meta.trailStage}
        </span>
      </div>
      <h1 className="mt-2 text-2xl sm:text-3xl font-semibold tracking-tight">
        {meta.title}
      </h1>
    </>
  );
}

function GlassPanel({
  children,
  topStrip,
}: {
  children: React.ReactNode;
  topStrip: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-foreground/10 bg-card/70 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),0_0_0_1px_rgba(255,255,255,0.04)]">
      <div className={`absolute left-0 right-0 top-0 h-[3px] ${topStrip}`} />
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sacrifice inputs (left column)
// ---------------------------------------------------------------------------

function SacrificeInputs({
  ctx,
  monthlySacrifice,
  setMonthlySacrifice,
  cap,
  sliderMax,
  selectedFundId,
  setSelectedFundId,
}: {
  ctx: LeverContext;
  monthlySacrifice: number;
  setMonthlySacrifice: (v: number) => void;
  cap: { sg: number; proposed: number; concessionalCap: number; headroom: number; isOver: boolean };
  sliderMax: number;
  selectedFundId: string | null;
  setSelectedFundId: (id: string) => void;
}) {
  // Quick-pick chips
  const currentSacrifice = 0; // no SuperContribution YTD wired yet — defaults to 0
  const maxWithinCap = sliderMax;

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
          Inputs · Invest
        </p>
        <h2 className="text-lg font-semibold text-foreground">How much per month?</h2>
      </div>

      {/* Slider with value pill */}
      <div className="pt-2">
        <div className="mb-3 flex items-center justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-indigo-500 px-4 py-1.5 text-base font-semibold text-white shadow-md">
            ${monthlySacrifice.toLocaleString()}
            <span className="text-xs font-normal text-white/80">/mo</span>
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={sliderMax}
          step={50}
          value={monthlySacrifice}
          onChange={(e) => setMonthlySacrifice(Number(e.target.value))}
          className="w-full accent-emerald-500"
          aria-label="Monthly salary sacrifice"
        />
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>$0</span>
          <span>${sliderMax.toLocaleString()}/mo</span>
        </div>
        {/* H1 SliderSource info-line */}
        <p className="mt-3 text-[11px] text-muted-foreground">
          Your snapshot: ${formatCurrency(ctx.grossSalaryAnnual)}/yr salary · cap
          read per FY 25-26
        </p>
      </div>

      {/* H3 — Cap headroom info card */}
      <ConcessionalCapCard cap={cap} />

      {/* Quick-pick chips */}
      <div className="flex flex-wrap gap-2">
        {currentSacrifice > 0 && (
          <button
            type="button"
            onClick={() => setMonthlySacrifice(currentSacrifice)}
            className="rounded-full border border-foreground/10 bg-background/50 px-3 py-1.5 text-xs text-foreground/80 backdrop-blur hover:bg-foreground/5 transition-colors"
          >
            Use my current sacrifice (${currentSacrifice}/mo)
          </button>
        )}
        <button
          type="button"
          onClick={() => setMonthlySacrifice(maxWithinCap)}
          className="rounded-full border border-foreground/10 bg-background/50 px-3 py-1.5 text-xs text-foreground/80 backdrop-blur hover:bg-foreground/5 transition-colors"
        >
          Max within cap (${maxWithinCap.toLocaleString()}/mo)
        </button>
      </div>

      {/* Super-account destination selector */}
      <div className="border-t border-foreground/5 pt-5">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-foreground/60">
          Which super account?
        </p>
        {ctx.superAccounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No super accounts on your snapshot — add one in My Wealth to use this
            lever.
          </p>
        ) : (
          <ul className="space-y-2">
            {ctx.superAccounts.map((acct) => (
              <li key={acct.id}>
                <button
                  type="button"
                  onClick={() => setSelectedFundId(acct.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-all ${
                    selectedFundId === acct.id
                      ? 'border-emerald-500/40 bg-emerald-500/5'
                      : 'border-foreground/10 bg-background/30 hover:border-foreground/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {acct.name ?? 'Super account'}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {acct.fundType === 'SMSF' ? 'SMSF' : 'Industry/Retail'} ·{' '}
                        {formatCompactCurrency(acct.currentBalance)}
                      </p>
                    </div>
                    {selectedFundId === acct.id && (
                      <span className="text-emerald-600 dark:text-emerald-400">✓</span>
                    )}
                  </div>
                  {selectedFundId === acct.id && acct.fundType === 'SMSF' && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Contributions to your SMSF need a member contribution form
                      lodged with the trustee. Your accountant or fund administrator
                      handles this — same as any other sacrifice.
                    </p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ConcessionalCapCard({
  cap,
}: {
  cap: { sg: number; proposed: number; concessionalCap: number; headroom: number; isOver: boolean };
}) {
  const used = Math.min(100, (cap.proposed / cap.concessionalCap) * 100);
  return (
    <div
      className={`rounded-xl border p-4 ${
        cap.isOver
          ? 'border-rose-500/30 bg-rose-500/10'
          : 'border-emerald-500/20 bg-emerald-500/5'
      }`}
    >
      <div className="flex items-start gap-3">
        {cap.isOver ? (
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
        ) : (
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        )}
        <div className="flex-1 text-xs">
          {cap.isOver ? (
            <>
              <p className="font-medium text-rose-700 dark:text-rose-300">
                Over the concessional cap for FY25-26.
              </p>
              <p className="mt-1 text-rose-700/80 dark:text-rose-300/80">
                Going over the $
                {cap.concessionalCap.toLocaleString()} cap attracts Division 293 /
                excess contributions tax. To increase the cap, your fund needs to
                confirm carry-forward unused cap from prior years.
              </p>
            </>
          ) : (
            <>
              <p className="font-medium text-emerald-700 dark:text-emerald-300">
                Your concessional cap headroom for FY25-26:{' '}
                {formatCurrency(cap.headroom)}
              </p>
              <p className="mt-1 text-foreground/70">
                This contribution: ${formatCurrency(cap.proposed)}/yr. Within
                cap — no extra tax.
              </p>
            </>
          )}
        </div>
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-foreground/5">
        <div
          className={`h-full ${cap.isOver ? 'bg-rose-500' : 'bg-emerald-500'}`}
          style={{ width: `${used}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sacrifice projection (right column)
// ---------------------------------------------------------------------------

function SacrificeProjection({
  ctx,
  result,
  projection,
  baselineProjection,
  running,
  isUncomputed,
  runError,
}: {
  ctx: LeverContext;
  result: ScenarioResultResp | null;
  projection: TenYearProjectionResult | null;
  baselineProjection: TenYearProjectionResult | null;
  running: boolean;
  isUncomputed: boolean;
  runError: string | null;
}) {
  // H2 regime status — derived from the result's summary string.
  const regimeLocked =
    result !== null &&
    result.summary.toLowerCase().includes('high-balance super tax');
  const overCap =
    result !== null && result.summary.toLowerCase().includes('over concessional cap');

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
          10-year projection
        </p>
        {running && (
          <span className="text-xs text-muted-foreground">Updating…</span>
        )}
      </div>

      {runError && (
        <div className="mb-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-300">
          {runError}
        </div>
      )}

      {/* H2 — regime badge when DIV296_UNCOMPUTED */}
      {regimeLocked && (
        <RegimeLockedBadge reason={result?.summary ?? ''} />
      )}

      {/* H3 — cap hard-stop already shown left side; reinforce on the right */}
      {overCap && !regimeLocked && (
        <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">
          Lower the sacrifice slider — at this level you&apos;d exceed the cap.
        </div>
      )}

      {/* Headline */}
      {projection && baselineProjection && !isUncomputed && (
        <div className="mb-4">
          <p className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(
              projection.finalNetWorth.minus(baselineProjection.finalNetWorth).toNumber(),
            )}{' '}
            more in super by year 10
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            vs. your current SG-only path of{' '}
            {formatCurrency(baselineProjection.finalNetWorth.toNumber())}
          </p>
        </div>
      )}

      {/* Chart */}
      {projection && baselineProjection && !isUncomputed && (
        <SacrificeChart projection={projection} baseline={baselineProjection} />
      )}

      {/* Result pills */}
      {result && !isUncomputed && (
        <ResultPills result={result} ctx={ctx} />
      )}
    </div>
  );
}

function RegimeLockedBadge({ reason }: { reason: string }) {
  return (
    <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
      <div className="flex items-start gap-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="text-xs">
          <p className="font-medium text-amber-700 dark:text-amber-300">
            High-balance super tax — pending Royal Assent
          </p>
          <p className="mt-1 text-foreground/70">{reason}</p>
        </div>
      </div>
    </div>
  );
}

function SacrificeChart({
  projection,
  baseline,
}: {
  projection: TenYearProjectionResult;
  baseline: TenYearProjectionResult;
}) {
  const data = projection.trajectory.map((p, i) => ({
    year: p.year,
    label: `${2026 + p.year}`,
    sacrifice: p.netWorth.toNumber(),
    baseline: baseline.trajectory[i].netWorth.toNumber(),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tickFormatter={(v) => formatCompactCurrency(v)}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            tickLine={false}
            axisLine={false}
            width={60}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              border: '1px solid rgba(148,163,184,0.2)',
              backgroundColor: 'hsl(var(--card))',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 30px rgba(15,23,42,0.08)',
              fontSize: 12,
            }}
            formatter={(value: number, name) => [
              formatCurrency(value),
              name === 'sacrifice' ? 'With sacrifice' : 'Current path',
            ]}
            labelFormatter={(label) => `Year ${label}`}
          />
          <Line
            type="monotone"
            dataKey="baseline"
            stroke="rgba(148,163,184,0.6)"
            strokeDasharray="4 4"
            strokeWidth={2}
            dot={false}
            name="baseline"
          />
          <Line
            type="monotone"
            dataKey="sacrifice"
            stroke="#10b981"
            strokeWidth={2.5}
            dot={false}
            name="sacrifice"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ResultPills({
  result,
  ctx,
}: {
  result: ScenarioResultResp;
  ctx: LeverContext;
}) {
  const taxSavings = result.impacts.find((i) =>
    i.label.startsWith('Year-1 tax savings'),
  );
  const totalConcessional = result.impacts.find((i) =>
    i.label.startsWith('Total concessional'),
  );
  const capUsed = totalConcessional
    ? Math.round((totalConcessional.after / 30_000) * 100)
    : 0;

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {taxSavings && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20">
          Annual tax saved: {formatCurrency(taxSavings.after)}
        </span>
      )}
      {totalConcessional && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-medium text-foreground/80 ring-1 ring-foreground/10">
          Concessional cap used: {capUsed}%
        </span>
      )}
      {ctx.totalSuperBalance >= 3_000_000 && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/20">
          TSB above $3M — Div 296 watch
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stubs (other 4 levers)
// ---------------------------------------------------------------------------

function StubInputs({ meta }: { meta: LeverMeta }) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Inputs · {meta.trailStage}
      </p>
      <h2 className="text-lg font-semibold text-foreground">{meta.title}</h2>
      <p className="mt-4 text-sm text-muted-foreground">
        The interactive inputs for this lever ship in Phase 45 PR 2.C. The
        shared UI shell — projection chart, assumptions panel, GAW footer
        — is what you&apos;re seeing on this page. The engine for this
        lever (see <code className="rounded bg-foreground/5 px-1.5 py-0.5 text-xs">lib/cfo/scenarios/</code>) is already live from PR 1.
      </p>
    </div>
  );
}

function StubProjection({ meta }: { meta: LeverMeta }) {
  return (
    <div className="flex h-full flex-col items-center justify-center py-10 text-center">
      <meta.Icon
        className={`mb-4 h-10 w-10 ${meta.iconColor}`}
        strokeWidth={1.5}
      />
      <p className="text-sm font-medium text-foreground">Coming in PR 2.C</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground">
        Salary-sacrifice is the showcase wiring in PR 2.B. The other 4
        levers — including {meta.title.toLowerCase()} — get the same
        treatment in PR 2.C.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assumptions + GAW
// ---------------------------------------------------------------------------

function AssumptionsPanel({ assumptions }: { assumptions: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[16px] border border-foreground/10 bg-card/70 backdrop-blur-xl">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-foreground/5 transition-colors rounded-[16px]"
      >
        <span>
          How we computed this ({assumptions.length} assumption
          {assumptions.length === 1 ? '' : 's'})
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-foreground/60" />
        ) : (
          <ChevronDown className="h-4 w-4 text-foreground/60" />
        )}
      </button>
      {open && (
        <ul className="border-t border-foreground/5 px-4 py-3 space-y-2 text-xs text-foreground/70">
          {assumptions.map((a, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-foreground/40">·</span>
              <span>{a}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GAWFooter() {
  return (
    <div className="rounded-[16px] border border-foreground/10 bg-card/70 px-5 py-4 backdrop-blur-xl">
      <div className="flex items-center gap-3 text-sm">
        <Info className="h-4 w-4 shrink-0 text-foreground/60" strokeWidth={2} />
        <p className="text-foreground/80">
          Monitrax models what changes. Not financial advice.{' '}
          <Link
            href="/legal/general-advice-warning"
            className="text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            Read the General Advice Warning →
          </Link>
        </p>
      </div>
    </div>
  );
}
