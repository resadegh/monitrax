'use client';

/**
 * Phase 32C PR4a — Public listing detail.
 *
 * Route: `/marketplace/[slug]`
 *
 * Reads from `GET /api/marketplace/listings/[slug]`. Shows the listing's
 * tagline / blurb, specialisations, regions served, target tiers, recent
 * ratings (non-flagged + isPublic). The "Connect" CTA is placeholder for
 * Phase 32C PR4b's `<AskAProfessionalButton>` — at v1 the link points to
 * `/signup?intent=connect&listing=<slug>` so the prospect creates a free
 * account first; the AskAPro state-machine plugs in here in PR4b/4c.
 */

import { useState, useEffect, use } from 'react';
import Link from 'next/link';

interface Rating {
  id: string;
  stars: number;
  comment: string | null;
  createdAt: string;
}

interface PublicListing {
  id: string;
  publicSlug: string;
  displayName: string;
  tagline: string | null;
  blurb: string | null;
  heroImageUrl: string | null;
  discipline: string;
  specialisations: string[];
  targetTiers: string[];
  regions: string[];
  ratingsCount: number;
  averageRating: string | null;
  acceptedRequestsCount: number;
  ratings: Rating[];
}

function disciplineLabel(d: string): string {
  switch (d) {
    case 'FINANCIAL_ADVISOR': return 'Financial adviser';
    case 'MORTGAGE_BROKER': return 'Mortgage broker';
    case 'ACCOUNTING_FIRM': return 'Accounting firm';
    case 'TAX_AGENT': return 'Tax agent';
    case 'BOOKKEEPER': return 'Bookkeeper';
    case 'OTHER': return 'Professional';
    default: return d;
  }
}

function readableLabel(s: string): string {
  return s
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function MarketplaceListingDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [listing, setListing] = useState<PublicListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/marketplace/listings/${slug}`, { cache: 'no-store' });
        if (res.status === 404) {
          setError('Listing not found');
          return;
        }
        if (!res.ok) throw new Error('Failed to load listing');
        const json = await res.json();
        setListing(json.data?.listing ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load listing');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="rounded-2xl bg-slate-100 animate-pulse h-72" />
      </div>
    );
  }
  if (error || !listing) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h1 className="text-[28px] font-semibold text-slate-900">{error ?? 'Listing not found'}</h1>
        <Link href="/marketplace" className="mt-6 inline-block text-emerald-700 underline">
          ← Back to marketplace
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <Link href="/marketplace" className="text-[13px] text-slate-500 hover:text-slate-900">
        ← Marketplace
      </Link>

      <header className="mt-4 mb-8">
        <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-[11px] font-medium mb-3">
          {disciplineLabel(listing.discipline)}
        </span>
        <h1 className="text-[36px] font-semibold tracking-tight text-slate-900 leading-tight">
          {listing.displayName}
        </h1>
        {listing.tagline && (
          <p className="mt-3 text-[18px] text-slate-600 leading-relaxed max-w-3xl">
            {listing.tagline}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-4 text-[13px] text-slate-600">
          {listing.averageRating && (
            <span className="tabular-nums">
              <span className="font-medium text-slate-900">{parseFloat(listing.averageRating).toFixed(1)} ★</span>
              {' '}({listing.ratingsCount} ratings)
            </span>
          )}
          {listing.acceptedRequestsCount > 0 && (
            <span className="tabular-nums">
              <span className="font-medium text-slate-900">{listing.acceptedRequestsCount}</span> accepted requests
            </span>
          )}
        </div>
      </header>

      {/* CTA */}
      <div className="rounded-2xl bg-emerald-50 ring-1 ring-emerald-200 px-5 py-4 mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-[14px] font-semibold text-emerald-900">Want to talk to {listing.displayName}?</h3>
          <p className="text-[12px] text-emerald-700 mt-0.5">
            Create a free Monitrax account, decide what to share, then send a request.
          </p>
        </div>
        <Link
          href={`/signup?intent=connect&listing=${listing.publicSlug}`}
          className="inline-flex items-center rounded-full bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2 text-[13px] font-medium transition-colors"
        >
          Get started →
        </Link>
      </div>

      {/* Blurb */}
      {listing.blurb && (
        <section className="prose prose-slate max-w-none mb-10">
          <h2 className="text-[18px] font-semibold text-slate-900 mb-3">About</h2>
          <p className="text-[15px] text-slate-700 leading-7 whitespace-pre-wrap">{listing.blurb}</p>
        </section>
      )}

      {/* Specialisations */}
      {listing.specialisations.length > 0 && (
        <section className="mb-10">
          <h2 className="text-[18px] font-semibold text-slate-900 mb-3">Specialisations</h2>
          <div className="flex flex-wrap gap-2">
            {listing.specialisations.map((s) => (
              <span key={s} className="inline-flex items-center rounded-full bg-emerald-50 ring-1 ring-emerald-200 text-emerald-800 px-3 py-1 text-[12px] font-medium">
                {readableLabel(s)}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Target tiers */}
      {listing.targetTiers.length > 0 && (
        <section className="mb-10">
          <h2 className="text-[18px] font-semibold text-slate-900 mb-3">Best fit for</h2>
          <ul className="space-y-1.5 text-[14px] text-slate-700">
            {listing.targetTiers.map((t) => (
              <li key={t} className="flex items-center gap-2">
                <span className="text-emerald-600">✓</span>
                {tierLabel(t)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Regions */}
      {listing.regions.length > 0 && (
        <section className="mb-10">
          <h2 className="text-[18px] font-semibold text-slate-900 mb-3">Regions served</h2>
          <p className="text-[14px] text-slate-700">
            {listing.regions.map(readableLabel).join(' · ')}
          </p>
        </section>
      )}

      {/* Ratings */}
      {listing.ratings.length > 0 && (
        <section className="mb-10">
          <h2 className="text-[18px] font-semibold text-slate-900 mb-4">Recent ratings</h2>
          <div className="space-y-4">
            {listing.ratings.map((r) => (
              <article key={r.id} className="rounded-xl bg-white ring-1 ring-slate-200/70 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[14px] font-medium text-amber-600 tabular-nums">
                    {'★'.repeat(r.stars)}
                    <span className="text-slate-300">{'★'.repeat(5 - r.stars)}</span>
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {new Date(r.createdAt).toLocaleDateString('en-AU', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
                {r.comment && <p className="text-[14px] text-slate-700 leading-relaxed">{r.comment}</p>}
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Compliance footer */}
      <footer className="mt-12 pt-6 border-t border-slate-200/70 text-[12px] text-slate-500 leading-relaxed">
        Listings on Monitrax are reviewed before going live. AFSL / credit representative / tax-agent numbers are
        cross-checked against ASIC and the Tax Practitioners Board public registers. Monitrax doesn&rsquo;t provide
        personal financial advice — your conversation with this professional is a separate engagement governed by their
        own AFSL / credit / TPB licence.
      </footer>
    </div>
  );
}

function tierLabel(t: string): string {
  switch (t) {
    case 'EMERGING': return 'People starting out (under $200k)';
    case 'GROWING': return 'Building wealth ($200k – $1M)';
    case 'ESTABLISHED': return 'Established families ($1M – $3M)';
    case 'HIGH_NET_WORTH': return 'High-net-worth households ($3M+)';
    default: return readableLabel(t);
  }
}
