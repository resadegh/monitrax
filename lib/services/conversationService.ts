/**
 * Phase 32C PR4d — Conversation service.
 *
 * One conversation per ACCEPTED ProfessionalRequest. Both sides post
 * messages in the in-app thread. Outbound messages mirror via SendGrid
 * (see `lib/email/conversationEmail.ts`); inbound replies route via
 * SendGrid Inbound Parse webhook (`/api/conversations/inbound`).
 *
 * Compliance archive: every message gets `retentionUntil = now + 7 years`.
 * Soft-delete from a participant's view (`hiddenFromUser` on the
 * `ConversationParticipant` row) does NOT remove the row — the message
 * stays in the org's compliance archive until retentionUntil passes.
 *
 * Access control: every read goes through `assertParticipant` which
 * verifies the caller is on the participant list. Cross-org leakage is
 * structurally impossible — the API can't return a conversation without
 * matching a ConversationParticipant row.
 */
import 'server-only';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import {
  buildReplyToAddress,
  sendConversationEmail,
} from '@/lib/email/conversationEmail';
import type {
  ConversationMessage,
  ConversationRole,
  MessageChannel,
  ProfessionalConversation,
} from '@prisma/client';

// =============================================================================
// CONSTANTS
// =============================================================================

const RETENTION_MS = 7 * 365 * 24 * 60 * 60 * 1000; // 7 years (calendar years; leap-day drift acceptable for archive purposes)
const MAX_BODY_LENGTH = 10_000;
const SUBJECT_MAX = 160;
const REPLY_SLUG_BYTES = 16; // 32-char hex — unguessable but copy-paste-able

// =============================================================================
// SHAPES
// =============================================================================

export class ConversationServiceError extends Error {
  constructor(
    message: string,
    public code:
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'INVALID_INPUT'
      | 'CLOSED'
      | 'PAYLOAD_TOO_LARGE'
      | 'CONVERSATION_EXISTS',
  ) {
    super(message);
    this.name = 'ConversationServiceError';
  }
}

export interface CreateForRequestInput {
  requestId: string;
  /** Subject line (defaults to first 80 chars of the request question). */
  subject?: string;
  /** Optional welcome message from the professional side. */
  welcomeBody?: string;
  /** Sending member id when posting the welcome message. */
  welcomeFromMemberId?: string;
}

export interface CreateOrgScopedInput {
  /** OrganizationClient row id (used for org-attached conversations
   *  initiated outside the public marketplace request flow — e.g. when
   *  an org-attached user clicks an existing pro from the AskAPro picker). */
  orgClientId: string;
  /** OrganizationMember.id of the pro side seat. */
  memberId: string;
  subject: string;
}

export interface PostMessageInput {
  conversationId: string;
  /** Caller's userId — must be a CONSUMER participant (the user) or a
   *  PROFESSIONAL participant (i.e. user matches a member.userId). */
  senderUserId: string;
  body: string;
  /** When set, mirrors the message out via email. Defaults to true for
   *  professional → consumer messages, false for consumer → professional
   *  (the user is in-app; no need to email themselves). */
  mirrorViaEmail?: boolean;
  /** Bypass for inbound webhook — channel is EMAIL_IN, no outbound mirror. */
  channel?: MessageChannel;
  /** Used by the inbound webhook to record the original email metadata. */
  inboundFromEmail?: string;
  inboundSubject?: string;
}

// =============================================================================
// CREATION
// =============================================================================

function generateReplyToSlug(): string {
  const bytes = new Uint8Array(REPLY_SLUG_BYTES);
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback — Node's randomUUID gives 16 bytes via the dashes-stripped form
    const u = randomUUID().replace(/-/g, '');
    return u.slice(0, 32);
  }
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function deriveSubject(question: string): string {
  return question.length <= 80 ? question : `${question.slice(0, 77).trim()}…`;
}

/**
 * Create a conversation tied to an ACCEPTED ProfessionalRequest. Idempotent
 * — calling twice on the same request returns the existing conversation.
 *
 * Hooked into `professionalRequestService.acceptRequest` so the engagement
 * starts the moment the adviser accepts.
 */
export async function createForAcceptedRequest(
  input: CreateForRequestInput,
): Promise<ProfessionalConversation> {
  const request = await prisma.professionalRequest.findUnique({
    where: { id: input.requestId },
    include: {
      listing: { select: { id: true, organizationId: true, displayName: true } },
      requester: { select: { id: true, name: true, email: true } },
    },
  });
  if (!request) throw new ConversationServiceError('Request not found', 'NOT_FOUND');
  if (request.status !== 'ACCEPTED') {
    throw new ConversationServiceError(
      `Cannot create conversation — request status is ${request.status}, not ACCEPTED`,
      'INVALID_INPUT',
    );
  }

  // Idempotent
  const existing = await prisma.professionalConversation.findUnique({
    where: { requestId: request.id },
  });
  if (existing) return existing;

  const subject = input.subject ?? deriveSubject(request.question);
  const replyToSlug = generateReplyToSlug();

  // Resolve the welcome-from member if provided (must belong to the listing's org)
  let welcomeMember: { id: string; userId: string } | null = null;
  if (input.welcomeFromMemberId) {
    welcomeMember = await prisma.organizationMember.findFirst({
      where: {
        id: input.welcomeFromMemberId,
        organizationId: request.listing.organizationId,
        isActive: true,
      },
      select: { id: true, userId: true },
    });
  }

  return prisma.$transaction(async (tx) => {
    const conv = await tx.professionalConversation.create({
      data: {
        requestId: request.id,
        organizationId: request.listing.organizationId,
        replyToSlug,
        subject: subject.slice(0, SUBJECT_MAX),
      },
    });

    // Participants — consumer + every active member of the org's "respondable"
    // seats (OWNER / ADMIN / CONTRIBUTOR). VIEWER seats are excluded; they
    // can't take inbound, so they shouldn't appear in the participant list
    // either.
    await tx.conversationParticipant.create({
      data: {
        conversationId: conv.id,
        userId: request.requester.id,
        role: 'CONSUMER',
      },
    });

    const respondableMembers = await tx.organizationMember.findMany({
      where: {
        organizationId: request.listing.organizationId,
        isActive: true,
        role: { in: ['OWNER', 'ADMIN', 'CONTRIBUTOR'] },
      },
      select: { id: true },
    });
    if (respondableMembers.length > 0) {
      await tx.conversationParticipant.createMany({
        data: respondableMembers.map((m) => ({
          conversationId: conv.id,
          memberId: m.id,
          role: 'PROFESSIONAL' as ConversationRole,
        })),
      });
    }

    // Welcome message (optional — only if welcomeBody provided + a valid
    // welcomeMember). Reuses the same retention rule as user messages.
    if (input.welcomeBody && welcomeMember) {
      await tx.conversationMessage.create({
        data: {
          conversationId: conv.id,
          senderUserId: welcomeMember.userId,
          senderRole: 'PROFESSIONAL',
          body: input.welcomeBody.slice(0, MAX_BODY_LENGTH),
          channel: 'IN_APP',
          retentionUntil: new Date(Date.now() + RETENTION_MS),
        },
      });
      await tx.professionalConversation.update({
        where: { id: conv.id },
        data: { lastMessageAt: new Date() },
      });
    }

    return conv;
  });
}

/**
 * Create a conversation for an org-attached engagement that didn't go
 * through the public marketplace request flow (i.e. the AskAPro picker
 * org-scope path). Idempotent on the (orgClientId, memberId) pair — calling
 * twice returns the existing conversation.
 *
 * Used by the org-attached AskAPro path so the user can message a member
 * of their existing org without creating a new ProfessionalRequest.
 */
export async function createOrgScopedConversation(
  input: CreateOrgScopedInput,
): Promise<ProfessionalConversation> {
  const orgClient = await prisma.organizationClient.findUnique({
    where: { id: input.orgClientId },
    select: { id: true, organizationId: true, userId: true, status: true, consentStatus: true },
  });
  if (!orgClient) throw new ConversationServiceError('Org link not found', 'NOT_FOUND');
  if (orgClient.status !== 'ACTIVE' || orgClient.consentStatus !== 'GRANTED') {
    throw new ConversationServiceError('Org link not active or consent not granted', 'FORBIDDEN');
  }

  const member = await prisma.organizationMember.findFirst({
    where: { id: input.memberId, organizationId: orgClient.organizationId, isActive: true },
    select: { id: true, userId: true },
  });
  if (!member) throw new ConversationServiceError('Member not in this org', 'FORBIDDEN');

  // Look for an existing org-scoped conversation between the same user-member pair
  const existing = await prisma.professionalConversation.findFirst({
    where: {
      organizationId: orgClient.organizationId,
      requestId: null, // org-scoped, not request-derived
      participants: {
        some: { userId: orgClient.userId, role: 'CONSUMER' },
      },
      AND: {
        participants: {
          some: { memberId: member.id, role: 'PROFESSIONAL' },
        },
      },
    },
  });
  if (existing) return existing;

  const replyToSlug = generateReplyToSlug();

  return prisma.$transaction(async (tx) => {
    const conv = await tx.professionalConversation.create({
      data: {
        organizationId: orgClient.organizationId,
        replyToSlug,
        subject: input.subject.slice(0, SUBJECT_MAX),
      },
    });
    await tx.conversationParticipant.create({
      data: { conversationId: conv.id, userId: orgClient.userId, role: 'CONSUMER' },
    });
    await tx.conversationParticipant.create({
      data: { conversationId: conv.id, memberId: member.id, role: 'PROFESSIONAL' },
    });
    return conv;
  });
}

// =============================================================================
// READ
// =============================================================================

/**
 * Verify the caller is a participant of the conversation.
 * Returns:
 *   - role: 'CONSUMER' | 'PROFESSIONAL'
 *   - participantId: ConversationParticipant.id (used for read-receipt updates)
 *   - memberId?: OrganizationMember.id when role=PROFESSIONAL
 */
export async function assertParticipant(
  conversationId: string,
  userId: string,
): Promise<{ role: ConversationRole; participantId: string; memberId: string | null; organizationId: string }> {
  const conversation = await prisma.professionalConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, organizationId: true },
  });
  if (!conversation) throw new ConversationServiceError('Conversation not found', 'NOT_FOUND');

  // Consumer-side
  const consumer = await prisma.conversationParticipant.findFirst({
    where: { conversationId, userId, role: 'CONSUMER' },
    select: { id: true },
  });
  if (consumer) {
    return {
      role: 'CONSUMER',
      participantId: consumer.id,
      memberId: null,
      organizationId: conversation.organizationId,
    };
  }

  // Professional-side — caller's userId matches a member.userId AND that
  // member is a participant
  const proParticipant = await prisma.conversationParticipant.findFirst({
    where: {
      conversationId,
      role: 'PROFESSIONAL',
      member: { userId, isActive: true },
    },
    select: { id: true, memberId: true },
  });
  if (proParticipant) {
    return {
      role: 'PROFESSIONAL',
      participantId: proParticipant.id,
      memberId: proParticipant.memberId,
      organizationId: conversation.organizationId,
    };
  }

  throw new ConversationServiceError('Not a participant in this conversation', 'FORBIDDEN');
}

export async function listMessages(
  conversationId: string,
  userId: string,
  options: { since?: Date; markAsRead?: boolean } = {},
): Promise<ConversationMessage[]> {
  const ctx = await assertParticipant(conversationId, userId);

  const messages = await prisma.conversationMessage.findMany({
    where: {
      conversationId,
      ...(options.since ? { createdAt: { gt: options.since } } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });

  if (options.markAsRead) {
    // Update the participant's lastReadAt — fire and forget, don't block the read
    prisma.conversationParticipant
      .update({
        where: { id: ctx.participantId },
        data: { lastReadAt: new Date() },
      })
      .catch(() => {});
  }

  return messages;
}

export async function getConversationDetails(conversationId: string, userId: string) {
  await assertParticipant(conversationId, userId);
  return prisma.professionalConversation.findUnique({
    where: { id: conversationId },
    include: {
      organization: { select: { id: true, name: true, slug: true, profession: true } },
      request: {
        select: {
          id: true,
          contextLabel: true,
          status: true,
          submittedAt: true,
          listing: { select: { id: true, displayName: true, publicSlug: true } },
        },
      },
      participants: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          member: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      },
    },
  });
}

export async function listConversationsForUser(userId: string, options: { hidden?: boolean } = {}) {
  return prisma.professionalConversation.findMany({
    where: {
      participants: {
        some: {
          userId,
          role: 'CONSUMER',
          hiddenFromUser: options.hidden ?? false,
        },
      },
    },
    orderBy: { lastMessageAt: 'desc' },
    include: {
      organization: { select: { id: true, name: true, profession: true } },
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { body: true, createdAt: true, senderRole: true },
      },
      participants: {
        where: { userId, role: 'CONSUMER' },
        select: { lastReadAt: true, hiddenFromUser: true },
      },
    },
  });
}

export async function listConversationsForOrg(organizationId: string, memberUserId: string) {
  // Verify the caller is an active member of this org
  const member = await prisma.organizationMember.findFirst({
    where: { userId: memberUserId, organizationId, isActive: true },
    select: { id: true, role: true },
  });
  if (!member) throw new ConversationServiceError('Not a member of this org', 'FORBIDDEN');

  return prisma.professionalConversation.findMany({
    where: { organizationId },
    orderBy: { lastMessageAt: 'desc' },
    include: {
      request: {
        select: {
          id: true,
          status: true,
          requester: { select: { id: true, name: true, email: true } },
          listing: { select: { displayName: true } },
        },
      },
      participants: {
        where: { role: 'CONSUMER' },
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
        select: { body: true, createdAt: true, senderRole: true, channel: true },
      },
    },
  });
}

// =============================================================================
// WRITE
// =============================================================================

export async function postMessage(input: PostMessageInput): Promise<ConversationMessage> {
  const body = (input.body ?? '').trim();
  if (!body) throw new ConversationServiceError('Body required', 'INVALID_INPUT');
  if (body.length > MAX_BODY_LENGTH) {
    throw new ConversationServiceError(
      `Body exceeds ${MAX_BODY_LENGTH} characters`,
      'PAYLOAD_TOO_LARGE',
    );
  }

  // Inbound webhook bypasses the participant check (no userId is set on the
  // call site — the webhook resolves the conversation by reply-to slug).
  // Posts via this surface always set channel=EMAIL_IN.
  const isInbound = input.channel === 'EMAIL_IN';

  let role: ConversationRole;
  if (isInbound) {
    role = 'CONSUMER';
  } else {
    const ctx = await assertParticipant(input.conversationId, input.senderUserId);
    role = ctx.role;
  }

  const conversation = await prisma.professionalConversation.findUnique({
    where: { id: input.conversationId },
    select: { id: true, isClosed: true, replyToSlug: true, subject: true, organizationId: true },
  });
  if (!conversation) throw new ConversationServiceError('Conversation not found', 'NOT_FOUND');
  if (conversation.isClosed) {
    throw new ConversationServiceError('Conversation is closed', 'CLOSED');
  }

  const channel = input.channel ?? 'IN_APP';
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        senderUserId: isInbound ? null : input.senderUserId,
        senderRole: role,
        body,
        channel,
        inboundFromEmail: input.inboundFromEmail ?? null,
        inboundSubject: input.inboundSubject ?? null,
        retentionUntil: new Date(Date.now() + RETENTION_MS),
      },
    });
    await tx.professionalConversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: created.createdAt },
    });
    return created;
  });

  // Outbound email mirroring — fire-and-forget; default behaviour is:
  //  - Professional → Consumer: mirror via email (consumer wants the
  //    notification + ability to reply from email)
  //  - Consumer → Professional: skip (the pro is in-app)
  // Caller can override with mirrorViaEmail.
  const shouldMirror =
    input.mirrorViaEmail ?? (role === 'PROFESSIONAL' && !isInbound);

  if (shouldMirror) {
    void mirrorOutbound({
      messageId: message.id,
      conversationId: conversation.id,
      replyToSlug: conversation.replyToSlug,
      subject: conversation.subject,
      body,
    });
  }

  return message;
}

async function mirrorOutbound(args: {
  messageId: string;
  conversationId: string;
  replyToSlug: string;
  subject: string;
  body: string;
}): Promise<void> {
  // Resolve the consumer's email + the professional's display name for the
  // From header. Both are read-only for the mirror; failures don't block
  // the in-app message.
  try {
    const conv = await prisma.professionalConversation.findUnique({
      where: { id: args.conversationId },
      include: {
        organization: { select: { name: true } },
        participants: {
          where: { role: 'CONSUMER' },
          include: { user: { select: { email: true, name: true } } },
        },
      },
    });
    const consumer = conv?.participants[0]?.user;
    if (!conv || !consumer?.email) return;

    const result = await sendConversationEmail({
      to: consumer.email,
      toName: consumer.name,
      subject: args.subject,
      body: args.body,
      replyToSlug: args.replyToSlug,
      conversationId: args.conversationId,
      fromDisplayName: conv.organization.name,
    });

    // Persist the external message id for delivery tracking
    await prisma.conversationMessage.update({
      where: { id: args.messageId },
      data: {
        channel: 'EMAIL_OUT',
        externalMessageId: result.externalMessageId,
      },
    });
  } catch {
    // Mirror is best-effort; the in-app message has already landed, so a
    // failed mirror should not surface to the user. PROD wires retry.
  }
}

// =============================================================================
// PARTICIPANT ACTIONS
// =============================================================================

export async function softDeleteFromUserView(
  conversationId: string,
  userId: string,
): Promise<void> {
  const ctx = await assertParticipant(conversationId, userId);
  if (ctx.role !== 'CONSUMER') {
    // Only the consumer can hide a conversation from their own view.
    // Professional-side hiding ships in PR4d follow-up if needed.
    throw new ConversationServiceError(
      'Only the consumer can hide a conversation from their view',
      'FORBIDDEN',
    );
  }
  await prisma.conversationParticipant.update({
    where: { id: ctx.participantId },
    data: { hiddenFromUser: true, hiddenAt: new Date() },
  });
}

export async function closeConversation(
  conversationId: string,
  userId: string,
): Promise<ProfessionalConversation> {
  const ctx = await assertParticipant(conversationId, userId);
  return prisma.professionalConversation.update({
    where: { id: conversationId },
    data: {
      isClosed: true,
      closedAt: new Date(),
      closedByUserId: ctx.role === 'CONSUMER' ? userId : userId,
    },
  });
}

// =============================================================================
// INBOUND ROUTING
// =============================================================================

/**
 * Look up a conversation by its reply-to slug. Used by the inbound email
 * webhook to route a parsed reply back to the right thread.
 */
export async function findConversationByReplyToSlug(slug: string) {
  return prisma.professionalConversation.findUnique({
    where: { replyToSlug: slug },
    include: {
      organization: { select: { id: true, name: true } },
      participants: {
        where: { role: 'CONSUMER' },
        include: { user: { select: { id: true, email: true } } },
      },
    },
  });
}

export { buildReplyToAddress } from '@/lib/email/conversationEmail';
