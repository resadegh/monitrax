'use client';

/**
 * HelpTip & HelpBanner — Contextual help components for the admin portal.
 *
 * <HelpTip>: Small ? icon next to labels/titles. Click to toggle an inline
 *            help panel with title, description, steps, and learn-more link.
 *
 * <HelpBanner>: Page-level dismissible banner for first-time guidance.
 *               Users can toggle it off and re-show it via the "Show help" button.
 *
 * Design goals:
 * - Keyboard accessible (tab + enter to activate)
 * - Works in dark mode (matches admin portal palette)
 * - Mobile-friendly (click, not hover)
 * - Markdown-lite: bold via <strong>, lists via <ul>
 * - Centralized content via lib/admin/help-content.ts
 */

import React, { useState, useCallback } from 'react';
import { HelpCircle, X, BookOpen, Lightbulb, ChevronRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// TYPES
// ============================================================================

export interface HelpContent {
  title: string;
  description?: string;
  steps?: string[];
  tips?: string[];
  learnMoreHref?: string;
  learnMoreLabel?: string;
}

// ============================================================================
// HelpTip — inline ? icon with collapsible panel
// ============================================================================

interface HelpTipProps {
  content: HelpContent;
  /** Align the popup panel */
  align?: 'left' | 'right';
  /** Size of the icon */
  size?: 'sm' | 'md';
  className?: string;
}

export function HelpTip({ content, align = 'left', size = 'sm', className }: HelpTipProps) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((o) => !o), []);
  const close = useCallback(() => setOpen(false), []);

  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`Help: ${content.title}`}
        className={cn(
          'inline-flex items-center justify-center rounded-full p-0.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/40',
          open && 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10'
        )}
      >
        <HelpCircle className={iconSize} />
      </button>

      {open && (
        <>
          {/* Click-outside backdrop (transparent) */}
          <span
            className="fixed inset-0 z-40"
            onClick={close}
            aria-hidden
          />

          {/* Help panel */}
          <span
            className={cn(
              'absolute top-full mt-2 z-50 w-80 max-w-[calc(100vw-2rem)] p-4 rounded-xl',
              'bg-white dark:bg-[#0F1624] border border-gray-200 dark:border-white/[0.08]',
              'shadow-[0_8px_24px_0_rgba(0,0,0,0.08)] dark:shadow-[0_8px_24px_0_rgba(0,0,0,0.4)]',
              'text-left normal-case tracking-normal',
              align === 'right' ? 'right-0' : 'left-0'
            )}
            role="tooltip"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
                  <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <h4 className="text-[13px] font-semibold text-gray-900 dark:text-white">
                  {content.title}
                </h4>
              </div>
              <button
                type="button"
                onClick={close}
                className="p-0.5 rounded text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                aria-label="Close help"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Description */}
            {content.description && (
              <p className="text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
                {content.description}
              </p>
            )}

            {/* Steps */}
            {content.steps && content.steps.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider mb-1.5">
                  Steps
                </p>
                <ol className="space-y-1">
                  {content.steps.map((step, i) => (
                    <li key={i} className="flex gap-2 text-[12px] text-gray-600 dark:text-gray-300">
                      <span className="shrink-0 w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[10px] font-semibold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* Tips */}
            {content.tips && content.tips.length > 0 && (
              <div className="mt-3 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200/50 dark:border-amber-500/20">
                <div className="flex gap-2">
                  <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {content.tips.map((tip, i) => (
                      <p key={i} className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                        {tip}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Learn more */}
            {content.learnMoreHref && (
              <a
                href={content.learnMoreHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                <BookOpen className="w-3 h-3" />
                {content.learnMoreLabel || 'Learn more'}
                <ChevronRight className="w-3 h-3" />
              </a>
            )}
          </span>
        </>
      )}
    </span>
  );
}

// ============================================================================
// HelpBanner — dismissible page-level help banner
// ============================================================================

interface HelpBannerProps {
  content: HelpContent;
  /** Unique key to remember the dismissed state */
  storageKey?: string;
  className?: string;
}

export function HelpBanner({ content, storageKey, className }: HelpBannerProps) {
  // Initialize from localStorage if a key is provided
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !storageKey) return false;
    try {
      return localStorage.getItem(`helpBanner.${storageKey}`) === 'dismissed';
    } catch {
      return false;
    }
  });

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== 'undefined' && storageKey) {
      try {
        localStorage.setItem(`helpBanner.${storageKey}`, 'dismissed');
      } catch {
        // ignore
      }
    }
  };

  const handleReshow = () => {
    setDismissed(false);
    if (typeof window !== 'undefined' && storageKey) {
      try {
        localStorage.removeItem(`helpBanner.${storageKey}`);
      } catch {
        // ignore
      }
    }
  };

  if (dismissed) {
    return (
      <button
        type="button"
        onClick={handleReshow}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium',
          'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10',
          'hover:bg-blue-100 dark:hover:bg-blue-500/15 transition-colors',
          className
        )}
      >
        <HelpCircle className="w-3 h-3" />
        Show help
      </button>
    );
  }

  return (
    <div
      className={cn(
        'mb-6 p-4 rounded-xl border',
        'bg-gradient-to-br from-blue-50 to-indigo-50/50 dark:from-blue-500/5 dark:to-indigo-500/5',
        'border-blue-200/60 dark:border-blue-500/20',
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-white dark:bg-blue-500/15 flex items-center justify-center shrink-0">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h4 className="text-[13px] font-semibold text-blue-900 dark:text-blue-200">
              {content.title}
            </h4>
            <button
              type="button"
              onClick={handleDismiss}
              className="p-1 rounded text-blue-600/70 dark:text-blue-400/70 hover:text-blue-900 dark:hover:text-blue-200 hover:bg-blue-100 dark:hover:bg-blue-500/15 transition-colors"
              aria-label="Dismiss help"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {content.description && (
            <p className="text-[12px] leading-relaxed text-blue-800/90 dark:text-blue-300/90">
              {content.description}
            </p>
          )}

          {content.steps && content.steps.length > 0 && (
            <ol className="mt-2 space-y-1">
              {content.steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-[12px] text-blue-800/90 dark:text-blue-300/90">
                  <span className="shrink-0 w-4 h-4 rounded-full bg-blue-200/70 dark:bg-blue-400/20 text-blue-800 dark:text-blue-200 text-[10px] font-semibold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          )}

          {content.tips && content.tips.length > 0 && (
            <div className="mt-2 flex items-start gap-2">
              <Lightbulb className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                {content.tips.map((tip, i) => (
                  <p key={i} className="text-[11px] text-blue-800/80 dark:text-blue-300/80">
                    {tip}
                  </p>
                ))}
              </div>
            </div>
          )}

          {content.learnMoreHref && (
            <a
              href={content.learnMoreHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
            >
              <BookOpen className="w-3 h-3" />
              {content.learnMoreLabel || 'Learn more'}
              <ChevronRight className="w-3 h-3" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
