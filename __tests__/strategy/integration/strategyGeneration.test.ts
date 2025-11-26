/**
 * Integration tests for Strategy Generation
 * Tests full flow: Data Collection → Analysis → Synthesis
 */

import { generateStrategies } from '@/lib/strategy';
import { collectStrategyData, validateDataCompleteness } from '@/lib/strategy/core/dataCollector';

// Mock the database and external dependencies
jest.mock('@/lib/db', () => ({
  __esModule: true,
  default: {
    property: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'prop1',
          userId: 'user1',
          address: '123 Main St',
          propertyType: 'HOME',
          currentValue: 500000,
          purchasePrice: 400000,
          purchaseDate: new Date('2020-01-01'),
        },
      ]),
    },
    loan: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'loan1',
          userId: 'user1',
          lender: 'Bank ABC',
          loanType: 'HOME',
          currentBalance: 300000,
          interestRate: 5.5,
          isInterestOnly: false,
          propertyId: 'prop1',
        },
      ]),
    },
    bankAccount: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'acc1',
          userId: 'user1',
          accountName: 'Savings',
          accountType: 'SAVINGS',
          currentBalance: 20000,
        },
      ]),
    },
    income: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'inc1',
          userId: 'user1',
          source: 'Salary',
          incomeType: 'SALARY',
          amount: 8000,
          frequency: 'MONTHLY',
        },
      ]),
    },
    expense: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'exp1',
          userId: 'user1',
          category: 'Living',
          amount: 3000,
          frequency: 'MONTHLY',
        },
      ]),
    },
    investment: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    portfolioSnapshot: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    globalHealthReport: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    strategySession: {
      findFirst: jest.fn().mockResolvedValue({
        riskAppetite: 'MODERATE',
        debtComfort: 'MODERATE',
        investmentStyle: 'BALANCED',
        timeHorizon: 30,
        retirementAge: 65,
      }),
    },
    strategyRecommendation: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  },
}));

describe('Strategy Generation Integration', () => {
  const mockUserId = 'user1';

  describe('Data Collection Layer', () => {
    it('should collect data from all sources', async () => {
      const dataPacket = await collectStrategyData(mockUserId);

      expect(dataPacket).toBeDefined();
      expect(dataPacket.userId).toBe(mockUserId);
      expect(dataPacket.snapshot).toBeDefined();
      expect(dataPacket.preferences).toBeDefined();
    });

    it('should validate data completeness', () => {
      const quality = validateDataCompleteness({
        hasSnapshot: true,
        hasInsights: false,
        hasHealth: false,
        hasRelationships: false,
        hasPreferences: true,
        snapshotAge: 1,
        insightsCount: 0,
      });

      expect(quality).toBeDefined();
      expect(quality.overallScore).toBeGreaterThan(0);
      expect(quality.canProceed).toBeDefined();
    });
  });

  describe('Full Strategy Generation Flow', () => {
    it('should generate strategies without errors', async () => {
      const result = await generateStrategies({
        userId: mockUserId,
        forceRefresh: true,
      });

      expect(result).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.dataQuality).toBeDefined();
      expect(result.findingsCount).toBeGreaterThanOrEqual(0);
    });

    it('should handle limited mode gracefully', async () => {
      const result = await generateStrategies({
        userId: mockUserId,
        forceRefresh: false,
      });

      expect(result).toBeDefined();
      expect(result.errors).toBeInstanceOf(Array);
    });

    it('should track execution time', async () => {
      const result = await generateStrategies({
        userId: mockUserId,
        forceRefresh: true,
      });

      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should return data quality metrics', async () => {
      const result = await generateStrategies({
        userId: mockUserId,
        forceRefresh: true,
      });

      expect(result.dataQuality).toHaveProperty('overallScore');
      expect(result.dataQuality).toHaveProperty('canProceed');
      expect(result.dataQuality).toHaveProperty('warnings');
    });
  });

  describe('Error Handling', () => {
    it('should handle missing user gracefully', async () => {
      const result = await generateStrategies({
        userId: 'nonexistent',
        forceRefresh: true,
      });

      expect(result).toBeDefined();
      expect(result.recommendations).toBeInstanceOf(Array);
    });

    it('should capture errors in error array', async () => {
      const result = await generateStrategies({
        userId: mockUserId,
        forceRefresh: true,
      });

      expect(result.errors).toBeInstanceOf(Array);
    });
  });
});
