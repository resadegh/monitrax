'use client';

/**
 * Phase 32C PR4a — Public marketplace browse.
 *
 * Route: `/marketplace`
 *
 * D2C discovery surface. Filters: discipline, specialisation, region. Search
 * matches displayName + tagline + blurb. Sorted by averageRating desc, then
 * acceptedRequestsCount desc, then alpha. Pagination via offset.
 *
 * Org-attached users see ONLY their org's roster (Phase 32C PR4b — gated by
 * presence of `OrganizationMember.userId`); they go through the in-app
 * Ask-a-Pro flow rather than this public surface. The "leaky funnel"
 * guardrail is enforced server-side (Phase 32C PR4b/4c) — this page is
 * publicly browsable but org-attached users won't reach it from inside the
 * Monitrax app.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

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
}

const DISCIPLINE_OPTIONS = [
  { value: '', label: 'Any discipline' },
  { value: 'FINANCIAL_ADVISOR', label: 'Financial advisers' },
  { value: 'MORTGAGE_BROKER', label: 'Mortgage brokers' },
  { value: 'ACCOUNTING_FIRM', label: 'Accounting firms' },
  { value: 'TAX_AGENT', label: 'Tax agents' },
];

const REGION_OPTIONS = [
  { value: '', label: 'Any region' },
  { value: 'NATIONAL', label: 'National' },
  { value: 'NSW_SYDNEY_METRO', label: 'NSW — Sydney metro' },
  { value: 'NSW_REGIONAL', label: 'NSW — regional' },
  { value: 'VIC_MELBOURNE_METRO', label: 'VIC — Melbourne metro' },
  { value: 'VIC_REGIONAL', label: 'VIC — regional' },
  { value: 'QLD_BRISBANE_METRO', label: 'QLD — Brisbane metro' },
  { value: 'QLD_REGIONAL', label: 'QLD — regional' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'ACT', label: 'ACT' },
  { value: 'NT', label: 'NT' },
];

const SPECIALISATION_OPTIONS = [
  { value: '', label: 'Any specialisation' },
  { value: 'RETIREMENT_PLANNING', label: 'Retirement planning' },
  { value: 'WEALTH_BUILDING', label: 'Wealth building' },
  { value: 'TAX_OPTIMISATION', label: 'Tax optimisation' },
  { value: 'PROPERTY_INVESTORS', label: 'Property investors' },
  { value: 'TRUST_ACCOUNTING', label: 'Trust accounting' },
  { value: 'SMSF_ACCOUNTING', label: 'SMSF accounting' },
  { value: 'INVESTMENT_LOANS', label: 'Investment loans' },
  { value: 'FIRST_HOME_BUYER', label: 'First-home buyer' },
];

const PAGE_SIZE = 24;

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

function specialisationLabel(s: string): string {
  return s
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function MarketplaceBrowsePage() {
  const [listings, setListings] = useState<PublicListing[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [region, setRegion] = useState('');
  const [specialisation, setSpecialisation] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (discipline) params.set('discipline', discipline);
      if (region) params.set('region', region);
      if (specialisation) params.set('specialisation', specialisation);
      params.set('limit', String(PAGE_SIZE));

      const res = await fetch(`/api/marketplace/listings?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load listings');
      const json = await res.json();
      setListings(json.data?.items ?? []);
      setTotal(json.data?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load listings');
    } finally {
      setIsLoading(false);
    }
  }, [search, discipline, region, specialisation]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-14">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <h1 className="text-[34px] sm:text-[40px] font-semibold tracking-tight text-slate-900 leading-tight">
          Find a professional you can trust
        </h1>
        <p className="mt-4 text-[16px] text-slate-600 leading-relaxed">
          Australian financial advisers, mortgage brokers, and accountants — vetted by Monitrax against ASIC and TPB public registers.
          You stay in control of what they see and when.
        </p>
      </div>

      <div className="bg-white/80 backdrop-blur-sm rounded-2xl ring-1 ring-slate-200/70 p-4 mb-8 grid grid-cols-1 md:grid-cols-4 gap-3">
        <input
          type="text"
          className="rounded-xl border-0 bg-slate-50 px-3.5 py-2.5 text-[14px] text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-emerald-500 transition-shadow"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-xl border-0 bg-slate-50 px-3.5 py-2.5 text-[14px] text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-emerald-500"
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value)}
        >
          {DISCIPLINE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="rounded-xl border-0 bg-slate-50 px-3.5 py-2.5 text-[14px] text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-emerald-500"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
        >
          {REGION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select
          className="rounded-xl border-0 bg-slate-50 px-3.5 py-2.5 text-[14px] text-slate-900 ring-1 ring-inset ring-slate-200 focus:ring-2 focus:ring-inset focus:ring-emerald-500"
          value={specialisation}
          onChange={(e) => setSpecialisation(e.target.value)}
        >
          {SPECIALISATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 ring-1 ring-rose-200 px-4 py-3 text-[13px] text-rose-700 mb-6">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-slate-100 animate-pulse h-56" />
          ))}
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-white/60 ring-1 ring-slate-200/70">
          <p className="text-[15px] text-slate-700">No professionals match your filters yet.</p>
          <p className="mt-2 text-[13px] text-slate-500">
            Try widening your search — or check back soon as more professionals join the marketplace.
          </p>
        </div>
      ) : (
        <>
          <p className="text-[12px] text-slate-500 mb-4 tabular-nums">
            {total} professional{total === 1 ? '' : 's'} found
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listings.map((l) => (
              <Link
                key={l.id}
                href={`/marketplace/${l.publicSlug}`}
                className="group rounded-2xl bg-white ring-1 ring-slate-200/70 hover:ring-slate-300 hover:shadow-[0_4px_24px_-12px_rgba(15,23,42,0.16)] transition-all p-5 flex flex-col"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-700 px-2.5 py-0.5 text-[11px] font-medium">
                    {disciplineLabel(l.discipline)}
                  </span>
                  {l.averageRating && (
                    <span className="text-[12px] text-slate-700 tabular-nums">
                      {parseFloat(l.averageRating).toFixed(1)} ★ ({l.ratingsCount})
                    </span>
                  )}
                </div>
                <h3 className="text-[17px] font-semibold tracking-tight text-slate-900 leading-snug">
                  {l.displayName}
                </h3>
                {l.tagline && (
                  <p className="mt-2 text-[13px] text-slate-600 leading-relaxed line-clamp-3">
                    {l.tagline}
                  </p>
                )}
                {l.specialisations.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {l.specialisations.slice(0, 3).map((s) => (
                      <span key={s} className="inline-flex items-center rounded-full bg-emerald-50 text-emerald-700 px-2 py-0.5 text-[10px] font-medium">
                        {specialisationLabel(s)}
                      </span>
                    ))}
                    {l.specialisations.length > 3 && (
                      <span className="text-[10px] text-slate-500">+{l.specialisations.length - 3}</span>
                    )}
                  </div>
                )}
                <div className="mt-auto pt-4 text-[12px] text-slate-500 flex items-center justify-between">
                  <span>{l.regions.length === 1 ? regionShort(l.regions[0]) : `${l.regions.length} regions`}</span>
                  <span className="text-emerald-700 group-hover:translate-x-0.5 transition-transform">View →</span>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function regionShort(r: string): string {
  switch (r) {
    case 'NATIONAL': return 'National';
    case 'NSW_SYDNEY_METRO': return 'Sydney metro';
    case 'VIC_MELBOURNE_METRO': return 'Melbourne metro';
    case 'QLD_BRISBANE_METRO': return 'Brisbane metro';
    case 'NSW_REGIONAL': return 'NSW regional';
    case 'VIC_REGIONAL': return 'VIC regional';
    case 'QLD_REGIONAL': return 'QLD regional';
    case 'WA': return 'WA';
    case 'SA': return 'SA';
    case 'TAS': return 'TAS';
    case 'ACT': return 'ACT';
    case 'NT': return 'NT';
    default: return r;
  }
}
