/**
 * /api/tax/private-company-benefits/[id] — Phase 44 Part 2b
 *
 * DELETE — hard-delete a Div 7A benefit record (a mistaken entry).
 *
 * SSOT: thin handler over `privateCompanyBenefitService`.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import {
  deletePrivateCompanyBenefit,
  PrivateCompanyBenefitValidationError,
} from '@/lib/services/privateCompanyBenefitService';

type RouteContext = { params: Promise<{ id: string }> };

export const DELETE = withPermission<RouteContext>(
  'tax_data.write',
  async (request: NextRequest, auth, context) => {
    const { id } = await context!.params;
    try {
      await deletePrivateCompanyBenefit(auth.userId, id, {
        ipAddress: request.headers.get('x-forwarded-for') ?? undefined,
        userAgent: request.headers.get('user-agent') ?? undefined,
      });
      return NextResponse.json({ data: { id, deleted: true } });
    } catch (error) {
      if (error instanceof PrivateCompanyBenefitValidationError) {
        return NextResponse.json(
          { error: { code: error.code, message: error.message } },
          { status: error.code === 'BENEFIT_NOT_FOUND' ? 404 : 400 },
        );
      }
      console.error('Delete private-company benefit error:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete benefit.';
      return NextResponse.json(
        { error: { code: 'BENEFIT_DELETE_FAILED', message } },
        { status: 500 },
      );
    }
  },
);
