'use client';

/**
 * DashboardEmptyStateGrid — Phase 12 v3 (D.2)
 *
 * The v3 dashboard's "no data yet" surface. Replaces the legacy
 * `isEmpty` branch on `/dashboard` (a single "Welcome to Monitrax"
 * card with a numbered to-do list and three buttons) with a grid of
 * `<EmptyStateTile>` cards — one per primary entity type — each
 * showing an example placeholder illustration, a one-sentence
 * explanation of what the tile unlocks, and a deep-link CTA to the
 * real dashboard dialog.
 *
 * This is the §2.2 "examples as instruction" pattern from the v3
 * plan, applied at the dashboard level: instead of empty cards with
 * sad zeros, the user sees what each section will become and can
 * click into any of them to start filling it in. No fake data rows,
 * no seeded entities — the illustrations are static SVG placeholder
 * shapes, marked aria-hidden, that read unmistakably as examples.
 *
 * Architecture:
 *   - Pure presentational. Zero state, zero hooks, zero business
 *     logic. Composes the `<EmptyStateTile>` shell from D.1.
 *   - Six concrete empty-state components, each a thin wrapper that
 *     binds the shell to a specific entity's copy + illustration +
 *     CTA. Exporting them individually so consumers can mount one or
 *     two in a tighter grid (e.g. inside the Properties sub-page)
 *     without pulling in the full grid.
 *   - The `<DashboardEmptyStateGrid>` default export is the
 *     dashboard-level mount: a responsive grid of all six tiles.
 *   - All hrefs match the Setup Tray task registry from B.1, so
 *     clicking a tile and clicking a tray task land in the same
 *     real entity dialog. Single source of truth for "where does
 *     adding a property live" (CLAUDE.md §12.2).
 *   - Per CLAUDE.md §6 ground rules: dark-mode native, prefers-
 *     reduced-motion handled by the underlying shell, ARIA region
 *     labelling inherited.
 *
 * What this file does NOT do
 *   - No data fetching. The parent decides whether to render the
 *     grid based on whatever "no data yet" predicate it uses
 *     (typically `snapshot.counts.* === 0` or the existing
 *     `isEmpty` flag on `/dashboard`).
 *   - No conditional per-tile hiding. If the parent passes the
 *     grid, the parent has already decided the user is in the
 *     all-zero empty state. Per-tile gating belongs in the parent.
 *   - No real SVG screenshots. The illustrations are stylised
 *     placeholder shapes (icon + ghost bars inside a dashed
 *     border) so the user reads them as "example, not data" at a
 *     glance. A future micro-fix may replace these with richer
 *     screenshots if the team commissions them.
 *
 * See:
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §2.2 (empty-state tiles)
 *   - docs/blueprint/PHASE_12_REDESIGN_V3.md §10 (5 magic moments)
 *   - components/dashboard/EmptyStateTile.tsx (D.1 shell)
 *   - lib/setup/tasks.ts (the task registry whose hrefs we mirror)
 */

import {
  Home,
  Banknote,
  Wallet,
  Receipt,
  TrendingUp,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';
import { EmptyStateTile } from './EmptyStateTile';

// =============================================================================
// PLACEHOLDER ILLUSTRATION
// =============================================================================

/**
 * Stylised placeholder illustration used by every concrete empty-
 * state component below. Compact, consistent, obviously-not-real.
 * The icon hints at the entity type; the dashed border and ghost
 * bars read as "this is where your data will appear" rather than
 * fake content.
 *
 * Marked `aria-hidden` by the parent `<EmptyStateTile>` shell, so
 * screen readers do not try to interpret it.
 */
function PlaceholderIllustration({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <div className="flex h-24 w-44 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/40">
      <Icon
        className="h-8 w-8 text-slate-400 dark:text-slate-500"
        strokeWidth={1.5}
      />
      <div className="flex flex-col items-center gap-1.5">
        <div className="h-1.5 w-16 rounded-full bg-slate-200 dark:bg-slate-700" />
        <div className="h-1.5 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
      </div>
    </div>
  );
}

// =============================================================================
// CONCRETE EMPTY STATES
// =============================================================================

/**
 * Tile copy lives in this single registry so a future i18n pass can
 * lift it into a translation file without touching the components.
 * Order matches the Setup Tray task ladder (`lib/setup/tasks.ts`).
 */
const TILE_COPY = {
  properties: {
    icon: Home,
    title: 'Track your properties',
    description: 'See equity, LVR, and net worth across every property in one place.',
    unlocks: 'Unlocks net-worth tracking',
    cta: { label: 'Add your first property', href: '/dashboard/properties?action=add' },
  },
  accounts: {
    icon: Banknote,
    title: 'Connect your bank',
    description: 'Import accounts, balances, and transactions in 60 seconds.',
    unlocks: 'Unlocks live cashflow',
    cta: { label: 'Connect a bank', href: '/dashboard/accounts?action=connect-basiq' },
    secondaryCta: { label: 'Add manually', href: '/dashboard/accounts?action=add' },
  },
  income: {
    icon: Wallet,
    title: 'Add your income',
    description: 'Salaries, rent, side income — anything that lands in your account.',
    unlocks: 'Powers cashflow forecasts',
    cta: { label: 'Add your first income', href: '/dashboard/income?action=add' },
  },
  expenses: {
    icon: Receipt,
    title: 'Track your expenses',
    description: 'Recurring bills, subscriptions, and everyday spending in one view.',
    unlocks: 'Unlocks budget tracking',
    cta: { label: 'Add your first expense', href: '/dashboard/expenses?action=add' },
  },
  investments: {
    icon: TrendingUp,
    title: 'Add your investments',
    description: 'Shares, ETFs, managed funds — see returns and contributions over time.',
    unlocks: 'Unlocks portfolio tracking',
    cta: { label: 'Add an investment', href: '/dashboard/investments/accounts?action=add' },
  },
  loans: {
    icon: CreditCard,
    title: 'Track your loans',
    description: 'Mortgages, car loans, HECS — see balance, rate, and repayment progress.',
    unlocks: 'Unlocks debt-quality scoring',
    cta: { label: 'Add a loan', href: '/dashboard/loans?action=add' },
  },
} as const;

export function PropertiesEmptyState({ compact }: { compact?: boolean } = {}) {
  const t = TILE_COPY.properties;
  return (
    <EmptyStateTile
      illustration={<PlaceholderIllustration icon={t.icon} />}
      title={t.title}
      description={t.description}
      unlocks={t.unlocks}
      cta={t.cta}
      compact={compact}
    />
  );
}

export function AccountsEmptyState({ compact }: { compact?: boolean } = {}) {
  const t = TILE_COPY.accounts;
  return (
    <EmptyStateTile
      illustration={<PlaceholderIllustration icon={t.icon} />}
      title={t.title}
      description={t.description}
      unlocks={t.unlocks}
      cta={t.cta}
      secondaryCta={t.secondaryCta}
      compact={compact}
    />
  );
}

export function IncomeEmptyState({ compact }: { compact?: boolean } = {}) {
  const t = TILE_COPY.income;
  return (
    <EmptyStateTile
      illustration={<PlaceholderIllustration icon={t.icon} />}
      title={t.title}
      description={t.description}
      unlocks={t.unlocks}
      cta={t.cta}
      compact={compact}
    />
  );
}

export function ExpensesEmptyState({ compact }: { compact?: boolean } = {}) {
  const t = TILE_COPY.expenses;
  return (
    <EmptyStateTile
      illustration={<PlaceholderIllustration icon={t.icon} />}
      title={t.title}
      description={t.description}
      unlocks={t.unlocks}
      cta={t.cta}
      compact={compact}
    />
  );
}

export function InvestmentsEmptyState({ compact }: { compact?: boolean } = {}) {
  const t = TILE_COPY.investments;
  return (
    <EmptyStateTile
      illustration={<PlaceholderIllustration icon={t.icon} />}
      title={t.title}
      description={t.description}
      unlocks={t.unlocks}
      cta={t.cta}
      compact={compact}
    />
  );
}

export function LoansEmptyState({ compact }: { compact?: boolean } = {}) {
  const t = TILE_COPY.loans;
  return (
    <EmptyStateTile
      illustration={<PlaceholderIllustration icon={t.icon} />}
      title={t.title}
      description={t.description}
      unlocks={t.unlocks}
      cta={t.cta}
      compact={compact}
    />
  );
}

// =============================================================================
// GRID WRAPPER
// =============================================================================

/**
 * The dashboard-level mount: a responsive grid of all six concrete
 * empty-state tiles. Designed to drop into the existing `isEmpty`
 * branch on `/dashboard` (`app/dashboard/page.tsx`) when the
 * `NEXT_PUBLIC_ONBOARDING_V3` flag is on, replacing the legacy
 * "Welcome to Monitrax" card with a richer, deep-linkable grid.
 *
 * Layout:
 *   - 1 column on mobile
 *   - 2 columns on tablet (md)
 *   - 3 columns on desktop (lg)
 *
 * The grid uses the EmptyStateTile shell's `compact` mode so six
 * tiles fit comfortably on a desktop dashboard without making the
 * user scroll past the fold to see the full set.
 */
export function DashboardEmptyStateGrid({
  className = '',
}: {
  className?: string;
}) {
  return (
    <section
      aria-label="Set up your dashboard"
      className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${className}`}
    >
      <AccountsEmptyState compact />
      <PropertiesEmptyState compact />
      <IncomeEmptyState compact />
      <ExpensesEmptyState compact />
      <InvestmentsEmptyState compact />
      <LoansEmptyState compact />
    </section>
  );
}

export default DashboardEmptyStateGrid;
