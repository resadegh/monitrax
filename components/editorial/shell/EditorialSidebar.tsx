/**
 * EditorialSidebar — desktop left rail for the Restrained Editorial
 * dashboard. 240px fixed width, white surface, 1px right hairline,
 * sticky full-height. Pulls nav config from the canonical
 * `lib/navigation/trailNav.tsx` SSOT — never hard-coded.
 *
 * Composition (top → bottom):
 *   1. 64px logo bar — Monitrax wordmark (or M-mark when collapsed)
 *   2. nav list — every `trailNavItem` rendered via `EditorialNavRow`,
 *      active state matched by `findActiveNavItem(pathname)`
 *   3. mt-auto divider
 *   4. Settings row + Sign-out row
 *
 * Hides on mobile (md:flex on the wrapper) — mobile uses
 * `EditorialBottomNav` + `EditorialMobileDrawer`.
 *
 * @see lib/navigation/trailNav.tsx — NavItem SSOT
 * @see Stitch screen 2543c8240b944c8fa6b6e89d20ac8e77 (app shell)
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
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
  /** Optional extra classes for the outer aside. */
  className?: string;
}

export function EditorialSidebar({ user, className }: EditorialSidebarProps) {
  const pathname = usePathname() ?? '/dashboard';
  const active = findActiveNavItem(pathname, trailNavItems);

  return (
    <aside
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
        {trailNavItems.map((item) => (
          <EditorialNavRow
            key={item.name}
            href={item.href}
            label={item.name}
            icon={item.icon}
            active={active?.name === item.name}
            trailStage={item.trailStage}
          />
        ))}
      </nav>

      {/* Footer — Settings + user */}
      <div className="border-t border-editorial-divider px-3 py-3">
        <EditorialNavRow
          href={settingsNavItem.href}
          label={settingsNavItem.name}
          icon={settingsNavItem.icon}
          active={active?.name === settingsNavItem.name}
        />
        {user && (
          <Link
            href="/dashboard/settings/profile"
            className="mt-2 flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-editorial-warm"
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
        )}
      </div>
    </aside>
  );
}
