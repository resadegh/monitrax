/**
 * Q-DEC PR 2.A — `netWorthCalculator` shadow comparison adapter.
 *
 * Registers the Float and Decimal `calculateNetWorth*` pair against
 * the shadow harness. This is the proof-of-pattern for PR 2.B/C/D/E
 * — every other engine in `lib/calculations/`, `lib/cashflow/`,
 * `lib/tax-engine/`, and `lib/cfo/` adopts the same shape:
 *   - `floatExecute` calls the legacy `number`-returning function
 *   - `decimalExecute` calls the new `Decimal`-returning function
 *   - `fixtures` provide hand-verified inputs (NOT outputs — outputs
 *     are compared between paths, not against a hard-coded expectation
 *     here; the Float path's own Phase 41I fixtures provide the
 *     ground-truth assertion check)
 *
 * Why the fixtures don't carry expected outputs: the shadow harness
 * already produces a diff against the Float path. If the Float path
 * itself is wrong, the existing Phase 41I `calcAudit` fixture catches
 * it. Decoupling these concerns is intentional — one PR's harness
 * checks one thing.
 */

import {
  calculateNetWorth,
  calculateNetWorthDecimal,
  type AccountInput,
  type AssetInput,
  type InvestmentInput,
  type LoanInput,
  type PropertyInput,
  type SuperInput,
} from '@/lib/calculations/netWorthCalculator';
import type { ShadowEngine } from '@/lib/calc-audit/shadowComparison';

interface NetWorthInput {
  properties: PropertyInput[];
  accounts: AccountInput[];
  investments: InvestmentInput[];
  loans: LoanInput[];
  superannuation?: SuperInput[];
  personalAssets?: AssetInput[];
}

export const netWorthShadowEngine: ShadowEngine<
  NetWorthInput,
  ReturnType<typeof calculateNetWorth>,
  ReturnType<typeof calculateNetWorthDecimal>
> = {
  name: 'core.netWorth.shadow',
  description: 'Shadow-compare Float vs Decimal net-worth path (Q-DEC PR 2.A proof).',
  sourcePath: 'lib/calculations/netWorthCalculator.ts',
  floatExecute: (input) =>
    calculateNetWorth(
      input.properties,
      input.accounts,
      input.investments,
      input.loans,
      input.superannuation ?? [],
      input.personalAssets ?? [],
    ),
  decimalExecute: (input) =>
    calculateNetWorthDecimal(
      input.properties,
      input.accounts,
      input.investments,
      input.loans,
      input.superannuation ?? [],
      input.personalAssets ?? [],
    ),
  // All result fields are currency — net worth, totals, breakdown values.
  fieldPolicy: {},
  fixtures: [
    {
      name: 'empty portfolio',
      description: 'Zero assets, zero liabilities — every field should be 0.',
      input: {
        properties: [],
        accounts: [],
        investments: [],
        loans: [],
      },
    },
    {
      name: 'single home + mortgage',
      description: 'Classic owner-occupier: $850k home, $620k mortgage, $42k offset.',
      input: {
        properties: [{ currentValue: 850000, type: 'HOME' }],
        accounts: [{ currentBalance: 42000, type: 'OFFSET' }],
        investments: [],
        loans: [{ principal: 620000, type: 'HOME' }],
      },
    },
    {
      name: 'mass-affluent integration-debt persona',
      description:
        'Phase 45 ICP — home + IP + super + investments + offset. Numbers near round to expose Float subtractions.',
      input: {
        properties: [
          { currentValue: 1245678.99, type: 'HOME' },
          { currentValue: 712345.55, type: 'INVESTMENT' },
        ],
        accounts: [
          { currentBalance: 87654.33, type: 'OFFSET' },
          { currentBalance: 12345.67, type: 'SAVINGS' },
        ],
        investments: [
          { units: 1234.5678, currentPrice: 187.32 },
          { units: 567.89, currentPrice: 412.55 },
        ],
        loans: [
          { principal: 743210.11, type: 'HOME' },
          { principal: 543210.99, type: 'INVESTMENT' },
          { principal: 8901.45, type: 'CREDIT_CARD' },
        ],
        superannuation: [
          { balance: 234567.89, fundType: 'INDUSTRY' },
          { balance: 654321.22, fundType: 'SMSF' }, // excluded per Phase 39.5
        ],
        personalAssets: [{ currentValue: 38500.5 }],
      },
    },
    {
      name: 'IEEE-754 trap — 0.1 + 0.2 territory',
      description:
        'Lots of small fractional contributions that compound Float rounding error. The Float path WILL drift on aggregate; the Decimal path must stay exact.',
      input: {
        properties: [],
        accounts: Array.from({ length: 100 }, () => ({ currentBalance: 0.1, type: 'SAVINGS' as const })),
        investments: [],
        loans: [],
      },
    },
  ],
};
