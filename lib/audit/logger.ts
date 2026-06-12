/**
 * Request metadata extraction for audit logging.
 *
 * 2026-06-11 cleanup: this file previously carried a parallel audit-event
 * system (`logAuditEvent` + AuditEventType union + logLogin/logCreate/…
 * convenience wrappers) that duplicated `lib/security/auditLog.ts` and had
 * ZERO callers — the only import anywhere was `extractRequestMeta`. The
 * dead system also passed event types (IMPORT, TOKEN_REFRESH, …) that don't
 * exist in the Prisma `AuditAction` enum, so it could never have written a
 * row. Deleted per CLAUDE.md §12.1 (dead code in the change path) and
 * §12.2 (audit writes have ONE canonical source: lib/security/auditLog.ts).
 * See: docs/changelog/CHANGELOG_2026_06_11.md
 */

export interface RequestMeta {
  ip: string;
  userAgent: string;
}

/**
 * Extract request metadata for audit logging
 */
export function extractRequestMeta(request: Request): RequestMeta {
  return {
    ip:
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}
