/**
 * Documents Entities API
 * GET /api/documents/entities - Get all user entities for folder tree
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getAllUserEntities } from '@/lib/documents/entityLookup';

export async function GET(request: NextRequest) {
  try {
    // Authenticate
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const payload = await verifyToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const entities = await getAllUserEntities(payload.userId);

    return NextResponse.json(entities);
  } catch (error) {
    console.error('Get entities error:', error);
    return NextResponse.json(
      { error: 'Failed to get entities' },
      { status: 500 }
    );
  }
}
