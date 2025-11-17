import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { withAuth } from '@/lib/middleware';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withAuth(request, async (authReq) => {
    try {
      const { id } = await params;
      const body = await request.json();
      const { name, type, balance, interestRate } = body;

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
          balance,
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
