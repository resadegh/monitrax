/**
 * Phase 41h.0 — Tax Advisor tool registry.
 *
 * Per `docs/blueprint/PHASE_41_REGULATORY_ARCHITECTURE.md` §5.2 +
 * Reza's brief 2026-05-05 (HR-1, HR-2). The registry is a finite,
 * code-reviewed list of tools the AI may invoke. Anything outside
 * this list cannot be called.
 *
 * **What this registry MUST NEVER contain:**
 *   - A tool that emits recommendations (D-2 boundary)
 *   - A tool that estimates / projects numbers from AI memory (HR-1)
 *   - A tool that searches the open web for tax rules (HR-2)
 *   - A tool that returns free-form authority text the AI can quote
 *     verbatim (HR-2)
 *
 * Reviewers MUST reject any PR that adds a tool violating any of
 * the above.
 *
 * **What this registry MAY contain:**
 *   - `FACT_LOOKUP` tools that wrap a Phase 41e or Phase 20 calc
 *     engine and return its `numericFields` + `citations` + `uncomputed`
 *   - `SCENARIO_RUN` tools that re-invoke a calc engine with
 *     hypothetical inputs (e.g. "what if I sold property X this FY?")
 *     and return the deltas
 */

import type { TaxAdvisorTool } from './types';

/**
 * The tool registry. Built once at module load — adding a tool
 * requires editing this file (plus its test).
 */
class ToolRegistry {
  private readonly tools: Map<string, TaxAdvisorTool<any>> = new Map();

  /**
   * Register a tool. Throws if a tool with the same name is already
   * registered (defensive against duplicate registration during
   * hot-reload or test setup).
   */
  register<TInput>(tool: TaxAdvisorTool<TInput>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(
        `[Phase 41h] Tool already registered: ${tool.name}. Tool names must be unique.`,
      );
    }
    this.tools.set(tool.name, tool);
  }

  /** Look up a tool by name. Returns `undefined` if not registered. */
  get(name: string): TaxAdvisorTool<any> | undefined {
    return this.tools.get(name);
  }

  /** All registered tools, sorted alphabetically for stable output. */
  list(): TaxAdvisorTool<any>[] {
    return [...this.tools.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Tool count — useful for tests. */
  size(): number {
    return this.tools.size;
  }

  /**
   * Test-only: clear the registry. Production code MUST NOT call this.
   * Exposed for tests that need a clean registry per test case.
   */
  __testOnlyClear(): void {
    this.tools.clear();
  }
}

/**
 * Singleton registry. Imported by the dispatcher (Phase 41h.2) and
 * by every tool module's bootstrap code.
 */
export const taxAdvisorToolRegistry = new ToolRegistry();

/**
 * Convenience: assert a tool is `FACT_LOOKUP` or `SCENARIO_RUN` —
 * runtime check for the closed-set discriminant. Thrown errors
 * indicate a programming error (a tool of an unsupported kind was
 * registered) and should crash the build, not be caught.
 */
export function assertToolKind(tool: TaxAdvisorTool<any>): void {
  if (tool.kind !== 'FACT_LOOKUP' && tool.kind !== 'SCENARIO_RUN') {
    throw new Error(
      `[Phase 41h] Tool ${tool.name} has unsupported kind "${tool.kind}". Only FACT_LOOKUP and SCENARIO_RUN are allowed (D-2 boundary).`,
    );
  }
}
