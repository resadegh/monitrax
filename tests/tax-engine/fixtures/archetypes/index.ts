/**
 * Archetype fixtures barrel — Phase 41e.−1 cleanup PR D.
 *
 * `ARCHETYPES` is the canonical list. Tests iterate it with
 * `describe.each(ARCHETYPES)` so adding a new archetype (synthetic edge
 * cases per audit doc §9.1) requires only a new fixture file + an entry
 * here — no changes to test bodies.
 */

import type { ArchetypeFixture } from './types';
import { sarahKim } from './sarah-kim';
import { davidEmma } from './david-emma';
import { olivia } from './olivia';

export type { ArchetypeFixture } from './types';
export { sarahKim, davidEmma, olivia };

export const ARCHETYPES: readonly ArchetypeFixture[] = [
  sarahKim,
  davidEmma,
  olivia,
] as const;
