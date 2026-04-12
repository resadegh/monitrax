/**
 * CDR Data Lifecycle Service
 * Phase 35: Consent-driven CDR data management
 *
 * Canonical service for CDR data deletion, anonymization, and consent lifecycle.
 * Basiq §5.4: CDR data deleted when no longer required
 * Basiq §5.5: CDR data deleted when consent expired
 * Basiq §5.6: CDR data deleted when consent revoked
 *
 * CLAUDE.md §12.2: Single Source of Truth for CDR data lifecycle operations
 * CLAUDE.md §13.2: Consent lifecycle — no consent = no data access
 */

import { prisma } from '@/lib/db';
import { log } from '@/lib/utils/logger';
import { createAuditLog } from '@/lib/security/auditLog';
import { sanitizeCdrMetadata } from '@/lib/security/cdrAuditCompliance';
import { deleteConnection as deleteBasiqConnection } from '@/lib/basiq';

// ============================================
// TYPES
// ============================================

export interface CDRDeletionResult {
  userId: string;
  reason: 'consent_expired' | 'consent_revoked' | 'user_requested' | 'retention_policy';
  deletedAccounts: number;
  deletedTransactions: number;
  deletedConnections: number;
  timestamp: string;
}

export interface ConsentExpiryResult {
  processedClients: number;
  deletionsTriggered: number;
  errors: string[];
  timestamp: string;
}

export interface AnonymizationResult {
  userId: string;
  anonymizedAccounts: number;
  anonymizedTransactions: number;
  timestamp: string;
}

// ============================================
// CDR DATA DELETION
// ============================================

/**
 * Hard-delete all CDR data for a user.
 * CDR data = Basiq-sourced accounts, transactions, and connections.
 *
 * This is irreversible per CDR rules (CLAUDE.md §13.2).
 * Every deletion is audited via createAuditLog().
 *
 * @param userId - The user whose CDR data to delete
 * @param reason - Why the data is being deleted
 */
export async function deleteCDRData(
  userId: string,
  reason: CDRDeletionResult['reason']
): Promise<CDRDeletionResult> {
  const timestamp = new Date().toISOString();

  log.info('CDR data deletion started', { userId, reason });

  // Fix: G15 — Call Basiq API to delete connections before local deletion.
  // This ensures CDR data is purged from Basiq's systems too.
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { basiqUserId: true },
  });

  if (user?.basiqUserId) {
    const connections = await prisma.basiqConnection.findMany({
      where: { userId, status: 'ACTIVE' },
      select: { basiqConnectionId: true },
    });

    for (const conn of connections) {
      try {
        await deleteBasiqConnection(user.basiqUserId, conn.basiqConnectionId);
      } catch (basiqError) {
        // Log but continue — local deletion must proceed even if Basiq API fails
        log.warn('Failed to delete Basiq connection via API', {
          userId,
          connectionId: conn.basiqConnectionId,
          error: basiqError instanceof Error ? basiqError.message : 'Unknown',
        });
      }
    }
  }

  // Fix: G26 — Find Basiq-linked account IDs to delete associated RecurringPayments
  const basiqAccountIds = (await prisma.account.findMany({
    where: { userId, basiqAccountId: { not: null } },
    select: { id: true },
  })).map(a => a.id);

  // Fix: G22 — Wrap all delete operations in prisma.$transaction for atomicity.
  // Prevents partial deletion leaving CDR data in an inconsistent state.
  const [deletedRecurringPayments, deletedTransactions, deletedAccounts, deletedConnections] =
    await prisma.$transaction([
      // Fix: G26 — Delete RecurringPayments linked to Basiq-sourced accounts (CDR-derived data)
      prisma.recurringPayment.deleteMany({
        where: { userId, accountId: { in: basiqAccountIds } },
      }),
      // 1. Delete Basiq-sourced transactions (UnifiedTransaction with source=BANK)
      prisma.unifiedTransaction.deleteMany({
        where: { userId, source: 'BANK' },
      }),
      // 2. Delete Basiq-linked accounts (accounts with a basiqAccountId)
      prisma.account.deleteMany({
        where: { userId, basiqAccountId: { not: null } },
      }),
      // 3. Delete Basiq connections
      prisma.basiqConnection.deleteMany({
        where: { userId },
      }),
    ]);

  // 4. Clear Basiq user reference from user profile
  await prisma.user.update({
    where: { id: userId },
    data: { basiqUserId: null },
  });

  const result: CDRDeletionResult = {
    userId,
    reason,
    deletedAccounts: deletedAccounts.count,
    deletedTransactions: deletedTransactions.count,
    deletedConnections: deletedConnections.count,
    timestamp,
  };

  // 5. Audit the deletion (fire-and-forget, CDR metadata sanitized)
  createAuditLog({
    userId,
    action: 'CDR_DATA_DELETED',
    status: 'SUCCESS',
    entityType: 'CDRData',
    metadata: sanitizeCdrMetadata({
      reason,
      deletedAccounts: deletedAccounts.count,
      deletedTransactions: deletedTransactions.count,
      deletedRecurringPayments: deletedRecurringPayments.count,
      deletedConnections: deletedConnections.count,
    }),
  }).catch(() => {});

  log.info('CDR data deletion completed', {
    userId,
    reason,
    accounts: deletedAccounts.count,
    transactions: deletedTransactions.count,
    recurringPayments: deletedRecurringPayments.count,
    connections: deletedConnections.count,
  });

  return result;
}

// ============================================
// CONSENT EXPIRY CHECK
// ============================================

/**
 * Find all expired consents and trigger CDR data deletion.
 * Designed to be called by GCP Cloud Scheduler daily.
 *
 * Basiq §5.5: CDR data deleted when consent expired
 */
export async function checkConsentExpiry(): Promise<ConsentExpiryResult> {
  const now = new Date();
  const errors: string[] = [];
  let deletionsTriggered = 0;

  log.info('Consent expiry check started');

  // Find all organization clients with expired consents that haven't been processed
  const expiredClients = await prisma.organizationClient.findMany({
    where: {
      consentStatus: 'GRANTED',
      consentExpiresAt: {
        lte: now,
      },
    },
    select: {
      id: true,
      userId: true,
      organizationId: true,
      consentExpiresAt: true,
    },
  });

  for (const client of expiredClients) {
    try {
      // Mark consent as expired
      await prisma.organizationClient.update({
        where: { id: client.id },
        data: {
          consentStatus: 'EXPIRED',
        },
      });

      // Audit the consent expiry
      createAuditLog({
        userId: client.userId,
        organizationId: client.organizationId,
        action: 'CDR_CONSENT_EXPIRED',
        status: 'SUCCESS',
        entityType: 'OrganizationClient',
        entityId: client.id,
        metadata: sanitizeCdrMetadata({
          consentExpiresAt: client.consentExpiresAt?.toISOString(),
          processedAt: now.toISOString(),
        }),
      }).catch(() => {});

      // Check if this user has any remaining active consents
      const activeConsents = await prisma.organizationClient.count({
        where: {
          userId: client.userId,
          consentStatus: 'GRANTED',
          id: { not: client.id },
        },
      });

      // If no active consents remain, delete CDR data
      if (activeConsents === 0) {
        await deleteCDRData(client.userId, 'consent_expired');
        deletionsTriggered++;
      }
    } catch (error) {
      const msg = `Failed to process expired consent for client ${client.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      log.error(msg);
      errors.push(msg);
    }
  }

  // Fix: G25 — Also check direct BasiqConnection expiry for non-org users.
  // Direct users (not org clients) have consent tracked via BasiqConnection.consentExpiresAt.
  const expiredConnections = await prisma.basiqConnection.findMany({
    where: {
      status: 'ACTIVE',
      consentExpiresAt: {
        lte: now,
        not: null,
      },
    },
    select: {
      id: true,
      userId: true,
      basiqConnectionId: true,
      consentExpiresAt: true,
    },
  });

  // Group by userId to avoid deleting data for users who still have other active connections
  const expiredByUser = new Map<string, string[]>();
  for (const conn of expiredConnections) {
    const list = expiredByUser.get(conn.userId) || [];
    list.push(conn.id);
    expiredByUser.set(conn.userId, list);
  }

  for (const [expiredUserId, connectionIds] of expiredByUser) {
    try {
      // Mark expired connections as DISABLED
      await prisma.basiqConnection.updateMany({
        where: { id: { in: connectionIds } },
        data: { status: 'DISABLED' },
      });

      // Audit each expired connection
      for (const connId of connectionIds) {
        createAuditLog({
          userId: expiredUserId,
          action: 'CDR_CONSENT_EXPIRED',
          status: 'SUCCESS',
          entityType: 'BasiqConnection',
          entityId: connId,
          metadata: sanitizeCdrMetadata({ processedAt: now.toISOString() }),
        }).catch(() => {});
      }

      // Check if user has ANY remaining active connections or org consents
      const [remainingConnections, remainingOrgConsents] = await Promise.all([
        prisma.basiqConnection.count({
          where: { userId: expiredUserId, status: 'ACTIVE' },
        }),
        prisma.organizationClient.count({
          where: { userId: expiredUserId, consentStatus: 'GRANTED' },
        }),
      ]);

      if (remainingConnections === 0 && remainingOrgConsents === 0) {
        await deleteCDRData(expiredUserId, 'consent_expired');
        deletionsTriggered++;
      }
    } catch (error) {
      const msg = `Failed to process expired BasiqConnection for user ${expiredUserId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      log.error(msg);
      errors.push(msg);
    }
  }

  const result: ConsentExpiryResult = {
    processedClients: expiredClients.length + expiredConnections.length,
    deletionsTriggered,
    errors,
    timestamp: now.toISOString(),
  };

  log.info('Consent expiry check completed', {
    orgClientsProcessed: expiredClients.length,
    connectionsProcessed: expiredConnections.length,
    deletions: deletionsTriggered,
    errors: errors.length,
  });

  return result;
}

// ============================================
// CONSENT REVOCATION HANDLER
// ============================================

/**
 * Handle consent revocation — immediate CDR data purge.
 * Called when a user revokes consent via the portal.
 *
 * Basiq §5.6: CDR data deleted when consent revoked (within 24 hours)
 *
 * @param userId - The user revoking consent
 * @param organizationClientId - The specific consent being revoked
 */
export async function handleConsentRevocation(
  userId: string,
  organizationClientId: string
): Promise<CDRDeletionResult> {
  log.info('Consent revocation processing', { userId, organizationClientId });

  // 1. Mark consent as revoked
  await prisma.organizationClient.update({
    where: { id: organizationClientId },
    data: {
      consentStatus: 'REVOKED',
      consentRevokedAt: new Date(),
    },
  });

  // 2. Audit the revocation
  createAuditLog({
    userId,
    action: 'CDR_CONSENT_REVOKED',
    status: 'SUCCESS',
    entityType: 'OrganizationClient',
    entityId: organizationClientId,
    metadata: sanitizeCdrMetadata({
      revokedAt: new Date().toISOString(),
    }),
  }).catch(() => {});

  // 3. Check if any active consents remain for this user
  const activeConsents = await prisma.organizationClient.count({
    where: {
      userId,
      consentStatus: 'GRANTED',
    },
  });

  // 4. If no active consents remain, delete all CDR data
  if (activeConsents === 0) {
    return deleteCDRData(userId, 'consent_revoked');
  }

  // Return empty result if other consents still active
  return {
    userId,
    reason: 'consent_revoked',
    deletedAccounts: 0,
    deletedTransactions: 0,
    deletedConnections: 0,
    timestamp: new Date().toISOString(),
  };
}

// ============================================
// CDR DATA ANONYMIZATION
// ============================================

/**
 * Anonymize CDR data for legal retention cases.
 * Strips PII from financial records while preserving aggregate data.
 *
 * Use when CDR data must be retained (e.g., loan applications)
 * but consent has expired/been revoked.
 *
 * Basiq §5.2: CDR data retained in de-identified format
 * Basiq §5.8: Legal retention requirements
 */
export async function anonymizeCDRData(userId: string): Promise<AnonymizationResult> {
  const timestamp = new Date().toISOString();

  log.info('CDR data anonymization started', { userId });

  // 1. Anonymize Basiq-linked accounts — strip PII
  const basiqAccounts = await prisma.account.findMany({
    where: {
      userId,
      basiqAccountId: { not: null },
    },
    select: { id: true },
  });

  for (const account of basiqAccounts) {
    await prisma.account.update({
      where: { id: account.id },
      data: {
        name: 'ANONYMIZED',
        accountNumber: null,
        bsb: null,
        basiqAccountId: null,
        basiqConnectionId: null,
      },
    });
  }

  // 2. Anonymize Basiq-sourced transactions — strip merchant/description PII
  // Fix: G24 — Also strip amount field (combined with dates, could be re-identifying)
  // Fix: G30 — Strip Basiq-enriched category fields (reveal spending patterns)
  const anonymizedTransactions = await prisma.unifiedTransaction.updateMany({
    where: {
      userId,
      source: 'BANK',
    },
    data: {
      merchantRaw: 'ANONYMIZED',
      merchantStandardised: null,
      description: 'ANONYMIZED',
      amount: 0, // G24: Strip financial amount to prevent re-identification
      categoryLevel1: null, // G30: Strip Basiq-enriched categories
      categoryLevel2: null, // G30: Strip Basiq-enriched categories
      externalId: null,
      basiqTransactionId: null,
    },
  });

  // 3. Delete Basiq connections (no retention value)
  await prisma.basiqConnection.deleteMany({
    where: { userId },
  });

  // 4. Clear Basiq user reference
  await prisma.user.update({
    where: { id: userId },
    data: { basiqUserId: null },
  });

  // 5. Audit the anonymization
  createAuditLog({
    userId,
    action: 'CDR_DATA_ANONYMIZED',
    status: 'SUCCESS',
    entityType: 'CDRData',
    metadata: sanitizeCdrMetadata({
      anonymizedAccounts: basiqAccounts.length,
      anonymizedTransactions: anonymizedTransactions.count,
    }),
  }).catch(() => {});

  log.info('CDR data anonymization completed', {
    userId,
    accounts: basiqAccounts.length,
    transactions: anonymizedTransactions.count,
  });

  return {
    userId,
    anonymizedAccounts: basiqAccounts.length,
    anonymizedTransactions: anonymizedTransactions.count,
    timestamp,
  };
}

// ============================================
// CONSENT STATUS QUERY
// ============================================

/**
 * Check if a user has active consent for CDR data access.
 * Used by withActiveConsent() guard.
 *
 * For individual users (not org clients), the existence of
 * active BasiqConnections implies consent.
 */
export async function hasActiveCDRConsent(userId: string): Promise<boolean> {
  // Fix G33: Parallelize both queries and use count() which is faster than findFirst().
  // This halves the time (~50ms → ~25ms) and reduces total DB round-trips.
  const now = new Date();
  const [activeConnections, activeOrgConsents] = await Promise.all([
    prisma.basiqConnection.count({
      where: { userId, status: 'ACTIVE' },
    }),
    prisma.organizationClient.count({
      where: {
        userId,
        consentStatus: 'GRANTED',
        OR: [
          { consentExpiresAt: null },
          { consentExpiresAt: { gt: now } },
        ],
      },
    }),
  ]);
  return activeConnections > 0 || activeOrgConsents > 0;
}

/**
 * Get CDR data summary for a user (for consent management UI).
 * Returns counts only — never raw CDR data.
 */
export async function getCDRDataSummary(userId: string): Promise<{
  hasBasiqConnection: boolean;
  activeConnections: number;
  basiqAccounts: number;
  basiqTransactions: number;
  hasActiveConsent: boolean;
}> {
  const [connections, accounts, transactions] = await Promise.all([
    prisma.basiqConnection.count({
      where: { userId, status: 'ACTIVE' },
    }),
    prisma.account.count({
      where: { userId, basiqAccountId: { not: null } },
    }),
    prisma.unifiedTransaction.count({
      where: { userId, source: 'BANK' },
    }),
  ]);

  const consent = await hasActiveCDRConsent(userId);

  return {
    hasBasiqConnection: connections > 0,
    activeConnections: connections,
    basiqAccounts: accounts,
    basiqTransactions: transactions,
    hasActiveConsent: consent,
  };
}
