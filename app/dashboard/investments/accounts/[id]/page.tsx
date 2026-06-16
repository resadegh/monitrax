'use client';

/**
 * INVESTMENT ACCOUNT DETAIL PAGE — Phase 45.2.1 — Asset Spotlight (Investments)
 *
 * NEW route scaffolded 2026-06-09. First non-property application of the
 * §18.7.5 Asset Spotlight template; properties shipped the canonical
 * reference in Phase 45.2 (see app/dashboard/properties/[id]/page.tsx).
 *
 * Visual direction locked in the Stitch design pass — full 4-variant
 * matrix at .stitch/designs/phase45.2.1/investments-detail-hero-v4{,-dark,-mobile,-mobile-dark}.{html,png}.
 *
 * Stitch screen IDs (project 1859462351962811110):
 *   Desktop light:  e03029b8a5ca45ec8e1791ac3802fbf1
 *   Desktop dark:   a2ea4a8184b04802aeafe1ce04f05e89
 *   Mobile light:   1fd9058b92934977ad5b205b2899ba34
 *   Mobile dark:    bdc79af3f0774362b36ed49e3617d863
 *
 * Per §18.7.5 per-asset-class mapping:
 *   - Sub-palette: indigo→violet (Stage I Invest)
 *   - Eyebrow: account type label
 *   - Hero value: portfolio value (cash + sum(holding.currentValue))
 *   - Hero secondary: cost basis (sum(holding.totalCostBasis)) + gain %
 *   - Mini-KPI: YTD return / Asset mix / Cash balance
 *   - 4-tile: Dividends / Distributions / Franking / Capital gains
 *
 * Photo (§18.7.4 "decor not evidence"): financial-district skyline at
 * golden hour — generic decor, no provenance implied. Apartment photo
 * from properties detail would mislead on an investment context.
 *
 * v3→v4 delta: only the photo changed (apartment → skyline). The v3
 * generation used Stitch's generate_variants against the v5 properties
 * source so composition, fonts, shadows, spacing, tile rhythm inherit
 * verbatim — sibling not cousin.
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/context/AuthContext';
import DashboardLayout from '@/components/DashboardLayout';
import { DocumentsSection } from '@/components/documents';
import { LinkedEntityType } from '@/lib/documents/types';
import {
  ArrowLeft,
  ArrowUpRight,
  Banknote,
  ChevronRight,
  DollarSign,
  Edit2,
  FileText,
  Landmark,
  PieChart,
  Receipt,
  Sparkles,
  Trash2,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

// =============================================================================
// TYPES
// =============================================================================

type HoldingType = 'SHARES' | 'ETF' | 'MANAGED_FUND' | 'CRYPTO' | 'BOND' | 'OTHER';
type AccountType = 'BROKERAGE' | 'SUPERS' | 'FUND' | 'TRUST' | 'ETF_CRYPTO';
type TxType = 'BUY' | 'SELL' | 'DIVIDEND' | 'DISTRIBUTION' | 'SPLIT' | 'TRANSFER_IN' | 'TRANSFER_OUT';

interface Holding {
  id: string;
  ticker: string;
  name: string | null;
  units: number;
  averagePrice: number;
  currentPrice: number | null;
  currentValue: number | null;
  totalCostBasis: number;
  unrealizedGain: number | null;
  unrealizedGainPct: number | null;
  frankingPercentage: number | null;
  type: HoldingType;
}

interface Transaction {
  id: string;
  date: string;
  type: TxType;
  price: number;
  units: number;
  fees: number | null;
  notes: string | null;
  holding?: { ticker: string } | null;
}

interface InvestmentAccount {
  id: string;
  name: string;
  type: AccountType;
  platform: string | null;
  currency: string;
  openingBalance: number;
  cashBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  holdings: Holding[];
  transactions: Transaction[];
}

// =============================================================================
// KPI HELPERS (inline — matches list-page pattern)
// =============================================================================

function sumHoldingsValue(a: InvestmentAccount): number {
  return a.holdings.reduce((sum, h) => sum + (h.currentValue ?? h.units * h.averagePrice), 0);
}

function sumCostBasis(a: InvestmentAccount): number {
  return a.holdings.reduce((sum, h) => sum + (h.totalCostBasis || h.units * h.averagePrice), 0);
}

function portfolioValue(a: InvestmentAccount): number {
  return sumHoldingsValue(a) + (a.cashBalance ?? 0);
}

function unrealizedGain(a: InvestmentAccount): number {
  const value = sumHoldingsValue(a);
  const cost = sumCostBasis(a);
  return value - cost;
}

function gainPercentage(a: InvestmentAccount): number {
  const cost = sumCostBasis(a);
  if (cost <= 0) return 0;
  return (unrealizedGain(a) / cost) * 100;
}

function ytdReturnPct(a: InvestmentAccount): number {
  // v1: approximate YTD return as overall unrealized gain %. When a
  // canonical performance engine surfaces a true time-weighted return,
  // swap this for a service call. The visual rhythm stays the same.
  return gainPercentage(a);
}

function assetMixLabel(a: InvestmentAccount): string {
  const counts: Partial<Record<HoldingType, number>> = {};
  a.holdings.forEach((h) => {
    counts[h.type] = (counts[h.type] ?? 0) + 1;
  });
  const parts: string[] = [];
  if (counts.ETF) parts.push(`${counts.ETF} ETF${counts.ETF === 1 ? '' : 's'}`);
  if (counts.SHARES) parts.push(`${counts.SHARES} share${counts.SHARES === 1 ? '' : 's'}`);
  if (counts.MANAGED_FUND) parts.push(`${counts.MANAGED_FUND} fund${counts.MANAGED_FUND === 1 ? '' : 's'}`);
  if (counts.CRYPTO) parts.push(`${counts.CRYPTO} crypto`);
  if (counts.BOND) parts.push(`${counts.BOND} bond${counts.BOND === 1 ? '' : 's'}`);
  if (counts.OTHER) parts.push(`${counts.OTHER} other`);
  return parts.length === 0 ? 'No holdings yet' : parts.join(' · ');
}

function sumTxByType(a: InvestmentAccount, type: TxType): number {
  return a.transactions
    .filter((t) => t.type === type)
    .reduce((sum, t) => sum + t.units * t.price, 0);
}

function dividendsTotal(a: InvestmentAccount): number {
  return sumTxByType(a, 'DIVIDEND');
}

function distributionsTotal(a: InvestmentAccount): number {
  return sumTxByType(a, 'DISTRIBUTION');
}

function frankingTotal(a: InvestmentAccount): number {
  // Sum franking on dividends: dividend amount × (frankingPercentage on
  // the holding) × company tax rate 30% / (1 - 30%) gross-up. For v1
  // approximate as dividend × franking%. When the canonical tax engine
  // surfaces franking, swap in the real calc.
  return a.transactions
    .filter((t) => t.type === 'DIVIDEND')
    .reduce((sum, t) => {
      const tickerHolding = a.holdings.find((h) => h.ticker === t.holding?.ticker);
      const fr = (tickerHolding?.frankingPercentage ?? 0) / 100;
      const div = t.units * t.price;
      return sum + div * fr * (0.3 / 0.7);
    }, 0);
}

function realizedGains(a: InvestmentAccount): number {
  // v1: approximate as sum of SELL proceeds minus matched BUY cost via
  // averagePrice — a coarse proxy until the canonical CGT engine surfaces
  // per-transaction realized gains.
  return a.transactions
    .filter((t) => t.type === 'SELL')
    .reduce((sum, t) => {
      const tickerHolding = a.holdings.find((h) => h.ticker === t.holding?.ticker);
      const proceeds = t.units * t.price;
      const cost = t.units * (tickerHolding?.averagePrice ?? 0);
      return sum + (proceeds - cost);
    }, 0);
}

function accountTypeLabel(t: AccountType): string {
  switch (t) {
    case 'BROKERAGE':
      return 'INVESTMENT ACCOUNT';
    case 'SUPERS':
      return 'SUPER FUND';
    case 'FUND':
      return 'MANAGED FUND';
    case 'TRUST':
      return 'INVESTMENT TRUST';
    case 'ETF_CRYPTO':
      return 'ETF · CRYPTO';
  }
}

function txLabel(t: TxType): string {
  switch (t) {
    case 'BUY':
      return 'Buy';
    case 'SELL':
      return 'Sell';
    case 'DIVIDEND':
      return 'Dividend';
    case 'DISTRIBUTION':
      return 'Distribution';
    case 'SPLIT':
      return 'Split';
    case 'TRANSFER_IN':
      return 'Transfer in';
    case 'TRANSFER_OUT':
      return 'Transfer out';
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

// =============================================================================
// PAGE
// =============================================================================

export default function InvestmentAccountDetailPage() {
  const params = useParams();
  const { token } = useAuth();
  const accountId = params.id as string;

  const [account, setAccount] = useState<InvestmentAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId || !token) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/investments/accounts/${accountId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (!cancelled) setAccount(data.data ?? data);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, token]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-500" />
        </div>
      </DashboardLayout>
    );
  }

  if (!account) {
    return (
      <DashboardLayout>
        <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 lg:px-8">
          <Link
            href="/dashboard/investments/accounts"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Investments
          </Link>
          <div className="mt-12 text-center text-muted-foreground">
            Investment account not found.
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const value = portfolioValue(account);
  const cost = sumCostBasis(account);
  const gainPct = gainPercentage(account);
  const ytd = ytdReturnPct(account);
  const mix = assetMixLabel(account);
  const cash = account.cashBalance ?? 0;
  const dividends = dividendsTotal(account);
  const distributions = distributionsTotal(account);
  const franking = frankingTotal(account);
  const capitalGains = realizedGains(account);
  const typeLabel = accountTypeLabel(account.type);

  return (
    <DashboardLayout>
      <div className="relative isolate mx-auto max-w-[1200px] overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
        {/*
          §18.7.4 Cremorne-Wide L1 — financial-district skyline at
          golden hour. opacity-50 keeps it as a premium whisper.
          Decor only; no provenance implied (§18.7.4 "decor not evidence").
        */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-30">
          <Image
            src="/decor/investments-horizon.jpg"
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
            <Link href="/dashboard/investments/accounts" className="hover:text-foreground">Investments</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-foreground">{account.name}</span>
          </div>
          <Link
            href="/dashboard/investments/accounts"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Investments
          </Link>
        </nav>

        {/* HERO CARD */}
        <section className="relative">
          {/* L2 atmospheric halo — indigo→violet behind hero only */}
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-6 -z-10 rounded-[40px] bg-gradient-to-br from-indigo-400/12 to-violet-500/12 blur-[40px] dark:from-indigo-400/8 dark:to-violet-500/8 md:-inset-10 md:blur-[60px]"
          />
          <div
            className="
              relative overflow-hidden rounded-[28px] border border-foreground/10 bg-card/70 backdrop-blur-xl
              shadow-[0_2px_4px_rgba(15,23,42,0.04),0_16px_48px_rgba(15,23,42,0.10),0_32px_80px_rgba(15,23,42,0.06)]
              dark:border-foreground/20 dark:bg-card/70
              dark:shadow-[0_2px_4px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]
            "
          >
            <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 to-violet-500" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10"
            />

            <div className="relative p-6 sm:p-8">
              {/* Top header row */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-[10px] font-bold uppercase tracking-[0.16em] text-transparent">
                    {typeLabel}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Link
                    href="/dashboard/investments/accounts"
                    title="Edit"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Link>
                  <Link
                    href="/dashboard/investments/accounts"
                    title="Delete"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Title + subtitle */}
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {account.name}
              </h1>
              <p className="mt-1 text-base text-muted-foreground">
                {account.platform ?? 'Self-managed'} · {account.currency}
              </p>

              {/* Value row */}
              <div className="mt-6 grid grid-cols-1 gap-4 border-b border-foreground/10 pb-6 sm:grid-cols-2 sm:gap-8">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Current value</p>
                  <p className="mt-1 bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-4xl font-semibold tracking-tight tabular-nums text-transparent">
                    {formatCurrency(value)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Cost basis</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {formatCurrency(cost)}
                  </p>
                  {Math.abs(gainPct) > 0.05 && (
                    <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${gainPct >= 0 ? 'bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/20 dark:bg-emerald-500/14 dark:text-emerald-300 dark:ring-emerald-400/25' : 'bg-amber-500/12 text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300'}`}>
                      {gainPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {gainPct >= 0 ? '+' : ''}
                      {gainPct.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* 3-cell mini-grid */}
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <MiniKpi label="YTD return" value={`${ytd >= 0 ? '+' : ''}${ytd.toFixed(1)}%`} tint="indigo" />
                <MiniKpi label="Asset mix" value={mix} tint="violet" />
                <MiniKpi label="Cash balance" value={formatCurrency(cash)} tint="emerald" />
              </div>
            </div>
          </div>
        </section>

        {/* 4-cell polished KPI row — §18.7.2 polished-tile sub-pattern */}
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <PolishedKpiTile
            label="Dividends"
            value={formatCurrency(dividends)}
            icon={Banknote}
            tint="emerald"
          />
          <PolishedKpiTile
            label="Distributions"
            value={formatCurrency(distributions)}
            icon={TrendingUp}
            tint="sky"
          />
          <PolishedKpiTile
            label="Franking credits"
            value={formatCurrency(franking)}
            icon={Landmark}
            tint="indigo"
          />
          <PolishedKpiTile
            label="Capital gains"
            value={formatCurrency(capitalGains)}
            icon={FileText}
            tint="violet"
            valueTone={capitalGains >= 0 ? 'text-foreground' : 'text-amber-700 dark:text-amber-300'}
          />
        </section>

        {/* Two-column section: Holdings + Activity (left) + Insights (right) */}
        <section className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* LEFT column (2/3 width) */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            <HoldingsCard account={account} />
            <RecentActivityCard account={account} />
            <DocumentsSection
              entityType={LinkedEntityType.INVESTMENT_ACCOUNT}
              entityId={account.id}
              entityLabel={account.name}
            />
          </div>

          {/* RIGHT column (1/3 width) */}
          <div className="flex flex-col gap-5">
            <InsightCard
              icon={Sparkles}
              title="Performance scenarios"
              body="Model how this account's value, asset mix and tax position shift under different return, dividend and rebalancing assumptions."
              cta="View scenarios"
              href="/dashboard/cfo"
              tint="indigo"
            />
            <InsightCard
              icon={FileText}
              title="Tax position"
              body={franking > 0 ? `This portfolio contributed ${formatCurrency(franking)} to franking credits. See its impact in your FY26 tax position.` : 'Track dividends and distributions and they’ll surface in your FY26 tax position.'}
              cta="View tax position"
              href="/dashboard/tax"
              tint="emerald"
            />
            <InsightCard
              icon={PieChart}
              title="Holdings insight"
              body={account.holdings.length > 0 ? `${mix} tracked across this account. View concentration and diversification.` : 'Add holdings to see concentration and diversification analysis.'}
              cta="View breakdown"
              href="/dashboard/investments/holdings"
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

function HoldingsCard({ account }: { account: InvestmentAccount }) {
  return (
    <div className="relative overflow-hidden rounded-[16px] border border-foreground/10 bg-card/70 p-6 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] dark:border-foreground/20 dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Linked entities</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">Portfolio holdings</h2>
        {account.holdings.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No holdings tracked yet. Add holdings from the holdings page and they&rsquo;ll appear here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-foreground/10">
            {account.holdings.map((h) => {
              const v = h.currentValue ?? h.units * h.averagePrice;
              const priceTone = h.unrealizedGainPct == null
                ? 'text-muted-foreground'
                : h.unrealizedGainPct >= 0
                ? 'text-emerald-700 dark:text-emerald-300'
                : 'text-amber-700 dark:text-amber-300';
              return (
                <li key={h.id}>
                  <Link
                    href={`/dashboard/investments/holdings`}
                    className="flex items-center gap-3 py-3 transition-colors hover:bg-foreground/[0.03]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                      <span className="text-[11px] font-bold tracking-wider">{h.ticker.slice(0, 3)}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {h.ticker}
                        {h.name ? <span className="text-muted-foreground"> · {h.name}</span> : null}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {h.units.toLocaleString('en-AU')} units @ {formatCurrency(h.averagePrice)}
                        {h.unrealizedGainPct != null && (
                          <span className={`ml-2 ${priceTone}`}>
                            {h.unrealizedGainPct >= 0 ? '+' : ''}
                            {h.unrealizedGainPct.toFixed(1)}%
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-foreground">{formatCurrency(v)}</p>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function RecentActivityCard({ account }: { account: InvestmentAccount }) {
  const rows = account.transactions.slice(0, 6);
  return (
    <div className="relative overflow-hidden rounded-[16px] border border-foreground/10 bg-card/70 p-6 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_30px_rgba(15,23,42,0.06)] dark:border-foreground/20 dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10" />
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recent activity</p>
        <h2 className="mt-1 text-lg font-semibold text-foreground">Transaction rhythm</h2>
        {rows.length === 0 ? (
          <p className="mt-6 text-sm text-muted-foreground">
            No transactions tracked yet. Buys, dividends and distributions will appear here.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-foreground/10">
            {rows.map((t) => {
              const amount = t.units * t.price;
              const isPositive = t.type === 'DIVIDEND' || t.type === 'DISTRIBUTION' || t.type === 'SELL' || t.type === 'TRANSFER_IN';
              const sign = isPositive ? '+' : '-';
              const tone = isPositive ? 'text-emerald-700 dark:text-emerald-300' : 'text-foreground';
              const ticker = t.holding?.ticker ?? 'Cash';
              const isCashflow = t.type === 'DIVIDEND' || t.type === 'DISTRIBUTION';
              const RowIcon = isCashflow ? TrendingUp : Receipt;
              return (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <span className="w-16 shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{shortDate(t.date)}</span>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05]">
                    <RowIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {txLabel(t.type)} — {ticker}
                    {t.type === 'BUY' || t.type === 'SELL' ? (
                      <span className="text-muted-foreground"> · {t.units.toLocaleString('en-AU')} units</span>
                    ) : null}
                  </p>
                  <p className={`shrink-0 text-sm font-semibold tabular-nums ${tone}`}>{sign}{formatCurrency(amount)}</p>
                </li>
              );
            })}
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
