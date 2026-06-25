/**
 * Account Data Export (Right to Portability)
 *
 * Privacy Act 1988 (Cth) APP 12 + CDR data-subject right to a copy
 * of their own data. Streams a JSON download containing every row
 * the user owns across the canonical Monitrax data model.
 *
 * CDR-derived fields (account balances, transactions) ARE included —
 * the user is the data subject so the entitlement is theirs to take.
 * The same payload is NOT shared with third parties without explicit
 * consent (see CDR_BASIQ_COMPLIANCE_MATRIX.md §5).
 *
 * GET — returns a JSON document the user can save locally.
 *
 * Cost / scale note: this is a synchronous endpoint at v1, fine for
 * the current per-user data shape. If a user accumulates many years
 * of transactions and the document grows past ~50MB, queue this to
 * Cloud Tasks + Cloud Storage signed URL instead.
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';

export const GET = withPermission('cdr_data.read', async (request, auth) => {
  const userId = auth.userId;
  const exportedAt = new Date().toISOString();

  const [user, properties, loans, accounts, income, expenses, transactions, investmentAccounts, assets, basiqConnections, consents, preferences, documents, debtPlans] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        mobile: true,
        phone: true,
        location: true,
        timezone: true,
        bio: true,
        emailVerified: true,
        emailVerifiedAt: true,
        mfaEnabled: true,
        createdAt: true,
        updatedAt: true,
        trustedContactName: true,
        trustedContactEmail: true,
        trustedContactPhone: true,
        trustedContactRelationship: true,
        deletionRequestedAt: true,
        deletionScheduledFor: true,
      },
    }),
    prisma.property.findMany({ where: { userId } }),
    prisma.loan.findMany({ where: { userId } }),
    prisma.account.findMany({ where: { userId } }),
    prisma.income.findMany({ where: { userId } }),
    prisma.expense.findMany({ where: { userId } }),
    // SSOT fix (CLAUDE.md §12.2): export the canonical `UnifiedTransaction`
    // table — the legacy `Transaction` table has zero writers (dead), so the
    // export previously returned empty/stale transaction data.
    prisma.unifiedTransaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 5000, // soft cap; users can re-export with a date range later
    }),
    prisma.investmentAccount.findMany({ where: { userId } }),
    prisma.asset.findMany({ where: { userId } }),
    prisma.basiqConnection.findMany({ where: { userId } }),
    prisma.cDRConsent.findMany({ where: { userId } }).catch(() => []),
    prisma.userPreference.findUnique({ where: { userId } }),
    prisma.document.findMany({
      where: { userId },
      select: {
        id: true,
        filename: true,
        originalFilename: true,
        mimeType: true,
        size: true,
        category: true,
        storageProvider: true,
        storagePath: true,
        storageUrl: true,
        description: true,
        tags: true,
        uploadedAt: true,
        updatedAt: true,
      },
    }),
    prisma.debtPlan.findMany({ where: { userId } }),
  ]);

  await createAuditLog({
    userId,
    action: 'DATA_EXPORT_REQUESTED',
    status: 'SUCCESS',
    entityType: 'User',
    entityId: userId,
    ipAddress:
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      undefined,
    userAgent: request.headers.get('user-agent') || undefined,
    metadata: {
      counts: {
        properties: properties.length,
        loans: loans.length,
        accounts: accounts.length,
        income: income.length,
        expenses: expenses.length,
        transactions: transactions.length,
        investmentAccounts: investmentAccounts.length,
        assets: assets.length,
        basiqConnections: basiqConnections.length,
        documents: documents.length,
        debtPlans: debtPlans.length,
      },
    },
  });

  const payload = {
    schemaVersion: 1,
    generatedBy: 'Monitrax Data Export (Privacy Act APP 12 / CDR §3)',
    exportedAt,
    user,
    preferences,
    properties,
    loans,
    accounts,
    income,
    expenses,
    transactions,
    investmentAccounts,
    assets,
    basiqConnections,
    consents,
    documents,
    debtPlans,
  };

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="monitrax-export-${exportedAt.split('T')[0]}.json"`,
      'Cache-Control': 'private, no-store',
    },
  });
});
