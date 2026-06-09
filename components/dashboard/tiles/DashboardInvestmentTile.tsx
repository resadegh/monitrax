'use client';

/**
 * DashboardInvestmentTile — Phase 45.3 (CLAUDE.md §18.7.2 polished sub-pattern).
 *
 * Glass tile for the Investments tab on `/dashboard`. Replaces the inline
 * vanilla shadcn `<Card>` block previously at `app/dashboard/page.tsx:1053`.
 * Sub-palette = indigo→violet, matching the investments Asset Spotlight
 * detail page at `/dashboard/investments/accounts/[id]` per the §18.7.5
 * mapping table (Stage I Invest "growth horizon" mood).
 *
 * Stitch source: project `1859462351962811110`, screen
 * `8f02b8eb4b654e68a1e03e367b16c292` + 3 sibling variants at
 * `.stitch/designs/phase45.3/dashboard-investments-tab{,-dark,-mobile,-mobile-dark}-v1.{html,png}`.
 *
 * Data contract: consumes the shape
 * `PortfolioSnapshot.investments.accounts[number]` from
 * `app/dashboard/page.tsx`. The optional `incomeNode` slot lets the page
 * inject the existing `<InvestmentIncomeDisplay compact />` so the
 * income-by-account chip continues to surface — preserves the existing
 * functionality the previous card had, just rehoused in the new glass
 * vocabulary. **NO backend changes** (Reza directive 2026-06-09).
 *
 * Behaviour-psychology lens (§0): the "Add holdings" CTA is a calm
 * achievable next action when the account is empty (Bandura self-efficacy
 * — celebrate the next achievable step, never list what's missing).
 */

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight, Plus, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';

const formatCompactCurrency = (amount: number) => formatCurrency(amount, { abbreviate: true });

interface DashboardInvestmentTileProps {
  account: {
    id: string;
    name: string;
    type: string;
    totalValue: number;
    holdings: Array<{ ticker: string; type: string; currentValue: number }>;
  };
  href?: string;
  /**
   * Slot for the existing `<InvestmentIncomeDisplay compact />` chip so the
   * income-by-account context the old card surfaced is preserved in the
   * new vocabulary without re-implementing it here. Inject from the page.
   */
  incomeNode?: ReactNode;
}

export function DashboardInvestmentTile({ account, href, incomeNode }: DashboardInvestmentTileProps) {
  const tileHref = href ?? `/dashboard/investments/accounts/${encodeURIComponent(account.id)}`;
  const holdingsCount = account.holdings.length;
  const holdingsLabel = `${holdingsCount} ${holdingsCount === 1 ? 'holding' : 'holdings'}`;
  const topHoldings = account.holdings.slice(0, 3);
  const remaining = holdingsCount - topHoldings.length;

  return (
    <Link
      href={tileHref}
      className="
        group relative block overflow-hidden rounded-[22px] border border-foreground/10
        bg-gradient-to-br from-indigo-50/40 to-card/70 backdrop-blur-xl
        shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_36px_rgba(15,23,42,0.08)]
        transition-transform duration-300 hover:-translate-y-0.5
        dark:border-foreground/20 dark:from-indigo-500/[0.08] dark:to-card/70
        dark:shadow-[0_1px_2px_rgba(0,0,0,0.30),inset_0_1px_0_0_rgba(255,255,255,0.04)]
      "
    >
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 to-violet-500" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[40%] bg-gradient-to-b from-white/40 to-transparent opacity-60 dark:from-white/10"
      />

      <div className="relative p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
              <TrendingUp className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <span className="bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-[10px] font-bold uppercase tracking-[0.16em] text-transparent">
              {account.type}
            </span>
          </div>
          <ChevronRight
            className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground"
            strokeWidth={1.5}
          />
        </div>

        {/* Title */}
        <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
          {account.name}
        </h3>

        {/* Hero value */}
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Total Value
        </p>
        <p className="mt-1 bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-3xl font-semibold tracking-tight tabular-nums text-transparent">
          {formatCompactCurrency(account.totalValue)}
        </p>

        {/* Helper row: holdings count + optional income chip */}
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">{holdingsLabel}</span>
          {incomeNode}
        </div>

        {/* Top holdings preview (when present) */}
        {topHoldings.length > 0 && (
          <ul className="mt-4 space-y-1.5 border-t border-foreground/10 pt-3">
            {topHoldings.map((holding, i) => (
              <li key={`${holding.ticker}-${i}`} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-foreground/[0.06] px-1.5 py-0.5 font-semibold tabular-nums text-foreground">
                    {holding.ticker}
                  </span>
                  <span className="text-muted-foreground">{holding.type}</span>
                </div>
                <span className="font-medium tabular-nums text-foreground">
                  {formatCompactCurrency(holding.currentValue)}
                </span>
              </li>
            ))}
            {remaining > 0 && (
              <li className="text-xs text-muted-foreground">+{remaining} more</li>
            )}
          </ul>
        )}

        {/* Empty-state CTA — psychology lens: celebrate next achievable action */}
        {holdingsCount === 0 && (
          <div
            className="
              mt-4 inline-flex items-center gap-1.5 rounded-full
              border border-indigo-200/60 bg-indigo-50 px-3 py-1
              text-xs font-semibold text-indigo-700
              dark:border-indigo-400/30 dark:bg-indigo-500/10 dark:text-indigo-300
            "
          >
            <Plus className="h-3 w-3" strokeWidth={1.5} />
            Add holdings
          </div>
        )}
      </div>
    </Link>
  );
}
