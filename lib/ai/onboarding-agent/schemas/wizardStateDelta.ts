/**
 * WizardStateDelta — canonical Zod schema for the onboarding agent's
 * tool output (Phase 12 §5.1).
 *
 * The LLM (Anthropic Claude via tool-use) is constrained to emit
 * exactly this shape. Free-form replies are rejected at the gateway
 * boundary. Numeric fields are typed (`number | null`) — never
 * stringly-typed.
 *
 * v1 supports the `household` topic only. Other topics
 * (entities / properties / debts / accounts / investments / super /
 * assets / income / expenses) will land as additive entries in the
 * `fields` discriminated union as Track E expands beyond Household.
 *
 * Hard rules enforced here (Phase 12 §2):
 *   - Numeric fields rejected if they're strings.
 *   - Enums rejected if they're outside the canonical AU-aligned set.
 *   - String lengths bounded so a runaway LLM output can't fill a
 *     gigabyte before audit-write.
 *   - `unresolved` is an array of field NAMES, never values — used to
 *     prompt the agent's next clarifying question.
 *   - `rationale` is short, optional, and feeds the recap card text
 *     but is never written to the DB (CDR §13.3 — values come from
 *     `fields`, not `rationale`).
 */

import { z } from 'zod';

// ============================================================================
// HOUSEHOLD topic — v1
// ============================================================================

export const householdRelationshipEnum = z.enum([
  'SELF',
  'SPOUSE',
  'PARTNER',
  'CHILD',
  'PARENT',
  'SIBLING',
  'OTHER',
]);

export const householdPetTypeEnum = z.enum([
  'DOG',
  'CAT',
  'BIRD',
  'FISH',
  'RABBIT',
  'REPTILE',
  'OTHER',
]);

export const householdMemberDeltaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relationship: householdRelationshipEnum,
  isIncomeEarner: z.boolean(),
});

export const householdPetDeltaSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: householdPetTypeEnum,
});

export const householdFieldsSchema = z.object({
  householdMembers: z.array(householdMemberDeltaSchema).max(20).optional(),
  householdPets: z.array(householdPetDeltaSchema).max(20).optional(),
  carsCount: z.number().int().min(0).max(50).optional(),
});

// ============================================================================
// Top-level WizardStateDelta (discriminated by `topic`)
// ============================================================================

export const householdStateDeltaSchema = z.object({
  topic: z.literal('household'),
  fields: householdFieldsSchema,
  unresolved: z.array(z.string().trim().min(1).max(80)).max(10),
  rationale: z.string().trim().max(280).optional(),
});

// ============================================================================
// PROPERTIES topic — v1 minimum capture
// ============================================================================
//
// What chat captures per property (the bare minimum to make a useful
// wizard handoff):
//   - name           — free text (e.g. "home", "Carlton apartment")
//   - type           — HOME (PPOR/principal place of residence) or INVESTMENT
//   - currentValue   — approximate value in AUD
//   - hasLoan        — boolean flag only; loan details (principal, rate,
//                      term) stay in form mode where it's easier to type
//                      precise numbers
//
// What chat does NOT capture (deferred to form mode):
//   - address (form mode validates AU address format)
//   - purchasePrice (defaults to currentValue on bulk-create)
//   - purchaseDate / acquisitionContractDate (Phase 41E reform context —
//     too easy to mishear; better as a date picker)
//   - isNewBuild + newBuildEvidence (compliance-sensitive; form mode
//     gates on acquisitionContractDate post-cut-over)
//   - loan details / rental income / expenses (separate steps in form)
//
// Partial properties: the LLM may emit a property with just `name` if the
// user hasn't given a value yet. The orchestrator state machine asks
// follow-up questions until every staged property has all 4 fields. The
// LLM must echo ALL currently-staged properties in the same order on
// every turn (system prompt makes this explicit) — so "filling in"
// happens via positional merge.

export const propertyTypeEnum = z.enum(['HOME', 'INVESTMENT']);

export const propertyDeltaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: propertyTypeEnum.optional(),
  currentValue: z.number().int().min(1).max(50_000_000).optional(),
  hasLoan: z.boolean().optional(),
});

export const propertiesFieldsSchema = z.object({
  /** Sentinel — when explicitly false, the user owns no property; the
   *  recap shows "No property" and the chat hands off to form mode. */
  ownsProperty: z.boolean().optional(),
  properties: z.array(propertyDeltaSchema).max(10).optional(),
});

export const propertiesStateDeltaSchema = z.object({
  topic: z.literal('properties'),
  fields: propertiesFieldsSchema,
  unresolved: z.array(z.string().trim().min(1).max(80)).max(10),
  rationale: z.string().trim().max(280).optional(),
});

// ============================================================================
// DEBTS topic — v1 minimum capture
// ============================================================================
//
// What chat captures per debt (the bare minimum for a useful handoff):
//   - name      — free text (e.g. "car loan", "HECS", "credit card")
//   - type      — CAR / PERSONAL / STUDENT / BUSINESS (matches DebtLoanType)
//   - principal — outstanding balance owed in AUD (integer)
//   - isHecsHelp — boolean. Auto-derive in the script: TRUE when
//                  type === STUDENT, FALSE otherwise. The LLM may emit
//                  it explicitly when the user says "HECS" / "HELP".
//
// Deferred to form mode:
//   - interestRateAnnual, minRepayment, repaymentFrequency — most
//     users don't know these without checking their statement; the
//     form has the precision (number input + frequency picker).
//   - lender (institution name) — easier in form.
//   - termMonthsRemaining — date math is form-friendly.
//   - linkedAssetId — for CAR loans, the form handles the link to the
//     Assets step.

export const debtLoanTypeEnum = z.enum(['CAR', 'PERSONAL', 'STUDENT', 'BUSINESS']);

export const debtDeltaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: debtLoanTypeEnum.optional(),
  principal: z.number().int().min(1).max(10_000_000).optional(),
  isHecsHelp: z.boolean().optional(),
});

export const debtsFieldsSchema = z.object({
  /** Sentinel — when explicitly false, the user has no debts to enter;
   *  the recap shows "No debts" and the chat advances. */
  hasDebts: z.boolean().optional(),
  debts: z.array(debtDeltaSchema).max(15).optional(),
});

export const debtsStateDeltaSchema = z.object({
  topic: z.literal('debts'),
  fields: debtsFieldsSchema,
  unresolved: z.array(z.string().trim().min(1).max(80)).max(10),
  rationale: z.string().trim().max(280).optional(),
});

// ============================================================================
// ACCOUNTS topic — v1 minimum capture
// ============================================================================
//
// What chat captures per account:
//   - name           — free text (e.g. "everyday", "ING savings")
//   - type           — OFFSET / SAVINGS / TRANSACTIONAL / CREDIT_CARD
//   - currentBalance — integer AUD; can be negative for credit card debt
//
// Deferred to form mode:
//   - institution, interestRate, linkedLoanId (offset wiring),
//     source (defaults to MANUAL for chat-entered accounts), and any
//     Basiq / import metadata.
//
// Credit card sign convention: we keep currentBalance as signed
// (negative = balance owed). The LLM is instructed to emit credit card
// balances as NEGATIVE when the user describes them as "owing $2k on
// my Visa" / "$2,000 owing on my Mastercard".

export const accountTypeEnum = z.enum(['OFFSET', 'SAVINGS', 'TRANSACTIONAL', 'CREDIT_CARD']);

export const accountDeltaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: accountTypeEnum.optional(),
  currentBalance: z.number().int().min(-1_000_000).max(50_000_000).optional(),
});

export const accountsFieldsSchema = z.object({
  /** Sentinel — when explicitly false, the user does not want to add
   *  any bank accounts here. Edge case but accepted (forms have the
   *  same affordance via the optional Accounts step). */
  hasAccounts: z.boolean().optional(),
  accounts: z.array(accountDeltaSchema).max(15).optional(),
});

export const accountsStateDeltaSchema = z.object({
  topic: z.literal('accounts'),
  fields: accountsFieldsSchema,
  unresolved: z.array(z.string().trim().min(1).max(80)).max(10),
  rationale: z.string().trim().max(280).optional(),
});

// ============================================================================
// SUPER topic — v1 minimum capture
// ============================================================================
//
// What chat captures per super account:
//   - fundName       — e.g. "AustralianSuper", "Hostplus", "REST"
//   - currentBalance — integer AUD
//
// Deferred to form mode:
//   - investment option / risk profile
//   - employer contributions, salary sacrifice, member contributions
//   - SMSF-specific fields (member list, trust deed, fund ABN)
//
// On chat handoff to WizardData: `name = fundName` (user can rename
// the nickname in form mode if they want a separate display name).

export const superDeltaSchema = z.object({
  fundName: z.string().trim().min(1).max(120),
  currentBalance: z.number().int().min(0).max(50_000_000).optional(),
});

export const superFieldsSchema = z.object({
  /** Sentinel — when explicitly false, the user has no super to add
   *  here (rare in AU but allowed; form mode also makes Super
   *  optional). */
  hasSuper: z.boolean().optional(),
  superAccounts: z.array(superDeltaSchema).max(10).optional(),
});

export const superStateDeltaSchema = z.object({
  topic: z.literal('super'),
  fields: superFieldsSchema,
  unresolved: z.array(z.string().trim().min(1).max(80)).max(10),
  rationale: z.string().trim().max(280).optional(),
});

// ============================================================================
// ASSETS topic — v1 minimum capture
// ============================================================================
//
// What chat captures per asset:
//   - name           — free text (e.g. "car", "iPhone", "guitar")
//   - type           — VEHICLE / ELECTRONICS / FURNITURE / EQUIPMENT /
//                      COLLECTIBLE / OTHER
//   - currentValue   — integer AUD
//
// Deferred to form mode:
//   - purchasePrice (defaults to currentValue on bulk-create)
//   - purchaseDate, description
//   - expenses (defaults to [])
//   - vehicle-specific fields (make, model, year — VEHICLE only)
//
// "Assets" here means PERSONAL assets (vehicles, electronics,
// collectibles, etc.) — NOT property (Properties topic) and NOT
// investment holdings (Investments topic).

export const assetTypeEnum = z.enum([
  'VEHICLE',
  'ELECTRONICS',
  'FURNITURE',
  'EQUIPMENT',
  'COLLECTIBLE',
  'OTHER',
]);

export const assetDeltaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: assetTypeEnum.optional(),
  currentValue: z.number().int().min(1).max(10_000_000).optional(),
});

export const assetsFieldsSchema = z.object({
  /** Sentinel — when explicitly false, the user opts out of listing
   *  personal assets here. Very common — most users don't track
   *  furniture / electronics in this step. */
  hasAssets: z.boolean().optional(),
  assets: z.array(assetDeltaSchema).max(15).optional(),
});

export const assetsStateDeltaSchema = z.object({
  topic: z.literal('assets'),
  fields: assetsFieldsSchema,
  unresolved: z.array(z.string().trim().min(1).max(80)).max(10),
  rationale: z.string().trim().max(280).optional(),
});

// ============================================================================
// INVESTMENTS topic — v1 minimum capture
// ============================================================================
//
// What chat captures per investment account:
//   - name           — free text (e.g. "CommSec", "Vanguard ETF account")
//   - type           — BROKERAGE / FUND / TRUST / ETF_CRYPTO
//                      (SUPERS deliberately EXCLUDED — covered by the
//                      Super topic; system prompt redirects)
//   - totalValue     — single integer AUD. On handoff to WizardData,
//                      stored as `cashBalance` with empty `holdings[]`.
//                      Per-holding detail is form-mode work (users
//                      need their broker statement to recall it).
//
// Deferred to form mode:
//   - platform (separate from name in WizardData; chat just uses one name)
//   - holdings (ticker, units, averagePrice, type per holding)
//   - per-holding acquisitionDate (Phase 41E CGT context)

export const investmentAccountTypeEnum = z.enum([
  'BROKERAGE',
  'FUND',
  'TRUST',
  'ETF_CRYPTO',
]);

export const investmentDeltaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: investmentAccountTypeEnum.optional(),
  totalValue: z.number().int().min(1).max(100_000_000).optional(),
});

export const investmentsFieldsSchema = z.object({
  /** Sentinel — when explicitly false, the user has no investments
   *  (apart from super which lives on its own topic). */
  hasInvestments: z.boolean().optional(),
  investments: z.array(investmentDeltaSchema).max(10).optional(),
});

export const investmentsStateDeltaSchema = z.object({
  topic: z.literal('investments'),
  fields: investmentsFieldsSchema,
  unresolved: z.array(z.string().trim().min(1).max(80)).max(10),
  rationale: z.string().trim().max(280).optional(),
});

// ============================================================================
// INCOME-EXPENSES topic — v1 (FINAL chat topic)
// ============================================================================
//
// Two collections in one topic: incomes + expenses. The orchestrator
// drives a two-phase conversation (incomes first → expenses → recap)
// but the schema accepts both in one delta so the LLM can extract
// either when the user volunteers both in a single message.
//
// What chat captures per income:
//   - name        — free text (e.g. "salary", "rental from Carlton")
//   - type        — SALARY / RENT / RENTAL / INVESTMENT / OTHER
//   - amount      — integer AUD (per frequency unit)
//   - frequency   — WEEKLY / FORTNIGHTLY / MONTHLY / QUARTERLY / ANNUAL
//   - salaryType  — GROSS / NET (for SALARY type; LLM extracts when
//                   user says "after tax" / "take-home" → NET, else
//                   defaults to GROSS on handoff)
//
// What chat captures per expense:
//   - name        — free text (e.g. "rent", "groceries", "gym")
//   - category    — one of 19 ExpenseCategory enum values
//   - amount      — integer AUD (per frequency unit)
//   - frequency   — same enum as income
//
// Deferred to form mode:
//   - isEssential / isTaxDeductible flags (form flips)
//   - per-property linked expenses (Property step owns these)

export const incomeTypeEnum = z.enum(['SALARY', 'RENT', 'RENTAL', 'INVESTMENT', 'OTHER']);
export const salaryTypeEnum = z.enum(['GROSS', 'NET']);
export const frequencyEnum = z.enum(['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL']);

export const expenseCategoryEnum = z.enum([
  'HOUSING',
  'RENT',
  'RATES',
  'INSURANCE',
  'MAINTENANCE',
  'PERSONAL',
  'UTILITIES',
  'FOOD',
  'GROCERIES',
  'TRANSPORT',
  'ENTERTAINMENT',
  'SUBSCRIPTION',
  'STRATA',
  'LAND_TAX',
  'LOAN_INTEREST',
  'REGISTRATION',
  'MODIFICATIONS',
  'HEALTH',
  'EDUCATION',
  'OTHER',
]);

export const incomeDeltaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  type: incomeTypeEnum.optional(),
  amount: z.number().int().min(1).max(10_000_000).optional(),
  frequency: frequencyEnum.optional(),
  salaryType: salaryTypeEnum.optional(),
});

export const expenseDeltaSchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: expenseCategoryEnum.optional(),
  amount: z.number().int().min(1).max(1_000_000).optional(),
  frequency: frequencyEnum.optional(),
});

export const incomeExpensesFieldsSchema = z.object({
  /** Sentinel for the incomes sub-collection. */
  hasIncome: z.boolean().optional(),
  incomes: z.array(incomeDeltaSchema).max(15).optional(),
  /** Sentinel for the expenses sub-collection. */
  hasExpenses: z.boolean().optional(),
  expenses: z.array(expenseDeltaSchema).max(30).optional(),
});

export const incomeExpensesStateDeltaSchema = z.object({
  topic: z.literal('income-expenses'),
  fields: incomeExpensesFieldsSchema,
  unresolved: z.array(z.string().trim().min(1).max(80)).max(10),
  rationale: z.string().trim().max(280).optional(),
});

// ============================================================================
// Top-level WizardStateDelta (discriminated by `topic`)
// ============================================================================

// All 8 chat topics now in the union. Track E topic coverage complete
// with PR #8.
export const wizardStateDeltaSchema = z.discriminatedUnion('topic', [
  householdStateDeltaSchema,
  propertiesStateDeltaSchema,
  debtsStateDeltaSchema,
  accountsStateDeltaSchema,
  superStateDeltaSchema,
  assetsStateDeltaSchema,
  investmentsStateDeltaSchema,
  incomeExpensesStateDeltaSchema,
]);

export type WizardStateDelta = z.infer<typeof wizardStateDeltaSchema>;
export type HouseholdMemberDelta = z.infer<typeof householdMemberDeltaSchema>;
export type HouseholdPetDelta = z.infer<typeof householdPetDeltaSchema>;
export type HouseholdFields = z.infer<typeof householdFieldsSchema>;
export type PropertyDelta = z.infer<typeof propertyDeltaSchema>;
export type PropertiesFields = z.infer<typeof propertiesFieldsSchema>;
export type DebtDelta = z.infer<typeof debtDeltaSchema>;
export type DebtsFields = z.infer<typeof debtsFieldsSchema>;
export type AccountDelta = z.infer<typeof accountDeltaSchema>;
export type AccountsFields = z.infer<typeof accountsFieldsSchema>;
export type SuperDelta = z.infer<typeof superDeltaSchema>;
export type SuperFields = z.infer<typeof superFieldsSchema>;
export type AssetDelta = z.infer<typeof assetDeltaSchema>;
export type AssetsFields = z.infer<typeof assetsFieldsSchema>;
export type InvestmentDelta = z.infer<typeof investmentDeltaSchema>;
export type InvestmentsFields = z.infer<typeof investmentsFieldsSchema>;
export type IncomeDelta = z.infer<typeof incomeDeltaSchema>;
export type ExpenseDelta = z.infer<typeof expenseDeltaSchema>;
export type IncomeExpensesFields = z.infer<typeof incomeExpensesFieldsSchema>;

// ============================================================================
// JSON Schema (hand-crafted to mirror the Zod schema above)
// ============================================================================
//
// Anthropic's tool-use API expects JSON Schema. We hand-craft to avoid
// a `zod-to-json-schema` dependency for one tool — and to keep the
// JSON-Schema "input_schema" presented to the LLM explicit + readable
// in source. Zod stays the runtime SSOT; this is its on-the-wire
// representation for the tool boundary.

export const HOUSEHOLD_TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['topic', 'fields', 'unresolved'],
  properties: {
    topic: { type: 'string', enum: ['household'] },
    fields: {
      type: 'object',
      properties: {
        householdMembers: {
          type: 'array',
          maxItems: 20,
          items: {
            type: 'object',
            required: ['name', 'relationship', 'isIncomeEarner'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 120 },
              relationship: {
                type: 'string',
                enum: ['SELF', 'SPOUSE', 'PARTNER', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'],
              },
              isIncomeEarner: { type: 'boolean' },
            },
          },
        },
        householdPets: {
          type: 'array',
          maxItems: 20,
          items: {
            type: 'object',
            required: ['name', 'type'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 60 },
              type: {
                type: 'string',
                enum: ['DOG', 'CAT', 'BIRD', 'FISH', 'RABBIT', 'REPTILE', 'OTHER'],
              },
            },
          },
        },
        carsCount: { type: 'integer', minimum: 0, maximum: 50 },
      },
    },
    unresolved: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string', minLength: 1, maxLength: 80 },
    },
    rationale: { type: 'string', maxLength: 280 },
  },
} as const;

export const PROPERTIES_TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['topic', 'fields', 'unresolved'],
  properties: {
    topic: { type: 'string', enum: ['properties'] },
    fields: {
      type: 'object',
      properties: {
        ownsProperty: { type: 'boolean' },
        properties: {
          type: 'array',
          maxItems: 10,
          items: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 120 },
              type: { type: 'string', enum: ['HOME', 'INVESTMENT'] },
              currentValue: { type: 'integer', minimum: 1, maximum: 50000000 },
              hasLoan: { type: 'boolean' },
            },
          },
        },
      },
    },
    unresolved: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string', minLength: 1, maxLength: 80 },
    },
    rationale: { type: 'string', maxLength: 280 },
  },
} as const;

export const DEBTS_TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['topic', 'fields', 'unresolved'],
  properties: {
    topic: { type: 'string', enum: ['debts'] },
    fields: {
      type: 'object',
      properties: {
        hasDebts: { type: 'boolean' },
        debts: {
          type: 'array',
          maxItems: 15,
          items: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 120 },
              type: {
                type: 'string',
                enum: ['CAR', 'PERSONAL', 'STUDENT', 'BUSINESS'],
              },
              principal: { type: 'integer', minimum: 1, maximum: 10000000 },
              isHecsHelp: { type: 'boolean' },
            },
          },
        },
      },
    },
    unresolved: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string', minLength: 1, maxLength: 80 },
    },
    rationale: { type: 'string', maxLength: 280 },
  },
} as const;

export const ACCOUNTS_TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['topic', 'fields', 'unresolved'],
  properties: {
    topic: { type: 'string', enum: ['accounts'] },
    fields: {
      type: 'object',
      properties: {
        hasAccounts: { type: 'boolean' },
        accounts: {
          type: 'array',
          maxItems: 15,
          items: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 120 },
              type: {
                type: 'string',
                enum: ['OFFSET', 'SAVINGS', 'TRANSACTIONAL', 'CREDIT_CARD'],
              },
              currentBalance: { type: 'integer', minimum: -1000000, maximum: 50000000 },
            },
          },
        },
      },
    },
    unresolved: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string', minLength: 1, maxLength: 80 },
    },
    rationale: { type: 'string', maxLength: 280 },
  },
} as const;

export const SUPER_TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['topic', 'fields', 'unresolved'],
  properties: {
    topic: { type: 'string', enum: ['super'] },
    fields: {
      type: 'object',
      properties: {
        hasSuper: { type: 'boolean' },
        superAccounts: {
          type: 'array',
          maxItems: 10,
          items: {
            type: 'object',
            required: ['fundName'],
            properties: {
              fundName: { type: 'string', minLength: 1, maxLength: 120 },
              currentBalance: { type: 'integer', minimum: 0, maximum: 50000000 },
            },
          },
        },
      },
    },
    unresolved: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string', minLength: 1, maxLength: 80 },
    },
    rationale: { type: 'string', maxLength: 280 },
  },
} as const;

export const ASSETS_TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['topic', 'fields', 'unresolved'],
  properties: {
    topic: { type: 'string', enum: ['assets'] },
    fields: {
      type: 'object',
      properties: {
        hasAssets: { type: 'boolean' },
        assets: {
          type: 'array',
          maxItems: 15,
          items: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 120 },
              type: {
                type: 'string',
                enum: ['VEHICLE', 'ELECTRONICS', 'FURNITURE', 'EQUIPMENT', 'COLLECTIBLE', 'OTHER'],
              },
              currentValue: { type: 'integer', minimum: 1, maximum: 10000000 },
            },
          },
        },
      },
    },
    unresolved: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string', minLength: 1, maxLength: 80 },
    },
    rationale: { type: 'string', maxLength: 280 },
  },
} as const;

export const INVESTMENTS_TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['topic', 'fields', 'unresolved'],
  properties: {
    topic: { type: 'string', enum: ['investments'] },
    fields: {
      type: 'object',
      properties: {
        hasInvestments: { type: 'boolean' },
        investments: {
          type: 'array',
          maxItems: 10,
          items: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 120 },
              type: { type: 'string', enum: ['BROKERAGE', 'FUND', 'TRUST', 'ETF_CRYPTO'] },
              totalValue: { type: 'integer', minimum: 1, maximum: 100000000 },
            },
          },
        },
      },
    },
    unresolved: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string', minLength: 1, maxLength: 80 },
    },
    rationale: { type: 'string', maxLength: 280 },
  },
} as const;

export const INCOME_EXPENSES_TOOL_INPUT_SCHEMA = {
  type: 'object',
  required: ['topic', 'fields', 'unresolved'],
  properties: {
    topic: { type: 'string', enum: ['income-expenses'] },
    fields: {
      type: 'object',
      properties: {
        hasIncome: { type: 'boolean' },
        incomes: {
          type: 'array',
          maxItems: 15,
          items: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 120 },
              type: { type: 'string', enum: ['SALARY', 'RENT', 'RENTAL', 'INVESTMENT', 'OTHER'] },
              amount: { type: 'integer', minimum: 1, maximum: 10000000 },
              frequency: {
                type: 'string',
                enum: ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'],
              },
              salaryType: { type: 'string', enum: ['GROSS', 'NET'] },
            },
          },
        },
        hasExpenses: { type: 'boolean' },
        expenses: {
          type: 'array',
          maxItems: 30,
          items: {
            type: 'object',
            required: ['name'],
            properties: {
              name: { type: 'string', minLength: 1, maxLength: 120 },
              category: {
                type: 'string',
                enum: [
                  'HOUSING',
                  'RENT',
                  'RATES',
                  'INSURANCE',
                  'MAINTENANCE',
                  'PERSONAL',
                  'UTILITIES',
                  'FOOD',
                  'GROCERIES',
                  'TRANSPORT',
                  'ENTERTAINMENT',
                  'SUBSCRIPTION',
                  'STRATA',
                  'LAND_TAX',
                  'LOAN_INTEREST',
                  'REGISTRATION',
                  'MODIFICATIONS',
                  'HEALTH',
                  'EDUCATION',
                  'OTHER',
                ],
              },
              amount: { type: 'integer', minimum: 1, maximum: 1000000 },
              frequency: {
                type: 'string',
                enum: ['WEEKLY', 'FORTNIGHTLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'],
              },
            },
          },
        },
      },
    },
    unresolved: {
      type: 'array',
      maxItems: 10,
      items: { type: 'string', minLength: 1, maxLength: 80 },
    },
    rationale: { type: 'string', maxLength: 280 },
  },
} as const;
