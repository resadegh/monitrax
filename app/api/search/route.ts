/**
 * Universal Search API
 * GET /api/search?q=query&type=all|expenses|income|properties|loans|assets|investments|documents
 *
 * Uses the centralized Search Engine from lib/search/searchEngine.ts
 * This engine can be modified, upgraded, and reused across the application.
 *
 * @see lib/search/searchEngine.ts for the search implementation
 * @see docs/blueprint/07_API_STANDARDS.md for API standards
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, AuthenticatedRequest } from '@/lib/middleware';
import {
  searchEngine,
  SearchEntityType,
  SearchFilters,
} from '@/lib/search/searchEngine';

const TYPE_MAP: Record<string, SearchEntityType | 'all'> = {
  all: 'all',
  expenses: 'expense',
  expense: 'expense',
  income: 'income',
  properties: 'property',
  property: 'property',
  loans: 'loan',
  loan: 'loan',
  assets: 'asset',
  asset: 'asset',
  investments: 'investment',
  investment: 'investment',
  documents: 'document',
  document: 'document',
  holdings: 'holding',
  holding: 'holding',
};

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq: AuthenticatedRequest) => {
    try {
      const userId = authReq.user!.userId;
      const { searchParams } = new URL(request.url);

      // Parse query parameters
      const query = searchParams.get('q') || '';
      const typeParam = searchParams.get('type') || 'all';
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = parseInt(searchParams.get('offset') || '0');

      // Parse filters from query params
      const filters: SearchFilters = {};
      if (searchParams.get('category')) filters.category = searchParams.get('category')!;
      if (searchParams.get('sourceType')) filters.sourceType = searchParams.get('sourceType')!;
      if (searchParams.get('status')) filters.status = searchParams.get('status')!;
      if (searchParams.get('frequency')) filters.frequency = searchParams.get('frequency')!;

      // Map type parameter to entity types
      const entityTypes: (SearchEntityType | 'all')[] = typeParam === 'all'
        ? ['all']
        : [TYPE_MAP[typeParam] || 'all'];

      // Execute search using the search engine
      const response = await searchEngine.search({
        query,
        userId,
        entityTypes,
        filters,
        limit,
        offset,
      });

      // Format response to match API standards
      return NextResponse.json({
        success: true,
        data: {
          query: response.query,
          type: typeParam,
          total: response.total,
          results: typeParam !== 'all' ? response.results : undefined,
          grouped: typeParam === 'all' ? response.grouped : undefined,
        },
        meta: {
          timestamp: new Date().toISOString(),
          durationMs: response.meta?.durationMs,
        },
      });
    } catch (error) {
      console.error('Search error:', error);
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'SERVER_ERROR',
            message: 'Search failed',
          },
        },
        { status: 500 }
      );
    }
  });
}
