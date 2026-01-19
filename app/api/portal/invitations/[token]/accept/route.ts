/**
 * Phase 32: Invitation Acceptance API
 *
 * POST /api/portal/invitations/[token]/accept
 *
 * Accepts an invitation and adds user to the organization.
 * - For existing users: requires authentication
 * - For new users: creates account with provided credentials
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken, generateToken, hashPassword } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    const body = await request.json();
    const { name, password, createAccount } = body;

    // Find the invitation by token
    const invitation = await prisma.organizationInvitation.findFirst({
      where: {
        token,
        status: 'PENDING',
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: 'INVITATION_NOT_FOUND', message: 'Invitation not found or already used' },
        { status: 404 }
      );
    }

    // Fetch the organization separately
    const organization = await prisma.organization.findUnique({
      where: { id: invitation.organizationId },
      select: { id: true, name: true },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'ORGANIZATION_NOT_FOUND', message: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if invitation has expired
    if (new Date(invitation.tokenExpiresAt) < new Date()) {
      await prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });

      return NextResponse.json(
        { error: 'INVITATION_EXPIRED', message: 'This invitation has expired' },
        { status: 410 }
      );
    }

    let user;

    if (createAccount) {
      // Create new user account
      if (!name || !password) {
        return NextResponse.json(
          { error: 'MISSING_FIELDS', message: 'Name and password are required' },
          { status: 400 }
        );
      }

      if (password.length < 8) {
        return NextResponse.json(
          { error: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' },
          { status: 400 }
        );
      }

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: invitation.email.toLowerCase() },
      });

      if (existingUser) {
        return NextResponse.json(
          { error: 'USER_EXISTS', message: 'An account with this email already exists. Please sign in instead.' },
          { status: 409 }
        );
      }

      // Hash password and create user
      const hashedPassword = await hashPassword(password);

      user = await prisma.user.create({
        data: {
          email: invitation.email.toLowerCase(),
          name,
          password: hashedPassword,
          emailVerified: true, // Mark as verified since they came through invitation
        },
      });
    } else {
      // Existing user - verify authentication
      const authHeader = request.headers.get('authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'UNAUTHORIZED', message: 'Authentication required' },
          { status: 401 }
        );
      }

      try {
        const authToken = authHeader.substring(7);
        const payload = await verifyToken(authToken);

        if (!payload?.userId) {
          return NextResponse.json(
            { error: 'UNAUTHORIZED', message: 'Invalid authentication token' },
            { status: 401 }
          );
        }

        user = await prisma.user.findUnique({
          where: { id: payload.userId },
        });

        if (!user) {
          return NextResponse.json(
            { error: 'USER_NOT_FOUND', message: 'User not found' },
            { status: 404 }
          );
        }

        // Verify email matches invitation
        if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
          return NextResponse.json(
            { error: 'EMAIL_MISMATCH', message: 'This invitation is for a different email address' },
            { status: 403 }
          );
        }
      } catch (err) {
        return NextResponse.json(
          { error: 'UNAUTHORIZED', message: 'Invalid authentication token' },
          { status: 401 }
        );
      }
    }

    // Check if user is already a member
    const existingMembership = await prisma.organizationMember.findFirst({
      where: {
        userId: user.id,
        organizationId: invitation.organizationId,
      },
    });

    if (existingMembership) {
      // Update invitation status
      await prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });

      return NextResponse.json(
        { error: 'ALREADY_MEMBER', message: 'You are already a member of this organization' },
        { status: 409 }
      );
    }

    // Map invitation role to member role
    const roleMapping: Record<string, string> = {
      PORTAL_OWNER: 'OWNER',
      PORTAL_ADMIN: 'ADMIN',
      PORTAL_ADVISOR: 'CONTRIBUTOR',
      PORTAL_VIEWER: 'VIEWER',
    };

    const memberRole = roleMapping[invitation.role] || 'VIEWER';

    // Create organization membership and update invitation in a transaction
    await prisma.$transaction([
      prisma.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: memberRole as 'OWNER' | 'ADMIN' | 'CONTRIBUTOR' | 'VIEWER',
          invitedBy: invitation.invitedByMemberId,
          invitedAt: invitation.createdAt,
          joinedAt: new Date(),
          isActive: true,
        },
      }),
      prisma.organizationInvitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      }),
    ]);

    // Generate auth token for new users
    let authToken = null;
    if (createAccount) {
      authToken = await generateToken({
        userId: user.id,
        email: user.email,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully joined ${organization.name}`,
      organization: {
        id: organization.id,
        name: organization.name,
      },
      ...(authToken && {
        token: authToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      }),
    });
  } catch (error) {
    console.error('[Portal API] Error accepting invitation:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to accept invitation' },
      { status: 500 }
    );
  }
}
