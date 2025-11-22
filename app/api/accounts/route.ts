import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';
import { extractAccountLinks, wrapWithGRDCS } from '@/lib/grdcs';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const accounts = await prisma.account.findMany({
        where: { userId: authReq.user!.userId },
        include: { linkedLoan: true },
        orderBy: { createdAt: 'desc' },
      });

      // Apply GRDCS wrapper to each account
      const accountsWithLinks = accounts.map(account => {
        const links = extractAccountLinks(account);
        return wrapWithGRDCS(account as Record<string, unknown>, 'account', links);
      });

      return NextResponse.json({
        data: accountsWithLinks,
        _meta: {
          count: accountsWithLinks.length,
          totalLinkedEntities: accountsWithLinks.reduce((sum, a) => sum + a._meta.linkedCount, 0),
        },
      });
    } catch (error) {
      console.error('Get accounts error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    try {
      const body = await request.json();
      const { name, type, institution, currentBalance } = body;

      if (!name || !type || currentBalance === undefined) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const account = await prisma.account.create({
        data: {
          userId: authReq.user!.userId,
          name,
          type,
          institution: institution || null,
          currentBalance: parseFloat(currentBalance),
        },
      });

      return NextResponse.json(account, { status: 201 });
    } catch (error) {
      console.error('Create account error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
