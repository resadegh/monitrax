/**
 * Phase 47 PR 2 — Consent status endpoint.
 *
 * GET /api/auth/consent/status
 *
 * Returns whether the authenticated user has accepted the current version
 * of each MANDATORY legal document (Terms / Privacy / AFSL). Consumed by
 * `<ConsentMigrationModal />` to decide whether to render the blocking
 * migration prompt to an authenticated user who lacks current consent —
 * the typical case being a friendly who signed up before Phase 47 PR 1
 * shipped the consent flow.
 *
 * Auth: bearer Firebase ID token via `withAuth`.
 *
 * Response shape:
 * ```json
 * {
 *   success: true,
 *   data: {
 *     requiresConsent: boolean,
 *     needed: Array<'TERMS_OF_SERVICE' | 'PRIVACY_POLICY' | 'AFSL_BOUNDARY_DISCLOSURE'>,
 *     currentVersions: { tos: string, privacy: string, afsl: string },
 *     accepted: { tos: string|null, privacy: string|null, afsl: string|null,
 *                 marketingOptIn: boolean }
 *   }
 * }
 * ```
 *
 * Privacy: returns only flags + version strings — no PII beyond the
 * principalId already on the auth context.
 *
 * §12.11 N/A — read-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { prisma } from '@/lib/db';
import { getCurrentDocumentVersion } from '@/lib/legal/content';

const MANDATORY_TYPES = ['TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'AFSL_BOUNDARY_DISCLOSURE'] as const;

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    const userId = authReq.user!.userId;

    const currentVersions = {
      tos: getCurrentDocumentVersion('TERMS_OF_SERVICE'),
      privacy: getCurrentDocumentVersion('PRIVACY_POLICY'),
      afsl: getCurrentDocumentVersion('AFSL_BOUNDARY_DISCLOSURE'),
    };

    // Pull the user's latest non-revoked consent row per document type.
    const rows = await prisma.userConsent.findMany({
      where: { userId, revokedAt: null },
      select: { documentType: true, documentVersion: true, acceptedAt: true },
      orderBy: { acceptedAt: 'desc' },
    });

    const latest = new Map<string, string>();
    for (const r of rows) {
      // First match wins because we ordered by acceptedAt desc.
      if (!latest.has(r.documentType)) {
        latest.set(r.documentType, r.documentVersion);
      }
    }

    const accepted = {
      tos: latest.get('TERMS_OF_SERVICE') ?? null,
      privacy: latest.get('PRIVACY_POLICY') ?? null,
      afsl: latest.get('AFSL_BOUNDARY_DISCLOSURE') ?? null,
      marketingOptIn: latest.has('MARKETING_COMMUNICATIONS'),
    };

    const needed: Array<typeof MANDATORY_TYPES[number]> = [];
    if (accepted.tos !== currentVersions.tos) needed.push('TERMS_OF_SERVICE');
    if (accepted.privacy !== currentVersions.privacy) needed.push('PRIVACY_POLICY');
    if (accepted.afsl !== currentVersions.afsl) needed.push('AFSL_BOUNDARY_DISCLOSURE');

    return NextResponse.json({
      success: true,
      data: {
        requiresConsent: needed.length > 0,
        needed,
        currentVersions,
        accepted,
      },
    });
  });
}
