'use client';

/**
 * Phase 32C PR4a — Admin marketplace approval queue.
 *
 * Route: `/admin/marketplace/listings`
 *
 * Where Monitrax admins review and approve professional listings before they
 * go live publicly. Lands on `PENDING_REVIEW` by default — that's the queue
 * that needs the admin's time. Filters: status, discipline, search.
 *
 * Each row links to `/admin/marketplace/listings/[id]` for full detail +
 * approve / reject / suspend actions. Manual ASIC + TPB cross-check happens
 * in the detail page; automated cross-check defers to PROD.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard } from '@/components/admin/ui/AdminCard';
import { AdminTable, Pagination } from '@/components/admin/ui/AdminTable';
import { Select } from '@/components/admin/ui/AdminForm';

interface ListingRow {
  id: string;
  publicSlug: string;
  displayName: string;
  tagline: string | null;
  discipline: string;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  ratingsCount: number;
  averageRating: string | null;
  organization: {
    id: string;
    name: string;
    slug: string;
  };
  reviewedByAdmin: { id: string; name: string; email: string } | null;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING_REVIEW', label: 'Pending review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'SUSPENDED', label: 'Suspended' },
];

const DISCIPLINE_OPTIONS = [
  { value: '', label: 'All disciplines' },
  { value: 'FINANCIAL_ADVISOR', label: 'Financial adviser' },
  { value: 'MORTGAGE_BROKER', label: 'Mortgage broker' },
  { value: 'ACCOUNTING_FIRM', label: 'Accounting firm' },
  { value: 'TAX_AGENT', label: 'Tax agent' },
  { value: 'BOOKKEEPER', label: 'Bookkeeper' },
  { value: 'OTHER', label: 'Other' },
];

const PAGE_SIZE = 25;

const STATUS_LABEL: Record<string, { label: string; classes: string }> = {
  DRAFT: { label: 'Draft', classes: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
  PENDING_REVIEW: { label: 'Pending review', classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' },
  APPROVED: { label: 'Approved', classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300' },
  REJECTED: { label: 'Rejected', classes: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300' },
  SUSPENDED: { label: 'Suspended', classes: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
};

function disciplineLabel(d: string): string {
  switch (d) {
    case 'FINANCIAL_ADVISOR': return 'Financial adviser';
    case 'MORTGAGE_BROKER': return 'Mortgage broker';
    case 'ACCOUNTING_FIRM': return 'Accounting firm';
    case 'TAX_AGENT': return 'Tax agent';
    case 'BOOKKEEPER': return 'Bookkeeper';
    case 'OTHER': return 'Other';
    default: return d;
  }
}

export default function AdminMarketplaceListingsPage() {
  const router = useRouter();
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState('PENDING_REVIEW');
  const [disciplineFilter, setDisciplineFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (disciplineFilter) params.set('discipline', disciplineFilter);
      if (search) params.set('search', search);
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String((page - 1) * PAGE_SIZE));

      const res = await fetch(`/api/admin/marketplace/listings?${params.toString()}`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Failed to load listings');
      }
      const json = await res.json();
      setListings(json.data?.items ?? []);
      setTotal(json.data?.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load listings');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, disciplineFilter, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <AdminHeader
        title="Marketplace listings"
        description="Review and approve professional listings before they go live publicly."
        searchPlaceholder="Search by display name, Org name, or tagline…"
        searchValue={search}
        onSearch={(v) => {
          setSearch(v);
          setPage(1);
        }}
      />

      <AdminCard>
        <div className="flex flex-col md:flex-row gap-3 mb-4">
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
          />
          <Select
            value={disciplineFilter}
            onChange={(e) => {
              setDisciplineFilter(e.target.value);
              setPage(1);
            }}
            options={DISCIPLINE_OPTIONS}
          />
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 dark:bg-rose-900/20 px-4 py-3 text-[13px] text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <AdminTable<ListingRow>
          columns={[
            {
              key: 'name',
              header: 'Listing',
              render: (l) => (
                <div>
                  <div className="font-medium text-gray-900 dark:text-white">{l.displayName}</div>
                  {l.tagline && (
                    <div className="text-[12px] text-gray-500 truncate max-w-md">{l.tagline}</div>
                  )}
                </div>
              ),
            },
            {
              key: 'org',
              header: 'Organization',
              render: (l) => (
                <div className="text-[13px]">
                  <div className="text-gray-900 dark:text-white">{l.organization.name}</div>
                  <div className="text-gray-500">/{l.publicSlug}</div>
                </div>
              ),
            },
            {
              key: 'discipline',
              header: 'Discipline',
              render: (l) => <span className="text-[13px] text-gray-700 dark:text-gray-300">{disciplineLabel(l.discipline)}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              render: (l) => {
                const entry = STATUS_LABEL[l.status] ?? STATUS_LABEL.DRAFT;
                return (
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${entry.classes}`}>
                    {entry.label}
                  </span>
                );
              },
            },
            {
              key: 'submitted',
              header: 'Submitted',
              render: (l) => (
                <span className="text-[13px] text-gray-500 tabular-nums">
                  {l.submittedAt
                    ? new Date(l.submittedAt).toLocaleDateString('en-AU', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—'}
                </span>
              ),
            },
            {
              key: 'rating',
              header: 'Rating',
              render: (l) => (
                <span className="text-[13px] text-gray-700 dark:text-gray-300 tabular-nums">
                  {l.averageRating ? `${parseFloat(l.averageRating).toFixed(1)} ★ (${l.ratingsCount})` : '—'}
                </span>
              ),
            },
          ]}
          data={listings}
          keyExtractor={(l) => l.id}
          isLoading={isLoading}
          onRowClick={(l) => router.push(`/admin/marketplace/listings/${l.id}`)}
          emptyMessage="No listings match these filters."
        />

        {totalPages > 1 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={total}
            itemsPerPage={PAGE_SIZE}
          />
        )}
      </AdminCard>
    </div>
  );
}
