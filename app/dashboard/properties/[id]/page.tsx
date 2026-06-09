'use client';

/**
 * PROPERTY DETAIL PAGE — Phase 45.2 — Cremorne-Wide pattern application
 *
 * NEW route scaffolded 2026-06-08 (previously only /strategy and
 * /depreciation sub-routes existed under /dashboard/properties/[id]).
 *
 * Visual direction locked in the Stitch design pass — full 4-variant
 * matrix at .stitch/designs/phase45.2/properties-detail-hero-v5-balanced{,-dark,-mobile,-mobile-dark}.{html,png}.
 *
 * Stitch screen IDs (project 1859462351962811110):
 *   Desktop light:  f021663055bf45619bd5eb74034b5d53
 *   Desktop dark:   4e55e5233a194b4fae37cde83d43efa1
 *   Mobile light:   c21217e5a6e649d0b6fe52b25e519e6a
 *   Mobile dark:    6dd88defd52e4d2ba6cb54251a3c6830
 *
 * Composition (CLAUDE.md §18.7.2 + §18.7.4 Cremorne-Wide variant):
 *   - L1 (background): full-page apartment-interior photo at opacity-50,
 *     covering the main content area beneath a multi-stop ivory/navy
 *     scrim (0.95 → 0.88 → 0.72) that guarantees data legibility.
 *   - L2 (atmospheric halo): sky→indigo gradient blur behind the hero
 *     card, dimmed for dark mode per §18.7.2.
 *   - L3 (next-property ghost): SKIPPED on this surface — single focal
 *     protagonist, but the page has multiple content sections; the
 *     ghost would compete with the linked-entities + strategy stack.
 *
 * Tile-pop sub-pattern (NEW canonical, lands in §18.7.2 with this PR):
 *   Each KPI tile gets three-tier float shadow + 1px inner-top white
 *   highlight + 3px gradient top-accent strip + faint sub-palette
 *   tinted bg + luminous solid-gradient icon badge. Together these
 *   make the tile feel "lifted off the page" — Mercury/Linear-tier
 *   polish without breaking the §18.7.2 glass vocabulary.
 *
 * KPI math: mirrors the inline pattern used by
 * app/dashboard/properties/page.tsx (no canonical engine call for
 * per-property math today — list page uses the same inline functions).
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  Building2,
  ChevronRight,
  DollarSign,
  Edit2,
  FileText,
  Home as HomeIcon,
  KeyRound,
  Landmark,
  Receipt,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { toAnnual } from '@/lib/utils/frequencies';

// =============================================================================
// TYPES
// =============================================================================

interface Loan {
  id: string;
  name: string;
  principal: number;
  interestRateAnnual: number;
  minRepayment: number | null;
  repaymentFrequency: string | null;
}

interface IncomeItem {
  id: string;
  name: string;
  type: string;
  amount: number;
  frequency: string;
}

interface ExpenseItem {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
}

interface DepreciationSchedule {
  id: string;
  type: string;
  annualClaim: number;
}

interface Property {
  id: string;
  name: string;
  address: string;
  type: 'HOME' | 'INVESTMENT' | 'RENTAL';
  purchasePrice: number;
  currentValue: number;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  loans?: Loan[];
  income?: IncomeItem[];
  expenses?: ExpenseItem[];
  depreciationSchedules?: DepreciationSchedule[];
}

// =============================================================================
// KPI HELPERS (mirrors app/dashboard/properties/page.tsx inline pattern)
// =============================================================================

function computeEquity(p: Property): number {
  const totalLoans = (p.loans ?? []).reduce((sum, l) => sum + l.principal, 0);
  return p.currentValue - totalLoans;
}

function computeLvr(p: Property): number {
  const totalLoans = (p.loans ?? []).reduce((sum, l) => sum + l.principal, 0);
  if (p.currentValue <= 0) return 0;
  return (totalLoans / p.currentValue) * 100;
}

function computeAnnualRent(p: Property): number {
  return (p.income ?? []).reduce((sum, i) => {
    if (i.type === 'RENT' || i.type === 'RENTAL') {
      return sum + toAnnual(i.amount, i.frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL');
    }
    return sum;
  }, 0);
}

function computeRentalYield(p: Property): number {
  if (p.currentValue <= 0) return 0;
  return (computeAnnualRent(p) / p.currentValue) * 100;
}

function computeAnnualLoanRepayments(p: Property): number {
  return (p.loans ?? []).reduce((sum, l) => {
    return sum + toAnnual(l.minRepayment ?? 0, (l.repaymentFrequency ?? 'MONTHLY') as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL');
  }, 0);
}

function computeAnnualExpenses(p: Property): number {
  return (p.expenses ?? []).reduce((sum, e) => {
    return sum + toAnnual(e.amount, e.frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL');
  }, 0);
}

function computeCashflow(p: Property): number {
  const income = (p.income ?? []).reduce((sum, i) => sum + toAnnual(i.amount, i.frequency as 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'), 0);
  return income - computeAnnualExpenses(p) - computeAnnualLoanRepayments(p);
}

function computeAnnualDepreciation(p: Property): number {
  return (p.depreciationSchedules ?? []).reduce((sum, d) => sum + (d.annualClaim ?? 0), 0);
}

function computeTotalLoanBalance(p: Property): number {
  return (p.loans ?? []).reduce((sum, l) => sum + l.principal, 0);
}

function computeGainPercentage(p: Property): number {
  if (p.purchasePrice <= 0) return 0;
  return ((p.currentValue - p.purchasePrice) / p.purchasePrice) * 100;
}

// =============================================================================
// PAGE
// =============================================================================

export default function PropertyDetailPage() {
  const params = useParams();
  const { token } = useAuth();
  const propertyId = params.id as string;

  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!propertyId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/properties/${propertyId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setProperty(data.data ?? data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [propertyId, token]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (!property) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/dashboard/properties"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Properties
          </Link>
          <div className="mt-12 text-center text-muted-foreground">
            Property not found.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const isInvestment = property.type === 'INVESTMENT';
  const isRental = property.type === 'RENTAL';
  const equity = computeEquity(property);
  const lvr = computeLvr(property);
  const yieldPct = computeRentalYield(property);
  const annualRent = computeAnnualRent(property);
  const cashflow = computeCashflow(property);
  const loanBalance = computeTotalLoanBalance(property);
  const depreciation = computeAnnualDepreciation(property);
  const gainPct = computeGainPercentage(property);
  const lvrLabel = lvr >= 80 ? 'High' : lvr >= 60 ? 'Moderate' : 'Healthy';
  const lvrTone = lvr >= 60 ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300';
  const typeLabel = isInvestment ? 'INVESTMENT PROPERTY' : isRental ? 'RENTAL (RENTING)' : 'PRIMARY RESIDENCE';
  const typeIcon = isInvestment ? ArrowUpRight : isRental ? KeyRound : HomeIcon;
  const TypeIcon = typeIcon;

  return (
    <DashboardLayout>
      <div className="relative mx-auto max-w-[1200px] overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
        {/*
          §18.7.4 Cremorne-Wide L1 — full-page contextual photo canvas.
          opacity-50 keeps the photo as a premium whisper rather than
          dominant landscape. The multi-stop scrim below guarantees
          data legibility regardless of where on the page the user is
          looking.
        */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-30">
          <Image
            src="/decor/cremorne-apartment.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-50"
            priority={false}
          />
        </div>

        {/*
          L1-SCRIM — multi-stop ivory (light) → navy (dark) gradient.
          Inviolable contract: data must read with the same crispness
          as a non-Cremorne page. The 0.95 → 0.88 → 0.72 progression
          keeps the breadcrumb + hero header bright while letting the
          photo grow more visible behind the GAW footer.
        */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-b from-[#FAFAF7]/95 via-[#FAFAF7]/88 to-[#FAFAF7]/72 dark:from-[#050913]/95 dark:via-[#050913]/88 dark:to-[#050913]/72"
        />

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">My Wealth</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/dashboard/properties" className="hover:text-foreground">Properties</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground">{property.name}</span>
          </div>
          <Link
            href="/dashboard/properties"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Properties
          </Link>
        </nav>

        {/* HERO CARD */}
        <section className="relative">
          {/* L2 atmospheric halo — behind hero only (the protagonist) */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-sky-400/12 to-indigo-500/12 blur-[40px] dark:from-sky-400/8 dark:to-indigo-500/8 md:-inset-10 md:blur-[60px]"
          />
          <div
            className="
              relative overflow-hidden rounded-[28px] border border-foreground/10 bg-card/70 backdrop-blur-xl
              shadow-[0_2px_4px_rgba(15,23,42,0.04),0_16px_48px_rgba(15,23,42,0.10),0_32px_80px_rgba(15,23,42,0.06)]
              dark:border-foreground/20 dark:bg-card/70
              dark:shadow-[0_2px_4px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]
            "
          >
            <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-500 to-indigo-500" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10"
            />

            <div className="relative p-6 sm:p-8">
              {/* Top header row */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
                    <TypeIcon className="h-5 w-5" />
                  </div>
                  <span className="bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text text-[10px] font-bold uppercase tracking-[0.16em] text-transparent">
                    {typeLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {isInvestment && (
                    <Link
                      href={`/dashboard/cfo/what-if/sellProperty?propertyId=${encodeURIComponent(property.id)}`}
                      title="What if you sold this?"
                      aria-label="Run a sell-this-property what-if scenario"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-300"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Link>
                  )}
                  <Link
                    href="/dashboard/properties"
                    title="Edit"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/dashboard/properties"
                    title="Delete"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Title + address */}
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {property.name}
              </h1>
              <p className="mt-1 text-base text-muted-foreground">{property.address}</p>

              {/* Value row */}
              <div className="mt-6 grid grid-cols-1 gap-4 border-b border-foreground/10 pb-6 sm:grid-cols-2 sm:gap-8">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current value</p>
                  <p className="mt-1 bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-4xl font-semibold tracking-tight tabular-nums text-transparent">
                    {formatCurrency(property.currentValue)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Purchase price</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {formatCurrency(property.purchasePrice)}
                  </p>
                  {gainPct !== 0 && (
                    <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${gainPct >= 0 ? 'bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300' : 'bg-rose-500/12 text-rose-700 ring-1 ring-rose-500/20 dark:text-rose-300'}`}>
                      <TrendingUp className="h-3 w-3" />
                      {gainPct >= 0 ? '+' : ''}
                      {gainPct.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* 3-cell mini-grid */}
              {!isRental && (
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <MiniKpi label="Equity" value={formatCurrency(equity)} tint="emerald" />
                  <MiniKpi label="LVR" value={`${lvr.toFixed(1)}%`} tint="emerald" sub={lvrLabel} subTone={lvrTone} />
                  <MiniKpi label="Yield" value={`${yieldPct.toFixed(2)}%`} tint="violet" />
                </div>
              )}
            </div>
          </div>
        </section>

        {/*
          §18.7.2 polished tile sub-pattern — applied to every KPI tile.
          Three-tier float shadow + 1px inner-top white highlight + 3px
          gradient top-accent strip + faint sub-palette tinted bg +
          luminous solid-gradient icon badge. Mercury/Linear-tier polish.
        */}
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <PolishedKpiTile
            label="Cashflow / yr"
            value={formatCurrency(cashflow)}
            icon={Banknote}
            tint="emerald"
            valueTone={cashflow >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300'}
          />
          <PolishedKpiTile
            label="Annual rent"
            value={formatCurrency(annualRent)}
            icon={DollarSign}
            tint="sky"
          />
          <PolishedKpiTile
            label="Loan balance"
            value={formatCurrency(loanBalance)}
            icon={Landmark}
            tint="indigo"
          />
          <PolishedKpiTile
            label="Depreciation / yr"
            value={formatCurrency(depreciation)}
            icon={FileText}
            tint="violet"
          />
        </section>

        {/* Two-column section: Linked entities + Recent activity (left) + Strategy/Insights (right) */}
        <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* LEFT column (2/3 width) */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            <LinkedEntitiesCard property={property} />
            <RecentActivityCard property={property} />
          </div>

          {/* RIGHT column (1/3 width) */}
          <div className="flex flex-col gap-5">
            <InsightCard
              icon={Sparkles}
              title="Growth scenarios"
              body="Model how this property's value, equity and tax position shift under different growth, rate and yield assumptions."
              cta="View scenarios"
              href={isInvestment ? `/dashboard/cfo/what-if/sellProperty?propertyId=${encodeURIComponent(property.id)}` : `/dashboard/properties/${property.id}/strategy`}
              tint="sky"
            />
            <InsightCard
              icon={FileText}
              title="Tax position"
              body={`This property contributes ${formatCurrency(cashflow)} to annual cashflow before tax. See its impact in your FY26 tax position.`}
              cta="View tax position"
              href="/dashboard/tax"
              tint="emerald"
            />
            <InsightCard
              icon={Building2}
              title="Depreciation schedule"
              body={depreciation > 0 ? `Currently claiming ${formatCurrency(depreciation)}/yr across ${property.depreciationSchedules?.length ?? 0} schedule(s).` : 'Add a depreciation schedule to claim capital works + plant.'}
              cta="View schedule"
              href={`/dashboard/properties/${property.id}/depreciation`}
              tint="violet"
            />
          </div>
        </section>

        {/* AFSL GAW footer */}
        <footer className="mt-10 max-w-3xl text-[11px] text-muted-foreground/70">
          <strong className="font-semibold">AFSL General Advice Warning.</strong>{' '}
          The information provided on this platform is general in nature only and does not constitute personal financial,
          tax, or legal advice. It has been prepared without taking into account your personal objectives, financial
          situation, or needs. Before acting on any information, you should consider the appropriateness of the information
          having regard to your objectives, financial situation, and needs.
        </footer>
      </div>
    </DashboardLayout>
  );
}

// =============================================================================
// SUB-COMPONENTS (co-located — only used on this page)
// =============================================================================

function MiniKpi({
  label,
  value,
  tint,
  sub,
  subTone,
}: {
  label: string;
  value: string;
  tint: 'emerald' | 'sky' | 'indigo' | 'violet';
  sub?: string;
  subTone?: string;
}) {
  const tintClasses = {
    emerald: 'bg-emerald-500/5 border-emerald-500/15',
    sky: 'bg-sky-500/5 border-sky-500/15',
    indigo: 'bg-indigo-500/5 border-indigo-500/15',
    violet: 'bg-violet-500/5 border-violet-500/15',
  }[tint];
  const labelTone = {
    emerald: 'text-emerald-700 dark:text-emerald-300',
    sky: 'text-sky-700 dark:text-sky-300',
    indigo: 'text-indigo-700 dark:text-indigo-300',
    violet: 'text-violet-700 dark:text-violet-300',
  }[tint];
  return (
    <div className={`rounded-[12px] border px-3.5 py-3 ${tintClasses}`}>
      <div className="flex items-center justify-between">
        <p className={`text-[10px] font-semibold uppercase tracking-wider ${labelTone}`}>{label}</p>
        {sub && <span className={`text-[9px] font-bold uppercase tracking-wider ${subTone ?? 'text-muted-foreground'} opacity-70`}>{sub}</span>}
      </div>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

const TILE_TINT_BG: Record<'emerald' | 'sky' | 'indigo' | 'violet', string> = {
  emerald: 'bg-gradient-to-br from-emerald-50/40 to-card/70 dark:from-emerald-500/[0.08] dark:to-card/70',
  sky: 'bg-gradient-to-br from-sky-50/40 to-card/70 dark:from-sky-500/[0.08] dark:to-card/70',
  indigo: 'bg-gradient-to-br from-indigo-50/40 to-card/70 dark:from-indigo-500/[0.08] dark:to-card/70',
  violet: 'bg-gradient-to-br from-violet-50/40 to-card/70 dark:from-violet-500/[0.08] dark:to-card/70',
};

const TILE_ACCENT_GRADIENT: Record<'emerald' | 'sky' | 'indigo' | 'violet', string> = {
  emerald: 'from-emerald-500 to-emerald-600',
  sky: 'from-sky-500 to-sky-600',
  indigo: 'from-indigo-500 to-indigo-600',
  violet: 'from-violet-500 to-violet-600',
};

const TILE_BADGE_SHADOW: Record<'emerald' | 'sky' | 'indigo' | 'violet', string> = {
  emerald: 'shadow-emerald-500/30',
  sky: 'shadow-sky-500/30',
  indigo: 'shadow-indigo-500/30',
  violet: 'shadow-violet-500/30',
};

function PolishedKpiTile({
  label,
  value,
  icon: Icon,
  tint,
  valueTone,
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  tint: 'emerald' | 'sky' | 'indigo' | 'violet';
  valueTone?: string;
}) {
  return (
    <div
      className={`
        relative overflow-hidden rounded-[22px] border border-foreground/10 backdrop-blur-xl
        ${TILE_TINT_BG[tint]}
        shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_36px_rgba(15,23,42,0.08)]
        transition-transform duration-300 hover:-translate-y-0.5
        dark:border-foreground/20
        dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]
      `}
    >
      <div aria-hidden className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${TILE_ACCENT_GRADIENT[tint]}`} />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10"
      />
      <div className="relative p-5">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${TILE_ACCENT_GRADIENT[tint]} text-white shadow-md ${TILE_BADGE_SHADOW[tint]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums sm:text-3xl ${valueTone ?? 'text-foreground'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}

function LinkedEntitiesCard({ property }: { property: Property }) {
  const items: { id: string; icon: typeof Landmark; iconTone: string; title: string; subtitle: string; amount: string; amountTone: string; href: string }[] = [];

  (property.loans ?? []).forEach((l) => {
    items.push({
      id: `loan-${l.id}`,
      icon: Landmark,
      iconTone: 'text-sky-600 dark:text-sky-400 bg-sky-500/10',
      title: l.name,
      subtitle: `${formatCurrency(l.principal)} balance · ${(l.interestRateAnnual * 100).toFixed(2)}% p.a.`,
      amount: formatCurrency(l.principal),
      amountTone: 'text-foreground',
      href: '/dashboard/balances',
    });
  });

  (property.income ?? []).forEach((i) => {
    items.push({
      id: `inc-${i.id}`,
      icon: TrendingUp,
      iconTone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
      title: i.name,
      subtitle: `${i.frequency.toLowerCase()} · ${i.type.toLowerCase()}`,
      amount: `+${formatCurrency(i.amount)}`,
      amountTone: 'text-emerald-700 dark:text-emerald-300',
      href: '/dashboard/income',
    });
  });

  if ((property.expenses ?? []).length > 0) {
    const annual = computeAnnualExpenses(property);
    items.push({
      id: 'exp-summary',
      icon: Receipt,
      iconTone: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
      title: `${property.expenses?.length ?? 0} ${(property.expenses?.length ?? 0) === 1 ? 'expense' : 'expenses'} tracked`,
      subtitle: `Annual total ${formatCurrency(annual)}`,
      amount: formatCurrency(annual),
      amountTone: 'text-foreground',
      href: '/dashboard/expenses',
    });
  }

  if ((property.depreciationSchedules ?? []).length > 0) {
    items.push({
      id: 'dep-summary',
      icon: FileText,
      iconTone: 'text-violet-600 dark:text-violet-400 bg-violet-500/10',
      title: `${property.depreciationSchedules?.length ?? 0} depreciation schedule${(property.depreciationSchedules?.length ?? 0) === 1 ? '' : 's'}`,
      subtitle: 'Capital works + plant',
      amount: formatCurrency(computeAnnualDepreciation(property)),
      amountTone: 'text-foreground',
      href: `/dashboard/properties/${property.id}/depreciation`,
    });
  }

  return (
    <div className="relative overflow-hidden rounded-[16px] border border-foreground/10 bg-card/70 p-6 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] dark:border-foreground/20 dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Linked entities</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">Financial infrastructure</h2>
        {items.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No loans, income, expenses or depreciation schedules linked yet. Add them from the relevant pages and they&rsquo;ll appear here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-foreground/10">
            {items.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="flex items-center gap-3 py-3 transition-colors hover:bg-foreground/[0.03]"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.iconTone}`}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>
                  </div>
                  <p className={`shrink-0 text-sm font-semibold tabular-nums ${item.amountTone}`}>{item.amount}</p>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RecentActivityCard({ property }: { property: Property }) {
  // v1 RECENT ACTIVITY: synthesised from the property's linked income +
  // expense items. Each linked item becomes a "recurring activity" row.
  // When the transactions API surfaces a property-keyed query, swap this
  // to real transaction rows; the visual rhythm stays the same.
  const rows: { id: string; date: string; icon: typeof Receipt; title: string; amount: string; tone: string }[] = [];

  (property.income ?? []).slice(0, 2).forEach((i) => {
    rows.push({
      id: `act-inc-${i.id}`,
      date: i.frequency.charAt(0) + i.frequency.slice(1).toLowerCase(),
      icon: TrendingUp,
      title: `${i.name} — recurring`,
      amount: `+${formatCurrency(i.amount)}`,
      tone: 'text-emerald-700 dark:text-emerald-300',
    });
  });

  (property.expenses ?? []).slice(0, 3).forEach((e) => {
    rows.push({
      id: `act-exp-${e.id}`,
      date: e.frequency.charAt(0) + e.frequency.slice(1).toLowerCase(),
      icon: Receipt,
      title: `${e.name}`,
      amount: `-${formatCurrency(e.amount)}`,
      tone: 'text-foreground',
    });
  });

  return (
    <div className="relative overflow-hidden rounded-[16px] border border-foreground/10 bg-card/70 p-6 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] dark:border-foreground/20 dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recent activity</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">Cashflow rhythm</h2>
        {rows.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No income or expenses linked to this property yet. Add them and recurring activity will appear here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-foreground/10">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 py-3">
                <span className="w-16 shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{row.date}</span>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05]">
                  <row.icon className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="min-w-0 flex-1 truncate text-sm text-foreground">{row.title}</p>
                <p className={`shrink-0 text-sm font-semibold tabular-nums ${row.tone}`}>{row.amount}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function InsightCard({
  icon: Icon,
  title,
  body,
  cta,
  href,
  tint,
}: {
  icon: typeof Sparkles;
  title: string;
  body: string;
  cta: string;
  href: string;
  tint: 'emerald' | 'sky' | 'indigo' | 'violet';
}) {
  const linkTone = {
    emerald: 'text-emerald-700 dark:text-emerald-300',
    sky: 'text-sky-700 dark:text-sky-300',
    indigo: 'text-indigo-700 dark:text-indigo-300',
    violet: 'text-violet-700 dark:text-violet-300',
  }[tint];

  return (
    <div className="relative overflow-hidden rounded-[16px] border border-foreground/10 bg-card/70 p-5 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] dark:border-foreground/20 dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10" />
      <div className="relative">
        <div className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${TILE_ACCENT_GRADIENT[tint]} text-white shadow-md ${TILE_BADGE_SHADOW[tint]}`}>
          <Icon className="h-4 w-4" />
        </div>
        <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{body}</p>
        <Link href={href} className={`mt-3 inline-flex items-center gap-1 text-xs font-semibold ${linkTone} hover:underline`}>
          {cta}
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
