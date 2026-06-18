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
import type { TaxYearConfig } from '@/lib/tax-engine/types';
import type { PropertyOwner } from './propertyDisposalCgt';
import type {
  OwnershipGroupLite,
  BeneficialOverrideLite,
} from '@/lib/services/ownershipAttribution';

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
  /**
   * Phase 45 PR 2.A.1 — TSB aggregation across APRA + SMSF for the Div 296
   * regime check on salary-sacrifice. The snapshot's
   * `netWorth.assets.superannuation` field EXCLUDES SMSF member balances
   * per Phase 39.5 (no double-counting in the net-worth view, since the
   * SMSF LegalEntity's owned assets are summed separately). For the
   * **Div 296 high-balance super tax** the ATO defines TSB as the
   * individual's interest across ALL super funds (APRA + SMSF), so the
   * scenario layer needs the un-deduplicated sum.
   *
   * Callers populate this from `prisma.superannuationAccount.findMany()`
   * — every super account the user holds membership in, regardless of
   * `fundType`. Salary-sacrifice falls back to `netWorth.assets.superannuation`
   * when this is absent (back-compat for users with no SMSF).
   */
  superAccounts?: SuperAccountView[];
  /**
   * Phase 47 Stage D · D6 — per-property CGT + ownership facts so the
   * `sellProperty` lever can compute capital gains tax split across the
   * property's legal owners with the correct per-entity discount (TR 93/32 +
   * Div 115), instead of the old single-taxpayer "CGT may apply" flag.
   *
   * Populated by `/api/cfo/scenarios/run` from Prisma (the property row + its
   * `OwnershipGroup` / `BeneficialOwnershipOverride` + each owner's entity
   * type + the user's marginal rate). Absent for the AI-advisor tool path and
   * for users with no entity structure — when absent, the lever falls back to
   * the prior CGT-flag behaviour (no behaviour change).
   */
  propertyTaxContexts?: PropertyTaxContext[];
  /** Resolved tax-year config (reform commencement flags) — for the CGT gate. */
  taxConfig?: TaxYearConfig;
  /** Disposal FY string (e.g. "2026-27") — drives the §12.14 CGT reform gate. */
  currentFy?: string;
  /** The user's current marginal rate (0..1) — basis of the "your share" CGT estimate. */
  userMarginalRate?: number;
}

/**
 * Phase 47 Stage D · D6 — the per-property tax facts the `sellProperty` lever
 * needs to compute CGT. The CGT decision itself lives in
 * `lib/cfo/scenarios/propertyDisposalCgt.ts`; this is the data the route
 * hands in. `owners` are the candidate legal owners (legal owner + stake
 * holders + beneficial owner); `ownershipGroup` / `beneficialOverride` are the
 * AD-2 context that weights them.
 */
export interface PropertyTaxContext {
  propertyId: string;
  /** Acquisition cost base proxy — the property's recorded purchase price. */
  costBase: number;
  /** Acquisition date (contract date preferred — CGT event A1), ISO string. */
  acquisitionDate: string;
  /** The legal-title owner stamped on the row. */
  legalOwnerEntityId: string;
  /** Candidate owners + their entity facts (CGT-eligible type, isYou, etc). */
  owners: PropertyOwner[];
  /** The `OwnershipGroup` covering the property, if any (AD-2 weighting). */
  ownershipGroup?: OwnershipGroupLite;
  /** The `BeneficialOwnershipOverride` on the property, if any. */
  beneficialOverride?: BeneficialOverrideLite;
  /** True when a co-owner's entity type was approximated (exotic type). */
  hasApproximatedOwnerType?: boolean;
}

/**
 * Phase 45 PR 2.A.1 — per-account super view consumed by scenarios that
 * need the un-deduplicated TSB (currently: `salarySacrificeToSuper` for
 * the Div 296 H2 regime check). Mirrors `SuperInput` in `netWorthCalculator.ts`.
 */
export interface SuperAccountView {
  id: string;
  /** Display name (e.g. "AustralianSuper Member 12345"). */
  name?: string;
  /** Current balance (member-account level for SMSFs). */
  currentBalance: number;
  /** APRA-regulated (INDUSTRY/RETAIL) vs SMSF — used by the per-fund destination selector in PR 2.B. */
  fundType: 'INDUSTRY' | 'RETAIL' | 'SMSF' | null;
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
