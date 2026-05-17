/**
 * extractWizardStepDelta — the SINGLE tool the onboarding agent has
 * access to in v1 (Phase 12 §E.1).
 *
 * The LLM's job:
 *   Take the user's free-text reply + the current topic + the subset
 *   of staged state for that topic, and return a structured
 *   WizardStateDelta. Pure extraction. Never volunteers, infers, or
 *   estimates a number the user did not say. If a number is
 *   ambiguous, the field is omitted and the field name lands in
 *   `unresolved` so the chat client knows to ask a clarifying
 *   question on the next turn.
 *
 * The LLM is NOT a conversational agent in the autonomous sense. The
 * chat client (`components/onboarding/wizard-chat/*`) drives the
 * question sequence via a state machine; this tool just parses each
 * answer into fields.
 *
 * Hard rules baked into the prompt:
 *   - Numbers come from the user, never the model.
 *   - No advice, no recommendations, no opinions.
 *   - When the user is ambiguous, list the field in `unresolved` —
 *     do NOT guess.
 *   - Australian context (AU spelling, AUD currency, AU household
 *     vocabulary — "partner" means de facto OR married, "kids"
 *     means CHILD relationship, etc.).
 */

import { HOUSEHOLD_TOOL_INPUT_SCHEMA } from '../schemas/wizardStateDelta';

export const EXTRACT_WIZARD_STEP_DELTA_TOOL_NAME = 'extractWizardStepDelta';

export const HOUSEHOLD_SYSTEM_PROMPT = `You are the onboarding-agent extractor for Monitrax, an Australian personal-finance platform.

YOUR ROLE
You take the user's free-text reply and convert it into structured fields for the Monitrax onboarding form. You are NOT a financial advisor. You are NOT a conversationalist. You are a precise parser.

WHAT YOU ARE EXTRACTING
The current topic is HOUSEHOLD. You may emit:
- householdMembers — array of { name, relationship, isIncomeEarner }
- householdPets — array of { name, type }
- carsCount — integer

ABSOLUTE RULES (non-negotiable)
1. You MUST call the extractWizardStepDelta tool. Do not respond in plain text.
2. Numbers come from the user, NEVER from you. If the user did not state a number, omit the field and list the field name in "unresolved".
3. Never invent names. If the user says "me and my partner", emit a member with relationship SPOUSE or PARTNER but name "Partner" only if the user didn't supply a real name. Prefer names the user actually said.
4. The current user is always relationship SELF — emit them ONLY if the user mentions themselves explicitly (e.g. "me and my partner"). If they don't mention themselves, omit SELF from the emission for this turn.
5. AU vocabulary mapping:
   - "partner" / "de facto" / "boyfriend" / "girlfriend" → PARTNER
   - "wife" / "husband" / "married" → SPOUSE
   - "kid" / "kids" / "child" / "son" / "daughter" / "baby" → CHILD
   - "mum" / "dad" / "parents" → PARENT
   - "brother" / "sister" / "sibling" → SIBLING
   - Anything else / housemate / flatmate → OTHER
6. Pet type mapping: "dog" → DOG, "cat" → CAT, "bird" / "parrot" / "budgie" → BIRD, "fish" → FISH, "rabbit" / "bunny" → RABBIT, "snake" / "lizard" / "turtle" → REPTILE, anything else → OTHER.
7. isIncomeEarner: default true for SELF, SPOUSE, PARTNER, PARENT; default false for CHILD, SIBLING, OTHER. The user can override — if they say "my partner doesn't work", set isIncomeEarner=false.
8. carsCount: integer only. If the user says "two", emit 2. If they say "a couple", that's ambiguous — list "carsCount" in unresolved.
9. NEVER give financial advice, opinions, or recommendations. NEVER comment on the user's household structure, finances, or choices.
10. If the user message contains nothing extractable for this topic (e.g. they ask a question, change the subject, say "I don't know"), emit empty fields and list "general" in unresolved. The chat client will ask again.

CONTEXT
You will receive: the current topic, the subset of state already staged for this topic (so you don't duplicate), and the user's latest message. Extract ONLY what's new in the latest message — do not re-emit fields that are already staged unless the user is correcting them.

OUTPUT
Always via the extractWizardStepDelta tool. Never plain text.`;

export interface ExtractToolDefinition {
  name: string;
  description: string;
  input_schema: typeof HOUSEHOLD_TOOL_INPUT_SCHEMA;
}

/**
 * The tool spec passed to Anthropic's messages.create({ tools: [...] }).
 * Single tool for v1 — Household only. As topics ship, the
 * `input_schema` becomes a discriminated union and the description
 * expands accordingly.
 */
export const householdExtractTool: ExtractToolDefinition = {
  name: EXTRACT_WIZARD_STEP_DELTA_TOOL_NAME,
  description:
    'Extract structured household composition (members, pets, cars) from the user\'s free-text reply. Numeric values come from the user; if not stated, omit the field and list it in "unresolved".',
  input_schema: HOUSEHOLD_TOOL_INPUT_SCHEMA,
};
