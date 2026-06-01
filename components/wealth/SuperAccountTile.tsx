'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { appleEase, springSnap as springy } from '@/components/shell/motion';
import { Edit2, Eye, Landmark, Trash2, TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { SuperFilledGlyph } from '@/components/wealth/wealthGlyphs';

/**
 * SuperAccountTile — Stage I (Invest) glass tile for a single
 * superannuation fund (My Wealth → Superannuation, Phase 39.4).
 *
 * Visual vocabulary mirrors components/investments/InvestmentAccountTile.tsx
 * and components/properties/PropertyTile.tsx (CLAUDE.md §18.7.2): glass
 * surface, indigo→violet Super sub-palette, atmosphere mesh, oversized
 * SuperFilledGlyph (classical column) watermark bleeding off the right
 * edge, 3px gradient top strip, springy hover-lift, gradient CTA. Money
 * signal: emerald gain pill reserved for positive 1-yr return only; balance
 * stays neutral tabular-nums (gradient text is reserved for the hero).
 *
 * Stitch design: project 5991501424852019479, screens
 * 1c01d0c1e990458899afbf2f68d5a615 (desktop) / e7a87730d34844ab8c170c9d86fc01b9
 * (mobile). See .stitch/designs/super-wealth-{desktop,mobile}.{html,png}.
 */

export interface SuperAccountTileData {
  id: string;
  /** Account nickname (e.g. "My Super"). */
  name: string;
  /** Fund name (e.g. "AustralianSuper"). */
  fundName: string | null;
  memberNumber: string | null;
  currentBalance: number;
  taxableComponent: number;
  taxFreeComponent: number;
  investmentOption: string | null;
  /** 1-year return as a percentage (e.g. 8.2 for +8.2%). */
  returns1Year: number | null;
}

export interface SuperAccountTileProps {
  account: SuperAccountTileData;
  index?: number;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function SuperAccountTile({ account, index = 0, onView, onEdit, onDelete }: SuperAccountTileProps) {
  const reduced = useReducedMotion() ?? false;
  // Fund name is the headline identity; nickname is the subtitle. Fall back
  // gracefully when a user only entered one of the two.
  const title = account.fundName || account.name;
  const subtitle = account.fundName ? account.name : null;
  const hasReturn = typeof account.returns1Year === 'number' && Number.isFinite(account.returns1Year);
  const positiveReturn = hasReturn && (account.returns1Year as number) >= 0;

  return (
    <motion.div
      layout
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.55, ease: appleEase, delay: 0.04 * index }}
      whileHover={reduced ? undefined : { y: -3 }}
      className="group relative isolate overflow-hidden rounded-[22px] border border-indigo-300/40 dark:border-indigo-700/30 bg-indigo-50/60 dark:bg-indigo-950/25 backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] transition-[background-color,border-color,box-shadow] duration-500 group-hover:bg-indigo-100/80 dark:group-hover:bg-indigo-900/40 hover:border-indigo-400/70 dark:hover:border-indigo-500/55 hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_18px_48px_rgba(15,23,42,0.10)]"
    >
      {/* Atmosphere — Super indigo/violet wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            'radial-gradient(440px 240px at 100% 100%, rgba(79,70,229,0.16), transparent 60%), radial-gradient(380px 200px at 0% 0%, rgba(99,102,241,0.10), transparent 60%)',
        }}
      />

      {/* Oversized filled column glyph watermark */}
      <div
        aria-hidden
        className="pointer-events-none absolute -z-10 inset-y-0 left-0 right-[-12%] text-indigo-600 dark:text-indigo-400 opacity-[0.06] transition-opacity duration-500 group-hover:opacity-[0.12]"
      >
        <SuperFilledGlyph delay={0.04 * index} className="h-full w-full" />
      </div>

      {/* Top accent strip */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-indigo-500 to-violet-500" />

      <div className="p-5 sm:p-6">
        {/* Header: badge + fund + actions */}
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/15 to-violet-500/15 ring-1 ring-indigo-400/25">
            <Landmark className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          </div>

          <div className="min-w-0 flex-1">
            <span className="inline-flex items-center bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-[10px] font-bold uppercase tracking-[0.14em] text-transparent">
              Super fund
            </span>
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground">{title}</h3>
            {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>

          <div className="flex shrink-0 items-center gap-1 opacity-0 translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 sm:flex">
            <button
              type="button"
              onClick={onEdit}
              title="Edit"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              title="Delete"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Balance */}
        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Balance</p>
          <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {formatCurrency(account.currentBalance)}
          </p>
        </div>

        {/* Tax-free / Taxable component split */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-indigo-300/40 dark:border-indigo-700/30 bg-background/40 px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tax-free</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{formatCurrency(account.taxFreeComponent)}</p>
          </div>
          <div className="rounded-xl border border-indigo-300/40 dark:border-indigo-700/30 bg-background/40 px-3.5 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Taxable</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{formatCurrency(account.taxableComponent)}</p>
          </div>
        </div>

        {/* Pills: 1-yr return + option + member */}
        {(hasReturn || account.investmentOption || account.memberNumber) && (
          <div className="mt-5 flex flex-wrap items-center gap-1.5 border-t border-foreground/[0.06] pt-4">
            {hasReturn && positiveReturn && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
                <TrendingUp className="h-2.5 w-2.5" />
                1yr +{(account.returns1Year as number).toFixed(1)}%
              </span>
            )}
            {hasReturn && !positiveReturn && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-500/20 dark:text-amber-300">
                1yr {(account.returns1Year as number).toFixed(1)}%
              </span>
            )}
            {account.investmentOption && <GhostPill label={account.investmentOption} />}
            {account.memberNumber && <GhostPill label={`ID ${account.memberNumber}`} />}
          </div>
        )}

        {/* Primary CTA */}
        <motion.button
          type="button"
          onClick={onView}
          whileHover={reduced ? undefined : { y: -1 }}
          whileTap={reduced ? undefined : { scale: 0.98 }}
          transition={springy}
          className="mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/15 transition-shadow hover:shadow-lg hover:shadow-indigo-500/25"
        >
          <Eye className="h-4 w-4" />
          View details
        </motion.button>
      </div>
    </motion.div>
  );
}

function GhostPill({ label }: { label: string }) {
  return (
    <span className="inline-flex max-w-[12rem] items-center truncate rounded-full border border-foreground/10 bg-background/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur">
      {label}
    </span>
  );
}
