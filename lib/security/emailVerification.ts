/**
 * Email Verification System
 * Phase 05 - Backend Security
 *
 * Handles email verification tokens and flow.
 */

import { prisma } from '@/lib/db';

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
 * In production, this would integrate with an email service.
 */
export async function sendVerificationEmail(
  email: string,
  userId: string
): Promise<SendVerificationResult> {
  const canResend = canResendVerification(email);

  if (!canResend.allowed) {
    return {
      success: false,
      message: `Please wait ${canResend.waitSeconds} seconds before requesting another email.`,
    };
  }

  const token = await createVerificationToken(email, userId, 'EMAIL_VERIFY');

  // In production, send actual email here
  // For now, we'll log the verification URL
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify-email?token=${token.token}`;

  console.log(`[Email Verification] Send to: ${email}`);
  console.log(`[Email Verification] URL: ${verificationUrl}`);

  // In dev mode, return the token for testing
  const isDev = process.env.NODE_ENV === 'development';

  return {
    success: true,
    message: 'Verification email sent. Please check your inbox.',
    token: isDev ? token.token : undefined,
  };
}

/**
 * Send password reset email (creates token).
 */
export async function sendPasswordResetEmail(
  email: string,
  userId: string
): Promise<SendVerificationResult> {
  const canResend = canResendVerification(email);

  if (!canResend.allowed) {
    return {
      success: false,
      message: `Please wait ${canResend.waitSeconds} seconds before requesting another email.`,
    };
  }

  const token = await createVerificationToken(email, userId, 'PASSWORD_RESET');

  // In production, send actual email here
  const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password?token=${token.token}`;

  console.log(`[Password Reset] Send to: ${email}`);
  console.log(`[Password Reset] URL: ${resetUrl}`);

  const isDev = process.env.NODE_ENV === 'development';

  return {
    success: true,
    message: 'Password reset email sent. Please check your inbox.',
    token: isDev ? token.token : undefined,
  };
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

  // In production, update user's emailVerified field in DB
  // await prisma.user.update({
  //   where: { id: result.userId },
  //   data: { emailVerified: new Date() }
  // });

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
