/**
 * Search Engine
 *
 * Centralized search service for Monitrax.
 * This engine handles all search operations and can be:
 * - Modified: Add new entity types, search fields, or algorithms
 * - Upgraded: Implement full-text search, fuzzy matching, or AI-powered search
 * - Reused: Used by API routes and hooks across the application
 *
 * Architecture follows 07_API_STANDARDS.md and 01_ARCHITECTURE_OVERVIEW.md
 */

import { prisma } from '@/lib/db';

// =============================================================================
// TYPES
// =============================================================================

export type SearchEntityType =
  | 'expense'
  | 'income'
  | 'property'
  | 'loan'
  | 'asset'
  | 'investment'
  | 'document'
  | 'holding';

export type SearchResultType = SearchEntityType | 'all';

export interface SearchResult {
  id: string;
  type: SearchEntityType;
  title: string;
  subtitle: string;
  meta?: Record<string, unknown>;
  url: string;
  score?: number; // For future relevance scoring
}

export interface SearchFilters {
  category?: string;
  sourceType?: string;
  type?: string;
  status?: string;
  frequency?: string;
  dateFrom?: Date;
  dateTo?: Date;
  amountMin?: number;
  amountMax?: number;
}

export interface SearchOptions {
  query: string;
  userId: string;
  entityTypes?: SearchResultType[];
  filters?: SearchFilters;
  limit?: number;
  offset?: number;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
  grouped?: Record<string, SearchResult[]>;
  meta?: {
    durationMs: number;
    filters: SearchFilters;
  };
}

// =============================================================================
// SEARCH ENGINE CLASS
// =============================================================================

class SearchEngine {
  private defaultLimit = 20;

  /**
   * Main search method - searches across all or specific entity types
   */
  async search(options: SearchOptions): Promise<SearchResponse> {
    const startTime = Date.now();
    const {
      query,
      userId,
      entityTypes = ['all'],
      filters = {},
      limit = this.defaultLimit,
      offset = 0
    } = options;

    if (!query || query.length < 2) {
      return {
        query,
        total: 0,
        results: [],
      };
    }

    const searchAll = entityTypes.includes('all');
    const results: SearchResult[] = [];

    // Execute searches in parallel for performance
    const searchPromises: Promise<void>[] = [];

    if (searchAll || entityTypes.includes('expense')) {
      searchPromises.push(this.searchExpenses(query, userId, filters, limit).then(r => results.push(...r)));
    }
    if (searchAll || entityTypes.includes('income')) {
      searchPromises.push(this.searchIncome(query, userId, filters, limit).then(r => results.push(...r)));
    }
    if (searchAll || entityTypes.includes('property')) {
      searchPromises.push(this.searchProperties(query, userId, filters, limit).then(r => results.push(...r)));
    }
    if (searchAll || entityTypes.includes('loan')) {
      searchPromises.push(this.searchLoans(query, userId, filters, limit).then(r => results.push(...r)));
    }
    if (searchAll || entityTypes.includes('asset')) {
      searchPromises.push(this.searchAssets(query, userId, filters, limit).then(r => results.push(...r)));
    }
    if (searchAll || entityTypes.includes('investment')) {
      searchPromises.push(this.searchInvestments(query, userId, filters, limit).then(r => results.push(...r)));
    }
    if (searchAll || entityTypes.includes('document')) {
      searchPromises.push(this.searchDocuments(query, userId, filters, limit).then(r => results.push(...r)));
    }

    await Promise.all(searchPromises);

    // Apply offset and limit to combined results
    const paginatedResults = results.slice(offset, offset + limit);

    // Group results by type
    const grouped: Record<string, SearchResult[]> = {
      expenses: results.filter(r => r.type === 'expense'),
      income: results.filter(r => r.type === 'income'),
      properties: results.filter(r => r.type === 'property'),
      loans: results.filter(r => r.type === 'loan'),
      assets: results.filter(r => r.type === 'asset'),
      investments: results.filter(r => r.type === 'investment' || r.type === 'holding'),
      documents: results.filter(r => r.type === 'document'),
    };

    const durationMs = Date.now() - startTime;

    return {
      query,
      total: results.length,
      results: paginatedResults,
      grouped,
      meta: {
        durationMs,
        filters,
      },
    };
  }

  // =============================================================================
  // ENTITY-SPECIFIC SEARCH METHODS
  // =============================================================================

  private async searchExpenses(
    query: string,
    userId: string,
    filters: SearchFilters,
    limit: number
  ): Promise<SearchResult[]> {
    const where: Record<string, unknown> = {
      userId,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { vendorName: { contains: query, mode: 'insensitive' } },
      ],
    };

    // Apply filters
    if (filters.category) where.category = filters.category;
    if (filters.sourceType) where.sourceType = filters.sourceType;
    if (filters.frequency) where.frequency = filters.frequency;

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        property: { select: { name: true } },
        asset: { select: { name: true } },
      },
      take: limit,
    });

    return expenses.map((expense) => ({
      id: expense.id,
      type: 'expense' as SearchEntityType,
      title: expense.name,
      subtitle: `${expense.category} • $${expense.amount}/${expense.frequency.toLowerCase()}`,
      meta: {
        category: expense.category,
        amount: expense.amount,
        frequency: expense.frequency,
        sourceType: expense.sourceType,
        linkedTo: expense.property?.name || expense.asset?.name,
      },
      url: `/dashboard/expenses?id=${expense.id}`,
    }));
  }

  private async searchIncome(
    query: string,
    userId: string,
    filters: SearchFilters,
    limit: number
  ): Promise<SearchResult[]> {
    const where: Record<string, unknown> = {
      userId,
      name: { contains: query, mode: 'insensitive' },
    };

    // Apply filters
    if (filters.type) where.type = filters.type;
    if (filters.sourceType) where.sourceType = filters.sourceType;
    if (filters.frequency) where.frequency = filters.frequency;

    const incomes = await prisma.income.findMany({
      where,
      include: {
        property: { select: { name: true } },
        investmentAccount: { select: { name: true } },
      },
      take: limit,
    });

    return incomes.map((income) => ({
      id: income.id,
      type: 'income' as SearchEntityType,
      title: income.name,
      subtitle: `${income.type} • $${income.amount}/${income.frequency.toLowerCase()}`,
      meta: {
        incomeType: income.type,
        amount: income.amount,
        frequency: income.frequency,
        sourceType: income.sourceType,
        linkedTo: income.property?.name || income.investmentAccount?.name,
      },
      url: `/dashboard/income?id=${income.id}`,
    }));
  }

  private async searchProperties(
    query: string,
    userId: string,
    filters: SearchFilters,
    limit: number
  ): Promise<SearchResult[]> {
    const where: Record<string, unknown> = {
      userId,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { address: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (filters.type) where.type = filters.type;

    const properties = await prisma.property.findMany({
      where,
      take: limit,
    });

    return properties.map((property) => ({
      id: property.id,
      type: 'property' as SearchEntityType,
      title: property.name,
      subtitle: `${property.type} • ${property.address}`,
      meta: {
        propertyType: property.type,
        currentValue: property.currentValue,
        address: property.address,
      },
      url: `/dashboard/properties/${property.id}`,
    }));
  }

  private async searchLoans(
    query: string,
    userId: string,
    filters: SearchFilters,
    limit: number
  ): Promise<SearchResult[]> {
    const where: Record<string, unknown> = {
      userId,
      name: { contains: query, mode: 'insensitive' },
    };

    if (filters.type) where.type = filters.type;

    const loans = await prisma.loan.findMany({
      where,
      include: {
        property: { select: { name: true } },
      },
      take: limit,
    });

    return loans.map((loan) => ({
      id: loan.id,
      type: 'loan' as SearchEntityType,
      title: loan.name,
      subtitle: `${loan.type} • $${loan.principal.toLocaleString()} @ ${loan.interestRateAnnual}%`,
      meta: {
        loanType: loan.type,
        principal: loan.principal,
        rate: loan.interestRateAnnual,
        rateType: loan.rateType,
        property: loan.property?.name,
      },
      url: `/dashboard/loans?id=${loan.id}`,
    }));
  }

  private async searchAssets(
    query: string,
    userId: string,
    filters: SearchFilters,
    limit: number
  ): Promise<SearchResult[]> {
    const where: Record<string, unknown> = {
      userId,
      OR: [
        { name: { contains: query, mode: 'insensitive' } },
        { vehicleRegistration: { contains: query, mode: 'insensitive' } },
        { vehicleMake: { contains: query, mode: 'insensitive' } },
        { vehicleModel: { contains: query, mode: 'insensitive' } },
        { serialNumber: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (filters.type) where.type = filters.type;
    if (filters.status) where.status = filters.status;

    const assets = await prisma.asset.findMany({
      where,
      take: limit,
    });

    return assets.map((asset) => {
      const vehicleInfo = asset.vehicleMake && asset.vehicleModel
        ? `${asset.vehicleYear || ''} ${asset.vehicleMake} ${asset.vehicleModel}`.trim()
        : null;

      return {
        id: asset.id,
        type: 'asset' as SearchEntityType,
        title: asset.name,
        subtitle: vehicleInfo || `${asset.type} • $${asset.currentValue.toLocaleString()}`,
        meta: {
          assetType: asset.type,
          status: asset.status,
          currentValue: asset.currentValue,
          registration: asset.vehicleRegistration,
        },
        url: `/dashboard/assets?id=${asset.id}`,
      };
    });
  }

  private async searchInvestments(
    query: string,
    userId: string,
    filters: SearchFilters,
    limit: number
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    // Search investment accounts
    const accounts = await prisma.investmentAccount.findMany({
      where: {
        userId,
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { platform: { contains: query, mode: 'insensitive' } },
        ],
      },
      take: limit,
    });

    accounts.forEach((account) => {
      results.push({
        id: account.id,
        type: 'investment',
        title: account.name,
        subtitle: `${account.type} • ${account.platform || 'No platform'}`,
        meta: {
          accountType: account.type,
          platform: account.platform,
        },
        url: `/dashboard/investments?account=${account.id}`,
      });
    });

    // Search holdings (tickers)
    const holdings = await prisma.investmentHolding.findMany({
      where: {
        investmentAccount: { userId },
        ticker: { contains: query, mode: 'insensitive' },
      },
      include: {
        investmentAccount: { select: { name: true } },
      },
      take: limit,
    });

    holdings.forEach((holding) => {
      results.push({
        id: holding.id,
        type: 'holding',
        title: holding.ticker,
        subtitle: `${holding.units} units @ $${holding.averagePrice} • ${holding.investmentAccount.name}`,
        meta: {
          holdingType: holding.type,
          units: holding.units,
          avgPrice: holding.averagePrice,
          account: holding.investmentAccount.name,
        },
        url: `/dashboard/investments/holdings?ticker=${holding.ticker}`,
      });
    });

    return results;
  }

  private async searchDocuments(
    query: string,
    userId: string,
    filters: SearchFilters,
    limit: number
  ): Promise<SearchResult[]> {
    const where: Record<string, unknown> = {
      userId,
      OR: [
        { filename: { contains: query, mode: 'insensitive' } },
        { originalFilename: { contains: query, mode: 'insensitive' } },
        { description: { contains: query, mode: 'insensitive' } },
        { tags: { hasSome: [query] } },
      ],
    };

    if (filters.category) where.category = filters.category;

    const documents = await prisma.document.findMany({
      where,
      take: limit,
    });

    return documents.map((doc) => ({
      id: doc.id,
      type: 'document' as SearchEntityType,
      title: doc.originalFilename,
      subtitle: `${doc.category} • ${(doc.size / 1024).toFixed(1)} KB`,
      meta: {
        category: doc.category,
        size: doc.size,
        mimeType: doc.mimeType,
        tags: doc.tags,
      },
      url: `/dashboard/documents?id=${doc.id}`,
    }));
  }

  // =============================================================================
  // UTILITY METHODS
  // =============================================================================

  /**
   * Quick search - returns limited results from all types
   * Used for command palette / quick search UI
   */
  async quickSearch(query: string, userId: string, limit = 5): Promise<SearchResponse> {
    return this.search({
      query,
      userId,
      entityTypes: ['all'],
      limit,
    });
  }

  /**
   * Search single entity type with filters
   * Used for list pages with filters
   */
  async searchEntityType(
    entityType: SearchEntityType,
    query: string,
    userId: string,
    filters: SearchFilters = {},
    limit = 50
  ): Promise<SearchResult[]> {
    const response = await this.search({
      query,
      userId,
      entityTypes: [entityType],
      filters,
      limit,
    });
    return response.results;
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

export const searchEngine = new SearchEngine();

// =============================================================================
// CONVENIENCE FUNCTIONS
// =============================================================================

export async function universalSearch(
  query: string,
  userId: string,
  limit?: number
): Promise<SearchResponse> {
  return searchEngine.search({ query, userId, limit });
}

export async function quickSearch(
  query: string,
  userId: string
): Promise<SearchResponse> {
  return searchEngine.quickSearch(query, userId);
}

export async function searchByType(
  type: SearchEntityType,
  query: string,
  userId: string,
  filters?: SearchFilters
): Promise<SearchResult[]> {
  return searchEngine.searchEntityType(type, query, userId, filters);
}
