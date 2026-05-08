'use client';

/**
 * SectionTabsRow — Phase 14.6 (2026-05-08)
 *
 * Horizontal scrollable pill row that surfaces the active section's
 * sub-tabs at the top of the page on phones (<md). Replaces the
 * sidebar-accordion sub-tab pattern (which is invisible to mobile users
 * with the bottom tab bar) with a visible, one-tap-reachable surface.
 *
 * Renders nothing if:
 *   - The viewport is ≥md (desktop sidebar handles sub-nav).
 *   - The active TRAIL section has no `children` (e.g. Home, Safety Net).
 *
 * Design language:
 *   - Apple-glass pill (rounded-full, 1px ring, soft active fill).
 *   - URL-routed via Next.js `<Link>` — every pill is deep-linkable.
 *   - Honours `prefers-reduced-motion`.
 *
 * SSOT: sub-tab list is read from the active item's `children` in
 * `lib/navigation/trailNav.tsx`. Never hardcoded here.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { findActiveNavItem } from '@/lib/navigation/trailNav';

interface SectionTabsRowProps {
  className?: string;
}

export function SectionTabsRow({ className }: SectionTabsRowProps) {
  const pathname = usePathname();
  const activeSection = findActiveNavItem(pathname);

  // Hide if no active section, or section has no sub-tabs.
  if (!activeSection?.children || activeSection.children.length === 0) {
    return null;
  }

  return (
    <div
      role="navigation"
      aria-label={`${activeSection.name} sections`}
      className={cn(
        // Phones only — desktop sidebar already shows accordion sub-tabs.
        'md:hidden',
        // Sticky below the mobile header (h-14 = 56px). Stays visible
        // as the user scrolls the page, so primary section navigation
        // is always one tap away. z-20 sits below the header (z-40)
        // and the bottom tab bar (z-30) but above page content.
        'sticky top-14 z-20',
        // Apple-glass band — frosted background so content scrolls
        // beneath without bleeding through. Soft hairline divider at
        // the bottom for separation, keyed to the warm-ivory theme.
        'bg-background/85 backdrop-blur-xl',
        'border-b border-border/40',
        // Negative margin pulls the band edge-to-edge under the page
        // padding (`p-3 sm:p-4` on <main>); the inner scroll container
        // re-applies horizontal padding so pills don't touch the edge.
        '-mx-3 sm:-mx-4 mb-3',
        // Slim vertical padding so the band reads as compact, not bulky.
        'py-2',
        className
      )}
    >
      <div
        className={cn(
          // Horizontal scroll on overflow with no scrollbar chrome.
          'flex gap-2 overflow-x-auto px-3 sm:px-4',
          'scrollbar-none',
          '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
        )}
      >
        {activeSection.children.map((child) => {
          const isActive =
            pathname === child.href || pathname.startsWith(child.href + '/');
          return (
            <Link
              key={child.href}
              href={child.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'shrink-0 inline-flex items-center justify-center',
                'rounded-full px-4 py-1.5',
                'text-[13px] font-medium leading-none tracking-wide',
                'border ring-0 transition-colors duration-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1',
                'motion-safe:active:scale-95 motion-safe:transition-transform',
                isActive
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-card/70 text-muted-foreground border-border/70 hover:text-foreground hover:bg-card'
              )}
            >
              {child.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
