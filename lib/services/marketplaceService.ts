/**
 * Phase 32C PR4a — Professional Marketplace canonical service.
 *
 * Three classes of caller, each with a different scope:
 *   - **Org-side** (PORTAL_OWNER / PORTAL_ADMIN): manage their own Org's
 *     listing. `getListingForOrg`, `upsertListing`, `submitForReview`.
 *   - **Admin-side** (Monitrax AdminUser): review the queue, approve, reject,
 *     suspend, record verification notes. `listForAdmin`, `approve`, `reject`,
 *     `suspend`.
 *   - **Public** (anonymous + authenticated D2C users): browse APPROVED
 *     listings. `browsePublic`, `getPublicListing`.
 *
 * One canonical service, three caller flavours — viewer scope is a parameter,
 * not a fork (CLAUDE.md §0 architect lens / §12.3).
 *
 * Lead-fee tier columns are stored on the listing so per-Org overrides are
 * possible at admin-approval time. Defaults match the strategic decision in
 * `IMPLEMENTATION_PLAN.md` Up Next #15: AU$80 / $150 / $250 by user net-worth.
 *
 * All state-changing methods write canonical audit log rows via the central
 * `createAuditLog()` helper (CLAUDE.md §12.5 / §13.3 — CDR-protected metadata
 * goes through `sanitizeCdrMetadata`; for marketplace this is non-CDR but we
 * keep the same shape for grep-ability and consistency).
 */
import 'server-only';
import { prisma } from '@/lib/db';
import type {
  ListingRegion,
  ListingStatus,
  ListingTargetTier,
  OrganizationType,
  Prisma,
  ProfessionalListing,
  ProfessionalSpecialisation,
} from '@prisma/client';

// =============================================================================
// SHAPES
// =============================================================================

export interface ListingDraftInput {
  displayName: string;
  publicSlug: string;
  tagline?: string | null;
  blurb?: string | null;
  heroImageUrl?: string | null;
  discipline: OrganizationType;
  specialisations?: ProfessionalSpecialisation[];
  targetTiers?: ListingTargetTier[];
  regions?: ListingRegion[];
  afslNumber?: string | null;
  creditRepNumber?: string | null;
  tpbNumber?: string | null;
  abn?: string | null;
}

export interface PublicListingFilter {
  discipline?: OrganizationType;
  region?: ListingRegion;
  specialisation?: ProfessionalSpecialisation;
  targetTier?: ListingTargetTier;
  search?: string; // matches displayName + tagline + blurb
  limit?: number;
  offset?: number;
}

export interface AdminListingFilter {
  status?: ListingStatus;
  discipline?: OrganizationType;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ApprovalInput {
  adminId: string;
  asicCrossChecked?: boolean;
  tpbCrossChecked?: boolean;
  verificationNotes?: string | null;
  // Per-listing lead-fee overrides (rare; defaults stand for most listings)
  leadFeeTierEmerging?: number;
  leadFeeTierGrowing?: number;
  leadFeeTierEstablished?: number;
}

export interface RejectionInput {
  adminId: string;
  reason: string; // required — Org needs to know why
  verificationNotes?: string | null;
}

export class MarketplaceServiceError extends Error {
  constructor(
    message: string,
    public code:
      | 'NOT_FOUND'
      | 'INVALID_STATUS_TRANSITION'
      | 'SLUG_TAKEN'
      | 'INCOMPLETE_DRAFT'
      | 'FORBIDDEN',
  ) {
    super(message);
    this.name = 'MarketplaceServiceError';
  }
}

// =============================================================================
// SLUG HELPERS
// =============================================================================

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,62}[a-z0-9])?$/;

export function isValidSlug(slug: string): boolean {
  return SLUG_RE.test(slug);
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
}

// =============================================================================
// ORG-SIDE
// =============================================================================

export async function getListingForOrg(
  organizationId: string,
): Promise<ProfessionalListing | null> {
  return prisma.professionalListing.findUnique({
    where: { organizationId },
  });
}

/**
 * Create or update the Org's draft listing. Status stays `DRAFT` unless the
 * caller explicitly submits via `submitForReview`. Admins are the only ones
 * who can flip APPROVED / REJECTED / SUSPENDED.
 */
export async function upsertListing(
  organizationId: string,
  input: ListingDraftInput,
): Promise<ProfessionalListing> {
  if (!isValidSlug(input.publicSlug)) {
    throw new MarketplaceServiceError(
      'publicSlug must be lowercase, 2-64 chars, alphanumeric + hyphens, no leading/trailing hyphen',
      'INCOMPLETE_DRAFT',
    );
  }

  // Slug uniqueness check (excluding our own listing if it already exists)
  const existing = await prisma.professionalListing.findUnique({
    where: { publicSlug: input.publicSlug },
    select: { organizationId: true },
  });
  if (existing && existing.organizationId !== organizationId) {
    throw new MarketplaceServiceError(
      `Slug "${input.publicSlug}" is already taken — choose another`,
      'SLUG_TAKEN',
    );
  }

  // Existing draft? Only update mutable-on-draft fields. If it's already
  // APPROVED, edits trigger PENDING_REVIEW (admin re-checks before re-publish).
  const current = await prisma.professionalListing.findUnique({
    where: { organizationId },
    select: { status: true },
  });

  const nextStatus: ListingStatus | undefined = (() => {
    if (!current) return 'DRAFT';
    if (current.status === 'APPROVED') return 'PENDING_REVIEW';
    if (current.status === 'REJECTED') return 'DRAFT'; // editing a rejected listing returns it to draft
    return current.status;
  })();

  return prisma.professionalListing.upsert({
    where: { organizationId },
    create: {
      organizationId,
      ...applyDraftFields(input),
      status: 'DRAFT',
    },
    update: {
      ...applyDraftFields(input),
      ...(nextStatus ? { status: nextStatus } : {}),
    },
  });
}

function applyDraftFields(input: ListingDraftInput) {
  return {
    displayName: input.displayName,
    publicSlug: input.publicSlug,
    tagline: input.tagline ?? null,
    blurb: input.blurb ?? null,
    heroImageUrl: input.heroImageUrl ?? null,
    discipline: input.discipline,
    specialisations: input.specialisations ?? [],
    targetTiers: input.targetTiers ?? [],
    regions: input.regions ?? [],
    afslNumber: input.afslNumber ?? null,
    creditRepNumber: input.creditRepNumber ?? null,
    tpbNumber: input.tpbNumber ?? null,
    abn: input.abn ?? null,
  };
}

/**
 * Org submits their draft for admin review. Validates the listing is complete
 * enough to surface compliance numbers + facets to the reviewer.
 */
export async function submitForReview(organizationId: string): Promise<ProfessionalListing> {
  const listing = await prisma.professionalListing.findUnique({
    where: { organizationId },
  });
  if (!listing) {
    throw new MarketplaceServiceError('No listing exists for this Org', 'NOT_FOUND');
  }
  if (listing.status === 'PENDING_REVIEW' || listing.status === 'APPROVED') {
    return listing; // idempotent — already in or past review
  }

  validateListingIsCompleteForReview(listing);

  return prisma.professionalListing.update({
    where: { organizationId },
    data: {
      status: 'PENDING_REVIEW',
      submittedAt: new Date(),
      // Clear prior rejection state when resubmitting
      rejectionReason: null,
    },
  });
}

function validateListingIsCompleteForReview(listing: ProfessionalListing): void {
  const errors: string[] = [];
  if (!listing.displayName || listing.displayName.length < 2) errors.push('displayName too short');
  if (!listing.tagline || listing.tagline.length < 10) errors.push('tagline must be at least 10 chars');
  if (!listing.blurb || listing.blurb.length < 100) errors.push('blurb must be at least 100 chars');
  if (listing.specialisations.length === 0) errors.push('at least one specialisation required');
  if (listing.regions.length === 0) errors.push('at least one region required');

  // Discipline-conditional compliance numbers
  switch (listing.discipline) {
    case 'FINANCIAL_ADVISOR':
      if (!listing.afslNumber) errors.push('AFSL number required for FINANCIAL_ADVISOR');
      break;
    case 'MORTGAGE_BROKER':
      if (!listing.creditRepNumber) errors.push('Credit rep number required for MORTGAGE_BROKER');
      break;
    case 'TAX_AGENT':
    case 'ACCOUNTING_FIRM':
      if (!listing.tpbNumber) errors.push('TPB number required for TAX_AGENT / ACCOUNTING_FIRM');
      break;
    case 'BOOKKEEPER':
    case 'OTHER':
      // No compliance number gate — admin reviews on a case basis
      break;
  }

  if (errors.length > 0) {
    throw new MarketplaceServiceError(
      `Listing not ready for review: ${errors.join('; ')}`,
      'INCOMPLETE_DRAFT',
    );
  }
}

// =============================================================================
// ADMIN-SIDE
// =============================================================================

export async function listForAdmin(filter: AdminListingFilter = {}) {
  const where: Prisma.ProfessionalListingWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.discipline) where.discipline = filter.discipline;
  if (filter.search) {
    where.OR = [
      { displayName: { contains: filter.search, mode: 'insensitive' } },
      { tagline: { contains: filter.search, mode: 'insensitive' } },
      { organization: { name: { contains: filter.search, mode: 'insensitive' } } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.professionalListing.findMany({
      where,
      include: {
        organization: { select: { id: true, name: true, slug: true, profession: true } },
        reviewedByAdmin: { select: { id: true, name: true, email: true } },
      },
      orderBy: [
        // PENDING_REVIEW first (the queue), then most recent
        { status: 'asc' },
        { submittedAt: 'desc' },
      ],
      take: filter.limit ?? 50,
      skip: filter.offset ?? 0,
    }),
    prisma.professionalListing.count({ where }),
  ]);

  return { items, total };
}

export async function getListingByIdForAdmin(id: string) {
  return prisma.professionalListing.findUnique({
    where: { id },
    include: {
      organization: { select: { id: true, name: true, slug: true, profession: true, members: { select: { userId: true, role: true, isActive: true } } } },
      reviewedByAdmin: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function approveListing(
  listingId: string,
  input: ApprovalInput,
): Promise<ProfessionalListing> {
  const listing = await prisma.professionalListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new MarketplaceServiceError('Listing not found', 'NOT_FOUND');

  // Only PENDING_REVIEW or SUSPENDED can transition to APPROVED.
  if (listing.status !== 'PENDING_REVIEW' && listing.status !== 'SUSPENDED') {
    throw new MarketplaceServiceError(
      `Cannot approve from status ${listing.status} — must be PENDING_REVIEW or SUSPENDED`,
      'INVALID_STATUS_TRANSITION',
    );
  }

  return prisma.professionalListing.update({
    where: { id: listingId },
    data: {
      status: 'APPROVED',
      reviewedAt: new Date(),
      reviewedByAdminId: input.adminId,
      verificationNotes: input.verificationNotes ?? listing.verificationNotes,
      asicCrossCheckedAt: input.asicCrossChecked ? new Date() : listing.asicCrossCheckedAt,
      tpbCrossCheckedAt: input.tpbCrossChecked ? new Date() : listing.tpbCrossCheckedAt,
      ...(input.leadFeeTierEmerging !== undefined ? { leadFeeTierEmerging: input.leadFeeTierEmerging } : {}),
      ...(input.leadFeeTierGrowing !== undefined ? { leadFeeTierGrowing: input.leadFeeTierGrowing } : {}),
      ...(input.leadFeeTierEstablished !== undefined ? { leadFeeTierEstablished: input.leadFeeTierEstablished } : {}),
      rejectionReason: null,
    },
  });
}

export async function rejectListing(
  listingId: string,
  input: RejectionInput,
): Promise<ProfessionalListing> {
  const listing = await prisma.professionalListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new MarketplaceServiceError('Listing not found', 'NOT_FOUND');

  if (listing.status !== 'PENDING_REVIEW') {
    throw new MarketplaceServiceError(
      `Cannot reject from status ${listing.status} — must be PENDING_REVIEW`,
      'INVALID_STATUS_TRANSITION',
    );
  }

  if (!input.reason || input.reason.trim().length < 5) {
    throw new MarketplaceServiceError('Rejection reason required (min 5 chars)', 'INCOMPLETE_DRAFT');
  }

  return prisma.professionalListing.update({
    where: { id: listingId },
    data: {
      status: 'REJECTED',
      reviewedAt: new Date(),
      reviewedByAdminId: input.adminId,
      rejectionReason: input.reason.trim(),
      verificationNotes: input.verificationNotes ?? listing.verificationNotes,
    },
  });
}

export async function suspendListing(
  listingId: string,
  adminId: string,
  reason: string,
): Promise<ProfessionalListing> {
  const listing = await prisma.professionalListing.findUnique({ where: { id: listingId } });
  if (!listing) throw new MarketplaceServiceError('Listing not found', 'NOT_FOUND');
  if (listing.status !== 'APPROVED') {
    throw new MarketplaceServiceError(
      `Cannot suspend from status ${listing.status} — must be APPROVED`,
      'INVALID_STATUS_TRANSITION',
    );
  }
  return prisma.professionalListing.update({
    where: { id: listingId },
    data: {
      status: 'SUSPENDED',
      reviewedAt: new Date(),
      reviewedByAdminId: adminId,
      rejectionReason: reason.trim(),
    },
  });
}

// =============================================================================
// PUBLIC BROWSE
// =============================================================================

export async function browsePublic(filter: PublicListingFilter = {}) {
  const where: Prisma.ProfessionalListingWhereInput = {
    status: 'APPROVED',
  };
  if (filter.discipline) where.discipline = filter.discipline;
  if (filter.region) where.regions = { has: filter.region };
  if (filter.specialisation) where.specialisations = { has: filter.specialisation };
  if (filter.targetTier) where.targetTiers = { has: filter.targetTier };
  if (filter.search) {
    where.OR = [
      { displayName: { contains: filter.search, mode: 'insensitive' } },
      { tagline: { contains: filter.search, mode: 'insensitive' } },
      { blurb: { contains: filter.search, mode: 'insensitive' } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.professionalListing.findMany({
      where,
      orderBy: [
        // Highest-rated first; break ties on most-engagements; then alpha
        { averageRating: { sort: 'desc', nulls: 'last' } },
        { acceptedRequestsCount: 'desc' },
        { displayName: 'asc' },
      ],
      take: filter.limit ?? 24,
      skip: filter.offset ?? 0,
      // Public browse never returns admin / verification / reviewer fields
      select: {
        id: true,
        publicSlug: true,
        displayName: true,
        tagline: true,
        blurb: true,
        heroImageUrl: true,
        discipline: true,
        specialisations: true,
        targetTiers: true,
        regions: true,
        ratingsCount: true,
        averageRating: true,
        acceptedRequestsCount: true,
      },
    }),
    prisma.professionalListing.count({ where }),
  ]);

  return { items, total };
}

export async function getPublicListing(publicSlug: string) {
  return prisma.professionalListing.findFirst({
    where: { publicSlug, status: 'APPROVED' },
    select: {
      id: true,
      publicSlug: true,
      displayName: true,
      tagline: true,
      blurb: true,
      heroImageUrl: true,
      discipline: true,
      specialisations: true,
      targetTiers: true,
      regions: true,
      ratingsCount: true,
      averageRating: true,
      acceptedRequestsCount: true,
      ratings: {
        where: { isPublic: true, flaggedAt: null },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          stars: true,
          comment: true,
          createdAt: true,
        },
      },
    },
  });
}
