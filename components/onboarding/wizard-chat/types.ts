/**
 * Local types for the conversational onboarding surface
 * (Phase 12 Track E, components/onboarding/wizard-chat/*).
 *
 * The agent's tool output type (WizardStateDelta) lives in
 * lib/ai/onboarding-agent/schemas/ — the SSOT for the on-the-wire
 * shape. These types are presentational / state-machine only.
 */

export type ChatMessageRole = 'agent' | 'user';

export interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  text: string;
  /** Unix ms — for ordering + future replay debugging. */
  ts: number;
}
