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

// As more topics ship (properties, debts, accounts, ...), add them as
// discriminated members of this union. v1 supports household only.
export const wizardStateDeltaSchema = z.discriminatedUnion('topic', [
  householdStateDeltaSchema,
  // Future: propertiesStateDeltaSchema, debtsStateDeltaSchema, ...
]);

export type WizardStateDelta = z.infer<typeof wizardStateDeltaSchema>;
export type HouseholdMemberDelta = z.infer<typeof householdMemberDeltaSchema>;
export type HouseholdPetDelta = z.infer<typeof householdPetDeltaSchema>;
export type HouseholdFields = z.infer<typeof householdFieldsSchema>;

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
