/**
 * Phase 41h.2 — Production audit sink.
 *
 * Wires `AuditEntry` from the gateway into Monitrax's existing audit
 * pipeline (`lib/security/auditLog.ts` → Prisma `AuditLog` table).
 *
 * **CDR-safe metadata** (CLAUDE.md §13.3): only structural fields
 * are persisted — `traceId`, `provider`, `toolsInvoked`, `outcome`,
 * `validationIssueCodes`, `durationMs`, `tokenUsage`. The user's raw
 * question and AI response text never reach this sink (the gateway
 * never passes them in — see `auditLogger.ts`).
 *
 * **Fire-and-forget**: per CLAUDE.md §12.10, audit logging uses the
 * `.catch(() => {})` pattern — never blocks the response. If the
 * audit DB write fails (DB outage, schema drift), the user still
 * gets their answer; the failure is logged via `console.error` and
 * the trace ID lets us reconstruct from Cloud Logging.
 */

import { createAuditLog } from '@/lib/security/auditLog';
import type { AuditEntry, AuditSink } from './auditLogger';

export class ProductionAuditSink implements AuditSink {
  async write(entry: AuditEntry): Promise<void> {
    try {
      await createAuditLog({
        userId: entry.userId,
        action: 'AI_ADVISOR_INVOCATION',
        status: outcomeToStatus(entry.outcome),
        entityType: 'AI_ADVISOR',
        entityId: entry.traceId,
        metadata: {
          traceId: entry.traceId,
          provider: entry.provider,
          toolsInvoked: entry.toolsInvoked,
          outcome: entry.outcome,
          validationIssueCount: entry.validationIssueCount,
          validationIssueCodes: entry.validationIssueCodes,
          durationMs: entry.durationMs,
          tokenUsage: entry.tokenUsage,
        },
      });
    } catch (err) {
      // Fire-and-forget: never block the gateway response.
      // The trace ID + Cloud Logging covers reconstruction.
      // eslint-disable-next-line no-console
      console.error('[ai-advisor-audit] DB write failed', {
        traceId: entry.traceId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

function outcomeToStatus(
  outcome: AuditEntry['outcome'],
): 'SUCCESS' | 'FAILURE' | 'BLOCKED' {
  switch (outcome) {
    case 'OK':
      return 'SUCCESS';
    case 'BLOCKED_RECOMMENDATION':
    case 'BLOCKED_VALIDATION':
      return 'BLOCKED';
    case 'PROVIDER_ERROR':
    case 'SCHEMA_INVALID':
      return 'FAILURE';
  }
}
