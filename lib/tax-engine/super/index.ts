/**
 * Phase 20: Superannuation Module
 * Public exports
 */

// Contribution calculator
export {
  calculateSuperGuarantee,
  calculateSuperContributions,
  calculateDivision293Tax,
  calculateCoContribution,
  calculateSpouseContributionOffset,
  getSuperContributionSummary,
  type SuperContributionInput,
  type SuperContributionResult,
} from './contributionCalculator';

// Cap tracking
export {
  calculateCarryForward,
  calculateBringForward,
  trackContributionCaps,
  getOptimalContributionStrategy,
  getConcessionalCap,
  getNonConcessionalCap,
  type CapTrackingInput,
  type CapTrackingResult,
} from './capTracker';
