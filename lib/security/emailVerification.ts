/**
 * Email Verification System
 * Phase 05 - Backend Security
 *
 * Handles email verification tokens and flow.
 * Uses Resend for email delivery.
 */

import { prisma } from '@/lib/db';
import { Resend } from 'resend';

// =============================================================================
// TYPES
// =============================================================================

export interface VerificationToken {
  token: string;
  email: string;
  userId: string;
  type: 'EMAIL_VERIFY' | 'PASSWORD_RESET' | 'MAGIC_LINK';
  expiresAt: Date;
  used: boolean;
  createdAt: Date;
}

export interface SendVerificationResult {
  success: boolean;
  message: string;
  token?: string; // Only returned in dev mode for testing
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TOKEN_EXPIRY = {
  EMAIL_VERIFY: 24 * 60 * 60 * 1000, // 24 hours
  PASSWORD_RESET: 60 * 60 * 1000, // 1 hour
  MAGIC_LINK: 10 * 60 * 1000, // 10 minutes
};

const RESEND_COOLDOWN = 60 * 1000; // 1 minute between resends
const MAX_RESENDS_PER_HOUR = 5;

// Lazy initialize Resend client (avoid initialization at build time)
let resendClient: Resend | null = null;
function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

// Email configuration
const FROM_EMAIL = process.env.FROM_EMAIL || 'Monitrax <onboarding@resend.dev>';
const APP_NAME = 'Monitrax';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.monitrax.com.au';

// =============================================================================
// IN-MEMORY TOKEN STORE (Replace with DB in production)
// =============================================================================

const tokenStore = new Map<string, VerificationToken>();
const resendTracker = new Map<string, { count: number; resetAt: number }>();

// Clean up expired tokens periodically
setInterval(() => {
  const now = new Date();
  for (const [key, token] of tokenStore.entries()) {
    if (token.expiresAt < now || token.used) {
      tokenStore.delete(key);
    }
  }
}, 60000); // Clean every minute

// =============================================================================
// TOKEN FUNCTIONS
// =============================================================================

/**
 * Generate a secure random token.
 */
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Create a verification token.
 */
export async function createVerificationToken(
  email: string,
  userId: string,
  type: VerificationToken['type']
): Promise<VerificationToken> {
  const token = generateToken();
  const now = new Date();

  const verificationToken: VerificationToken = {
    token,
    email: email.toLowerCase(),
    userId,
    type,
    expiresAt: new Date(now.getTime() + TOKEN_EXPIRY[type]),
    used: false,
    createdAt: now,
  };

  // Invalidate any existing tokens of the same type for this email
  for (const [key, existing] of tokenStore.entries()) {
    if (existing.email === email.toLowerCase() && existing.type === type) {
      tokenStore.delete(key);
    }
  }

  tokenStore.set(token, verificationToken);

  return verificationToken;
}

/**
 * Verify a token and mark it as used.
 */
export async function verifyToken(
  token: string,
  type: VerificationToken['type']
): Promise<{ valid: boolean; email?: string; userId?: string; error?: string }> {
  const storedToken = tokenStore.get(token);

  if (!storedToken) {
    return { valid: false, error: 'Invalid token' };
  }

  if (storedToken.type !== type) {
    return { valid: false, error: 'Invalid token type' };
  }

  if (storedToken.used) {
    return { valid: false, error: 'Token already used' };
  }

  if (storedToken.expiresAt < new Date()) {
    tokenStore.delete(token);
    return { valid: false, error: 'Token expired' };
  }

  // Mark as used
  storedToken.used = true;
  tokenStore.set(token, storedToken);

  return {
    valid: true,
    email: storedToken.email,
    userId: storedToken.userId,
  };
}

/**
 * Check if resend is allowed (rate limiting).
 */
export function canResendVerification(email: string): { allowed: boolean; waitSeconds?: number } {
  const key = email.toLowerCase();
  const now = Date.now();
  const tracker = resendTracker.get(key);

  if (!tracker || tracker.resetAt < now) {
    // Reset the tracker
    resendTracker.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return { allowed: true };
  }

  if (tracker.count >= MAX_RESENDS_PER_HOUR) {
    const waitSeconds = Math.ceil((tracker.resetAt - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  // Check cooldown (1 minute between resends)
  const tokens = Array.from(tokenStore.values()).filter(
    (t) => t.email === key && !t.used
  );

  if (tokens.length > 0) {
    const lastToken = tokens.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    const timeSinceLastSend = now - lastToken.createdAt.getTime();

    if (timeSinceLastSend < RESEND_COOLDOWN) {
      const waitSeconds = Math.ceil((RESEND_COOLDOWN - timeSinceLastSend) / 1000);
      return { allowed: false, waitSeconds };
    }
  }

  tracker.count++;
  resendTracker.set(key, tracker);

  return { allowed: true };
}

// =============================================================================
// EMAIL VERIFICATION FLOW
// =============================================================================

/**
 * Send email verification (creates token).
 * Uses Resend for email delivery.
 */
export async function sendVerificationEmail(
  email: string,
  userId: string
): Promise<SendVerificationResult> {
  const canResendResult = canResendVerification(email);

  if (!canResendResult.allowed) {
    return {
      success: false,
      message: `Please wait ${canResendResult.waitSeconds} seconds before requesting another email.`,
    };
  }

  const token = await createVerificationToken(email, userId, 'EMAIL_VERIFY');
  const verificationUrl = `${APP_URL}/verify-email?token=${token.token}`;

  try {
    // Send email via Resend
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Verify your ${APP_NAME} email address`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Welcome to ${APP_NAME}!</h2>
          <p>Please verify your email address by clicking the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}"
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Verify Email
            </a>
          </div>
          <p style="color: #666;">Or copy and paste this link into your browser:</p>
          <p style="color: #4F46E5; word-break: break-all;">${verificationUrl}</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This link will expire in 24 hours. If you didn't create an account with ${APP_NAME}, please ignore this email.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Email Verification] Resend error:', error);
      return {
        success: false,
        message: 'Failed to send verification email. Please try again.',
      };
    }

    console.log(`[Email Verification] Sent to: ${email}, ID: ${data?.id}`);

    // In dev mode, return the token for testing
    const isDev = process.env.NODE_ENV === 'development';

    return {
      success: true,
      message: 'Verification email sent. Please check your inbox.',
      token: isDev ? token.token : undefined,
    };
  } catch (error) {
    console.error('[Email Verification] Send error:', error);
    return {
      success: false,
      message: 'Failed to send verification email. Please try again.',
    };
  }
}

/**
 * Send password reset email (creates token).
 * Uses Resend for email delivery.
 */
export async function sendPasswordResetEmail(
  email: string,
  userId: string
): Promise<SendVerificationResult> {
  const canResendResult = canResendVerification(email);

  if (!canResendResult.allowed) {
    return {
      success: false,
      message: `Please wait ${canResendResult.waitSeconds} seconds before requesting another email.`,
    };
  }

  const token = await createVerificationToken(email, userId, 'PASSWORD_RESET');
  const resetUrl = `${APP_URL}/reset-password?token=${token.token}`;

  try {
    // Send email via Resend
    const { data, error } = await getResendClient().emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: `Reset your ${APP_NAME} password`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #4F46E5;">Password Reset Request</h2>
          <p>We received a request to reset your ${APP_NAME} password. Click the button below to set a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}"
               style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #666;">Or copy and paste this link into your browser:</p>
          <p style="color: #4F46E5; word-break: break-all;">${resetUrl}</p>
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This link will expire in 1 hour. If you didn't request a password reset, please ignore this email - your password will remain unchanged.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error('[Password Reset] Resend error:', error);
      return {
        success: false,
        message: 'Failed to send password reset email. Please try again.',
      };
    }

    console.log(`[Password Reset] Sent to: ${email}, ID: ${data?.id}`);

    const isDev = process.env.NODE_ENV === 'development';

    return {
      success: true,
      message: 'Password reset email sent. Please check your inbox.',
      token: isDev ? token.token : undefined,
    };
  } catch (error) {
    console.error('[Password Reset] Send error:', error);
    return {
      success: false,
      message: 'Failed to send password reset email. Please try again.',
    };
  }
}

/**
 * Verify email with token.
 */
export async function verifyEmail(token: string): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
}> {
  const result = await verifyToken(token, 'EMAIL_VERIFY');

  if (!result.valid) {
    return { success: false, error: result.error };
  }

  // Update user's emailVerified field in DB
  try {
    await prisma.user.update({
      where: { id: result.userId },
      data: {
        emailVerified: true,
        emailVerifiedAt: new Date(),
      },
    });
  } catch (error) {
    console.error('[Email Verification] DB update error:', error);
    return { success: false, error: 'Failed to update verification status' };
  }

  return { success: true, userId: result.userId };
}

/**
 * Verify password reset token.
 */
export async function verifyPasswordResetToken(token: string): Promise<{
  success: boolean;
  userId?: string;
  email?: string;
  error?: string;
}> {
  const result = await verifyToken(token, 'PASSWORD_RESET');

  if (!result.valid) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    userId: result.userId,
    email: result.email,
  };
}

// =============================================================================
// INDEX EXPORT
// =============================================================================

export const emailVerification = {
  createToken: createVerificationToken,
  verifyToken,
  canResend: canResendVerification,
  sendVerification: sendVerificationEmail,
  sendPasswordReset: sendPasswordResetEmail,
  verifyEmail,
  verifyPasswordResetToken,
};
