/**
 * Trusted Contact (Estate / handover)
 *
 * Optional second-line-of-defence: the person Monitrax can point a
 * future advisor or family member at if the user becomes unable to
 * manage their own finances. Surfaced through Settings; never auto-
 * shared. The future Phase 32B advisor handover flow will read this
 * row only with explicit user consent.
 *
 * GET — read the user's trusted contact (or null)
 * PUT — set / update the trusted contact (all fields optional)
 *
 * CLAUDE.md §12.11 destructive-write checklist:
 *   1. WHERE clause matches: { id: auth.userId } — only the requesting
 *      user's own row.
 *   2. Columns overwritten: trustedContactName / Email / Phone /
 *      Relationship / UpdatedAt. Previous value is the user's own
 *      previous trusted-contact entry — clobbering is the desired
 *      behaviour (this is the user choosing to update their own data).
 *   3. Guard: auth.userId from verified bearer token; never request body.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';

export const GET = withPermission('settings.read', async (_request, auth) => {
  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: {
      trustedContactName: true,
      trustedContactEmail: true,
      trustedContactPhone: true,
      trustedContactRelationship: true,
      trustedContactUpdatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  return NextResponse.json({
    name: user.trustedContactName,
    email: user.trustedContactEmail,
    phone: user.trustedContactPhone,
    relationship: user.trustedContactRelationship,
    updatedAt: user.trustedContactUpdatedAt,
  });
});

export const PUT = withPermission('settings.write', async (request, auth) => {
  const body = await request.json();
  const { name, email, phone, relationship } = body ?? {};

  // Light validation: emails look like emails, names + phones are
  // strings of reasonable length. We deliberately don't enforce
  // strict phone format because trusted contacts may be overseas.
  const trim = (v: unknown) =>
    typeof v === 'string' ? v.trim().slice(0, 200) || null : null;
  const cleanName = trim(name);
  const cleanEmail = trim(email);
  const cleanPhone = trim(phone);
  const cleanRel = trim(relationship);

  if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return NextResponse.json(
      { error: 'Trusted contact email must be a valid email address' },
      { status: 400 }
    );
  }

  // If every field is null, treat the call as "remove trusted contact"
  // — clear every field together so we never persist a partial entry.
  const isClear =
    !cleanName && !cleanEmail && !cleanPhone && !cleanRel;

  const updated = await prisma.user.update({
    where: { id: auth.userId },
    data: {
      trustedContactName: isClear ? null : cleanName,
      trustedContactEmail: isClear ? null : cleanEmail,
      trustedContactPhone: isClear ? null : cleanPhone,
      trustedContactRelationship: isClear ? null : cleanRel,
      trustedContactUpdatedAt: new Date(),
    },
    select: {
      trustedContactName: true,
      trustedContactEmail: true,
      trustedContactPhone: true,
      trustedContactRelationship: true,
      trustedContactUpdatedAt: true,
    },
  });

  await createAuditLog({
    userId: auth.userId,
    action: 'TRUSTED_CONTACT_UPDATED',
    status: 'SUCCESS',
    entityType: 'User',
    entityId: auth.userId,
    ipAddress:
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    metadata: {
      cleared: isClear,
      hasName: !!updated.trustedContactName,
      hasEmail: !!updated.trustedContactEmail,
      hasPhone: !!updated.trustedContactPhone,
      hasRelationship: !!updated.trustedContactRelationship,
    },
  });

  return NextResponse.json({
    success: true,
    name: updated.trustedContactName,
    email: updated.trustedContactEmail,
    phone: updated.trustedContactPhone,
    relationship: updated.trustedContactRelationship,
    updatedAt: updated.trustedContactUpdatedAt,
  });
});
