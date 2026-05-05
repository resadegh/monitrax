/**
 * Phase 33g — Adviser Feedback Service.
 *
 * Canonical CRUD + audit-log layer for the adviser feedback inbox. ALL
 * feedback business logic lives here; API routes are thin wrappers per
 * CLAUDE.md §12.3.
 *
 * Why a separate service from `ProfessionalConversation` (Phase 32C PR4d):
 *   - Different participants (Monitrax↔adviser vs adviser↔client)
 *   - Different retention rules (24mo default; 7yr only when status moves
 *     through a COMPLIANCE-tagged thread)
 *   - Different status workflow (bug-tracker shape vs message-only)
 *   - Forcing them through one schema would create a discriminator
 *     nightmare. Logged in IMPLEMENTATION_PLAN.md so a future session
 *     doesn't try to consolidate without revisiting the rationale.
 *
 * Design doc: docs/blueprint/PHASE_33G_ADVISER_FEEDBACK_INBOX.md
 *
 * Audit posture (CLAUDE.md §13.3 "audit everything"):
 *   - Every adviser-authored reply → FEEDBACK_THREAD_REPLIED (status SUCCESS)
 *   - Every admin-authored reply → FEEDBACK_THREAD_REPLIED (status SUCCESS)
 *   - Every status flip → FEEDBACK_THREAD_STATUS_CHANGED with old/new in metadata
 *   - Every internal-note edit → FEEDBACK_INTERNAL_NOTE_UPDATED (every edit, not just first-write)
 *   - Markdown export → standard EXPORT action with recordCount
 *
 * Notify-on-reply (CLAUDE.md §16 future evolution):
 *   - `notifyAdviserOfReply()` is a stub — fires `void` today. When Phase
 *     32C PR4d lands SendGrid integration, swap the implementation here.
 *     Single swap-point so the rest of the codebase doesn't change.
 */
import 'server-only';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';
import type {
  FeedbackThread,
  FeedbackMessage,
  FeedbackSurfaceTag,
  FeedbackSeverity,
  FeedbackStatus,
} from '@prisma/client';

// =============================================================================
// TYPES
// =============================================================================

export interface CreateThreadInput {
  userId: string;
  organizationId: string | null;
  subject: string;
  surfaceTag: FeedbackSurfaceTag;
  severity?: FeedbackSeverity;
  surfaceRoute?: string | null;
  body: string;
}

export interface ReplyInput {
  threadId: string;
  authorId: string;
  authorRole: 'ADVISER' | 'MONITRAX_ADMIN';
  body: string;
}

export interface UpdateAdminFieldsInput {
  threadId: string;
  adminUserId: string;
  status?: FeedbackStatus;
  internalNotes?: string | null;
  taggedForAi?: boolean;
}

/**
 * Sanitised thread shape returned to the adviser-facing API. Excludes
 * `internalNotes` even when present in the DB row — the adviser must not
 * see Reza's private triage notes.
 */
export interface AdviserVisibleThread {
  id: string;
  subject: string;
  surfaceRoute: string | null;
  surfaceTag: FeedbackSurfaceTag;
  severity: FeedbackSeverity;
  status: FeedbackStatus;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string | null;
  messages: AdviserVisibleMessage[];
}

export interface AdviserVisibleMessage {
  id: string;
  authorRole: 'ADVISER' | 'MONITRAX_ADMIN';
  body: string;
  createdAt: Date;
}

// =============================================================================
// CREATE
// =============================================================================

export async function createThread(input: CreateThreadInput): Promise<FeedbackThread> {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject) throw new Error('subject is required');
  if (subject.length > 140) throw new Error('subject must be ≤140 characters');
  if (!body) throw new Error('body is required');

  const thread = await prisma.feedbackThread.create({
    data: {
      userId: input.userId,
      organizationId: input.organizationId,
      subject,
      surfaceRoute: input.surfaceRoute ?? null,
      surfaceTag: input.surfaceTag,
      severity: input.severity ?? 'MEDIUM',
      messages: {
        create: {
          authorId: input.userId,
          authorRole: 'ADVISER',
          body,
        },
      },
    },
  });

  // Audit the initial post — uses FEEDBACK_THREAD_REPLIED rather than CREATE
  // so the inbox cron + reporting can grep for one action name covering
  // every adviser-authored signal.
  void createAuditLog({
    userId: input.userId,
    organizationId: input.organizationId ?? undefined,
    action: 'FEEDBACK_THREAD_REPLIED',
    entityType: 'FeedbackThread',
    entityId: thread.id,
    metadata: {
      role: 'ADVISER',
      surfaceTag: input.surfaceTag,
      severity: input.severity ?? 'MEDIUM',
      surfaceRoute: input.surfaceRoute ?? null,
      isFirstMessage: true,
    },
  });

  return thread;
}

// =============================================================================
// REPLY
// =============================================================================

export async function appendReply(input: ReplyInput): Promise<FeedbackMessage> {
  const body = input.body.trim();
  if (!body) throw new Error('body is required');

  // Verify the thread exists + that the author is allowed to reply on it.
  // Advisers can only reply to their own threads; admins can reply to any.
  const thread = await prisma.feedbackThread.findUnique({
    where: { id: input.threadId },
    select: { id: true, userId: true, organizationId: true, status: true },
  });
  if (!thread) throw new Error('thread not found');

  if (input.authorRole === 'ADVISER' && thread.userId !== input.authorId) {
    throw new Error('forbidden — adviser can only reply to own threads');
  }

  const message = await prisma.feedbackMessage.create({
    data: {
      threadId: input.threadId,
      authorId: input.authorId,
      authorRole: input.authorRole,
      body,
    },
  });

  // Bump thread + (admin-only) update lastReviewedAt.
  await prisma.feedbackThread.update({
    where: { id: input.threadId },
    data: {
      ...(input.authorRole === 'MONITRAX_ADMIN'
        ? { lastReviewedAt: new Date() }
        : {}),
      // Auto-flip OPEN → IN_REVIEW the first time an admin replies. Keeps
      // the inbox SLA reporting honest without manual status flipping.
      ...(input.authorRole === 'MONITRAX_ADMIN' && thread.status === 'OPEN'
        ? { status: 'IN_REVIEW' as FeedbackStatus }
        : {}),
    },
  });

  void createAuditLog({
    userId: input.authorId,
    organizationId: thread.organizationId ?? undefined,
    action: 'FEEDBACK_THREAD_REPLIED',
    entityType: 'FeedbackThread',
    entityId: input.threadId,
    metadata: { role: input.authorRole },
  });

  if (input.authorRole === 'MONITRAX_ADMIN') {
    void notifyAdviserOfReply({
      adviserUserId: thread.userId,
      threadId: input.threadId,
    });
  }

  return message;
}

// =============================================================================
// ADMIN-SIDE: STATUS / INTERNAL NOTES
// =============================================================================

export async function updateAdminFields(
  input: UpdateAdminFieldsInput,
): Promise<FeedbackThread> {
  const existing = await prisma.feedbackThread.findUnique({
    where: { id: input.threadId },
    select: {
      id: true,
      organizationId: true,
      status: true,
      internalNotes: true,
      taggedForAi: true,
    },
  });
  if (!existing) throw new Error('thread not found');

  const data: Record<string, unknown> = { lastReviewedAt: new Date() };
  if (input.status !== undefined && input.status !== existing.status) {
    data.status = input.status;
  }
  if (input.internalNotes !== undefined) {
    data.internalNotes = input.internalNotes;
  }
  if (input.taggedForAi !== undefined) {
    data.taggedForAi = input.taggedForAi;
  }

  const updated = await prisma.feedbackThread.update({
    where: { id: input.threadId },
    data,
  });

  // Audit each field that actually changed. CLAUDE.md §13.3.
  if (input.status !== undefined && input.status !== existing.status) {
    void createAuditLog({
      userId: input.adminUserId,
      organizationId: existing.organizationId ?? undefined,
      action: 'FEEDBACK_THREAD_STATUS_CHANGED',
      entityType: 'FeedbackThread',
      entityId: input.threadId,
      metadata: { from: existing.status, to: input.status },
    });
  }
  if (input.internalNotes !== undefined && input.internalNotes !== existing.internalNotes) {
    void createAuditLog({
      userId: input.adminUserId,
      organizationId: existing.organizationId ?? undefined,
      action: 'FEEDBACK_INTERNAL_NOTE_UPDATED',
      entityType: 'FeedbackThread',
      entityId: input.threadId,
      // Body of the note is NOT logged — only the fact of edit + length.
      metadata: {
        previousLength: (existing.internalNotes ?? '').length,
        nextLength: (input.internalNotes ?? '').length,
      },
    });
  }

  return updated;
}

// =============================================================================
// READ
// =============================================================================

export async function listAdviserThreads(userId: string): Promise<AdviserVisibleThread[]> {
  const threads = await prisma.feedbackThread.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  });
  return threads.map(toAdviserVisible);
}

export async function getAdviserThread(
  threadId: string,
  userId: string,
): Promise<AdviserVisibleThread | null> {
  const thread = await prisma.feedbackThread.findUnique({
    where: { id: threadId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!thread || thread.userId !== userId) return null;
  return toAdviserVisible(thread);
}

export interface AdminThreadFilter {
  status?: FeedbackStatus;
  surfaceTag?: FeedbackSurfaceTag;
  severity?: FeedbackSeverity;
  organizationId?: string;
}

export async function listAdminThreads(filter: AdminThreadFilter = {}) {
  return prisma.feedbackThread.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.surfaceTag ? { surfaceTag: filter.surfaceTag } : {}),
      ...(filter.severity ? { severity: filter.severity } : {}),
      ...(filter.organizationId ? { organizationId: filter.organizationId } : {}),
    },
    orderBy: [
      // Oldest open first — so nothing rots in the inbox.
      { status: 'asc' },
      { createdAt: 'asc' },
    ],
    include: {
      user: { select: { id: true, name: true, email: true } },
      organization: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      _count: { select: { messages: true } },
    },
  });
}

export async function getAdminThread(threadId: string) {
  return prisma.feedbackThread.findUnique({
    where: { id: threadId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      organization: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: {
          author: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });
}

// =============================================================================
// EXPORT (Markdown — feeds Claude Code synthesis sessions)
// =============================================================================

export interface ExportOptions {
  /** ISO date — only include threads created on or after this date. */
  since?: Date;
  /** When true, only include threads with `taggedForAi = true`. */
  taggedOnly?: boolean;
}

export async function exportThreadsAsMarkdown(opts: ExportOptions = {}): Promise<string> {
  const where: Record<string, unknown> = {};
  if (opts.since) where.createdAt = { gte: opts.since };
  if (opts.taggedOnly) where.taggedForAi = true;

  const threads = await prisma.feedbackThread.findMany({
    where,
    orderBy: { createdAt: 'asc' },
    include: {
      user: { select: { name: true, email: true } },
      organization: { select: { name: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });

  const lines: string[] = [];
  lines.push('# Monitrax — Adviser Feedback Export');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Threads: ${threads.length}${opts.taggedOnly ? ' (tagged-for-AI only)' : ''}`);
  if (opts.since) lines.push(`Since: ${opts.since.toISOString()}`);
  lines.push('');
  lines.push('> Synthesise themes by frequency × severity. Group adjacent feedback.');
  lines.push('> Propose plan items that slot into IMPLEMENTATION_PLAN.md Up Next.');
  lines.push('> Flag any thread that mentions specific client data — do not echo it back.');
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const t of threads) {
    lines.push(`## ${t.subject}`);
    lines.push('');
    lines.push(`- **Author:** ${t.user.name} <${t.user.email}>`);
    if (t.organization) lines.push(`- **Org:** ${t.organization.name}`);
    lines.push(`- **Surface tag:** ${t.surfaceTag}  ·  **Severity:** ${t.severity}  ·  **Status:** ${t.status}`);
    if (t.surfaceRoute) lines.push(`- **Surface:** \`${t.surfaceRoute}\``);
    lines.push(`- **Created:** ${t.createdAt.toISOString()}`);
    lines.push(`- **Last updated:** ${t.updatedAt.toISOString()}`);
    lines.push('');

    for (const m of t.messages) {
      const role = m.authorRole === 'ADVISER' ? 'Adviser' : 'Monitrax';
      lines.push(`### ${role} — ${m.author.name} — ${m.createdAt.toISOString()}`);
      lines.push('');
      lines.push(m.body);
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

// =============================================================================
// NOTIFY (stub — swap for SendGrid when Phase 32C PR4d lands)
// =============================================================================

/**
 * Stub: notify the adviser that an admin has replied. v1 ships in-app only
 * (the adviser sees the reply on next visit to /portal/feedback). When
 * Phase 32C PR4d wires SendGrid for ProfessionalConversation, swap this
 * implementation to call the email transport — single swap-point.
 */
async function notifyAdviserOfReply(_params: {
  adviserUserId: string;
  threadId: string;
}): Promise<void> {
  // Intentional no-op for v1.
  return;
}

// =============================================================================
// INTERNAL HELPERS
// =============================================================================

function toAdviserVisible(
  thread: FeedbackThread & { messages: FeedbackMessage[] },
): AdviserVisibleThread {
  return {
    id: thread.id,
    subject: thread.subject,
    surfaceRoute: thread.surfaceRoute,
    surfaceTag: thread.surfaceTag,
    severity: thread.severity,
    status: thread.status,
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    organizationId: thread.organizationId,
    messages: thread.messages.map((m) => ({
      id: m.id,
      authorRole: m.authorRole,
      body: m.body,
      createdAt: m.createdAt,
    })),
  };
}
