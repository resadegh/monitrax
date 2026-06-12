/**
 * EditorialBottomNav — mobile-only sticky bottom navigation. Hides on
 * md+ (the desktop sidebar takes over).
 *
 * Renders from the canonical `mobileTabBarItems` SSOT in
 * `lib/navigation/trailNav.tsx` so the bottom bar stays aligned with the
 * desktop sidebar's TRAIL ordering — Phase 14.6 v4 directive (2026-05-08):
 * *"trail is the IA, all five stages should be visible end-to-end."*
 *
 * Phase 14.7 (2026-06-11): replaced a hardcoded 5-cell list (Home /
 * Accounts / Wealth / Guide / More) that had drifted from `mobileTabBarItems`
 * and dropped both My Budget (Reduce) and My Safety Net (Anchor) from the
 * mobile journey. The full 6-tab bar restores the missing stages and adds a
 * 7th "More" cell that opens the existing `<MoreSheet />` drawer for the
 * non-stage surfaces (Household / Vault / Reports / Settings).
 *
 * Layout: each cell takes `flex-1` so spacing scales with viewport width.
 * Labels are kept ≤6 chars per `mobileTabBarItems` rule to avoid truncation
 * on 320px iPhones.
 *
 * Active state mirrors the same `findActiveMobileTab` logic used elsewhere
 * — the active cell adopts the stage's TRAIL tone (sky / amber / indigo /
 * emerald / violet) instead of a single fixed emerald.
 *
 * @see Stitch screen dc038cd19aea4cfc8d0300f4d9122ffd (original 5-cell
 *      design, now superseded by the canonical SSOT — kept for visual
 *      reference only)
 * @see docs/blueprint/TRAIL_FRAMEWORK.md §5
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';
import {
  mobileTabBarItems,
  findActiveMobileTab,
  TRAIL_STAGE_TONES,
} from '@/lib/navigation/trailNav';

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
  const activeTab = findActiveMobileTab(pathname);

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
      {mobileTabBarItems.map((cell) => {
        const Icon = cell.icon;
        const active = activeTab?.key === cell.key;
        const tone = cell.trailStage ? TRAIL_STAGE_TONES[cell.trailStage] : null;
        const className = cn(
          'relative flex flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium leading-none transition-colors',
          active
            ? tone?.activeText ?? 'text-editorial-emerald'
            : tone?.inactiveIcon ?? 'text-editorial-slate hover:text-editorial-ink'
        );
        return (
          <Link
            key={cell.key}
            href={cell.href}
            aria-current={active ? 'page' : undefined}
            className={className}
          >
            {active && (
              <span
                aria-hidden
                className={cn(
                  'absolute left-1/2 top-0 h-[3px] w-8 -translate-x-1/2 rounded-b-full',
                  tone?.accent ?? 'bg-editorial-emerald'
                )}
              />
            )}
            <Icon
              className={cn(
                'h-5 w-5',
                active && '[&_*]:stroke-[2]'
              )}
              aria-hidden
            />
            <span className="truncate w-full text-center">{cell.label}</span>
          </Link>
        );
      })}
      {/* "More" cell — surfaces non-stage pages via the existing
          <MoreSheet /> drawer (Household / Vault / Reports / Settings). */}
      <button
        type="button"
        onClick={onMoreClick}
        aria-label="Open more menu"
        className="relative flex flex-1 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium leading-none text-editorial-slate transition-colors hover:text-editorial-ink"
      >
        <Menu className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        <span className="truncate w-full text-center">More</span>
      </button>
    </nav>
  );
}
