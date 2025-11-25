/**
 * Multi-Factor Authentication (MFA) System
 * Phase 10: TOTP, SMS, and WebAuthn/Passkey support
 */

import { prisma } from '@/lib/db';
import * as crypto from 'crypto';
import { log } from '@/lib/utils/logger';
import { logAuth } from './auditLog';

// ============================================
// TYPES
// ============================================

export type MFAType = 'TOTP' | 'SMS' | 'EMAIL' | 'WEBAUTHN';

export interface MFASetupResult {
  id: string;
  type: MFAType;
  secret?: string; // For TOTP
  qrCodeUrl?: string; // For TOTP
  backupCodes: string[];
}

export interface MFAVerificationResult {
  success: boolean;
  error?: string;
}

// ============================================
// TOTP (Time-Based One-Time Password) FUNCTIONS
// ============================================

/**
 * Generate a random TOTP secret (base32 encoded)
 */
export function generateTOTPSecret(): string {
  const buffer = crypto.randomBytes(20);
  return base32Encode(buffer);
}

/**
 * Base32 encoding for TOTP secrets (RFC 4648)
 */
function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Base32 decoding for TOTP secrets
 */
function base32Decode(input: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  input = input.toUpperCase().replace(/=+$/, '');

  for (let i = 0; i < input.length; i++) {
    const idx = alphabet.indexOf(input[i]);
    if (idx === -1) {
      throw new Error('Invalid base32 character');
    }

    value = (value << 5) | idx;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/**
 * Generate TOTP code for a given secret at a specific time
 */
export function generateTOTPCode(secret: string, timeStep = 30, time?: number): string {
  const counter = Math.floor((time ?? Date.now()) / 1000 / timeStep);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));

  const secretBuffer = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(buffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0xf;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verify a TOTP code against a secret
 * Allows for time drift of ±1 time step (30 seconds)
 */
export function verifyTOTPCode(secret: string, code: string, timeStep = 30): boolean {
  const now = Date.now();
  const window = [-1, 0, 1]; // Check previous, current, and next time step

  for (const offset of window) {
    const time = now + offset * timeStep * 1000;
    const expectedCode = generateTOTPCode(secret, timeStep, time);

    if (expectedCode === code) {
      return true;
    }
  }

  return false;
}

/**
 * Generate a TOTP URI for QR code generation
 * Format: otpauth://totp/Monitrax:user@example.com?secret=SECRET&issuer=Monitrax
 */
export function generateTOTPUri(secret: string, email: string, issuer = 'Monitrax'): string {
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(email)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

// ============================================
// BACKUP CODES
// ============================================

/**
 * Generate backup codes for account recovery
 */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    // Format as XXXX-XXXX for readability
    codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
  }

  return codes;
}

/**
 * Hash a backup code for storage
 */
export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

/**
 * Verify a backup code against hashed codes
 */
export function verifyBackupCode(code: string, hashedCodes: string[]): boolean {
  const hashedInput = hashBackupCode(code);
  return hashedCodes.includes(hashedInput);
}

// ============================================
// MFA MANAGEMENT FUNCTIONS
// ============================================

/**
 * Setup TOTP MFA for a user
 */
export async function setupTOTPMFA(userId: string, email: string): Promise<MFASetupResult> {
  const secret = generateTOTPSecret();
  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = backupCodes.map(hashBackupCode);

  // Encrypt the secret before storing (in production, use proper encryption)
  const encryptedSecret = Buffer.from(secret).toString('base64');

  const mfaMethod = await prisma.mFAMethod.create({
    data: {
      userId,
      type: 'TOTP',
      secret: encryptedSecret,
      backupCodes: hashedBackupCodes,
      isEnabled: false, // Not enabled until first successful verification
      isPrimary: true,
    },
  });

  const qrCodeUrl = generateTOTPUri(secret, email);

  return {
    id: mfaMethod.id,
    type: 'TOTP',
    secret,
    qrCodeUrl,
    backupCodes,
  };
}

/**
 * Enable TOTP MFA after successful verification
 */
export async function enableTOTPMFA(
  userId: string,
  mfaMethodId: string,
  code: string
): Promise<MFAVerificationResult> {
  const mfaMethod = await prisma.mFAMethod.findFirst({
    where: {
      id: mfaMethodId,
      userId,
      type: 'TOTP',
    },
  });

  if (!mfaMethod || !mfaMethod.secret) {
    return { success: false, error: 'MFA method not found' };
  }

  // Decrypt the secret (in production, use proper decryption)
  const secret = Buffer.from(mfaMethod.secret, 'base64').toString('utf-8');

  if (!verifyTOTPCode(secret, code)) {
    await logAuth({
      userId,
      action: 'MFA_FAILURE',
      status: 'FAILURE',
      metadata: { reason: 'invalid_totp_code' },
    });
    return { success: false, error: 'Invalid verification code' };
  }

  // Enable MFA method
  await prisma.mFAMethod.update({
    where: { id: mfaMethodId },
    data: {
      isEnabled: true,
      lastUsedAt: new Date(),
    },
  });

  // Update user MFA status
  await prisma.user.update({
    where: { id: userId },
    data: { mfaEnabled: true },
  });

  await logAuth({
    userId,
    action: 'MFA_SUCCESS',
    status: 'SUCCESS',
    metadata: { type: 'totp_enabled' },
  });

  return { success: true };
}

/**
 * Verify TOTP MFA during login
 */
export async function verifyTOTPMFA(
  userId: string,
  code: string,
  ipAddress?: string
): Promise<MFAVerificationResult> {
  const mfaMethod = await prisma.mFAMethod.findFirst({
    where: {
      userId,
      type: 'TOTP',
      isEnabled: true,
    },
  });

  if (!mfaMethod || !mfaMethod.secret) {
    return { success: false, error: 'TOTP MFA not configured' };
  }

  // Check if it's a backup code
  if (code.includes('-') && verifyBackupCode(code, mfaMethod.backupCodes)) {
    // Remove used backup code
    const hashedCode = hashBackupCode(code);
    const updatedBackupCodes = mfaMethod.backupCodes.filter((bc: string) => bc !== hashedCode);

    await prisma.mFAMethod.update({
      where: { id: mfaMethod.id },
      data: {
        backupCodes: updatedBackupCodes,
        lastUsedAt: new Date(),
      },
    });

    await logAuth({
      userId,
      action: 'MFA_SUCCESS',
      status: 'SUCCESS',
      ipAddress,
      metadata: { type: 'backup_code' },
    });

    return { success: true };
  }

  // Decrypt the secret
  const secret = Buffer.from(mfaMethod.secret, 'base64').toString('utf-8');

  if (!verifyTOTPCode(secret, code)) {
    await logAuth({
      userId,
      action: 'MFA_FAILURE',
      status: 'FAILURE',
      ipAddress,
      metadata: { reason: 'invalid_totp_code' },
    });
    return { success: false, error: 'Invalid verification code' };
  }

  // Update last used timestamp
  await prisma.mFAMethod.update({
    where: { id: mfaMethod.id },
    data: { lastUsedAt: new Date() },
  });

  await logAuth({
    userId,
    action: 'MFA_SUCCESS',
    status: 'SUCCESS',
    ipAddress,
    metadata: { type: 'totp' },
  });

  return { success: true };
}

/**
 * Disable MFA for a user
 */
export async function disableMFA(userId: string, mfaMethodId: string): Promise<void> {
  await prisma.mFAMethod.update({
    where: { id: mfaMethodId },
    data: { isEnabled: false },
  });

  // Check if user has any other enabled MFA methods
  const otherMethods = await prisma.mFAMethod.count({
    where: {
      userId,
      isEnabled: true,
      id: { not: mfaMethodId },
    },
  });

  if (otherMethods === 0) {
    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: false },
    });
  }

  await logAuth({
    userId,
    action: 'MFA_CHALLENGE',
    status: 'SUCCESS',
    metadata: { action: 'mfa_disabled', methodId: mfaMethodId },
  });
}

/**
 * Get user's MFA methods
 */
export async function getUserMFAMethods(userId: string) {
  return prisma.mFAMethod.findMany({
    where: { userId },
    select: {
      id: true,
      type: true,
      isEnabled: true,
      isPrimary: true,
      lastUsedAt: true,
      phoneNumber: true, // For SMS
      createdAt: true,
    },
  });
}

/**
 * Check if MFA is required for a user
 */
export async function isMFARequired(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mfaEnabled: true, mfaEnforcedByOrg: true },
  });

  return user?.mfaEnabled || user?.mfaEnforcedByOrg || false;
}

/**
 * Regenerate backup codes
 */
export async function regenerateBackupCodes(
  userId: string,
  mfaMethodId: string
): Promise<string[]> {
  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = backupCodes.map(hashBackupCode);

  await prisma.mFAMethod.update({
    where: {
      id: mfaMethodId,
      userId,
    },
    data: {
      backupCodes: hashedBackupCodes,
    },
  });

  await logAuth({
    userId,
    action: 'MFA_CHALLENGE',
    status: 'SUCCESS',
    metadata: { action: 'backup_codes_regenerated', methodId: mfaMethodId },
  });

  return backupCodes;
}

// ============================================
// EMAIL MFA CODES
// ============================================

/**
 * Generate a 6-digit email MFA code
 */
export function generateEmailMFACode(): string {
  const code = crypto.randomInt(100000, 999999).toString();
  return code;
}

/**
 * Send email MFA code (in production, integrate with email service)
 */
export async function sendEmailMFACode(
  userId: string,
  email: string,
  ipAddress?: string
): Promise<{ success: boolean; expiresAt: Date; error?: string }> {
  try {
    const code = generateEmailMFACode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Hash the code for storage
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    // Store in database
    await prisma.emailMFACode.create({
      data: {
        userId,
        code: hashedCode,
        expiresAt,
        attempts: 0,
      },
    });

    // Log the generation
    await logAuth({
      userId,
      action: 'MFA_CHALLENGE',
      status: 'SUCCESS',
      ipAddress,
      metadata: {
        type: 'email_code_sent',
        email,
        expiresAt: expiresAt.toISOString(),
      },
    });

    // In production, send actual email
    log.info('Email MFA code generated', {
      userId,
      email,
      expiresAt,
      code: process.env.NODE_ENV === 'development' ? code : '******',
    });

    // In development, log the code for testing
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n🔐 Email MFA Code for ${email}: ${code}\n`);
    }

    // TODO: Integrate with email service (SendGrid, AWS SES, etc.)
    // await emailService.send({
    //   to: email,
    //   subject: 'Your verification code',
    //   template: 'mfa-code',
    //   data: { code, expiresInMinutes: 10 },
    // });

    return { success: true, expiresAt };
  } catch (error) {
    console.error('[MFA] Failed to send email code:', error);
    return {
      success: false,
      expiresAt: new Date(),
      error: 'Failed to send verification code',
    };
  }
}

/**
 * Verify email MFA code
 */
export async function verifyEmailMFACode(
  userId: string,
  code: string,
  ipAddress?: string
): Promise<MFAVerificationResult> {
  try {
    // Hash the provided code
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    // Find the most recent valid code
    const storedCode = await prisma.emailMFACode.findFirst({
      where: {
        userId,
        code: hashedCode,
        expiresAt: { gt: new Date() },
        verified: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!storedCode) {
      // Check if code was already used or expired
      const anyCode = await prisma.emailMFACode.findFirst({
        where: {
          userId,
          code: hashedCode,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (anyCode) {
        if (anyCode.verified) {
          await logAuth({
            userId,
            action: 'MFA_FAILURE',
            status: 'FAILURE',
            ipAddress,
            metadata: { reason: 'code_already_used' },
          });
          return { success: false, error: 'Code has already been used' };
        }

        if (anyCode.expiresAt < new Date()) {
          await logAuth({
            userId,
            action: 'MFA_FAILURE',
            status: 'FAILURE',
            ipAddress,
            metadata: { reason: 'code_expired' },
          });
          return { success: false, error: 'Code has expired' };
        }
      }

      await logAuth({
        userId,
        action: 'MFA_FAILURE',
        status: 'FAILURE',
        ipAddress,
        metadata: { reason: 'invalid_email_code' },
      });
      return { success: false, error: 'Invalid verification code' };
    }

    // Check attempt limit
    if (storedCode.attempts >= 3) {
      await prisma.emailMFACode.update({
        where: { id: storedCode.id },
        data: { verified: true }, // Mark as used to prevent further attempts
      });

      await logAuth({
        userId,
        action: 'MFA_FAILURE',
        status: 'FAILURE',
        ipAddress,
        metadata: { reason: 'max_attempts_exceeded' },
      });

      return {
        success: false,
        error: 'Maximum verification attempts exceeded',
      };
    }

    // Mark code as verified
    await prisma.emailMFACode.update({
      where: { id: storedCode.id },
      data: {
        verified: true,
        verifiedAt: new Date(),
      },
    });

    // Delete old codes for this user
    await prisma.emailMFACode.deleteMany({
      where: {
        userId,
        id: { not: storedCode.id },
      },
    });

    await logAuth({
      userId,
      action: 'MFA_SUCCESS',
      status: 'SUCCESS',
      ipAddress,
      metadata: { type: 'email_code' },
    });

    return { success: true };
  } catch (error) {
    console.error('[MFA] Email code verification error:', error);
    return {
      success: false,
      error: 'Verification failed',
    };
  }
}

/**
 * Record failed email MFA attempt
 */
export async function recordEmailMFAAttempt(userId: string, code: string): Promise<void> {
  try {
    const hashedCode = crypto.createHash('sha256').update(code).digest('hex');

    await prisma.emailMFACode.updateMany({
      where: {
        userId,
        code: hashedCode,
        verified: false,
      },
      data: {
        attempts: { increment: 1 },
      },
    });
  } catch (error) {
    console.error('[MFA] Failed to record email MFA attempt:', error);
  }
}

/**
 * Cleanup expired email MFA codes
 */
export async function cleanupExpiredEmailMFACodes(): Promise<number> {
  try {
    const result = await prisma.emailMFACode.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });

    log.info('Cleaned up expired email MFA codes', { count: result.count });

    return result.count;
  } catch (error) {
    console.error('[MFA] Failed to cleanup expired email codes:', error);
    return 0;
  }
}

// ============================================
// WEBAUTHN / PASSKEY STUBS
// ============================================

/**
 * Setup WebAuthn/Passkey (stub implementation)
 * In production, use @simplewebauthn/server or similar library
 */
export async function setupWebAuthnMFA(
  userId: string,
  email: string
): Promise<{ challengeId: string; challenge: string }> {
  // Generate challenge for WebAuthn registration
  const challenge = crypto.randomBytes(32).toString('base64url');

  log.info('WebAuthn setup initiated', { userId, email });

  return {
    challengeId: crypto.randomUUID(),
    challenge,
  };
}

/**
 * Verify and store WebAuthn credential (stub implementation)
 */
export async function verifyWebAuthnCredential(
  userId: string,
  credentialId: string,
  publicKey: string,
  deviceName?: string
): Promise<MFAVerificationResult> {
  try {
    await prisma.passkeyCredential.create({
      data: {
        userId,
        credentialId,
        publicKey,
        deviceName: deviceName ?? 'Unknown Device',
        transports: ['usb', 'nfc', 'ble', 'internal'],
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: { mfaEnabled: true },
    });

    await logAuth({
      userId,
      action: 'MFA_SUCCESS',
      status: 'SUCCESS',
      metadata: { type: 'webauthn_registered', deviceName },
    });

    return { success: true };
  } catch (error) {
    log.error('Failed to store WebAuthn credential', error as Error);
    return { success: false, error: 'Failed to register passkey' };
  }
}
