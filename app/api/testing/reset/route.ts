/**
 * TEST DATA RESET API
 *
 * DELETE /api/testing/reset?userId=xxx
 * Resets all data for a test user
 *
 * DELETE /api/testing/reset?email=xxx
 * Resets all data for a test user by email
 *
 * DELETE /api/testing/reset?userId=xxx&deleteUser=true
 * Deletes the test user completely
 *
 * Returns: TestResetResult
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { TestScenarioReset } from '@/lib/testing/reset';

// Only allow in development/test environments
const isTestingEnabled = process.env.NODE_ENV !== 'production' ||
  process.env.ENABLE_TESTING_API === 'true';

export async function DELETE(request: NextRequest) {
  // Security check
  if (!isTestingEnabled) {
    return NextResponse.json(
      { error: 'Testing API is disabled in production' },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    const deleteUser = searchParams.get('deleteUser') === 'true';

    if (!userId && !email) {
      return NextResponse.json(
        { error: 'Missing required parameter: userId or email' },
        { status: 400 }
      );
    }

    const resetter = new TestScenarioReset(prisma);

    // Find user if only email provided
    let targetUserId = userId;
    if (!targetUserId && email) {
      targetUserId = await resetter.findTestUser(email);
      if (!targetUserId) {
        return NextResponse.json(
          { error: 'User not found with email: ' + email },
          { status: 404 }
        );
      }
    }

    // Verify user exists and is a test user
    const user = await prisma.user.findUnique({
      where: { id: targetUserId! },
      select: { id: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Safety check: only allow resetting test users
    if (!user.email.includes('test') && !user.email.includes('@monitrax.test')) {
      return NextResponse.json(
        { error: 'Can only reset test users (email must contain "test" or use @monitrax.test domain)' },
        { status: 403 }
      );
    }

    if (deleteUser) {
      // Delete user completely
      const result = await resetter.deleteTestUser(targetUserId!);
      return NextResponse.json({
        action: 'delete',
        ...result,
      });
    } else {
      // Just reset data
      const result = await resetter.resetUser(targetUserId!);
      return NextResponse.json({
        action: 'reset',
        ...result,
      });
    }
  } catch (error) {
    console.error('Test reset error:', error);
    return NextResponse.json(
      {
        error: 'Failed to reset test data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/testing/reset
 * Returns API documentation
 */
export async function GET() {
  if (!isTestingEnabled) {
    return NextResponse.json(
      { error: 'Testing API is disabled in production' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    description: 'Test Data Reset API',
    usage: {
      method: 'DELETE',
      queryParams: {
        userId: 'User ID to reset (required if email not provided)',
        email: 'User email to reset (required if userId not provided)',
        deleteUser: 'Set to "true" to delete the user completely',
      },
    },
    examples: [
      'DELETE /api/testing/reset?userId=xxx',
      'DELETE /api/testing/reset?email=test@monitrax.test',
      'DELETE /api/testing/reset?userId=xxx&deleteUser=true',
    ],
    warning: 'Only test users can be reset (email must contain "test")',
  });
}
