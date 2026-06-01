/**
 * EditorialSidebar — desktop left rail for the Restrained Editorial
 * dashboard. 240px fixed width, white surface, 1px right hairline,
 * sticky full-height. Pulls nav config from the canonical
 * `lib/navigation/trailNav.tsx` SSOT — never hard-coded.
 *
 * Composition (top → bottom):
 *   1. 64px logo bar — Monitrax wordmark (or M-mark when collapsed)
 *   2. nav list — every `trailNavItem` rendered via `EditorialNavRow`,
 *      active state matched by `findActiveNavItem(pathname)`. The active
 *      section expands to show its `children` as indented sub-tab links —
 *      this is the ONLY desktop path to a section's sub-pages, because
 *      `SectionTabsRow` is mobile-only and explicitly defers desktop
 *      sub-nav to this sidebar.
 *   3. mt-auto divider
 *   4. Settings row + Sign-out row
 *
 * Hides on mobile (md:flex on the wrapper) — mobile uses
 * `EditorialBottomNav` + `EditorialMobileDrawer` + `SectionTabsRow`.
 *
 * @see lib/navigation/trailNav.tsx — NavItem SSOT
 * @see Stitch screen 2543c8240b944c8fa6b6e89d20ac8e77 (app shell)
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  trailNavItems,
  settingsNavItem,
  findActiveNavItem,
} from '@/lib/navigation/trailNav';
import { EditorialNavRow } from './EditorialNavRow';

export interface EditorialSidebarProps {
  /** Page-level user context — surface name + avatar at the bottom. */
  user?: { name: string; email?: string };
  /**
   * Sign-out handler. When provided, the account row renders a LogOut
   * icon button to the right of the user name. Regression fix
   * (2026-06-01) — restoring the pre-Phase R2b desktop sign-out that
   * was dropped in the chrome swap (commit 810d849).
   */
  onSignOut?: () => void;
  /** Optional extra classes for the outer aside. */
  className?: string;
}

export function EditorialSidebar({ user, onSignOut, className }: EditorialSidebarProps) {
  const pathname = usePathname() ?? '/dashboard';
  const active = findActiveNavItem(pathname, trailNavItems);

  return (
    <aside
      data-tour="sidebar"
      className={cn(
        'hidden h-screen w-60 shrink-0 flex-col border-r border-editorial-divider bg-editorial-paper md:flex',
        'sticky top-0',
        className
      )}
      aria-label="Primary navigation"
    >
      {/* Logo bar */}
      <div className="flex h-16 items-center gap-2 border-b border-editorial-divider px-5">
        <span
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-lg bg-editorial-ink text-[13px] font-semibold text-editorial-paper"
        >
          M
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-editorial-ink">
          Monitrax
        </span>
      </div>

      {/* Nav list */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-4">
        {trailNavItems.map((item) => {
          const isActive = active?.name === item.name;
          const children = item.children ?? [];
          return (
            <div key={item.name}>
              <EditorialNavRow
                href={item.href}
                label={item.name}
                icon={item.icon}
                active={isActive}
                trailStage={item.trailStage}
                dataTour={item.tourId}
              />
              {/* Sub-tabs — shown on desktop when the section is active.
                  SectionTabsRow (mobile-only) defers desktop sub-nav to
                  the sidebar, so this is the ONLY desktop path to a
                  section's sub-pages (e.g. My Wealth → Investments / Assets). */}
              {isActive && children.length > 0 && (
                <div className="mb-1 ml-[26px] mt-0.5 space-y-0.5 border-l border-editorial-divider pl-3">
                  {children.map((child) => {
                    const childActive =
                      pathname === child.href ||
                      pathname.startsWith(child.href + '/');
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        aria-current={childActive ? 'page' : undefined}
                        className={cn(
                          'block rounded-md px-3 py-1.5 text-[13px] transition-colors',
                          childActive
                            ? 'bg-editorial-emerald/10 font-semibold text-editorial-ink'
                            : 'font-medium text-editorial-slate hover:bg-editorial-warm hover:text-editorial-ink'
                        )}
                      >
                        {child.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer — Settings + user */}
      <div className="border-t border-editorial-divider px-3 py-3">
        <EditorialNavRow
          href={settingsNavItem.href}
          label={settingsNavItem.name}
          icon={settingsNavItem.icon}
          active={active?.name === settingsNavItem.name}
          dataTour={settingsNavItem.tourId}
        />
        {user && (
          // Account row — Link wraps the avatar + name (taps go to
          // /dashboard/settings/profile), a separate inline Sign-out
          // button sits at the right. Nested-interactive split: the
          // outer container is a flex row, the Link covers the
          // identity area, the button is a sibling so click targets
          // never overlap. Sign-out renders only when onSignOut is
          // provided (back-compat for callers that don't wire auth).
          <div className="mt-2 flex items-center gap-2 rounded-lg pl-3 pr-1.5 py-1.5 transition-colors hover:bg-editorial-warm">
            <Link
              href="/dashboard/settings/profile"
              className="flex min-w-0 flex-1 items-center gap-3"
              aria-label={`Open profile for ${user.name}`}
            >
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-editorial-emerald-chip text-[12px] font-semibold text-editorial-emerald"
              >
                {user.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-medium text-editorial-ink">
                  {user.name}
                </span>
                {user.email && (
                  <span className="truncate text-[11px] text-editorial-slate">
                    {user.email}
                  </span>
                )}
              </span>
            </Link>
            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                aria-label="Sign out"
                title="Sign out"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-editorial-slate transition-colors hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
              </button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
