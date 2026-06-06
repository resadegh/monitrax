/**
 * Phase 40 — Deterministic Scenario Engine entry point.
 *
 * Exposes a single `runScenario(type, ctx, params)` dispatcher used by
 * (a) the AI advisor's tool-call handler and (b) the
 * `/api/cfo/scenarios/run` endpoint. Pure functions only — no I/O.
 */

import { sellPropertyScenario, sellPropertyScenarioDecimal, type SellPropertyParams } from './sellProperty';
import { payDownLoanScenario, payDownLoanScenarioDecimal, type PayDownLoanParams } from './payDownLoan';
import { refinanceLoanScenario, refinanceLoanScenarioDecimal, type RefinanceLoanParams } from './refinanceLoan';
import { redirectToOffsetScenario, redirectToOffsetScenarioDecimal, type RedirectToOffsetParams } from './redirectToOffset';
import { cutSpendCategoryScenario, cutSpendCategoryScenarioDecimal, type CutSpendCategoryParams } from './cutSpendCategory';
import { addInvestmentScenario, addInvestmentScenarioDecimal, type AddInvestmentParams } from './addInvestment';
import type { ScenarioContext, ScenarioResult, ScenarioResultDecimal, ScenarioType } from './types';

export type {
  ScenarioContext,
  ScenarioResult,
  ScenarioResultDecimal,
  ScenarioType,
  ScenarioImpact,
  ScenarioImpactDecimal,
  ScenarioWarning,
  LoanView,
} from './types';

export {
  sellPropertyScenario,
  sellPropertyScenarioDecimal,
  payDownLoanScenario,
  payDownLoanScenarioDecimal,
  refinanceLoanScenario,
  refinanceLoanScenarioDecimal,
  redirectToOffsetScenario,
  redirectToOffsetScenarioDecimal,
  cutSpendCategoryScenario,
  cutSpendCategoryScenarioDecimal,
  addInvestmentScenario,
  addInvestmentScenarioDecimal,
};

export type AnyScenarioParams =
  | { type: 'sellProperty'; params: SellPropertyParams }
  | { type: 'payDownLoan'; params: PayDownLoanParams }
  | { type: 'refinanceLoan'; params: RefinanceLoanParams }
  | { type: 'redirectToOffset'; params: RedirectToOffsetParams }
  | { type: 'cutSpendCategory'; params: CutSpendCategoryParams }
  | { type: 'addInvestment'; params: AddInvestmentParams };

export function runScenario(
  ctx: ScenarioContext,
  request: AnyScenarioParams
): ScenarioResult {
  switch (request.type) {
    case 'sellProperty':
      return sellPropertyScenario(ctx, request.params);
    case 'payDownLoan':
      return payDownLoanScenario(ctx, request.params);
    case 'refinanceLoan':
      return refinanceLoanScenario(ctx, request.params);
    case 'redirectToOffset':
      return redirectToOffsetScenario(ctx, request.params);
    case 'cutSpendCategory':
      return cutSpendCategoryScenario(ctx, request.params);
    case 'addInvestment':
      return addInvestmentScenario(ctx, request.params);
    default: {
      const _exhaustive: never = request;
      throw new Error(`Unknown scenario type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

/**
 * Q-DEC PR 3.C — Decimal sibling dispatcher. Routes each scenario type
 * to its `*Decimal` sibling shipped in PR 2.E.1. The route handler /
 * AI tool consumer is the boundary that calls
 * `serializeDecimalsForJson` on the result before returning the JSON
 * response.
 */
export function runScenarioDecimal(
  ctx: ScenarioContext,
  request: AnyScenarioParams
): ScenarioResultDecimal {
  switch (request.type) {
    case 'sellProperty':
      return sellPropertyScenarioDecimal(ctx, request.params);
    case 'payDownLoan':
      return payDownLoanScenarioDecimal(ctx, request.params);
    case 'refinanceLoan':
      return refinanceLoanScenarioDecimal(ctx, request.params);
    case 'redirectToOffset':
      return redirectToOffsetScenarioDecimal(ctx, request.params);
    case 'cutSpendCategory':
      return cutSpendCategoryScenarioDecimal(ctx, request.params);
    case 'addInvestment':
      return addInvestmentScenarioDecimal(ctx, request.params);
    default: {
      const _exhaustive: never = request;
      throw new Error(`Unknown scenario type: ${JSON.stringify(_exhaustive)}`);
    }
  }
}

export const SCENARIO_TYPES: ScenarioType[] = [
  'sellProperty',
  'payDownLoan',
  'refinanceLoan',
  'redirectToOffset',
  'cutSpendCategory',
  'addInvestment',
];
