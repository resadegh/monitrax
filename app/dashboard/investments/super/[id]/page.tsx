'use client';

/**
 * SMSF / SUPERANNUATION ACCOUNT DETAIL PAGE — Phase 45.2.2 — Asset Spotlight
 *
 * NEW route scaffolded 2026-06-09. Third asset class to apply the
 * §18.7.5 Asset Spotlight template (properties = Phase 45.2,
 * investments = Phase 45.2.1, SMSF = this PR).
 *
 * Visual direction locked in the Stitch design pass — full 4-variant
 * matrix at .stitch/designs/phase45.2.2/smsf-detail-hero-v1{,-dark,-mobile,-mobile-dark}.{html,png}.
 *
 * Stitch screen IDs (project 1859462351962811110):
 *   Desktop light:  209acc867d7c4ba5866c07df2ef024b9
 *   Desktop dark:   cc8551e256ff432abb74d6bc1b727e6d
 *   Mobile light:   e59944613ac44481aff00b066121388d
 *   Mobile dark:    d94947672c254808a56c77ef48a7d480
 *
 * Per §18.7.5 per-asset-class mapping:
 *   - Sub-palette: sky→indigo (Stage I Invest — SAME as properties; SMSF
 *     shares the "long-term anchored asset" mood. Different from
 *     investments' indigo→violet "growth horizon" mood.)
 *   - Eyebrow: fund type label (SMSF FUND / SUPER FUND / etc.)
 *   - Hero value: currentBalance (member balance)
 *   - Hero secondary: concessional YTD + cap-utilization pill
 *   - Mini-KPI: Concessional used / Non-Concessional used / 1Y return
 *   - 4-tile: SG inflows / Salary sacrifice / Personal deductible / Carry-forward
 *
 * Photo (§18.7.4 "decor not evidence"): classical institutional lobby —
 * trustee gravitas / fiduciary stewardship vocabulary. Distinct from
 * properties (apartment interior) and investments (mountain horizon).
 *
 * v1 data flow: fetches /api/tax/super (the same endpoint the list page
 * uses) and filters the response client-side to the requested account.
 * Lower risk than scaffolding a new GET endpoint; matches the
 * established pattern.
 */

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  ChevronRight,
  DollarSign,
  Edit2,
  FileText,
  Landmark,
  Receipt,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

// =============================================================================
// TYPES
// =============================================================================

type FundType = 'INDUSTRY' | 'RETAIL' | 'CORPORATE' | 'PUBLIC_SECTOR' | 'SMSF' | 'OTHER';
type ContributionType =
  | 'EMPLOYER_SG'
  | 'SALARY_SACRIFICE'
  | 'PERSONAL_DEDUCTIBLE'
  | 'PERSONAL_NON_DEDUCT'
  | 'SPOUSE'
  | 'GOVERNMENT_COCONTRIB'
  | 'DOWNSIZER';

interface AccountContributions {
  employerSG: number;
  salarySacrifice: number;
  personalDeductible: number;
  personalNonDeductible: number;
  totalConcessional: number;
  totalNonConcessional: number;
}

interface RecentContribution {
  id: string;
  type: ContributionType;
  amount: number;
  date: string;
  employerName: string | null;
}

interface SuperAccount {
  id: string;
  fundType: FundType;
  ownerEntityId: string | null;
  name: string;
  fundName: string | null;
  memberNumber: string | null;
  currentBalance: number;
  taxableComponent: number;
  taxFreeComponent: number;
  investmentOption: string | null;
  returns1Year: number | null;
  returns5Year: number | null;
  contributions: AccountContributions;
  recentContributions: RecentContribution[];
}

interface SuperPosition {
  caps: {
    concessional: { cap: number; remaining: number; carryForwardAvailable: number };
    nonConcessional: { cap: number; remaining: number };
  };
  accounts: SuperAccount[];
}

// =============================================================================
// HELPERS
// =============================================================================

function fundTypeLabel(t: FundType): string {
  switch (t) {
    case 'SMSF':
      return 'SMSF FUND';
    case 'INDUSTRY':
      return 'INDUSTRY SUPER';
    case 'RETAIL':
      return 'RETAIL SUPER';
    case 'CORPORATE':
      return 'CORPORATE SUPER';
    case 'PUBLIC_SECTOR':
      return 'PUBLIC SECTOR SUPER';
    case 'OTHER':
      return 'SUPER FUND';
  }
}

function contributionTypeLabel(t: ContributionType): string {
  switch (t) {
    case 'EMPLOYER_SG':
      return 'Employer SG';
    case 'SALARY_SACRIFICE':
      return 'Salary sacrifice';
    case 'PERSONAL_DEDUCTIBLE':
      return 'Personal deductible';
    case 'PERSONAL_NON_DEDUCT':
      return 'Personal non-deductible';
    case 'SPOUSE':
      return 'Spouse contribution';
    case 'GOVERNMENT_COCONTRIB':
      return 'Government co-contribution';
    case 'DOWNSIZER':
      return 'Downsizer';
  }
}

function shortDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-AU', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
}

function safePct(num: number, denom: number): number {
  if (!denom || denom <= 0) return 0;
  return (num / denom) * 100;
}

// =============================================================================
// PAGE
// =============================================================================

export default function SmsfDetailPage() {
  const params = useParams();
  const { token } = useAuth();
  const accountId = params.id as string;

  const [position, setPosition] = useState<SuperPosition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/tax/super`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setPosition(data as SuperPosition);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, token]);

  const account = useMemo<SuperAccount | null>(() => {
    if (!position) return null;
    return position.accounts.find((a) => a.id === accountId) ?? null;
  }, [position, accountId]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-500/30 border-t-sky-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (!account || !position) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/dashboard/investments/super"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Superannuation
          </Link>
          <div className="mt-12 text-center text-muted-foreground">
            Super account not found.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const balance = account.currentBalance ?? 0;
  const concessionalYTD = account.contributions.totalConcessional;
  const nonConcessionalYTD = account.contributions.totalNonConcessional;
  const concessionalCap = position.caps.concessional.cap;
  const nonConcessionalCap = position.caps.nonConcessional.cap;
  const concessionalUsedPct = safePct(concessionalYTD, concessionalCap);
  const nonConcessionalUsedPct = safePct(nonConcessionalYTD, nonConcessionalCap);
  const oneYearReturn = account.returns1Year ?? null;
  const carryForward = position.caps.concessional.carryForwardAvailable ?? 0;

  const typeLabel = fundTypeLabel(account.fundType);
  const isSmsf = account.fundType === 'SMSF';
  const accountTitle = account.fundName ?? account.name;
  const accountSubtitle = [account.name !== accountTitle ? account.name : null, account.investmentOption]
    .filter(Boolean)
    .join(' · ') || 'Self-directed';

  return (
    <DashboardLayout>
      <div className="relative isolate mx-auto max-w-[1200px] overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
        {/* §18.7.4 Cremorne-Wide L1 — classical institutional lobby */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-30">
          <Image
            src="/decor/smsf-lobby.jpg"
            alt=""
            fill
            sizes="100vw"
            className="object-cover opacity-50"
            priority={false}
          />
        </div>

        {/* L1-SCRIM — 3-stop ivory→navy gradient. Opacity progression INVIOLABLE. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-20 bg-gradient-to-b from-[#FAFAF7]/95 via-[#FAFAF7]/88 to-[#FAFAF7]/72 dark:from-[#050913]/95 dark:via-[#050913]/88 dark:to-[#050913]/72"
        />

        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Link href="/dashboard" className="hover:text-foreground">My Wealth</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href="/dashboard/investments/super" className="hover:text-foreground">Superannuation</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground">{accountTitle}</span>
          </div>
          <Link
            href="/dashboard/investments/super"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Superannuation
          </Link>
        </nav>

        {/* HERO CARD */}
        <section className="relative">
          {/* L2 atmospheric halo — sky→indigo behind hero only */}
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
                    <Landmark className="h-5 w-5" />
                  </div>
                  <span className="bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text text-[10px] font-bold uppercase tracking-[0.16em] text-transparent">
                    {typeLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    href="/dashboard/investments/super"
                    title="Edit"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/dashboard/investments/super"
                    title="Delete"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Title + subtitle */}
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {accountTitle}
              </h1>
              <p className="mt-1 text-base text-muted-foreground">{accountSubtitle}</p>

              {/* Value row */}
              <div className="mt-6 grid grid-cols-1 gap-4 border-b border-foreground/10 pb-6 sm:grid-cols-2 sm:gap-8">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Member balance</p>
                  <p className="mt-1 bg-gradient-to-r from-sky-500 to-indigo-600 bg-clip-text text-4xl font-semibold tracking-tight tabular-nums text-transparent">
                    {formatCurrency(balance)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Concessional YTD</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {formatCurrency(concessionalYTD)}
                  </p>
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-500/14 dark:text-emerald-300 dark:ring-emerald-400/25">
                    {concessionalUsedPct.toFixed(0)}% of {formatCurrency(concessionalCap)} cap
                  </span>
                </div>
              </div>

              {/* 3-cell mini-grid */}
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MiniKpi label="Concessional used" value={`${concessionalUsedPct.toFixed(0)}%`} tint="indigo" />
                <MiniKpi label="Non-Concessional used" value={`${nonConcessionalUsedPct.toFixed(0)}%`} tint="sky" />
                <MiniKpi
                  label="1-year return"
                  value={oneYearReturn != null ? `${oneYearReturn >= 0 ? '+' : ''}${oneYearReturn.toFixed(1)}%` : '—'}
                  tint="emerald"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 4-cell polished KPI row */}
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <PolishedKpiTile
            label="SG inflows"
            value={formatCurrency(account.contributions.employerSG)}
            icon={TrendingUp}
            tint="emerald"
          />
          <PolishedKpiTile
            label="Salary sacrifice"
            value={formatCurrency(account.contributions.salarySacrifice)}
            icon={Banknote}
            tint="sky"
          />
          <PolishedKpiTile
            label="Personal deductible"
            value={formatCurrency(account.contributions.personalDeductible)}
            icon={Receipt}
            tint="indigo"
          />
          <PolishedKpiTile
            label="Carry-forward avail."
            value={formatCurrency(carryForward)}
            icon={Landmark}
            tint="violet"
          />
        </section>

        {/* Two-column section: Contributions + Activity (left) + Insights (right) */}
        <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* LEFT column (2/3 width) */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            <ContributionsCard account={account} />
            <RecentActivityCard recent={account.recentContributions} />
          </div>

          {/* RIGHT column (1/3 width) */}
          <div className="flex flex-col gap-5">
            <InsightCard
              icon={Sparkles}
              title="Cap optimisation"
              body={
                position.caps.concessional.remaining > 0
                  ? `You have ${formatCurrency(position.caps.concessional.remaining)} of concessional cap remaining this FY. Salary sacrificing ~${formatCurrency(Math.max(0, position.caps.concessional.remaining / 12))}/mth would max it out.`
                  : 'You have fully utilised your concessional cap this FY. See carry-forward strategies.'
              }
              cta="View scenarios"
              href="/dashboard/cfo"
              tint="indigo"
            />
            <InsightCard
              icon={FileText}
              title="Tax position"
              body={`This fund contributed ${formatCurrency(concessionalYTD)} in concessional contributions taxed at 15%. Compare against your marginal rate impact.`}
              cta="View tax position"
              href="/dashboard/tax"
              tint="emerald"
            />
            <InsightCard
              icon={DollarSign}
              title={isSmsf ? 'Pension phase' : 'Retirement readiness'}
              body={
                isSmsf
                  ? `When you reach preservation age, this fund’s ECPI proportion drives the tax-free investment income split.`
                  : `Track balance + contribution trajectory against your retirement target.`
              }
              cta="Learn more"
              href="/dashboard/cfo"
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
// SUB-COMPONENTS
// =============================================================================

function MiniKpi({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint: 'emerald' | 'sky' | 'indigo' | 'violet';
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
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${labelTone}`}>{label}</p>
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
}: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  tint: 'emerald' | 'sky' | 'indigo' | 'violet';
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
        <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

function ContributionsCard({ account }: { account: SuperAccount }) {
  const rows: { id: string; icon: typeof TrendingUp; iconTone: string; title: string; subtitle: string; amount: string }[] = [];

  if (account.contributions.employerSG > 0) {
    rows.push({
      id: 'sg',
      icon: TrendingUp,
      iconTone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
      title: 'Employer SG',
      subtitle: 'Quarterly statutory contributions',
      amount: formatCurrency(account.contributions.employerSG),
    });
  }

  if (account.contributions.salarySacrifice > 0) {
    rows.push({
      id: 'ss',
      icon: Banknote,
      iconTone: 'text-sky-600 dark:text-sky-400 bg-sky-500/10',
      title: 'Salary sacrifice',
      subtitle: 'Pre-tax voluntary',
      amount: formatCurrency(account.contributions.salarySacrifice),
    });
  }

  if (account.contributions.personalDeductible > 0) {
    rows.push({
      id: 'pd',
      icon: Receipt,
      iconTone: 'text-indigo-600 dark:text-indigo-400 bg-indigo-500/10',
      title: 'Personal deductible',
      subtitle: 'Claimed as tax deduction',
      amount: formatCurrency(account.contributions.personalDeductible),
    });
  }

  if (account.contributions.personalNonDeductible > 0) {
    rows.push({
      id: 'pnd',
      icon: Receipt,
      iconTone: 'text-violet-600 dark:text-violet-400 bg-violet-500/10',
      title: 'Non-concessional',
      subtitle: 'After-tax + spouse + co-contrib',
      amount: formatCurrency(account.contributions.personalNonDeductible),
    });
  }

  return (
    <div className="relative overflow-hidden rounded-[16px] border border-foreground/10 bg-card/70 p-6 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] dark:border-foreground/20 dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Linked entities</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">Contributions breakdown</h2>
        {rows.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No contributions tracked yet this FY. Employer SG, salary sacrifice and personal contributions will appear here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-foreground/10">
            {rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 py-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${row.iconTone}`}>
                  <row.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{row.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{row.subtitle}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{row.amount}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function RecentActivityCard({ recent }: { recent: RecentContribution[] }) {
  return (
    <div className="relative overflow-hidden rounded-[16px] border border-foreground/10 bg-card/70 p-6 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] dark:border-foreground/20 dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recent activity</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">Transaction rhythm</h2>
        {recent.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No contribution activity recorded yet. Recent contributions will appear here once tracked.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-foreground/10">
            {recent.map((c) => (
              <li key={c.id} className="flex items-center gap-3 py-3">
                <span className="w-16 shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{shortDate(c.date)}</span>
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05]">
                  <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {contributionTypeLabel(c.type)}
                  {c.employerName ? <span className="text-muted-foreground"> · {c.employerName}</span> : null}
                </p>
                <p className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">+{formatCurrency(c.amount)}</p>
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
