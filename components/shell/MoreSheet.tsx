'use client';

/**
 * MoreSheet — Phase 14.6 (2026-05-08)
 *
 * Bottom sheet for nav surfaces that don't fit the 5-tab mobile bar
 * (My Safety Net, My Household, My Vault, Reports, Settings, Sign out).
 * Triggered by the avatar/profile button in the mobile header.
 *
 * Reuses the slide-in / bottom-sheet chrome documented in
 * `06_UI_UX_FOUNDATION.md` §15.3 (Apple-glass, motion-safe, body-scroll
 * lock, Esc to close, backdrop click to close, ARIA dialog semantics).
 * No framer-motion — Tailwind motion utilities only.
 */
import Link from 'next/link';
import { useEffect } from 'react';
import { X, LogOut, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mobileMoreItems } from '@/lib/navigation/trailNav';

interface MoreSheetProps {
  open: boolean;
  onClose: () => void;
  user: { name?: string | null; email?: string | null };
  onSignOut: () => void;
}

export function MoreSheet({ open, onClose, user, onSignOut }: MoreSheetProps) {
  // Esc to close + body-scroll lock while open (iOS Safari).
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="More menu">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          'absolute inset-0 bg-black/40 backdrop-blur-sm',
          'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200'
        )}
      />
      {/* Sheet */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0',
          'rounded-t-[28px] border-t border-border/60',
          'bg-background shadow-2xl',
          'pb-[env(safe-area-inset-bottom)]',
          'motion-safe:animate-in motion-safe:slide-in-from-bottom motion-safe:duration-300'
        )}
      >
        {/* Drag handle (visual cue only) */}
        <div className="flex justify-center pt-2.5 pb-1.5" aria-hidden>
          <span className="block h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-2 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
              <UserIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold truncate">{user.name || 'You'}</p>
              {user.email && (
                <p className="text-[12px] text-muted-foreground truncate">{user.email}</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 -mt-1 -mr-1 rounded-full hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
        {/* Nav list */}
        <ul className="px-3 pb-3 space-y-0.5 max-h-[60vh] overflow-y-auto">
          {mobileMoreItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 rounded-xl px-3 py-3',
                    'text-[14px] font-medium',
                    'text-foreground hover:bg-muted/60 transition-colors duration-200',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60'
                  )}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="flex-1">{item.name}</span>
                  {item.trailStage && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-[11px] font-bold text-muted-foreground/80">
                      {item.trailStage}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
        {/* Sign out */}
        <div className="border-t border-border/60 px-3 py-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onSignOut();
            }}
            className={cn(
              'w-full flex items-center gap-3 rounded-xl px-3 py-3',
              'text-[14px] font-medium text-destructive',
              'hover:bg-destructive/10 transition-colors duration-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/60'
            )}
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive/10">
              <LogOut className="h-4 w-4" />
            </div>
            <span className="flex-1 text-left">Sign out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
