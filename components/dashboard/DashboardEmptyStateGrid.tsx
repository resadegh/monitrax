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
import {
  EmptyStateTile,
  type EmptyStateTilePriority,
  type EmptyStateTileConfidence,
} from './EmptyStateTile';
// Phase 12 twin-track (A.3/A.5): consume per-module progress from
// useSetupState so the grid can derive priority + confidence per tile.
import {
  useSetupState,
  type UseSetupStateModuleKey,
  type UseSetupStateModuleProgress,
} from '@/hooks/useSetupState';
import { useBasiqEnabled } from '@/lib/featureFlags/BasiqGateContext';

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
    whyThisMatters: 'So we can calculate real equity and loan-to-value ratios',
    cta: { label: 'Add your first property', href: '/dashboard/properties?action=add' },
  },
  accounts: {
    icon: Banknote,
    title: 'Connect your bank',
    description: 'Import accounts, balances, and transactions in 60 seconds.',
    unlocks: 'Unlocks live cashflow',
    whyThisMatters: 'So we can track your burn without manual entry',
    cta: { label: 'Connect a bank', href: '/dashboard/balances?action=connect-basiq' },
    secondaryCta: { label: 'Add manually', href: '/dashboard/balances?action=add-account' },
  },
  income: {
    icon: Wallet,
    title: 'Add your income',
    description: 'Salaries, rent, side income — anything that lands in your account.',
    unlocks: 'Powers cashflow forecasts',
    whyThisMatters: 'So we can calculate your real savings rate',
    cta: { label: 'Add your first income', href: '/dashboard/income?action=add' },
  },
  expenses: {
    icon: Receipt,
    title: 'Track your expenses',
    description: 'Recurring bills, subscriptions, and everyday spending in one view.',
    unlocks: 'Unlocks budget tracking',
    whyThisMatters: 'So we can spot leaks and find money you can redirect',
    cta: { label: 'Add your first expense', href: '/dashboard/expenses?action=add' },
  },
  investments: {
    icon: TrendingUp,
    title: 'Add your investments',
    description: 'Shares, ETFs, managed funds — see returns and contributions over time.',
    unlocks: 'Unlocks portfolio tracking',
    whyThisMatters: 'So we can show your capital gains and tax position',
    cta: { label: 'Add an investment', href: '/dashboard/investments/accounts?action=add' },
  },
  loans: {
    icon: CreditCard,
    title: 'Track your loans',
    description: 'Mortgages, car loans, HECS — see balance, rate, and repayment progress.',
    unlocks: 'Unlocks debt-quality scoring',
    whyThisMatters: 'So we can surface refinance opportunities and debt strategies',
    cta: { label: 'Add a loan', href: '/dashboard/balances?action=add-loan' },
  },
} as const;

// =============================================================================
// PHASE 12 TWIN-TRACK (A.3) — SHARED TILE PROPS FORWARDER
// =============================================================================

/**
 * Shared props accepted by every concrete EmptyState* component.
 * Forwarded unchanged to the underlying `<EmptyStateTile />`.
 */
interface ConcreteTileProps {
  compact?: boolean;
  priority?: EmptyStateTilePriority;
  confidenceState?: EmptyStateTileConfidence;
}

export function PropertiesEmptyState({
  compact,
  priority,
  confidenceState,
}: ConcreteTileProps = {}) {
  const t = TILE_COPY.properties;
  return (
    <EmptyStateTile
      illustration={<PlaceholderIllustration icon={t.icon} />}
      title={t.title}
      description={t.description}
      unlocks={t.unlocks}
      whyThisMatters={t.whyThisMatters}
      cta={t.cta}
      compact={compact}
      priority={priority}
      confidenceState={confidenceState}
    />
  );
}

export function AccountsEmptyState({
  compact,
  priority,
  confidenceState,
}: ConcreteTileProps = {}) {
  const t = TILE_COPY.accounts;
  const basiqEnabled = useBasiqEnabled();
  // When Basiq is OFF, hide the Connect-Bank CTA + reword copy so the
  // tile guides the user to the file-import / manual-add path that
  // IS available. Tile still renders — we want to capture accounts;
  // we just can't offer the 60-second bank-connect path right now.
  const title = basiqEnabled ? t.title : 'Add your accounts';
  const description = basiqEnabled
    ? t.description
    : 'Add accounts and balances manually or import from a CSV export.';
  const cta = basiqEnabled
    ? t.cta
    : { label: 'Add account', href: '/dashboard/balances?action=add-account' };
  const secondaryCta = basiqEnabled ? t.secondaryCta : undefined;
  return (
    <EmptyStateTile
      illustration={<PlaceholderIllustration icon={t.icon} />}
      title={title}
      description={description}
      unlocks={t.unlocks}
      whyThisMatters={t.whyThisMatters}
      cta={cta}
      secondaryCta={secondaryCta}
      compact={compact}
      priority={priority}
      confidenceState={confidenceState}
    />
  );
}

export function IncomeEmptyState({
  compact,
  priority,
  confidenceState,
}: ConcreteTileProps = {}) {
  const t = TILE_COPY.income;
  return (
    <EmptyStateTile
      illustration={<PlaceholderIllustration icon={t.icon} />}
      title={t.title}
      description={t.description}
      unlocks={t.unlocks}
      whyThisMatters={t.whyThisMatters}
      cta={t.cta}
      compact={compact}
      priority={priority}
      confidenceState={confidenceState}
    />
  );
}

export function ExpensesEmptyState({
  compact,
  priority,
  confidenceState,
}: ConcreteTileProps = {}) {
  const t = TILE_COPY.expenses;
  return (
    <EmptyStateTile
      illustration={<PlaceholderIllustration icon={t.icon} />}
      title={t.title}
      description={t.description}
      unlocks={t.unlocks}
      whyThisMatters={t.whyThisMatters}
      cta={t.cta}
      compact={compact}
      priority={priority}
      confidenceState={confidenceState}
    />
  );
}

export function InvestmentsEmptyState({
  compact,
  priority,
  confidenceState,
}: ConcreteTileProps = {}) {
  const t = TILE_COPY.investments;
  return (
    <EmptyStateTile
      illustration={<PlaceholderIllustration icon={t.icon} />}
      title={t.title}
      description={t.description}
      unlocks={t.unlocks}
      whyThisMatters={t.whyThisMatters}
      cta={t.cta}
      compact={compact}
      priority={priority}
      confidenceState={confidenceState}
    />
  );
}

export function LoansEmptyState({
  compact,
  priority,
  confidenceState,
}: ConcreteTileProps = {}) {
  const t = TILE_COPY.loans;
  return (
    <EmptyStateTile
      illustration={<PlaceholderIllustration icon={t.icon} />}
      title={t.title}
      description={t.description}
      unlocks={t.unlocks}
      whyThisMatters={t.whyThisMatters}
      cta={t.cta}
      compact={compact}
      priority={priority}
      confidenceState={confidenceState}
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
// Phase 12 twin-track (A.3) — shared priority chain used by the grid.
// Matches the SetupNextActionPanel priority chain (A.2) so both
// surfaces agree on which tile is "the one to do next".
const PRIORITY_CHAIN: UseSetupStateModuleKey[] = [
  'accounts',
  'income',
  'expenses',
  'properties',
  'loans',
  'investments',
];

/**
 * Derives priority assignments for the 6 tiles from module progress.
 * Returns a map `{ accounts: 'primary', income: 'secondary', ... }`.
 *
 * Rules:
 *   - First Missing module in PRIORITY_CHAIN → primary
 *   - Next 2 Missing modules                 → secondary
 *   - Remaining Missing modules              → dimmed
 *   - Estimated modules                      → secondary (refinement target)
 *   - Verified modules                       → dimmed (already done)
 */
function derivePriorityMap(
  modules: UseSetupStateModuleProgress[]
): Record<UseSetupStateModuleKey, EmptyStateTilePriority> {
  const byKey = new Map(modules.map((m) => [m.module, m]));
  const map: Partial<Record<UseSetupStateModuleKey, EmptyStateTilePriority>> = {};

  let primaryAssigned = false;
  let secondaryCount = 0;

  // First pass: assign primary + up to 2 secondaries from the Missing chain.
  for (const key of PRIORITY_CHAIN) {
    const progress = byKey.get(key);
    if (!progress || progress.state !== 'Missing') continue;
    if (!primaryAssigned) {
      map[key] = 'primary';
      primaryAssigned = true;
    } else if (secondaryCount < 2) {
      map[key] = 'secondary';
      secondaryCount++;
    } else {
      map[key] = 'dimmed';
    }
  }

  // Second pass: Estimated modules become secondary if we still have room.
  for (const key of PRIORITY_CHAIN) {
    if (map[key]) continue;
    const progress = byKey.get(key);
    if (!progress) {
      map[key] = 'dimmed';
      continue;
    }
    if (progress.state === 'Estimated' && secondaryCount < 3) {
      map[key] = 'secondary';
      secondaryCount++;
    } else {
      map[key] = 'dimmed';
    }
  }

  return map as Record<UseSetupStateModuleKey, EmptyStateTilePriority>;
}

/** Maps the service's ModuleState to the tile's confidence prop. */
function toConfidence(state: UseSetupStateModuleProgress['state']): EmptyStateTileConfidence {
  return state;
}

export function DashboardEmptyStateGrid({
  className = '',
}: {
  className?: string;
}) {
  const { moduleProgress } = useSetupState();

  // When moduleProgress is null (first load, API error, no auth) we
  // default every tile to secondary priority and Missing confidence.
  // This keeps the grid rendering in the same shape the pre-A.3
  // layout used, so there is no flash / reflow.
  const priorityMap = moduleProgress ? derivePriorityMap(moduleProgress) : null;
  const confidenceMap: Record<UseSetupStateModuleKey, EmptyStateTileConfidence> = {
    accounts:    moduleProgress?.find((m) => m.module === 'accounts')?.state    ?? 'Missing',
    properties:  moduleProgress?.find((m) => m.module === 'properties')?.state  ?? 'Missing',
    income:      moduleProgress?.find((m) => m.module === 'income')?.state      ?? 'Missing',
    expenses:    moduleProgress?.find((m) => m.module === 'expenses')?.state    ?? 'Missing',
    investments: moduleProgress?.find((m) => m.module === 'investments')?.state ?? 'Missing',
    loans:       moduleProgress?.find((m) => m.module === 'loans')?.state       ?? 'Missing',
  };

  return (
    <section
      aria-label="Set up your dashboard"
      className={`grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 ${className}`}
    >
      <AccountsEmptyState
        compact
        priority={priorityMap?.accounts}
        confidenceState={toConfidence(confidenceMap.accounts)}
      />
      <PropertiesEmptyState
        compact
        priority={priorityMap?.properties}
        confidenceState={toConfidence(confidenceMap.properties)}
      />
      <IncomeEmptyState
        compact
        priority={priorityMap?.income}
        confidenceState={toConfidence(confidenceMap.income)}
      />
      <ExpensesEmptyState
        compact
        priority={priorityMap?.expenses}
        confidenceState={toConfidence(confidenceMap.expenses)}
      />
      <InvestmentsEmptyState
        compact
        priority={priorityMap?.investments}
        confidenceState={toConfidence(confidenceMap.investments)}
      />
      <LoansEmptyState
        compact
        priority={priorityMap?.loans}
        confidenceState={toConfidence(confidenceMap.loans)}
      />
    </section>
  );
}

export default DashboardEmptyStateGrid;
