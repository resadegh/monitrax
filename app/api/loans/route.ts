import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { verifyRelatedOwnership } from '@/lib/utils/ownership';
import { extractLoanLinks, wrapWithGRDCS } from '@/lib/grdcs';
import {
  applyOwnershipSelection,
  OwnershipSelectionError,
  resolveOwnershipForCreate,
} from '@/lib/services/ownershipSelectionService';
import { createAuditLog } from '@/lib/security/auditLog';

export const GET = withPermission('loan.read', async (request, auth) => {
    try {
      const userId = auth.userId;

      // Fetch the loans first as the primary entity. Splitting this
      // out from the unifiedTransactions enrichment below means a
      // failure on the secondary query (e.g. unified_transactions
      // table missing in the deployed DB, R12 schema-drift per
      // CLAUDE.md §12.12) doesn't take down the whole endpoint and
      // strand the My Accounts > Balances Debt section with empty
      // data. Cf. /api/accounts/route.ts which uses the same pattern.
      const loans = await prisma.loan.findMany({
        where: { userId },
        include: {
          property: true,
          offsetAccount: true,
          linkedAsset: true,      // For CAR loans
          linkedAccount: true,    // For LINE_OF_CREDIT
          expenses: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Best-effort: fetch linked transactions for repayment averages.
      // Any failure here (table missing, connection blip on a cold
      // start) is logged and swallowed so loans still render with
      // null actuals and the section stays visible.
      let linkedTransactions: Array<{
        id: string;
        date: Date;
        amount: number;
        direction: 'IN' | 'OUT';
        loanId: string | null;
      }> = [];
      try {
        linkedTransactions = await prisma.unifiedTransaction.findMany({
          where: {
            userId,
            loanId: { not: null },
          },
          select: {
            id: true,
            date: true,
            amount: true,
            direction: true,
            loanId: true,
          },
          orderBy: { date: 'desc' },
        });
      } catch (txError) {
        console.warn(
          'Skipping unifiedTransactions enrichment for loans ' +
            '(table may not be migrated in this environment, or a ' +
            'transient connection error):',
          txError instanceof Error ? txError.message : txError
        );
      }

      // Group transactions by loanId and calculate totals
      // Track current month vs all-time for display
      const now = new Date();
      const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

      const actualsByLoanId = new Map<string, {
        totalAmount: number;
        totalCount: number;
        currentMonthAmount: number;
        currentMonthCount: number;
        transactions: Array<{ date: Date; amount: number }>;
      }>();

      for (const tx of linkedTransactions) {
        if (tx.loanId) {
          const existing = actualsByLoanId.get(tx.loanId) || {
            totalAmount: 0,
            totalCount: 0,
            currentMonthAmount: 0,
            currentMonthCount: 0,
            transactions: [],
          };
          const txAmount = Math.abs(tx.amount);
          const txDate = new Date(tx.date);

          existing.totalAmount += txAmount;
          existing.totalCount += 1;
          existing.transactions.push({ date: txDate, amount: txAmount });

          // Track current month separately
          if (txDate >= currentMonthStart) {
            existing.currentMonthAmount += txAmount;
            existing.currentMonthCount += 1;
          }

          actualsByLoanId.set(tx.loanId, existing);
        }
      }

      // Apply GRDCS wrapper to each loan and add actuals
      const loansWithLinks = loans.map((loan: typeof loans[number]) => {
        const links = extractLoanLinks(loan);
        const wrapped = wrapWithGRDCS(loan as Record<string, unknown>, 'loan', links);

        // Add actual repayments from linked transactions
        const actuals = actualsByLoanId.get(loan.id);

        // Calculate monthly average from transactions using DAYS-BASED approach
        // Important for variable rate loans where repayments fluctuate
        let monthlyAverage = null;
        if (actuals && actuals.transactions.length >= 2) {
          const sortedTx = actuals.transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
          const firstDate = sortedTx[0].date;
          const lastDate = sortedTx[sortedTx.length - 1].date;
          const daysCovered = Math.max(1, (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));

          // Add one payment interval to account for period the last payment covers
          const avgPaymentInterval = daysCovered / (sortedTx.length - 1);
          const totalDaysCovered = daysCovered + avgPaymentInterval;

          // Monthly average = (sum / days) * 30.44 (average days per month)
          monthlyAverage = (actuals.totalAmount / totalDaysCovered) * 30.44;
        } else if (actuals && actuals.transactions.length === 1) {
          // Single transaction - use as monthly estimate
          monthlyAverage = actuals.totalAmount;
        }

        return {
          ...wrapped,
          // Budget = minRepayment (what user entered as expected repayment)
          budgetAmount: loan.minRepayment,
          // Actual = total from ALL linked transactions
          actualFromTransactions: actuals ? actuals.totalAmount : null,
          // Current month actual
          currentMonthActual: actuals ? actuals.currentMonthAmount : null,
          // Monthly average calculated from transaction history
          monthlyAverageActual: monthlyAverage ? Math.round(monthlyAverage * 100) / 100 : null,
          transactionCount: actuals ? actuals.totalCount : 0,
          currentMonthTransactionCount: actuals ? actuals.currentMonthCount : 0,
          hasTransactions: actuals !== undefined && actuals.totalCount > 0,
        };
      });

      return NextResponse.json({
        data: loansWithLinks,
        _meta: {
          count: loansWithLinks.length,
          totalLinkedEntities: loansWithLinks.reduce((sum: number, l: { _meta: { linkedCount: number } }) => sum + l._meta.linkedCount, 0),
          currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM format
        },
      });
    } catch (error) {
      console.error('Get loans error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});

export const POST = withPermission('loan.write', async (request, auth) => {
    try {
      const body = await request.json();
      const {
        name,
        type,
        propertyId,
        offsetAccountId,
        linkedAssetId,
        linkedAccountId,
        principal,
        interestRateAnnual,
        rateType,
        fixedExpiry,
        isInterestOnly,
        termMonthsRemaining,
        minRepayment,
        repaymentFrequency,
        extraRepaymentCap,
      } = body;

      // `termMonthsRemaining` / `minRepayment` are validated as "present",
      // not "truthy" — 0 is a legitimate value (e.g. a not-yet-known
      // repayment). The wizard's two-way sync (Track F.2) can send 0.
      if (
        !name ||
        !type ||
        principal === undefined ||
        principal === null ||
        interestRateAnnual === undefined ||
        interestRateAnnual === null ||
        !rateType ||
        termMonthsRemaining === undefined ||
        termMonthsRemaining === null ||
        minRepayment === undefined ||
        minRepayment === null ||
        !repaymentFrequency
      ) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }

      // Validate ownership of related entities using centralized utility
      if (propertyId) {
        const property = await prisma.property.findUnique({ where: { id: propertyId } });
        const result = verifyRelatedOwnership(property, auth.userId, 'Property');
        if (!result.success) return result.response;
      }

      if (offsetAccountId) {
        const account = await prisma.account.findUnique({ where: { id: offsetAccountId } });
        const result = verifyRelatedOwnership(account, auth.userId, 'Offset account');
        if (!result.success) return result.response;
      }

      // Validate linked asset (for CAR loans)
      if (linkedAssetId) {
        const asset = await prisma.asset.findUnique({ where: { id: linkedAssetId } });
        const result = verifyRelatedOwnership(asset, auth.userId, 'Asset');
        if (!result.success) return result.response;
      }

      // Validate linked account (for LINE_OF_CREDIT)
      if (linkedAccountId) {
        const account = await prisma.account.findUnique({ where: { id: linkedAccountId } });
        const result = verifyRelatedOwnership(account, auth.userId, 'Linked account');
        if (!result.success) return result.response;
      }

      // Phase 47 Stage A — ownership selection. Absent payload = sole.
      let ownershipSelection;
      let ownerEntityId: string;
      try {
        const resolved = await resolveOwnershipForCreate(auth.userId, body.ownership);
        ownershipSelection = resolved.selection;
        ownerEntityId = resolved.ownerEntityId;
      } catch (err) {
        if (err instanceof OwnershipSelectionError) {
          return NextResponse.json(
            { error: { code: err.code, message: err.message } },
            { status: err.code === 'ENTITY_NOT_FOUND' ? 404 : 400 },
          );
        }
        throw err;
      }

      const loan = await prisma.loan.create({
        data: {
          userId: auth.userId,
          ownerEntityId,
          name,
          type,
          propertyId: propertyId || null,
          offsetAccountId: offsetAccountId || null,
          linkedAssetId: linkedAssetId || null,
          linkedAccountId: linkedAccountId || null,
          principal: parseFloat(principal),
          interestRateAnnual: parseFloat(interestRateAnnual),
          rateType,
          fixedExpiry: fixedExpiry ? new Date(fixedExpiry) : null,
          isInterestOnly: Boolean(isInterestOnly),
          termMonthsRemaining: parseInt(termMonthsRemaining),
          minRepayment: parseFloat(minRepayment),
          repaymentFrequency,
          extraRepaymentCap: extraRepaymentCap ? parseFloat(extraRepaymentCap) : null,
        },
      });

      // Phase 47 Stage A — joint/shared create the OwnershipGroup (§4A).
      let ownershipWarnings: string[] = [];
      if (ownershipSelection && (ownershipSelection.mode === 'joint' || ownershipSelection.mode === 'shared')) {
        try {
          const applied = await applyOwnershipSelection(
            auth.userId,
            'loan',
            loan.id,
            ownershipSelection,
          );
          ownershipWarnings = applied?.warnings ?? [];
        } catch (err) {
          console.error('Ownership selection apply failed:', err);
          ownershipWarnings = [
            'The loan was saved, but recording the co-ownership failed — you can set it again later.',
          ];
        }
      }

      // Audit every state-changing write (CLAUDE.md §12.5). This route is a
      // wizard SSOT write boundary for property mortgages (Phase 12 Track
      // F.2). Generic CREATE action with entityType — F.4 (debts) owns the
      // loan domain and may introduce domain-specific actions later. No
      // CDR/financial values in metadata (§13.3).
      void createAuditLog({
        userId: auth.userId,
        action: 'CREATE',
        status: 'SUCCESS',
        entityType: 'Loan',
        entityId: loan.id,
        metadata: { type, hasProperty: !!propertyId, ownershipMode: ownershipSelection?.mode ?? 'sole' },
      });

      return NextResponse.json(
        ownershipWarnings.length > 0 ? { ...loan, _meta: { ownershipWarnings } } : loan,
        { status: 201 },
      );
    } catch (error) {
      console.error('Create loan error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
});
