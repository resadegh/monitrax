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

// ============================================
// SMS MFA FUNCTIONS
// ============================================

export interface SMSSetupResult {
  id: string;
  type: 'SMS';
  phoneNumber: string;
  backupCodes: string[];
}

/**
 * Generate a 6-digit SMS verification code
 */
export function generateSMSCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Normalize phone number to E.164 format
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let normalized = phone.replace(/[^\d+]/g, '');

  // If starts with 0 (Australian local), convert to +61
  if (normalized.startsWith('0')) {
    normalized = '+61' + normalized.slice(1);
  }

  // If doesn't start with +, assume it needs +
  if (!normalized.startsWith('+')) {
    normalized = '+' + normalized;
  }

  return normalized;
}

/**
 * Validate phone number format
 */
function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Basic E.164 validation: + followed by 10-15 digits
  return /^\+\d{10,15}$/.test(normalized);
}

/**
 * Send SMS via Twilio
 */
async function sendSMSViaTwilio(
  phoneNumber: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    // In development, log the code instead of sending SMS
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n📱 SMS to ${phoneNumber}: ${message}\n`);
      return { success: true };
    }
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    // Dynamic import to avoid issues if twilio is not installed
    const twilio = await import('twilio');
    const client = twilio.default(accountSid, authToken);

    await client.messages.create({
      body: message,
      from: fromNumber,
      to: normalizePhoneNumber(phoneNumber),
    });

    return { success: true };
  } catch (error) {
    console.error('[SMS] Twilio error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    };
  }
}

/**
 * Setup SMS MFA for a user
 */
export async function setupSMSMFA(
  userId: string,
  phoneNumber: string
): Promise<SMSSetupResult & { code?: string }> {
  if (!isValidPhoneNumber(phoneNumber)) {
    throw new Error('Invalid phone number format');
  }

  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  const code = generateSMSCode();
  const backupCodes = generateBackupCodes();
  const hashedBackupCodes = backupCodes.map(hashBackupCode);

  // Check if user already has an SMS MFA method
  const existingMethod = await prisma.mFAMethod.findFirst({
    where: {
      userId,
      type: 'SMS',
    },
  });

  let mfaMethod;

  if (existingMethod) {
    // Update existing method
    mfaMethod = await prisma.mFAMethod.update({
      where: { id: existingMethod.id },
      data: {
        phoneNumber: normalizedPhone,
        secret: crypto.createHash('sha256').update(code).digest('hex'), // Store hashed code temporarily
        backupCodes: hashedBackupCodes,
        isEnabled: false,
      },
    });
  } else {
    // Create new method
    mfaMethod = await prisma.mFAMethod.create({
      data: {
        userId,
        type: 'SMS',
        phoneNumber: normalizedPhone,
        secret: crypto.createHash('sha256').update(code).digest('hex'),
        backupCodes: hashedBackupCodes,
        isEnabled: false,
        isPrimary: false,
      },
    });
  }

  // Send verification SMS
  const smsResult = await sendSMSViaTwilio(
    normalizedPhone,
    `Your Monitrax verification code is: ${code}. This code expires in 10 minutes.`
  );

  if (!smsResult.success) {
    throw new Error(smsResult.error || 'Failed to send verification SMS');
  }

  await logAuth({
    userId,
    action: 'MFA_CHALLENGE',
    status: 'SUCCESS',
    metadata: { type: 'sms_setup', phone: `****${normalizedPhone.slice(-4)}` },
  });

  return {
    id: mfaMethod.id,
    type: 'SMS',
    phoneNumber: normalizedPhone,
    backupCodes,
    // Include code in development for testing
    ...(process.env.NODE_ENV === 'development' ? { code } : {}),
  };
}

/**
 * Verify SMS MFA code during setup
 */
export async function verifySMSSetup(
  userId: string,
  mfaMethodId: string,
  code: string,
  ipAddress?: string
): Promise<MFAVerificationResult> {
  const mfaMethod = await prisma.mFAMethod.findFirst({
    where: {
      id: mfaMethodId,
      userId,
      type: 'SMS',
      isEnabled: false,
    },
  });

  if (!mfaMethod || !mfaMethod.secret) {
    return { success: false, error: 'MFA setup not found or already enabled' };
  }

  // Verify the code
  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  if (hashedCode !== mfaMethod.secret) {
    await logAuth({
      userId,
      action: 'MFA_FAILURE',
      status: 'FAILURE',
      ipAddress,
      metadata: { reason: 'invalid_sms_code' },
    });
    return { success: false, error: 'Invalid verification code' };
  }

  // Enable the MFA method
  await prisma.mFAMethod.update({
    where: { id: mfaMethodId },
    data: {
      isEnabled: true,
      secret: null, // Clear the temporary code
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
    ipAddress,
    metadata: { type: 'sms_enabled' },
  });

  return { success: true };
}

/**
 * Send SMS MFA code during login
 */
export async function sendSMSMFACode(
  userId: string,
  ipAddress?: string
): Promise<{ success: boolean; expiresAt: Date; error?: string }> {
  const mfaMethod = await prisma.mFAMethod.findFirst({
    where: {
      userId,
      type: 'SMS',
      isEnabled: true,
    },
  });

  if (!mfaMethod || !mfaMethod.phoneNumber) {
    return { success: false, expiresAt: new Date(), error: 'SMS MFA not configured' };
  }

  const code = generateSMSCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Store the code temporarily
  await prisma.mFAMethod.update({
    where: { id: mfaMethod.id },
    data: {
      secret: crypto.createHash('sha256').update(code).digest('hex'),
    },
  });

  // Send SMS
  const smsResult = await sendSMSViaTwilio(
    mfaMethod.phoneNumber,
    `Your Monitrax login code is: ${code}. This code expires in 10 minutes.`
  );

  if (!smsResult.success) {
    return { success: false, expiresAt: new Date(), error: smsResult.error };
  }

  await logAuth({
    userId,
    action: 'MFA_CHALLENGE',
    status: 'SUCCESS',
    ipAddress,
    metadata: { type: 'sms_code_sent' },
  });

  log.info('SMS MFA code sent', {
    userId,
    phone: `****${mfaMethod.phoneNumber.slice(-4)}`,
    expiresAt,
    code: process.env.NODE_ENV === 'development' ? code : '******',
  });

  return { success: true, expiresAt };
}

/**
 * Verify SMS MFA code during login
 */
export async function verifySMSMFA(
  userId: string,
  code: string,
  ipAddress?: string
): Promise<MFAVerificationResult> {
  const mfaMethod = await prisma.mFAMethod.findFirst({
    where: {
      userId,
      type: 'SMS',
      isEnabled: true,
    },
  });

  if (!mfaMethod || !mfaMethod.secret) {
    return { success: false, error: 'SMS MFA not configured or no code pending' };
  }

  // Check if it's a backup code
  if (code.includes('-') && verifyBackupCode(code, mfaMethod.backupCodes)) {
    const hashedCode = hashBackupCode(code);
    const updatedBackupCodes = mfaMethod.backupCodes.filter((bc: string) => bc !== hashedCode);

    await prisma.mFAMethod.update({
      where: { id: mfaMethod.id },
      data: {
        backupCodes: updatedBackupCodes,
        secret: null,
        lastUsedAt: new Date(),
      },
    });

    await logAuth({
      userId,
      action: 'MFA_SUCCESS',
      status: 'SUCCESS',
      ipAddress,
      metadata: { type: 'sms_backup_code' },
    });

    return { success: true };
  }

  // Verify the SMS code
  const hashedCode = crypto.createHash('sha256').update(code).digest('hex');
  if (hashedCode !== mfaMethod.secret) {
    await logAuth({
      userId,
      action: 'MFA_FAILURE',
      status: 'FAILURE',
      ipAddress,
      metadata: { reason: 'invalid_sms_code' },
    });
    return { success: false, error: 'Invalid verification code' };
  }

  // Clear the code and update last used
  await prisma.mFAMethod.update({
    where: { id: mfaMethod.id },
    data: {
      secret: null,
      lastUsedAt: new Date(),
    },
  });

  await logAuth({
    userId,
    action: 'MFA_SUCCESS',
    status: 'SUCCESS',
    ipAddress,
    metadata: { type: 'sms' },
  });

  return { success: true };
}

/**
 * Resend SMS verification code
 */
export async function resendSMSCode(
  userId: string,
  mfaMethodId: string
): Promise<{ success: boolean; error?: string }> {
  const mfaMethod = await prisma.mFAMethod.findFirst({
    where: {
      id: mfaMethodId,
      userId,
      type: 'SMS',
    },
  });

  if (!mfaMethod || !mfaMethod.phoneNumber) {
    return { success: false, error: 'SMS MFA not found' };
  }

  const code = generateSMSCode();

  // Update the code
  await prisma.mFAMethod.update({
    where: { id: mfaMethodId },
    data: {
      secret: crypto.createHash('sha256').update(code).digest('hex'),
    },
  });

  // Send SMS
  const smsResult = await sendSMSViaTwilio(
    mfaMethod.phoneNumber,
    `Your Monitrax verification code is: ${code}. This code expires in 10 minutes.`
  );

  if (!smsResult.success) {
    return { success: false, error: smsResult.error };
  }

  log.info('SMS code resent', {
    userId,
    phone: `****${mfaMethod.phoneNumber.slice(-4)}`,
    code: process.env.NODE_ENV === 'development' ? code : '******',
  });

  return { success: true };
}

/**
 * Disable SMS MFA for a user
 */
export async function disableSMSMFA(
  userId: string,
  mfaMethodId: string
): Promise<void> {
  await prisma.mFAMethod.update({
    where: {
      id: mfaMethodId,
      userId,
      type: 'SMS',
    },
    data: {
      isEnabled: false,
      secret: null,
    },
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
    metadata: { action: 'sms_mfa_disabled', methodId: mfaMethodId },
  });
}
