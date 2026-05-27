/**
 * EditorialBottomNav — mobile-only sticky bottom navigation. Hides on
 * md+ (the desktop sidebar takes over). Five cells map to the user's
 * most-trafficked surfaces; the rest live behind the "More" sheet.
 *
 * Spec (from Stitch mobile screen dc038cd19aea4cfc8d0300f4d9122ffd):
 *   - height:   64px + safe-area-bottom
 *   - surface:  white with 1px slate-200 top hairline
 *   - active:   emerald icon + emerald 11px label + 3px emerald top
 *               accent inside the active cell
 *   - inactive: slate-500 icon + slate-500 label
 *   - touch:    44px minimum tappable height inside the 64px cell
 *
 * The five surfaces:
 *   1. Home              → /dashboard
 *   2. My Accounts (T)   → /dashboard/balances
 *   3. My Wealth (I)     → /dashboard/properties
 *   4. My Guide (L)      → /dashboard/cfo
 *   5. More              → opens drawer (placeholder Settings link for now)
 *
 * @see Stitch screen dc038cd19aea4cfc8d0300f4d9122ffd
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Wallet,
  Home as HomeIcon,
  Brain,
  Menu,
  type LucideIcon,
} from 'lucide-react';

interface BottomNavCell {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Pathname prefixes that should mark this cell active. */
  matches: string[];
}

const BOTTOM_NAV: BottomNavCell[] = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard, matches: ['/dashboard'] },
  {
    label: 'Accounts',
    href: '/dashboard/balances',
    icon: Wallet,
    matches: ['/dashboard/balances', '/dashboard/activity', '/dashboard/accounts', '/dashboard/loans'],
  },
  {
    label: 'Wealth',
    href: '/dashboard/properties',
    icon: HomeIcon,
    matches: ['/dashboard/properties', '/dashboard/investments', '/dashboard/assets'],
  },
  {
    label: 'Guide',
    href: '/dashboard/cfo',
    icon: Brain,
    matches: ['/dashboard/cfo', '/health', '/dashboard/tax'],
  },
  {
    label: 'More',
    href: '/dashboard/settings',
    icon: Menu,
    matches: [
      '/dashboard/settings',
      '/dashboard/household-profile',
      '/dashboard/reports',
      '/dashboard/documents',
      '/dashboard/budget-analysis',
      '/cashflow',
    ],
  },
];

function cellIsActive(pathname: string, cell: BottomNavCell): boolean {
  // Home matches exact /dashboard only — otherwise every cell would
  // appear active under /dashboard/*.
  if (cell.href === '/dashboard') return pathname === '/dashboard';
  return cell.matches.some((m) => pathname === m || pathname.startsWith(`${m}/`));
}

export interface EditorialBottomNavProps {
  /**
   * When provided, the "More" cell calls this callback instead of
   * navigating — used to open the existing `<MoreSheet />` drawer in
   * `DashboardLayout`. When omitted, the cell links to `/dashboard/settings`.
   */
  onMoreClick?: () => void;
  className?: string;
}

export function EditorialBottomNav({ onMoreClick, className }: EditorialBottomNavProps) {
  const pathname = usePathname() ?? '/dashboard';

  return (
    <nav
      aria-label="Mobile bottom navigation"
      className={cn(
        'fixed inset-x-0 bottom-0 z-30 flex h-16 items-stretch border-t border-editorial-divider bg-editorial-paper md:hidden',
        // safe-area-inset padding — keeps cells above the iOS home bar
        'pb-[env(safe-area-inset-bottom,0px)]',
        className
      )}
      style={{ height: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}
    >
      {BOTTOM_NAV.map((cell) => {
        const active = cellIsActive(pathname, cell);
        const isMore = cell.label === 'More';
        const useCallback = isMore && onMoreClick;
        const className = cn(
          'relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
          active
            ? 'text-editorial-emerald'
            : 'text-editorial-slate hover:text-editorial-ink'
        );
        const inner = (
          <>
            {active && (
              <span
                aria-hidden
                className="absolute left-1/2 top-0 h-[3px] w-8 -translate-x-1/2 rounded-b-full bg-editorial-emerald"
              />
            )}
            <cell.icon
              className="h-5 w-5"
              strokeWidth={active ? 2 : 1.75}
              aria-hidden
            />
            <span>{cell.label}</span>
          </>
        );

        if (useCallback) {
          return (
            <button
              key={cell.label}
              type="button"
              onClick={onMoreClick}
              aria-label="Open more menu"
              className={className}
            >
              {inner}
            </button>
          );
        }
        return (
          <Link
            key={cell.href}
            href={cell.href}
            aria-current={active ? 'page' : undefined}
            className={className}
          >
            {inner}
          </Link>
        );
      })}
    </nav>
  );
}
