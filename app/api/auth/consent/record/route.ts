/**
 * Phase 47 PR 3 — Consent record download (Privacy Act APP 12 access right).
 *
 * GET /api/auth/consent/record
 *
 * Returns the user's complete consent history as a JSON payload formatted
 * for human reading + regulator-friendly inspection. Powers the "Download
 * my consent record" button on /dashboard/settings/legal.
 *
 * Privacy Act APP 12 gives an individual the right to access personal
 * information held about them. Consent records ARE personal information
 * about that individual; surfacing them on-demand to the user is the
 * compliant fulfilment of APP 12 for this data class.
 *
 * Privacy: the response contains only the user's own consent rows. The
 * full ipAddressHash + userAgent strings are included (the user is the
 * data subject for these rows). No other user's data leaks.
 *
 * §12.11 N/A — read-only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { prisma } from '@/lib/db';
import { getCurrentDocumentVersion } from '@/lib/legal/content';

export async function GET(request: NextRequest) {
  return withAuth(request, async (authReq) => {
    const userId = authReq.user!.userId;

    const [user, consents] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, createdAt: true },
      }),
      prisma.userConsent.findMany({
        where: { userId },
        orderBy: [{ documentType: 'asc' }, { acceptedAt: 'desc' }],
      }),
    ]);

    const payload = {
      exportedAt: new Date().toISOString(),
      generatedBy: 'Monitrax — /api/auth/consent/record (Privacy Act APP 12)',
      user: user
        ? {
            id: user.id,
            email: user.email,
            name: user.name,
            accountCreatedAt: user.createdAt.toISOString(),
          }
        : null,
      currentDocumentVersions: {
        termsOfService: getCurrentDocumentVersion('TERMS_OF_SERVICE'),
        privacyPolicy: getCurrentDocumentVersion('PRIVACY_POLICY'),
        afslBoundaryDisclosure: getCurrentDocumentVersion('AFSL_BOUNDARY_DISCLOSURE'),
      },
      consentHistory: consents.map((c) => ({
        documentType: c.documentType,
        documentVersion: c.documentVersion,
        acceptedAt: c.acceptedAt.toISOString(),
        revokedAt: c.revokedAt ? c.revokedAt.toISOString() : null,
        revokedReason: c.revokedReason,
        consentSource: c.consentSource,
        ipAddressHash: c.ipAddressHash,
        userAgent: c.userAgent,
      })),
      legalNotice:
        'This record is your complete Monitrax consent history. ' +
        'IP addresses are stored as SHA-256 hashes (forensic correlation only — the raw IP is never retained). ' +
        'For questions, contact admin@monitrax.com.au.',
    };

    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="monitrax-consent-record-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  });
}
