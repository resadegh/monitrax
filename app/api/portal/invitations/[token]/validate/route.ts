/**
 * Phase 32: Invitation Validation API
 *
 * GET /api/portal/invitations/[token]/validate
 *
 * Validates an invitation token and returns invitation details.
 * Does not require authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    // Find the invitation by token
    const invitation = await prisma.organizationInvitation.findFirst({
      where: {
        token,
        status: 'PENDING',
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        invitedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'INVITATION_NOT_FOUND', message: 'Invitation not found or already used' },
        { status: 404 }
      );
    }

    // Check if invitation has expired
    if (new Date(invitation.tokenExpiresAt) < new Date()) {
      // Update invitation status to expired
      await prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });

      return NextResponse.json(
        { error: 'INVITATION_EXPIRED', message: 'This invitation has expired' },
        { status: 410 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email.toLowerCase() },
      select: { id: true },
    });

    // Get organization portal settings for branding
    const portalSettings = await prisma.organizationPortalSettings.findUnique({
      where: { organizationId: invitation.organizationId },
      select: {
        brandLogoUrl: true,
        brandName: true,
      },
    });

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        organizationName: portalSettings?.brandName || invitation.organization.name,
        organizationLogo: portalSettings?.brandLogoUrl || null,
        invitedBy: invitation.invitedBy?.name || invitation.invitedBy?.email || 'Unknown',
        expiresAt: invitation.tokenExpiresAt.toISOString(),
        userExists: !!existingUser,
      },
    });
  } catch (error) {
    console.error('[Portal API] Error validating invitation:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to validate invitation' },
      { status: 500 }
    );
  }
}
