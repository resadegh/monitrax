/**
 * Phase 41i.3b — UserAuditAdapter registry.
 *
 * Singleton holding every registered `UserAuditAdapter`. Mirrors the
 * `calcEngineRegistry` + `taxAdvisorToolRegistry` + `surfaceRegistry`
 * patterns. Adapters register themselves at module load via
 * `index.ts` bootstrap.
 *
 * **Reviewers reject any PR that:**
 *   - Registers a duplicate `engineName` (the id is the audit key).
 *   - Registers an adapter whose `fetchInput` makes the engine
 *     non-deterministic (e.g. wall-clock-dependent input shapes).
 *   - Registers an adapter without a corresponding `CalcEngine` in
 *     the calc-engine registry — the harness needs to look up the
 *     `execute` function by `engineName`.
 */

import 'server-only';
import type { UserAuditAdapter } from './types';

class UserAuditAdapterRegistry {
  private readonly adapters: Map<string, UserAuditAdapter<unknown, unknown>> = new Map();

  register<TInput, TOutput>(adapter: UserAuditAdapter<TInput, TOutput>): void {
    if (!adapter.engineName || typeof adapter.engineName !== 'string') {
      throw new Error('[Phase 41i.3b] UserAuditAdapter.engineName must be a non-empty string.');
    }
    if (typeof adapter.fetchInput !== 'function') {
      throw new Error(
        `[Phase 41i.3b] UserAuditAdapter.fetchInput must be a function for ${adapter.engineName}.`,
      );
    }
    if (this.adapters.has(adapter.engineName)) {
      throw new Error(
        `[Phase 41i.3b] UserAuditAdapter already registered: ${adapter.engineName}. engineNames must be unique.`,
      );
    }
    this.adapters.set(adapter.engineName, adapter as UserAuditAdapter<unknown, unknown>);
  }

  get(engineName: string): UserAuditAdapter<unknown, unknown> | undefined {
    return this.adapters.get(engineName);
  }

  list(): UserAuditAdapter<unknown, unknown>[] {
    return [...this.adapters.values()].sort((a, b) =>
      a.engineName.localeCompare(b.engineName),
    );
  }

  size(): number {
    return this.adapters.size;
  }

  /**
   * Test-only — clears the registry. Production code MUST NOT call
   * this. Tests use it to set up isolated registry state.
   */
  __testOnlyClear(): void {
    this.adapters.clear();
  }
}

export const userAuditAdapterRegistry = new UserAuditAdapterRegistry();
