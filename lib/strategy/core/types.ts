/**
 * STRATEGY ENGINE TYPE DEFINITIONS
 * Phase 11 - Stage 1
 *
 * Core TypeScript interfaces and types for the Strategy Engine.
 * All data structures used across analyzers, synthesizers, and forecasting.
 */

// =============================================================================
// DATA COLLECTION TYPES
// =============================================================================

export interface StrategyDataPacket {
  userId: string;
  snapshot: SnapshotData | null;
  insights: Insight[];
  health: HealthMetrics | null;
  relationships: RelationalGraph | null;
  preferences: UserPreferences | null;
  timestamp: Date;
}

export interface SnapshotData {
  netWorth: number;
  properties: any[];  // TODO: Define proper types
  loans: any[];
  investments: any[];
  cashflowSummary: any;
  historicalTrends: any;
}

export interface Insight {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
}

export interface HealthMetrics {
  orphans: string[];
  missingLinks: string[];
  consistencyScore: number;
  moduleHealth: Record<string, number>;
}

export interface RelationalGraph {
  entities: any[];
  relationships: any[];
}

export interface UserPreferences {
  riskAppetite?: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE';
  timeHorizon?: number;
  debtComfort?: 'DEBT_AVERSE' | 'MODERATE' | 'LEVERAGE_COMFORTABLE';
  investmentStyle?: 'PASSIVE' | 'BALANCED' | 'ACTIVE';
  retirementAge?: number;
}

// =============================================================================
// DATA QUALITY TYPES
// =============================================================================

export interface DataQualityReport {
  overallScore: number;           // 0-100
  completeness: {
    snapshot: number;              // 0-100
    insights: number;
    health: number;
    relationships: number;
    preferences: number;
  };
  dataAge: {
    oldestTransaction: Date | null;
    lastSync: Date | null;
  };
  missingCritical: string[];       // Critical missing data
  recommendations: string[];        // What to improve
}

// =============================================================================
// ANALYSIS TYPES
// =============================================================================

export interface AnalysisResult {
  analyzer: string;
  findings: Finding[];
  executionTime: number;
  errors: string[];
}

export interface Finding {
  id: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impactScore: ImpactScore;
  evidence: any;
  suggestedAction: string;
}

export interface ImpactScore {
  financial: number;      // 0-100
  risk: number;           // 0-100
  liquidity: number;      // 0-100
  tax: number;            // 0-100
  confidence: number;     // 0-100
}

// =============================================================================
// SCORING TYPES
// =============================================================================

export interface ScoreComponents {
  financialBenefit: number;    // 0-100
  riskReduction: number;       // 0-100
  costAvoidance: number;       // 0-100
  liquidityImpact: number;     // 0-100
  taxImpact: number;           // 0-100
  dataConfidence: number;      // 0-100
}

// =============================================================================
// EXPLAINABILITY TYPES
// =============================================================================

export interface EvidenceGraph {
  dataPoints: {
    source: string;
    value: any;
    timestamp: Date;
  }[];
  historicalTrend: {
    metric: string;
    values: { date: Date; value: number }[];
  }[];
  snapshotValues: Record<string, any>;
  insightFlags: string[];
  healthIssues: string[];
  calculations: Record<string, number>;
}

export interface ReasoningTrace {
  steps: {
    step: number;
    description: string;
    calculation?: string;
    result: any;
  }[];
  businessRule: string;
  thresholdsApplied: Record<string, number>;
  alternativesConsidered: string[];
}

// =============================================================================
// FORECAST TYPES
// =============================================================================

export interface ForecastAssumptions {
  incomeGrowthRate: number;
  expenseInflation: number;
  investmentReturn: number;
  rentalYield: number;
  cpiProjection: number;
}

export interface YearlyProjection {
  year: number;
  netWorth: number;
  debt: number;
  cashflow: number;
  income: number;
  expenses: number;
  investments: number;
  properties: number;
}

export interface RetirementAnalysis {
  yearsToRetirement: number;
  requiredNetWorth: number;
  monthlySavingsRequired: number;
  achievementProbability: number;
  shortfallOrSurplus: number;
}

// =============================================================================
// CONFLICT TYPES
// =============================================================================

export interface ConflictGroup {
  id: string;
  type: 'mutually_exclusive' | 'competing_priority';
  recommendations: any[];  // TODO: Define Recommendation type
  tradeoffAnalysis: {
    option: any;
    pros: string[];
    cons: string[];
    financialImpact: number;
  }[];
  suggestedResolution: string;
}
