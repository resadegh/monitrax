/**
 * Phase 32C PR4c — Professional Request Lifecycle service.
 *
 * D2C user picks a marketplace listing → composes a question → submits →
 * adviser inbox → ACCEPTED (lead-fee billing intent recorded + ClientLink
 * created) / DECLINED.
 *
 * State machine:
 *
 *      ┌──────────────┐      withdraw()        ┌──────────────┐
 *      │  SUBMITTED   │ ─────────────────────▶ │  WITHDRAWN   │
 *      └──────────────┘                        └──────────────┘
 *           │  │
 *  accept() │  │ decline()
 *           ▼  ▼
 *      ┌──────────────┐                        ┌──────────────┐
 *      │  ACCEPTED    │                        │   DECLINED   │
 *      └──────────────┘                        └──────────────┘
 *
 * EXPIRED is set by a separate scheduled sweep (PR6 territory) when a
 * SUBMITTED request crosses 14 days without adviser response. Not modeled
 * in this service.
 *
 * Lead-fee tier resolution: at submit-time we read the user's net-worth
 * from `getMasterFinancialSnapshot()` and bucket into Emerging (<$200k) /
 * Growing ($200k-$1M) / Established ($1M+). The corresponding rate is
 * frozen onto the request from the listing's per-tier rate so downstream
 * tier-rate edits don't retroactively change in-flight requests.
 *
 * Lead-fee charge: at accept-time we set `leadFeeChargedAt` as the billing
 * intent. PR6 (Stripe test-mode billing) will read this column and create
 * the actual Stripe Invoice. CLAUDE.md §0 architect lens: keep the data
 * model honest; payment plumbing is a separate concern with its own gate.
 *
 * Server-side guardrails:
 *   - Org-attached users (any active+granted OrganizationClient) cannot
 *     submit a public-marketplace request — leaky-funnel rule mirrors
 *     askAProfessionalService.ts.
 *   - One open SUBMITTED request per user-listing pair (idempotent submit;
 *     a duplicate submit returns the existing request).
 *   - Listing must be APPROVED to accept new requests.
 */
import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getMasterFinancialSnapshot } from '@/lib/services/masterFinancialService';
import type {
  LeadFeeTier,
  ProfessionalRequest,
  RequestStatus,
} from '@prisma/client';

// =============================================================================
// CONSTANTS
// =============================================================================

const TIER_BOUNDARY_GROWING = 200_000;
const TIER_BOUNDARY_ESTABLISHED = 1_000_000;

// Cap snapshot-context payload size so we don't bloat the table with
// arbitrary user-pasted JSON. ~8KB is plenty for headline metrics.
const MAX_SNAPSHOT_CONTEXT_BYTES = 8 * 1024;

// =============================================================================
// SHAPES
// =============================================================================

export interface SubmitRequestInput {
  requesterUserId: string;
  listingId: string;
  question: string;
  contextLabel?: string;
  /** Optional — caller may pass a curated subset of canonical snapshot
   *  metrics (CDR-sanitised). The service does NOT auto-attach the full
   *  snapshot — sharing is opt-in by design. */
  snapshotContextJson?: Prisma.InputJsonValue;
}

export interface RespondInput {
  requestId: string;
  respondedByMemberId: string; // OrganizationMember.id
  /** For DECLINED: required reason text. */
  declineReason?: string;
}

export class ProfessionalRequestServiceError extends Error {
  constructor(
    message: string,
    public code:
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'INVALID_STATUS_TRANSITION'
      | 'LISTING_NOT_AVAILABLE'
      | 'ORG_USER_PUBLIC_BLOCKED'
      | 'INCOMPLETE_INPUT'
      | 'PAYLOAD_TOO_LARGE',
  ) {
    super(message);
    this.name = 'ProfessionalRequestServiceError';
  }
}

// =============================================================================
// LEAD-FEE TIER RESOLUTION
// =============================================================================

export function classifyNetWorthTier(netWorth: number): LeadFeeTier {
  if (netWorth >= TIER_BOUNDARY_ESTABLISHED) return 'ESTABLISHED';
  if (netWorth >= TIER_BOUNDARY_GROWING) return 'GROWING';
  return 'EMERGING';
}

async function resolveUserLeadFeeTier(userId: string): Promise<LeadFeeTier> {
  try {
    const snapshot = await getMasterFinancialSnapshot(userId);
    return classifyNetWorthTier(snapshot.netWorth.netWorth);
  } catch {
    // Snapshot failures (e.g. brand-new user with no data) fall through to
    // EMERGING — the lowest-cost tier. Keeps the submit flow unblockable;
    // the adviser sees the actual data on accept anyway.
    return 'EMERGING';
  }
}

function resolveLeadFeeAmount(
  tier: LeadFeeTier,
  listing: { leadFeeTierEmerging: Prisma.Decimal; leadFeeTierGrowing: Prisma.Decimal; leadFeeTierEstablished: Prisma.Decimal },
): Prisma.Decimal {
  switch (tier) {
    case 'EMERGING':
      return listing.leadFeeTierEmerging;
    case 'GROWING':
      return listing.leadFeeTierGrowing;
    case 'ESTABLISHED':
      return listing.leadFeeTierEstablished;
  }
}

// =============================================================================
// SUBMIT
// =============================================================================

export async function submitRequest(
  input: SubmitRequestInput,
): Promise<ProfessionalRequest> {
  if (!input.question || input.question.trim().length < 20) {
    throw new ProfessionalRequestServiceError(
      'Question must be at least 20 characters — give the professional something to work with.',
      'INCOMPLETE_INPUT',
    );
  }

  // Snapshot-context size guard
  if (input.snapshotContextJson) {
    const size = JSON.stringify(input.snapshotContextJson).length;
    if (size > MAX_SNAPSHOT_CONTEXT_BYTES) {
      throw new ProfessionalRequestServiceError(
        'Shared snapshot context is too large. Please trim before submitting.',
        'PAYLOAD_TOO_LARGE',
      );
    }
  }

  // Leaky-funnel guardrail — org-attached users cannot submit public
  // marketplace requests; they must use their existing org's roster.
  const orgLink = await prisma.organizationClient.findFirst({
    where: { userId: input.requesterUserId, status: 'ACTIVE', consentStatus: 'GRANTED' },
    select: { id: true },
  });
  if (orgLink) {
    throw new ProfessionalRequestServiceError(
      'You\'re already linked to an organisation. Send a message through your existing professional rather than the public marketplace.',
      'ORG_USER_PUBLIC_BLOCKED',
    );
  }

  // Listing must be APPROVED + return its lead-fee schedule
  const listing = await prisma.professionalListing.findUnique({
    where: { id: input.listingId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      leadFeeTierEmerging: true,
      leadFeeTierGrowing: true,
      leadFeeTierEstablished: true,
    },
  });
  if (!listing) {
    throw new ProfessionalRequestServiceError('Listing not found', 'NOT_FOUND');
  }
  if (listing.status !== 'APPROVED') {
    throw new ProfessionalRequestServiceError(
      'This professional is not currently accepting new requests.',
      'LISTING_NOT_AVAILABLE',
    );
  }

  // Idempotent — if there's already an open SUBMITTED request for this
  // user-listing pair, return it instead of creating a duplicate.
  const existing = await prisma.professionalRequest.findFirst({
    where: {
      requesterUserId: input.requesterUserId,
      listingId: listing.id,
      status: 'SUBMITTED',
    },
    orderBy: { submittedAt: 'desc' },
  });
  if (existing) return existing;

  const tier = await resolveUserLeadFeeTier(input.requesterUserId);
  const amount = resolveLeadFeeAmount(tier, listing);

  return prisma.professionalRequest.create({
    data: {
      requesterUserId: input.requesterUserId,
      listingId: listing.id,
      question: input.question.trim(),
      contextLabel: input.contextLabel ?? null,
      snapshotContextJson: input.snapshotContextJson ?? Prisma.JsonNull,
      leadFeeTier: tier,
      leadFeeAmount: amount,
      status: 'SUBMITTED',
    },
  });
}

// =============================================================================
// QUERY
// =============================================================================

/** D2C user reads their own request history. */
export async function listRequestsForUser(userId: string) {
  return prisma.professionalRequest.findMany({
    where: { requesterUserId: userId },
    orderBy: { submittedAt: 'desc' },
    include: {
      listing: {
        select: {
          id: true,
          publicSlug: true,
          displayName: true,
          discipline: true,
        },
      },
      // PR4d: surface the conversation id so the user-side tracker can
      // deep-link to the conversation thread.
      conversation: { select: { id: true } },
    },
  });
}

/** Adviser inbox — all requests across the org's listing(s) (we only
 *  support one listing per Org at v1, but this still scopes by
 *  organizationId for safety). */
export async function listInboxForOrg(organizationId: string, status?: RequestStatus) {
  return prisma.professionalRequest.findMany({
    where: {
      listing: { organizationId },
      ...(status ? { status } : {}),
    },
    orderBy: [
      // SUBMITTED first (the queue), then most recent
      { status: 'asc' },
      { submittedAt: 'desc' },
    ],
    include: {
      requester: { select: { id: true, name: true, email: true, createdAt: true } },
      listing: { select: { id: true, displayName: true, publicSlug: true, organizationId: true } },
      respondedByMember: {
        select: { id: true, user: { select: { id: true, name: true, email: true } } },
      },
    },
  });
}

/** Adviser drill-in. Verifies the request belongs to the caller's org. */
export async function getRequestForOrg(requestId: string, organizationId: string) {
  return prisma.professionalRequest.findFirst({
    where: { id: requestId, listing: { organizationId } },
    include: {
      requester: { select: { id: true, name: true, email: true, createdAt: true } },
      listing: {
        select: {
          id: true,
          displayName: true,
          publicSlug: true,
          organizationId: true,
          leadFeeTierEmerging: true,
          leadFeeTierGrowing: true,
          leadFeeTierEstablished: true,
        },
      },
      respondedByMember: {
        select: { id: true, user: { select: { id: true, name: true, email: true } } },
      },
      // PR4d: surface the auto-created conversation so the detail page
      // can deep-link straight to the thread.
      conversation: { select: { id: true } },
    },
  });
}

// =============================================================================
// RESPOND — ACCEPT / DECLINE / WITHDRAW
// =============================================================================

export async function acceptRequest(input: RespondInput): Promise<ProfessionalRequest> {
  const request = await prisma.professionalRequest.findUnique({
    where: { id: input.requestId },
    include: {
      listing: { select: { id: true, organizationId: true, status: true } },
    },
  });
  if (!request) throw new ProfessionalRequestServiceError('Request not found', 'NOT_FOUND');
  if (request.status !== 'SUBMITTED') {
    throw new ProfessionalRequestServiceError(
      `Cannot accept from status ${request.status} — must be SUBMITTED.`,
      'INVALID_STATUS_TRANSITION',
    );
  }
  if (request.listing.status !== 'APPROVED') {
    throw new ProfessionalRequestServiceError(
      'Listing is no longer APPROVED — cannot accept new requests.',
      'LISTING_NOT_AVAILABLE',
    );
  }

  // Verify the responding member belongs to this listing's org
  const member = await prisma.organizationMember.findUnique({
    where: { id: input.respondedByMemberId },
    select: { organizationId: true, isActive: true },
  });
  if (!member || !member.isActive || member.organizationId !== request.listing.organizationId) {
    throw new ProfessionalRequestServiceError(
      'You are not a member of the organisation that owns this listing.',
      'FORBIDDEN',
    );
  }

  // Run the lifecycle transition + ClientLink materialisation in a single
  // transaction so a half-applied state can never be observed. The
  // conversation auto-create (PR4d) happens AFTER the transaction commits
  // — it has its own transaction internally and must run against committed
  // request state.
  const accepted = await prisma.$transaction(async (tx) => {
    // Materialise the ClientLink (consent invite path — record starts in
    // INVITED status with PENDING consent so the existing consent flow
    // takes over from here. The pro side sees the request as ACCEPTED;
    // the engagement only fully starts once the user grants consent).
    const clientLink = await tx.organizationClient.upsert({
      where: {
        organizationId_userId: {
          organizationId: request.listing.organizationId,
          userId: request.requesterUserId,
        },
      },
      create: {
        organizationId: request.listing.organizationId,
        userId: request.requesterUserId,
        status: 'INVITED',
        consentStatus: 'PENDING',
      },
      update: {
        // If a row already exists in some other state, leave it alone —
        // accept simply links the request to the existing engagement.
      },
      select: { id: true },
    });

    // Set the billing intent timestamp. Actual Stripe Invoice creation
    // wires in PR6 — this is the column the PR6 reader will key off.
    const updated = await tx.professionalRequest.update({
      where: { id: request.id },
      data: {
        status: 'ACCEPTED',
        respondedAt: new Date(),
        respondedByMemberId: input.respondedByMemberId,
        leadFeeChargedAt: new Date(),
        clientLinkId: clientLink.id,
      },
    });

    return updated;
  });

  // Phase 32C PR4d — auto-create the conversation thread for the accepted
  // engagement. Idempotent (safe under retries) and best-effort: a
  // conversation creation failure does NOT roll back the accept (the
  // accept already wrote audit + ClientLink). Operations team can re-run
  // create-conversation if it ever fails.
  try {
    const { createForAcceptedRequest } = await import('./conversationService');
    await createForAcceptedRequest({
      requestId: accepted.id,
      welcomeFromMemberId: input.respondedByMemberId,
    });
  } catch (err) {
    // Log only; don't propagate. The conversation can be created lazily
    // on the next adviser visit to the request detail page.
    // eslint-disable-next-line no-console
    console.warn('[acceptRequest] conversation auto-create failed', err);
  }

  // Phase 32C PR6b — create the Stripe lead-fee invoice. Same best-effort
  // pattern as the conversation: failures don't roll back the accept (the
  // billing intent is already recorded in `leadFeeChargedAt`); ops can
  // re-run `createLeadFeeInvoiceForRequest` for any request with
  // `stripeInvoiceId IS NULL` after status=ACCEPTED.
  try {
    // Resolve the org's PORTAL_OWNER email — the billing customer is
    // always tied to the owner. If multiple owners exist, pick the
    // earliest-active one (deterministic).
    const owner = await prisma.organizationMember.findFirst({
      where: {
        organizationId: accepted.listingId
          ? (await prisma.professionalListing.findUnique({
              where: { id: accepted.listingId },
              select: { organizationId: true },
            }))?.organizationId
          : undefined,
        role: 'OWNER',
        isActive: true,
      },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    if (owner?.user?.email) {
      const { createLeadFeeInvoiceForRequest } = await import('./stripeBillingService');
      await createLeadFeeInvoiceForRequest({
        requestId: accepted.id,
        ownerEmail: owner.user.email,
      });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[acceptRequest] lead-fee invoice create failed', err);
  }

  return accepted;
}

export async function declineRequest(input: RespondInput): Promise<ProfessionalRequest> {
  const request = await prisma.professionalRequest.findUnique({
    where: { id: input.requestId },
    include: { listing: { select: { id: true, organizationId: true } } },
  });
  if (!request) throw new ProfessionalRequestServiceError('Request not found', 'NOT_FOUND');
  if (request.status !== 'SUBMITTED') {
    throw new ProfessionalRequestServiceError(
      `Cannot decline from status ${request.status} — must be SUBMITTED.`,
      'INVALID_STATUS_TRANSITION',
    );
  }
  if (!input.declineReason || input.declineReason.trim().length < 5) {
    throw new ProfessionalRequestServiceError(
      'Decline reason required (min 5 chars).',
      'INCOMPLETE_INPUT',
    );
  }
  const member = await prisma.organizationMember.findUnique({
    where: { id: input.respondedByMemberId },
    select: { organizationId: true, isActive: true },
  });
  if (!member || !member.isActive || member.organizationId !== request.listing.organizationId) {
    throw new ProfessionalRequestServiceError(
      'You are not a member of the organisation that owns this listing.',
      'FORBIDDEN',
    );
  }

  return prisma.professionalRequest.update({
    where: { id: request.id },
    data: {
      status: 'DECLINED',
      respondedAt: new Date(),
      respondedByMemberId: input.respondedByMemberId,
      declineReason: input.declineReason.trim(),
    },
  });
}

export async function withdrawRequest(
  requestId: string,
  requesterUserId: string,
): Promise<ProfessionalRequest> {
  const request = await prisma.professionalRequest.findUnique({
    where: { id: requestId },
  });
  if (!request) throw new ProfessionalRequestServiceError('Request not found', 'NOT_FOUND');
  if (request.requesterUserId !== requesterUserId) {
    throw new ProfessionalRequestServiceError('Not your request', 'FORBIDDEN');
  }
  if (request.status !== 'SUBMITTED') {
    throw new ProfessionalRequestServiceError(
      `Cannot withdraw from status ${request.status} — must be SUBMITTED.`,
      'INVALID_STATUS_TRANSITION',
    );
  }
  return prisma.professionalRequest.update({
    where: { id: request.id },
    data: { status: 'WITHDRAWN', withdrawnAt: new Date() },
  });
}
