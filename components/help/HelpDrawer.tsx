/**
 * HelpDrawer — slide-in help surface anchored to the user's current route.
 *
 * Behaviour (Phase 33b):
 *   - Desktop (≥md): right-edge slide-in, ~480px wide
 *   - Mobile (<md): bottom-sheet covering ~85% viewport height
 *   - Opens with the route-mapped article pre-loaded (resolved server-side
 *     via `lib/help/routeContext.ts`); falls back to the audience landing
 *     list when no mapping exists for the current pathname
 *   - Search input filters the audience-scoped article list by title /
 *     summary / category (case-insensitive)
 *   - Footer link "Open full Help Center →" exits the drawer to `/help`
 *
 * Dismiss:
 *   - X button
 *   - Esc key
 *   - Click on backdrop (desktop) / drag-down doesn't apply — tap backdrop
 *   - Route change (we listen to pathname; new pathname → close + reset)
 *
 * Motion:
 *   - 200ms ease-out; honours `prefers-reduced-motion` via `motion-reduce:`
 *
 * Content:
 *   - Reuses the SAME pre-rendered HTML produced by `lib/help/markdown.ts`
 *     so typography stays in lockstep with the public `/help/<...>` pages.
 *     We do NOT roll a parallel renderer.
 */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Search, ArrowUpRight, ChevronRight } from 'lucide-react';
import type { HelpAudience } from '@/lib/help/content';

interface DrawerArticleSummary {
  audience: HelpAudience;
  audienceLabel: string;
  title: string;
  slug: string;
  summary: string | null;
  category: string | null;
  complianceClass: string | null;
  lastReviewed: string;
  href: string;
}

interface DrawerPrimary extends DrawerArticleSummary {
  bodyHtml: string;
}

interface DrawerPayload {
  primary: DrawerPrimary | null;
  articles: DrawerArticleSummary[];
  audiences: HelpAudience[];
}

interface HelpDrawerProps {
  open: boolean;
  onClose: () => void;
  audiences: HelpAudience[];
}

export function HelpDrawer({ open, onClose, audiences }: HelpDrawerProps) {
  const pathname = usePathname();
  const [payload, setPayload] = useState<DrawerPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);
  const [query, setQuery] = useState('');
  // When the user picks a different article from the list, override the
  // server's default (route-resolved) primary. Cleared on close + on route
  // change — the next fresh open lands on the route-mapped article again.
  const [override, setOverride] = useState<{ audience: HelpAudience; slug: string } | null>(null);

  const closeAndReset = useCallback(() => {
    onClose();
    setQuery('');
    setOverride(null);
  }, [onClose]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeAndReset();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, closeAndReset]);

  // Close on route change. Tracks pathname so navigating away dismisses
  // the drawer cleanly without leaking state.
  const lastPathnameRef = useRef(pathname);
  useEffect(() => {
    if (!open) {
      lastPathnameRef.current = pathname;
      return;
    }
    if (lastPathnameRef.current !== pathname) {
      lastPathnameRef.current = pathname;
      closeAndReset();
    }
  }, [pathname, open, closeAndReset]);

  // Lock body scroll while open. Avoids the page scrolling beneath an
  // open drawer on iOS Safari.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Fetch payload when opened OR when the override changes.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setErrored(false);
    const params = new URLSearchParams();
    if (pathname) params.set('path', pathname);
    params.set('audiences', audiences.join(','));
    if (override) {
      params.set('audience', override.audience);
      params.set('slug', override.slug);
    }
    fetch(`/api/help/drawer?${params.toString()}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Help drawer request failed (${res.status})`);
        return (await res.json()) as DrawerPayload;
      })
      .then((data) => {
        if (cancelled) return;
        setPayload(data);
      })
      .catch(() => {
        if (cancelled) return;
        setErrored(true);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // We intentionally exclude `audiences` from the dep array (it's a fresh
    // array reference each render — passing the join would be safer but we
    // don't expect audience scope to change while the drawer is open).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pathname, override?.audience, override?.slug]);

  const filteredArticles = useMemo(() => {
    const all = payload?.articles ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter((a) => {
      const haystack = [
        a.title,
        a.summary ?? '',
        a.category ?? '',
        a.audienceLabel,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [payload, query]);

  const showFallbackList = !payload?.primary || !!query;

  return (
    <>
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={closeAndReset}
        className={`
          fixed inset-0 z-[60]
          bg-slate-900/30 backdrop-blur-[2px]
          transition-opacity duration-200 ease-out motion-reduce:transition-none
          ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
      />

      {/* Drawer panel — bottom-sheet on mobile, right-edge slide-in on ≥md */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Help drawer"
        className={`
          fixed z-[70]
          bg-[#fbf8f1] ring-1 ring-slate-900/[0.06]
          shadow-[0_-12px_40px_-12px_rgba(11,18,32,0.25)] md:shadow-[-12px_0_40px_-12px_rgba(11,18,32,0.25)]

          left-0 right-0 bottom-0 top-auto
          h-[85vh] rounded-t-[28px]

          md:left-auto md:right-0 md:top-0 md:bottom-0
          md:h-full md:w-[480px] md:max-w-[92vw] md:rounded-none md:rounded-l-[22px]

          flex flex-col

          transition-transform duration-200 ease-out motion-reduce:transition-none
          ${open
            ? 'translate-y-0 md:translate-x-0'
            : 'translate-y-full md:translate-y-0 md:translate-x-full'
          }
        `}
      >
        {/* Mobile drag-handle visual */}
        <div className="md:hidden pt-3 pb-1 flex justify-center">
          <span className="block h-1 w-10 rounded-full bg-slate-300/80" aria-hidden="true" />
        </div>

        {/* Header */}
        <header className="flex items-start justify-between gap-3 px-5 sm:px-6 pt-4 pb-3 border-b border-slate-200/70">
          <div className="min-w-0">
            <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-700">
              Help
            </p>
            <h2 className="mt-0.5 text-[17px] font-semibold tracking-tight text-slate-900 truncate">
              {payload?.primary && !query
                ? payload.primary.title
                : 'How can we help?'}
            </h2>
            {payload?.primary && !query && payload.primary.audienceLabel && (
              <p className="mt-0.5 text-[11px] text-slate-500">
                {payload.primary.audienceLabel}
                {payload.primary.category && ` · ${payload.primary.category}`}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={closeAndReset}
            aria-label="Close help drawer"
            className="
              shrink-0 inline-flex items-center justify-center
              h-8 w-8 rounded-full
              text-slate-500 hover:text-slate-900 hover:bg-slate-100
              transition-colors
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60
            "
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
          {loading && !payload && (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-6">
              <span className="h-3 w-3 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" aria-hidden="true" />
              Loading help…
            </div>
          )}

          {errored && (
            <div className="rounded-2xl bg-rose-50 ring-1 ring-rose-200/70 px-4 py-3 text-sm text-rose-800">
              We couldn&rsquo;t load help right now. Try again, or open the{' '}
              <Link href="/help" className="underline decoration-rose-300">
                full Help Center
              </Link>
              .
            </div>
          )}

          {!loading && !errored && payload?.primary && !showFallbackList && (
            <article>
              {payload.primary.summary && (
                <p className="text-[15px] text-slate-600 leading-relaxed mb-4">
                  {payload.primary.summary}
                </p>
              )}
              <div
                className="text-slate-700"
                // eslint-disable-next-line react/no-danger -- bodyHtml is produced
                // by `lib/help/markdown.ts`, the same renderer used by the public
                // `/help/<...>` page. Inputs are escaped, links scheme-restricted,
                // no inline HTML pass-through. Same XSS posture as the public site.
                dangerouslySetInnerHTML={{ __html: payload.primary.bodyHtml }}
              />
              <p className="mt-6 text-[11px] text-slate-400 tabular-nums">
                Reviewed {payload.primary.lastReviewed}
              </p>

              {payload.articles.length > 1 && (
                <div className="mt-8 pt-6 border-t border-slate-200/70">
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500 mb-3">
                    More help
                  </p>
                  <ArticleList
                    articles={payload.articles.filter(
                      (a) =>
                        !(a.audience === payload.primary?.audience &&
                          a.slug === payload.primary?.slug),
                    ).slice(0, 8)}
                    onSelect={(a) => setOverride({ audience: a.audience, slug: a.slug })}
                  />
                </div>
              )}
            </article>
          )}

          {!loading && !errored && payload && showFallbackList && (
            <div>
              <p className="text-sm text-slate-600 mb-4">
                {query
                  ? `Results for “${query}”`
                  : 'Browse the help articles relevant to you.'}
              </p>
              {filteredArticles.length === 0 ? (
                <div className="rounded-2xl bg-white/70 ring-1 ring-slate-900/[0.06] px-4 py-5 text-sm text-slate-500">
                  Nothing matches that. Try a different word, or open the{' '}
                  <Link href="/help" className="text-emerald-700 underline decoration-emerald-200">
                    full Help Center
                  </Link>
                  .
                </div>
              ) : (
                <ArticleList
                  articles={filteredArticles}
                  onSelect={(a) => {
                    setOverride({ audience: a.audience, slug: a.slug });
                    setQuery('');
                  }}
                />
              )}
            </div>
          )}
        </div>

        {/* Footer — search + full center link */}
        <footer className="border-t border-slate-200/70 bg-white/60 px-5 sm:px-6 py-3 space-y-3">
          <label className="block">
            <span className="sr-only">Search help</span>
            <span className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search help"
                className="
                  w-full rounded-full
                  bg-white ring-1 ring-slate-900/[0.08]
                  pl-9 pr-3 py-2
                  text-sm text-slate-800 placeholder:text-slate-400
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60
                "
              />
            </span>
          </label>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-slate-500">
              {audiences.length} audience{audiences.length === 1 ? '' : 's'} in scope
            </p>
            <div className="flex items-center gap-3">
              {/* Phase 33g: Send feedback link — only surfaces for advisers
                  (audience set includes any org-* audience). The route param
                  pre-fills `surfaceRoute` on the new-thread form so the
                  adviser doesn't have to remember which page they were on. */}
              {audiences.some((a) => a.startsWith('org-')) && pathname && (
                <Link
                  href={`/portal/feedback?route=${encodeURIComponent(pathname)}`}
                  onClick={closeAndReset}
                  className="
                    inline-flex items-center gap-1
                    text-[12px] font-medium text-slate-600
                    hover:text-slate-900
                  "
                >
                  Send feedback
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
              <Link
                href="/help"
                onClick={closeAndReset}
                className="
                  inline-flex items-center gap-1
                  text-[12px] font-medium text-emerald-700
                  hover:text-emerald-800
                "
              >
                Open full Help Center
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </footer>
      </aside>
    </>
  );
}

function ArticleList({
  articles,
  onSelect,
}: {
  articles: DrawerArticleSummary[];
  onSelect: (a: DrawerArticleSummary) => void;
}) {
  return (
    <ul className="space-y-2">
      {articles.map((a) => (
        <li key={`${a.audience}-${a.slug}`}>
          <button
            type="button"
            onClick={() => onSelect(a)}
            className="
              group w-full text-left
              rounded-2xl bg-white/85 ring-1 ring-slate-900/[0.06]
              px-4 py-3
              transition-[transform,box-shadow] duration-200 ease-out
              hover:-translate-y-0.5 hover:shadow-[0_4px_14px_-6px_rgba(11,18,32,0.18)]
              motion-reduce:hover:translate-y-0 motion-reduce:hover:shadow-none
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60
            "
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-slate-900 leading-snug">
                  {a.title}
                </p>
                {a.summary && (
                  <p className="mt-1 text-[12px] text-slate-600 leading-relaxed line-clamp-2">
                    {a.summary}
                  </p>
                )}
                <p className="mt-1.5 text-[10px] uppercase tracking-[0.08em] text-slate-400">
                  {a.audienceLabel}
                  {a.category && ` · ${a.category}`}
                </p>
              </div>
              <ChevronRight className="shrink-0 mt-0.5 h-4 w-4 text-slate-400 group-hover:text-slate-700 transition-colors" />
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
