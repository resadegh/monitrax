/**
 * Profile Settings API
 * GET - Retrieve user profile
 * PUT - Update user profile
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          phone: true,
          location: true,
          timezone: true,
          bio: true,
        },
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'User not found' } },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: user,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to fetch profile' } },
        { status: 500 }
      );
    }
  });
}

export async function PUT(request: NextRequest) {
  return withAuth(request, async (req: AuthenticatedRequest) => {
    try {
      const userId = req.user!.userId;
      const body = await request.json();

      const { name, mobile, phone, location, timezone, bio } = body;

      // Validate mobile number format if provided (Australian format)
      if (mobile) {
        const mobileClean = mobile.replace(/\s/g, '');
        if (!mobileClean.match(/^(\+61|0)[4-5]\d{8}$/)) {
          return NextResponse.json(
            {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Please provide a valid Australian mobile number (e.g., 0412345678 or +61412345678)',
              },
            },
            { status: 400 }
          );
        }
      }

      // Update user profile
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: {
          name: name || undefined,
          mobile: mobile || null,
          phone: phone || null,
          location: location || null,
          timezone: timezone || 'Australia/Sydney',
          bio: bio || null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          phone: true,
          location: true,
          timezone: true,
          bio: true,
        },
      });

      return NextResponse.json({
        success: true,
        data: updatedUser,
        meta: { timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: 'Failed to update profile' } },
        { status: 500 }
      );
    }
  });
}
