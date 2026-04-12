/**
 * Documents Entities API
 * GET /api/documents/entities - Get all user entities for folder tree
 */

import { NextResponse } from 'next/server';
import { withPermission } from '@/lib/auth/guards';
import { getAllUserEntities } from '@/lib/documents/entityLookup';

export const GET = withPermission('report.read', async (request, auth) => {
  try {
    const entities = await getAllUserEntities(auth.userId);

    return NextResponse.json(entities);
  } catch (error) {
    console.error('Get entities error:', error);
    return NextResponse.json(
      { error: 'Failed to get entities' },
      { status: 500 }
    );
  }
});
