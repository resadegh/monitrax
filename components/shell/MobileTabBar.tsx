'use client';

/**
 * MobileTabBar — Phase 14.6 (2026-05-08)
 *
 * The 5-tab bottom navigation that IS the TRAIL framework. Renders only
 * on phones (<md). Tablets (≥md) and desktop see the persistent left
 * sidebar instead.
 *
 * Design language:
 *   - Apple-glass surface (warm-ivory / 85% backdrop-blur, 1px ring,
 *     soft inner highlight) — same vocabulary as `MetricTile` and
 *     `GlassHero`. We do NOT introduce a new theme.
 *   - Active tab pill uses TRAIL stage tone (slate / amber / indigo /
 *     emerald / violet) from `TRAIL_STAGE_TONES`. The Home tab has no
 *     stage so falls back to brand primary.
 *   - 56px tap target per Apple HIG (>44pt minimum).
 *   - Honours `prefers-reduced-motion` via `motion-safe:` utilities.
 *
 * SSOT: tabs are read from `lib/navigation/trailNav.tsx:mobileTabBarItems`.
 * Never duplicate the tab list here.
 *
 * See:
 *  - docs/architecture/06_UI_UX_FOUNDATION.md §12 (mobile + responsive rules)
 *  - docs/blueprint/TRAIL_FRAMEWORK.md §5 (sidebar / journey structure)
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  mobileTabBarItems,
  TRAIL_STAGE_TONES,
  findActiveMobileTab,
  type MobileTabBarItem,
} from '@/lib/navigation/trailNav';

interface MobileTabBarProps {
  /** Optional className override for the fixed wrapper. */
  className?: string;
}

export function MobileTabBar({ className }: MobileTabBarProps) {
  const pathname = usePathname();
  const activeTab = findActiveMobileTab(pathname);

  return (
    <nav
      role="navigation"
      aria-label="Primary"
      className={cn(
        // Fixed bottom on phones only — md+ uses the desktop sidebar.
        'md:hidden fixed inset-x-0 bottom-0 z-30',
        // Apple-glass surface — same vocabulary as MetricTile/GlassHero.
        'border-t border-border/60',
        'bg-background/85 backdrop-blur-xl',
        'shadow-[0_-2px_24px_-8px_rgba(15,23,42,0.12)] dark:shadow-[0_-2px_24px_-8px_rgba(0,0,0,0.6)]',
        // iOS safe-area inset so the bar clears the home indicator.
        'pb-[env(safe-area-inset-bottom)]',
        className
      )}
    >
      {/* Subtle inner top highlight — depth without weight. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent"
      />
      <ul className="grid grid-cols-5 px-1 pt-1.5 pb-1.5">
        {mobileTabBarItems.map((tab) => (
          <MobileTabButton
            key={tab.key}
            tab={tab}
            isActive={tab.key === activeTab.key}
          />
        ))}
      </ul>
    </nav>
  );
}

function MobileTabButton({
  tab,
  isActive,
}: {
  tab: MobileTabBarItem;
  isActive: boolean;
}) {
  const Icon = tab.icon;
  const tone = tab.trailStage ? TRAIL_STAGE_TONES[tab.trailStage] : null;

  return (
    <li>
      <Link
        href={tab.href}
        aria-current={isActive ? 'page' : undefined}
        aria-label={`${tab.label}${tab.trailStage ? ` (TRAIL stage ${tab.trailStage})` : ''}`}
        className={cn(
          // ≥56px tap target per Apple HIG.
          'group flex flex-col items-center justify-center gap-0.5',
          'min-h-[56px] py-1.5 rounded-xl',
          'transition-colors duration-200',
          'motion-safe:active:scale-95 motion-safe:transition-transform',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1',
          isActive
            ? cn(
                tone?.activeBg ?? 'bg-primary/10',
                tone?.activeText ?? 'text-primary'
              )
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        <Icon
          className={cn(
            'h-5 w-5 shrink-0',
            'transition-transform duration-200',
            // Subtle scale-up on active — feels tactile, never bouncy.
            isActive && 'motion-safe:scale-110'
          )}
          aria-hidden
        />
        <span
          className={cn(
            'text-[10px] font-medium leading-none tracking-wide',
            isActive && 'font-semibold'
          )}
        >
          {tab.label}
        </span>
      </Link>
    </li>
  );
}
