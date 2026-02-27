import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/security/emailVerification';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password, and name are required' },
        { status: 400 }
      );
    }

    // Password strength validation (CDR compliance — Phase 34)
    const passwordErrors: string[] = [];
    if (password.length < 12) passwordErrors.push('at least 12 characters');
    if (!/[A-Z]/.test(password)) passwordErrors.push('an uppercase letter');
    if (!/[a-z]/.test(password)) passwordErrors.push('a lowercase letter');
    if (!/[0-9]/.test(password)) passwordErrors.push('a number');
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) passwordErrors.push('a special character');

    if (passwordErrors.length > 0) {
      return NextResponse.json(
        { error: `Password must contain: ${passwordErrors.join(', ')}` },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user (emailVerified defaults to false)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        emailVerified: false,
      },
    });

    // Send verification email
    const emailResult = await sendVerificationEmail(email, user.id);
    if (!emailResult.success) {
      console.warn('[Registration] Failed to send verification email:', emailResult.message);
    }

    // Generate token
    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    // Return user (without password) and token
    return NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
        },
        token,
        verificationEmailSent: emailResult.success,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
