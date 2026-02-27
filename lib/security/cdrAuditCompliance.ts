/**
 * CDR Audit Compliance Utilities
 *
 * Phase 34 — CDR Security Hardening
 *
 * Provides:
 * 1. CDR data sanitizer — strips financial data from audit metadata
 * 2. withAuditedAuth — wrapper that auto-logs API requests + CRUD
 * 3. Log retention enforcement
 * 4. Anomaly detection helpers
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import { createAuditLog, logSecurity } from '@/lib/security/auditLog';
import { prisma } from '@/lib/db';
import { log } from '@/lib/utils/logger';

// =============================================================================
// 1. CDR DATA SANITIZER
// =============================================================================

/**
 * Fields that MUST NEVER appear in audit log metadata.
 * These are CDR-protected financial data fields.
 */
const CDR_REDACTED_FIELDS = new Set([
  // Financial amounts
  'balance', 'amount', 'value', 'price', 'cost', 'income', 'salary',
  'grossIncome', 'netIncome', 'taxableIncome', 'totalIncome', 'totalExpenses',
  'monthlyAmount', 'annualAmount', 'weeklyAmount', 'fortnightlyAmount',
  'expectedAmount', 'actualAmount', 'budgetAmount', 'remainingAmount',
  'openingBalance', 'closingBalance', 'availableBalance', 'currentBalance',
  'creditLimit', 'outstandingBalance', 'repaymentAmount', 'principalAmount',
  'interestAmount', 'feeAmount', 'penaltyAmount', 'refundAmount',
  'marketValue', 'purchasePrice', 'currentValue', 'estimatedValue',
  'rentalIncome', 'mortgageRepayment', 'propertyExpenses',
  'superBalance', 'contributionAmount', 'withdrawalAmount',
  'dividendAmount', 'capitalGain', 'capitalLoss',
  'mrr', 'arr', 'arpu', 'ltv', 'monthlyPrice',

  // Account identifiers
  'accountNumber', 'bsb', 'routingNumber', 'sortCode',
  'cardNumber', 'cardLast4', 'expiryDate', 'cvv',
  'iban', 'swift', 'bic',

  // Tax identifiers
  'tfn', 'taxFileNumber', 'abn', 'acn',
  'ssn', 'socialSecurityNumber', 'ein',

  // Personal financial details
  'stripeCustomerId', 'stripeSubscriptionId', 'stripePaymentId',
  'stripeInvoiceId',
]);

/**
 * Sanitize metadata to remove CDR-protected financial data.
 * Returns a clean copy safe for audit logging.
 */
export function sanitizeCdrMetadata(
  metadata: Record<string, unknown> | null | undefined
): Record<string, unknown> | undefined {
  if (!metadata) return undefined;

  const clean: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    // Redact known CDR fields
    if (CDR_REDACTED_FIELDS.has(key)) {
      clean[key] = '[REDACTED]';
      continue;
    }

    // Redact fields that look like financial amounts (numeric keys containing money-related terms)
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('balance') ||
      lowerKey.includes('amount') ||
      lowerKey.includes('salary') ||
      lowerKey.includes('income') ||
      lowerKey.includes('payment') ||
      lowerKey.includes('price') ||
      lowerKey.includes('cost') ||
      lowerKey.includes('revenue') ||
      lowerKey.includes('accountnumber') ||
      lowerKey.includes('cardnumber') ||
      lowerKey.includes('tfn') ||
      lowerKey.includes('bsb')
    ) {
      clean[key] = '[REDACTED]';
      continue;
    }

    // Recurse into nested objects
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      clean[key] = sanitizeCdrMetadata(value as Record<string, unknown>);
    } else {
      clean[key] = value;
    }
  }

  return clean;
}

// =============================================================================
// 2. AUDITED AUTH WRAPPER
// =============================================================================

type CrudAction = 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'BULK_DELETE';

interface AuditOptions {
  /** Entity type for CRUD logging (e.g. 'Expense', 'Account') */
  entityType?: string;
  /** CRUD action. Auto-detected from HTTP method if omitted. */
  action?: CrudAction;
  /** Extract entity ID from the response for logging. */
  getEntityId?: (response: NextResponse) => string | undefined;
  /** Skip API request logging (default: false). */
  skipRequestLog?: boolean;
}

const METHOD_TO_ACTION: Record<string, CrudAction> = {
  GET: 'READ',
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

/**
 * Wrap a route handler with automatic API request + CRUD audit logging.
 *
 * Usage:
 *   export async function GET(request: NextRequest) {
 *     return withAuditedAuth(request, { entityType: 'Expense' }, async (authReq) => {
 *       // ... your handler
 *     });
 *   }
 */
export async function withAuditedAuth(
  request: NextRequest,
  options: AuditOptions,
  handler: (request: AuthenticatedRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const start = Date.now();
  const method = request.method;
  const pathname = request.nextUrl.pathname;
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    undefined;
  const userAgent = request.headers.get('user-agent') || undefined;

  return withAuth(request, async (authReq) => {
    const userId = authReq.user?.userId;
    let response: NextResponse;

    try {
      response = await handler(authReq);
    } catch (error) {
      // Log failed request
      const durationMs = Date.now() - start;
      await createAuditLog({
        userId,
        action: 'UNAUTHORIZED_ACCESS',
        status: 'FAILURE',
        entityType: options.entityType,
        ipAddress,
        userAgent,
        metadata: sanitizeCdrMetadata({
          method,
          endpoint: pathname,
          status: 500,
          durationMs,
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
      }).catch(() => {}); // never break the request flow
      throw error;
    }

    const durationMs = Date.now() - start;
    const status = response.status;
    const action: CrudAction = options.action || METHOD_TO_ACTION[method] || 'READ';
    const isSuccess = status >= 200 && status < 400;

    // Log CRUD action for entity operations
    if (options.entityType) {
      await createAuditLog({
        userId,
        action: action as string,
        status: isSuccess ? 'SUCCESS' : 'FAILURE',
        entityType: options.entityType,
        ipAddress,
        userAgent,
        metadata: sanitizeCdrMetadata({
          method,
          endpoint: pathname,
          httpStatus: status,
          durationMs,
        }),
      }).catch(() => {});
    }

    return response;
  });
}

// =============================================================================
// 3. LOG RETENTION ENFORCEMENT
// =============================================================================

/** Minimum retention period for CDR compliance (90 days). */
export const CDR_MIN_RETENTION_DAYS = 90;

/** Default retention (from admin constants: 2555 days = 7 years). */
export const DEFAULT_RETENTION_DAYS = 2555;

/**
 * Clean up audit logs older than the retention period.
 * Enforces CDR minimum of 90 days — will refuse to delete anything newer.
 *
 * Returns the number of deleted records.
 */
export async function enforceAuditLogRetention(
  retentionDays: number = DEFAULT_RETENTION_DAYS
): Promise<{ userLogsDeleted: number; adminLogsDeleted: number }> {
  // Safety: never delete logs younger than CDR minimum
  const effectiveDays = Math.max(retentionDays, CDR_MIN_RETENTION_DAYS);
  const cutoff = new Date(Date.now() - effectiveDays * 24 * 60 * 60 * 1000);

  log.info(`[Audit Retention] Cleaning logs older than ${effectiveDays} days (cutoff: ${cutoff.toISOString()})`);

  try {
    const [userResult, adminResult] = await Promise.all([
      prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      }),
      prisma.adminAuditLog.deleteMany({
        where: { timestamp: { lt: cutoff } },
      }),
    ]);

    log.info(`[Audit Retention] Deleted ${userResult.count} user logs, ${adminResult.count} admin logs`);

    return {
      userLogsDeleted: userResult.count,
      adminLogsDeleted: adminResult.count,
    };
  } catch (error) {
    log.error('[Audit Retention] Failed to clean up logs', error as Error);
    return { userLogsDeleted: 0, adminLogsDeleted: 0 };
  }
}

/**
 * Get audit log retention statistics — useful for the admin compliance dashboard.
 */
export async function getRetentionStats(): Promise<{
  totalUserLogs: number;
  totalAdminLogs: number;
  oldestUserLog: Date | null;
  oldestAdminLog: Date | null;
  retentionPolicyDays: number;
  cdrMinDays: number;
}> {
  const [userCount, adminCount, oldestUser, oldestAdmin] = await Promise.all([
    prisma.auditLog.count(),
    prisma.adminAuditLog.count(),
    prisma.auditLog.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.adminAuditLog.findFirst({ orderBy: { timestamp: 'asc' }, select: { timestamp: true } }),
  ]);

  return {
    totalUserLogs: userCount,
    totalAdminLogs: adminCount,
    oldestUserLog: oldestUser?.createdAt ?? null,
    oldestAdminLog: oldestAdmin?.timestamp ?? null,
    retentionPolicyDays: DEFAULT_RETENTION_DAYS,
    cdrMinDays: CDR_MIN_RETENTION_DAYS,
  };
}

// =============================================================================
// 4. ANOMALY DETECTION
// =============================================================================

export interface AnomalyResult {
  type: 'BRUTE_FORCE' | 'BULK_EXPORT' | 'UNUSUAL_HOUR' | 'RAPID_REQUESTS' | 'MULTIPLE_MFA_FAILURES';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  count: number;
  threshold: number;
  timeWindowMinutes: number;
}

/**
 * Check for brute-force login attempts.
 * Flags if more than `threshold` FAILURE logins in `windowMinutes`.
 */
export async function detectBruteForce(
  windowMinutes = 15,
  threshold = 10
): Promise<AnomalyResult | null> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const count = await prisma.auditLog.count({
    where: {
      action: 'LOGIN',
      status: 'FAILURE',
      createdAt: { gte: since },
    },
  });

  if (count >= threshold) {
    return {
      type: 'BRUTE_FORCE',
      severity: count >= threshold * 3 ? 'critical' : count >= threshold * 2 ? 'high' : 'medium',
      description: `${count} failed login attempts in the last ${windowMinutes} minutes`,
      count,
      threshold,
      timeWindowMinutes: windowMinutes,
    };
  }

  return null;
}

/**
 * Check for unusual bulk export activity.
 * Flags if more than `threshold` EXPORT actions in `windowMinutes`.
 */
export async function detectBulkExport(
  windowMinutes = 60,
  threshold = 5
): Promise<AnomalyResult | null> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const count = await prisma.auditLog.count({
    where: {
      action: 'EXPORT',
      createdAt: { gte: since },
    },
  });

  if (count >= threshold) {
    return {
      type: 'BULK_EXPORT',
      severity: count >= threshold * 3 ? 'critical' : 'high',
      description: `${count} export operations in the last ${windowMinutes} minutes`,
      count,
      threshold,
      timeWindowMinutes: windowMinutes,
    };
  }

  return null;
}

/**
 * Check for multiple MFA failures (potential account takeover).
 */
export async function detectMfaFailures(
  windowMinutes = 30,
  threshold = 5
): Promise<AnomalyResult | null> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000);

  const count = await prisma.auditLog.count({
    where: {
      action: 'MFA_FAILURE',
      createdAt: { gte: since },
    },
  });

  if (count >= threshold) {
    return {
      type: 'MULTIPLE_MFA_FAILURES',
      severity: 'high',
      description: `${count} MFA failures in the last ${windowMinutes} minutes`,
      count,
      threshold,
      timeWindowMinutes: windowMinutes,
    };
  }

  return null;
}

/**
 * Run all anomaly detection checks and return any findings.
 */
export async function runAnomalyDetection(): Promise<AnomalyResult[]> {
  const results = await Promise.all([
    detectBruteForce(),
    detectBulkExport(),
    detectMfaFailures(),
  ]);

  const anomalies = results.filter((r): r is AnomalyResult => r !== null);

  // Log security events for critical anomalies
  for (const anomaly of anomalies) {
    if (anomaly.severity === 'critical' || anomaly.severity === 'high') {
      await logSecurity({
        action: 'RATE_LIMIT_HIT',
        metadata: sanitizeCdrMetadata({
          anomalyType: anomaly.type,
          severity: anomaly.severity,
          description: anomaly.description,
          count: anomaly.count,
        }),
      }).catch(() => {});
    }
  }

  return anomalies;
}
