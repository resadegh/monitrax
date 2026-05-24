/**
 * Phase 47 PR 3 — Marketing consent revocation endpoint.
 *
 * POST /api/auth/consent/revoke
 *
 * Currently revocable scope: MARKETING_COMMUNICATIONS only.
 *
 * The other ConsentDocumentType values (TERMS_OF_SERVICE / PRIVACY_POLICY /
 * AFSL_BOUNDARY_DISCLOSURE) are mandatory for continued use of the service —
 * "revoking" those = the user must delete their account (handled via the
 * §13.2 right-to-erasure path on User.deletionRequestedAt). Any attempt to
 * revoke a mandatory document type returns 400.
 *
 * Side effects:
 *   - Sets `revokedAt` + `revokedReason` on every active MARKETING
 *     UserConsent row for the user (idempotent — re-revoking is a no-op).
 *   - Writes CONSENT_MARKETING_OPTED_OUT AuditLog row.
 *
 * §12.11 destructive-write checklist:
 *   1. Where-clause matches: ONLY the authenticated user's own MARKETING rows
 *      where revokedAt IS NULL. Scoped by `userId` from the verified Firebase
 *      token via withAuth.
 *   2. Columns overwritten: revokedAt (was null), revokedReason (was null).
 *      No financial / identity / settings data overwritten. The acceptance
 *      history (acceptedAt, ipAddressHash, userAgent, documentVersion) is
 *      preserved — the row is marked revoked, not deleted.
 *   3. Guard ensuring this only mutates rows our user owns: userId from
 *      verified auth context; documentType filter restricts to MARKETING
 *      only. No risk of clobbering other-user rows; no risk of touching
 *      mandatory consent rows. Safe.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/middleware';
import { prisma } from '@/lib/db';
import { createAuditLog } from '@/lib/security/auditLog';
import { extractRequestMeta } from '@/lib/audit/logger';

const BodySchema = z.object({
  documentType: z.literal('MARKETING_COMMUNICATIONS'),
  reason: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    const userId = authReq.user!.userId;

    let body: z.infer<typeof BodySchema>;
    try {
      body = BodySchema.parse(await request.json());
    } catch (err) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_REVOCATION_PAYLOAD',
            message:
              err instanceof z.ZodError
                ? err.errors[0]?.message
                : 'Only MARKETING_COMMUNICATIONS is revocable. To withdraw acceptance of Terms / Privacy / AFSL, delete your account from Settings.',
          },
        },
        { status: 400 }
      );
    }

    const meta = extractRequestMeta(request);
    const userAgent = meta.userAgent ? meta.userAgent.slice(0, 500) : undefined;

    const result = await prisma.userConsent.updateMany({
      where: {
        userId,
        documentType: 'MARKETING_COMMUNICATIONS',
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: body.reason ?? 'user_revoked_from_settings',
      },
    });

    if (result.count > 0) {
      await createAuditLog({
        userId,
        action: 'CONSENT_MARKETING_OPTED_OUT',
        entityType: 'UserConsent',
        ipAddress: meta.ip,
        userAgent,
        metadata: {
          documentType: body.documentType,
          rowsRevoked: result.count,
          reasonProvided: !!body.reason,
        },
      }).catch(() => undefined);
    }

    return NextResponse.json({
      success: true,
      data: { revokedCount: result.count },
    });
  });
}
