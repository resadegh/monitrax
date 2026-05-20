import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { extractAccountLinks, wrapWithGRDCS } from '@/lib/grdcs';
import { getDefaultLegalEntityId } from '@/lib/services/legalEntityService';
import { balanceWriteFields } from '@/lib/utils/accountBalance';
import { createAuditLog } from '@/lib/security/auditLog';

export const GET = withPermission('account.read', async (request, auth) => {
    try {
      // Step 1 — fetch accounts WITHOUT the unifiedTransactions JOIN.
      //
      // Why split this out: when a JOIN target table doesn't exist in
      // the deployed database (R12 schema-drift, see CLAUDE.md §12.12),
      // Prisma's generated SQL fails the entire query — accounts and
      // all. This was making the My Accounts > Balances page show
      // empty Cash + Debt sections in production every time
      // unified_transactions hadn't been migrated.
      //
      // Splitting the queries lets the primary entity load reliably
      // and the secondary enrichment (recent transactions) degrade
      // gracefully when the table is unavailable.
      const accounts = await prisma.account.findMany({
        where: { userId: auth.userId },
        include: {
          linkedLoan: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Step 2 — try to fetch recent transactions for these accounts.
      // Best-effort: any failure here (table missing, connection blip)
      // is logged and swallowed so the accounts payload still renders.
      const accountIds = accounts.map((a) => a.id);
      const transactionsByAccountId = new Map<
        string,
        Array<{
          id: string;
          date: string;
          description: string;
          amount: number;
          type: 'CREDIT' | 'DEBIT';
          category: string | null;
        }>
      >();

      if (accountIds.length > 0) {
        try {
          // Take 50 per account by fetching ordered, then bucketing.
          // 50 × N is bounded by the user's account count — fine for
          // an account-list view. A fancier per-account top-N could be
          // a window function, but this is simpler and the rows are
          // narrow (7 selected columns).
          const recentTxs = await prisma.unifiedTransaction.findMany({
            where: {
              userId: auth.userId,
              accountId: { in: accountIds },
            },
            select: {
              id: true,
              accountId: true,
              date: true,
              description: true,
              amount: true,
              direction: true,
              categoryLevel1: true,
              merchantStandardised: true,
            },
            orderBy: { date: 'desc' },
            take: 50 * accountIds.length,
          });

          for (const tx of recentTxs) {
            const list = transactionsByAccountId.get(tx.accountId) ?? [];
            if (list.length < 50) {
              list.push({
                id: tx.id,
                date: tx.date.toISOString(),
                description: tx.merchantStandardised || tx.description,
                amount: tx.amount,
                type: tx.direction === 'IN' ? 'CREDIT' : 'DEBIT',
                category: tx.categoryLevel1,
              });
              transactionsByAccountId.set(tx.accountId, list);
            }
          }
        } catch (txError) {
          console.warn(
            'Skipping unifiedTransactions enrichment for accounts ' +
              '(table may not be migrated in this environment):',
            txError instanceof Error ? txError.message : txError
          );
        }
      }

      // Merge transactions into accounts, defaulting to []
      const accountsWithTransactions = accounts.map((account) => ({
        ...account,
        transactions: transactionsByAccountId.get(account.id) ?? [],
      }));

      // Apply GRDCS wrapper to each account
      const accountsWithLinks = accountsWithTransactions.map((account: typeof accountsWithTransactions[number]) => {
        const links = extractAccountLinks(account);
        return wrapWithGRDCS(account as Record<string, unknown>, 'account', links);
      });

      return NextResponse.json({
        data: accountsWithLinks,
        _meta: {
          count: accountsWithLinks.length,
          totalLinkedEntities: accountsWithLinks.reduce((sum: number, a: { _meta: { linkedCount: number } }) => sum + a._meta.linkedCount, 0),
        },
      });
    } catch (error) {
      console.error('Get accounts error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const POST = withPermission('account.write', async (request, auth) => {
    try {
      const body = await request.json();
      const { name, type, institution, currentBalance, interestRate, linkedLoanId } = body;

      if (!name || !type || currentBalance === undefined || currentBalance === null) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const ownerEntityId = await getDefaultLegalEntityId(auth.userId);

      // Account create + offset→loan link are atomic: if the OFFSET account
      // can't be wired to its loan the whole thing rolls back, so a retry
      // (Phase 12 Track F.3 two-way sync) can't leave a duplicate account.
      const account = await prisma.$transaction(async (tx) => {
        const created = await tx.account.create({
          data: {
            userId: auth.userId,
            ownerEntityId,
            name,
            type,
            institution: institution || null,
            currentBalance: parseFloat(currentBalance),
            interestRate:
              interestRate === undefined || interestRate === null
                ? null
                : parseFloat(interestRate),
            // PR 3c.2c — manual create path; user is source of truth.
            ...balanceWriteFields('MANUAL'),
          },
        });
        // OFFSET → loan link (Track F.3). The link lives on the loan
        // (`Loan.offsetAccountId`). Ownership-verified; a loan owned by
        // another user is simply not found and the link is skipped.
        if (type === 'OFFSET' && linkedLoanId) {
          const loan = await tx.loan.findFirst({
            where: { id: linkedLoanId, userId: auth.userId },
            select: { id: true },
          });
          if (loan) {
            await tx.loan.update({
              where: { id: loan.id },
              data: { offsetAccountId: created.id },
            });
          }
        }
        return created;
      });

      // Audit every state-changing write (CLAUDE.md §12.5 / §13.3). This
      // route is the wizard's SSOT write boundary for MANUAL accounts.
      void createAuditLog({
        userId: auth.userId,
        action: 'ACCOUNT_CREATED',
        status: 'SUCCESS',
        entityType: 'Account',
        entityId: account.id,
        metadata: { type, hasOffsetLink: type === 'OFFSET' && !!linkedLoanId },
      });

      return NextResponse.json(account, { status: 201 });
    } catch (error) {
      console.error('Create account error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
