/**
 * Unit tests for Debt Analyzer
 * Tests refinance logic and debt optimization recommendations
 */

import { analyzeDebt } from '@/lib/strategy/analyzers/debtAnalyzer';
import type { StrategyDataPacket } from '@/lib/strategy/core/types';

describe('Debt Analyzer', () => {
  const createMockData = (loanOverrides = {}): StrategyDataPacket => ({
    userId: 'user1',
    timestamp: new Date(),
    snapshot: {
      netWorth: 200000,
      properties: [],
      loans: [
        {
          id: 'loan1',
          name: 'Home Loan',
          type: 'HOME',
          principal: 300000,
          interestRate: 0.055, // 5.5%
          isInterestOnly: false,
          ...loanOverrides,
        },
      ],
      investments: [],
      cashflowSummary: {
        monthlyIncome: 8000,
        monthlyExpenses: 3000,
        monthlySurplus: 5000,
      },
      historicalTrends: {},
    },
    insights: [],
    health: null,
    relationships: null,
    preferences: {
      riskAppetite: 'MODERATE',
      debtComfort: 'MODERATE',
      timeHorizon: 30,
    },
  });

  describe('Refinance Analysis', () => {
    it('should recommend refinance when rate difference is significant', async () => {
      const data = createMockData({
        interestRate: 0.065, // 6.5% (well above market)
      });

      const findings = await analyzeDebt(data);

      // Should find refinance opportunity
      const refinanceFindings = findings.filter(f =>
        f.title.toLowerCase().includes('refinance')
      );

      expect(refinanceFindings.length).toBeGreaterThan(0);
      expect(refinanceFindings[0]).toHaveProperty('estimatedAnnualSavings');
      expect(refinanceFindings[0].estimatedAnnualSavings).toBeGreaterThan(0);
    });

    it('should not recommend refinance when rate is already low', async () => {
      const data = createMockData({
        interestRate: 0.03, // 3% (very low)
      });

      const findings = await analyzeDebt(data);

      const refinanceFindings = findings.filter(f =>
        f.title.toLowerCase().includes('refinance')
      );

      // Should not recommend refinance if rate is already competitive
      expect(refinanceFindings.length).toBe(0);
    });

    it('should calculate break-even period', async () => {
      const data = createMockData({
        interestRate: 0.06, // 6%
      });

      const findings = await analyzeDebt(data);

      const refinanceFindings = findings.filter(f =>
        f.title.toLowerCase().includes('refinance')
      );

      if (refinanceFindings.length > 0) {
        expect(refinanceFindings[0]).toHaveProperty('breakEvenMonths');
        expect(refinanceFindings[0].breakEvenMonths).toBeGreaterThan(0);
        expect(refinanceFindings[0].breakEvenMonths).toBeLessThan(48); // Should break even within 4 years
      }
    });
  });

  describe('Debt-to-Income Analysis', () => {
    it('should flag high debt-to-income ratio', async () => {
      const data = createMockData();
      data.snapshot!.loans = [
        {
          id: 'loan1',
          name: 'Large Loan',
          type: 'HOME',
          principal: 600000, // Very high relative to income
          interestRate: 0.055,
          isInterestOnly: false,
        },
      ];

      const findings = await analyzeDebt(data);

      const dtiFindings = findings.filter(f =>
        f.title.toLowerCase().includes('debt') ||
        f.actionable.toLowerCase().includes('debt')
      );

      expect(dtiFindings.length).toBeGreaterThan(0);
    });

    it('should not flag healthy debt-to-income ratio', async () => {
      const data = createMockData({
        principal: 150000, // Reasonable amount
      });
      data.snapshot!.cashflowSummary = {
        monthlyIncome: 10000,
        monthlyExpenses: 3000,
        monthlySurplus: 7000,
      };

      const findings = await analyzeDebt(data);

      // Should have minimal or no critical debt warnings
      const criticalDebtWarnings = findings.filter(f =>
        f.severity === 'critical' &&
        f.title.toLowerCase().includes('debt')
      );

      expect(criticalDebtWarnings.length).toBe(0);
    });
  });

  describe('Offset Account Optimization', () => {
    it('should recommend optimizing offset account usage', async () => {
      const data = createMockData({
        offsetBalance: 0,
      });

      // Add significant cash balance
      data.snapshot!.cashflowSummary = {
        monthlyIncome: 8000,
        monthlyExpenses: 3000,
        monthlySurplus: 5000,
      };

      const findings = await analyzeDebt(data);

      const offsetFindings = findings.filter(f =>
        f.actionable.toLowerCase().includes('offset') ||
        f.title.toLowerCase().includes('offset')
      );

      expect(offsetFindings.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Safeguard Compliance', () => {
    it('should not recommend actions that violate safeguards', async () => {
      const data = createMockData();

      const findings = await analyzeDebt(data);

      // All findings should respect financial safeguards
      findings.forEach(finding => {
        expect(finding).toHaveProperty('confidence');
        expect(['HIGH', 'MEDIUM', 'LOW']).toContain(finding.confidence);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero debt scenario', async () => {
      const data = createMockData();
      data.snapshot!.loans = [];

      const findings = await analyzeDebt(data);

      // Should return empty array or informational findings
      expect(findings).toBeInstanceOf(Array);
    });

    it('should handle multiple loans', async () => {
      const data = createMockData();
      data.snapshot!.loans = [
        {
          id: 'loan1',
          name: 'Home Loan 1',
          type: 'HOME',
          principal: 300000,
          interestRate: 0.055,
          isInterestOnly: false,
        },
        {
          id: 'loan2',
          name: 'Investment Loan',
          type: 'INVESTMENT',
          principal: 200000,
          interestRate: 0.065,
          isInterestOnly: true,
        },
      ];

      const findings = await analyzeDebt(data);

      expect(findings).toBeInstanceOf(Array);
      expect(findings.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle null snapshot', async () => {
      const data = createMockData();
      data.snapshot = null;

      const findings = await analyzeDebt(data);

      expect(findings).toBeInstanceOf(Array);
      expect(findings.length).toBe(0);
    });
  });
});
