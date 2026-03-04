/**
 * Phase 32: Organization Registration API
 *
 * POST /api/portal/organizations/register
 *
 * Creates a new organization with admin user:
 * 1. Creates User record for admin
 * 2. Creates Organization record
 * 3. Creates OrganizationPortalSettings with selected plan
 * 4. Creates OrganizationMember linking admin to org as OWNER
 * 5. Returns auth token for immediate login
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';

// Plan limits mapping
const PLAN_LIMITS: Record<string, { maxClients: number; maxStaff: number }> = {
  STARTER: { maxClients: 10, maxStaff: 3 },
  PROFESSIONAL: { maxClients: 50, maxStaff: 10 },
  BUSINESS: { maxClients: 200, maxStaff: 25 },
  ENTERPRISE: { maxClients: 9999, maxStaff: 9999 }, // Effectively unlimited
};

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

async function getUniqueSlug(baseSlug: string): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;

    if (counter > 100) {
      // Fallback to UUID suffix
      slug = `${baseSlug}-${Date.now()}`;
      break;
    }
  }

  return slug;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organization, admin, plan } = body;

    // Validate required fields
    if (!organization?.name || !organization?.type || !organization?.businessEmail) {
      return NextResponse.json(
        { error: 'MISSING_ORG_FIELDS', message: 'Organization name, type, and email are required' },
        { status: 400 }
      );
    }

    if (!admin?.name || !admin?.email || !admin?.password) {
      return NextResponse.json(
        { error: 'MISSING_ADMIN_FIELDS', message: 'Admin name, email, and password are required' },
        { status: 400 }
      );
    }

    if (admin.password.length < 8) {
      return NextResponse.json(
        { error: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    const selectedPlan = plan || 'STARTER';
    const planLimits = PLAN_LIMITS[selectedPlan] || PLAN_LIMITS.STARTER;

    // Check if admin email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: admin.email.toLowerCase() },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error: 'USER_EXISTS',
          message: 'An account with this email already exists. Please sign in instead.',
        },
        { status: 409 }
      );
    }

    // Generate unique slug for organization
    const baseSlug = generateSlug(organization.name);
    const slug = await getUniqueSlug(baseSlug);

    // Hash admin password
    const hashedPassword = await hashPassword(admin.password);

    // Create everything in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create admin user
      const user = await tx.user.create({
        data: {
          email: admin.email.toLowerCase(),
          name: admin.name,
          password: hashedPassword,
          emailVerified: false, // Require email verification
          role: 'OWNER',
        },
      });

      // 2. Create organization
      const org = await tx.organization.create({
        data: {
          name: organization.name,
          slug,
          description: `${organization.type.replace(/_/g, ' ')} organization`,
        },
      });

      // 3. Create portal settings
      await tx.organizationPortalSettings.create({
        data: {
          organizationId: org.id,
          organizationType: organization.type,
          plan: selectedPlan,
          portalEnabled: true,
          maxClients: planLimits.maxClients,
          maxStaff: planLimits.maxStaff,
          businessEmail: organization.businessEmail,
          businessPhone: organization.businessPhone || null,
          abn: organization.abn || null,
        },
      });

      // 4. Create organization member (admin as OWNER)
      await tx.organizationMember.create({
        data: {
          organizationId: org.id,
          userId: user.id,
          role: 'OWNER',
          joinedAt: new Date(),
          isActive: true,
        },
      });

      return { user, org };
    });

    // Generate auth token for immediate login
    const token = await generateToken({
      userId: result.user.id,
      email: result.user.email,
    });

    return NextResponse.json({
      success: true,
      message: 'Organization registered successfully',
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
      },
      organization: {
        id: result.org.id,
        name: result.org.name,
        slug: result.org.slug,
      },
      plan: selectedPlan,
    });
  } catch (error) {
    console.error('[Portal API] Error registering organization:', error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Failed to register organization' },
      { status: 500 }
    );
  }
}
