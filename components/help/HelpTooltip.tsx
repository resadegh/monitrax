/**
 * HelpTooltip — inline definition affordance.
 *
 * Phase 33j (2026-05-09). Renders a small `?` icon (or wraps a label inline)
 * that opens a popover with the term's definition + optional source-cite +
 * optional "Learn more →" link to a help article.
 *
 * Definitions live in `lib/help/tooltips.ts` — the SSOT (CLAUDE.md §12.2).
 * Reviewers reject inline definitions outside that file.
 *
 * Two usage shapes:
 *
 *   <HelpTooltip term="lvr" />
 *     → Renders just the icon. Use when there's already a label nearby.
 *
 *   <HelpTooltip term="lvr" inline>
 *     LVR
 *   </HelpTooltip>
 *     → Wraps children with a hover-able dotted underline + icon. Use
 *       when the label IS the affordance.
 *
 * Behaviour:
 *   - Click / focus icon → popover opens
 *   - Esc / click outside / blur → popover closes
 *   - prefers-reduced-motion-aware (transition collapses)
 *   - Keyboard accessible (focus ring, Enter/Space to open)
 *   - Popover positioned below the icon by default; flips to above when
 *     near the viewport bottom edge (via simple bounding-rect check)
 *
 * The popover content is text-only — no markdown rendering, no inline
 * HTML. Definitions in `tooltips.ts` are kept ≤50 words by editorial
 * convention so a tooltip doesn't become a pop-over essay.
 */
'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { getTooltip } from '@/lib/help/tooltips';

interface HelpTooltipProps {
  term: string;
  /**
   * When `inline` is true, children are rendered with a dotted underline
   * + small `?` icon to the right. The whole span is the affordance.
   * When false (default), only the icon renders.
   */
  inline?: boolean;
  children?: ReactNode;
  /** Override icon size in px. Default 12. */
  iconSize?: number;
  /** Optional className passed through to the outer wrapper. */
  className?: string;
}

export function HelpTooltip({
  term,
  inline = false,
  children,
  iconSize = 12,
  className = '',
}: HelpTooltipProps) {
  const def = getTooltip(term);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'below' | 'above'>('below');
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // No definition → render children as-is (or nothing). Don't show a
  // broken affordance.
  if (!def) {
    return inline ? <>{children}</> : null;
  }

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        popoverRef.current &&
        !popoverRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('touchstart', handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [open]);

  // Decide placement (above vs below) based on viewport room
  useEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const roomBelow = window.innerHeight - rect.bottom;
    setPlacement(roomBelow < 200 ? 'above' : 'below');
  }, [open]);

  const popoverEl = open ? (
    <div
      ref={popoverRef}
      role="tooltip"
      className={`
        absolute z-50
        ${placement === 'below' ? 'top-full mt-2' : 'bottom-full mb-2'}
        left-0
        w-72 max-w-[calc(100vw-2rem)]
        rounded-2xl bg-white/95 backdrop-blur-sm
        ring-1 ring-slate-900/[0.08]
        shadow-[0_8px_24px_-8px_rgba(11,18,32,0.18)]
        px-4 py-3
        text-left
        transition-opacity duration-150 ease-out motion-reduce:transition-none
      `}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-700 mb-1">
        {def.title}
      </p>
      <p className="text-[13px] text-slate-700 leading-relaxed">{def.body}</p>
      {(def.source || def.learnMoreSlug) && (
        <div className="mt-2.5 pt-2.5 border-t border-slate-200/70 space-y-1">
          {def.source && (
            <p className="text-[11px] text-slate-500">
              Source:{' '}
              <a
                href={def.source.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 hover:text-emerald-800 underline decoration-emerald-200"
              >
                {def.source.label}
              </a>
            </p>
          )}
          {def.learnMoreSlug && (
            <p className="text-[11px]">
              <Link
                href={`/help/${def.learnMoreSlug}`}
                onClick={() => setOpen(false)}
                className="text-emerald-700 hover:text-emerald-800 font-medium"
              >
                Learn more →
              </Link>
            </p>
          )}
        </div>
      )}
    </div>
  ) : null;

  if (inline) {
    return (
      <span
        className={`relative inline-flex items-center gap-1 ${className}`}
      >
        <span className="border-b border-dotted border-slate-400">
          {children}
        </span>
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={`What is ${def.title}?`}
          aria-expanded={open}
          className="
            inline-flex items-center justify-center
            text-slate-400 hover:text-slate-700
            focus-visible:outline-none focus-visible:text-slate-700
            focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded-full
            transition-colors
          "
        >
          <HelpCircle style={{ width: iconSize, height: iconSize }} strokeWidth={2} />
        </button>
        {popoverEl}
      </span>
    );
  }

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`What is ${def.title}?`}
        aria-expanded={open}
        className="
          inline-flex items-center justify-center
          text-slate-400 hover:text-slate-700
          focus-visible:outline-none focus-visible:text-slate-700
          focus-visible:ring-2 focus-visible:ring-emerald-500/60 rounded-full
          transition-colors
        "
      >
        <HelpCircle style={{ width: iconSize, height: iconSize }} strokeWidth={2} />
      </button>
      {popoverEl}
    </span>
  );
}
