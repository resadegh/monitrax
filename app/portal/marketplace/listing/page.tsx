/**
 * Phase 32C PR4a — Org-side marketplace listing editor.
 *
 * Route: `/portal/marketplace/listing`
 *
 * Where an Org owner / admin builds + maintains their public profile on the
 * Monitrax marketplace. The editor mirrors the public listing surface as a
 * preview so the user sees what visitors will see before submitting for
 * review.
 *
 * Status badge top-right reflects the current lifecycle:
 *   - DRAFT — editing freely
 *   - PENDING_REVIEW — submitted; locked until admin acts
 *   - APPROVED — live on marketplace; edits flip back to PENDING_REVIEW
 *   - REJECTED — admin rejection reason shown inline; editing returns to DRAFT
 *   - SUSPENDED — admin pulled the listing offline; reason shown
 *
 * Design language: same Apple-glass tokens as `PracticeGlassCard` (warm
 * ivory, 28px radius, ring border) so the editor sits inside the Practice
 * surface without looking grafted-on.
 *
 * Submit-for-review is OWNER-only. ADMIN can edit; ADVISOR/VIEWER read-only.
 */
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useOrganization } from '@/lib/portal';
import { PracticeGlassCard } from '@/components/portal/practice';
import { PortalPageHero } from '@/components/shell';
import { getPracticeProfessionConfig } from '@/lib/portal/practice';
import { MarketplaceListingEditor } from '@/components/portal/marketplace/MarketplaceListingEditor';

interface ListingState {
  id: string;
  organizationId: string;
  publicSlug: string;
  displayName: string;
  tagline: string | null;
  blurb: string | null;
  heroImageUrl: string | null;
  discipline: string;
  specialisations: string[];
  targetTiers: string[];
  regions: string[];
  afslNumber: string | null;
  creditRepNumber: string | null;
  tpbNumber: string | null;
  abn: string | null;
  status: string;
  rejectionReason: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  ratingsCount: number;
  averageRating: string | null;
  acceptedRequestsCount: number;
}

export default function PortalMarketplaceListingPage() {
  const { currentOrg } = useOrganization();
  const [listing, setListing] = useState<ListingState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orgId = currentOrg?.id ?? null;
  const profession =
    (currentOrg?.profession as string | null) ??
    (currentOrg?.organizationType as string | null) ??
    'FINANCIAL_ADVISOR';
  const practiceLabel = getPracticeProfessionConfig(profession as never).practiceLabel;

  const userRole = currentOrg?.role ?? 'VIEWER';
  const canEdit = userRole === 'OWNER' || userRole === 'ADMIN';
  const canSubmit = userRole === 'OWNER';

  const loadListing = useCallback(async () => {
    if (!orgId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/portal/organizations/${orgId}/marketplace-listing`, {
        cache: 'no-store',
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Failed to load listing');
      }
      const json = await res.json();
      setListing(json.data?.listing ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load listing');
    } finally {
      setIsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadListing();
  }, [loadListing]);

  const statusBadge = useMemo(() => {
    if (!listing) return null;
    const map: Record<string, { tone: string; label: string }> = {
      DRAFT: { tone: 'bg-slate-100 text-slate-700 ring-slate-200', label: 'Draft' },
      PENDING_REVIEW: { tone: 'bg-amber-50 text-amber-700 ring-amber-200', label: 'Pending review' },
      APPROVED: { tone: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'Live on marketplace' },
      REJECTED: { tone: 'bg-rose-50 text-rose-700 ring-rose-200', label: 'Rejected — please revise' },
      SUSPENDED: { tone: 'bg-slate-100 text-slate-700 ring-slate-300', label: 'Suspended' },
    };
    const entry = map[listing.status] ?? map.DRAFT;
    return (
      <span className={`inline-flex items-center rounded-full ring-1 ring-inset px-3 py-1 text-[12px] font-medium ${entry.tone}`}>
        {entry.label}
      </span>
    );
  }, [listing]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 space-y-8">
        <PortalPageHero
          atmosphere="emerald"
          greetingName={currentOrg?.name?.split(' ')[0] ?? 'there'}
          practiceLabel={practiceLabel}
          title="Marketplace listing"
          subtitle={`Your public profile on the Monitrax marketplace — where individuals looking for a ${practiceLabel.toLowerCase()} can find you. Listings are reviewed by Monitrax before going live.`}
          actions={statusBadge}
        />

        {listing?.status === 'REJECTED' && listing.rejectionReason && (
          <PracticeGlassCard padding="md" accentTone="critical">
            <h3 className="text-[13px] font-semibold text-rose-700 uppercase tracking-wide mb-2">
              Reviewer feedback
            </h3>
            <p className="text-[14px] text-slate-700 leading-relaxed">{listing.rejectionReason}</p>
            <p className="mt-3 text-[12px] text-slate-500">
              Editing your listing returns it to draft. Resubmit when ready.
            </p>
          </PracticeGlassCard>
        )}

        {listing?.status === 'SUSPENDED' && listing.rejectionReason && (
          <PracticeGlassCard padding="md" accentTone="critical">
            <h3 className="text-[13px] font-semibold text-rose-700 uppercase tracking-wide mb-2">
              Listing suspended
            </h3>
            <p className="text-[14px] text-slate-700 leading-relaxed">{listing.rejectionReason}</p>
          </PracticeGlassCard>
        )}

        {error && (
          <PracticeGlassCard padding="md" accentTone="critical">
            <p className="text-[14px] text-rose-700">{error}</p>
          </PracticeGlassCard>
        )}

        {isLoading ? (
          <PracticeGlassCard padding="lg">
            <p className="text-[14px] text-slate-500">Loading listing…</p>
          </PracticeGlassCard>
        ) : (
          <MarketplaceListingEditor
            orgId={orgId ?? ''}
            orgName={currentOrg?.name ?? ''}
            profession={profession}
            initialListing={listing}
            canEdit={canEdit}
            canSubmit={canSubmit}
            onSaved={(updated) => setListing(updated)}
          />
        )}
      </div>
    </div>
  );
}
