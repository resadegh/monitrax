import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const account = await prisma.account.findUnique({
        where: { id },
        include: {
          linkedLoan: true,
          transactions: {
            orderBy: { date: 'desc' },
            take: 10,
          },
        },
      });

      if (!account || account.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      return NextResponse.json(account);
    } catch (error) {
      console.error('Get account error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const { name, type, currentBalance, interestRate } = body;

      // Verify ownership
      const existing = await prisma.account.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      const account = await prisma.account.update({
        where: { id },
        data: {
          name,
          type,
          currentBalance,
          interestRate,
        },
      });

      return NextResponse.json(account);
    } catch (error) {
      console.error('Update account error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      // Verify ownership
      const existing = await prisma.account.findUnique({
        where: { id },
      });

      if (!existing || existing.userId !== authReq.user!.userId) {
        return NextResponse.json({ error: 'Account not found' }, { status: 404 });
      }

      await prisma.account.delete({
        where: { id },
      });

      return NextResponse.json({ message: 'Account deleted successfully' });
    } catch (error) {
      console.error('Delete account error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
  });
}
