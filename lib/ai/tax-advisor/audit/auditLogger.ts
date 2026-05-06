/**
 * Phase 41h.1 — Audit logger.
 *
 * Every gateway invocation produces an `AuditEntry`. In production
 * this writes to GCP Cloud Logging via the existing audit-log
 * pipeline (CLAUDE.md §13.3 — sanitisation already in place); in
 * tests it writes to an in-memory buffer for assertion.
 *
 * **CDR alignment.** Per CLAUDE.md §13.3, financial data MUST be
 * sanitised from log metadata. The audit entry below carries:
 *   - trace ID (safe — synthetic)
 *   - tool names called (safe)
 *   - validation outcome (safe)
 *   - token usage + latency (safe)
 *   - **NOT** the user's raw question (could contain CDR data)
 *   - **NOT** the AI's response text (could echo CDR data)
 *   - **NOT** the tool inputs (could contain account / loan IDs)
 *
 * If a future operator needs to reproduce a session for debugging,
 * the trace ID lets them retrieve the full payload from the
 * production-store-of-record (sealed; access-logged).
 */

export type AuditOutcome =
  | 'OK'
  | 'BLOCKED_VALIDATION'
  | 'BLOCKED_RECOMMENDATION'
  | 'PROVIDER_ERROR'
  | 'SCHEMA_INVALID';

export interface AuditEntry {
  traceId: string;
  userId: string;
  timestamp: string; // ISO-8601
  provider: string;
  toolsInvoked: string[];
  outcome: AuditOutcome;
  validationIssueCount: number;
  validationIssueCodes: string[];
  durationMs: number;
  tokenUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

/**
 * Sink interface — production wires to Cloud Logging; tests use
 * `InMemoryAuditSink`.
 */
export interface AuditSink {
  write(entry: AuditEntry): Promise<void> | void;
}

/**
 * In-memory sink for tests + dev. Production code never uses this
 * directly — the gateway accepts an `AuditSink` parameter.
 */
export class InMemoryAuditSink implements AuditSink {
  public readonly entries: AuditEntry[] = [];

  write(entry: AuditEntry): void {
    this.entries.push(entry);
  }

  clear(): void {
    this.entries.length = 0;
  }
}

/**
 * Default sink — `console.log` in dev, swapped for Cloud Logging in
 * production (wire-up lands in 41h.2 alongside the Gemini provider).
 *
 * Avoids any string interpolation that could leak CDR data — entry
 * is logged as a structured object only.
 */
export class ConsoleAuditSink implements AuditSink {
  write(entry: AuditEntry): void {
    // eslint-disable-next-line no-console
    console.log('[ai-advisor-audit]', JSON.stringify(entry));
  }
}
