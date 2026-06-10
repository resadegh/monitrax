import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withPermission } from '@/lib/auth/guards';
import { z } from 'zod';
import { extractInvestmentAccountLinks, wrapWithGRDCS } from '@/lib/grdcs';
import {
  applyOwnershipSelection,
  OwnershipSelectionError,
  resolveOwnershipForCreate,
} from '@/lib/services/ownershipSelectionService';
import { createAuditLog } from '@/lib/security/auditLog';

const createAccountSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['BROKERAGE', 'SUPERS', 'FUND', 'TRUST', 'ETF_CRYPTO']),
  platform: z.string().optional(),
  currency: z.string().default('AUD'),
  // Phase 23: Balance tracking fields
  openingDate: z.string().datetime().optional(),
  openingBalance: z.number().min(0).default(0),
  cashBalance: z.number().default(0),
  totalDeposits: z.number().min(0).default(0),
  totalWithdrawals: z.number().min(0).default(0),
  costBasisMethod: z.enum(['FIFO', 'LIFO', 'HIFO', 'SPECIFIC', 'AVERAGE']).default('FIFO'),
});

export const GET = withPermission('investment.read', async (request, auth) => {
  try {
    const accounts = await prisma.investmentAccount.findMany({
      where: { userId: auth.userId },
      include: {
        holdings: true,
        transactions: {
          orderBy: { date: 'desc' },
          take: 10,
        },
        incomes: true,
        expenses: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Apply GRDCS wrapper to each investment account
    const accountsWithLinks = accounts.map((account: typeof accounts[number]) => {
      const links = extractInvestmentAccountLinks(account);
      return wrapWithGRDCS(account as Record<string, unknown>, 'investmentAccount', links);
    });

    return NextResponse.json({
      data: accountsWithLinks,
      _meta: {
        count: accountsWithLinks.length,
        totalLinkedEntities: accountsWithLinks.reduce((sum: number, a: { _meta: { linkedCount: number } }) => sum + a._meta.linkedCount, 0),
      },
    });
  } catch (error) {
    console.error('Get investment accounts error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});

export const POST = withPermission('investment.write', async (request, auth) => {
  try {
    const body = await request.json();
    const validation = createAccountSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const {
      name, type, platform, currency,
      openingDate, openingBalance, cashBalance,
      totalDeposits, totalWithdrawals, costBasisMethod
    } = validation.data;

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

    const account = await prisma.investmentAccount.create({
      data: {
        userId: auth.userId,
        ownerEntityId,
        name,
        type,
        platform: platform || null,
        currency: currency || 'AUD',
        openingDate: openingDate ? new Date(openingDate) : null,
        openingBalance: openingBalance || 0,
        cashBalance: cashBalance || 0,
        totalDeposits: totalDeposits || 0,
        totalWithdrawals: totalWithdrawals || 0,
        costBasisMethod: costBasisMethod || 'FIFO',
      },
    });

    // Phase 47 Stage A — joint/shared create the OwnershipGroup (§4A).
    let ownershipWarnings: string[] = [];
    if (ownershipSelection && (ownershipSelection.mode === 'joint' || ownershipSelection.mode === 'shared')) {
      try {
        const applied = await applyOwnershipSelection(
          auth.userId,
          'investmentAccount',
          account.id,
          ownershipSelection,
        );
        ownershipWarnings = applied?.warnings ?? [];
      } catch (err) {
        console.error('Ownership selection apply failed:', err);
        ownershipWarnings = [
          'The account was saved, but recording the co-ownership failed — you can set it again later.',
        ];
      }
    }

    // Audit every state-changing write (CLAUDE.md §12.5). This route is the
    // wizard's SSOT write boundary for investment accounts (Track F.5). No
    // CDR/financial values in metadata (§13.3) — type only.
    void createAuditLog({
      userId: auth.userId,
      action: 'INVESTMENT_CREATED',
      status: 'SUCCESS',
      entityType: 'InvestmentAccount',
      entityId: account.id,
      metadata: { type, ownershipMode: ownershipSelection?.mode ?? 'sole' },
    });

    return NextResponse.json(
      ownershipWarnings.length > 0 ? { ...account, _meta: { ownershipWarnings } } : account,
      { status: 201 },
    );
  } catch (error) {
    console.error('Create investment account error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
