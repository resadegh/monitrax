'use client';

/**
 * SectionTabsRow — Phase 14.6 v3 (2026-05-08)
 *
 * iOS-style **segmented control** for sub-tab navigation on phones.
 * Replaces the prior scrolling-pill implementation (PR #724) which read
 * as page content rather than a header. The new pattern is a single
 * cohesive control with internal segment dividers, fixed below the
 * brand header so it never scrolls away — it visually IS a second
 * header band, the same way iOS Stocks / Apple Music / iOS Settings
 * surface in-page navigation.
 *
 * Why segmented over pills:
 *   - Reads as a "header control," not as a scrolled list of buttons.
 *   - Three sub-tabs (every TRAIL section except Guide which has four)
 *     fit cleanly at 100% width — no horizontal scrolling, no
 *     truncation, no thinking.
 *   - Single corner radius + internal hairlines produce visual
 *     harmony; three pills always read as three things.
 *
 * Renders nothing if:
 *   - The viewport is ≥md (desktop sidebar handles sub-nav).
 *   - The active TRAIL section has no `children` (e.g. Home).
 *
 * Active segment uses the section's TRAIL stage tone via
 * `TRAIL_STAGE_TONES` so the colour identity carries (slate / amber /
 * indigo / emerald / violet). Theme tokens unchanged.
 *
 * Layout contract:
 *   - The fixed bar is `h-14` (56px) anchored at `top-14` (just below
 *     the brand header). z-30 sits above page content and below the
 *     brand header (z-40).
 *   - An in-flow `h-14` spacer is rendered as a sibling so subsequent
 *     content does not render under the fixed bar.
 *   - `motion-safe:` slide-in respected; `prefers-reduced-motion`
 *     honoured.
 *
 * SSOT: sub-tab list is read from the active item's `children` in
 * `lib/navigation/trailNav.tsx`. Never hardcoded here.
 *
 * See:
 *  - docs/architecture/06_UI_UX_FOUNDATION.md §12 (mobile + responsive rules)
 *  - docs/blueprint/TRAIL_FRAMEWORK.md §5 (sidebar / journey structure)
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  findActiveNavItem,
  trailNavItems,
  filterNavByModules,
  TRAIL_STAGE_TONES,
} from '@/lib/navigation/trailNav';
import { useEnabledModules } from '@/lib/featureFlags/ModuleGateContext';

interface SectionTabsRowProps {
  className?: string;
}

export function SectionTabsRow({ className }: SectionTabsRowProps) {
  const pathname = usePathname();
  // PROD Simplification P1 (plan §4.2): resolve the active section from
  // the module-filtered nav so hidden sections/children never surface
  // sub-tab pills.
  const enabledModules = useEnabledModules();
  const visibleNavItems = filterNavByModules(trailNavItems, enabledModules);
  const activeSection = findActiveNavItem(pathname, visibleNavItems);

  // Hide if no active section, or section has no sub-tabs.
  if (!activeSection?.children || activeSection.children.length === 0) {
    return null;
  }

  // Active-segment text colour reflects the section's TRAIL stage.
  // Falls back to brand-primary for any future stage-less section.
  const tone = activeSection.trailStage
    ? TRAIL_STAGE_TONES[activeSection.trailStage]
    : null;
  const activeTextClass = tone?.activeText ?? 'text-primary';
  // Phase 14.6 v5 — stage-hue tint on the bar background. Reza
  // directive: "even a hue background colour should be the same as
  // each trail stage." Subtle (50-70% opacity over backdrop-blur) so
  // the chrome reads as belonging to the stage without overpowering.
  const bgTintClass = tone?.bgTint ?? 'bg-background/85';

  // Phase 14.9 (2026-06-11): longest-prefix wins. Without this, both
  // Actions (`/dashboard/cfo`) AND What If? (`/dashboard/cfo/what-if`)
  // were rendering as active on `/dashboard/cfo/what-if` because the
  // naive `pathname.startsWith(child.href + '/')` matched both. Same
  // class of bug as the original `findActiveMobileTab` fix
  // (`/dashboard` matching every sub-route). Compute once per render.
  let activeChildHref: string | null = null;
  let activeChildMatchLength = 0;
  for (const child of activeSection.children) {
    const matches =
      pathname === child.href || pathname.startsWith(child.href + '/');
    if (matches && child.href.length > activeChildMatchLength) {
      activeChildHref = child.href;
      activeChildMatchLength = child.href.length;
    }
  }

  return (
    <>
      {/* Fixed segmented-control bar — phones only. Anchored at
          top-14 (right below the brand header) so it visually reads as
          a continuation of the header zone. The Apple-glass background
          carries the active section's stage hue so the user has a
          constant colour reminder of which TRAIL stage they're in. */}
      <div
        role="navigation"
        aria-label={`${activeSection.name} sections`}
        data-trail-stage={activeSection.trailStage ?? undefined}
        className={cn(
          'md:hidden fixed top-14 inset-x-0 z-30 h-14',
          'flex items-center px-3 sm:px-4',
          // Stage-hue tint layered over backdrop-blur — gives the bar
          // a clear stage-colour identity while remaining glassy.
          bgTintClass,
          'backdrop-blur-xl',
          'border-b border-border/40',
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200',
          className
        )}
      >
        <div
          role="tablist"
          className={cn(
            // iOS segmented-control track: equal-width segments inside
            // a soft inset rail. `auto-cols-fr` makes every segment
            // the same width regardless of label length.
            'w-full grid auto-cols-fr grid-flow-col gap-1',
            'rounded-xl bg-muted/50 p-1',
            'ring-1 ring-border/40'
          )}
        >
          {activeSection.children.map((child) => {
            const isActive = child.href === activeChildHref;
            return (
              <Link
                key={child.href}
                href={child.href}
                role="tab"
                aria-selected={isActive}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center justify-center min-h-[36px] px-2 rounded-lg',
                  'text-[13px] leading-none tracking-wide',
                  'transition-all duration-200',
                  'motion-safe:active:scale-[0.97] motion-safe:transition-transform',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60',
                  isActive
                    ? cn(
                        // Active segment: elevated white-ish chip with
                        // shadow + ring. Stage-tone text gives the
                        // colour identity without overpowering the
                        // page.
                        'bg-background shadow-sm ring-1 ring-border/50',
                        'font-semibold',
                        activeTextClass
                      )
                    : 'text-muted-foreground hover:text-foreground font-medium'
                )}
              >
                <span className="truncate">{child.name}</span>
              </Link>
            );
          })}
        </div>
      </div>
      {/* In-flow spacer — same height as the fixed bar so subsequent
          page content sits below it instead of under it. md:hidden so
          the spacer does not exist on tablet/desktop. */}
      <div aria-hidden className="md:hidden h-14" />
    </>
  );
}
