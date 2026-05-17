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
// Top-level WizardStateDelta (discriminated by `topic`)
// ============================================================================

// As more topics ship (investments, super, …), add them as discriminated
// members of this union.
export const wizardStateDeltaSchema = z.discriminatedUnion('topic', [
  householdStateDeltaSchema,
  propertiesStateDeltaSchema,
  debtsStateDeltaSchema,
  accountsStateDeltaSchema,
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
