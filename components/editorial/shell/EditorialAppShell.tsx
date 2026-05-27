/**
 * EditorialAppShell — the canonical wrapper composing
 * `EditorialSidebar` (desktop) + `EditorialTopBar` (both) +
 * `EditorialBottomNav` (mobile) around the page content. Provides the
 * warm-ivory page background and the responsive layout grid.
 *
 * Consumers render their page content as children. The shell handles:
 *   - The 240px sidebar on md+ (collapses on mobile)
 *   - The 64px topbar (sticky)
 *   - The 64px+safe-area bottom nav on mobile (with content
 *     `pb-20 md:pb-0` to avoid the nav overlapping the last item)
 *   - The page-level `bg-editorial-ivory` ground
 *
 * This is NOT a Next.js layout file — it's a presentational shell that
 * the existing `DashboardLayout` (or any future route layout) can wrap
 * its children with. R2 ships this primitive without flipping the
 * `DashboardLayout` consumer; the consumer migration happens later
 * (Phase R2b) once the user has reviewed the shell in preview.
 *
 * @see Stitch screen 2543c8240b944c8fa6b6e89d20ac8e77 (desktop)
 * @see Stitch screen dc038cd19aea4cfc8d0300f4d9122ffd (mobile)
 */

'use client';

import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
import { EditorialSidebar } from './EditorialSidebar';
import { EditorialTopBar } from './EditorialTopBar';
import { EditorialBottomNav } from './EditorialBottomNav';

export interface EditorialAppShellProps {
  user?: { name: string; email?: string };
  /** Page content. */
  children: ReactNode;
  /** Optional extra classes for the content `<main>`. */
  contentClassName?: string;
  /**
   * When true, suppresses the topbar's "border-on-scroll" so pages that
   * want their own custom hero treatment can own the visual edge.
   * Defaults to false.
   */
  staticTopBarBorder?: boolean;
}

export function EditorialAppShell({
  user,
  children,
  contentClassName,
  staticTopBarBorder = false,
}: EditorialAppShellProps) {
  return (
    <div className="flex min-h-screen bg-editorial-ivory text-editorial-ink">
      <EditorialSidebar user={user} />

      <div className="flex min-w-0 flex-1 flex-col">
        <EditorialTopBar user={user} borderOnScroll={!staticTopBarBorder} />

        <main
          className={cn(
            // pb-24 on mobile so the bottom nav (64px + safe-area) never
            // covers the last row of content. md+ uses the sidebar so
            // no bottom padding needed.
            'flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-8 md:pt-6',
            contentClassName
          )}
        >
          {children}
        </main>
      </div>

      <EditorialBottomNav />
    </div>
  );
}
