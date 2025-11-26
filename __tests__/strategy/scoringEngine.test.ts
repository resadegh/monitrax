/**
 * Unit tests for Scoring Engine
 * Tests SBS calculation, ranking, and score explanations
 */

import {
  calculateSBS,
  rankRecommendations,
  getSBSRating,
  getPriority,
  explainScore,
  type ScoreComponents,
} from '@/lib/strategy/core/scoringEngine';

describe('SBS Scoring Engine', () => {
  describe('calculateSBS', () => {
    it('should calculate SBS score correctly with all components', () => {
      const components: ScoreComponents = {
        financialBenefit: 80,
        riskReduction: 60,
        costAvoidance: 70,
        liquidityImpact: 50,
        taxImpact: 40,
        dataConfidence: 90,
      };

      const sbs = calculateSBS(components);

      // Expected: 80*0.4 + 60*0.25 + 70*0.15 + 50*0.1 + 40*0.05 + 90*0.05
      // = 32 + 15 + 10.5 + 5 + 2 + 4.5 = 69
      expect(sbs).toBe(69);
    });

    it('should handle zero values', () => {
      const components: ScoreComponents = {
        financialBenefit: 0,
        riskReduction: 0,
        costAvoidance: 0,
        liquidityImpact: 0,
        taxImpact: 0,
        dataConfidence: 0,
      };

      const sbs = calculateSBS(components);
      expect(sbs).toBe(0);
    });

    it('should cap at 100', () => {
      const components: ScoreComponents = {
        financialBenefit: 100,
        riskReduction: 100,
        costAvoidance: 100,
        liquidityImpact: 100,
        taxImpact: 100,
        dataConfidence: 100,
      };

      const sbs = calculateSBS(components);
      expect(sbs).toBe(100);
    });

    it('should prioritize financial benefit (40% weight)', () => {
      const highFinancial: ScoreComponents = {
        financialBenefit: 100,
        riskReduction: 0,
        costAvoidance: 0,
        liquidityImpact: 0,
        taxImpact: 0,
        dataConfidence: 0,
      };

      const sbs = calculateSBS(highFinancial);
      expect(sbs).toBe(40); // 100 * 0.4
    });
  });

  describe('rankRecommendations', () => {
    it('should sort recommendations by SBS score descending', () => {
      const recommendations = [
        { id: '1', title: 'Low', sbsScore: 30 },
        { id: '2', title: 'High', sbsScore: 90 },
        { id: '3', title: 'Medium', sbsScore: 60 },
      ];

      const ranked = rankRecommendations(recommendations);

      expect(ranked[0].id).toBe('2');
      expect(ranked[1].id).toBe('3');
      expect(ranked[2].id).toBe('1');
    });

    it('should handle recommendations without scores', () => {
      const recommendations = [
        { id: '1', title: 'No score' },
        { id: '2', title: 'Has score', sbsScore: 75 },
      ];

      const ranked = rankRecommendations(recommendations);

      expect(ranked[0].id).toBe('2');
      expect(ranked[1].id).toBe('1');
    });

    it('should handle empty array', () => {
      const ranked = rankRecommendations([]);
      expect(ranked).toEqual([]);
    });
  });

  describe('getSBSRating', () => {
    it('should return CRITICAL for scores >= 80', () => {
      expect(getSBSRating(80)).toBe('CRITICAL');
      expect(getSBSRating(100)).toBe('CRITICAL');
      expect(getSBSRating(95)).toBe('CRITICAL');
    });

    it('should return HIGH for scores 60-79', () => {
      expect(getSBSRating(60)).toBe('HIGH');
      expect(getSBSRating(70)).toBe('HIGH');
      expect(getSBSRating(79)).toBe('HIGH');
    });

    it('should return MEDIUM for scores 40-59', () => {
      expect(getSBSRating(40)).toBe('MEDIUM');
      expect(getSBSRating(50)).toBe('MEDIUM');
      expect(getSBSRating(59)).toBe('MEDIUM');
    });

    it('should return LOW for scores < 40', () => {
      expect(getSBSRating(0)).toBe('LOW');
      expect(getSBSRating(20)).toBe('LOW');
      expect(getSBSRating(39)).toBe('LOW');
    });
  });

  describe('getPriority', () => {
    it('should return CRITICAL for scores >= 80', () => {
      expect(getPriority(80)).toBe('CRITICAL');
      expect(getPriority(90)).toBe('CRITICAL');
    });

    it('should return HIGH for scores 60-79', () => {
      expect(getPriority(60)).toBe('HIGH');
      expect(getPriority(75)).toBe('HIGH');
    });

    it('should return MEDIUM for scores 40-59', () => {
      expect(getPriority(40)).toBe('MEDIUM');
      expect(getPriority(55)).toBe('MEDIUM');
    });

    it('should return LOW for scores < 40', () => {
      expect(getPriority(0)).toBe('LOW');
      expect(getPriority(35)).toBe('LOW');
    });
  });

  describe('explainScore', () => {
    it('should provide detailed explanation of score', () => {
      const components: ScoreComponents = {
        financialBenefit: 80,
        riskReduction: 60,
        costAvoidance: 70,
        liquidityImpact: 50,
        taxImpact: 40,
        dataConfidence: 90,
      };

      const explanation = explainScore(components);

      expect(explanation).toContain('Financial Benefit');
      expect(explanation).toContain('Risk Reduction');
      expect(explanation).toContain('Cost Avoidance');
      expect(explanation).toContain('Liquidity Impact');
      expect(explanation).toContain('Tax Impact');
      expect(explanation).toContain('Data Confidence');
      expect(explanation).toContain('Total SBS');
    });

    it('should calculate weighted contributions', () => {
      const components: ScoreComponents = {
        financialBenefit: 100,
        riskReduction: 0,
        costAvoidance: 0,
        liquidityImpact: 0,
        taxImpact: 0,
        dataConfidence: 0,
      };

      const explanation = explainScore(components);

      expect(explanation).toContain('40.0'); // 100 * 0.4
      expect(explanation).toContain('Total SBS: 40');
    });
  });
});
