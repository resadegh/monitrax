import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { createTrackedSession } from '@/lib/session';
import {
  isAccountLocked,
  recordFailedLoginAttempt,
  recordSuccessfulLogin,
} from '@/lib/security/accountLockout';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Validation
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Get client info
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0] ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Check if account is locked
    const lockoutStatus = await isAccountLocked(email);

    if (lockoutStatus.isLocked) {
      const minutesRemaining = lockoutStatus.lockoutExpiresAt
        ? Math.ceil((lockoutStatus.lockoutExpiresAt.getTime() - Date.now()) / (60 * 1000))
        : 0;

      return NextResponse.json(
        {
          error: `Account locked due to too many failed login attempts. Please try again in ${minutesRemaining} minutes.`,
          lockoutExpiresAt: lockoutStatus.lockoutExpiresAt,
        },
        { status: 423 } // 423 Locked
      );
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Record failed attempt (don't reveal if user exists)
      await recordFailedLoginAttempt(email, ipAddress, userAgent);

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user has a password (not passwordless account)
    if (!user.password) {
      return NextResponse.json(
        { error: 'This account uses passwordless authentication. Please use magic link or OAuth to sign in.' },
        { status: 401 }
      );
    }

    // Verify password
    const isValidPassword = await verifyPassword(password, user.password);

    if (!isValidPassword) {
      // Record failed attempt
      const lockoutResult = await recordFailedLoginAttempt(email, ipAddress, userAgent);

      if (lockoutResult.isLocked) {
        const minutesRemaining = lockoutResult.lockoutExpiresAt
          ? Math.ceil((lockoutResult.lockoutExpiresAt.getTime() - Date.now()) / (60 * 1000))
          : 0;

        return NextResponse.json(
          {
            error: `Account locked due to too many failed login attempts. Please try again in ${minutesRemaining} minutes.`,
            lockoutExpiresAt: lockoutResult.lockoutExpiresAt,
          },
          { status: 423 }
        );
      }

      return NextResponse.json(
        {
          error: 'Invalid email or password',
          remainingAttempts: lockoutResult.remainingAttempts,
        },
        { status: 401 }
      );
    }

    // Record successful login
    await recordSuccessfulLogin(user.id, email, ipAddress, userAgent);

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    // Create tracked session
    await createTrackedSession({
      userId: user.id,
      ipAddress,
      userAgent,
      deviceName: userAgent.includes('Mobile') ? 'Mobile Device' : 'Desktop',
    });

    // Return user (without password) and token
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
