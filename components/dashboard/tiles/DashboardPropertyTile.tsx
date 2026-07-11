'use client';

/**
 * DashboardPropertyTile — Phase 45.3 (CLAUDE.md §18.7.2 polished sub-pattern).
 *
 * Glass tile for the Properties tab on `/dashboard`. Replaces the inline
 * vanilla shadcn `<Card>` block previously at `app/dashboard/page.tsx:984`.
 * Visual vocabulary mirrors `PropertyTile.tsx` + the Properties Asset
 * Spotlight detail page so clicking through reads as a continuation of the
 * same design language, not a system jump.
 *
 * Stitch source: project `1859462351962811110`, screen
 * `72f8b7a14d4e432880eb3c916c2b18fb` + 3 sibling variants at
 * `.stitch/designs/phase45.3/dashboard-properties-tab{,-dark,-mobile,-mobile-dark}-v1.{html,png}`.
 *
 * Sub-palette: sky→indigo (matches the Properties Asset Spotlight + the
 * §18.7.5 mapping table).
 *
 * Data contract: consumes the shape `PortfolioSnapshot.properties[number]`
 * from `app/dashboard/page.tsx`. **NO backend changes** — purely a vocabulary
 * swap (Reza directive 2026-06-09 "no backend changes to the tiles").
 *
 * Behaviour-psychology lens (§0):
 *   - Negative monthly cashflow rendered in amber, NEVER red — the
 *     §18.7.2 money-signal row reserves red for genuine destructive
 *     actions only.
 *   - 80%+ LVR shows an inline "High" tone tag in amber, not a banner —
 *     calmly informative.
 */

import Link from 'next/link';
import { ArrowUpRight, ChevronRight, Home as HomeIcon, KeyRound } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

const formatCompactCurrency = (amount: number) => formatCurrency(amount, { abbreviate: true });

interface DashboardPropertyTileProps {
  property: {
    id: string;
    name: string;
    type: string;
    marketValue: number;
    equity: number;
    lvr: number;
    rentalYield: number;
    cashflow: { monthlyNet: number };
  };
  href?: string;
}

export function DashboardPropertyTile({ property, href }: DashboardPropertyTileProps) {
  const isInvestment = property.type === 'INVESTMENT';
  const isRental = property.type === 'RENTAL';
  const TypeIcon = isInvestment ? ArrowUpRight : isRental ? KeyRound : HomeIcon;
  const typeLabel = isInvestment ? 'INVESTMENT' : isRental ? 'RENTAL' : 'HOME';
  const lvrIsHigh = property.lvr >= 80;
  const cashflowIsPositive = property.cashflow.monthlyNet >= 0;
  const tileHref = href ?? `/dashboard/properties/${encodeURIComponent(property.id)}`;

  return (
    <Link
      href={tileHref}
      className="
        group relative block overflow-hidden rounded-[22px] border border-foreground/10
        bg-gradient-to-br from-sky-50/40 to-card/70 backdrop-blur-xl
        shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_36px_rgba(15,23,42,0.08)]
        transition-transform duration-300 hover:-translate-y-0.5
        dark:border-foreground/20 dark:from-sky-500/[0.08] dark:to-card/70
        dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]
      "
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-sky-500 to-indigo-500" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10"
      />

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/30">
              <TypeIcon className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <span className="bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text text-[10px] font-bold uppercase tracking-[0.16em] text-transparent">
              {typeLabel}
            </span>
          </div>
          <ChevronRight
            className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground"
            strokeWidth={1.5}
          />
        </div>

        {/* Title */}
        <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
          {property.name}
        </h3>

        {/* Value row */}
        <div className="mt-4 grid grid-cols-2 gap-4 border-b border-foreground/10 pb-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Market Value
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
              {formatCompactCurrency(property.marketValue)}
            </p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Equity
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
              {formatCompactCurrency(property.equity)}
            </p>
          </div>
        </div>

        {/* Mini grid */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              LVR
            </p>
            <p
              className={`mt-1 text-base font-semibold tabular-nums ${
                lvrIsHigh ? 'text-amber-700 dark:text-amber-300' : 'text-foreground'
              }`}
            >
              {property.lvr.toFixed(1)}%
            </p>
          </div>
          {/* MON-033: a PRIMARY RESIDENCE has no rental yield — gate on
              isInvestment, matching PropertyTile + the detail page (MON-022). */}
          {isInvestment && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Rental Yield
              </p>
              <p className="mt-1 text-base font-semibold tabular-nums text-foreground">
                {property.rentalYield.toFixed(1)}%
              </p>
            </div>
          )}
        </div>

        {/* Monthly cashflow */}
        {property.cashflow.monthlyNet !== 0 && (
          <div className="mt-4 flex items-center justify-between border-t border-foreground/10 pt-3">
            <span className="text-xs text-muted-foreground">Monthly Cash Flow</span>
            <span
              className={`text-sm font-semibold tabular-nums ${
                cashflowIsPositive
                  ? 'text-emerald-700 dark:text-emerald-300'
                  : 'text-amber-700 dark:text-amber-300'
              }`}
            >
              {cashflowIsPositive ? '+' : ''}
              {formatCurrency(property.cashflow.monthlyNet)}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
