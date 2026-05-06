/**
 * Phase 41i — Calculation Audit registry.
 *
 * Singleton holding every registered `CalcEngine` in the app. Same
 * pattern as the `taxAdvisorToolRegistry` (41h.0): code-reviewed,
 * additions require editing this module's bootstrap (`index.ts`).
 *
 * **Reviewers reject any PR that:**
 *   - Adds an engine without at least one fixture (HR-3 — every
 *     engine must be auditable).
 *   - Registers an engine whose `execute()` is non-deterministic
 *     (DB call, time-dependent, network) — wrap a pure version.
 *   - Registers a duplicate name.
 */

import type { CalcEngine } from './types';

class CalcEngineRegistry {
  private readonly engines: Map<string, CalcEngine<any, any>> = new Map();

  register<TInput, TOutput>(engine: CalcEngine<TInput, TOutput>): void {
    if (this.engines.has(engine.name)) {
      throw new Error(
        `[Phase 41i] Calc engine already registered: ${engine.name}. Names must be unique.`,
      );
    }
    if (engine.fixtures.length === 0) {
      throw new Error(
        `[Phase 41i] Calc engine "${engine.name}" registered without fixtures. Every engine must have at least one fixture (HR-3).`,
      );
    }
    this.engines.set(engine.name, engine as CalcEngine<any, any>);
  }

  get(name: string): CalcEngine<any, any> | undefined {
    return this.engines.get(name);
  }

  list(): CalcEngine<any, any>[] {
    return [...this.engines.values()].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  byCategory(): Record<string, CalcEngine<any, any>[]> {
    const buckets: Record<string, CalcEngine<any, any>[]> = {};
    for (const e of this.list()) {
      if (!buckets[e.category]) buckets[e.category] = [];
      buckets[e.category].push(e);
    }
    return buckets;
  }

  size(): number {
    return this.engines.size;
  }

  totalFixtures(): number {
    let n = 0;
    for (const e of this.engines.values()) n += e.fixtures.length;
    return n;
  }

  /**
   * Test-only — clears the registry. Production code MUST NOT call
   * this. Tests use it to set up isolated registry state.
   */
  __testOnlyClear(): void {
    this.engines.clear();
  }
}

export const calcEngineRegistry = new CalcEngineRegistry();
