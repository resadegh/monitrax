/**
 * TRAIL navigation — single source of truth for the consumer dashboard
 * sidebar AND the mobile bottom tab bar.
 *
 * Phase 14.6 (2026-05-08): extracted from `components/DashboardLayout.tsx`
 * so the mobile bottom tab bar (`components/shell/MobileTabBar`) and the
 * desktop sidebar render from the same canonical structure. Per CLAUDE.md
 * §12.2 SSOT: every nav item is defined exactly once here, never duplicated
 * across surfaces.
 *
 * See:
 *  - docs/blueprint/TRAIL_FRAMEWORK.md §5 (sidebar structure + journey)
 *  - docs/architecture/06_UI_UX_FOUNDATION.md §12 (mobile + responsive rules)
 */
import {
  LayoutDashboard,
  Home,
  Wallet,
  FileText,
  Brain,
  Shield,
  Settings,
  Users,
  Target,
  Archive,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavChild {
  name: string;
  href: string;
}

export interface NavItem {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  tourId?: string;
  trailStage?: 'T' | 'R' | 'A' | 'I' | 'L';
  matchRoutes?: string[];
  /** Sub-items shown when this section is active (sidebar accordion + mobile sub-tab pills). */
  children?: NavChild[];
}

/**
 * Canonical sidebar nav. The desktop sidebar renders these in order; the
 * mobile tab bar selects 5 of them via `mobileTabBarKeys` below.
 *
 * Keep this list aligned with `docs/blueprint/TRAIL_FRAMEWORK.md` §5 — it
 * is the structural representation of the TRAIL journey.
 */
export const trailNavItems: NavItem[] = [
  {
    name: 'Home',
    href: '/dashboard',
    icon: LayoutDashboard,
    tourId: 'nav-dashboard',
  },
  {
    name: 'My Household',
    href: '/dashboard/household-profile',
    icon: Users,
    tourId: 'nav-household',
  },
  {
    name: 'My Accounts',
    href: '/dashboard/balances',
    icon: Wallet,
    tourId: 'nav-accounts',
    trailStage: 'T',
    matchRoutes: [
      '/dashboard/balances',
      '/dashboard/activity',
      '/dashboard/entities',
      '/dashboard/accounts',
      '/dashboard/loans',
      '/transactions',
      '/recurring',
    ],
    children: [
      { name: 'Balances', href: '/dashboard/balances' },
      { name: 'Activity', href: '/dashboard/activity' },
      { name: 'My Structure', href: '/dashboard/entities' },
    ],
  },
  {
    name: 'My Budget',
    href: '/cashflow',
    icon: Target,
    tourId: 'nav-budget',
    trailStage: 'R',
    matchRoutes: [
      '/cashflow',
      '/dashboard/plan',
      '/dashboard/budget-analysis',
      '/dashboard/income',
      '/dashboard/expenses',
      '/dashboard/debt-planner',
    ],
    children: [
      { name: 'Cashflow', href: '/cashflow' },
      { name: 'My Plan', href: '/dashboard/plan' },
      { name: 'Debt Freedom', href: '/dashboard/debt-planner' },
    ],
  },
  {
    name: 'My Safety Net',
    href: '/dashboard/safety-net',
    icon: Shield,
    tourId: 'nav-safety-net',
    trailStage: 'A',
    matchRoutes: ['/dashboard/safety-net'],
  },
  {
    name: 'My Wealth',
    href: '/dashboard/properties',
    icon: Home,
    tourId: 'nav-wealth',
    trailStage: 'I',
    matchRoutes: [
      '/dashboard/properties',
      '/dashboard/investments',
      '/dashboard/assets',
    ],
    children: [
      { name: 'Properties', href: '/dashboard/properties' },
      { name: 'Investments', href: '/dashboard/investments/accounts' },
      { name: 'Assets', href: '/dashboard/assets' },
    ],
  },
  {
    name: 'My Guide',
    href: '/dashboard/cfo',
    icon: Brain,
    tourId: 'nav-guide',
    trailStage: 'L',
    matchRoutes: [
      '/dashboard/cfo',
      '/dashboard/cfo/ask',
      '/health',
      '/dashboard/tax',
    ],
    children: [
      { name: 'Actions', href: '/dashboard/cfo' },
      { name: 'Health', href: '/health' },
      { name: 'Tax', href: '/dashboard/tax' },
      { name: 'Ask the Advisor', href: '/dashboard/cfo/ask' },
    ],
  },
  {
    name: 'My Vault',
    href: '/dashboard/documents',
    icon: Archive,
    tourId: 'nav-vault',
    matchRoutes: ['/dashboard/documents', '/dashboard/vault'],
  },
  {
    name: 'Reports',
    href: '/dashboard/reports',
    icon: FileText,
    tourId: 'nav-reports',
    matchRoutes: ['/dashboard/reports'],
  },
];

/** Settings — rendered separately at the bottom of the sidebar / inside More sheet on mobile. */
export const settingsNavItem: NavItem = {
  name: 'Settings',
  href: '/dashboard/settings',
  icon: Settings,
  tourId: 'nav-settings',
};

/**
 * Resolve which top-level `NavItem` is active for a given pathname.
 * Mirrors the matching logic the sidebar uses.
 */
export function findActiveNavItem(
  pathname: string,
  items: NavItem[] = trailNavItems
): NavItem | undefined {
  return items.find((item) => isNavItemActive(item, pathname));
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.href === '/dashboard') {
    return pathname === '/dashboard' || pathname === '/dashboard/setup';
  }
  if (item.matchRoutes) {
    return item.matchRoutes.some(
      (r) => pathname === r || pathname.startsWith(r + '/')
    );
  }
  return pathname === item.href || pathname.startsWith(item.href + '/');
}

// =============================================================================
// MOBILE BOTTOM TAB BAR (Phase 14.6)
// =============================================================================
//
// The 5-tab mobile bottom bar IS the TRAIL framework. Each tab corresponds
// to a TRAIL stage (with Home as the journey overview). Anchor (My Safety
// Net) folds into the More sheet — per TRAIL_FRAMEWORK.md §5 it's tracked
// "through Financial Health score + Guide recommendations, not a dedicated
// sidebar section."
//
// Why 5 tabs (Apple HIG ceiling):
//   - Apple HIG recommends ≤5 tab destinations on iPhone tab bars
//   - >5 forces a "More" item that's user-hostile on small screens
//   - 5 maps cleanly onto the TRAIL journey (Home + 4 stages, Anchor folded)

export interface MobileTabBarItem {
  /** Stable key for tracking analytics + active-tab matching. */
  key: 'home' | 'track' | 'reduce' | 'invest' | 'guide';
  /** Short label rendered under the icon. ≤7 chars to avoid truncation. */
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  /** TRAIL stage badge — drives stage-coloured active-pill tone. */
  trailStage?: 'T' | 'R' | 'A' | 'I' | 'L';
  /** Pathnames this tab should highlight on. Includes the canonical sidebar
   *  matchRoutes plus any pages that conceptually belong to the same TRAIL
   *  stage (e.g. Tax routes highlight the Guide tab, not their own). */
  matchRoutes: string[];
}

export const mobileTabBarItems: MobileTabBarItem[] = [
  {
    key: 'home',
    label: 'Home',
    href: '/dashboard',
    icon: LayoutDashboard,
    matchRoutes: ['/dashboard', '/dashboard/setup', '/dashboard/household-profile'],
  },
  {
    key: 'track',
    label: 'Track',
    href: '/dashboard/balances',
    icon: Wallet,
    trailStage: 'T',
    matchRoutes: [
      '/dashboard/balances',
      '/dashboard/activity',
      '/dashboard/entities',
      '/dashboard/accounts',
      '/dashboard/loans',
      '/transactions',
      '/recurring',
    ],
  },
  {
    key: 'reduce',
    label: 'Reduce',
    href: '/cashflow',
    icon: Target,
    trailStage: 'R',
    matchRoutes: [
      '/cashflow',
      '/dashboard/plan',
      '/dashboard/budget-analysis',
      '/dashboard/income',
      '/dashboard/expenses',
      '/dashboard/debt-planner',
    ],
  },
  {
    key: 'invest',
    label: 'Invest',
    href: '/dashboard/properties',
    icon: Home,
    trailStage: 'I',
    matchRoutes: [
      '/dashboard/properties',
      '/dashboard/investments',
      '/dashboard/assets',
    ],
  },
  {
    key: 'guide',
    label: 'Guide',
    href: '/dashboard/cfo',
    icon: Brain,
    trailStage: 'L',
    matchRoutes: [
      '/dashboard/cfo',
      '/dashboard/cfo/ask',
      '/health',
      '/dashboard/tax',
    ],
  },
];

/**
 * Resolve which mobile tab is active for a given pathname. Returns
 * `undefined` when the user is on a route reachable only via the More
 * sheet (e.g. `/dashboard/safety-net`, `/dashboard/documents`,
 * `/dashboard/reports`, `/dashboard/settings`) — in that case no tab
 * should be highlighted.
 *
 * Matching rule:
 *   - `/dashboard` matches only the exact pathname `/dashboard` (it
 *     does NOT prefix-match every dashboard sub-route — that bug made
 *     Home steal the highlight on Track/Reduce/Invest/Guide pages).
 *   - All other matchRoutes use exact + prefix match (`pathname === r`
 *     OR `pathname.startsWith(r + '/')`).
 *   - Among multiple matches, the longest matched route wins (Track's
 *     `/dashboard/balances` beats Home's `/dashboard` if both match).
 */
export function findActiveMobileTab(
  pathname: string
): MobileTabBarItem | undefined {
  let bestMatch: { tab: MobileTabBarItem; matchLength: number } | undefined;

  for (const tab of mobileTabBarItems) {
    for (const r of tab.matchRoutes) {
      const matches =
        r === '/dashboard'
          ? pathname === '/dashboard'
          : pathname === r || pathname.startsWith(r + '/');
      if (matches && (!bestMatch || r.length > bestMatch.matchLength)) {
        bestMatch = { tab, matchLength: r.length };
      }
    }
  }

  return bestMatch?.tab;
}

/**
 * Items shown in the More sheet (avatar button on the mobile header) —
 * surfaces that don't fit the 5-tab bar but still need a one-tap reach.
 *
 * Keep order stable: most-used → least-used.
 */
export const mobileMoreItems: NavItem[] = [
  trailNavItems.find((i) => i.name === 'My Safety Net')!,
  trailNavItems.find((i) => i.name === 'My Household')!,
  trailNavItems.find((i) => i.name === 'My Vault')!,
  trailNavItems.find((i) => i.name === 'Reports')!,
  settingsNavItem,
];

/** TRAIL stage tone tokens — used by the mobile bottom bar active-tab
 *  styling (text colour + top accent stripe) and the sidebar TRAIL
 *  badge. Mirrors the TrailStageChip vocabulary documented in
 *  `06_UI_UX_FOUNDATION.md` §15.
 *
 *  Phase 14.6 v2 (2026-05-08): the original tone shape exposed a
 *  `bg-{tone}-50` pill background that read as "barely tinted" against
 *  the warm-ivory app background — the user couldn't tell which tab
 *  was active. Replaced with a stronger, vivid `text-{tone}-600/-400`
 *  + `accent-{tone}-500/-400` stripe. The active state now reads
 *  *unambiguously* as "this is where you are" without resorting to a
 *  loud pill fill.
 */
export const TRAIL_STAGE_TONES: Record<
  'T' | 'R' | 'A' | 'I' | 'L',
  { activeText: string; accent: string }
> = {
  T: {
    activeText: 'text-slate-900 dark:text-slate-100',
    accent: 'bg-slate-700 dark:bg-slate-300',
  },
  R: {
    activeText: 'text-amber-600 dark:text-amber-400',
    accent: 'bg-amber-500 dark:bg-amber-400',
  },
  A: {
    activeText: 'text-indigo-600 dark:text-indigo-400',
    accent: 'bg-indigo-500 dark:bg-indigo-400',
  },
  I: {
    activeText: 'text-emerald-600 dark:text-emerald-400',
    accent: 'bg-emerald-500 dark:bg-emerald-400',
  },
  L: {
    activeText: 'text-violet-600 dark:text-violet-400',
    accent: 'bg-violet-500 dark:bg-violet-400',
  },
};
