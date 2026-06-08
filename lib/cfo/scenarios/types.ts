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
import type { Decimal } from '@/lib/decimal';

export type ScenarioType =
  | 'sellProperty'
  | 'payDownLoan'
  | 'refinanceLoan'
  | 'redirectToOffset'
  | 'cutSpendCategory'
  | 'addInvestment'
  | 'salarySacrificeToSuper';

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

// =============================================================================
// Q-DEC PR 2.E.1 — Decimal sibling types
// =============================================================================

export interface ScenarioImpactDecimal {
  label: string;
  before: Decimal;
  after: Decimal;
  delta: Decimal;
  format: 'currency' | 'percent' | 'number';
  direction: 'positive' | 'negative' | 'neutral';
}

export interface ScenarioResultDecimal {
  type: ScenarioType;
  title: string;
  summary: string;
  impacts: ScenarioImpactDecimal[];
  warnings: ScenarioWarning[];
  assumptions: string[];
  computedAt: string;
}

// =============================================================================
// Phase 45 PR 1 — H1 SliderSource discriminated union
// =============================================================================

/**
 * Phase 45 PR 1 §4.1 H1 — every slider's default value MUST declare its source
 * so the user sees guess-vs-traced. Two source classes:
 *
 * - `snapshot` — value traced from the user's MasterFinancialSnapshot via the
 *   given `path` (e.g. `'income.primary.grossTotal'`, `'loanView:loanId.interestRate'`).
 *   `asOf` is the snapshot's `computedAt` ISO timestamp.
 * - `default` — industry-default constant the engine fell back to when the
 *   snapshot didn't carry the field. `rationale` explains why this number was
 *   chosen — surfaces to the user as "we don't have your specific X — using $Y
 *   as a placeholder."
 *
 * AFSL discipline: this is information-only sourcing. The UI MUST render the
 * source line beneath every slider so the user can override defaults they
 * disagree with — never silently use a default behind the user's back.
 */
export type SliderSource =
  | { kind: 'snapshot'; path: string; asOf: string }
  | { kind: 'default'; value: number; rationale: string };

// =============================================================================
// Phase 45 PR 1 — 10-year projection composer types
// =============================================================================

export interface TenYearProjectionPoint {
  year: number; // 0 = today, 1..N = years from now
  netWorth: Decimal;
  cumulativeCashflowDelta: Decimal;
  cumulativeTaxDelta: Decimal;
  superBalance?: Decimal; // only set for scenarios that touch super
}

export interface TenYearProjectionParams {
  baseNetWorth: Decimal;
  yearOneCashflowDelta: Decimal; // per year — projected over horizon
  yearOneTaxDelta: Decimal; // negative for tax savings, positive for tax paid
  baseSuperBalance?: Decimal; // optional — for sacrifice scenarios
  annualSuperContribution?: Decimal; // optional — for sacrifice scenarios
  assetGrowthRate?: number; // default 0.04 — real return on non-super assets
  superGrowthRate?: number; // default 0.06 — real net-of-fees return on super
  cashflowGrowthRate?: number; // default 0.025 — wage indexation of the cashflow delta
  years?: number; // default 10
}

export interface TenYearProjectionResult {
  baseNetWorth: Decimal;
  trajectory: TenYearProjectionPoint[]; // length = years + 1 (year 0 + years 1..N)
  finalNetWorth: Decimal;
  totalDelta: Decimal; // finalNetWorth − baseNetWorth (over projection horizon)
  assumptions: string[];
}
