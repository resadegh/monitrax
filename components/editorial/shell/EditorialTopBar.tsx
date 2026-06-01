/**
 * EditorialTopBar — the dashboard's top edge. 64px tall white surface,
 * sticky, with a 1px bottom hairline that only appears once scrolled.
 *
 * Composition (left → right):
 *   - Welcome cluster: eyebrow with the current AEST date + headline-sm
 *     "Welcome back, {firstName}"
 *   - Right cluster: 240px search pill + bell + avatar
 *
 * On mobile this component renders a slimmer 56px variant with the
 * welcome cluster collapsed to just the headline (no eyebrow date), and
 * the right cluster reduced to bell + avatar (search hidden — driven from
 * within the page on mobile per Stitch screen
 * dc038cd19aea4cfc8d0300f4d9122ffd).
 *
 * @see Stitch screen 2543c8240b944c8fa6b6e89d20ac8e77 (desktop shell)
 * @see Stitch screen dc038cd19aea4cfc8d0300f4d9122ffd (mobile)
 */

'use client';

import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NotificationBell } from '@/components/reminders/NotificationBell';

export interface EditorialTopBarProps {
  user?: { name: string; email?: string };
  /** Optional sticky border-on-scroll behaviour. Defaults to true. */
  borderOnScroll?: boolean;
  /**
   * When provided, the desktop search pill becomes a button that calls
   * this — used to open the existing `<UniversalSearch />` modal from
   * `DashboardLayout`. When omitted, the pill is presentational only.
   */
  onSearchClick?: () => void;
  /**
   * When provided, the mobile-side avatar tap calls this — used to open
   * the existing `<MoreSheet />` on phones. When omitted, the avatar
   * links to `/dashboard/settings/profile` on desktop.
   */
  onAvatarClick?: () => void;
  /**
   * Optional chrome buttons rendered inline in the desktop right
   * cluster between the search pill and the notification bell.
   * Added 2026-06-01 to host the AI / Help / Feedback triggers so
   * they stop colliding with the search pill (the bubbles were
   * previously `fixed top-right` and overlapped the topbar's right
   * cluster). The slot is `hidden md:flex` so mobile keeps its
   * existing floating-bubble pattern via DashboardLayout.
   */
  chromeButtons?: React.ReactNode;
  className?: string;
}

/**
 * Returns "Wednesday · 27 May 2026 · AEST" formatted using Sydney as the
 * canonical timezone (CLAUDE.md §14 — Australian wealth OS).
 */
function formatAestDate(d: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: 'Australia/Sydney',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  };
  const parts = new Intl.DateTimeFormat('en-AU', opts).formatToParts(d);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  return `${weekday} · ${day} ${month} ${year} · AEST`;
}

export function EditorialTopBar({
  user,
  borderOnScroll = true,
  onSearchClick,
  onAvatarClick,
  chromeButtons,
  className,
}: EditorialTopBarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [aestDate, setAestDate] = useState<string | null>(null);

  useEffect(() => {
    setAestDate(formatAestDate(new Date()));
  }, []);

  useEffect(() => {
    if (!borderOnScroll) return;
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [borderOnScroll]);

  const firstName = user?.name ? user.name.split(/\s+/)[0] : null;

  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 items-center justify-between gap-4 bg-editorial-paper/90 px-4 backdrop-blur-md transition-shadow md:h-16 md:px-8',
        scrolled && borderOnScroll
          ? 'border-b border-editorial-divider shadow-editorial-card'
          : 'border-b border-transparent',
        className
      )}
    >
      {/* Welcome cluster */}
      <div className="flex min-w-0 flex-col">
        {aestDate && (
          <span className="hidden text-eyebrow md:block">{aestDate}</span>
        )}
        <h1 className="mt-0.5 truncate text-[17px] font-semibold text-editorial-ink md:text-[20px]">
          {firstName ? `Welcome back, ${firstName}` : 'Your dashboard'}
        </h1>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        {/* Search pill — desktop only. Becomes a button when onSearchClick
            is provided (wired to the existing UniversalSearch modal). */}
        {onSearchClick ? (
          <button
            type="button"
            onClick={onSearchClick}
            aria-label="Open search"
            className="hidden h-9 w-60 items-center gap-2 rounded-full bg-editorial-warm pl-3 pr-2 text-sm text-editorial-slate ring-1 ring-editorial-divider transition-colors hover:bg-editorial-surface hover:text-editorial-ink md:flex"
          >
            <Search className="h-4 w-4" aria-hidden />
            <span className="flex-1 truncate text-left">Search accounts, txns, plans…</span>
            <kbd className="rounded bg-editorial-paper px-1.5 py-0.5 text-[11px] font-medium text-editorial-slate ring-1 ring-editorial-divider">
              ⌘K
            </kbd>
          </button>
        ) : (
          <div className="hidden h-9 w-60 items-center gap-2 rounded-full bg-editorial-warm pl-3 pr-2 text-sm text-editorial-slate ring-1 ring-editorial-divider md:flex">
            <Search className="h-4 w-4" aria-hidden />
            <span className="flex-1 truncate">Search accounts, txns, plans…</span>
            <kbd className="rounded bg-editorial-paper px-1.5 py-0.5 text-[11px] font-medium text-editorial-slate ring-1 ring-editorial-divider">
              ⌘K
            </kbd>
          </div>
        )}

        {/* Chrome buttons slot (desktop only) — hosts the AI / Help /
            Feedback triggers passed in by DashboardLayout with
            `placement="inline"`. Sits between the search pill and the
            notification bell. Hidden on mobile (mobile keeps the
            legacy floating-bubble pattern via DashboardLayout). */}
        {chromeButtons && (
          <div className="hidden items-center gap-2 md:flex">
            {chromeButtons}
          </div>
        )}

        {/* Notification centre (Phase 21.5 R1 PR2) — self-contained; fetches
            the reminder feed + handles snooze/dismiss via the shared hook. */}
        <NotificationBell />

        {/* Avatar — onAvatarClick (mobile More sheet trigger) takes
            precedence; otherwise renders the static glyph. */}
        {user && (
          onAvatarClick ? (
            <button
              type="button"
              onClick={onAvatarClick}
              aria-label={`${user.name} — open more menu`}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-editorial-emerald-chip text-sm font-semibold text-editorial-emerald transition-shadow hover:shadow-editorial-card"
            >
              {user.name.slice(0, 1).toUpperCase()}
            </button>
          ) : (
            <span
              aria-label={user.name}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-editorial-emerald-chip text-sm font-semibold text-editorial-emerald"
            >
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          )
        )}
      </div>
    </header>
  );
}
