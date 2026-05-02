/**
 * Phase 40 — Deterministic Scenario Engine
 *
 * Pure-function "what-if" projections that mutate a snapshot in memory and
 * return the resulting deltas. The AI advisor (`lib/cfo/aiAdvisor.ts`) calls
 * these via tool calls so projected impacts stay grounded in real math —
 * the AI narrates the result, it never invents the numbers.
 *
 * Hard rule per CLAUDE.md §12.2 / §12.3: no calc duplication. Each scenario
 * composes existing primitives (`lib/utils/calculations.ts`,
 * `lib/utils/frequencies.ts`) where possible and leans on the canonical
 * `MasterFinancialSnapshot` shape for inputs.
 */

import type { MasterFinancialSnapshot } from '@/lib/services/masterFinancialService';

export type ScenarioType =
  | 'sellProperty'
  | 'payDownLoan'
  | 'refinanceLoan'
  | 'redirectToOffset'
  | 'cutSpendCategory'
  | 'addInvestment';

export interface ScenarioRequest {
  type: ScenarioType;
  params: Record<string, unknown>;
}

export interface ScenarioImpact {
  label: string;
  before: number;
  after: number;
  delta: number;
  format: 'currency' | 'percent' | 'number';
  direction: 'positive' | 'negative' | 'neutral';
}

export interface ScenarioWarning {
  severity: 'info' | 'caution' | 'critical';
  message: string;
}

export interface ScenarioResult {
  type: ScenarioType;
  title: string;
  summary: string;
  impacts: ScenarioImpact[];
  warnings: ScenarioWarning[];
  assumptions: string[];
  computedAt: string;
}

/**
 * Per-loan view used by payDownLoan / refinanceLoan / redirectToOffset.
 * The canonical snapshot only exposes aggregate debt — scenarios that touch
 * individual loans need this lightweight projection. The API route fetches
 * it from Prisma and hands it in as context.
 */
export interface LoanView {
  id: string;
  name: string;
  principal: number;
  interestRate: number; // annual, decimal (e.g. 0.0625)
  termMonths: number;
  remainingMonths: number;
  monthlyRepayment: number;
  loanType: string;
  offsetBalance: number;
}

export interface ScenarioContext {
  snapshot: MasterFinancialSnapshot;
  loans?: LoanView[];
}
