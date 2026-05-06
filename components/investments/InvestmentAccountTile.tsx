'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { appleEase, springSnap as springy } from '@/components/shell/motion';
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  Coins,
  DollarSign,
  Edit2,
  Eye,
  Gem,
  Receipt,
  Shield,
  Trash2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { formatCurrency } from '@/lib/utils/formatters';
import { AccountGlyph } from '@/components/wealth/wealthGlyphs';

/**
 * InvestmentAccountTile — Stage I (Invest) v4 tile pattern, applied to
 * investment accounts (Phase 39.2).
 *
 * Visual vocabulary mirrors components/properties/PropertyTile.tsx —
 * glassmorphic surface, atmosphere mesh, hue tint that intensifies on
 * hover, top accent strip, large filled silhouette glyph, springy
 * hover-lift, gradient CTA. Per-account-type palettes share the
 * sky/indigo Invest family.
 */


export type InvestmentAccountType = 'BROKERAGE' | 'SUPERS' | 'FUND' | 'TRUST' | 'ETF_CRYPTO';

export interface InvestmentAccountTileData {
  id: string;
  name: string;
  type: InvestmentAccountType;
  platform: string | null;
  currency: string;
  totalValue: number; // holdings value + cash
  cashBalance: number;
  holdingsCount: number;
  transactionsCount: number;
  incomeCount: number;
  expenseCount: number;
}

export interface InvestmentAccountTileProps {
  account: InvestmentAccountTileData;
  index?: number;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function typeMeta(type: InvestmentAccountType) {
  switch (type) {
    case 'BROKERAGE':
      // Sky — direct market access, ascendant
      return {
        label: 'Brokerage',
        icon: BarChart3,
        accent: 'from-sky-500 to-cyan-500',
        iconBg: 'from-sky-500/15 to-cyan-500/15',
        iconRing: 'ring-sky-400/25',
        iconColor: 'text-sky-600 dark:text-sky-400',
        cta: 'from-sky-500 to-cyan-600',
        ctaShadowDefault: 'shadow-sky-500/15',
        ctaShadowHover: 'hover:shadow-sky-500/25',
        tileBg: 'bg-sky-50/60 dark:bg-sky-950/25 group-hover:bg-sky-100/80 dark:group-hover:bg-sky-900/40',
        tileBorder: 'border-sky-300/40 dark:border-sky-700/30 group-hover:border-sky-400/70 dark:group-hover:border-sky-500/55',
        glyphColor: 'text-sky-600 dark:text-sky-400',
        atmosphere:
          'radial-gradient(440px 240px at 100% 0%, rgba(14,165,233,0.16), transparent 60%), radial-gradient(420px 220px at 0% 100%, rgba(34,211,238,0.10), transparent 60%)',
      };
    case 'SUPERS':
      // Indigo — long-term, foundational
      return {
        label: 'Superannuation',
        icon: Shield,
        accent: 'from-indigo-500 to-violet-500',
        iconBg: 'from-indigo-500/15 to-violet-500/15',
        iconRing: 'ring-indigo-400/25',
        iconColor: 'text-indigo-600 dark:text-indigo-400',
        cta: 'from-indigo-500 to-violet-600',
        ctaShadowDefault: 'shadow-indigo-500/15',
        ctaShadowHover: 'hover:shadow-indigo-500/25',
        tileBg: 'bg-indigo-50/60 dark:bg-indigo-950/25 group-hover:bg-indigo-100/80 dark:group-hover:bg-indigo-900/40',
        tileBorder: 'border-indigo-300/40 dark:border-indigo-700/30 group-hover:border-indigo-400/70 dark:group-hover:border-indigo-500/55',
        glyphColor: 'text-indigo-600 dark:text-indigo-400',
        atmosphere:
          'radial-gradient(440px 240px at 100% 100%, rgba(79,70,229,0.16), transparent 60%), radial-gradient(380px 200px at 0% 0%, rgba(99,102,241,0.10), transparent 60%)',
      };
    case 'FUND':
      // Blue — managed, flowing
      return {
        label: 'Managed fund',
        icon: TrendingUp,
        accent: 'from-blue-500 to-sky-500',
        iconBg: 'from-blue-500/15 to-sky-500/15',
        iconRing: 'ring-blue-400/25',
        iconColor: 'text-blue-600 dark:text-blue-400',
        cta: 'from-blue-500 to-sky-600',
        ctaShadowDefault: 'shadow-blue-500/15',
        ctaShadowHover: 'hover:shadow-blue-500/25',
        tileBg: 'bg-blue-50/60 dark:bg-blue-950/25 group-hover:bg-blue-100/80 dark:group-hover:bg-blue-900/40',
        tileBorder: 'border-blue-300/40 dark:border-blue-700/30 group-hover:border-blue-400/70 dark:group-hover:border-blue-500/55',
        glyphColor: 'text-blue-600 dark:text-blue-400',
        atmosphere:
          'radial-gradient(440px 240px at 50% 0%, rgba(59,130,246,0.16), transparent 60%), radial-gradient(420px 220px at 100% 100%, rgba(14,165,233,0.10), transparent 60%)',
      };
    case 'TRUST':
      // Violet — protected, held in trust
      return {
        label: 'Trust',
        icon: Building2,
        accent: 'from-violet-500 to-purple-500',
        iconBg: 'from-violet-500/15 to-purple-500/15',
        iconRing: 'ring-violet-400/25',
        iconColor: 'text-violet-600 dark:text-violet-400',
        cta: 'from-violet-500 to-purple-600',
        ctaShadowDefault: 'shadow-violet-500/15',
        ctaShadowHover: 'hover:shadow-violet-500/25',
        tileBg: 'bg-violet-50/60 dark:bg-violet-950/25 group-hover:bg-violet-100/80 dark:group-hover:bg-violet-900/40',
        tileBorder: 'border-violet-300/40 dark:border-violet-700/30 group-hover:border-violet-400/70 dark:group-hover:border-violet-500/55',
        glyphColor: 'text-violet-600 dark:text-violet-400',
        atmosphere:
          'radial-gradient(440px 240px at 100% 0%, rgba(139,92,246,0.16), transparent 60%), radial-gradient(380px 200px at 0% 100%, rgba(168,85,247,0.10), transparent 60%)',
      };
    case 'ETF_CRYPTO':
      // Cyan/teal — networked, decentralised
      return {
        label: 'ETF / Crypto',
        icon: Coins,
        accent: 'from-cyan-500 to-teal-500',
        iconBg: 'from-cyan-500/15 to-teal-500/15',
        iconRing: 'ring-cyan-400/25',
        iconColor: 'text-cyan-600 dark:text-cyan-400',
        cta: 'from-cyan-500 to-teal-600',
        ctaShadowDefault: 'shadow-cyan-500/15',
        ctaShadowHover: 'hover:shadow-cyan-500/25',
        tileBg: 'bg-cyan-50/60 dark:bg-cyan-950/25 group-hover:bg-cyan-100/80 dark:group-hover:bg-cyan-900/40',
        tileBorder: 'border-cyan-300/40 dark:border-cyan-700/30 group-hover:border-cyan-400/70 dark:group-hover:border-cyan-500/55',
        glyphColor: 'text-cyan-600 dark:text-cyan-400',
        atmosphere:
          'radial-gradient(420px 220px at 50% 50%, rgba(6,182,212,0.14), transparent 65%), radial-gradient(320px 180px at 100% 100%, rgba(20,184,166,0.10), transparent 60%)',
      };
  }
}

export function InvestmentAccountTile({ account, index = 0, onView, onEdit, onDelete }: InvestmentAccountTileProps) {
  const reduced = useReducedMotion() ?? false;
  const meta = typeMeta(account.type);
  const Icon = meta.icon;
  const holdingsValue = account.totalValue - account.cashBalance;

  return (
    <motion.div
      layout
      initial={reduced ? { opacity: 1 } : { opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.55, ease: appleEase, delay: 0.04 * index }}
      whileHover={reduced ? undefined : { y: -3 }}
      className={`group relative isolate overflow-hidden rounded-[22px] border ${meta.tileBorder} ${meta.tileBg} backdrop-blur-xl shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_30px_rgba(15,23,42,0.06)] transition-[background-color,border-color,box-shadow] duration-500 hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_18px_48px_rgba(15,23,42,0.10)]`}
    >
      {/* Atmosphere — per-type tonal wash */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-70 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: meta.atmosphere }}
      />

      {/* Large filled silhouette watermark */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -z-10 inset-y-0 left-0 right-[-12%] ${meta.glyphColor} opacity-[0.06] transition-opacity duration-500 group-hover:opacity-[0.12]`}
      >
        <AccountGlyph type={account.type} delay={0.04 * index} className="h-full w-full" />
      </div>

      {/* Top accent strip */}
      <div aria-hidden className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${meta.accent}`} />

      <div className="p-5 sm:p-6">
        {/* Header: icon + name + type label + actions */}
        <div className="flex items-start gap-4">
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${meta.iconBg} ring-1 ${meta.iconRing}`}>
            <Icon className={`h-5 w-5 ${meta.iconColor}`} />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground">{account.name}</h3>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {account.platform ? `${account.platform} · ` : ''}
              {account.currency}
            </p>
            <span className={`mt-2 inline-flex items-center bg-gradient-to-r ${meta.accent} bg-clip-text text-[10px] font-bold uppercase tracking-[0.14em] text-transparent`}>
              {meta.label}
            </span>
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

        {/* Headline value */}
        <div className="mt-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total value</p>
          <p className="mt-0.5 text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {formatCurrency(account.totalValue)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {account.holdingsCount} {account.holdingsCount === 1 ? 'holding' : 'holdings'}
            {account.cashBalance > 0 && (
              <>
                {' · '}cash <span className="tabular-nums">{formatCurrency(account.cashBalance)}</span>
              </>
            )}
          </p>
        </div>

        {/* Two-column KPI row: Holdings value + Cash */}
        {(holdingsValue > 0 || account.cashBalance > 0) && (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className={`rounded-xl border ${meta.tileBorder.split(' ')[0]} bg-background/40 px-3.5 py-3`}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Holdings</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{formatCurrency(holdingsValue)}</p>
            </div>
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3.5 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Cash</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{formatCurrency(account.cashBalance)}</p>
            </div>
          </div>
        )}

        {/* Linked counts */}
        {(account.transactionsCount > 0 || account.incomeCount > 0 || account.expenseCount > 0) && (
          <div className="mt-5 flex flex-wrap gap-1.5 border-t border-foreground/[0.06] pt-4">
            {account.transactionsCount > 0 && (
              <LinkedPill icon={BarChart3} label={`${account.transactionsCount} ${account.transactionsCount === 1 ? 'transaction' : 'transactions'}`} />
            )}
            {account.incomeCount > 0 && (
              <LinkedPill icon={ArrowUpRight} label={`${account.incomeCount} income`} />
            )}
            {account.expenseCount > 0 && (
              <LinkedPill icon={Receipt} label={`${account.expenseCount} ${account.expenseCount === 1 ? 'expense' : 'expenses'}`} />
            )}
          </div>
        )}

        {/* Primary CTA */}
        <motion.button
          type="button"
          onClick={onView}
          whileHover={reduced ? undefined : { y: -1 }}
          whileTap={reduced ? undefined : { scale: 0.98 }}
          transition={springy}
          className={`mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br ${meta.cta} px-4 py-2.5 text-sm font-semibold text-white shadow-md ${meta.ctaShadowDefault} transition-shadow hover:shadow-lg ${meta.ctaShadowHover}`}
        >
          <Eye className="h-4 w-4" />
          View details
        </motion.button>
      </div>
    </motion.div>
  );
}

function LinkedPill({ icon: Icon, label }: { icon: typeof Wallet; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-background/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground backdrop-blur">
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  );
}
