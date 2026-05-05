/**
 * Phase 32C PR4b — Ask-a-Professional candidate resolver.
 *
 * Computes the picker contents for the in-app `<AskAProfessionalButton />`.
 * Two scopes:
 *
 *   - **org** — the user has at least one active+granted `OrganizationClient`
 *     row. Picker shows the assigned advisor (or the firm's roster when no
 *     specific assignment) — STRICTLY scoped to the user's existing org(s).
 *     Other orgs and the public marketplace are NOT shown. This is the
 *     "leaky funnel" guardrail (per IMPLEMENTATION_PLAN.md Up Next #15
 *     strategic decision 2026-05-04): orgs pay for Monitrax to be their
 *     CRM + comms channel; the platform must not redirect their clients
 *     to competitors.
 *
 *   - **public** — D2C user, no org links. Picker shows up to 3 best-fit
 *     APPROVED `ProfessionalListing` rows from the public marketplace,
 *     biased by the calling `context` (e.g. context='tax' boosts listings
 *     with `TAX_OPTIMISATION` / `PERSONAL_TAX` / `SMSF_ACCOUNTING`
 *     specialisations). Falls back to highest-rated when context doesn't
 *     match any specialisation.
 *
 * The same component (`<AskAProfessionalButton />`) renders against both
 * shapes — viewer scope is a parameter on the service, not a fork. Picker
 * UI branches on `scope` only for the destination of the per-card CTA.
 *
 * Note: the v1 implementation does not yet bake user-region into the
 * picker (we don't store user-region on `User` yet — Phase 41 territory).
 * Region biasing kicks in once that field lands; until then the picker is
 * national-by-rating.
 */
import 'server-only';
import { prisma } from '@/lib/db';
import type {
  ProfessionalSpecialisation,
  Prisma,
} from '@prisma/client';

// =============================================================================
// CONTEXT → SPECIALISATION BIASING
// =============================================================================

/**
 * Maps a free-text context label (the calling surface tells us what the
 * user was looking at when they clicked) to specialisation tags that
 * should rank higher in the picker. Open-ended; unmatched contexts simply
 * fall through to the rating-only ranking.
 */
const CONTEXT_BIAS: Record<string, ProfessionalSpecialisation[]> = {
  // CFO / AI Guide contexts
  tax: ['TAX_OPTIMISATION', 'PERSONAL_TAX', 'SMSF_ACCOUNTING'],
  'tax-planning': ['TAX_OPTIMISATION', 'PERSONAL_TAX'],
  retirement: ['RETIREMENT_PLANNING'],
  estate: ['ESTATE_PLANNING'],
  insurance: ['RISK_INSURANCE'],
  // Loans / property
  refinance: ['REFINANCE', 'INVESTMENT_LOANS'],
  'home-loan': ['HOME_LOANS', 'FIRST_HOME_BUYER'],
  'investment-loan': ['INVESTMENT_LOANS'],
  property: ['PROPERTY_INVESTORS', 'INVESTMENT_LOANS'],
  // Wealth + structure
  wealth: ['WEALTH_BUILDING'],
  trust: ['TRUST_ACCOUNTING'],
  smsf: ['SMSF_ACCOUNTING', 'PROPERTY_INVESTORS'],
  business: ['SMALL_BUSINESS', 'PERSONAL_TAX'],
  // Default — no bias
  general: [],
};

export type AskAProContext = keyof typeof CONTEXT_BIAS;

export function isKnownContext(input: string): input is AskAProContext {
  return Object.prototype.hasOwnProperty.call(CONTEXT_BIAS, input);
}

// =============================================================================
// SHAPES
// =============================================================================

export interface OrgRosterMember {
  memberId: string;
  name: string;
  email: string;
  role: string; // UserRole as string for client compatibility
}

export interface OrgScopedCandidate {
  orgClientId: string;
  organizationId: string;
  organizationName: string;
  organizationProfession: string | null;
  // The specific advisor assigned to this user, when present
  assignedMember: OrgRosterMember | null;
  // The full active roster (excluding VIEWER seats — they don't take inbound)
  roster: OrgRosterMember[];
}

export interface PublicListingCandidate {
  id: string;
  publicSlug: string;
  displayName: string;
  tagline: string | null;
  discipline: string;
  specialisations: string[];
  regions: string[];
  ratingsCount: number;
  averageRating: string | null;
  acceptedRequestsCount: number;
  /** Score from the context-bias heuristic (higher = better fit) */
  matchScore: number;
}

export type AskAProResult =
  | { scope: 'org'; orgCandidates: OrgScopedCandidate[] }
  | { scope: 'public'; listings: PublicListingCandidate[]; totalAvailable: number };

// =============================================================================
// MAIN ENTRY
// =============================================================================

export async function getCandidatesForUser(
  userId: string,
  contextRaw?: string,
): Promise<AskAProResult> {
  const context: AskAProContext = contextRaw && isKnownContext(contextRaw) ? contextRaw : 'general';

  // 1. Org-scoped path: any active+granted OrganizationClient row?
  const orgLinks = await prisma.organizationClient.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      consentStatus: 'GRANTED',
    },
    select: {
      id: true,
      organizationId: true,
      assignedToMemberId: true,
    },
  });

  if (orgLinks.length > 0) {
    return { scope: 'org', orgCandidates: await resolveOrgCandidates(orgLinks) };
  }

  // 2. Public path: best-fit APPROVED listings, biased by context
  return resolvePublicListings(context);
}

// =============================================================================
// ORG-SCOPED PATH
// =============================================================================

async function resolveOrgCandidates(
  orgLinks: Array<{ id: string; organizationId: string; assignedToMemberId: string | null }>,
): Promise<OrgScopedCandidate[]> {
  const orgIds = Array.from(new Set(orgLinks.map((l) => l.organizationId)));

  const orgs = await prisma.organization.findMany({
    where: { id: { in: orgIds } },
    select: {
      id: true,
      name: true,
      profession: true,
      members: {
        where: { isActive: true, role: { in: ['OWNER', 'ADMIN', 'CONTRIBUTOR'] } },
        select: {
          id: true,
          role: true,
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return orgLinks
    .map((link) => {
      const org = orgs.find((o) => o.id === link.organizationId);
      if (!org) return null;

      const roster: OrgRosterMember[] = org.members.map((m) => ({
        memberId: m.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role as string,
      }));

      const assignedMember = link.assignedToMemberId
        ? roster.find((m) => m.memberId === link.assignedToMemberId) ?? null
        : null;

      const candidate: OrgScopedCandidate = {
        orgClientId: link.id,
        organizationId: org.id,
        organizationName: org.name,
        organizationProfession: (org.profession as string | null) ?? null,
        assignedMember,
        roster,
      };
      return candidate;
    })
    .filter((c): c is OrgScopedCandidate => c !== null);
}

// =============================================================================
// PUBLIC PATH
// =============================================================================

async function resolvePublicListings(
  context: AskAProContext,
): Promise<{ scope: 'public'; listings: PublicListingCandidate[]; totalAvailable: number }> {
  const biasedSpecs = CONTEXT_BIAS[context];

  const where: Prisma.ProfessionalListingWhereInput = { status: 'APPROVED' };

  // First pass: try to fetch listings biased toward the context. We over-fetch
  // (top-12 by rating) and then re-rank locally so we honour both the bias
  // signal and the public-rating signal without database-side complexity.
  const totalAvailable = await prisma.professionalListing.count({ where });

  const candidates = await prisma.professionalListing.findMany({
    where,
    orderBy: [
      { averageRating: { sort: 'desc', nulls: 'last' } },
      { acceptedRequestsCount: 'desc' },
      { displayName: 'asc' },
    ],
    take: 12,
    select: {
      id: true,
      publicSlug: true,
      displayName: true,
      tagline: true,
      discipline: true,
      specialisations: true,
      regions: true,
      ratingsCount: true,
      averageRating: true,
      acceptedRequestsCount: true,
    },
  });

  const ranked = candidates
    .map((listing) => {
      const matched = listing.specialisations.filter((s) =>
        biasedSpecs.includes(s as ProfessionalSpecialisation),
      ).length;
      // matchScore = number of context-matched specialisations + a tiny rating bump
      // so equal-match-count ties go to the higher-rated listing.
      const ratingBump = listing.averageRating ? Number(listing.averageRating) / 10 : 0;
      const matchScore = matched + ratingBump;
      return {
        ...listing,
        averageRating: listing.averageRating ? listing.averageRating.toString() : null,
        matchScore,
      } satisfies PublicListingCandidate;
    })
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 3);

  return { scope: 'public', listings: ranked, totalAvailable };
}
