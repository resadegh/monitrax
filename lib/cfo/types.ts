/**
 * Phase 17: Personal CFO Engine Types
 * Core type definitions for the CFO Intelligence System
 */

// ============================================================================
// CFO Score Types
// ============================================================================

export interface CFOScore {
  overall: number; // 0-100
  components: CFOScoreComponents;
  trend: 'improving' | 'stable' | 'declining';
  lastCalculated: Date;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface CFOScoreComponents {
  cashflowStrength: number; // 0-100
  debtCoverage: number; // 0-100
  emergencyBuffer: number; // 0-100
  investmentDiversification: number; // 0-100
  spendingControl: number; // 0-100
  savingsRate: number; // 0-100
}

export interface CFOScoreHistory {
  date: Date;
  score: number;
  components: CFOScoreComponents;
}

// ============================================================================
// Risk Types
// ============================================================================

export type RiskTimeframe = 'short' | 'medium' | 'long';
export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface FinancialRisk {
  id: string;
  type: RiskType;
  severity: RiskSeverity;
  timeframe: RiskTimeframe;
  title: string;
  description: string;
  impact: number; // Dollar impact
  probability: number; // 0-1
  detectedAt: Date;
  expiresAt?: Date;
  relatedEntities: RiskEntity[];
  suggestedActions: string[];
}

export type RiskType =
  // Short-term risks
  | 'low_balance'
  | 'cashflow_shortfall'
  | 'expense_spike'
  | 'overdue_bill'
  | 'loan_stress'
  // Medium-term risks
  | 'debt_ratio_deterioration'
  | 'savings_trajectory'
  | 'property_underperformance'
  | 'subscription_creep'
  // Long-term risks
  | 'retirement_gap'
  | 'investment_misalignment'
  | 'mortgage_renewal'
  | 'concentration_risk';

export interface RiskEntity {
  type: 'property' | 'loan' | 'account' | 'income' | 'expense' | 'investment';
  id: string;
  name: string;
}

export interface RiskRadarOutput {
  risks: FinancialRisk[];
  summary: RiskSummary;
  lastScanned: Date;
}

export interface RiskSummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalImpact: number;
  topRisk: FinancialRisk | null;
}

// ============================================================================
// Action Types
// ============================================================================

export type ActionPriority = 'do_now' | 'upcoming' | 'consider_soon' | 'background';
export type ActionCategory =
  | 'debt'
  | 'savings'
  | 'spending'
  | 'investment'
  | 'property'
  | 'tax'
  | 'cashflow'
  | 'risk';

export interface CFOAction {
  id: string;
  priority: ActionPriority;
  category: ActionCategory;
  title: string;
  explanation: string; // Simple English
  severity: RiskSeverity;
  expectedImpact: ActionImpact;
  timeRequired: string; // e.g., "5 minutes", "1 hour"
  confidence: number; // 0-1
  supportingData: ActionEvidence[];
  relatedRisks: string[]; // Risk IDs
  createdAt: Date;
  expiresAt?: Date;
  status: 'pending' | 'dismissed' | 'completed';
}

export interface ActionImpact {
  type: 'savings' | 'risk_reduction' | 'growth' | 'optimization';
  amount: number;
  timeframe: string; // e.g., "per month", "per year", "one-time"
  description: string;
}

export interface ActionEvidence {
  type: 'metric' | 'trend' | 'comparison' | 'forecast';
  label: string;
  value: string | number;
  context?: string;
}

export interface ActionPrioritisationOutput {
  doNow: CFOAction[];
  upcoming: CFOAction[];
  considerSoon: CFOAction[];
  background: CFOAction[];
  totalActions: number;
  highestPriorityAction: CFOAction | null;
}

// ============================================================================
// CFO Dashboard Types
// ============================================================================

export interface CFODashboardData {
  score: CFOScore;
  scoreHistory: CFOScoreHistory[];
  risks: RiskRadarOutput;
  actions: ActionPrioritisationOutput;
  monthlyProgress: MonthlyProgress;
  quickStats: CFOQuickStats;
  alerts: CFOAlert[];
}

export interface MonthlyProgress {
  netWorthChange: number;
  netWorthChangePercent: number;
  savingsRate: number;
  savingsRateChange: number;
  debtReduction: number;
  topImprovements: string[];
  emergingRisks: string[];
}

export interface CFOQuickStats {
  daysUntilNextBill: number;
  projectedMonthEndBalance: number;
  unusedSubscriptions: number;
  savingsOpportunities: number;
  pendingActions: number;
}

export interface CFOAlert {
  id: string;
  type: 'warning' | 'info' | 'success' | 'critical';
  title: string;
  message: string;
  actionUrl?: string;
  createdAt: Date;
  read: boolean;
}

// ============================================================================
// Financial Plan Types
// ============================================================================

export type PlanType =
  | 'cashflow_30day'
  | 'annual_savings'
  | 'debt_reduction'
  | 'property_portfolio'
  | 'investment_allocation';

export interface FinancialPlan {
  id: string;
  type: PlanType;
  title: string;
  description: string;
  steps: PlanStep[];
  milestones: PlanMilestone[];
  projections: PlanProjection[];
  createdAt: Date;
  status: 'active' | 'paused' | 'completed';
  progress: number; // 0-100
}

export interface PlanStep {
  order: number;
  title: string;
  description: string;
  action: string;
  completed: boolean;
  dueDate?: Date;
}

export interface PlanMilestone {
  id: string;
  title: string;
  targetDate: Date;
  targetValue: number;
  currentValue: number;
  achieved: boolean;
}

export interface PlanProjection {
  date: Date;
  projectedValue: number;
  actualValue?: number;
  variance?: number;
}

// ============================================================================
// Workflow Types
// ============================================================================

export type WorkflowType =
  | 'reduce_expenses'
  | 'tax_preparation'
  | 'stabilise_cashflow'
  | 'optimise_property'
  | 'debt_restructure'
  | 'emergency_fund';

export interface CFOWorkflow {
  id: string;
  type: WorkflowType;
  title: string;
  description: string;
  targetOutcome: string;
  steps: WorkflowStep[];
  currentStep: number;
  startedAt: Date;
  completedAt?: Date;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
}

export interface WorkflowStep {
  order: number;
  title: string;
  instructions: string;
  checkItems: string[];
  completed: boolean;
  completedAt?: Date;
}

// ============================================================================
// Notification Types
// ============================================================================

export type NotificationChannel = 'push' | 'email' | 'in_app';
export type NotificationCategory =
  | 'cashflow'
  | 'deposit'
  | 'withdrawal'
  | 'income'
  | 'bill'
  | 'subscription'
  | 'overspend'
  | 'goal'
  | 'risk';

export interface CFONotification {
  id: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channels: NotificationChannel[];
  scheduledFor?: Date;
  sentAt?: Date;
  readAt?: Date;
  actionUrl?: string;
}

// ============================================================================
// Engine Configuration
// ============================================================================

export interface CFOEngineConfig {
  userId: string;
  preferences: CFOPreferences;
}

export interface CFOPreferences {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  notificationFrequency: 'realtime' | 'daily' | 'weekly';
  focusAreas: ActionCategory[];
  enabledWorkflows: WorkflowType[];
}
