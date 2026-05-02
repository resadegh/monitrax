/**
 * Phase 40 — Deterministic Scenario Engine entry point.
 *
 * Exposes a single `runScenario(type, ctx, params)` dispatcher used by
 * (a) the AI advisor's tool-call handler and (b) the
 * `/api/cfo/scenarios/run` endpoint. Pure functions only — no I/O.
 */

import { sellPropertyScenario, type SellPropertyParams } from './sellProperty';
import { payDownLoanScenario, type PayDownLoanParams } from './payDownLoan';
import { refinanceLoanScenario, type RefinanceLoanParams } from './refinanceLoan';
import { redirectToOffsetScenario, type RedirectToOffsetParams } from './redirectToOffset';
import { cutSpendCategoryScenario, type CutSpendCategoryParams } from './cutSpendCategory';
import { addInvestmentScenario, type AddInvestmentParams } from './addInvestment';
import type { ScenarioContext, ScenarioResult, ScenarioType } from './types';

export type {
  ScenarioContext,
  ScenarioResult,
  ScenarioType,
  ScenarioImpact,
  ScenarioWarning,
  LoanView,
} from './types';

export {
  sellPropertyScenario,
  payDownLoanScenario,
  refinanceLoanScenario,
  redirectToOffsetScenario,
  cutSpendCategoryScenario,
  addInvestmentScenario,
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

export const SCENARIO_TYPES: ScenarioType[] = [
  'sellProperty',
  'payDownLoan',
  'refinanceLoan',
  'redirectToOffset',
  'cutSpendCategory',
  'addInvestment',
];
