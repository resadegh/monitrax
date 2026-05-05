'use client';

/**
 * Phase 32C PR4a — Admin marketplace listing drill-in.
 *
 * Route: `/admin/marketplace/listings/[id]`
 *
 * Full listing detail with the manual ASIC + TPB cross-check workflow.
 * Approve / reject / suspend actions invoke `POST /api/admin/marketplace/
 * listings/[id]` with the appropriate `action` body.
 *
 * Approval workflow:
 *   1. Admin opens this page from the queue
 *   2. Admin opens the relevant register in another tab:
 *      - ASIC AFSL register (https://www.moneysmart.gov.au/financial-advisers-register)
 *        for FINANCIAL_ADVISOR
 *      - ASIC Credit Representative register for MORTGAGE_BROKER
 *      - TPB register (https://www.tpb.gov.au/public-register) for TAX_AGENT
 *      - ABR (https://www.abr.business.gov.au) for ABN cross-check
 *   3. Admin records the cross-check + approves / rejects with notes
 *
 * `verificationNotes` is a free-text scratchpad for the admin's reasoning.
 * Auditor can read it later to understand WHY a particular listing was
 * approved despite e.g. a non-standard discipline.
 */

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { AdminCard, AdminCardHeader } from '@/components/admin/ui/AdminCard';
import { AdminButton } from '@/components/admin/ui/AdminButton';
import { Textarea } from '@/components/admin/ui/AdminForm';

interface ListingDetail {
  id: string;
  publicSlug: string;
  displayName: string;
  tagline: string | null;
  blurb: string | null;
  discipline: string;
  specialisations: string[];
  targetTiers: string[];
  regions: string[];
  afslNumber: string | null;
  creditRepNumber: string | null;
  tpbNumber: string | null;
  abn: string | null;
  status: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  verificationNotes: string | null;
  asicCrossCheckedAt: string | null;
  tpbCrossCheckedAt: string | null;
  leadFeeTierEmerging: string;
  leadFeeTierGrowing: string;
  leadFeeTierEstablished: string;
  ratingsCount: number;
  averageRating: string | null;
  acceptedRequestsCount: number;
  organization: {
    id: string;
    name: string;
    slug: string;
    profession: string | null;
    members: Array<{ userId: string; role: string; isActive: boolean }>;
  };
  reviewedByAdmin: { id: string; name: string; email: string } | null;
}

export default function AdminListingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [verificationNotes, setVerificationNotes] = useState('');
  const [asicCrossChecked, setAsicCrossChecked] = useState(false);
  const [tpbCrossChecked, setTpbCrossChecked] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionInFlight, setActionInFlight] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketplace/listings/${id}`, { cache: 'no-store' });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error?.message ?? 'Failed to load listing');
      }
      const json = await res.json();
      setListing(json.data?.listing ?? null);
      setVerificationNotes(json.data?.listing?.verificationNotes ?? '');
      setAsicCrossChecked(Boolean(json.data?.listing?.asicCrossCheckedAt));
      setTpbCrossChecked(Boolean(json.data?.listing?.tpbCrossCheckedAt));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load listing');
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const performAction = useCallback(async (
    action: 'approve' | 'reject' | 'suspend',
    extras: Record<string, unknown> = {},
  ) => {
    setActionInFlight(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/marketplace/listings/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extras }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message ?? `${action} failed`);
      setListing(json.data.listing);
      setShowRejectForm(false);
      setShowSuspendForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : `${action} failed`);
    } finally {
      setActionInFlight(null);
    }
  }, [id]);

  if (isLoading) {
    return (
      <AdminCard>
        <p className="text-[13px] text-gray-500">Loading listing…</p>
      </AdminCard>
    );
  }
  if (!listing) {
    return (
      <AdminCard>
        <p className="text-[13px] text-rose-700">{error ?? 'Listing not found'}</p>
        <button
          type="button"
          className="mt-3 text-[13px] text-emerald-700 underline"
          onClick={() => router.push('/admin/marketplace/listings')}
        >
          ← Back to queue
        </button>
      </AdminCard>
    );
  }

  const isPending = listing.status === 'PENDING_REVIEW';
  const isApproved = listing.status === 'APPROVED';

  return (
    <div className="space-y-6">
      <Link href="/admin/marketplace/listings" className="text-[13px] text-emerald-700 hover:underline">
        ← Back to queue
      </Link>

      <AdminHeader
        title={listing.displayName}
        description={`${listing.organization.name} · /${listing.publicSlug} · ${listing.status}`}
      />

      {error && (
        <AdminCard>
          <p className="text-[13px] text-rose-700">{error}</p>
        </AdminCard>
      )}

      {/* Listing detail */}
      <AdminCard>
        <AdminCardHeader title="Listing content" />
        <DetailRow label="Display name" value={listing.displayName} />
        <DetailRow label="Tagline" value={listing.tagline ?? '—'} />
        <DetailRow label="Blurb" value={<span className="whitespace-pre-wrap">{listing.blurb ?? '—'}</span>} />
        <DetailRow label="Discipline" value={listing.discipline} />
        <DetailRow label="Specialisations" value={listing.specialisations.join(', ') || '—'} />
        <DetailRow label="Target tiers" value={listing.targetTiers.join(', ') || '—'} />
        <DetailRow label="Regions" value={listing.regions.join(', ') || '—'} />
      </AdminCard>

      {/* Compliance numbers + cross-check */}
      <AdminCard>
        <AdminCardHeader title="Compliance numbers (manual cross-check)" />
        <DetailRow
          label="AFSL"
          value={
            <span>
              {listing.afslNumber ?? '—'}
              {listing.afslNumber && (
                <a
                  className="ml-3 text-[12px] text-emerald-700 underline"
                  href={`https://www.moneysmart.gov.au/financial-advisers-register?fr=${encodeURIComponent(listing.afslNumber)}`}
                  target="_blank"
                  rel="noopener"
                >
                  Open ASIC register ↗
                </a>
              )}
            </span>
          }
        />
        <DetailRow
          label="Credit rep"
          value={listing.creditRepNumber ?? '—'}
        />
        <DetailRow
          label="TPB"
          value={
            <span>
              {listing.tpbNumber ?? '—'}
              {listing.tpbNumber && (
                <a
                  className="ml-3 text-[12px] text-emerald-700 underline"
                  href="https://www.tpb.gov.au/public-register"
                  target="_blank"
                  rel="noopener"
                >
                  Open TPB register ↗
                </a>
              )}
            </span>
          }
        />
        <DetailRow
          label="ABN"
          value={
            <span>
              {listing.abn ?? '—'}
              {listing.abn && (
                <a
                  className="ml-3 text-[12px] text-emerald-700 underline"
                  href={`https://abr.business.gov.au/ABN/View?id=${encodeURIComponent(listing.abn.replace(/\s/g, ''))}`}
                  target="_blank"
                  rel="noopener"
                >
                  Open ABR ↗
                </a>
              )}
            </span>
          }
        />

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={asicCrossChecked}
              onChange={(e) => setAsicCrossChecked(e.target.checked)}
              className="rounded border-gray-300"
            />
            ASIC register cross-checked
            {listing.asicCrossCheckedAt && (
              <span className="ml-2 text-[11px] text-gray-500">
                (recorded {new Date(listing.asicCrossCheckedAt).toLocaleString('en-AU')})
              </span>
            )}
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              checked={tpbCrossChecked}
              onChange={(e) => setTpbCrossChecked(e.target.checked)}
              className="rounded border-gray-300"
            />
            TPB register cross-checked
            {listing.tpbCrossCheckedAt && (
              <span className="ml-2 text-[11px] text-gray-500">
                (recorded {new Date(listing.tpbCrossCheckedAt).toLocaleString('en-AU')})
              </span>
            )}
          </label>
        </div>

        <div className="mt-4">
          <Textarea
            label="Verification notes"
            helperText="Free text — what did you find on the registers? Context for future audit."
            value={verificationNotes}
            onChange={(e) => setVerificationNotes(e.target.value)}
            rows={4}
          />
        </div>
      </AdminCard>

      {/* Lifecycle metadata */}
      <AdminCard>
        <AdminCardHeader title="Lifecycle" />
        <DetailRow label="Status" value={listing.status} />
        <DetailRow label="Submitted" value={listing.submittedAt ? new Date(listing.submittedAt).toLocaleString('en-AU') : '—'} />
        <DetailRow label="Last reviewed" value={listing.reviewedAt ? new Date(listing.reviewedAt).toLocaleString('en-AU') : '—'} />
        <DetailRow
          label="Reviewed by"
          value={listing.reviewedByAdmin ? `${listing.reviewedByAdmin.name} (${listing.reviewedByAdmin.email})` : '—'}
        />
        {listing.rejectionReason && (
          <DetailRow label="Rejection reason" value={listing.rejectionReason} />
        )}
        <DetailRow
          label="Lead-fee tiers"
          value={`Emerging $${listing.leadFeeTierEmerging} · Growing $${listing.leadFeeTierGrowing} · Established $${listing.leadFeeTierEstablished}`}
        />
        <DetailRow
          label="Engagement"
          value={`${listing.acceptedRequestsCount} accepted requests${listing.averageRating ? ` · ${listing.averageRating} ★ (${listing.ratingsCount} ratings)` : ''}`}
        />
      </AdminCard>

      {/* Actions */}
      {(isPending || isApproved) && (
        <AdminCard>
          <AdminCardHeader title="Actions" />
          <div className="flex flex-wrap gap-3">
            {isPending && (
              <>
                <AdminButton
                  variant="primary"
                  disabled={actionInFlight !== null}
                  onClick={() =>
                    performAction('approve', {
                      asicCrossChecked,
                      tpbCrossChecked,
                      verificationNotes: verificationNotes || null,
                    })
                  }
                >
                  {actionInFlight === 'approve' ? 'Approving…' : 'Approve'}
                </AdminButton>
                <AdminButton
                  variant="secondary"
                  onClick={() => setShowRejectForm(!showRejectForm)}
                  disabled={actionInFlight !== null}
                >
                  Reject…
                </AdminButton>
              </>
            )}
            {isApproved && (
              <AdminButton
                variant="secondary"
                onClick={() => setShowSuspendForm(!showSuspendForm)}
                disabled={actionInFlight !== null}
              >
                Suspend…
              </AdminButton>
            )}
          </div>

          {showRejectForm && (
            <div className="mt-4 space-y-3">
              <Textarea
                label="Rejection reason (sent to Org)"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                placeholder="e.g. AFSL number could not be verified on ASIC register; please confirm and resubmit."
              />
              <div className="flex gap-2">
                <AdminButton
                  variant="primary"
                  disabled={actionInFlight !== null || rejectionReason.trim().length < 5}
                  onClick={() =>
                    performAction('reject', {
                      reason: rejectionReason,
                      verificationNotes: verificationNotes || null,
                    })
                  }
                >
                  {actionInFlight === 'reject' ? 'Rejecting…' : 'Confirm reject'}
                </AdminButton>
                <AdminButton variant="secondary" onClick={() => setShowRejectForm(false)}>
                  Cancel
                </AdminButton>
              </div>
            </div>
          )}

          {showSuspendForm && (
            <div className="mt-4 space-y-3">
              <Textarea
                label="Suspension reason (sent to Org)"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                rows={3}
                placeholder="e.g. ASIC compliance complaint received; suspending pending investigation."
              />
              <div className="flex gap-2">
                <AdminButton
                  variant="primary"
                  disabled={actionInFlight !== null || suspendReason.trim().length < 5}
                  onClick={() =>
                    performAction('suspend', { reason: suspendReason })
                  }
                >
                  {actionInFlight === 'suspend' ? 'Suspending…' : 'Confirm suspend'}
                </AdminButton>
                <AdminButton variant="secondary" onClick={() => setShowSuspendForm(false)}>
                  Cancel
                </AdminButton>
              </div>
            </div>
          )}
        </AdminCard>
      )}
    </div>
  );
}

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
}
function DetailRow({ label, value }: DetailRowProps) {
  return (
    <div className="flex flex-col md:flex-row gap-1 md:gap-4 py-2 border-b border-gray-100 dark:border-gray-800 last:border-b-0">
      <div className="text-[12px] font-medium text-gray-500 md:w-40 md:flex-shrink-0">{label}</div>
      <div className="text-[13px] text-gray-900 dark:text-gray-100">{value}</div>
    </div>
  );
}
